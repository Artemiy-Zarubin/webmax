import { User, UserPayload } from './User';
import type { WebMaxClient } from '../client';
import type { ApiValue, Id } from '../types';

export interface Attachment {
  _type?: string;
  type?: string;
  fileId?: Id;
  id?: Id;
  file_id?: Id;
  [key: string]: ApiValue;
}

export interface MessagePayload {
  id?: Id | null;
  messageId?: Id | null;
  cid?: Id | null;
  chatId?: Id | null;
  chat_id?: Id | null;
  text?: string | { text?: string } | null;
  message?: string;
  sender?: UserPayload | Id | null;
  senderId?: Id | null;
  sender_id?: Id | null;
  from_id?: Id | null;
  timestamp?: number;
  time?: number;
  type?: string;
  isEdited?: boolean;
  is_edited?: boolean;
  replyTo?: Id | null;
  reply_to?: Id | null;
  attaches?: Attachment[];
  attachments?: Attachment[];
}

export interface ReplyOptions {
  text?: string;
  cid?: number;
}

export interface EditOptions {
  text?: string;
}

export interface DownloadOptions {
  output?: string;
}

/**
 * Класс представляющий сообщение
 */
export class Message {
  client: WebMaxClient;
  id: Id | null;
  cid: Id | null;
  chatId: Id | null;
  text: string;
  senderId: Id | null;
  sender: User | null;
  timestamp: number;
  type: string;
  isEdited: boolean;
  replyTo: Id | null;
  attachments: Attachment[];
  rawData: MessagePayload;

  constructor(data: MessagePayload, client: WebMaxClient) {
    this.client = client;
    this.id = data.id || data.messageId || null;
    this.cid = data.cid || null;
    this.chatId = data.chatId || data.chat_id || null;

    if (typeof data.text === 'string') {
      this.text = data.text;
    } else if (typeof data.text === 'object' && data.text !== null) {
      this.text = data.text.text || JSON.stringify(data.text);
    } else {
      this.text = data.message || '';
    }

    if (data.sender) {
      if (typeof data.sender === 'object') {
        this.senderId = data.sender.id || null;
        this.sender = new User(data.sender);
      } else {
        this.senderId = data.sender;
        this.sender = null;
      }
    } else {
      this.senderId = data.senderId || data.sender_id || data.from_id || null;
      this.sender = null;
    }

    this.timestamp = data.timestamp || data.time || Date.now();
    this.type = data.type || 'text';
    this.isEdited = data.isEdited || data.is_edited || false;
    this.replyTo = data.replyTo || data.reply_to || null;
    this.attachments = data.attaches || data.attachments || [];
    this.rawData = data;
  }

  /**
   * Получить информацию об отправителе
   */
  async fetchSender(): Promise<User | null> {
    if (!this.sender && this.senderId) {
      try {
        this.sender = await this.client.getUser(this.senderId);
      } catch (error) {
        console.error('Ошибка загрузки информации об отправителе:', error);
      }
    }
    return this.sender;
  }

  /**
   * Получить имя отправителя
   */
  getSenderName(): string {
    if (this.sender) {
      return this.sender.fullname || this.sender.firstname || 'User';
    }
    return this.senderId ? `User ${this.senderId}` : 'Unknown';
  }

  /**
   * Ответить на сообщение
   */
  async reply(options: ReplyOptions | string): Promise<Message | ApiValue | null> {
    const normalized = typeof options === 'string' ? { text: options } : options;

    return await this.client.sendMessage({
      chatId: this.chatId,
      text: normalized.text,
      cid: normalized.cid || Date.now(),
      replyTo: this.id,
      ...normalized
    });
  }

  /**
   * Редактировать сообщение
   */
  async edit(options: EditOptions | string): Promise<Message | ApiValue> {
    const normalized = typeof options === 'string' ? { text: options } : options;

    return await this.client.editMessage({
      messageId: this.id,
      chatId: this.chatId,
      text: normalized.text,
      ...normalized
    });
  }

  /**
   * Удалить сообщение
   */
  async delete(): Promise<boolean> {
    if (!this.id || !this.chatId) {
      throw new Error('messageId или chatId не задан');
    }
    return await this.client.deleteMessage({
      messageId: this.id,
      chatId: this.chatId
    });
  }

  /**
   * Переслать сообщение
   */
  async forward(chatId: Id): Promise<ApiValue> {
    const forwardClient = this.client as unknown as { forwardMessage?: (options: { messageId: Id | null; fromChatId: Id | null; toChatId: Id }) => Promise<ApiValue> };
    if (!forwardClient.forwardMessage) {
      throw new Error('forwardMessage не реализован');
    }
    return await forwardClient.forwardMessage({
      messageId: this.id,
      fromChatId: this.chatId,
      toChatId: chatId
    });
  }

  async downloadFile(index: number = 0, options: DownloadOptions = {}): Promise<Buffer | { path: string; url: string; unsafe: boolean }> {
    const attaches = Array.isArray(this.attachments) ? this.attachments : [];
    const files = attaches.filter((item) => item && (item._type === 'FILE' || item.type === 'FILE'));
    if (!files.length) {
      throw new Error('Вложений типа FILE не найдено');
    }
    const file = files[index];
    if (!file) {
      throw new Error('Файл с указанным индексом не найден');
    }
    const fileId = file.fileId || file.id || file.file_id;
    if (!fileId) {
      throw new Error('fileId не найден в вложении');
    }
    if (!this.chatId || !this.id) {
      throw new Error('chatId или messageId не задан');
    }
    return await this.client.downloadFile({
      fileId,
      chatId: this.chatId,
      messageId: this.id,
      output: options.output
    });
  }

  /**
   * Возвращает строковое представление сообщения
   */
  toString(): string {
    return `Message(id=${this.id}, from=${this.senderId}, text="${this.text.substring(0, 50)}")`;
  }

  /**
   * Возвращает JSON представление
   */
  toJSON(): {
    id: Id | null;
    cid: Id | null;
    chatId: Id | null;
    text: string;
    senderId: Id | null;
    sender: ReturnType<User['toJSON']> | null;
    timestamp: number;
    type: string;
    isEdited: boolean;
    replyTo: Id | null;
    attachments: Attachment[];
  } {
    return {
      id: this.id,
      cid: this.cid,
      chatId: this.chatId,
      text: this.text,
      senderId: this.senderId,
      sender: this.sender ? this.sender.toJSON() : null,
      timestamp: this.timestamp,
      type: this.type,
      isEdited: this.isEdited,
      replyTo: this.replyTo,
      attachments: this.attachments
    };
  }
}
