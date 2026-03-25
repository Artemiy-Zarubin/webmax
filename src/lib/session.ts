import fs from 'fs';
import path from 'path';

/**
 * Менеджер сессий для хранения данных авторизации
 */
export class SessionManager {
  sessionName: string;
  sessionDir: string;
  sessionFile: string;
  data: Record<string, unknown>;

  constructor(sessionName: string = 'default') {
    this.sessionName = sessionName;
    this.sessionDir = path.join(process.cwd(), 'sessions');
    this.sessionFile = path.join(this.sessionDir, `${sessionName}.json`);
    this.data = {};

    this.ensureSessionDir();
    this.load();
  }

  /**
   * Создает директорию для сессий если её нет
   */
  ensureSessionDir(): void {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  /**
   * Загружает данные сессии из файла
   */
  load(): boolean {
    try {
      if (fs.existsSync(this.sessionFile)) {
        const data = fs.readFileSync(this.sessionFile, 'utf8');
        this.data = JSON.parse(data) as Record<string, unknown>;
        return true;
      }
    } catch (error) {
      console.error('Ошибка при загрузке сессии:', (error as Error).message);
    }
    return false;
  }

  /**
   * Сохраняет данные сессии в файл
   */
  save(): boolean {
    try {
      fs.writeFileSync(
        this.sessionFile,
        JSON.stringify(this.data, null, 2),
        'utf8'
      );
      return true;
    } catch (error) {
      console.error('Ошибка при сохранении сессии:', (error as Error).message);
      return false;
    }
  }

  /**
   * Устанавливает значение в сессии
   */
  set(key: string, value: unknown): void {
    this.data[key] = value;
    this.save();
  }

  /**
   * Получает значение из сессии
   */
  get<T = unknown>(key: string, defaultValue: T | null = null): T | null {
    return (this.data[key] !== undefined ? this.data[key] : defaultValue) as T | null;
  }

  /**
   * Удаляет значение из сессии
   */
  delete(key: string): void {
    delete this.data[key];
    this.save();
  }

  /**
   * Проверяет наличие ключа в сессии
   */
  has(key: string): boolean {
    return this.data[key] !== undefined;
  }

  /**
   * Очищает все данные сессии
   */
  clear(): void {
    this.data = {};
    this.save();
  }

  /**
   * Удаляет файл сессии
   */
  destroy(): boolean {
    try {
      if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile);
      }
      this.data = {};
      return true;
    } catch (error) {
      console.error('Ошибка при удалении сессии:', (error as Error).message);
      return false;
    }
  }

  /**
   * Проверяет, авторизован ли пользователь
   */
  isAuthorized(): boolean {
    return this.has('token') && this.has('userId');
  }
}
