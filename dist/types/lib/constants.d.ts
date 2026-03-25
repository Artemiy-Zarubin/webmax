/**
 * Константы для библиотеки WebMax
 */
export declare const ChatActions: {
    readonly TYPING: "typing";
    readonly STICKER: "sticker";
    readonly FILE: "file";
    readonly RECORDING_VOICE: "recording_voice";
    readonly RECORDING_VIDEO: "recording_video";
};
export type ChatActionType = typeof ChatActions[keyof typeof ChatActions];
export declare const EventTypes: {
    readonly START: "start";
    readonly MESSAGE: "message";
    readonly MESSAGE_REMOVED: "message_removed";
    readonly CHAT_ACTION: "chat_action";
    readonly ERROR: "error";
    readonly DISCONNECT: "disconnect";
};
export type EventType = typeof EventTypes[keyof typeof EventTypes];
export declare const MessageTypes: {
    readonly TEXT: "text";
    readonly IMAGE: "image";
    readonly VIDEO: "video";
    readonly AUDIO: "audio";
    readonly DOCUMENT: "document";
    readonly STICKER: "sticker";
};
export type MessageType = typeof MessageTypes[keyof typeof MessageTypes];
