/**
 * WebMaxSocket - Node.js библиотека для работы с API мессенджера Max
 * tellarion.dev
 *
 * @module webmaxsocket
 */

<<<<<<< HEAD
export * from './dist/esm/index.js';
=======
const WebMaxClient = require('./lib/client');
const { MaxSocketTransport } = require('./lib/socketTransport');
const { User, Message, ChatAction } = require('./lib/entities');
const { ChatActions, EventTypes, MessageTypes } = require('./lib/constants');
const { Opcode, getOpcodeName } = require('./lib/opcodes');
const { UserAgentPayload } = require('./lib/userAgent');

module.exports = {
  WebMaxClient,
  MaxSocketTransport,
  User,
  Message,
  ChatAction,
  ChatActions,
  EventTypes,
  MessageTypes,
  Opcode,
  getOpcodeName,
  UserAgentPayload
};

>>>>>>> upstream/main
