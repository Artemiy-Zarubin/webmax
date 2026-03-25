"use strict";
/**
 * Константы для библиотеки WebMax
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageTypes = exports.EventTypes = exports.ChatActions = void 0;
exports.ChatActions = {
    TYPING: 'typing',
    STICKER: 'sticker',
    FILE: 'file',
    RECORDING_VOICE: 'recording_voice',
    RECORDING_VIDEO: 'recording_video'
};
exports.EventTypes = {
    START: 'start',
    MESSAGE: 'message',
    MESSAGE_REMOVED: 'message_removed',
    CHAT_ACTION: 'chat_action',
    ERROR: 'error',
    DISCONNECT: 'disconnect'
};
exports.MessageTypes = {
    TEXT: 'text',
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    DOCUMENT: 'document',
    STICKER: 'sticker'
};
