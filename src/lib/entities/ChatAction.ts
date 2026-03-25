import type WebMaxClient from '../client.js';
import User from './User.js';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;

const asId = (value: unknown): string | number | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return null;
};

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

  constructor(data: UnknownRecord, client: WebMaxClient) {
    this.client = client;
    this.type = typeof data.type === 'string'
      ? data.type
      : typeof data.action === 'string'
        ? data.action
        : null;
    this.chatId = asId(data.chatId ?? data.chat_id);
    this.userId = asId(data.userId ?? data.user_id);
    this.user = isRecord(data.user) ? new User(data.user) : null;
    this.timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
    this.rawData = data;
  }

  /**
   * Возвращает строковое представление действия
   */
  toString() {
    return `ChatAction(type=${this.type}, user=${this.userId}, chat=${this.chatId})`;
  }

  /**
   * Возвращает JSON представление
   */
  toJSON() {
    return {
      type: this.type,
      chatId: this.chatId,
      userId: this.userId,
      user: this.user ? this.user.toJSON() : null,
      timestamp: this.timestamp,
    };
  }
}
