import { User, UserPayload } from './User';
import type { WebMaxClient } from '../client';
import type { ApiValue, Id } from '../types';
export interface Attachment {
    _type?: string;
    type?: string;
    fileId?: Id;
    id?: Id;
    file_id?: Id;
    [key: string]: ApiValue;
}
export interface MessagePayload {
    id?: Id | null;
    messageId?: Id | null;
    cid?: Id | null;
    chatId?: Id | null;
    chat_id?: Id | null;
    text?: string | {
        text?: string;
    } | null;
    message?: string;
    sender?: UserPayload | Id | null;
    senderId?: Id | null;
    sender_id?: Id | null;
    from_id?: Id | null;
    timestamp?: number;
    time?: number;
    type?: string;
    isEdited?: boolean;
    is_edited?: boolean;
    replyTo?: Id | null;
    reply_to?: Id | null;
    attaches?: Attachment[];
    attachments?: Attachment[];
}
export interface ReplyOptions {
    text?: string;
    cid?: number;
}
export interface EditOptions {
    text?: string;
}
export interface DownloadOptions {
    output?: string;
}
/**
 * Класс представляющий сообщение
 */
export declare class Message {
    client: WebMaxClient;
    id: Id | null;
    cid: Id | null;
    chatId: Id | null;
    text: string;
    senderId: Id | null;
    sender: User | null;
    timestamp: number;
    type: string;
    isEdited: boolean;
    replyTo: Id | null;
    attachments: Attachment[];
    rawData: MessagePayload;
    constructor(data: MessagePayload, client: WebMaxClient);
    /**
     * Получить информацию об отправителе
     */
    fetchSender(): Promise<User | null>;
    /**
     * Получить имя отправителя
     */
    getSenderName(): string;
    /**
     * Ответить на сообщение
     */
    reply(options: ReplyOptions | string): Promise<Message | ApiValue | null>;
    /**
     * Редактировать сообщение
     */
    edit(options: EditOptions | string): Promise<Message | ApiValue>;
    /**
     * Удалить сообщение
     */
    delete(): Promise<boolean>;
    /**
     * Переслать сообщение
     */
    forward(chatId: Id): Promise<ApiValue>;
    downloadFile(index?: number, options?: DownloadOptions): Promise<Buffer | {
        path: string;
        url: string;
        unsafe: boolean;
    }>;
    /**
     * Возвращает строковое представление сообщения
     */
    toString(): string;
    /**
     * Возвращает JSON представление
     */
    toJSON(): {
        id: Id | null;
        cid: Id | null;
        chatId: Id | null;
        text: string;
        senderId: Id | null;
        sender: ReturnType<User['toJSON']> | null;
        timestamp: number;
        type: string;
        isEdited: boolean;
        replyTo: Id | null;
        attachments: Attachment[];
    };
}
