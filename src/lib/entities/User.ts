type UnknownRecord = Record<string, unknown>;

const asId = (value: unknown): string | number | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return null;
};

const asString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  return null;
};

/**
 * Класс представляющий пользователя
 */
export default class User {
  id: string | number | null;
  firstname: string;
  lastname: string;
  username: string | null;
  phone: string | null;
  avatar: string | null;
  photoId: string | number | null;
  status: string;
  bio: string;
  rawData: UnknownRecord;

  constructor(data: UnknownRecord) {
    this.id = asId(data.id) || asId(data.userId) || asId(data.contactId) || null;
    this.firstname = asString(data.firstname) || asString(data.firstName) || asString(data.first_name) || '';
    this.lastname = asString(data.lastname) || asString(data.lastName) || asString(data.last_name) || '';
    this.username = asString(data.username) || asString(data.nick) || null;
    this.phone = asString(data.phone) || null;
    this.avatar = asString(data.avatar) || asString(data.baseUrl) || asString(data.baseRawUrl) || null;
    this.photoId = asId(data.photoId) || null;
    this.status = asString(data.status) || 'online';
    this.bio = asString(data.bio) || asString(data.description) || '';
    this.rawData = data;
  }

  /**
   * Возвращает полное имя пользователя
   */
  get fullname() {
    return `${this.firstname} ${this.lastname}`.trim();
  }

  /**
   * Возвращает строковое представление пользователя
   */
  toString() {
    return `User(id=${this.id}, name=${this.fullname})`;
  }

  /**
   * Возвращает JSON представление
   */
  toJSON() {
    return {
      id: this.id,
      firstname: this.firstname,
      lastname: this.lastname,
      username: this.username,
      phone: this.phone,
      avatar: this.avatar,
      photoId: this.photoId,
      status: this.status,
      bio: this.bio,
    };
  }
}
