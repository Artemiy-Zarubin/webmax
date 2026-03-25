import { User, UserPayload } from './User';
import type { WebMaxClient } from '../client';
import type { Id } from '../types';
/**
 * Класс представляющий действие в чате
 */
export interface ChatActionPayload {
    type?: string;
    action?: string;
    chatId?: Id | null;
    chat_id?: Id | null;
    userId?: Id | null;
    user_id?: Id | null;
    user?: UserPayload;
    timestamp?: number;
}
export declare class ChatAction {
    client: WebMaxClient | null;
    type: string | null;
    chatId: Id | null;
    userId: Id | null;
    user: User | null;
    timestamp: number;
    rawData: ChatActionPayload;
    constructor(data: ChatActionPayload, client: WebMaxClient | null);
    /**
     * Возвращает строковое представление действия
     */
    toString(): string;
    /**
     * Возвращает JSON представление
     */
    toJSON(): {
        type: string | null;
        chatId: Id | null;
        userId: Id | null;
        user: ReturnType<User['toJSON']> | null;
        timestamp: number;
    };
}
