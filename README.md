# WebMaxSocket — Node.js client for Max Messenger (ESM + TypeScript)

**WebMaxSocket** — async Node.js библиотека для работы с внутренним API мессенджера Max через WebSocket и QR‑код авторизацию. Оригинал: https://github.com/Tellarion/webmaxsocket

## ✨ Features

- ✅ QR‑код авторизация
- ✅ WebSocket соединение
- ✅ Автоматическое сохранение сессий
- ✅ Отправка, редактирование и удаление сообщений
- ✅ Event‑driven архитектура
- ✅ Полная ESM‑сборка + типы TypeScript (`.d.ts`)

## 📦 Установка

```bash
npm install webmax-ts
```

> Пакет поддерживает ESM и CommonJS. Для CommonJS используйте `require`, для TS с `module: commonjs` — обычный `import`.

## 🚀 Быстрый старт

### JavaScript (ESM)

```js
import { WebMaxClient } from 'webmax-ts'

const client = new WebMaxClient({
	name: 'my_session',
	// appVersion по умолчанию: 26.3.9
})

client.onStart(() => {
	console.log(`✅ Вошли как: ${client.me?.fullname || 'User'}`)
})

client.onMessage(async message => {
	if (message.senderId === client.me?.id) return
	await message.reply({ text: `Я получил: ${message.text}`, cid: Date.now() })
})

client.start().catch(console.error)
```

### JavaScript (CommonJS)

```js
const { WebMaxClient } = require('webmax-ts')

const client = new WebMaxClient({ name: 'my_session' })

client.start().catch(console.error)
```

### TypeScript

```ts
import { WebMaxClient, ChatActions } from 'webmax-ts'

const client = new WebMaxClient({ name: 'my_session' })

client.onStart(() => {
	console.log('✅ Клиент запущен')
})

client.onChatAction(action => {
	console.log(action.type)
})

client.start().catch(console.error)
```

## 🔐 QR‑авторизация

При первом запуске в консоли появится QR‑код. Откройте Max на телефоне:

`Настройки → Устройства → Подключить устройство`

После сканирования токен сохраняется автоматически в `sessions/`.

## 🛡 Рекомендация: использовать реальные параметры WEB-клиента

Чтобы снизить риск срабатывания антифрода, рекомендуется брать `userAgent`-параметры из вашего реального web-клиента Max, а не использовать случайные значения.

общая идея:

- профиль должен быть стабильным между перезапусками;
- `deviceName / osVersion / headerUserAgent / timezone / screen` должны быть реалистичными;
- чем меньше “скачков” профиля, тем естественнее поведение клиента.

### как получить параметры из web.max.ru

1. откройте `https://web.max.ru` в браузере (быть авторизованным)
2. нажмите `F12` (devtools)
3. перейдите во вкладку **Network**
4. найдите соединение **WebSocket**
5. откройте первый исходящий пакет (**Send**)
6. возьмите необходимые поля из payload.userAgent

### пример использования

```ts
import { WebMaxClient, UserAgentPayload } from 'webmax-ts'

const userAgent = new UserAgentPayload({
	locale: 'ru',
	deviceLocale: 'ru',
	osVersion: 'Windows',
	deviceName: 'Your Browser',
	headerUserAgent: 'YOUR_REAL_BROWSER_UA',
	appVersion: '26.3.9',
	screen: 'YOUR_SCREEN',
	timezone: 'Europe/Moscow',
})

const client = new WebMaxClient({
	name: 'my_session',
	userAgent,
})

await client.start()
```

## API (кратко)

### WebMaxClient

```ts
const client = new WebMaxClient({
	name: 'session',
	phone: '+1234567890',
	apiUrl: 'wss://ws-api.oneme.ru/websocket',
	maxReconnectAttempts: 5,
	reconnectDelay: 3000,
})
```

Ключевые методы:

- `start()` — запуск клиента
- `sendMessage({ chatId, text, cid, replyTo?, attachments? })`
- `editMessage({ messageId, chatId, text })`
- `deleteMessage({ messageId, chatId, forMe? })`
- `getUser(userId)`
- `getChats(marker?)`
- `getHistory(chatId, from?, backward?, forward?)`
- `getFileLink({ fileId, chatId, messageId })`
- `downloadFile({ fileId, chatId, messageId, output? })`
- `stop()` / `logout()`

### Скачивание файлов

```ts
// 1) Получить временную ссылку на файл (opcode 88)
const link = await client.getFileLink({
	fileId: 3004252087,
	chatId: -7254777603972,
	messageId: '212291254051388603',
})

console.log(link.url, link.unsafe)

// 2) Скачать в Buffer (если output не указан)
const buffer = await client.downloadFile({
	fileId: 3004252087,
	chatId: -7254777603972,
	messageId: '212291254051388603',
})

// 3) Скачать в файл (если output указан)
const saved = await client.downloadFile({
	fileId: 3004252087,
	chatId: -7254777603972,
	messageId: '212291254051388603',
	output: './downloads/report.xlsx',
})
// + в onMessage - const buf = await message.downloadFile()
console.log(saved.path)
```

События:

- `onStart(handler)`
- `onMessage(handler)`
- `onMessageRemoved(handler)`
- `onChatAction(handler)`
- `onError(handler)`

### Константы

```ts
import { ChatActions } from 'webmax-ts'

ChatActions.TYPING
ChatActions.STICKER
ChatActions.FILE
ChatActions.RECORDING_VOICE
ChatActions.RECORDING_VIDEO
```

## 🧩 Структура проекта

```text
webmax/
├── src/        # TypeScript исходники
├── dist/       # Сборка + .d.ts
├── sessions/   # Сохранённые сессии
├── example.js  # Пример использования (ESM)
├── package.json
└── README.md
```

## Ошибки

Всегда оборачивайте сетевые операции в try/catch:

```ts
try {
	await client.sendMessage({ chatId: 123, text: 'Привет!', cid: Date.now() })
} catch (error) {
	console.error('Ошибка:', (error as Error).message)
}
```
