/**
 * Менеджер сессий для хранения данных авторизации
 */
export declare class SessionManager {
    sessionName: string;
    sessionDir: string;
    sessionFile: string;
    data: Record<string, unknown>;
    constructor(sessionName?: string);
    /**
     * Создает директорию для сессий если её нет
     */
    ensureSessionDir(): void;
    /**
     * Загружает данные сессии из файла
     */
    load(): boolean;
    /**
     * Сохраняет данные сессии в файл
     */
    save(): boolean;
    /**
     * Устанавливает значение в сессии
     */
    set(key: string, value: unknown): void;
    /**
     * Получает значение из сессии
     */
    get<T = unknown>(key: string, defaultValue?: T | null): T | null;
    /**
     * Удаляет значение из сессии
     */
    delete(key: string): void;
    /**
     * Проверяет наличие ключа в сессии
     */
    has(key: string): boolean;
    /**
     * Очищает все данные сессии
     */
    clear(): void;
    /**
     * Удаляет файл сессии
     */
    destroy(): boolean;
    /**
     * Проверяет, авторизован ли пользователь
     */
    isAuthorized(): boolean;
}
