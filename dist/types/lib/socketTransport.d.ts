/**
 * Socket transport для Max API (api.oneme.ru:443)
 * Бинарный протокол msgpack с LZ4 компрессией
 * Используется для IOS/DESKTOP/ANDROID устройств
 */
import tls from 'tls';
import { UserAgentPayload, UserAgentPayloadJson } from './userAgent';
import type { ApiValue, Id } from './types';
declare const HOST = "api.oneme.ru";
declare const PORT = 443;
/**
 * Формирует бинарный пакет
 * Header: 1b ver, 2b cmd, 1b seq, 2b opcode, 4b payload_len
 */
declare function packPacket(ver: number, cmd: number, seq: number, opcode: number, payload?: ApiValue): Buffer;
/**
 * Парсит ответ. compFlag: raw LZ4 block.
 */
declare function unpackPacket(data: Buffer): {
    ver: number;
    cmd: number;
    seq: number;
    opcode: number;
    payload: ApiValue | null;
} | null;
export interface SocketTransportOptions {
    host?: string;
    port?: number;
    deviceId?: string;
    deviceType?: string;
    ua?: string;
    headerUserAgent?: string;
    debug?: boolean;
}
export interface SocketPacket {
    ver: number;
    cmd: number;
    seq: number;
    opcode: number;
    payload: ApiValue | null;
}
export declare class MaxSocketTransport {
    host: string;
    port: number;
    deviceId: string;
    deviceType: string;
    ua: string;
    debug: boolean;
    socket: tls.TLSSocket | null;
    seq: number;
    ver: number;
    pending: Map<number, {
        resolve: (data: SocketPacket) => void;
        reject: (err: Error) => void;
    }>;
    _recvBuffer: Buffer<ArrayBufferLike>;
    onNotification?: (data: SocketPacket) => void;
    constructor(options?: SocketTransportOptions);
    _log(...args: ApiValue[]): void;
    connect(): Promise<void>;
    _makeMessage(opcode: number, payload?: ApiValue, cmd?: number): {
        ver: number;
        cmd: number;
        seq: number;
        opcode: number;
        payload: ApiValue;
    };
    _startRecvLoop(): void;
    sendAndWait(opcode: number, payload: ApiValue, cmd?: number, timeout?: number): Promise<SocketPacket>;
    handshake(userAgentPayload?: UserAgentPayload | UserAgentPayloadJson): Promise<SocketPacket>;
    requestCode(phone: string, language?: string): Promise<string | null>;
    sendCode(tempToken: string, code: string): Promise<ApiValue>;
    sync(token: string, userAgentJson?: UserAgentPayloadJson): Promise<ApiValue>;
    getChats(marker?: number): Promise<ApiValue[]>;
    getHistory(chatId: Id, from?: number, backward?: number, forward?: number): Promise<ApiValue[]>;
    close(): Promise<void>;
}
export { packPacket, unpackPacket, HOST, PORT };
