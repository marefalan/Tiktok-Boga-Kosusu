// Boğa Koşusu — yerel sunucu
//  • public/ klasörünü servis eder (sahne + kontrol paneli)
//  • tiktok-live-connector ile TikTok LIVE yayınına bağlanır
//  • gelen yorum / beğeni / hediyeleri oyunun formatına çevirip SSE (/api/events) ile sayfalara yollar
//  • hediyeleri hediyeler.json'daki kurallarla eşleştirir
//
// Ayarlar: ayarlar.json (yoksa ayarlar.ornek.json'dan oluşturulur)
//   username   → TikTok kullanıcı adı (panelden de girilebilir)
//   signApiKey → Euler Stream anahtarı (ya da EULER_API_KEY ortam değişkeni)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3400;
const HOST = '127.0.0.1'; // sadece bu bilgisayardan erişilir
const ROOT = path.join(__dirname, 'public');
const CONFIG_FILE = path.join(__dirname, 'ayarlar.json');
const CONFIG_EXAMPLE = path.join(__dirname, 'ayarlar.ornek.json');
const GIFTS_FILE = path.join(__dirname, 'hediyeler.json');
const MUSIC_DIR = path.join(__dirname, 'muzik');
const AUDIO_RE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|webm|flac)$/i;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg',
  '.opus': 'audio/ogg', '.wav': 'audio/wav', '.webm': 'audio/webm', '.flac': 'audio/flac',
};

// ---------- ayarlar ----------
if (!fs.existsSync(CONFIG_FILE) && fs.existsSync(CONFIG_EXAMPLE)) {
  try { fs.copyFileSync(CONFIG_EXAMPLE, CONFIG_FILE); } catch {}
}
// Mac'teki TextEdit ve bazı editörler düz tırnağı kıvrık tırnağa çevirir; JSON'u bozmasın
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"'));
const config = { username: '', signApiKey: '' };
try {
  Object.assign(config, readJson(CONFIG_FILE));
} catch (e) {
  if (fs.existsSync(CONFIG_FILE)) {
    console.warn('\n  ayarlar.json okunamadı. Tırnak veya virgül silinmiş olabilir. Dosyayı kontrol et.\n');
  }
}
if (process.env.EULER_API_KEY) config.signApiKey = process.env.EULER_API_KEY;
config.signApiKey = String(config.signApiKey || '').trim();
if (process.argv[2]) config.username = process.argv[2].replace(/^@/, '');
config.username = String(config.username || '').trim().replace(/^@/, '');

function saveConfig() {
  // Anahtarı ortam değişkeninden aldıysak dosyaya yazmayız
  const onDisk = { username: config.username, signApiKey: '' };
  try { onDisk.signApiKey = readJson(CONFIG_FILE).signApiKey || ''; } catch {}
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(onDisk, null, 2)); } catch {}
}

// ---------- hediye kuralları ----------
let giftRules = [];
function loadGiftRules() {
  try {
    const raw = readJson(GIFTS_FILE);
    giftRules = Array.isArray(raw.kurallar) ? raw.kurallar : [];
    return true;
  } catch (e) {
    console.warn('[Hediye] hediyeler.json okunamadı:', e.message);
    return false;
  }
}
loadGiftRules();

const norm = (s) => String(s || '').toLocaleLowerCase('tr').trim();
function matchGift(gift) {
  const rules = giftRules;
  const name = norm(gift.name), id = String(gift.id || '');
  const byId = rules.find((r) => (r.id || []).map(String).includes(id) && id);
  if (byId) return byId;
  const byName = rules.find((r) => (r.ad || []).map(norm).includes(name) && name);
  if (byName) return byName;
  // ad/id belirtilmemiş kurallar jeton değerine göre eşleşir
  return rules.find((r) => !(r.ad || []).length && !(r.id || []).length && Number(r.jeton) === Number(gift.diamonds)) || null;
}

// ---------- müzik ----------
function listMusic() {
  try {
    return fs.readdirSync(MUSIC_DIR)
      .filter((f) => AUDIO_RE.test(f))
      .sort((a, b) => a.localeCompare(b, 'tr'))
      .map((f) => '/muzik/' + encodeURIComponent(f));
  } catch { return []; }
}

// ---------- SSE ----------
const clients = new Set();
function broadcast(obj) {
  const s = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of clients) res.write(s);
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 20000);

// ---------- TikTok bağlantısı ----------
const live = { conn: null, username: '', gen: 0, timer: null, ended: false, connectedAt: 0 };
let status = { state: 'idle', username: '', message: 'Bağlı değil' };
function setStatus(state, message) {
  status = { state, username: live.username, message };
  broadcast({ type: 'status', status });
  console.log(`[TikTok] ${state.padEnd(10)} ${message}`);
}

let lib = null;
async function loadLib() {
  if (lib) return lib;
  lib = await import('tiktok-live-connector');
  // "Yayında mı?" kontrolü Euler kotasından yemesin: TikTok'un kendi sayfası yeterli
  if (lib.IsLiveRouteConfig) lib.IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute = true;
  return lib;
}

function userOf(d) {
  const u = (d && d.user) || {};
  const handle = u.uniqueId || u.displayId || '';
  const id = String(handle || u.userId || u.id || '');
  if (!id) return null;
  return { id: 'tt_' + id, nick: String(u.nickname || handle || id).slice(0, 22) };
}
function imageOf(img) {
  if (!img) return '';
  const list = img.urlList || img.url_list || img.mUrls || img.url || [];
  return Array.isArray(list) ? list[0] || '' : String(list);
}
const GIFT_ICONS = {
  rose: '🌹', gül: '🌹', heart: '💗', kalp: '💗', 'finger heart': '🫰', perfume: '🧴', parfüm: '🧴',
  doughnut: '🍩', donut: '🍩', 'hand hearts': '🫶', confetti: '🎊', konfeti: '🎊', galaxy: '🌌',
  lion: '🦁', aslan: '🦁', universe: '🪐', 'ice cream cone': '🍦', gg: '🎮', tiktok: '🎵',
  'money gun': '💸', rocket: '🚀', crown: '👑', 'sports car': '🏎️',
};

// Hem gerçek yayından hem demodan gelen olaylar buradan geçer
function emit(type, user, extra = {}) {
  if (!user) return;
  const ev = { type, user, ...extra };
  if (type === 'gift') {
    const rule = matchGift(ev.gift);
    ev.action = rule ? rule.eylem : 'alkis';
    ev.label = rule ? rule.etiket : 'Alkış';
    console.log(`[Hediye] ${user.nick} → ${ev.gift.name} (id ${ev.gift.id || '-'}) ${ev.gift.diamonds} jeton ×${ev.gift.count} ⇒ ${ev.action}`);
  }
  broadcast(ev);
}

function attach(conn, gen) {
  const { WebcastEvent, ControlEvent } = lib;
  const mine = () => gen === live.gen && conn === live.conn;

  conn.on(ControlEvent.ERROR, (e) => { if (mine()) console.warn('[TikTok] hata:', (e && (e.info || e.message)) || e); });
  conn.on(ControlEvent.DISCONNECTED, () => {
    if (!mine() || live.ended) return;
    setStatus('waiting', 'Bağlantı koptu, 10 sn sonra tekrar denenecek…');
    retry(gen, 10000);
  });
  conn.on(WebcastEvent.STREAM_END, () => {
    if (!mine()) return;
    live.ended = true;
    setStatus('waiting', `@${live.username} yayını bitti. Yeni yayın açılınca otomatik bağlanacak.`);
    const quick = Date.now() - live.connectedAt < 30000;
    retry(gen, quick ? 90000 : 30000);
  });

  const on = (ev, fn) => conn.on(ev, (d) => { if (mine()) fn(d); });
  on(WebcastEvent.CHAT, (d) => emit('chat', userOf(d), { text: String(d.comment || d.content || '').slice(0, 200) }));
  on(WebcastEvent.MEMBER, (d) => emit('member', userOf(d)));
  on(WebcastEvent.LIKE, (d) => emit('like', userOf(d), { count: Number(d.likeCount ?? d.count ?? 1) || 1 }));
  on(WebcastEvent.FOLLOW, (d) => emit('follow', userOf(d)));
  on(WebcastEvent.SHARE, (d) => emit('share', userOf(d)));
  on(WebcastEvent.ROOM_USER, (d) => {
    const n = Number(d.viewerCount ?? d.total ?? d.totalUser);
    if (Number.isFinite(n) && n >= 0) broadcast({ type: 'viewers', count: n });
  });
  on(WebcastEvent.GIFT, (d) => {
    const g = d.gift || {}, gd = d.giftDetails || {}, ex = d.extendedGiftInfo || {};
    const giftType = gd.giftType ?? g.type ?? ex.type;
    // Seri hediyeler (type 1) seri boyunca tekrar tekrar gelir: sadece son olayı işle
    if (giftType === 1 && !d.repeatEnd) return;
    const name = String(gd.giftName || g.name || ex.name || 'Hediye');
    const diamonds = Number(gd.diamondCount ?? g.diamondCount ?? ex.diamond_count ?? ex.diamondCount ?? 1) || 1;
    const count = Math.max(1, Number(d.repeatCount) || 1);
    const icon = GIFT_ICONS[norm(name)] || '🎁';
    const image = imageOf(g.image) || imageOf(ex.image) || imageOf(gd.giftImage);
    const id = String(d.giftId || g.id || gd.id || '');
    emit('gift', userOf(d), { gift: { name, id, diamonds, count, icon, image } });
  });
}

function retry(gen, ms) {
  clearTimeout(live.timer);
  live.timer = setTimeout(() => tryConnect(gen), ms);
}

function newConn(gen) {
  const c = new lib.TikTokLiveConnection(live.username, {
    enableExtendedGiftInfo: false, // hediye listesi Euler'de ücretli; her hediye olayı zaten ad ve değer taşıyor
    processInitialData: false,     // bağlanınca eski yorumları tekrar oynatma
    ...(config.signApiKey ? { signApiKey: config.signApiKey } : {}),
  });
  attach(c, gen);
  return c;
}

async function tryConnect(gen) {
  if (gen !== live.gen) return;
  const old = live.conn;
  if (old) { live.conn = null; old.disconnect().catch(() => {}); }
  const conn = (live.conn = newConn(gen));
  live.ended = false;

  let isLive = null;
  try { isLive = await conn.fetchIsLive(); } catch { isLive = null; }
  if (gen !== live.gen || conn !== live.conn) return;
  if (isLive === false) {
    setStatus('waiting', `@${live.username} şu an yayında değil. Yayın açılınca otomatik bağlanacak.`);
    retry(gen, 30000);
    return;
  }

  setStatus('connecting', `@${live.username} yayınına bağlanılıyor…`);
  try {
    await conn.connect();
    if (gen !== live.gen || conn !== live.conn) { conn.disconnect().catch(() => {}); return; }
    live.connectedAt = Date.now();
    setStatus('live', `@${live.username} canlı yayınına bağlandı`);
  } catch (err) {
    if (gen !== live.gen || conn !== live.conn) return;
    const msg = String((err && err.message) || err);
    const offline = (lib.UserOfflineError && err instanceof lib.UserOfflineError) || /offline|not live|isn't online|not online/i.test(msg);
    const rate = /rate.?limit|too many/i.test(msg);
    const noKey = /sign|api.?key|unauthori[sz]ed|401|403/i.test(msg) && !config.signApiKey;
    if (rate) {
      setStatus('waiting', 'Euler saatlik bağlantı sınırına ulaşıldı. 10 dakika sonra tekrar denenecek.');
      retry(gen, 600000);
    } else if (offline) {
      setStatus('waiting', `@${live.username} şu an yayında değil. Yayın açılınca otomatik bağlanacak.`);
      retry(gen, 30000);
    } else if (noKey) {
      setStatus('error', 'Euler API anahtarı eksik. ayarlar.json içindeki "signApiKey" alanını doldur.');
      retry(gen, 60000);
    } else {
      setStatus('error', `Bağlanılamadı: ${msg.slice(0, 160)}. 30 sn sonra tekrar denenecek.`);
      retry(gen, 30000);
    }
  }
}

async function startLive(username) {
  username = String(username || '').trim().replace(/^@/, '');
  live.gen++;
  clearTimeout(live.timer);
  if (live.conn) { const c = live.conn; live.conn = null; c.disconnect().catch(() => {}); }
  live.username = username;
  if (!username) { setStatus('idle', 'Bağlı değil'); return; }
  try { await loadLib(); } catch (e) {
    setStatus('error', 'tiktok-live-connector yüklenemedi. BASLAT.bat paketleri kurmamış olabilir.');
    return;
  }
  if (!config.signApiKey) console.warn('[TikTok] Uyarı: Euler API anahtarı yok, bağlantı reddedilebilir.');
  tryConnect(live.gen);
}

function stopLive() {
  live.gen++;
  clearTimeout(live.timer);
  if (live.conn) { const c = live.conn; live.conn = null; c.disconnect().catch(() => {}); }
  setStatus('idle', 'Bağlı değil');
}

// ---------- HTTP ----------
function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Bulunamadı'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) {
      const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
      if (a > b) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1, 'Cache-Control': 'no-cache' });
      return fs.createReadStream(file, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

// Klasör dışına çıkmayı engelle
function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, rel));
  return p === base || p.startsWith(base + path.sep) ? p : null;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); } });
  });
}

const publicState = () => ({
  status,
  username: config.username,
  hasKey: Boolean(config.signApiKey),
  rules: giftRules,
  music: listMusic(),
});

// Demo olaylarını yayındaki gibi üret (panelden)
let demoSeq = 0;
function demoEvent(body) {
  const nick = String(body.nick || `izleyici${++demoSeq}`).slice(0, 22);
  const user = { id: 'demo_' + nick, nick };
  switch (body.type) {
    case 'chat': return emit('chat', user, { text: String(body.text || 'merhaba').slice(0, 200) });
    case 'like': return emit('like', user, { count: Number(body.count) || 15 });
    case 'member': return emit('member', user);
    case 'follow': return emit('follow', user);
    case 'share': return emit('share', user);
    case 'gift': {
      const r = body.rule || {};
      const gift = {
        name: String((r.ad && r.ad[0]) || body.name || r.etiket || 'Hediye'),
        id: String((r.id && r.id[0]) || ''),
        diamonds: Number(r.jeton ?? body.diamonds ?? 1) || 1,
        count: 1,
        icon: r.ikon || '🎁',
        image: '',
      };
      return emit('gift', user, { gift });
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = decodeURIComponent(url.pathname);

  if (p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ type: 'hello', ...publicState() })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (p === '/api/state') return json(res, 200, publicState());

  if (req.method === 'POST') {
    const body = await readBody(req);
    if (p === '/api/connect') {
      config.username = String(body.username || '').trim().replace(/^@/, '');
      saveConfig();
      startLive(config.username);
      return json(res, 200, { ok: true });
    }
    if (p === '/api/disconnect') { stopLive(); return json(res, 200, { ok: true }); }
    if (p === '/api/reload-gifts') {
      const ok = loadGiftRules();
      broadcast({ type: 'rules', rules: giftRules });
      return json(res, ok ? 200 : 500, { ok, rules: giftRules });
    }
    if (p === '/api/demo') { demoEvent(body); return json(res, 200, { ok: true }); }
    if (p === '/api/control') {
      // panelden sahneye doğrudan komut (müzik atla, sahneyi temizle vb.)
      broadcast({ type: 'control', cmd: String(body.cmd || '') });
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { ok: false });
  }

  if (p.startsWith('/muzik/')) {
    const f = safeJoin(MUSIC_DIR, p.slice('/muzik/'.length));
    if (!f || !AUDIO_RE.test(f)) { res.writeHead(404); return res.end(); }
    return serveFile(req, res, f);
  }

  const routes = { '/': 'panel.html', '/sahne': 'sahne.html' };
  const f = safeJoin(ROOT, routes[p] || p);
  if (!f) { res.writeHead(403); return res.end(); }
  serveFile(req, res, f);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  ${PORT} portu kullanımda. Oyun zaten açık olabilir; diğer SUNUCU penceresini kapatıp tekrar dene.\n`);
  } else console.error(e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Boğa Koşusu çalışıyor`);
  console.log(`  Kontrol paneli : http://localhost:${PORT}/`);
  console.log(`  Sahne (yayına) : http://localhost:${PORT}/sahne`);
  console.log(`  Euler anahtarı : ${config.signApiKey ? 'var' : 'YOK (ayarlar.json → signApiKey)'}\n`);
  if (config.username) startLive(config.username);
});
