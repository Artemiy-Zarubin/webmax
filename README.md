# WebMaxSocket - Node.js Client for Max Messenger

## 📖 Описание / Description

**WebMaxSocket** — async Node.js библиотека для работы с внутренним API мессенджера Max. Позволяет создавать WebSocket соединение с **QR-кодом авторизацией**.

## ✨ Особенности / Features

- ✅ **QR-код авторизация** / QR code authentication  
- ✅ **WebSocket соединение** / WebSocket connection
- ✅ **Автоматическое сохранение сессий** / Automatic session storage
- ✅ **Отправка и получение сообщений** / Send and receive messages
- ✅ **Редактирование и удаление сообщений** / Edit and delete messages
- ✅ **Event-driven архитектура** / Event-driven architecture
- ✅ **Обработка входящих уведомлений** / Handle incoming notifications
- ✅ **TypeScript-ready** структура / TypeScript-ready structure

## 📦 Установка / Installation

```bash
npm install
```

### Зависимости / Dependencies

```bash
npm install ws uuid qrcode-terminal
```

## 🚀 Быстрый старт / Quick Start

### Базовый пример / Basic Example

```javascript
const { WebMaxClient } = require('./index');

async function main() {
  // Инициализация клиента / Initialize client
  const client = new WebMaxClient({
    name: 'my_session'  // Имя сессии / Session name
  });

  // Обработчик запуска / Start handler
  client.onStart(async () => {
    console.log('✅ Бот запущен!');
    console.log(`👤 Вы вошли как: ${client.me.fullname}`);
  });

  // Обработчик сообщений / Message handler
  client.onMessage(async (message) => {
    // Не отвечаем на свои сообщения / Don't reply to own messages
    if (message.senderId === client.me.id) return;
    
    console.log(`💬 ${message.getSenderName()}: ${message.text}`);
    
    // Автоответ / Auto-reply
    await message.reply({
      text: `Привет! Я получил: "${message.text}"`,
      cid: Date.now()
    });
  });

  // Запуск / Start
  await client.start();
}

main().catch(console.error);
```

### Авторизация / Authentication

При первом запуске вы увидите QR-код в консоли:

On first run, you'll see a QR code in the console:

```
🔐 АВТОРИЗАЦИЯ ЧЕРЕЗ QR-КОД
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 Откройте приложение Max на телефоне
➡️  Настройки → Устройства → Подключить устройство
📸 Отсканируйте QR-код

█████████████████████████████
█████████████████████████████
████ ▄▄▄▄▄ █▀█ █▄▄█ ▄▄▄▄▄ ████
████ █   █ █▀▀▀█ ▄█ █   █ ████
...
```

После сканирования токен сохраняется автоматически.

After scanning, the token is saved automatically.

## API

### WebMaxClient

Основной класс для работы с API Max.

#### Конструктор

```javascript
const client = new WebMaxClient({
  name: 'session',        // Имя сессии (для сохранения авторизации)
  phone: '+1234567890',   // Номер телефона
  apiUrl: 'wss://...',    // URL WebSocket API (опционально)
  maxReconnectAttempts: 5,// Максимальное количество попыток переподключения
  reconnectDelay: 3000    // Задержка между попытками переподключения (мс)
});
```

#### Методы

##### `start()`

Запускает клиент и устанавливает соединение.

```javascript
await client.start();
```

##### `sendMessage(options)`

Отправляет сообщение в чат.

```javascript
const message = await client.sendMessage({
  chatId: 123,
  text: 'Привет!',
  cid: Date.now(),
  replyTo: null,        // ID сообщения для ответа (опционально)
  attachments: []       // Вложения (опционально)
});
```

##### `editMessage(options)`

Редактирует сообщение.

```javascript
await client.editMessage({
  messageId: 456,
  chatId: 123,
  text: 'Исправленный текст'
});
```

##### `deleteMessage(options)`

Удаляет сообщение.

```javascript
await client.deleteMessage({
  messageId: 456,
  chatId: 123
});
```

##### `forwardMessage(options)`

Пересылает сообщение.

```javascript
await client.forwardMessage({
  messageId: 456,
  fromChatId: 123,
  toChatId: 789
});
```

##### `sendChatAction(chatId, action)`

Отправляет действие в чате (печатает, выбирает стикер и т.д.).

```javascript
await client.sendChatAction(123, ChatActions.TYPING);
```

##### `getUser(userId)`

Получает информацию о пользователе.

```javascript
const user = await client.getUser(123);
```

##### `getChats(limit, offset)`

Получает список чатов.

```javascript
const chats = await client.getChats(50, 0);
```

##### `getHistory(chatId, limit, offset)`

Получает историю сообщений.

```javascript
const messages = await client.getHistory(123, 50, 0);
```

##### `stop()`

Останавливает клиент.

```javascript
await client.stop();
```

##### `logout()`

Выполняет выход из аккаунта и удаляет сессию.

```javascript
await client.logout();
```

#### Обработчики событий

##### `onStart(handler)`

Регистрирует обработчик запуска клиента.

```javascript
client.onStart(async () => {
  console.log('Клиент запущен!');
});
```

##### `onMessage(handler)`

Регистрирует обработчик новых сообщений.

```javascript
client.onMessage(async (message) => {
  console.log('Новое сообщение:', message.text);
});
```

##### `onMessageRemoved(handler)`

Регистрирует обработчик удаленных сообщений.

```javascript
client.onMessageRemoved(async (message) => {
  console.log('Сообщение удалено:', message.text);
});
```

##### `onChatAction(handler)`

Регистрирует обработчик действий в чате.

```javascript
client.onChatAction(async (action) => {
  console.log('Действие в чате:', action.type);
});
```

##### `onError(handler)`

Регистрирует обработчик ошибок.

```javascript
client.onError(async (error) => {
  console.error('Ошибка:', error.message);
});
```

### Message

Класс, представляющий сообщение.

#### Свойства

- `id` - ID сообщения
- `cid` - Client ID сообщения
- `chatId` - ID чата
- `text` - Текст сообщения
- `senderId` - ID отправителя
- `sender` - Объект отправителя (User)
- `timestamp` - Время отправки
- `type` - Тип сообщения
- `isEdited` - Флаг редактирования
- `replyTo` - ID сообщения, на которое это является ответом
- `attachments` - Вложения

#### Методы

##### `reply(options)`

Отвечает на сообщение.

```javascript
await message.reply({
  text: 'Ответ на сообщение',
  cid: Date.now()
});
```

##### `edit(options)`

Редактирует сообщение.

```javascript
await message.edit({
  text: 'Новый текст'
});
```

##### `delete()`

Удаляет сообщение.

```javascript
await message.delete();
```

##### `forward(chatId)`

Пересылает сообщение.

```javascript
await message.forward(789);
```

### User

Класс, представляющий пользователя.

#### Свойства

- `id` - ID пользователя
- `firstname` - Имя
- `lastname` - Фамилия
- `username` - Имя пользователя
- `phone` - Номер телефона
- `avatar` - URL аватара
- `status` - Статус
- `bio` - Биография
- `fullname` - Полное имя (getter)

### ChatAction

Класс, представляющий действие в чате.

#### Свойства

- `type` - Тип действия
- `chatId` - ID чата
- `userId` - ID пользователя
- `user` - Объект пользователя (User)
- `timestamp` - Время действия

### Константы

#### ChatActions

```javascript
const { ChatActions } = require('webmaxsocket');

ChatActions.TYPING          // Печатает
ChatActions.STICKER         // Выбирает стикер
ChatActions.FILE            // Отправляет файл
ChatActions.RECORDING_VOICE // Записывает голосовое
ChatActions.RECORDING_VIDEO // Записывает видео
```

## Структура проекта

```
webmaxsocket/
├── lib/
│   ├── client.js           # Основной клиент
│   ├── session.js          # Управление сессиями
│   ├── constants.js        # Константы
│   └── entities/
│       ├── User.js         # Класс пользователя
│       ├── Message.js      # Класс сообщения
│       ├── ChatAction.js   # Класс действия в чате
│       └── index.js        # Экспорт сущностей
├── sessions/               # Директория с сохраненными сессиями
├── index.js                # Точка входа
├── example.js              # Пример использования
├── package.json
└── README.md
```

## Сессии

Библиотека автоматически сохраняет сессии в директории `sessions/`. При повторном запуске с тем же именем сессии авторизация не требуется.

```javascript
// Создание новой сессии
const client1 = new WebMaxClient({ name: 'account1', phone: '+1234567890' });

// Использование существующей сессии
const client2 = new WebMaxClient({ name: 'account1' }); // phone не требуется
```

## Обработка ошибок

Рекомендуется всегда оборачивать вызовы API в try-catch блоки:

```javascript
try {
  const message = await client.sendMessage({
    chatId: 123,
    text: 'Привет!',
    cid: Date.now()
  });
} catch (error) {
  console.error('Ошибка:', error.message);
}
```