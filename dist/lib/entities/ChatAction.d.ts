import type WebMaxClient from '../client.js';
import User from './User.js';
type UnknownRecord = Record<string, unknown>;
/**
 * Класс представляющий действие в чате
 */
export default class ChatAction {
    client: WebMaxClient;
    type: string | null;
    chatId: string | number | null;
    userId: string | number | null;
    user: User | null;
    timestamp: number;
    rawData: UnknownRecord;
    constructor(data: UnknownRecord, client: WebMaxClient);
    /**
     * Возвращает строковое представление действия
     */
    toString(): string;
    /**
     * Возвращает JSON представление
     */
    toJSON(): {
        type: string | null;
        chatId: string | number | null;
        userId: string | number | null;
        user: {
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
    };
}
export {};
//# sourceMappingURL=ChatAction.d.ts.map