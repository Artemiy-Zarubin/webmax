"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatAction = void 0;
const User_1 = require("./User");
class ChatAction {
    constructor(data, client) {
        this.client = client;
        this.type = data.type || data.action || null;
        this.chatId = data.chatId || data.chat_id || null;
        this.userId = data.userId || data.user_id || null;
        this.user = data.user ? new User_1.User(data.user) : null;
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
exports.ChatAction = ChatAction;
