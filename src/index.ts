/**
 * WebMaxSocket - Node.js библиотека для работы с API мессенджера Max
 * tellarion.dev
 *
 * @module webmaxsocket
 */

import WebMaxClient from './lib/client.js';
import type { DownloadFileParams, DownloadToFileResult, GetFileLinkParams } from './lib/client.js';
import { User, Message, ChatAction } from './lib/entities/index.js';
import { ChatActions, EventTypes, MessageTypes } from './lib/constants.js';
import { Opcode, getOpcodeName } from './lib/opcodes.js';
import { UserAgentPayload } from './lib/userAgent.js';

export {
  WebMaxClient,
  User,
  Message,
  ChatAction,
  ChatActions,
  EventTypes,
  MessageTypes,
  Opcode,
  getOpcodeName,
  UserAgentPayload,
};

export type {
  DownloadFileParams,
  DownloadToFileResult,
  GetFileLinkParams,
};
