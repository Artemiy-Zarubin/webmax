/**
 * Opcodes для протокола Max API
 */
export declare const Opcode: {
    readonly PING: 1;
    readonly DEBUG: 2;
    readonly RECONNECT: 3;
    readonly LOG: 5;
    readonly SESSION_INIT: 6;
    readonly PROFILE: 16;
    readonly AUTH_REQUEST: 17;
    readonly AUTH: 18;
    readonly LOGIN: 19;
    readonly LOGOUT: 20;
    readonly SYNC: 21;
    readonly CONFIG: 22;
    readonly CONTACT_INFO: 32;
    readonly CONTACT_UPDATE: 34;
    readonly CONTACT_INFO_BY_PHONE: 46;
    readonly CHAT_INFO: 48;
    readonly CHAT_HISTORY: 49;
    readonly CHAT_MARK: 50;
    readonly CHATS_LIST: 53;
    readonly CHAT_UPDATE: 55;
    readonly CHAT_JOIN: 57;
    readonly CHAT_LEAVE: 58;
    readonly CHAT_MEMBERS: 59;
    readonly MSG_SEND: 64;
    readonly MSG_DELETE: 66;
    readonly MSG_EDIT: 67;
    readonly CHAT_MEMBERS_UPDATE: 77;
    readonly PHOTO_UPLOAD: 80;
    readonly VIDEO_UPLOAD: 82;
    readonly VIDEO_PLAY: 83;
    readonly FILE_UPLOAD: 87;
    readonly FILE_DOWNLOAD: 88;
    readonly LINK_INFO: 89;
    readonly SESSIONS_INFO: 96;
    readonly SESSIONS_CLOSE: 97;
    readonly NOTIF_MESSAGE: 128;
    readonly NOTIF_CHAT: 135;
    readonly NOTIF_ATTACH: 136;
    readonly NOTIF_MSG_DELETE: 154;
    readonly NOTIF_MSG_REACTIONS_CHANGED: 155;
    readonly MSG_REACTION: 178;
    readonly MSG_CANCEL_REACTION: 179;
    readonly MSG_GET_REACTIONS: 180;
    readonly FOLDERS_GET: 272;
    readonly FOLDERS_UPDATE: 274;
    readonly FOLDERS_DELETE: 276;
    readonly GET_QR: 288;
    readonly GET_QR_STATUS: 289;
    readonly LOGIN_BY_QR: 291;
};
export type OpcodeType = typeof Opcode[keyof typeof Opcode];
/**
 * Получить название опкода
 */
export declare function getOpcodeName(code: number): string;
export declare const DeviceType: {
    readonly WEB: "WEB";
};
