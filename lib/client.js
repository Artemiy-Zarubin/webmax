const WebSocket = require('ws');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode-terminal');
const SessionManager = require('./session');
const { Message, ChatAction, User } = require('./entities');
const { EventTypes, ChatActions } = require('./constants');
const { Opcode, DeviceType, getOpcodeName } = require('./opcodes');
const { UserAgentPayload } = require('./userAgent');

/**
 * Основной клиент для работы с API Max
 */
class WebMaxClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.phone = options.phone || null;
    this.sessionName = options.name || options.session || 'default';
    this.apiUrl = options.apiUrl || 'wss://ws-api.oneme.ru/websocket';
    this.origin = 'https://web.max.ru';
    this.session = new SessionManager(this.sessionName);
    
    // UserAgent
    this.userAgent = options.userAgent || new UserAgentPayload({
      appVersion: options.appVersion || '25.12.14'
    });
    
    // Device ID
    this.deviceId = options.deviceId || this.session.get('deviceId') || uuidv4();
    if (!this.session.get('deviceId')) {
      this.session.set('deviceId', this.deviceId);
    }
    
    this.ws = null;
    this.me = null;
    this.isConnected = false;
    this.isAuthorized = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 3000;
    
    // Protocol fields
    this.seq = 0;
    this.ver = 11;
    
    this.handlers = {
      [EventTypes.START]: [],
      [EventTypes.MESSAGE]: [],
      [EventTypes.MESSAGE_REMOVED]: [],
      [EventTypes.CHAT_ACTION]: [],
      [EventTypes.ERROR]: [],
      [EventTypes.DISCONNECT]: []
    };

    this.messageQueue = [];
    this.pendingRequests = new Map();
  }

  /**
   * Регистрация обработчика события start
   */
  onStart(handler) {
    if (typeof handler === 'function') {
      this.handlers[EventTypes.START].push(handler);
      return handler;
    }
    // Поддержка декоратора
    return (fn) => {
      this.handlers[EventTypes.START].push(fn);
      return fn;
    };
  }

  /**
   * Регистрация обработчика сообщений
   */
  onMessage(handler) {
    if (typeof handler === 'function') {
      this.handlers[EventTypes.MESSAGE].push(handler);
      return handler;
    }
    return (fn) => {
      this.handlers[EventTypes.MESSAGE].push(fn);
      return fn;
    };
  }

  /**
   * Регистрация обработчика удаленных сообщений
   */
  onMessageRemoved(handler) {
    if (typeof handler === 'function') {
      this.handlers[EventTypes.MESSAGE_REMOVED].push(handler);
      return handler;
    }
    return (fn) => {
      this.handlers[EventTypes.MESSAGE_REMOVED].push(fn);
      return fn;
    };
  }

  /**
   * Регистрация обработчика действий в чате
   */
  onChatAction(handler) {
    if (typeof handler === 'function') {
      this.handlers[EventTypes.CHAT_ACTION].push(handler);
      return handler;
    }
    return (fn) => {
      this.handlers[EventTypes.CHAT_ACTION].push(fn);
      return fn;
    };
  }

  /**
   * Регистрация обработчика ошибок
   */
  onError(handler) {
    if (typeof handler === 'function') {
      this.handlers[EventTypes.ERROR].push(handler);
      return handler;
    }
    return (fn) => {
      this.handlers[EventTypes.ERROR].push(fn);
      return fn;
    };
  }

  /**
   * Запуск клиента
   */
  async start() {
    try {
      console.log('🚀 Запуск WebMax клиента...');
      
      // Подключаемся к WebSocket
      await this.connect();
      
      // Проверяем наличие сохраненного токена
      const savedToken = this.session.get('token');
      
      if (savedToken) {
        console.log('✅ Найдена сохраненная сессия');
        this._token = savedToken;
        
        try {
          await this.sync();
          this.isAuthorized = true;
        } catch (error) {
          console.log('⚠️ Сессия истекла, требуется повторная авторизация');
          this.session.clear();
          await this.authorize();
        }
      } else {
        console.log('📱 Требуется авторизация');
        await this.authorize();
      }

      // Запускаем обработчики start
      await this.triggerHandlers(EventTypes.START);
      
      console.log('\n✅ Клиент запущен успешно!');
      
    } catch (error) {
      console.error('❌ Ошибка при запуске клиента:', error);
      await this.triggerHandlers(EventTypes.ERROR, error);
      throw error;
    }
  }


  /**
   * Запрос QR-кода для авторизации (только для device_type="WEB")
   */
  async requestQR() {
    console.log('Запрос QR-кода для авторизации...');
    
    const response = await this.sendAndWait(Opcode.GET_QR, {});
    
    if (response.payload && response.payload.error) {
      throw new Error(`QR request error: ${JSON.stringify(response.payload.error)}`);
    }
    
    return response.payload;
  }

  /**
   * Проверка статуса QR-кода
   */
  async checkQRStatus(trackId) {
    const response = await this.sendAndWait(Opcode.GET_QR_STATUS, { trackId });
    
    if (response.payload && response.payload.error) {
      throw new Error(`QR status error: ${JSON.stringify(response.payload.error)}`);
    }
    
    return response.payload;
  }

  /**
   * Завершение авторизации по QR-коду
   */
  async loginByQR(trackId) {
    const response = await this.sendAndWait(Opcode.LOGIN_BY_QR, { trackId });
    
    if (response.payload && response.payload.error) {
      throw new Error(`QR login error: ${JSON.stringify(response.payload.error)}`);
    }
    
    return response.payload;
  }

  /**
   * Опрос статуса QR-кода
   */
  async pollQRStatus(trackId, pollingInterval, expiresAt) {
    console.log('Ожидание сканирования QR-кода...');
    
    while (true) {
      // Проверяем не истек ли QR-код
      const now = Date.now();
      if (now >= expiresAt) {
        throw new Error('QR-код истек. Перезапустите бот для получения нового.');
      }
      
      // Ждем указанный интервал
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
      
      try {
        const statusResponse = await this.checkQRStatus(trackId);
        
        if (statusResponse.status && statusResponse.status.loginAvailable) {
          console.log('✅ QR-код отсканирован!');
          return true;
        }
        
        // Продолжаем опрос
        process.stdout.write('.');
        
      } catch (error) {
        console.error('\nОшибка при проверке статуса QR:', error.message);
        throw error;
      }
    }
  }

  /**
   * Авторизация через QR-код
   */
  async authorizeByQR() {
    try {
      console.log('Запрос QR-кода для авторизации...');
      
      const qrData = await this.requestQR();
      
      if (!qrData.qrLink || !qrData.trackId || !qrData.pollingInterval || !qrData.expiresAt) {
        throw new Error('Неполные данные QR-кода от сервера');
      }
      
      console.log('\n' + '='.repeat(70));
      console.log('🔐 АВТОРИЗАЦИЯ ЧЕРЕЗ QR-КОД');
      console.log('='.repeat(70));
      console.log('\n📱 Откройте приложение Max на телефоне');
      console.log('➡️  Настройки → Устройства → Подключить устройство');
      console.log('📸 Отсканируйте QR-код ниже:\n');
      
      // Отображаем QR-код в консоли
      qrcode.generate(qrData.qrLink, { small: true }, (qrCode) => {
        console.log(qrCode);
      });
      
      console.log('\n💡 Или откройте ссылку: ' + qrData.qrLink);
      console.log('='.repeat(70) + '\n');
      
      // Опрашиваем статус
      await this.pollQRStatus(qrData.trackId, qrData.pollingInterval, qrData.expiresAt);
      
      // Получаем токен
      console.log('\n\nПолучение токена авторизации...');
      const loginData = await this.loginByQR(qrData.trackId);
      
      const loginAttrs = loginData.tokenAttrs && loginData.tokenAttrs.LOGIN;
      const token = loginAttrs && loginAttrs.token;
      
      if (!token) {
        throw new Error('Токен не получен из ответа');
      }
      
      this.session.set('token', token);
      this.session.set('deviceId', this.deviceId);
      this.isAuthorized = true;
      this._token = token;
      
      console.log('✅ Авторизация через QR-код успешна!');
      
      // Выполняем sync
      await this.sync();
      
    } catch (error) {
      console.error('Ошибка QR авторизации:', error);
      throw error;
    }
  }

  /**
   * Авторизация пользователя через QR-код
   */
  async authorize() {
    console.log('🔐 Авторизация через QR-код');
    await this.authorizeByQR();
  }


  /**
   * Синхронизация с сервером (получение данных о пользователе, чатах и т.д.)
   */
  async sync() {
    console.log('🔄 Синхронизация с сервером...');
    
    const token = this._token || this.session.get('token');
    
    if (!token) {
      throw new Error('Токен не найден, требуется авторизация');
    }
    
    const payload = {
      interactive: true,
      token: token,
      chatsSync: 0,
      contactsSync: 0,
      presenceSync: 0,
      draftsSync: 0,
      chatsCount: 40,
      userAgent: this.userAgent.toJSON()
    };

    const response = await this.sendAndWait(Opcode.LOGIN, payload);
    
    if (response.payload && response.payload.error) {
      throw new Error(`Sync error: ${JSON.stringify(response.payload.error)}`);
    }
    
    // Сохраняем информацию о пользователе
    const responsePayload = response.payload || {};
    
    // Извлекаем данные пользователя из profile.contact
    if (responsePayload.profile && responsePayload.profile.contact) {
      const contact = responsePayload.profile.contact;
      const name = contact.names && contact.names.length > 0 ? contact.names[0] : {};
      
      const userData = {
        id: contact.id,
        firstname: name.firstName || name.name || '',
        lastname: name.lastName || '',
        phone: contact.phone,
        avatar: contact.baseUrl || contact.baseRawUrl,
        photoId: contact.photoId,
        rawData: contact
      };
      
      this.me = new User(userData);
      const fullName = this.me.fullname || this.me.firstname || 'User';
      console.log(`✅ Синхронизация завершена. Вы вошли как: ${fullName} (ID: ${this.me.id})`);
    } else {
      console.log('⚠️ Данные пользователя не найдены в ответе sync');
    }
    
    return responsePayload;
  }

  /**
   * Получение информации о текущем пользователе
   */
  async fetchMyProfile() {
    try {
      console.log('📱 Запрос профиля пользователя...');
      const response = await this.sendAndWait(Opcode.PROFILE, {});
      
      if (response.payload && response.payload.user) {
        this.me = new User(response.payload.user);
        const name = this.me.fullname || this.me.firstname || 'User';
        console.log(`✅ Профиль загружен: ${name} (ID: ${this.me.id})`);
      }
    } catch (error) {
      console.error('⚠️ Не удалось загрузить профиль:', error.message);
    }
  }

  /**
   * Подключение с существующей сессией
   */
  async connectWithSession() {
    try {
      await this.connect();
      
      const token = this.session.get('token');
      
      if (!token) {
        console.log('Токен не найден, требуется авторизация');
        await this.authorize();
        return;
      }
      
      this._token = token;
      
      try {
        await this.sync();
        this.isAuthorized = true;
        console.log('Подключение с сохраненной сессией успешно');
      } catch (error) {
        console.log('Сессия истекла, требуется повторная авторизация');
        this.session.clear();
        await this.authorize();
      }
    } catch (error) {
      throw error;
    }
  }


  /**
   * Установка WebSocket соединения
   */
  async connect() {
    if (this.ws && this.isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      const headers = {
        'User-Agent': this.userAgent.headerUserAgent,
        'Origin': this.origin
      };

      this.ws = new WebSocket(this.apiUrl, {
        headers: headers
      });

      this.ws.on('open', async () => {
        console.log('WebSocket соединение установлено');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        
        try {
          // Выполняем handshake
          await this.handshake();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket ошибка:', error.message);
        this.triggerHandlers(EventTypes.ERROR, error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('WebSocket соединение закрыто');
        this.isConnected = false;
        this.triggerHandlers(EventTypes.DISCONNECT);
        this.handleReconnect();
      });
    });
  }

  /**
   * Handshake после подключения
   */
  async handshake() {
    console.log('Выполняется handshake...');
    
    const payload = {
      deviceId: this.deviceId,
      userAgent: this.userAgent.toJSON()
    };

    const response = await this.sendAndWait(Opcode.SESSION_INIT, payload);
    
    if (response.payload && response.payload.error) {
      throw new Error(`Handshake error: ${JSON.stringify(response.payload.error)}`);
    }
    
    console.log('Handshake выполнен успешно');
    return response;
  }

  /**
   * Обработка переподключения
   */
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('Превышено максимальное количество попыток переподключения');
    }
  }

  /**
   * Обработка входящих сообщений
   */
  async handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      // Отладочное логирование (раскомментируйте при необходимости)
      // if (message.opcode !== Opcode.PING) {
      //   console.log(`📥 Получено: ${getOpcodeName(message.opcode)} (seq=${message.seq})`);
      // }
      
      // Обработка ответов на запросы по seq
      if (message.seq && this.pendingRequests.has(message.seq)) {
        const pending = this.pendingRequests.get(message.seq);
        this.pendingRequests.delete(message.seq);
        
        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
        
        pending.resolve(message);
        return;
      }

      // Обработка уведомлений
      switch (message.opcode) {
        case Opcode.NOTIF_MESSAGE:
          await this.handleNewMessage(message.payload);
          break;
          
        case Opcode.NOTIF_MSG_DELETE:
          await this.handleRemovedMessage(message.payload);
          break;
          
        case Opcode.NOTIF_CHAT:
          await this.handleChatAction(message.payload);
          break;

        case Opcode.PING:
          // Отвечаем на ping (без логирования)
          await this.sendPong();
          break;
          
        default:
          this.emit('raw_message', message);
      }
    } catch (error) {
      console.error('Ошибка при обработке сообщения:', error);
      await this.triggerHandlers(EventTypes.ERROR, error);
    }
  }

  /**
   * Отправка pong ответа на ping
   */
  async sendPong() {
    try {
      const message = this.makeMessage(Opcode.PING, {});
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Ошибка при отправке pong:', error);
    }
  }

  /**
   * Обработка нового сообщения
   */
  async handleNewMessage(data) {
    // Извлекаем данные сообщения из правильного места
    // Структура: { chatId, message: { sender, id, text, ... } }
    const messageData = data.message || data;
    
    // Добавляем chatId если его нет в messageData
    if (!messageData.chatId && data.chatId) {
      messageData.chatId = data.chatId;
    }
    
    const message = new Message(messageData, this);
    
    // Попытка загрузить информацию об отправителе если её нет
    if (!message.sender && message.senderId && message.senderId !== this.me?.id) {
      await message.fetchSender();
    }
    
    await this.triggerHandlers(EventTypes.MESSAGE, message);
  }

  /**
   * Обработка удаленного сообщения
   */
  async handleRemovedMessage(data) {
    const message = new Message(data, this);
    await this.triggerHandlers(EventTypes.MESSAGE_REMOVED, message);
  }

  /**
   * Обработка действия в чате
   */
  async handleChatAction(data) {
    const action = new ChatAction(data, this);
    await this.triggerHandlers(EventTypes.CHAT_ACTION, action);
  }

  /**
   * Создает сообщение в протоколе Max API
   */
  makeMessage(opcode, payload, cmd = 0) {
    this.seq += 1;
    
    return {
      ver: this.ver,
      cmd: cmd,
      seq: this.seq,
      opcode: opcode,
      payload: payload
    };
  }

  /**
   * Отправка запроса через WebSocket и ожидание ответа
   */
  sendAndWait(opcode, payload, cmd = 0, timeout = 20000) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('WebSocket не подключен'));
        return;
      }

      const message = this.makeMessage(opcode, payload, cmd);
      const seq = message.seq;

      this.pendingRequests.set(seq, { resolve, reject });

      // Таймаут для запроса
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(seq)) {
          this.pendingRequests.delete(seq);
          reject(new Error(`Таймаут запроса (seq: ${seq}, opcode: ${opcode})`));
        }
      }, timeout);

      // Сохраняем timeoutId чтобы можно было отменить
      this.pendingRequests.get(seq).timeoutId = timeoutId;

      // Отладочное логирование (раскомментируйте при необходимости)
      // if (opcode !== Opcode.PING) {
      //   console.log(`📤 Отправка: ${getOpcodeName(opcode)} (seq=${seq})`);
      // }
      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Отправка сообщения
   */
  async sendMessage(options) {
    if (typeof options === 'string') {
      throw new Error('sendMessage требует объект с параметрами: { chatId, text, cid }');
    }

    const { chatId, text, cid, replyTo, attachments } = options;

    const payload = {
      chatId: chatId,
      message: {
        text: text || '',
        cid: cid || Date.now(),
        elements: [],
        attaches: attachments || [],
        link: replyTo ? { type: 'REPLY', messageId: replyTo } : null
      },
      notify: false
    };

    const response = await this.sendAndWait(Opcode.MSG_SEND, payload);

    if (response.payload && response.payload.message) {
      return new Message(response.payload.message, this);
    }
    
    return response.payload;
  }

  /**
   * Редактирование сообщения
   */
  async editMessage(options) {
    const { messageId, chatId, text } = options;

    const payload = {
      chatId: chatId,
      messageId: messageId,
      text: text || '',
      elements: [],
      attaches: []
    };

    const response = await this.sendAndWait(Opcode.MSG_EDIT, payload);
    
    if (response.payload && response.payload.message) {
      return new Message(response.payload.message, this);
    }
    
    return response.payload;
  }

  /**
   * Удаление сообщения
   */
  async deleteMessage(options) {
    const { messageId, chatId, forMe } = options;

    const payload = {
      chatId: chatId,
      messageIds: Array.isArray(messageId) ? messageId : [messageId],
      forMe: forMe || false
    };

    await this.sendAndWait(Opcode.MSG_DELETE, payload);

    return true;
  }

  /**
   * Получение информации о пользователе по ID
   */
  async getUser(userId) {
    const payload = {
      contactIds: [userId]
    };

    const response = await this.sendAndWait(Opcode.CONTACT_INFO, payload);
    
    if (response.payload && response.payload.contacts && response.payload.contacts.length > 0) {
      const contact = response.payload.contacts[0];
      
      // Преобразуем структуру контакта в понятный User формат
      const name = contact.names && contact.names.length > 0 ? contact.names[0] : {};
      
      const userData = {
        id: contact.id,
        firstname: name.firstName || name.name || '',
        lastname: name.lastName || '',
        phone: contact.phone,
        avatar: contact.baseUrl || contact.baseRawUrl,
        photoId: contact.photoId,
        rawData: contact
      };
      
      return new User(userData);
    }
    
    return null;
  }

  /**
   * Получение списка чатов
   */
  async getChats(marker = 0) {
    const payload = {
      marker: marker
    };

    const response = await this.sendAndWait(Opcode.CHATS_LIST, payload);
    
    return response.payload && response.payload.chats ? response.payload.chats : [];
  }

  /**
   * Получение истории сообщений
   */
  async getHistory(chatId, from = Date.now(), backward = 200, forward = 0) {
    const payload = {
      chatId: chatId,
      from: from,
      forward: forward,
      backward: backward,
      getMessages: true
    };

    const response = await this.sendAndWait(Opcode.CHAT_HISTORY, payload);
    
    const messages = response.payload && response.payload.messages ? response.payload.messages : [];
    return messages.map(msg => new Message(msg, this));
  }

  /**
   * Выполнение зарегистрированных обработчиков
   */
  async triggerHandlers(eventType, data = null) {
    const handlers = this.handlers[eventType] || [];
    
    for (const handler of handlers) {
      try {
        if (data !== null) {
          await handler(data);
        } else {
          await handler();
        }
      } catch (error) {
        console.error(`Ошибка в обработчике ${eventType}:`, error);
      }
    }
  }

  /**
   * Остановка клиента
   */
  async stop() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isAuthorized = false;
    console.log('Клиент остановлен');
  }

  /**
   * Выход из аккаунта
   */
  async logout() {
    await this.stop();
    this.session.destroy();
    console.log('Выход выполнен, сессия удалена');
  }
}

module.exports = WebMaxClient;

