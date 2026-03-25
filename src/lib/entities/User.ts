/**
 * Класс представляющий пользователя
 */
import type { Id } from '../types';

export interface UserPayload {
  id?: Id | null;
  userId?: Id | null;
  contactId?: Id | null;
  firstname?: string;
  firstName?: string;
  first_name?: string;
  lastname?: string;
  lastName?: string;
  last_name?: string;
  username?: string;
  nick?: string;
  phone?: string;
  avatar?: string;
  baseUrl?: string;
  baseRawUrl?: string;
  photoId?: Id | null;
  status?: string;
  bio?: string;
  description?: string;
}

export class User {
  id: Id | null;
  firstname: string;
  lastname: string;
  username: string | null;
  phone: string | null;
  avatar: string | null;
  photoId: Id | null;
  status: string;
  bio: string;
  rawData: UserPayload;

  constructor(data: UserPayload) {
    this.id = data.id || data.userId || data.contactId || null;
    this.firstname = data.firstname || data.firstName || data.first_name || '';
    this.lastname = data.lastname || data.lastName || data.last_name || '';
    this.username = data.username || data.nick || null;
    this.phone = data.phone || null;
    this.avatar = data.avatar || data.baseUrl || data.baseRawUrl || null;
    this.photoId = data.photoId || null;
    this.status = data.status || 'online';
    this.bio = data.bio || data.description || '';
    this.rawData = data;
  }

  /**
   * Возвращает полное имя пользователя
   */
  get fullname(): string {
    return `${this.firstname} ${this.lastname}`.trim();
  }

  /**
   * Возвращает строковое представление пользователя
   */
  toString(): string {
    return `User(id=${this.id}, name=${this.fullname})`;
  }

  /**
   * Возвращает JSON представление
   */
  toJSON(): {
    id: Id | null;
    firstname: string;
    lastname: string;
    username: string | null;
    phone: string | null;
    avatar: string | null;
    photoId: Id | null;
    status: string;
    bio: string;
  } {
    return {
      id: this.id,
      firstname: this.firstname,
      lastname: this.lastname,
      username: this.username,
      phone: this.phone,
      avatar: this.avatar,
      photoId: this.photoId,
      status: this.status,
      bio: this.bio
    };
  }
}
