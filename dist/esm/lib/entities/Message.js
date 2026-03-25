import { User } from './User';
/**
 * Класс представляющий сообщение
 */
export class Message {
    constructor(data, client) {
        this.client = client;
        this.id = data.id || data.messageId || null;
        this.cid = data.cid || null;
        this.chatId = data.chatId || data.chat_id || null;
        if (typeof data.text === 'string') {
            this.text = data.text;
        }
        else if (typeof data.text === 'object' && data.text !== null) {
            this.text = data.text.text || JSON.stringify(data.text);
        }
        else {
            this.text = data.message || '';
        }
        if (data.sender) {
            if (typeof data.sender === 'object') {
                this.senderId = data.sender.id || null;
                this.sender = new User(data.sender);
            }
            else {
                this.senderId = data.sender;
                this.sender = null;
            }
        }
        else {
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
            }
            catch (error) {
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
    async edit(options) {
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
    async delete() {
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
    async forward(chatId) {
        const forwardClient = this.client;
        if (!forwardClient.forwardMessage) {
            throw new Error('forwardMessage не реализован');
        }
        return await forwardClient.forwardMessage({
            messageId: this.id,
            fromChatId: this.chatId,
            toChatId: chatId
        });
    }
    async downloadFile(index = 0, options = {}) {
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
