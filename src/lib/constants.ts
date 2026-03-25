/**
 * Константы для библиотеки WebMax
 */

export const ChatActions = {
  TYPING: 'typing',
  STICKER: 'sticker',
  FILE: 'file',
  RECORDING_VOICE: 'recording_voice',
  RECORDING_VIDEO: 'recording_video'
} as const;

export type ChatActionType = typeof ChatActions[keyof typeof ChatActions];

export const EventTypes = {
  START: 'start',
  MESSAGE: 'message',
  MESSAGE_REMOVED: 'message_removed',
  CHAT_ACTION: 'chat_action',
  ERROR: 'error',
  DISCONNECT: 'disconnect'
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

export const MessageTypes = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  STICKER: 'sticker'
} as const;

export type MessageType = typeof MessageTypes[keyof typeof MessageTypes];
