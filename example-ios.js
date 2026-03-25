/**
 * IOS/ANDROID: вход через Socket (api.oneme.ru), не WebSocket
 * WEB: через WebSocket (ws-api.oneme.ru)
 *
 * С готовым конфигом: node example-ios.js
 * Без токена — запрос телефона и SMS
 */

const path = require('path');
const fs = require('fs');
const { WebMaxClient, MaxSocketTransport } = require('./index');
const { UserAgentPayload } = require('./lib/userAgent');
const { Opcode } = require('./lib/opcodes');

const argv = process.argv.slice(2).filter((a) => a !== '--debug' && a !== '-d');
if (process.argv.includes('--debug') || process.argv.includes('-d')) process.env.DEBUG = '1';
const CONFIG_NAME = argv[0] || process.env.CONFIG || 'default';

function loadConfig() {
  const base = path.join(process.cwd(), 'config');
  const p = path.join(base, CONFIG_NAME + (CONFIG_NAME.endsWith('.json') ? '' : '.json'));
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function configToUserAgent(config) {
  const dt = config.deviceType || (config.device_type === 2 ? 'IOS' : config.device_type === 3 ? 'ANDROID' : 'WEB');
  return new UserAgentPayload({
    deviceType: dt,
    locale: config.locale || 'ru',
    deviceLocale: config.deviceLocale || config.locale || 'ru',
    osVersion: config.osVersion || '18.6.2',
    deviceName: config.deviceName || 'Safari',
    headerUserAgent: config.headerUserAgent || config.ua || '',
    appVersion: config.appVersion || '25.12.14',
    screen: config.screen || '390x844 3.0x',
    timezone: config.timezone || 'Europe/Moscow',
    buildNumber: config.buildNumber,
    clientSessionId: config.clientSessionId,
    release: config.release
  });
}

function useSocket(config) {
  const dt = config.deviceType || config.device_type;
  return dt === 'IOS' || dt === 'ANDROID' || dt === 2 || dt === 3;
}

async function main() {
  const config = loadConfig();
  const hasToken = config && config.token && config.token.length >= 50;

  if (hasToken && useSocket(config)) {
    console.log('🚀 Socket (api.oneme.ru) — IOS/ANDROID\n');
    const ua = configToUserAgent(config);
    const transport = new MaxSocketTransport({
      deviceType: config.deviceType || (config.device_type === 2 ? 'IOS' : 'ANDROID'),
      ua: config.headerUserAgent || config.ua,
      deviceId: config.deviceId || require('uuid').v4(),
      debug: process.env.DEBUG === '1'
    });

    transport.onNotification = (data) => {
      if (data.opcode === Opcode.NOTIF_MESSAGE && data.payload) {
        const m = data.payload;
        if (m.senderId !== transport.me?.id) {
          console.log('💬', (m.sender?.firstName || 'User') + ':', m.text || '[вложение]');
        }
      }
    };

    await transport.connect();
    await transport.handshake(ua);

    const syncResp = await transport.sync(config.token, ua.toJSON());

    if (process.env.DEBUG === '1') {
      const s = JSON.stringify(syncResp, null, 2);
      console.log('\n📋 Sync (сырой):', s.slice(0, 3000) + (s.length > 3000 ? '\n...' : ''));
    }
    console.log('\n📋 Ключи sync:', Object.keys(syncResp || {}).join(', '));

    const contact = syncResp?.profile?.contact ?? syncResp?.profile?.user ?? syncResp?.contact;
    if (contact) {
      const names = contact.names || [];
      const name = Array.isArray(names) ? names[0] : names;
      const first = name?.firstName ?? name?.name ?? '';
      const last = name?.lastName ?? '';
      transport.me = {
        id: contact.id,
        firstname: first,
        lastname: last,
        fullname: [first, last].filter(Boolean).join(' ') || 'User'
      };
      console.log('\n👤 Профиль:');
      console.log('   ID:', contact.id);
      console.log('   Имя:', transport.me.fullname);
      console.log('   Телефон:', contact.phone ? '+' + contact.phone : '—');
    }

    const syncChats = syncResp?.chats ?? syncResp?.chatList ?? syncResp?.list ?? [];
    const chats = await transport.getChats();
    const allChats = syncChats.length ? syncChats : chats;
    console.log('\n📂 Диалоги (' + allChats.length + '):');
    allChats.slice(0, 20).forEach((c, i) => {
      const t = c.title ?? c.name ?? c.chat?.title ?? ('Chat ' + (c.id ?? c.chatId ?? i));
      const lastMsg = c.lastMessage?.text ?? c.lastMessage?.message ?? '—';
      console.log(`   ${i + 1}. ${t} — ${String(lastMsg).slice(0, 35)}`);
    });
    if (allChats.length > 20) console.log('   ... и ещё', allChats.length - 20);

    const contacts = syncResp?.contacts || [];
    if (contacts.length) {
      console.log('\n📇 Контакты:', contacts.length);
    }

    console.log('\n🤖 Socket работает (Ctrl+C — выход)\n');
    process.on('SIGINT', () => { transport.close(); process.exit(0); });
    return;
  }

  if (hasToken) {
    const client = new WebMaxClient({
      name: 'web_session',
      configPath: CONFIG_NAME,
      saveToken: false,
      debug: process.env.DEBUG === '1'
    });
    client.onStart(async () => {
      if (client.me) console.log('\n✅ Вход:', client.me.fullname || client.me.firstname, '(ID:', client.me.id + ')\n');
      try { console.log('📂 Диалогов:', (await client.getChats()).length); } catch (e) { console.log('⚠️', e.message); }
    });
    client.onMessage((m) => { if (m.senderId !== client.me?.id) console.log('💬', m.getSenderName() + ':', m.text); });
    client.onError((e) => console.error('❌', e.message));
    await client.start();
    console.log('🤖 Бот работает (Ctrl+C — выход)\n');
    return;
  }

  const readline = require('readline');
  const { v4: uuidv4 } = require('uuid');
  const IOS_UA = 'Mozilla/5.0 (iPhone15,2; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/602.1.50';

  function ask(q) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
  }

  console.log('📱 Получение токена по телефону (Socket)\n');
  const phone = await ask('Номер (+79xxxxxxxxx): ');
  if (!/^\+?\d{10,15}$/.test(phone.replace(/\s/g, ''))) { console.error('❌ Неверный формат'); process.exit(1); }
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('8') && clean.length === 11) clean = '7' + clean.slice(1);
  else if (clean.startsWith('9') && clean.length === 10) clean = '7' + clean;
  const norm = '+' + clean;

  const transport = new MaxSocketTransport({ deviceType: 'IOS', ua: IOS_UA, deviceId: uuidv4(), debug: process.env.DEBUG === '1' });
  await transport.connect();
  await transport.handshake(new UserAgentPayload({ deviceType: 'IOS', headerUserAgent: IOS_UA, appVersion: '25.12.14', osVersion: '18.6.2', deviceName: 'Safari', screen: '390x844 3.0x', locale: 'ru', deviceLocale: 'ru', timezone: 'Europe/Moscow' }));

  console.log('📤 Запрос кода...');
  const tempToken = await transport.requestCode(norm);
  if (!tempToken) throw new Error('Не получен временный токен');
  const code = await ask('Код из SMS (6 цифр): ');
  if (!/^\d{6}$/.test(code)) throw new Error('Неверный код');

  const authResp = await transport.sendCode(tempToken, code);
  const token = authResp?.tokenAttrs?.LOGIN?.token;
  if (!token) throw new Error(authResp?.passwordChallenge ? '2FA не поддерживается' : 'Токен не получен');
  await transport.close();

  const cfg = { token, ua: IOS_UA, device_type: 2, deviceType: 'IOS' };
  const dir = path.join(process.cwd(), 'config');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, CONFIG_NAME + '.json'), JSON.stringify(cfg, null, 2), 'utf8');
  console.log('\n✅ Конфиг сохранён:', path.join(dir, CONFIG_NAME + '.json'));
  console.log('   Запуск: node example-ios.js', CONFIG_NAME);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
process.on('SIGINT', () => {
  console.log('\n\n👋 Завершение работы...');
  console.log('\n💝 Нравится библиотека? Поддержите разработку:');
  console.log('   USDT (TRC20): TXfs1iVbp2aLd3rbc4cenVzMoTevP5RbBE');
  process.exit(0);
});
