import type WebMaxClient from '../client.js';
import User from './User.js';
type UnknownRecord = Record<string, unknown>;
type MessageReplyOptions = {
    text?: string;
    cid?: number;
    [key: string]: unknown;
};
type MessageEditOptions = {
    text?: string;
    [key: string]: unknown;
};
/**
 * Класс представляющий сообщение
 */
export default class Message {
    client: WebMaxClient;
    id: string | number | null;
    cid: string | number | null;
    chatId: string | number | null;
    text: string;
    senderId: string | number | null;
    sender: User | null;
    timestamp: number;
    type: string;
    isEdited: boolean;
    replyTo: string | number | null;
    attachments: unknown[];
    rawData: UnknownRecord;
    constructor(data: UnknownRecord, client: WebMaxClient);
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
    reply(options: string | MessageReplyOptions): Promise<Message | {
        [x: string]: unknown;
    } | null>;
    /**
     * Редактировать сообщение
     */
    edit(options: string | MessageEditOptions): Promise<Message | {
        [x: string]: unknown;
    } | null>;
    /**
     * Удалить сообщение
     */
    delete(): Promise<boolean>;
    /**
     * Переслать сообщение
     */
    forward(chatId: string | number): Promise<unknown>;
    /**
     * Возвращает строковое представление сообщения
     */
    toString(): string;
    /**
     * Возвращает JSON представление
     */
    toJSON(): {
        id: string | number | null;
        cid: string | number | null;
        chatId: string | number | null;
        text: string;
        senderId: string | number | null;
        sender: {
            id: string | number | null;
            firstname: string;
            lastname: string;
            username: string | null;
            phone: string | null;
            avatar: string | null;
            photoId: string | number | null;
            status: string;
            bio: string;
        } | null;
        timestamp: number;
        type: string;
        isEdited: boolean;
        replyTo: string | number | null;
        attachments: unknown[];
    };
}
export {};
//# sourceMappingURL=Message.d.ts.map