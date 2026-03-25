"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const uuid_1 = require("uuid");
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const session_js_1 = __importDefault(require("./session.js"));
const index_js_1 = require("./entities/index.js");
const constants_js_1 = require("./constants.js");
const opcodes_js_1 = require("./opcodes.js");
const userAgent_js_1 = require("./userAgent.js");
const isRecord = (value) => typeof value === 'object' && value !== null;
const NOTIF_MSG_DELETE = opcodes_js_1.Opcode['NOTIF_MSG_DELETE'];
const getErrorMessage = (error) => {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
};
/**
 * Основной клиент для работы с API Max
 */
class WebMaxClient extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.phone = options.phone || null;
        this.sessionName = options.name || options.session || 'default';
        this.apiUrl = options.apiUrl || 'wss://ws-api.oneme.ru/websocket';
        this.origin = 'https://web.max.ru';
        this.session = new session_js_1.default(this.sessionName);
        // UserAgent
        this.userAgent = options.userAgent || new userAgent_js_1.UserAgentPayload({
            appVersion: options.appVersion || '26.3.9'
        });
        // Device ID
        const storedDeviceId = this.session.get('deviceId');
        this.deviceId = options.deviceId || storedDeviceId || (0, uuid_1.v4)();
        if (!storedDeviceId) {
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
            [constants_js_1.EventTypes.START]: [],
            [constants_js_1.EventTypes.MESSAGE]: [],
            [constants_js_1.EventTypes.MESSAGE_REMOVED]: [],
            [constants_js_1.EventTypes.CHAT_ACTION]: [],
            [constants_js_1.EventTypes.ERROR]: [],
            [constants_js_1.EventTypes.DISCONNECT]: []
        };
        this.messageQueue = [];
        this.pendingRequests = new Map();
    }
    /**
     * Регистрация обработчика события start
     */
    onStart(handler) {
        if (typeof handler === 'function') {
            this.handlers[constants_js_1.EventTypes.START].push(handler);
            return handler;
        }
        // Поддержка декоратора
        return (fn) => {
            this.handlers[constants_js_1.EventTypes.START].push(fn);
            return fn;
        };
    }
    /**
     * Регистрация обработчика сообщений
     */
    onMessage(handler) {
        if (typeof handler === 'function') {
            this.handlers[constants_js_1.EventTypes.MESSAGE].push(handler);
            return handler;
        }
        return (fn) => {
            this.handlers[constants_js_1.EventTypes.MESSAGE].push(fn);
            return fn;
        };
    }
    /**
     * Регистрация обработчика удаленных сообщений
     */
    onMessageRemoved(handler) {
        if (typeof handler === 'function') {
            this.handlers[constants_js_1.EventTypes.MESSAGE_REMOVED].push(handler);
            return handler;
        }
        return (fn) => {
            this.handlers[constants_js_1.EventTypes.MESSAGE_REMOVED].push(fn);
            return fn;
        };
    }
    /**
     * Регистрация обработчика действий в чате
     */
    onChatAction(handler) {
        if (typeof handler === 'function') {
            this.handlers[constants_js_1.EventTypes.CHAT_ACTION].push(handler);
            return handler;
        }
        return (fn) => {
            this.handlers[constants_js_1.EventTypes.CHAT_ACTION].push(fn);
            return fn;
        };
    }
    /**
     * Регистрация обработчика ошибок
     */
    onError(handler) {
        if (typeof handler === 'function') {
            this.handlers[constants_js_1.EventTypes.ERROR].push(handler);
            return handler;
        }
        return (fn) => {
            this.handlers[constants_js_1.EventTypes.ERROR].push(fn);
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
                }
                catch (error) {
                    console.log('⚠️ Сессия истекла, требуется повторная авторизация');
                    this.session.clear();
                    await this.authorize();
                }
            }
            else {
                console.log('📱 Требуется авторизация');
                await this.authorize();
            }
            // Запускаем обработчики start
            await this.triggerHandlers(constants_js_1.EventTypes.START);
            console.log('\n✅ Клиент запущен успешно!');
        }
        catch (error) {
            console.error('❌ Ошибка при запуске клиента:', error);
            await this.triggerHandlers(constants_js_1.EventTypes.ERROR, error);
            throw error;
        }
    }
    /**
     * Запрос QR-кода для авторизации (только для device_type="WEB")
     */
    async requestQR() {
        console.log('Запрос QR-кода для авторизации...');
        const response = await this.sendAndWait(opcodes_js_1.Opcode.GET_QR, {});
        if (isRecord(response.payload) && response.payload.error) {
            throw new Error(`QR request error: ${JSON.stringify(response.payload.error)}`);
        }
        return response.payload;
    }
    /**
     * Проверка статуса QR-кода
     */
    async checkQRStatus(trackId) {
        const response = await this.sendAndWait(opcodes_js_1.Opcode.GET_QR_STATUS, { trackId });
        if (isRecord(response.payload) && response.payload.error) {
            throw new Error(`QR status error: ${JSON.stringify(response.payload.error)}`);
        }
        return response.payload;
    }
    /**
     * Завершение авторизации по QR-коду
     */
    async loginByQR(trackId) {
        const response = await this.sendAndWait(opcodes_js_1.Opcode.LOGIN_BY_QR, { trackId });
        if (isRecord(response.payload) && response.payload.error) {
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
            await new Promise((resolve) => setTimeout(resolve, pollingInterval));
            try {
                const statusResponse = await this.checkQRStatus(trackId);
                if (isRecord(statusResponse) && isRecord(statusResponse.status) && statusResponse.status.loginAvailable) {
                    console.log('✅ QR-код отсканирован!');
                    return true;
                }
                // Продолжаем опрос
                process.stdout.write('.');
            }
            catch (error) {
                console.error('\nОшибка при проверке статуса QR:', getErrorMessage(error));
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
            if (!isRecord(qrData) || !qrData.qrLink || !qrData.trackId || !qrData.pollingInterval || !qrData.expiresAt) {
                throw new Error('Неполные данные QR-кода от сервера');
            }
            console.log('\n' + '='.repeat(70));
            console.log('🔐 АВТОРИЗАЦИЯ ЧЕРЕЗ QR-КОД');
            console.log('='.repeat(70));
            console.log('\n📱 Откройте приложение Max на телефоне');
            console.log('➡️  Настройки → Устройства → Подключить устройство');
            console.log('📸 Отсканируйте QR-код ниже:\n');
            // Отображаем QR-код в консоли
            qrcode_terminal_1.default.generate(String(qrData.qrLink), { small: true }, (qrCode) => {
                console.log(qrCode);
            });
            console.log('\n💡 Или откройте ссылку: ' + qrData.qrLink);
            console.log('='.repeat(70) + '\n');
            // Опрашиваем статус
            await this.pollQRStatus(String(qrData.trackId), Number(qrData.pollingInterval), Number(qrData.expiresAt));
            // Получаем токен
            console.log('\n\nПолучение токена авторизации...');
            const loginData = await this.loginByQR(String(qrData.trackId));
            const loginAttrs = isRecord(loginData) && isRecord(loginData.tokenAttrs) ? loginData.tokenAttrs.LOGIN : undefined;
            const token = isRecord(loginAttrs) ? loginAttrs.token : undefined;
            if (typeof token !== 'string' || !token) {
                throw new Error('Токен не получен из ответа');
            }
            this.session.set('token', token);
            this.session.set('deviceId', this.deviceId);
            this.isAuthorized = true;
            this._token = token;
            console.log('✅ Авторизация через QR-код успешна!');
            // Выполняем sync
            await this.sync();
        }
        catch (error) {
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
        const response = await this.sendAndWait(opcodes_js_1.Opcode.LOGIN, payload);
        if (isRecord(response.payload) && response.payload.error) {
            throw new Error(`Sync error: ${JSON.stringify(response.payload.error)}`);
        }
        // Сохраняем информацию о пользователе
        const responsePayload = isRecord(response.payload) ? response.payload : {};
        // Извлекаем данные пользователя из profile.contact
        const profile = isRecord(responsePayload.profile) ? responsePayload.profile : null;
        const contact = profile && isRecord(profile.contact) ? profile.contact : null;
        if (contact) {
            const names = Array.isArray(contact.names) ? contact.names : [];
            const name = names.length > 0 && isRecord(names[0]) ? names[0] : {};
            const userData = {
                id: contact.id,
                firstname: (typeof name.firstName === 'string' && name.firstName) || (typeof name.name === 'string' && name.name) || '',
                lastname: (typeof name.lastName === 'string' && name.lastName) || '',
                phone: contact.phone,
                avatar: contact.baseUrl || contact.baseRawUrl,
                photoId: contact.photoId,
                rawData: contact
            };
            this.me = new index_js_1.User(userData);
            const fullName = this.me.fullname || this.me.firstname || 'User';
            console.log(`✅ Синхронизация завершена. Вы вошли как: ${fullName} (ID: ${this.me.id})`);
        }
        else {
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
            const response = await this.sendAndWait(opcodes_js_1.Opcode.PROFILE, {});
            if (isRecord(response.payload) && isRecord(response.payload.user)) {
                this.me = new index_js_1.User(response.payload.user);
                const name = this.me.fullname || this.me.firstname || 'User';
                console.log(`✅ Профиль загружен: ${name} (ID: ${this.me.id})`);
            }
        }
        catch (error) {
            console.error('⚠️ Не удалось загрузить профиль:', getErrorMessage(error));
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
            }
            catch (error) {
                console.log('Сессия истекла, требуется повторная авторизация');
                this.session.clear();
                await this.authorize();
            }
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Установка WebSocket соединения
     */
    async connect() {
        if (this.ws && this.isConnected) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const headers = {
                'User-Agent': this.userAgent.headerUserAgent,
                'Origin': this.origin
            };
            this.ws = new ws_1.default(this.apiUrl, {
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
                }
                catch (error) {
                    reject(error);
                }
            });
            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });
            this.ws.on('error', (error) => {
                console.error('WebSocket ошибка:', error.message);
                this.triggerHandlers(constants_js_1.EventTypes.ERROR, error);
                reject(error);
            });
            this.ws.on('close', () => {
                console.log('WebSocket соединение закрыто');
                this.isConnected = false;
                this.triggerHandlers(constants_js_1.EventTypes.DISCONNECT);
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
        const response = await this.sendAndWait(opcodes_js_1.Opcode.SESSION_INIT, payload);
        if (isRecord(response.payload) && response.payload.error) {
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
        }
        else {
            console.error('Превышено максимальное количество попыток переподключения');
        }
    }
    /**
     * Обработка входящих сообщений
     */
    async handleMessage(data) {
        try {
            const raw = typeof data === 'string' ? data : data.toString();
            const message = JSON.parse(raw);
            // Отладочное логирование (раскомментируйте при необходимости)
            // if (message.opcode !== Opcode.PING) {
            //   console.log(`📥 Получено: ${getOpcodeName(message.opcode)} (seq=${message.seq})`);
            // }
            // Обработка ответов на запросы по seq
            if (typeof message.seq === 'number' && this.pendingRequests.has(message.seq)) {
                const pending = this.pendingRequests.get(message.seq);
                this.pendingRequests.delete(message.seq);
                if (pending?.timeoutId) {
                    clearTimeout(pending.timeoutId);
                }
                pending?.resolve(message);
                return;
            }
            // Обработка уведомлений
            switch (message.opcode) {
                case opcodes_js_1.Opcode.NOTIF_MESSAGE:
                    await this.handleNewMessage(message.payload || {});
                    break;
                case NOTIF_MSG_DELETE:
                    await this.handleRemovedMessage(message.payload || {});
                    break;
                case opcodes_js_1.Opcode.NOTIF_CHAT:
                    await this.handleChatAction(message.payload || {});
                    break;
                case opcodes_js_1.Opcode.PING:
                    // Отвечаем на ping (без логирования)
                    await this.sendPong();
                    break;
                default:
                    this.emit('raw_message', message);
            }
        }
        catch (error) {
            console.error('Ошибка при обработке сообщения:', error);
            await this.triggerHandlers(constants_js_1.EventTypes.ERROR, error);
        }
    }
    /**
     * Отправка pong ответа на ping
     */
    async sendPong() {
        try {
            if (!this.ws) {
                return;
            }
            const message = this.makeMessage(opcodes_js_1.Opcode.PING, {});
            this.ws.send(JSON.stringify(message));
        }
        catch (error) {
            console.error('Ошибка при отправке pong:', error);
        }
    }
    /**
     * Обработка нового сообщения
     */
    async handleNewMessage(data) {
        // Извлекаем данные сообщения из правильного места
        // Структура: { chatId, message: { sender, id, text, ... } }
        const messageData = isRecord(data.message) ? data.message : data;
        // Добавляем chatId если его нет в messageData
        if (!('chatId' in messageData) && data.chatId) {
            messageData.chatId = data.chatId;
        }
        const message = new index_js_1.Message(messageData, this);
        // Попытка загрузить информацию об отправителе если её нет
        if (!message.sender && message.senderId && message.senderId !== this.me?.id) {
            await message.fetchSender();
        }
        await this.triggerHandlers(constants_js_1.EventTypes.MESSAGE, message);
    }
    /**
     * Обработка удаленного сообщения
     */
    async handleRemovedMessage(data) {
        const message = new index_js_1.Message(data, this);
        await this.triggerHandlers(constants_js_1.EventTypes.MESSAGE_REMOVED, message);
    }
    /**
     * Обработка действия в чате
     */
    async handleChatAction(data) {
        const action = new index_js_1.ChatAction(data, this);
        await this.triggerHandlers(constants_js_1.EventTypes.CHAT_ACTION, action);
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
            if (!this.isConnected || !this.ws) {
                reject(new Error('WebSocket не подключен'));
                return;
            }
            const message = this.makeMessage(opcode, payload, cmd);
            const seq = message.seq;
            const pendingRequest = { resolve, reject };
            this.pendingRequests.set(seq, pendingRequest);
            // Таймаут для запроса
            const timeoutId = setTimeout(() => {
                if (this.pendingRequests.has(seq)) {
                    this.pendingRequests.delete(seq);
                    reject(new Error(`Таймаут запроса (seq: ${seq}, opcode: ${opcode})`));
                }
            }, timeout);
            // Сохраняем timeoutId чтобы можно было отменить
            pendingRequest.timeoutId = timeoutId;
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
        const response = await this.sendAndWait(opcodes_js_1.Opcode.MSG_SEND, payload);
        if (isRecord(response.payload) && isRecord(response.payload.message)) {
            return new index_js_1.Message(response.payload.message, this);
        }
        return response.payload || null;
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
        const response = await this.sendAndWait(opcodes_js_1.Opcode.MSG_EDIT, payload);
        if (isRecord(response.payload) && isRecord(response.payload.message)) {
            return new index_js_1.Message(response.payload.message, this);
        }
        return response.payload || null;
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
        await this.sendAndWait(opcodes_js_1.Opcode.MSG_DELETE, payload);
        return true;
    }
    /**
     * Получение информации о пользователе по ID
     */
    async getUser(userId) {
        const payload = {
            contactIds: [userId]
        };
        const response = await this.sendAndWait(opcodes_js_1.Opcode.CONTACT_INFO, payload);
        if (isRecord(response.payload) && Array.isArray(response.payload.contacts) && response.payload.contacts.length > 0) {
            const contact = response.payload.contacts[0];
            if (!isRecord(contact)) {
                return null;
            }
            // Преобразуем структуру контакта в понятный User формат
            const names = Array.isArray(contact.names) ? contact.names : [];
            const name = names.length > 0 && isRecord(names[0]) ? names[0] : {};
            const userData = {
                id: contact.id,
                firstname: (typeof name.firstName === 'string' && name.firstName) || (typeof name.name === 'string' && name.name) || '',
                lastname: (typeof name.lastName === 'string' && name.lastName) || '',
                phone: contact.phone,
                avatar: contact.baseUrl || contact.baseRawUrl,
                photoId: contact.photoId,
                rawData: contact
            };
            return new index_js_1.User(userData);
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
        const response = await this.sendAndWait(opcodes_js_1.Opcode.CHATS_LIST, payload);
        if (isRecord(response.payload) && Array.isArray(response.payload.chats)) {
            return response.payload.chats;
        }
        return [];
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
        const response = await this.sendAndWait(opcodes_js_1.Opcode.CHAT_HISTORY, payload);
        const messages = isRecord(response.payload) && Array.isArray(response.payload.messages)
            ? response.payload.messages
            : [];
        return messages.filter(isRecord).map((msg) => new index_js_1.Message(msg, this));
    }
    async triggerHandlers(eventType, data) {
        try {
            switch (eventType) {
                case constants_js_1.EventTypes.START:
                    for (const handler of this.handlers[constants_js_1.EventTypes.START]) {
                        await handler();
                    }
                    break;
                case constants_js_1.EventTypes.DISCONNECT:
                    for (const handler of this.handlers[constants_js_1.EventTypes.DISCONNECT]) {
                        await handler();
                    }
                    break;
                case constants_js_1.EventTypes.MESSAGE:
                    for (const handler of this.handlers[constants_js_1.EventTypes.MESSAGE]) {
                        await handler(data);
                    }
                    break;
                case constants_js_1.EventTypes.MESSAGE_REMOVED:
                    for (const handler of this.handlers[constants_js_1.EventTypes.MESSAGE_REMOVED]) {
                        await handler(data);
                    }
                    break;
                case constants_js_1.EventTypes.CHAT_ACTION:
                    for (const handler of this.handlers[constants_js_1.EventTypes.CHAT_ACTION]) {
                        await handler(data);
                    }
                    break;
                case constants_js_1.EventTypes.ERROR:
                    for (const handler of this.handlers[constants_js_1.EventTypes.ERROR]) {
                        await handler(data);
                    }
                    break;
                default:
                    break;
            }
        }
        catch (error) {
            console.error(`Ошибка в обработчике ${eventType}:`, error);
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
exports.default = WebMaxClient;
