import User from './User.js';
const isRecord = (value) => typeof value === 'object' && value !== null;
const asId = (value) => {
    if (typeof value === 'string' || typeof value === 'number') {
        return value;
    }
    return null;
};
/**
 * Класс представляющий действие в чате
 */
export default class ChatAction {
    constructor(data, client) {
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
//# sourceMappingURL=ChatAction.js.map