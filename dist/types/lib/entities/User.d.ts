/**
 * Класс представляющий пользователя
 */
import type { Id } from '../types';
export interface UserPayload {
    id?: Id | null;
    userId?: Id | null;
    contactId?: Id | null;
    firstname?: string;
    firstName?: string;
    first_name?: string;
    lastname?: string;
    lastName?: string;
    last_name?: string;
    username?: string;
    nick?: string;
    phone?: string;
    avatar?: string;
    baseUrl?: string;
    baseRawUrl?: string;
    photoId?: Id | null;
    status?: string;
    bio?: string;
    description?: string;
}
export declare class User {
    id: Id | null;
    firstname: string;
    lastname: string;
    username: string | null;
    phone: string | null;
    avatar: string | null;
    photoId: Id | null;
    status: string;
    bio: string;
    rawData: UserPayload;
    constructor(data: UserPayload);
    /**
     * Возвращает полное имя пользователя
     */
    get fullname(): string;
    /**
     * Возвращает строковое представление пользователя
     */
    toString(): string;
    /**
     * Возвращает JSON представление
     */
    toJSON(): {
        id: Id | null;
        firstname: string;
        lastname: string;
        username: string | null;
        phone: string | null;
        avatar: string | null;
        photoId: Id | null;
        status: string;
        bio: string;
    };
}
