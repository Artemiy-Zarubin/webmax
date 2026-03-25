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

export class ChatAction {
  client: WebMaxClient | null;
  type: string | null;
  chatId: Id | null;
  userId: Id | null;
  user: User | null;
  timestamp: number;
  rawData: ChatActionPayload;

  constructor(data: ChatActionPayload, client: WebMaxClient | null) {
    this.client = client;
    this.type = data.type || data.action || null;
    this.chatId = data.chatId || data.chat_id || null;
    this.userId = data.userId || data.user_id || null;
    this.user = data.user ? new User(data.user) : null;
    this.timestamp = data.timestamp || Date.now();
    this.rawData = data;
  }

  /**
   * Возвращает строковое представление действия
   */
  toString(): string {
    return `ChatAction(type=${this.type}, user=${this.userId}, chat=${this.chatId})`;
  }

  /**
   * Возвращает JSON представление
   */
  toJSON(): {
    type: string | null;
    chatId: Id | null;
    userId: Id | null;
    user: ReturnType<User['toJSON']> | null;
    timestamp: number;
  } {
    return {
      type: this.type,
      chatId: this.chatId,
      userId: this.userId,
      user: this.user ? this.user.toJSON() : null,
      timestamp: this.timestamp
    };
  }
}
