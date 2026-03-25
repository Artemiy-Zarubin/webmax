import { User } from './User';
export class ChatAction {
    constructor(data, client) {
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
            timestamp: this.timestamp
        };
    }
}
