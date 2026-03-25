import type WebMaxClient from '../client.js';
import type { DownloadToFileResult } from '../client.js';
import User from './User.js';

type UnknownRecord = Record<string, unknown>;

type MessageReplyOptions = {
  text?: string;
  cid?: number;
  [key: string]: unknown;
};

type MessageEditOptions = {
  text?: string;
  [key: string]: unknown;
};

type MessageDownloadOptions = {
  output?: string;
};

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;

const asId = (value: unknown): string | number | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return null;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const isFileAttach = (attachment: unknown): attachment is UnknownRecord =>
  isRecord(attachment) && attachment._type === 'FILE';

const getFileIdFromAttach = (attachment: UnknownRecord): string | number | null => {
  const fileId = attachment.fileId ?? attachment.file_id ?? attachment.id;
  if (typeof fileId === 'string' || typeof fileId === 'number') {
    return fileId;
  }
  return null;
};

/**
 * Класс представляющий сообщение
 */
export default class Message {
  client: WebMaxClient;
  id: string | number | null;
  cid: string | number | null;
  chatId: string | number | null;
  text: string;
  senderId: string | number | null;
  sender: User | null;
  timestamp: number;
  type: string;
  isEdited: boolean;
  replyTo: string | number | null;
  attachments: unknown[];
  rawData: UnknownRecord;

  constructor(data: UnknownRecord, client: WebMaxClient) {
    this.client = client;
    this.id = asId(data.id) || asId(data.messageId) || null;
    this.cid = asId(data.cid) || null;
    this.chatId = asId(data.chatId) || asId(data.chat_id) || null;

    // Обработка text: может быть строкой или объектом
    if (typeof data.text === 'string') {
      this.text = data.text;
    } else if (isRecord(data.text)) {
      const innerText = data.text.text;
      this.text = typeof innerText === 'string' ? innerText : JSON.stringify(data.text);
    } else if (typeof data.message === 'string') {
      this.text = data.message;
    } else {
      this.text = '';
    }

    // Обработка sender: может быть объектом User или просто ID
    if (data.sender) {
      if (isRecord(data.sender)) {
        this.senderId = asId(data.sender.id);
        this.sender = new User(data.sender);
      } else if (typeof data.sender === 'string' || typeof data.sender === 'number') {
        // Если sender - это просто ID (число)
        this.senderId = data.sender;
        this.sender = null; // Будет загружен позже при необходимости
      } else {
        this.senderId = null;
        this.sender = null;
      }
    } else {
      this.senderId = asId(data.senderId) || asId(data.sender_id) || asId(data.from_id) || null;
      this.sender = null;
    }

    this.timestamp = typeof data.timestamp === 'number' ? data.timestamp : typeof data.time === 'number' ? data.time : Date.now();
    this.type = typeof data.type === 'string' ? data.type : 'text';
    this.isEdited = Boolean(data.isEdited || data.is_edited);
    this.replyTo = asId(data.replyTo) || asId(data.reply_to) || null;
    this.attachments = Array.isArray(data.attaches)
      ? data.attaches
      : Array.isArray(data.attachments)
        ? data.attachments
        : [];
    this.rawData = data;
  }

  /**
   * Получить информацию об отправителе
   */
  async fetchSender() {
    if (!this.sender && this.senderId) {
      try {
        this.sender = await this.client.getUser(this.senderId);
      } catch (error) {
        console.error('Ошибка загрузки информации об отправителе:', getErrorMessage(error));
      }
    }
    return this.sender;
  }

  /**
   * Получить имя отправителя
   */
  getSenderName() {
    if (this.sender) {
      return this.sender.fullname || this.sender.firstname || 'User';
    }
    return this.senderId ? `User ${this.senderId}` : 'Unknown';
  }

  /**
   * Ответить на сообщение
   */
  async reply(options: string | MessageReplyOptions) {
    if (typeof options === 'string') {
      options = { text: options };
    }

    return await this.client.sendMessage({
      chatId: this.chatId as string | number,
      text: options.text,
      cid: options.cid || Date.now(),
      replyTo: this.id,
      ...options,
    });
  }

  /**
   * Редактировать сообщение
   */
  async edit(options: string | MessageEditOptions) {
    if (typeof options === 'string') {
      options = { text: options };
    }

    return await this.client.editMessage({
      messageId: this.id as string | number,
      chatId: this.chatId as string | number,
      text: options.text,
      ...options,
    });
  }

  /**
   * Удалить сообщение
   */
  async delete() {
    return await this.client.deleteMessage({
      messageId: this.id as string | number,
      chatId: this.chatId as string | number,
    });
  }

  /**
   * Переслать сообщение
   */
  async forward(chatId: string | number) {
    const forwarder = this.client as unknown as { forwardMessage: (options: UnknownRecord) => Promise<unknown> };
    return await forwarder.forwardMessage({
      messageId: this.id as string | number,
      fromChatId: this.chatId as string | number,
      toChatId: chatId,
    });
  }

  /**
   * Скачать FILE-вложение из сообщения
   */
  async downloadFile(index?: number, options: MessageDownloadOptions = {}): Promise<Buffer | DownloadToFileResult> {
    if (!this.chatId || !this.id) {
      throw new Error('Невозможно скачать файл: отсутствует chatId или messageId');
    }

    let attachment: UnknownRecord | null = null;

    if (typeof index === 'number') {
      const candidate = this.attachments[index];
      if (!isFileAttach(candidate)) {
        throw new Error(`Вложение с индексом ${index} не является FILE`);
      }
      attachment = candidate;
    } else {
      const found = this.attachments.find(isFileAttach);
      if (found && isRecord(found)) {
        attachment = found;
      }
    }

    if (!attachment) {
      throw new Error('В сообщении нет FILE-вложений');
    }

    const fileId = getFileIdFromAttach(attachment);
    if (!fileId) {
      throw new Error('Не удалось определить fileId для FILE-вложения');
    }

    return this.client.downloadFile({
      fileId,
      chatId: this.chatId,
      messageId: this.id,
      output: options.output,
    });
  }

  /**
   * Возвращает строковое представление сообщения
   */
  toString() {
    return `Message(id=${this.id}, from=${this.senderId}, text="${this.text.substring(0, 50)}")`;
  }

  /**
   * Возвращает JSON представление
   */
  toJSON() {
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
      attachments: this.attachments,
    };
  }
}
