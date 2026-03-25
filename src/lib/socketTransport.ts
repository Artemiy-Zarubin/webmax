/**
 * Socket transport для Max API (api.oneme.ru:443)
 * Бинарный протокол msgpack с LZ4 компрессией
 * Используется для IOS/DESKTOP/ANDROID устройств
 */

import tls from 'tls';
import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';
import { uncompress as lz4Uncompress } from 'lz4/lib/binding.js';
import { v4 as uuidv4 } from 'uuid';
import { Opcode, getOpcodeName } from './opcodes';
import { UserAgentPayload, UserAgentPayloadJson } from './userAgent';
import type { ApiValue, Id } from './types';

const HOST = 'api.oneme.ru';
const PORT = 443;

/**
 * Формирует бинарный пакет
 * Header: 1b ver, 2b cmd, 1b seq, 2b opcode, 4b payload_len
 */
function packPacket(ver: number, cmd: number, seq: number, opcode: number, payload?: ApiValue): Buffer {
  const payloadBuf = payload ? Buffer.from(msgpackEncode(payload)) : Buffer.alloc(0);
  const payloadLen = payloadBuf.length & 0xFFFFFF;
  const buf = Buffer.allocUnsafe(10 + payloadBuf.length);
  buf.writeUInt8(ver, 0);
  buf.writeUInt16BE(cmd, 1);
  buf.writeUInt8(seq % 256, 3);
  buf.writeUInt16BE(opcode, 4);
  buf.writeUInt32BE(payloadLen, 6);
  if (payloadBuf.length) payloadBuf.copy(buf, 10);
  return buf;
}

/**
 * Парсит ответ. compFlag: raw LZ4 block.
 */
function unpackPacket(data: Buffer): { ver: number; cmd: number; seq: number; opcode: number; payload: ApiValue | null } | null {
  if (data.length < 10) return null;
  const ver = data.readUInt8(0);
  const cmd = data.readUInt16BE(1);
  const seq = data.readUInt8(3);
  const opcode = data.readUInt16BE(4);
  const packedLen = data.readUInt32BE(6);
  const compFlag = packedLen >> 24;
  const payloadLength = packedLen & 0xFFFFFF;
  let payload: ApiValue | null = null;

  if (payloadLength > 0 && data.length >= 10 + payloadLength) {
    const payloadBytes = Buffer.from(data.subarray(10, 10 + payloadLength));
    try {
      if (compFlag !== 0) {
        const out = Buffer.alloc(Math.max(payloadLength * 20, 256 * 1024));
        const n = lz4Uncompress(payloadBytes, out);
        if (n > 0) payload = msgpackDecode(out.subarray(0, n)) as ApiValue;
      } else {
        payload = msgpackDecode(payloadBytes) as ApiValue;
      }
    } catch {
      payload = null;
    }
  }

  return { ver, cmd, seq, opcode, payload };
}

function readExactlyFromBuffer(transport: MaxSocketTransport, n: number): Promise<Buffer> {
  return new Promise((resolve) => {
    const tryResolve = () => {
      if (transport._recvBuffer.length >= n) {
        const result = transport._recvBuffer.subarray(0, n);
        transport._recvBuffer = transport._recvBuffer.subarray(n);
        resolve(Buffer.from(result));
        return true;
      }
      return false;
    };
    if (tryResolve()) return;

    const onData = () => {
      if (tryResolve()) transport.socket?.removeListener('data', onData);
    };
    transport.socket?.on('data', onData);
  });
}

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

export class MaxSocketTransport {
  host: string;
  port: number;
  deviceId: string;
  deviceType: string;
  ua: string;
  debug: boolean;
  socket: tls.TLSSocket | null;
  seq: number;
  ver: number;
  pending: Map<number, { resolve: (data: SocketPacket) => void; reject: (err: Error) => void }>;
  _recvBuffer: Buffer<ArrayBufferLike>;
  onNotification?: (data: SocketPacket) => void;

  constructor(options: SocketTransportOptions = {}) {
    this.host = options.host || HOST;
    this.port = options.port || PORT;
    this.deviceId = options.deviceId || uuidv4();
    this.deviceType = options.deviceType || 'IOS';
    this.ua = options.ua || options.headerUserAgent ||
      'Mozilla/5.0 (iPhone15,2; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/602.1.50';
    this.debug = options.debug || false;

    this.socket = null;
    this.seq = 0;
    this.ver = 11;
    this.pending = new Map();
    this._recvBuffer = Buffer.alloc(0);
  }

  _log(...args: ApiValue[]): void {
    if (this.debug) console.log('[Socket]', ...args);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const opts = {
        host: this.host,
        port: this.port,
        servername: this.host,
        rejectUnauthorized: true
      };
      const sock = tls.connect(opts, () => {
        this.socket = sock;
        this._recvBuffer = Buffer.alloc(0);
        sock.on('data', (chunk) => {
          this._recvBuffer = Buffer.concat([this._recvBuffer, chunk]);
        });
        this._log('Connected to', this.host + ':' + this.port);
        this._startRecvLoop();
        resolve();
      });
      sock.on('error', reject);
      sock.setKeepAlive(true);
    });
  }

  _makeMessage(opcode: number, payload?: ApiValue, cmd: number = 0): { ver: number; cmd: number; seq: number; opcode: number; payload: ApiValue } {
    this.seq++;
    return {
      ver: this.ver,
      cmd,
      seq: this.seq,
      opcode,
      payload: payload || {}
    };
  }

  _startRecvLoop(): void {
    const readNext = async () => {
      if (!this.socket || this.socket.destroyed) return;
      try {
        const header = await readExactlyFromBuffer(this, 10);
        const packedLen = header.readUInt32BE(6);
        const payloadLen = packedLen & 0xFFFFFF;
        let payloadData: Buffer<ArrayBufferLike> = Buffer.alloc(0);
        if (payloadLen > 0) {
          payloadData = await readExactlyFromBuffer(this, payloadLen);
        }
        const packet = unpackPacket(Buffer.concat([header, payloadData]));
        if (!packet) return readNext();

        const seqKey = packet.seq % 256;
        const payloads = Array.isArray(packet.payload) ? packet.payload : [packet.payload];
        for (const p of payloads) {
          const data = { ...packet, payload: p } as SocketPacket;
          const pending = this.pending.get(seqKey);
          if (pending) {
            this.pending.delete(seqKey);
            pending.resolve(data);
            break;
          }
          if (this.onNotification) this.onNotification(data);
        }
      } catch (e) {
        if (this.socket && !this.socket.destroyed) {
          this._log('Recv error:', (e as Error).message);
        }
        for (const [, p] of this.pending) p.reject(e as Error);
        this.pending.clear();
        return;
      }
      readNext();
    };
    readNext();
  }

  async sendAndWait(opcode: number, payload: ApiValue, cmd: number = 0, timeout: number = 20000): Promise<SocketPacket> {
    if (!this.socket || this.socket.destroyed) throw new Error('Socket not connected');

    const msg = this._makeMessage(opcode, payload, cmd);
    const seqKey = msg.seq % 256;
    const packet = packPacket(msg.ver, msg.cmd, msg.seq, msg.opcode, msg.payload);

    let pendingRef: { resolve: (data: SocketPacket) => void; reject: (err: Error) => void } | undefined;
    const promise = new Promise<SocketPacket>((resolve, reject) => {
      const t = setTimeout(() => {
        const p = this.pending.get(seqKey);
        if (p) {
          this.pending.delete(seqKey);
          p.reject(new Error(`Timeout waiting for opcode ${getOpcodeName(opcode)}`));
        }
      }, timeout);
      pendingRef = {
        resolve: (data) => { clearTimeout(t); resolve(data); },
        reject: (err) => { clearTimeout(t); reject(err); }
      };
      this.pending.set(seqKey, pendingRef);
    });

    this.socket.write(packet, (err) => {
      if (err) {
        const p = this.pending.get(seqKey);
        if (p) {
          this.pending.delete(seqKey);
          p.reject(err);
        }
      }
    });

    const result = await promise;
    if (result.payload && (result.payload as { error?: ApiValue }).error) {
      const payload = result.payload as { localizedMessage?: string; error?: { message?: string } };
      const errMsg = payload.localizedMessage || payload.error?.message || JSON.stringify(result.payload);
      throw new Error(errMsg);
    }
    return result;
  }

  async handshake(userAgentPayload?: UserAgentPayload | UserAgentPayloadJson): Promise<SocketPacket> {
    const ua = userAgentPayload || new UserAgentPayload({
      deviceType: this.deviceType,
      headerUserAgent: this.ua,
      appVersion: '25.12.14',
      osVersion: '18.6.2',
      deviceName: 'Safari',
      screen: '390x844 3.0x'
    });
    const uaJson: UserAgentPayloadJson = ua instanceof UserAgentPayload ? ua.toJSON() : ua;
    const payload = {
      deviceId: this.deviceId,
      userAgent: uaJson
    };
    const resp = await this.sendAndWait(Opcode.SESSION_INIT, payload);
    this._log('Handshake OK');
    return resp;
  }

  async requestCode(phone: string, language: string = 'ru'): Promise<string | null> {
    const payload = { phone, type: 'START_AUTH', language };
    const data = await this.sendAndWait(Opcode.AUTH_REQUEST, payload);
    return (data.payload as { token?: string })?.token || null;
  }

  async sendCode(tempToken: string, code: string): Promise<ApiValue> {
    const payload = {
      token: tempToken,
      verifyCode: code,
      authTokenType: 'CHECK_CODE'
    };
    const data = await this.sendAndWait(Opcode.AUTH, payload);
    return data.payload as ApiValue;
  }

  async sync(token: string, userAgentJson?: UserAgentPayloadJson): Promise<ApiValue> {
    const payload: { [key: string]: ApiValue } = {
      interactive: true,
      token,
      chatsSync: 0,
      contactsSync: 0,
      presenceSync: 0,
      draftsSync: 0,
      chatsCount: 40
    };
    if (userAgentJson) payload.userAgent = userAgentJson;
    const data = await this.sendAndWait(Opcode.LOGIN, payload);
    return data.payload as ApiValue;
  }

  async getChats(marker: number = 0): Promise<ApiValue[]> {
    const data = await this.sendAndWait(Opcode.CHATS_LIST, { marker });
    return ((data.payload as { chats?: ApiValue[] })?.chats) || [];
  }

  async getHistory(chatId: Id, from: number = Date.now(), backward: number = 200, forward: number = 0): Promise<ApiValue[]> {
    const data = await this.sendAndWait(Opcode.CHAT_HISTORY, {
      chatId,
      from,
      forward,
      backward,
      getMessages: true
    });
    return ((data.payload as { messages?: ApiValue[] })?.messages) || [];
  }

  async close(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    for (const [, p] of this.pending) p.reject(new Error('Connection closed'));
    this.pending.clear();
  }
}

export { packPacket, unpackPacket, HOST, PORT };
