/**
 * WebMaxSocket - Node.js библиотека для работы с API мессенджера Max
 * 
 * @module webmaxsocket
 */

const WebMaxClient = require('./lib/client');
const { User, Message, ChatAction } = require('./lib/entities');
const { ChatActions, EventTypes, MessageTypes } = require('./lib/constants');
const { Opcode, getOpcodeName } = require('./lib/opcodes');
const { UserAgentPayload } = require('./lib/userAgent');

module.exports = {
  WebMaxClient,
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

