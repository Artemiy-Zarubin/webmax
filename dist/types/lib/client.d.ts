import WebSocket from 'ws';
import EventEmitter from 'events';
import { SessionManager } from './session';
import { MaxSocketTransport } from './socketTransport';
import { Message, ChatAction, User } from './entities';
import { EventTypes } from './constants';
import { UserAgentPayload, UserAgentPayloadOptions } from './userAgent';
import type { ApiValue, Id } from './types';
import type { Attachment, MessagePayload, ChatActionPayload } from './entities';
export interface SessionConfig {
    token?: string;
    agent?: string;
    ua?: string;
    headerUserAgent?: string;
    device_type?: string | number;
    deviceType?: string | number;
    locale?: string;
    deviceLocale?: string;
    osVersion?: string;
    deviceName?: string;
    appVersion?: string;
    screen?: string;
    timezone?: string;
    buildNumber?: number;
    clientSessionId?: number;
    release?: string;
}
export interface WebMaxClientOptions {
    phone?: string | null;
    name?: string;
    session?: string;
    apiUrl?: string;
    token?: string;
    ua?: string;
    agent?: string;
    headerUserAgent?: string;
    userAgent?: UserAgentPayload | UserAgentPayloadOptions;
    configPath?: string;
    config?: string;
    saveToken?: boolean;
    deviceType?: string | number;
    deviceId?: string;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
    debug?: boolean;
}
export interface SendMessageOptions {
    chatId: Id | null;
    text?: string;
    cid?: number;
    replyTo?: Id | null;
    attachments?: Attachment[];
}
export interface EditMessageOptions {
    messageId: Id | null;
    chatId: Id | null;
    text?: string;
}
export interface DeleteMessageOptions {
    messageId: Id | Id[];
    chatId: Id | null;
    forMe?: boolean;
}
export interface FileLinkRequest {
    fileId: Id;
    chatId: Id;
    messageId: Id;
}
export interface FileLinkResult {
    url: string;
    unsafe: boolean;
}
export interface DownloadFileRequest extends FileLinkRequest {
    output?: string;
}
export interface DownloadFileSaved {
    path: string;
    url: string;
    unsafe: boolean;
}
export type DownloadFileResult = Buffer | DownloadFileSaved;
export type StartHandler = () => void | Promise<void>;
export type MessageHandler = (message: Message) => void | Promise<void>;
export type MessageRemovedHandler = (message: Message) => void | Promise<void>;
export type ChatActionHandler = (action: ChatAction) => void | Promise<void>;
export type ErrorHandler = (error: Error) => void | Promise<void>;
export type DisconnectHandler = () => void | Promise<void>;
export interface ApiResponse {
    ver?: number;
    cmd?: number;
    seq?: number;
    opcode?: number;
    payload?: ApiValue;
}
export interface FileLinkPayload {
    url?: string;
    link?: string;
    downloadUrl?: string;
    fileUrl?: string;
    href?: string;
    unsafe?: boolean;
    isUnsafe?: boolean;
}
/**
 * Основной клиент для работы с API Max
 */
export declare class WebMaxClient extends EventEmitter {
    phone: string | null;
    sessionName: string;
    apiUrl: string;
    _providedToken: string | null;
    _saveTokenToSession: boolean;
    origin: string;
    session: SessionManager;
    _handshakeUserAgent: UserAgentPayload;
    userAgent: UserAgentPayload;
    deviceId: string;
    _useSocketTransport: boolean;
    _socketTransport: MaxSocketTransport | null;
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
    messageQueue: ApiValue[];
    pendingRequests: Map<number, {
        resolve: (data: ApiResponse) => void;
        reject: (error: Error) => void;
        timeoutId?: NodeJS.Timeout;
    }>;
    debug: boolean;
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
    requestQR(): Promise<ApiValue>;
    /**
     * Проверка статуса QR-кода
     */
    checkQRStatus(trackId: string): Promise<ApiValue>;
    /**
     * Завершение авторизации по QR-коду
     */
    loginByQR(trackId: string): Promise<ApiValue>;
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
    sync(): Promise<ApiValue>;
    /**
     * Получение информации о текущем пользователе
     */
    fetchMyProfile(): Promise<void>;
    /**
     * Подключение с существующей сессией
     */
    connectWithSession(): Promise<void>;
    /**
     * Установка соединения (WebSocket или Socket)
     */
    connect(): Promise<void>;
    /**
     * Подключение через TCP Socket (для IOS/ANDROID)
     */
    _connectSocket(): Promise<void>;
    /**
     * Установка WebSocket соединения (для WEB)
     */
    _connectWebSocket(): Promise<void>;
    /**
     * Handshake после подключения
     */
    handshake(): Promise<ApiResponse>;
    /**
     * Обработка уведомлений от Socket транспорта
     */
    handleSocketNotification(data: {
        opcode: number;
        payload?: ApiValue;
        seq?: number;
    }): Promise<void>;
    /**
     * Обработка переподключения
     */
    handleReconnect(): void;
    /**
     * Обработка входящих сообщений (WebSocket)
     */
    handleMessage(data: WebSocket.RawData): Promise<void>;
    /**
     * Отправка pong ответа на ping
     */
    sendPong(): Promise<void>;
    /**
     * Обработка нового сообщения
     */
    handleNewMessage(data: MessagePayload): Promise<void>;
    /**
     * Обработка удаленного сообщения
     */
    handleRemovedMessage(data: MessagePayload): Promise<void>;
    /**
     * Обработка действия в чате
     */
    handleChatAction(data: ChatActionPayload): Promise<void>;
    /**
     * Создает сообщение в протоколе Max API
     */
    makeMessage(opcode: number, payload: ApiValue, cmd?: number): {
        ver: number;
        cmd: number;
        seq: number;
        opcode: number;
        payload: ApiValue;
    };
    /**
     * Отправка запроса и ожидание ответа
     */
    sendAndWait(opcode: number, payload: ApiValue, cmd?: number, timeout?: number): Promise<ApiResponse>;
    /**
     * Отправка сообщения (с уведомлением)
     */
    sendMessage(options: SendMessageOptions): Promise<Message | ApiValue | null>;
    /**
     * Отправка сообщения в канал (без уведомления)
     */
    sendMessageChannel(options: SendMessageOptions): Promise<Message | ApiValue | null>;
    /**
     * Редактирование сообщения
     */
    editMessage(options: EditMessageOptions): Promise<Message | ApiValue>;
    /**
     * Удаление сообщения
     */
    deleteMessage(options: DeleteMessageOptions): Promise<boolean>;
    /**
     * Получение информации о пользователе по ID
     */
    getUser(userId: Id): Promise<User | null>;
    /**
     * Получение списка чатов
     */
    getChats(marker?: number): Promise<ApiValue[]>;
    /**
     * Получение истории сообщений
     */
    getHistory(chatId: Id, from?: number, backward?: number, forward?: number): Promise<Message[]>;
    getFileLink(options: FileLinkRequest): Promise<FileLinkResult>;
    downloadFile(options: DownloadFileRequest & {
        output: string;
    }): Promise<DownloadFileSaved>;
    downloadFile(options: DownloadFileRequest): Promise<DownloadFileResult>;
    /**
     * Выполнение зарегистрированных обработчиков
     */
    triggerHandlers(eventType: keyof WebMaxClient['handlers'], data?: Message | ChatAction | Error): Promise<void>;
    /**
     * Остановка клиента
     */
    stop(): Promise<void>;
    /**
     * Выход из аккаунта
     */
    logout(): Promise<void>;
}
