/**
 * Генерация UserAgent для Max API
 */
import type { ApiValue } from './types';
export interface UserAgentPayloadOptions {
    deviceType?: string;
    locale?: string;
    deviceLocale?: string;
    osVersion?: string;
    deviceName?: string;
    headerUserAgent?: string;
    appVersion?: string;
    screen?: string;
    timezone?: string;
    clientSessionId?: number | null;
    buildNumber?: number | null;
    release?: string;
}
export interface UserAgentPayloadJson extends Record<string, ApiValue> {
    deviceType: string;
    locale: string;
    deviceLocale: string;
    osVersion: string;
    deviceName: string;
    headerUserAgent: string;
    appVersion: string;
    screen: string;
    timezone: string;
    clientSessionId: number;
    buildNumber: number;
    release?: string;
}
/**
 * Создает UserAgent пейлоад для Max API
 * Поддерживает WEB, IOS и кастомные профили (для token auth)
 */
export declare class UserAgentPayload {
    deviceType: string;
    locale: string;
    deviceLocale: string;
    osVersion: string;
    deviceName: string;
    headerUserAgent: string;
    appVersion: string;
    screen: string;
    timezone: string;
    clientSessionId: number;
    buildNumber: number;
    release?: string;
    constructor(options?: UserAgentPayloadOptions);
    /**
     * Преобразует в объект для отправки (camelCase ключи)
     */
    toJSON(): UserAgentPayloadJson;
}
