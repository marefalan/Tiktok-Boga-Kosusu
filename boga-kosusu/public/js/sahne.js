// Sahne: sunucudan olayları dinler, boğa koşusunu çizer, müziği çalar.
// Adres parametreleri: ?sessiz → ses kapalı (panel önizlemesi)
import { W, H, Particles, Banners, Feed } from './ortak.js';
import { createKosu } from './kosu.js';
import { createAudio } from './ses.js';

const qs = new URLSearchParams(location.search);
const muted = qs.has('sessiz');
const canvas = document.getElementById('cv');
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d');

const state = { rules: [], music: [], viewers: null, bpm: 124, status: null };
const particles = new Particles(), banners = new Banners(), feed = new Feed(4);
const audio = createAudio({ muted });
const api = { particles, banners, feed, rules: () => state.rules, baseBpm: () => state.bpm, sfx: (n, a) => audio.sfx(n, a), glCanvas: document.getElementById('gl'),
  // ?kalite=0.7 gibi bir değer 3B çözünürlüğü sabitler; verilmezse oyun akıcılığa göre kendisi ayarlar
  quality: qs.has('kalite') ? Math.max(0.3, Math.min(1, Number(qs.get('kalite')) || 1)) : 0 };
let scene = null;

let kosu = null;
function newScene() {
  const roster = scene ? scene.roster() : [];
  // 3B dünya bir kez kurulur; "yarışı sıfırla" aynı dünyada yeni lobi açar
  if (kosu) { kosu.reset(); scene = kosu; } else scene = kosu = createKosu(api);
  scene.seed(roster);
  particles.list = []; banners.q = []; banners.cur = null; feed.items = [];
}

function startAudio() {
  audio.start(state.music);
  setTimeout(() => { if (!muted && audio.blocked) tapHint.hidden = false; }, 800);
}

// tarayıcı otomatik sesi engellerse
const tapHint = document.getElementById('ses');
tapHint.addEventListener('click', () => { audio.resume().then(() => { tapHint.hidden = true; startAudio(); }); });

// ---------- olaylar ----------
function connect() {
  const es = new EventSource('/api/events');
  es.onmessage = (m) => {
    let ev; try { ev = JSON.parse(m.data); } catch { return; }
    switch (ev.type) {
      case 'hello':
        state.rules = ev.rules; state.status = ev.status; state.music = ev.music || [];
        if (!scene) { newScene(); startAudio(); }
        break;
      case 'rules': state.rules = ev.rules; break;
      case 'status': state.status = ev.status; break;
      case 'viewers': state.viewers = ev.count; break;
      case 'control': control(ev.cmd); break;
      default: if (scene && ev.user) scene.event(ev);
    }
  };
  es.onerror = () => { es.close(); setTimeout(connect, 2000); };
}

function control(cmd) {
  if (cmd.startsWith('bpm:')) state.bpm = Math.max(70, Math.min(150, Number(cmd.slice(4)) || 124));
  else if (cmd === 'muzik-sonraki') audio.next();
  else if (cmd === 'temizle') newScene();
  else if (cmd === 'skor-sifirla' && scene) scene.resetScores();
  audio.setBpm(state.bpm);
}

// ---------- döngü ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (scene) {
    scene.update(dt);
    particles.update(dt); banners.update(dt); feed.update(dt);
    scene.draw(ctx, audio.pulse());
    particles.draw(ctx);
    banners.draw(ctx, 1000);
    if (state.viewers != null) viewers(ctx, state.viewers);
  } else {
    ctx.fillStyle = '#5AA9E6'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = '600 40px Rubik, system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Sunucuya bağlanılıyor…', W / 2, H / 2);
  }
  requestAnimationFrame(frame);
}

function viewers(ctx, n) {
  ctx.save();
  ctx.font = '600 26px Rubik, system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  const text = `${n.toLocaleString('tr-TR')} izleyici`;
  const w = ctx.measureText(text).width + 30;
  ctx.fillStyle = 'rgba(42,22,12,0.65)';
  ctx.beginPath(); ctx.roundRect(W - 30 - w, 1856, w, 42, 21); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(text, W - 45, 1878);
  ctx.restore();
}

// yazı tipleri yüklenince başla (yüklenemezse de başla)
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(() => {
  connect();
  requestAnimationFrame(frame);
});
