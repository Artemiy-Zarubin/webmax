import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import WebSocket from 'ws';
import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import qrcode from 'qrcode-terminal';
import { SessionManager } from './session';
import { MaxSocketTransport } from './socketTransport';
import { Message, ChatAction, User } from './entities';
import { EventTypes } from './constants';
import { Opcode, getOpcodeName } from './opcodes';
import { UserAgentPayload } from './userAgent';
/**
 * Загружает конфиг: { token, agent }
 */
function loadSessionConfig(configPath) {
    let resolved;
    if (path.isAbsolute(configPath)) {
        resolved = configPath;
    }
    else if (!/[\\/]/.test(configPath) && !configPath.endsWith('.json')) {
        resolved = path.join(process.cwd(), 'config', `${configPath}.json`);
    }
    else {
        resolved = path.join(process.cwd(), configPath);
    }
    if (!fs.existsSync(resolved)) {
        throw new Error(`Конфиг не найден: ${resolved}`);
    }
    const data = fs.readFileSync(resolved, 'utf8');
    return JSON.parse(data);
}
function normalizeFileLinkPayload(payload) {
    if (!payload || typeof payload !== 'object')
        return null;
    const url = payload.url || payload.link || payload.downloadUrl || payload.fileUrl || payload.href || null;
    const unsafe = payload.unsafe || payload.isUnsafe || false;
    if (!url)
        return null;
    return { url, unsafe };
}
function fetchBufferFromUrl(url, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https://') ? https : http;
        const req = client.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return resolve(fetchBufferFromUrl(res.headers.location, timeout));
            }
            if (res.statusCode && res.statusCode >= 400) {
                res.resume();
                return reject(new Error('Не удалось скачать файл. HTTP ' + res.statusCode));
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.setTimeout(timeout, () => {
            req.destroy(new Error('Таймаут скачивания файла'));
        });
    });
}
function downloadToFile(url, outputPath, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https://') ? https : http;
        const req = client.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return resolve(downloadToFile(res.headers.location, outputPath, timeout));
            }
            if (res.statusCode && res.statusCode >= 400) {
                res.resume();
                return reject(new Error('Не удалось скачать файл. HTTP ' + res.statusCode));
            }
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const stream = fs.createWriteStream(outputPath);
            res.pipe(stream);
            stream.on('finish', () => resolve(outputPath));
            stream.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(timeout, () => {
            req.destroy(new Error('Таймаут скачивания файла'));
        });
    });
}
/**
 * Основной клиент для работы с API Max
 */
export class WebMaxClient extends EventEmitter {
    constructor(options = {}) {
        super();
        this.phone = options.phone || null;
        this.sessionName = options.name || options.session || 'default';
        this.apiUrl = options.apiUrl || 'wss://ws-api.oneme.ru/websocket';
        let token = options.token || null;
        let agent = options.ua || options.agent || options.headerUserAgent || null;
        let configObj = {};
        const configPath = options.configPath || options.config;
        if (configPath) {
            configObj = loadSessionConfig(configPath);
            token = token || configObj.token || null;
            agent = agent || configObj.agent || configObj.ua || configObj.headerUserAgent || null;
        }
        this._providedToken = token;
        this._saveTokenToSession = options.saveToken !== false;
        this.origin = 'https://web.max.ru';
        this.session = new SessionManager(this.sessionName);
        const userAgentFromOptions = options.userAgent;
        const resolvedUserAgentOptions = userAgentFromOptions
            ? (userAgentFromOptions instanceof UserAgentPayload ? userAgentFromOptions.toJSON() : userAgentFromOptions)
            : null;
        const deviceTypeMap = { 1: 'WEB', 2: 'IOS', 3: 'ANDROID' };
        const rawDeviceType = options.deviceType
            ?? resolvedUserAgentOptions?.deviceType
            ?? configObj.device_type
            ?? configObj.deviceType
            ?? 'WEB';
        const deviceType = deviceTypeMap[rawDeviceType] || rawDeviceType || 'WEB';
        const uaString = agent
            || resolvedUserAgentOptions?.headerUserAgent
            || configObj.headerUserAgent
            || configObj.ua
            || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
        const webDefaults = {
            deviceType: String(deviceType),
            locale: resolvedUserAgentOptions?.locale || configObj.locale || 'ru',
            deviceLocale: resolvedUserAgentOptions?.deviceLocale || configObj.deviceLocale || configObj.locale || 'ru',
            osVersion: resolvedUserAgentOptions?.osVersion || configObj.osVersion || (deviceType === 'IOS' ? '18.6.2' : deviceType === 'ANDROID' ? '14' : 'Linux'),
            deviceName: resolvedUserAgentOptions?.deviceName || configObj.deviceName || (deviceType === 'IOS' ? 'Safari' : deviceType === 'ANDROID' ? 'Chrome' : 'Chrome'),
            headerUserAgent: uaString,
            appVersion: resolvedUserAgentOptions?.appVersion || configObj.appVersion || '26.3.9',
            screen: resolvedUserAgentOptions?.screen || configObj.screen || (deviceType === 'IOS' ? '390x844 3.0x' : deviceType === 'ANDROID' ? '360x780 3.0x' : '1080x1920 1.0x'),
            timezone: resolvedUserAgentOptions?.timezone || configObj.timezone || 'Europe/Moscow',
            buildNumber: resolvedUserAgentOptions?.buildNumber ?? configObj.buildNumber,
            clientSessionId: resolvedUserAgentOptions?.clientSessionId || configObj.clientSessionId || this.session.get('clientSessionId') || undefined,
            release: resolvedUserAgentOptions?.release || configObj.release
        };
        this._handshakeUserAgent = new UserAgentPayload(webDefaults);
        this.userAgent = this._handshakeUserAgent;
        this.deviceId = options.deviceId || this.session.get('deviceId') || uuidv4();
        if (!this.session.get('deviceId')) {
            this.session.set('deviceId', this.deviceId);
        }
        this._useSocketTransport = (deviceType === 'IOS' || deviceType === 'ANDROID');
        this._socketTransport = null;
        this.ws = null;
        this.me = null;
        this.isConnected = false;
        this.isAuthorized = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.reconnectDelay = options.reconnectDelay || 3000;
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
        this.debug = options.debug || process.env.DEBUG === '1';
    }
    /**
     * Регистрация обработчика события start
     */
    onStart(handler) {
        if (typeof handler === 'function') {
            this.handlers[EventTypes.START].push(handler);
            return handler;
        }
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
            await this.connect();
            const tokenToUse = this._providedToken || this.session.get('token');
            if (tokenToUse) {
                if (this._providedToken) {
                    console.log('✅ Вход по токену (token auth)');
                    if (this._saveTokenToSession) {
                        this.session.set('token', this._providedToken);
                        this.session.set('deviceId', this.deviceId);
                    }
                }
                else {
                    console.log('✅ Найдена сохраненная сессия');
                }
                this._token = tokenToUse;
                try {
                    await this.sync();
                    this.isAuthorized = true;
                }
                catch (error) {
                    const wasTokenAuth = !!this._providedToken;
                    this.session.clear();
                    this._providedToken = null;
                    if (wasTokenAuth) {
                        throw new Error(`Токен недействителен или сессия истекла. Обновите токен в config. (${error.message})`);
                    }
                    console.log('⚠️ Сессия истекла, требуется повторная авторизация');
                    await this.authorize();
                }
            }
            else {
                console.log('📱 Требуется авторизация');
                await this.authorize();
            }
            await this.triggerHandlers(EventTypes.START);
            console.log('\n✅ Клиент запущен успешно!');
        }
        catch (error) {
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
            const now = Date.now();
            if (now >= expiresAt) {
                throw new Error('QR-код истек. Перезапустите бот для получения нового.');
            }
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
            try {
                const statusResponse = await this.checkQRStatus(trackId);
                if (statusResponse.status && statusResponse.status.loginAvailable) {
                    console.log('✅ QR-код отсканирован!');
                    return true;
                }
                process.stdout.write('.');
            }
            catch (error) {
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
            qrcode.generate(qrData.qrLink, { small: true }, (qrCode) => {
                console.log(qrCode);
            });
            console.log('\n💡 Или откройте ссылку: ' + qrData.qrLink);
            console.log('='.repeat(70) + '\n');
            await this.pollQRStatus(qrData.trackId, qrData.pollingInterval, qrData.expiresAt);
            console.log('\n\nПолучение токена авторизации...');
            const loginData = await this.loginByQR(qrData.trackId);
            const loginAttrs = loginData.tokenAttrs && loginData.tokenAttrs.LOGIN;
            const token = loginAttrs && loginAttrs.token;
            if (!token) {
                throw new Error('Токен не получен из ответа');
            }
            this.session.set('token', token);
            this.session.set('deviceId', this.deviceId);
            this.session.set('clientSessionId', this.userAgent.clientSessionId);
            this.session.set('deviceType', 'IOS');
            this.session.set('headerUserAgent', this.userAgent.headerUserAgent);
            this.session.set('appVersion', this.userAgent.appVersion);
            this.session.set('osVersion', this.userAgent.osVersion);
            this.session.set('deviceName', this.userAgent.deviceName);
            this.session.set('screen', this.userAgent.screen);
            this.session.set('timezone', this.userAgent.timezone);
            this.session.set('locale', this.userAgent.locale);
            this.session.set('buildNumber', this.userAgent.buildNumber);
            this.isAuthorized = true;
            this._token = token;
            console.log('✅ Авторизация через QR-код успешна!');
            console.log('💡 При следующем запуске будет использоваться TCP Socket транспорт');
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
            chatsCount: 40
        };
        payload.userAgent = this.userAgent.toJSON();
        const response = await this.sendAndWait(Opcode.LOGIN, payload);
        if (response.payload && response.payload.error) {
            const err = response.payload.error;
            const msg = typeof err === 'string' ? err : (response.payload.localizedMessage || JSON.stringify(err));
            throw new Error(msg);
        }
        const responsePayload = response.payload || {};
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
            const response = await this.sendAndWait(Opcode.PROFILE, {});
            const payload = response.payload;
            if (payload && payload.user) {
                this.me = new User(payload.user);
                const name = this.me.fullname || this.me.firstname || 'User';
                console.log(`✅ Профиль загружен: ${name} (ID: ${this.me.id})`);
            }
        }
        catch (error) {
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
     * Установка соединения (WebSocket или Socket)
     */
    async connect() {
        if (this._useSocketTransport) {
            return this._connectSocket();
        }
        else {
            return this._connectWebSocket();
        }
    }
    /**
     * Подключение через TCP Socket (для IOS/ANDROID)
     */
    async _connectSocket() {
        if (this._socketTransport && this._socketTransport.socket && !this._socketTransport.socket.destroyed) {
            this.isConnected = true;
            return;
        }
        this._socketTransport = new MaxSocketTransport({
            deviceId: this.deviceId,
            deviceType: this.userAgent.deviceType,
            ua: this.userAgent.headerUserAgent,
            debug: this.debug
        });
        this._socketTransport.onNotification = (data) => {
            this.handleSocketNotification(data);
        };
        await this._socketTransport.connect();
        await this._socketTransport.handshake(this.userAgent);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        console.log('TCP Socket соединение установлено');
    }
    /**
     * Установка WebSocket соединения (для WEB)
     */
    async _connectWebSocket() {
        if (this.ws && this.isConnected) {
            return;
        }
        return new Promise((resolve, reject) => {
            const headers = {
                'Origin': this.origin,
                'User-Agent': this._handshakeUserAgent.headerUserAgent
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
                this.triggerHandlers(EventTypes.ERROR, error);
                reject(error);
            });
            this.ws.on('close', () => {
                console.log('WebSocket соединение закрыто');
                this.isConnected = false;
                const err = new Error('Соединение закрыто');
                for (const [, pending] of this.pendingRequests) {
                    if (pending.timeoutId)
                        clearTimeout(pending.timeoutId);
                    pending.reject(err);
                }
                this.pendingRequests.clear();
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
            userAgent: this._handshakeUserAgent.toJSON()
        };
        const response = await this.sendAndWait(Opcode.SESSION_INIT, payload);
        if (response.payload && response.payload.error) {
            throw new Error(`Handshake error: ${JSON.stringify(response.payload.error)}`);
        }
        console.log('Handshake выполнен успешно');
        return response;
    }
    /**
     * Обработка уведомлений от Socket транспорта
     */
    async handleSocketNotification(data) {
        try {
            if (this.debug && data.opcode !== Opcode.PING) {
                const payload = data.payload?.error ? ` error=${JSON.stringify(data.payload.error)}` : '';
                console.log(`📥 ${getOpcodeName(data.opcode)} (seq=${data.seq})${payload}`);
            }
            switch (data.opcode) {
                case Opcode.NOTIF_MESSAGE:
                    await this.handleNewMessage(data.payload);
                    break;
                case Opcode.NOTIF_MSG_DELETE:
                    await this.handleRemovedMessage(data.payload);
                    break;
                case Opcode.NOTIF_CHAT:
                    await this.handleChatAction(data.payload);
                    break;
                case Opcode.PING:
                    break;
                default:
                    this.emit('raw_message', data);
            }
        }
        catch (error) {
            console.error('Ошибка при обработке Socket уведомления:', error);
            await this.triggerHandlers(EventTypes.ERROR, error);
        }
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
     * Обработка входящих сообщений (WebSocket)
     */
    async handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (this.debug && message.opcode !== Opcode.PING) {
                const payload = message.payload?.error ? ` error=${JSON.stringify(message.payload.error)}` : '';
                console.log(`📥 ${getOpcodeName(message.opcode || 0)} (seq=${message.seq})${payload}`);
            }
            if (message.seq && this.pendingRequests.has(message.seq)) {
                const pending = this.pendingRequests.get(message.seq);
                this.pendingRequests.delete(message.seq);
                if (pending && pending.timeoutId) {
                    clearTimeout(pending.timeoutId);
                }
                pending?.resolve(message);
                return;
            }
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
                    await this.sendPong();
                    break;
                default:
                    this.emit('raw_message', message);
            }
        }
        catch (error) {
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
            this.ws?.send(JSON.stringify(message));
        }
        catch (error) {
            console.error('Ошибка при отправке pong:', error);
        }
    }
    /**
     * Обработка нового сообщения
     */
    async handleNewMessage(data) {
        const messageData = data.message || data;
        if (!messageData.chatId && data.chatId) {
            messageData.chatId = data.chatId || null;
        }
        const message = new Message(messageData, this);
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
     * Отправка запроса и ожидание ответа
     */
    async sendAndWait(opcode, payload, cmd = 0, timeout = 20000) {
        if (!this.isConnected) {
            throw new Error('Соединение не установлено');
        }
        if (this._useSocketTransport && this._socketTransport) {
            return await this._socketTransport.sendAndWait(opcode, payload, cmd, timeout);
        }
        return new Promise((resolve, reject) => {
            const message = this.makeMessage(opcode, payload, cmd);
            const seq = message.seq;
            this.pendingRequests.set(seq, { resolve, reject });
            const timeoutId = setTimeout(() => {
                if (this.pendingRequests.has(seq)) {
                    this.pendingRequests.delete(seq);
                    reject(new Error(`Таймаут запроса (seq: ${seq}, opcode: ${opcode})`));
                }
            }, timeout);
            const pending = this.pendingRequests.get(seq);
            if (pending)
                pending.timeoutId = timeoutId;
            this.ws?.send(JSON.stringify(message));
        });
    }
    /**
     * Отправка сообщения (с уведомлением)
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
            notify: true
        };
        const response = await this.sendAndWait(Opcode.MSG_SEND, payload);
        if (response.payload && response.payload.message) {
            return new Message(response.payload.message, this);
        }
        return response.payload;
    }
    /**
     * Отправка сообщения в канал (без уведомления)
     */
    async sendMessageChannel(options) {
        if (typeof options === 'string') {
            throw new Error('sendMessageChannel требует объект с параметрами: { chatId, text, cid }');
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
        if (response.payload && response.payload.contacts && response.payload.contacts?.length) {
            const contact = response.payload.contacts?.[0];
            const name = contact.names;
            const primaryName = name && name.length > 0 ? name[0] : {};
            const userData = {
                id: contact.id,
                firstname: primaryName.firstName || primaryName.name || '',
                lastname: primaryName.lastName || '',
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
        if (this._useSocketTransport && this._socketTransport) {
            return await this._socketTransport.getChats(marker);
        }
        const payload = {
            marker: marker
        };
        const response = await this.sendAndWait(Opcode.CHATS_LIST, payload);
        return response.payload?.chats || [];
    }
    /**
     * Получение истории сообщений
     */
    async getHistory(chatId, from = Date.now(), backward = 200, forward = 0) {
        if (this._useSocketTransport && this._socketTransport) {
            const messages = await this._socketTransport.getHistory(chatId, from, backward, forward);
            return messages.map(msg => new Message(msg, this));
        }
        const payload = {
            chatId: chatId,
            from: from,
            forward: forward,
            backward: backward,
            getMessages: true
        };
        const response = await this.sendAndWait(Opcode.CHAT_HISTORY, payload);
        const messages = response.payload?.messages || [];
        return messages.map(msg => new Message(msg, this));
    }
    async getFileLink(options) {
        if (!options || typeof options !== 'object') {
            throw new Error('getFileLink требует объект с параметрами: { fileId, chatId, messageId }');
        }
        const { fileId, chatId, messageId } = options;
        if (!fileId || !chatId || !messageId) {
            throw new Error('getFileLink требует fileId, chatId и messageId');
        }
        const response = await this.sendAndWait(Opcode.FILE_DOWNLOAD, { fileId, chatId, messageId });
        const payload = response.payload || {};
        if (payload.error) {
            const msg = payload.localizedMessage || payload.error?.message || JSON.stringify(payload.error);
            throw new Error(msg);
        }
        const link = normalizeFileLinkPayload(payload);
        if (!link) {
            throw new Error('Не удалось получить ссылку на файл');
        }
        return link;
    }
    async downloadFile(options) {
        if (!options || typeof options !== 'object') {
            throw new Error('downloadFile требует объект с параметрами: { fileId, chatId, messageId, output? }');
        }
        const { output } = options;
        const link = await this.getFileLink(options);
        if (output) {
            if (typeof output !== 'string') {
                throw new Error('downloadFile: output должен быть строкой пути');
            }
            const savedPath = await downloadToFile(link.url, output);
            return { path: savedPath, url: link.url, unsafe: link.unsafe };
        }
        return await fetchBufferFromUrl(link.url);
    }
    /**
     * Выполнение зарегистрированных обработчиков
     */
    async triggerHandlers(eventType, data) {
        const handlers = this.handlers[eventType] || [];
        for (const handler of handlers) {
            try {
                if (data !== undefined) {
                    await handler(data);
                }
                else {
                    await handler();
                }
            }
            catch (error) {
                console.error(`Ошибка в обработчике ${eventType}:`, error);
            }
        }
    }
    /**
     * Остановка клиента
     */
    async stop() {
        if (this._socketTransport) {
            await this._socketTransport.close();
            this._socketTransport = null;
        }
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
