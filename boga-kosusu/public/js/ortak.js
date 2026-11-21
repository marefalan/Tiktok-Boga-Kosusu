// Ortak yardımcılar: rastgelelik, karakter görünümü, parçacıklar, duyurular, olay akışı.

export const W = 1080, H = 1920;

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let s = seed || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length) % arr.length];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;

// Türkçe metin sadeleştirme: büyük/küçük harf, Türkçe karakterler ve aksanlar fark etmez.
// "KOŞ", "koş", "Kos" → "kos"; "İ"/"I" doğru küçülür; bazı klavyelerin eklediği görünmez nokta atılır.
export function sade(s) {
  return String(s || '').normalize('NFC').toLocaleLowerCase('tr').normalize('NFD')
    .replace(/\u0131/g, 'i')            // ı → i
    .replace(/[\u0300-\u036f]/g, '');   // ç ğ ö ş ü â î û ve görünmez noktayı sadeleştir
}

// Uzatılmış yazımları toparlar: "koşşş" → "kos", "hadiii" → "hadi"
const tek = (w) => w.replace(/(.)\1+/g, '$1');

// Yorum bir komut içeriyor mu? Kelime bazlı eşleşir; noktalama, emoji ve harf uzatmaları sorun olmaz.
// 4+ harfli komutlar kelimenin başıyla eşleşir ("kementi", "sırtüstü"); kısa komutlar tam eşleşir
// ("at", "don" başka kelimelerin içinde geçince tetiklenmez). Boşluklu komutlar ifade olarak aranır.
export function komut(text, words) {
  const t = sade(text);
  const toks = t.split(/[^a-z0-9]+/).filter(Boolean).map(tek);
  const flat = ' ' + toks.join(' ') + ' ';
  return words.some((w) => {
    const k = sade(w).split(/[^a-z0-9]+/).filter(Boolean).map(tek);
    if (!k.length) return false;
    if (k.length > 1) return flat.includes(' ' + k.join(' ') + ' ');
    const one = k[0];
    return toks.some((x) => (one.length >= 4 ? x.startsWith(one) : x === one));
  });
}
export const has = komut;

const SKIN = ['#F3D3B8', '#E5B593', '#C98E66', '#9A6342', '#6A4129'];
const HAIR = ['#1d1209', '#3b2414', '#6b4423', '#c99a5b', '#2a2a2a', '#8a3b1f'];

export function lookFor(id) {
  const r = rng(hash(id + 'kosu'));
  // çoğu koşucu geleneksel kıyafette: beyaz giysi, kırmızı fular ve kuşak
  const classic = r() < 0.7;
  return {
    skin: pick(SKIN, r), hair: pick(HAIR, r), hairStyle: pick([0, 1, 0, 2, 3], r),
    top: classic ? '#F7F5F0' : pick(['#3E6FA8', '#E8C468', '#5E8C4A', '#8A3B5E', '#D98A3A', '#4A4A58'], r),
    bottom: classic ? '#F2EFE8' : pick(['#F2EFE8', '#2F4A7A', '#3B3B44'], r),
    shoe: pick(['#F2EFE8', '#3B2210', '#1E1410', '#D7263D'], r),
    sleeves: r() < 0.6,
    scarf: '#D7263D', sash: classic ? '#D7263D' : null,
    hat: null, cap: null, band: null,
  };
}

// ---------- parçacıklar ----------
export class Particles {
  constructor() { this.list = []; }
  confetti(x, y, n = 80, colors = ['#FF3D9A', '#3EE6FF', '#FFB23E', '#7CFF6B', '#FFFFFF', '#B388FF']) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 300 + Math.random() * 700;
      this.list.push({ k: 'c', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 600, r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, w: 10 + Math.random() * 10, h: 6 + Math.random() * 6, c: pick(colors), life: 4 + Math.random() * 2 });
    }
  }
  rain(n = 120, colors, kind = 'c') {
    for (let i = 0; i < n; i++) {
      this.list.push({ k: kind, x: Math.random() * W, y: -40 - Math.random() * 900, vx: (Math.random() - 0.5) * 80, vy: 150 + Math.random() * 200, r: Math.random() * 6, vr: (Math.random() - 0.5) * 4, w: 14 + Math.random() * 12, h: 8 + Math.random() * 6, c: pick(colors), life: 9 });
    }
  }
  sparkle(x, y, n = 14, c = '#FFE27A') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
      this.list.push({ k: 's', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, r: 0, vr: 0, w: 6 + Math.random() * 8, c, life: 0.8 + Math.random() * 0.6, max: 1.4 });
    }
  }
  float(x, y, text, c = '#fff', size = 40) {
    this.list.push({ k: 't', x, y, vx: 0, vy: -90, text, c, size, life: 2.2, max: 2.2 });
  }
  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      if (p.k === 'c' || p.k === 'p') {
        p.vx *= 0.985; p.vy = Math.min(p.vy + 900 * dt, p.k === 'p' ? 160 : 420);
        if (p.k === 'p') p.vx += Math.sin(p.life * 3 + p.w) * 6;
      } else if (p.k === 's') { p.vx *= 0.92; p.vy *= 0.92; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
    }
    this.list = this.list.filter((p) => p.life > 0 && p.y < H + 60);
  }
  draw(ctx) {
    for (const p of this.list) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.k === 'c') {
        ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.r * 2)), p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
      } else if (p.k === 'p') {
        ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.w / 2, p.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      } else if (p.k === 's') {
        ctx.globalAlpha = Math.min(1, p.life / 0.5); ctx.fillStyle = p.c;
        star(ctx, p.w);
      } else if (p.k === 't') {
        ctx.globalAlpha = Math.min(1, p.life / 0.6);
        ctx.font = `700 ${p.size}px Rubik, system-ui, sans-serif`; ctx.textAlign = 'center';
        ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = p.c; ctx.fillText(p.text, 0, 0);
      }
      ctx.restore();
    }
  }
}

function star(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.3 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

// ---------- büyük duyuru ----------
export class Banners {
  constructor() { this.q = []; this.cur = null; }
  show(title, sub = '', style = {}) {
    this.q.push({ title, sub, style, t: 0, dur: style.dur || 3.2 });
    if (this.q.length > 4) this.q.splice(1, 1);
  }
  update(dt) {
    if (!this.cur && this.q.length) this.cur = this.q.shift();
    if (this.cur) { this.cur.t += dt; if (this.cur.t > this.cur.dur) this.cur = null; }
  }
  draw(ctx, y = 700) {
    const b = this.cur; if (!b) return;
    const k = Math.min(1, b.t / 0.25), out = Math.max(0, (b.t - (b.dur - 0.35)) / 0.35);
    const st = b.style;
    ctx.save();
    ctx.globalAlpha = (1 - out);
    ctx.translate(W / 2, y);
    const sc = 0.6 + 0.4 * (1 - Math.pow(1 - k, 3));
    ctx.scale(sc, sc);
    ctx.rotate(st.tilt ?? -0.04);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = st.font || '400 92px Bungee, Rubik, sans-serif';
    const tw = Math.min(980, ctx.measureText(b.title).width + 80);
    ctx.fillStyle = st.bg || '#FF3D9A';
    ctx.beginPath(); ctx.roundRect(-tw / 2, -78, tw, b.sub ? 200 : 150, st.radius ?? 18); ctx.fill();
    ctx.fillStyle = st.color || '#fff';
    ctx.fillText(b.title, 0, -2, 940);
    if (b.sub) {
      ctx.font = st.subFont || '600 40px Rubik, system-ui, sans-serif';
      ctx.fillStyle = st.subColor || st.color || '#fff';
      ctx.fillText(b.sub, 0, 82, 900);
    }
    ctx.restore();
  }
}

// ---------- olay akışı (sol alt) ----------
export class Feed {
  constructor(max = 5) { this.items = []; this.max = max; }
  add(text, color = '#fff') {
    this.items.unshift({ text, color, t: 0 });
    if (this.items.length > this.max) this.items.length = this.max;
  }
  update(dt) { for (const i of this.items) i.t += dt; this.items = this.items.filter((i) => i.t < 9); }
  draw(ctx, x, y, st = {}) {
    ctx.save();
    ctx.font = st.font || '600 28px Rubik, system-ui, sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    this.items.forEach((it, i) => {
      const yy = y - i * 52;
      ctx.globalAlpha = Math.min(1, (9 - it.t) / 1.2) * (1 - i * 0.12);
      const w = ctx.measureText(it.text).width + 32;
      const left = st.right ? x - w : x;
      ctx.fillStyle = st.bg || 'rgba(10,6,24,0.62)';
      ctx.beginPath(); ctx.roundRect(left, yy - 22, w, 44, 22); ctx.fill();
      ctx.fillStyle = it.color; ctx.fillText(it.text, left + 16, yy + 1);
    });
    ctx.restore();
  }
}

// Hediye rehberi şeridi: kurallar listesi (alt kısım)
export function drawGiftGuide(ctx, rules, y, st = {}) {
  const list = (rules || []).slice(0, 6);
  if (!list.length) return;
  const cols = 3, cw = 330, ch = 74, gap = 12;
  const x0 = (W - (cols * cw + (cols - 1) * gap)) / 2;
  ctx.save();
  list.forEach((r, i) => {
    const x = x0 + (i % cols) * (cw + gap), yy = y + Math.floor(i / cols) * (ch + gap);
    ctx.fillStyle = st.bg || 'rgba(10,6,24,0.66)';
    ctx.beginPath(); ctx.roundRect(x, yy, cw, ch, st.radius ?? 16); ctx.fill();
    if (st.border) { ctx.strokeStyle = st.border; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.textBaseline = 'middle';
    ctx.font = '40px "Noto Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(r.ikon || '🎁', x + 42, yy + ch / 2 + 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = st.color || '#fff'; ctx.font = st.font || '700 27px Rubik, system-ui, sans-serif';
    ctx.fillText(r.etiket || r.eylem, x + 80, yy + ch / 2 + 1, cw - 92);
  });
  ctx.restore();
}

// Basit ölçü çubuğu
export function drawMeter(ctx, x, y, w, h, v, st = {}) {
  ctx.save();
  ctx.fillStyle = st.bg || 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  const fw = Math.max(h, w * clamp(v, 0, 1));
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  (st.colors || ['#3EE6FF', '#FF3D9A']).forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(x, y, fw, h, h / 2); ctx.fill();
  if (st.label) {
    ctx.font = st.font || '700 24px Rubik, system-ui, sans-serif';
    ctx.fillStyle = st.color || '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(st.label, x + 14, y + h / 2 + 1);
  }
  ctx.restore();
}
