const User = require('./User');

/**
 * Класс представляющий сообщение
 */
class Message {
  constructor(data, client) {
    this.client = client;
    this.id = data.id || data.messageId || null;
    this.cid = data.cid || null;
    this.chatId = data.chatId || data.chat_id || null;
    
    // Обработка text: может быть строкой или объектом
    if (typeof data.text === 'string') {
      this.text = data.text;
    } else if (typeof data.text === 'object' && data.text !== null) {
      // Если text - объект, ищем текст внутри
      this.text = data.text.text || JSON.stringify(data.text);
    } else {
      this.text = data.message || '';
    }
    
    // Обработка sender: может быть объектом User или просто ID
    if (data.sender) {
      if (typeof data.sender === 'object') {
        this.senderId = data.sender.id;
        this.sender = new User(data.sender);
      } else {
        // Если sender - это просто ID (число)
        this.senderId = data.sender;
        this.sender = null; // Будет загружен позже при необходимости
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
  async fetchSender() {
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
  getSenderName() {
    if (this.sender) {
      return this.sender.fullname || this.sender.firstname || 'User';
    }
    return this.senderId ? `User ${this.senderId}` : 'Unknown';
  }

  /**
   * Ответить на сообщение
   */
  async reply(options) {
    if (typeof options === 'string') {
      options = { text: options };
    }

    return await this.client.sendMessage({
      chatId: this.chatId,
      text: options.text,
      cid: options.cid || Date.now(),
      replyTo: this.id,
      ...options
    });
  }

  /**
   * Редактировать сообщение
   */
  async edit(options) {
    if (typeof options === 'string') {
      options = { text: options };
    }

    return await this.client.editMessage({
      messageId: this.id,
      chatId: this.chatId,
      text: options.text,
      ...options
    });
  }

  /**
   * Удалить сообщение
   */
  async delete() {
    return await this.client.deleteMessage({
      messageId: this.id,
      chatId: this.chatId
    });
  }

  /**
   * Переслать сообщение
   */
  async forward(chatId) {
    return await this.client.forwardMessage({
      messageId: this.id,
      fromChatId: this.chatId,
      toChatId: chatId
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
      attachments: this.attachments
    };
  }
}

module.exports = Message;

