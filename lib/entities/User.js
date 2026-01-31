/**
 * Класс представляющий пользователя
 */
class User {
  constructor(data) {
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
      bio: this.bio
    };
  }
}

module.exports = User;

