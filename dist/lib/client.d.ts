import WebSocket from 'ws';
import { EventEmitter } from 'events';
import SessionManager from './session.js';
import { Message, ChatAction, User } from './entities/index.js';
import { EventTypes } from './constants.js';
import { UserAgentPayload } from './userAgent.js';
type UnknownRecord = Record<string, unknown>;
type StartHandler = () => void | Promise<void>;
type MessageHandler = (message: Message) => void | Promise<void>;
type MessageRemovedHandler = (message: Message) => void | Promise<void>;
type ChatActionHandler = (action: ChatAction) => void | Promise<void>;
type ErrorHandler = (error: unknown) => void | Promise<void>;
type DisconnectHandler = () => void | Promise<void>;
type PendingRequest = {
    resolve: (value: ServerMessage) => void;
    reject: (reason?: unknown) => void;
    timeoutId?: NodeJS.Timeout;
};
interface ServerMessage {
    ver?: number;
    cmd?: number;
    seq?: number;
    opcode: number;
    payload?: UnknownRecord | null;
    [key: string]: unknown;
}
interface ClientMessage {
    ver: number;
    cmd: number;
    seq: number;
    opcode: number;
    payload: UnknownRecord;
}
export interface WebMaxClientOptions {
    phone?: string | null;
    name?: string;
    session?: string;
    apiUrl?: string;
    userAgent?: UserAgentPayload;
    appVersion?: string;
    deviceId?: string;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
    [key: string]: unknown;
}
export interface SendMessageOptions {
    chatId: string | number;
    text?: string;
    cid?: number;
    replyTo?: string | number | null;
    attachments?: unknown[];
    [key: string]: unknown;
}
export interface EditMessageOptions {
    messageId: string | number;
    chatId: string | number;
    text?: string;
    [key: string]: unknown;
}
export interface DeleteMessageOptions {
    messageId: string | number | Array<string | number>;
    chatId: string | number;
    forMe?: boolean;
}
/**
 * Основной клиент для работы с API Max
 */
declare class WebMaxClient extends EventEmitter {
    phone: string | null;
    sessionName: string;
    apiUrl: string;
    origin: string;
    session: SessionManager;
    userAgent: UserAgentPayload;
    deviceId: string;
    ws: WebSocket | null;
    me: User | null;
    isConnected: boolean;
    isAuthorized: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    reconnectDelay: number;
    seq: number;
    ver: number;
    handlers: {
        [EventTypes.START]: StartHandler[];
        [EventTypes.MESSAGE]: MessageHandler[];
        [EventTypes.MESSAGE_REMOVED]: MessageRemovedHandler[];
        [EventTypes.CHAT_ACTION]: ChatActionHandler[];
        [EventTypes.ERROR]: ErrorHandler[];
        [EventTypes.DISCONNECT]: DisconnectHandler[];
    };
    messageQueue: unknown[];
    pendingRequests: Map<number, PendingRequest>;
    _token?: string;
    constructor(options?: WebMaxClientOptions);
    /**
     * Регистрация обработчика события start
     */
    onStart(handler?: StartHandler): StartHandler | ((fn: StartHandler) => StartHandler);
    /**
     * Регистрация обработчика сообщений
     */
    onMessage(handler?: MessageHandler): MessageHandler | ((fn: MessageHandler) => MessageHandler);
    /**
     * Регистрация обработчика удаленных сообщений
     */
    onMessageRemoved(handler?: MessageRemovedHandler): MessageRemovedHandler | ((fn: MessageRemovedHandler) => MessageRemovedHandler);
    /**
     * Регистрация обработчика действий в чате
     */
    onChatAction(handler?: ChatActionHandler): ChatActionHandler | ((fn: ChatActionHandler) => ChatActionHandler);
    /**
     * Регистрация обработчика ошибок
     */
    onError(handler?: ErrorHandler): ErrorHandler | ((fn: ErrorHandler) => ErrorHandler);
    /**
     * Запуск клиента
     */
    start(): Promise<void>;
    /**
     * Запрос QR-кода для авторизации (только для device_type="WEB")
     */
    requestQR(): Promise<UnknownRecord | null | undefined>;
    /**
     * Проверка статуса QR-кода
     */
    checkQRStatus(trackId: string): Promise<UnknownRecord | null | undefined>;
    /**
     * Завершение авторизации по QR-коду
     */
    loginByQR(trackId: string): Promise<UnknownRecord | null | undefined>;
    /**
     * Опрос статуса QR-кода
     */
    pollQRStatus(trackId: string, pollingInterval: number, expiresAt: number): Promise<boolean>;
    /**
     * Авторизация через QR-код
     */
    authorizeByQR(): Promise<void>;
    /**
     * Авторизация пользователя через QR-код
     */
    authorize(): Promise<void>;
    /**
     * Синхронизация с сервером (получение данных о пользователе, чатах и т.д.)
     */
    sync(): Promise<UnknownRecord>;
    /**
     * Получение информации о текущем пользователе
     */
    fetchMyProfile(): Promise<void>;
    /**
     * Подключение с существующей сессией
     */
    connectWithSession(): Promise<void>;
    /**
     * Установка WebSocket соединения
     */
    connect(): Promise<void>;
    /**
     * Handshake после подключения
     */
    handshake(): Promise<ServerMessage>;
    /**
     * Обработка переподключения
     */
    handleReconnect(): void;
    /**
     * Обработка входящих сообщений
     */
    handleMessage(data: WebSocket.RawData): Promise<void>;
    /**
     * Отправка pong ответа на ping
     */
    sendPong(): Promise<void>;
    /**
     * Обработка нового сообщения
     */
    handleNewMessage(data: UnknownRecord): Promise<void>;
    /**
     * Обработка удаленного сообщения
     */
    handleRemovedMessage(data: UnknownRecord): Promise<void>;
    /**
     * Обработка действия в чате
     */
    handleChatAction(data: UnknownRecord): Promise<void>;
    /**
     * Создает сообщение в протоколе Max API
     */
    makeMessage(opcode: number, payload: UnknownRecord, cmd?: number): ClientMessage;
    /**
     * Отправка запроса через WebSocket и ожидание ответа
     */
    sendAndWait(opcode: number, payload: UnknownRecord, cmd?: number, timeout?: number): Promise<ServerMessage>;
    /**
     * Отправка сообщения
     */
    sendMessage(options: SendMessageOptions): Promise<Message | UnknownRecord | null>;
    /**
     * Редактирование сообщения
     */
    editMessage(options: EditMessageOptions): Promise<Message | UnknownRecord | null>;
    /**
     * Удаление сообщения
     */
    deleteMessage(options: DeleteMessageOptions): Promise<boolean>;
    /**
     * Получение информации о пользователе по ID
     */
    getUser(userId: string | number): Promise<User | null>;
    /**
     * Получение списка чатов
     */
    getChats(marker?: number): Promise<any[]>;
    /**
     * Получение истории сообщений
     */
    getHistory(chatId: string | number, from?: number, backward?: number, forward?: number): Promise<Message[]>;
    /**
     * Выполнение зарегистрированных обработчиков
     */
    triggerHandlers(eventType: typeof EventTypes.START): Promise<void>;
    triggerHandlers(eventType: typeof EventTypes.DISCONNECT): Promise<void>;
    triggerHandlers(eventType: typeof EventTypes.MESSAGE, data: Message): Promise<void>;
    triggerHandlers(eventType: typeof EventTypes.MESSAGE_REMOVED, data: Message): Promise<void>;
    triggerHandlers(eventType: typeof EventTypes.CHAT_ACTION, data: ChatAction): Promise<void>;
    triggerHandlers(eventType: typeof EventTypes.ERROR, data: unknown): Promise<void>;
    /**
     * Остановка клиента
     */
    stop(): Promise<void>;
    /**
     * Выход из аккаунта
     */
    logout(): Promise<void>;
}
export default WebMaxClient;
//# sourceMappingURL=client.d.ts.map