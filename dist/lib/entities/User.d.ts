type UnknownRecord = Record<string, unknown>;
/**
 * Класс представляющий пользователя
 */
export default class User {
    id: string | number | null;
    firstname: string;
    lastname: string;
    username: string | null;
    phone: string | null;
    avatar: string | null;
    photoId: string | number | null;
    status: string;
    bio: string;
    rawData: UnknownRecord;
    constructor(data: UnknownRecord);
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
        id: string | number | null;
        firstname: string;
        lastname: string;
        username: string | null;
        phone: string | null;
        avatar: string | null;
        photoId: string | number | null;
        status: string;
        bio: string;
    };
}
export {};
//# sourceMappingURL=User.d.ts.map