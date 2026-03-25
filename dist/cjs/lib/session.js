"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Менеджер сессий для хранения данных авторизации
 */
class SessionManager {
    constructor(sessionName = 'default') {
        this.sessionName = sessionName;
        this.sessionDir = path_1.default.join(process.cwd(), 'sessions');
        this.sessionFile = path_1.default.join(this.sessionDir, `${sessionName}.json`);
        this.data = {};
        this.ensureSessionDir();
        this.load();
    }
    /**
     * Создает директорию для сессий если её нет
     */
    ensureSessionDir() {
        if (!fs_1.default.existsSync(this.sessionDir)) {
            fs_1.default.mkdirSync(this.sessionDir, { recursive: true });
        }
    }
    /**
     * Загружает данные сессии из файла
     */
    load() {
        try {
            if (fs_1.default.existsSync(this.sessionFile)) {
                const data = fs_1.default.readFileSync(this.sessionFile, 'utf8');
                this.data = JSON.parse(data);
                return true;
            }
        }
        catch (error) {
            console.error('Ошибка при загрузке сессии:', error.message);
        }
        return false;
    }
    /**
     * Сохраняет данные сессии в файл
     */
    save() {
        try {
            fs_1.default.writeFileSync(this.sessionFile, JSON.stringify(this.data, null, 2), 'utf8');
            return true;
        }
        catch (error) {
            console.error('Ошибка при сохранении сессии:', error.message);
            return false;
        }
    }
    /**
     * Устанавливает значение в сессии
     */
    set(key, value) {
        this.data[key] = value;
        this.save();
    }
    /**
     * Получает значение из сессии
     */
    get(key, defaultValue = null) {
        return (this.data[key] !== undefined ? this.data[key] : defaultValue);
    }
    /**
     * Удаляет значение из сессии
     */
    delete(key) {
        delete this.data[key];
        this.save();
    }
    /**
     * Проверяет наличие ключа в сессии
     */
    has(key) {
        return this.data[key] !== undefined;
    }
    /**
     * Очищает все данные сессии
     */
    clear() {
        this.data = {};
        this.save();
    }
    /**
     * Удаляет файл сессии
     */
    destroy() {
        try {
            if (fs_1.default.existsSync(this.sessionFile)) {
                fs_1.default.unlinkSync(this.sessionFile);
            }
            this.data = {};
            return true;
        }
        catch (error) {
            console.error('Ошибка при удалении сессии:', error.message);
            return false;
        }
    }
    /**
     * Проверяет, авторизован ли пользователь
     */
    isAuthorized() {
        return this.has('token') && this.has('userId');
    }
}
exports.SessionManager = SessionManager;
