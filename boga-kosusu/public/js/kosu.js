// Boğa Koşusu (3B): köy yolunda koşucular kameraya doğru kaçar, arkalarından boğa gelir.
// Lobi → 3-2-1 → yarış → sonuç kartı → yeni lobi. Geride kalanı boğa yakalar, bitişe ilk varan kazanır.
// Dünya Three.js ile 3B çizilir (dunya3d.js); isimler, paneller ve duyurular üstteki saydam katmanda.
import { W, H, lookFor, komut, clamp, lerp } from './ortak.js';
import { createWorld } from './dunya3d.js';

const C = { red: '#D7263D', redDark: '#9E1B2C', yellow: '#FFD23F', orange: '#F28C28', cream: '#FFF6E5', ink: '#1E1410' };
const TITLE_FONT = 'Bungee, Rubik, sans-serif';
const LENGTH = 400;            // yarış mesafesi (m)
const LOBBY = 25, COUNT = 3, RESULTS = 9, CAP = 24, MIN_RUNNERS = 6;

// Yorum komutları (büyük/küçük harf ve Türkçe karakter fark etmez: "KOŞ", "koşşş", "Hızlan" hepsi çalışır)
const W_RUN = ['koş', 'koşun', 'koştur', 'hızlan', 'hızlı', 'kaç', 'kaçın', 'hadi', 'haydi', 'gaz', 'bas'];
// üst paneldeki simgelerin altında yazan eylem adları
const ACTION = { katil: 'KATIL', turbo: 'TURBO', kalkan: 'KALKAN', jetpack: 'JETPACK', pelerin: 'PELERİN', roket: 'ROKET' };
const moverShim = () => ({ mode: 'idle', set(m) { this.mode = m; }, update() {} });
const POSE = { jog: 'run', panik: 'panic', tumble: 'tossed', idle: 'idle' };

export function createKosu(api) {
  const world = createWorld(api.glCanvas, { length: LENGTH, outW: W, outH: H, quality: api.quality || 1 });
  let dtAvg = 1 / 60, qualityT = 0;
  const bullH = world.makeBull();
  const runners = new Map();
  let phase = 'lobby', phaseT = LOBBY, raceT = 0, firstFinishT = null, npcSeq = 0, t = 0, hype = 0.2;
  let raceNo = loadNum('kosu-yaris-no', 1);
  const wins = loadWins();
  const nextLobby = new Map();     // yarış sırasında yazanlar: sonraki lobiye otomatik girer
  let finishers = [], caught = [], results = null;
  const bull = { d: -14, v: 0, lane: 0, stunUntil: 0, ph: 0, snort: 0 };
  const dust = [];
  let focus = -6;

  function remove(r) { if (r.h) r.h.dispose(); runners.delete(r.id); }
  function runnerY(r) {
    if (r.state === 'tossed' && r.toss) return Math.max(0, r.toss.z);
    if (r.jet) return Math.sin(r.jet.k * Math.PI) * (r.jet.rocket ? 4.5 : 2.6);
    return 0;
  }
  function runnerX(r) { return world.laneX(r.state === 'tossed' && r.toss ? r.toss.lane : r.lane); }
  function place(r) { r.h.root.position.set(runnerX(r), runnerY(r), -r.d); }
  // koşucunun ekrandaki yeri (yükseklik metre cinsinden)
  function screenOf(r, up = 1) { return world.project(runnerX(r), runnerY(r) + up, -r.d); }

  // 3B nesneleri oyun durumuna eşitle + kamera
  function sync3d(dt) {
    // akıcılık koruması: kareler yavaşsa çözünürlüğü kademeli düşür (en az %60)
    if (!api.quality) {
      dtAvg = lerp(dtAvg, dt, 0.05); qualityT += dt;
      if (qualityT > 3 && dtAvg > 1 / 38 && world.quality > 0.6) { world.setQuality(Math.round((world.quality - 0.1) * 10) / 10); qualityT = 0; }
    }
    for (const r of runners.values()) {
      if (r.state === 'gone') { r.h.root.visible = false; continue; }
      place(r);
      if (r.state === 'tossed') { r.h.root.rotation.set(r.toss.rot * 0.6, 0, r.toss.rot); }
      else r.h.root.rotation.set(0, 0, 0);
      const mode = r.state === 'wait' ? 'idle' : r.state === 'tossed' ? 'tossed' : POSE[r.mover.mode] || 'run';
      r.h.pose(mode, dt, r.base + r.boost + (t < r.turboUntil ? 3 : 0));
    }
    // boğanın burnu tam bull.d noktasında olsun (yakalama anı boynuzlarla çakışır)
    bullH.root.position.set(world.laneX(bull.lane), 0, -bull.d + 2.4);
    bullH.pose(phase === 'race' && bull.v > 0.5, dt, bull.v);

    // kamera: boğa ile grubun ortası odakta; lider her zaman görüş içinde
    const run = [...runners.values()].filter((r) => r.state === 'run').map((r) => r.d).sort((a, b) => a - b);
    // kadraj: yakın uç = en öndeki koşucu, uzak uç = boğa (grup çok açılırsa ortanca koşucunun 35 m gerisi)
    let near = 0, far = bull.d - 2;
    if (phase === 'race' && run.length) {
      const mid = run[Math.floor(run.length / 2)];
      near = run[run.length - 1];
      far = Math.max(bull.d - 2, mid - 35);
    } else if (phase === 'results') { near = focus + 10; far = focus - 10; }
    else { near = 1; far = bull.d - 2; }
    focus = (near + far) / 2;
    world.frame(near, far, dt, Math.sin(t * 0.25) * 1.2);
    hype = lerp(hype, phase === 'race' ? 0.6 + (caught.length ? 0.3 : 0) : 0.25, 1 - Math.pow(0.5, dt));
    world.update(t, hype);
  }

  // ---------- katılım ----------
  function join(user, { late = false } = {}) {
    let r = runners.get(user.id);
    if (r) { r.last = t; return r; }
    const reals = [...runners.values()].filter((q) => q.real);
    if (reals.length >= CAP) return null;
    const npc = !user.npc && [...runners.values()].find((q) => !q.real);
    if (npc && phase !== 'race') remove(npc);
    const m = moverShim(); m.set(phase === 'race' ? 'jog' : 'idle');
    r = { id: user.id, nick: user.nick, real: !user.npc, look: lookFor(user.id), mover: m,
      d: late ? bull.d + 7 : -Math.random() * 3, lane: 0, home: (Math.random() * 2 - 1) * 0.8, laneV: 0,
      base: 5.5 + Math.random() * 0.6, boost: 0, turboUntil: 0, shieldUntil: 0, jet: null,
      state: phase === 'race' ? 'run' : 'wait', toss: null, pending: [], last: t, star: 0, place: 0, time: 0, chatCool: 0 };
    r.lane = r.home;
    r.h = world.makeRunner(r.look);
    place(r);
    runners.set(user.id, r);
    if (r.real) { const p = screenOf(r, 1.4); if (p.visible) api.particles.sparkle(p.x, p.y, 8, C.yellow); }
    return r;
  }

  function fillNpc() {
    const n = runners.size;
    for (let i = n; i < MIN_RUNNERS; i++) join({ id: 'npc_' + (++npcSeq), nick: '', npc: true });
  }

  // ---------- olaylar ----------
  function event(ev) {
    const u = ev.user;
    switch (ev.type) {
      case 'chat': {
        if (phase === 'lobby' || phase === 'count') { join(u); return; }
        const r = runners.get(u.id);
        if (r && r.state === 'run') {
          r.last = t;
          if (t > r.chatCool) { r.boost = Math.min(3, r.boost + (komut(ev.text, W_RUN) ? 1.1 : 0.5)); r.chatCool = t + 2; }
        } else if (!r && !nextLobby.has(u.id)) {
          nextLobby.set(u.id, u);
          api.feed.add(`${u.nick} sonraki yarışa yazıldı`, C.cream);
        }
        break;
      }
      case 'like': {
        const r = runners.get(u.id);
        if (r && r.state === 'run') r.boost = Math.min(3.5, r.boost + ev.count * 0.03);
        break;
      }
      case 'follow': applyOrQueue(u, 'turbo', 'takip etti'); break;
      case 'share': applyOrQueue(u, 'turbo', 'paylaştı'); break;
      case 'gift': {
        const n = ev.gift.count || 1;
        api.feed.add(`${u.nick} ${ev.gift.icon || '🎁'} ${ev.gift.name}${n > 1 ? ' ×' + n : ''}`, C.yellow);
        const action = ev.action === 'alkis' ? 'turbo' : ev.action;
        if (action === 'katil') {
          if (phase === 'race') { const r = join(u, { late: true }); if (r) { r.star = t + 90; give(r, 'turbo'); } }
          else { const r = join(u); if (r) r.star = t + 90; }
          break;
        }
        if (action === 'pelerin') { cape(u.nick); break; }
        applyOrQueue(u, action, null);
        break;
      }
    }
  }


  // yarış sürüyorsa hemen uygula; değilse koşucuyu yaz ve güçlendirmeyi sonraki yarışa sakla
  function applyOrQueue(u, action, verb) {
    if (phase === 'race') {
      const r = runners.get(u.id);
      if (r && r.state === 'run') { give(r, action); if (verb) api.feed.add(`${u.nick} ${verb} → ${LABEL[action]}`, C.yellow); return; }
      nextLobby.set(u.id, { ...u, pending: [...((nextLobby.get(u.id) || {}).pending || []), action] });
      api.feed.add(`${u.nick} ${verb ? verb + ' → ' : ''}${LABEL[action]} (sonraki yarışta)`, C.cream);
    } else {
      const r = join(u);
      if (r) { r.pending.push(action); r.star = t + 90; api.feed.add(`${u.nick} ${verb ? verb + ' → ' : ''}${LABEL[action]} (başlangıçta)`, C.cream); }
    }
  }

  const LABEL = { turbo: 'TURBO', kalkan: 'KALKAN', jetpack: 'JETPACK', roket: 'ROKET', pelerin: 'PELERİN' };

  function give(r, action) {
    const sp = screenOf(r, 3.2), x = sp.x, y = sp.y + 200;
    r.star = Math.max(r.star, t + 60);
    switch (action) {
      case 'turbo': r.turboUntil = Math.max(r.turboUntil, t) + 4; api.sfx('whoosh'); api.particles.float(x, y - 200, 'TURBO!', C.yellow, 34); break;
      case 'kalkan': r.shieldUntil = Math.max(r.shieldUntil, t) + 12; api.particles.float(x, y - 200, 'KALKAN!', '#9FE3FF', 34); break;
      case 'jetpack': r.jet = { from: r.d, to: r.d + 30, k: 0, dur: 2 }; api.sfx('whoosh'); api.particles.float(x, y - 200, 'JETPACK!', '#FFB23E', 34); break;
      case 'roket': {
        const lead = Math.max(...[...runners.values()].filter((q) => q.state === 'run').map((q) => q.d), r.d);
        r.jet = { from: r.d, to: Math.min(LENGTH - 5, lead + 6), k: 0, dur: 2.4, rocket: true };
        api.sfx('whoosh'); api.banners.show('ROKET!', `${r.nick} en öne uçuyor`, bannerStyle(C.yellow, C.ink));
        break;
      }
    }
  }

  function cape(nick) {
    if (phase !== 'race') { api.feed.add(`${nick} → PELERİN (sonraki yarışta boğayı durdurur)`, C.cream); pendingCape++; return; }
    bull.stunUntil = Math.max(bull.stunUntil, t) + 5;
    api.sfx('snort');
    api.banners.show('KIRMIZI PELERİN', `${nick} boğayı oyaladı`, bannerStyle(C.red));
  }
  let pendingCape = 0;

  // ---------- akış ----------
  function startLobby() {
    phase = 'lobby'; phaseT = LOBBY; results = null; finishers = []; caught = []; firstFinishT = null;
    for (const r of [...runners.values()]) remove(r);
    bull.d = -14; bull.v = 0; bull.lane = 0; bull.stunUntil = 0;
    world.setGate(true);
    for (const u of nextLobby.values()) {
      const r = join(u);
      if (r && u.pending) r.pending.push(...u.pending);
    }
    nextLobby.clear();
  }

  function startRace() {
    phase = 'race'; raceT = 0;
    world.setGate(false);
    api.sfx('bell'); api.sfx('cheer', true);
    api.banners.show('KOŞ!', 'Boğa geliyor', bannerStyle(C.red));
    for (const r of runners.values()) {
      r.state = 'run'; r.mover.set('jog');
      for (const a of r.pending) give(r, a);
      r.pending = [];
    }
    if (pendingCape) { bull.stunUntil = t + 3 + pendingCape * 4; pendingCape = 0; }
  }

  function endRace() {
    const rest = [...runners.values()].filter((r) => r.state === 'run').sort((a, b) => b.d - a.d);
    const list = [
      ...finishers.map((r) => ({ r, info: fmtTime(r.time) })),
      ...rest.map((r) => ({ r, info: `%${Math.round(clamp(r.d / LENGTH, 0, 1) * 100)}` })),
      ...caught.slice().reverse().map((r) => ({ r, info: `yakalandı · %${Math.round(clamp(r.d / LENGTH, 0, 1) * 100)}` })),
    ];
    const winner = finishers[0];
    if (winner && winner.real) {
      const w = wins[winner.id] || { nick: winner.nick, wins: 0 };
      w.wins++; w.nick = winner.nick; wins[winner.id] = w; saveWins(wins);
    }
    results = { list, winner, caughtCount: caught.length, no: raceNo };
    raceNo++; saveNum('kosu-yaris-no', raceNo);
    phase = 'results'; phaseT = RESULTS;
    if (winner) { api.particles.confetti(W / 2, 700, 160, CONFETTI); api.sfx('cheer', true); }
  }

  // ---------- güncelleme ----------
  function update(dt) {
    t += dt;
    phaseT -= dt;
    if (phase === 'lobby') {
      if (phaseT <= 0) { fillNpc(); phase = 'count'; phaseT = COUNT; api.sfx('bell'); }
    } else if (phase === 'count') {
      if (phaseT <= 0) startRace();
    } else if (phase === 'results') {
      if (phaseT <= 0) startLobby();
    }

    if (phase === 'race') updateRace(dt);
    else {
      // lobide boğa ağılda homurdanır
      bull.ph += dt * 2; bull.v = 0;
      if (Math.random() < dt * 0.6) { bull.snort = 0.5; api.sfx('snort'); }
    }
    bull.snort = Math.max(0, bull.snort - dt);

    for (const r of runners.values()) {
      if (r.state === 'wait') { r.mover.set('idle'); r.mover.update(dt * 1.5, dt); }
      if (r.state === 'tossed') {
        const k = r.toss;
        k.vz -= 22 * dt; k.z += k.vz * dt; k.lane += k.vl * dt; k.rot += k.spin * dt; r.d += k.vd * dt;
        r.mover.update(dt * 2, dt);
        if (k.z < -0.5) r.state = 'gone';
      }
    }
    sync3d(dt);
    for (const d of dust) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; }
    for (let i = dust.length - 1; i >= 0; i--) if (dust[i].t > dust[i].life) dust.splice(i, 1);
  }

  function updateRace(dt) {
    raceT += dt;
    const running = [...runners.values()].filter((r) => r.state === 'run');
    // boğa: başta kısa bir avans, sonra giderek hızlanır
    let bv = raceT < 2.5 ? 0 : Math.min(8.2, 5.6 + (raceT - 2.5) * 0.02);
    // boğa sondakinden çok geride kalırsa atak yapar: her zaman sondakilerin peşinde
    const tail = running.length ? Math.min(...running.map((r) => r.d)) : bull.d;
    if (raceT > 2.5 && tail - bull.d > 16) bv += Math.min(2.5, (tail - bull.d - 16) * 0.25);
    if (t < bull.stunUntil) bv = 1.2;
    bull.v = lerp(bull.v, bv, 1 - Math.pow(0.1, dt));
    bull.d += bull.v * dt;
    bull.ph += dt * (2 + bull.v * 1.6);
    // en yakın koşucunun şeridine yönel
    const prey = running.filter((r) => r.d > bull.d).sort((a, b) => a.d - b.d)[0];
    if (prey) bull.lane = lerp(bull.lane, clamp(prey.lane, -0.7, 0.7), 1 - Math.pow(0.4, dt));
    if (bull.v > 3 && Math.random() < dt * 8) { const p = world.project(world.laneX(bull.lane) + (Math.random() - 0.5) * 1.6, 0.2, -bull.d + 1); if (p.visible) puff(p.x, p.y, 1); }

    for (const r of running) {
      let v = r.base + Math.sin(t * 1.3 + r.base * 7) * 0.35 + r.boost;
      r.boost *= Math.exp(-dt / 1.6);
      if (t < r.turboUntil) v += 3;
      if (r.jet) {
        r.jet.k = Math.min(1, r.jet.k + dt / r.jet.dur);
        const e = r.jet.k * r.jet.k * (3 - 2 * r.jet.k);
        r.d = lerp(r.jet.from, r.jet.to, e);
        if (r.jet.k >= 1) r.jet = null;
      } else r.d += v * dt;
      // boğa yakınsa yana kaç
      const gap = r.d - bull.d;
      const near = gap < 9 && Math.abs(r.lane - bull.lane) < 0.45;
      r.laneV += ((near ? Math.sign(r.lane - bull.lane || 1) * 1.6 : 0) + (Math.random() - 0.5) * 0.8 + (r.home - r.lane) * 0.6) * dt;
      r.laneV *= Math.exp(-dt * 2);
      r.lane = clamp(r.lane + r.laneV * dt, -0.85, 0.85);
      r.mover.set(gap < 6 ? 'panik' : 'jog');
      r.mover.update(dt * (1.2 + v * 0.22), dt);

      if (gap < 0.5 && !r.jet) {
        if (t < r.shieldUntil) { r.d = bull.d + 1.5; const sp = screenOf(r, 1.4); if (sp.visible) api.particles.sparkle(sp.x, sp.y, 10, '#9FE3FF'); }
        else toss(r);
      }
      if (r.d >= LENGTH && r.state === 'run') finish(r);
    }
    // bitenler yolda koşmaya devam eder, sonra çıkar
    for (const r of runners.values()) if (r.state === 'done') { r.d += r.base * dt; r.mover.update(dt * 2.4, dt); }

    const active = [...runners.values()].filter((r) => r.state === 'run').length;
    if (!active || (firstFinishT !== null && raceT - firstFinishT > 12) || raceT > 160) endRace();
  }

  function toss(r) {
    r.state = 'tossed';
    const side = Math.sign(r.lane || (Math.random() - 0.5));
    r.toss = { z: 0, vz: 9, lane: r.lane, vl: side * 1.4, rot: 0, spin: side * 9, vd: bull.v * 0.6 };
    r.mover.set('tumble');
    caught.push(r);
    api.sfx('thud'); api.sfx('cheer');
    if (r.real) api.feed.add(`${r.nick} boğaya yakalandı!`, '#FFB3B3');
    const p = screenOf(r, 0.3); if (p.visible) puff(p.x, p.y, 10);
  }

  function finish(r) {
    r.state = 'done'; r.time = raceT; r.place = finishers.length + 1;
    finishers.push(r);
    if (r.place === 1) {
      firstFinishT = raceT;
      api.banners.show('KAZANAN', `${r.nick || 'Koşucu'} · ${fmtTime(raceT)}`, bannerStyle(C.yellow, C.ink));
      api.sfx('bell'); api.sfx('cheer', true);
      api.particles.confetti(W / 2, 900, 120, CONFETTI);
    }
  }

  function puff(x, y, n = 4) {
    for (let i = 0; i < n; i++) dust.push({ x: x + (Math.random() - 0.5) * 50, y: y - Math.random() * 20, vx: (Math.random() - 0.5) * 90, vy: -30 - Math.random() * 50, t: 0, life: 0.7 + Math.random() * 0.5, r: 14 + Math.random() * 16 });
  }


  // ---------- çizim ----------
  function draw(ctx) {
    world.render();
    ctx.clearRect(0, 0, W, H);
    for (const d of dust) {
      ctx.globalAlpha = Math.max(0, 1 - d.t / d.life) * 0.45; ctx.fillStyle = '#E6C79A';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (1 + d.t), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    names(ctx);
    topPanel(ctx);
    ranking(ctx);
    if (phase === 'lobby' || phase === 'count') lobbyOverlay(ctx);
    if (phase === 'results' && results) resultsCard(ctx);
  }

  // koşucu isimleri: başlarının üstünde, uzaklığa göre boyutlanır; çakışan etiket gizlenir
  function names(ctx) {
    // #1 rozeti: bitişe ilk varan, yoksa en öndeki koşucu
    const lead = finishers[0] || [...runners.values()].filter((r) => r.state === 'run').sort((a, b) => b.d - a.d)[0];
    const list = [];
    for (const r of runners.values()) {
      if (!r.real || r.state === 'gone' || r.state === 'tossed') continue;
      const top = screenOf(r, r.h.headTop + 0.35), foot = screenOf(r, 0);
      if (!top.visible || top.y < 330 || top.y > H) continue;
      const px = Math.max(1, foot.y - top.y);
      list.push({ r, x: top.x, y: top.y, px, star: r.star > t, lead: r === lead });
    }
    list.sort((a, b) => b.lead - a.lead || b.star - a.star || b.px - a.px);
    const placed = [];
    for (const o of list) {
      const size = clamp(o.px * 0.1, 15, 30);
      ctx.font = `${o.star || o.lead ? 800 : 700} ${size}px Rubik, system-ui, sans-serif`;
      const label = o.r.nick;
      const tw = ctx.measureText(label).width, badge = o.lead ? size * 1.9 : 0;
      const w = tw + size * 1.3 + badge, h = size * 1.55;
      if (placed.some((p) => Math.abs(p.x - o.x) < (p.w + w) / 2 && Math.abs(p.y - o.y) < (p.h + h) / 2)) continue;
      placed.push({ x: o.x, y: o.y, w, h });
      ctx.fillStyle = o.lead ? 'rgba(30,20,16,0.82)' : o.star ? 'rgba(30,20,16,0.78)' : 'rgba(30,20,16,0.6)';
      ctx.beginPath(); ctx.roundRect(o.x - w / 2, o.y - h / 2, w, h, h / 2); ctx.fill();
      if (o.lead || o.star) { ctx.strokeStyle = C.yellow; ctx.lineWidth = 2.5; ctx.stroke(); }
      if (o.lead) {
        ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.roundRect(o.x - w / 2 + 4, o.y - h / 2 + 4, badge - 4, h - 8, (h - 8) / 2); ctx.fill();
        ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('#1', o.x - w / 2 + 2 + badge / 2, o.y + 1);
      }
      ctx.fillStyle = o.star || o.lead ? '#FFE9A8' : '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, o.x - w / 2 + badge + size * 0.65, o.y + 1);
    }
  }

  // üst panel: yarış no, süre, lider, hediye simgeleri (jeton yok) ve ilerleme çubuğu
  function topPanel(ctx) {
    const x = 30, y = 30, w = W - 60, h = 300;
    ctx.save();
    ctx.fillStyle = 'rgba(24,16,12,0.58)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(242,140,40,0.85)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillStyle = C.yellow; ctx.font = `400 30px ${TITLE_FONT}`;
    ctx.fillText(`YARIŞ ${phase === 'results' && results ? results.no : raceNo}`, x + 26, y + 46);
    const count = [...runners.values()].filter((r) => r.state !== 'gone' && r.state !== 'tossed').length;
    ctx.textAlign = 'right'; ctx.font = `400 26px ${TITLE_FONT}`;
    ctx.fillText(`${count} KOŞUCU`, x + w - 26, y + 46);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `400 50px ${TITLE_FONT}`;
    const big = phase === 'race' ? fmtTime(raceT) : phase === 'results' ? 'BİTTİ' : phase === 'count' ? 'HAZIR' : `LOBİ ${Math.ceil(Math.max(0, phaseT))}`;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeText(big, W / 2, y + 48); ctx.fillText(big, W / 2, y + 48);
    const lead = [...runners.values()].filter((r) => r.state === 'run' || r.state === 'done').sort((a, b) => (a.place || 99) - (b.place || 99) || b.d - a.d)[0];
    ctx.font = '600 24px Rubik, system-ui, sans-serif';
    let sub = phase === 'race' ? (lead ? `Lider: ${lead.nick || 'Koşucu'}` : '') : phase === 'results' ? 'Yeni lobi birazdan' : 'Yorum yaz, yarışa katıl';
    if (phase === 'race' && caught.length) sub += `  ·  ${caught.length} yakalandı`;
    ctx.fillStyle = C.yellow; ctx.fillText(sub, W / 2, y + 92, w - 60);

    // simgeler + eylem adları
    const items = [...api.rules().map((r) => ({ ikon: r.ikon || '🎁', top: ACTION[r.eylem] || (r.etiket || '').toUpperCase(), alt: '' })),
      { ikon: '❤️', top: 'BEĞENİ', alt: 'HIZ' }, { ikon: '➕', top: 'TAKİP', alt: 'TURBO' }].slice(0, 8);
    const cw = (w - 40) / items.length;
    items.forEach((it, i) => {
      const cx = x + 20 + cw * (i + 0.5);
      ctx.font = '46px "Noto Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(it.ikon, cx, y + 150);
      ctx.fillStyle = '#fff'; ctx.font = '800 19px Rubik, system-ui, sans-serif';
      ctx.fillText(it.top, cx, y + 196, cw - 6);
      if (it.alt) { ctx.fillStyle = C.yellow; ctx.font = '700 15px Rubik, system-ui, sans-serif'; ctx.fillText(it.alt, cx, y + 216, cw - 6); }
      ctx.fillStyle = C.yellow;
    });

    // ilerleme çubuğu
    const bx = x + 40, bw = w - 150, by = y + 258;
    const px = (d) => bx + clamp(d / LENGTH, 0, 1) * bw;
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.roundRect(bx, by - 6, bw, 12, 6); ctx.fill();
    const leadD = lead ? lead.d : 0;
    ctx.fillStyle = C.orange; ctx.beginPath(); ctx.roundRect(bx, by - 6, Math.max(12, px(leadD) - bx), 12, 6); ctx.fill();
    for (const r of runners.values()) {
      if (r.state === 'gone' || r.state === 'tossed' || !r.real) continue;
      ctx.fillStyle = r.star > t ? C.yellow : '#fff';
      ctx.beginPath(); ctx.arc(px(r.d), by, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(px(Math.max(0, bull.d)), by, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '800 14px Rubik, system-ui, sans-serif'; ctx.fillText('B', px(Math.max(0, bull.d)), by + 1);
    ctx.textAlign = 'left'; ctx.font = `400 18px ${TITLE_FONT}`; ctx.fillStyle = '#fff';
    ctx.fillText('BİTİŞ', bx + bw + 14, by + 1);
    ctx.restore();
  }

  // sol taraf: sıralama (ilk 6)
  function ranking(ctx) {
    if (phase === 'results') return;
    const list = [...runners.values()].filter((r) => r.state !== 'gone' && r.state !== 'tossed' && (r.real || phase === 'race'))
      .sort((a, b) => (a.place || 99) - (b.place || 99) || b.d - a.d).slice(0, 6);
    if (!list.length) return;
    const x = 30, y = 350, w = 380, rh = 44;
    ctx.save();
    ctx.fillStyle = 'rgba(24,16,12,0.55)'; ctx.beginPath(); ctx.roundRect(x, y, w, 50 + list.length * rh, 20); ctx.fill();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = C.yellow; ctx.font = `400 22px ${TITLE_FONT}`; ctx.fillText('SIRALAMA', x + 18, y + 27);
    list.forEach((r, i) => {
      const yy = y + 52 + i * rh + rh / 2 - 4;
      if (i === 0) { ctx.fillStyle = 'rgba(242,140,40,0.35)'; ctx.beginPath(); ctx.roundRect(x + 8, yy - rh / 2 + 3, w - 16, rh - 6, 12); ctx.fill(); }
      ctx.fillStyle = i === 0 ? C.yellow : i === 1 ? '#D9D9D9' : i === 2 ? '#E0A060' : 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(x + 32, yy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i < 3 ? C.ink : '#fff'; ctx.font = '800 16px Rubik, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x + 32, yy + 1);
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 22px Rubik, system-ui, sans-serif';
      const nick = r.nick || 'Koşucu';
      ctx.fillText(nick.length > 14 ? nick.slice(0, 13) + '…' : nick, x + 56, yy + 1);
      ctx.textAlign = 'right'; ctx.font = '700 20px Rubik, system-ui, sans-serif';
      ctx.fillStyle = r.place ? C.yellow : '#FFD9C2';
      ctx.fillText(r.place ? fmtTime(r.time) : phase === 'race' ? `+${Math.max(0, r.d - bull.d).toFixed(0)} m` : '', x + w - 16, yy + 1);
    });
    ctx.restore();
  }

  function lobbyOverlay(ctx) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (phase === 'count') {
      const n = Math.ceil(phaseT), k = phaseT % 1;
      ctx.globalAlpha = 0.4 + k * 0.6;
      ctx.font = `400 ${200 + (1 - k) * 60}px ${TITLE_FONT}`;
      ctx.lineWidth = 18; ctx.strokeStyle = C.redDark; ctx.strokeText(String(n), W / 2, 960);
      ctx.fillStyle = C.yellow; ctx.fillText(String(n), W / 2, 960);
    } else {
      const y = 720;
      ctx.fillStyle = 'rgba(30,20,16,0.72)'; ctx.beginPath(); ctx.roundRect(W / 2 - 360, y - 70, 720, 150, 24); ctx.fill();
      ctx.fillStyle = C.yellow; ctx.font = `400 50px ${TITLE_FONT}`;
      ctx.fillText(`YARIŞ ${Math.ceil(Math.max(0, phaseT))} SN SONRA`, W / 2, y - 18);
      ctx.fillStyle = '#fff'; ctx.font = '600 30px Rubik, system-ui, sans-serif';
      ctx.fillText('Katılmak için yorum yaz · koşucun başlangıçta yerini alsın', W / 2, y + 42, 680);
    }
    ctx.restore();
  }

  function resultsCard(ctx) {
    const x = 90, y = 640, w = W - 180, rowH = 92;
    const top = results.list.slice(0, 5);
    const h = 230 + Math.max(0, top.length - 1) * rowH + 70;
    ctx.save();
    ctx.fillStyle = 'rgba(30,20,16,0.88)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 28); ctx.fill();
    ctx.strokeStyle = C.yellow; ctx.lineWidth = 4; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.yellow; ctx.font = `400 58px ${TITLE_FONT}`;
    ctx.fillText('YARIŞ SONUCU', W / 2, y + 56);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '600 24px Rubik, system-ui, sans-serif';
    ctx.fillText(`${results.winner ? '' : 'BOĞA KAZANDI · '}YARIŞ ${results.no} · ${results.list.length} KOŞUCU · ${results.caughtCount} YAKALANAN`, W / 2, y + 104, w - 40);
    if (!top.length) { ctx.fillText('Bu turda kimse koşmadı', W / 2, y + 180); ctx.restore(); return; }
    // birinci
    const f = top[0], wy = y + 128;
    ctx.fillStyle = results.winner ? 'rgba(255,210,63,0.22)' : 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.roundRect(x + 30, wy, w - 60, 100, 18); ctx.fill();
    ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(x + 82, wy + 50, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = '800 30px Rubik, system-ui, sans-serif'; ctx.fillText('1', x + 82, wy + 52);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 40px Rubik, system-ui, sans-serif';
    ctx.fillText(f.r.nick || 'Koşucu', x + 130, wy + 34, w - 200);
    ctx.fillStyle = C.yellow; ctx.font = '600 26px Rubik, system-ui, sans-serif';
    const wcount = wins[f.r.id] ? ` · ${wins[f.r.id].wins} galibiyet` : '';
    ctx.fillText(`${f.info}${results.winner ? wcount : ''}`, x + 130, wy + 74);
    top.slice(1).forEach((e, i) => {
      const yy = wy + 112 + i * rowH * 0.8;
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.roundRect(x + 30, yy, w - 60, 62, 14); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(x + 70, yy + 31, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '700 20px Rubik, system-ui, sans-serif'; ctx.fillText(String(i + 2), x + 70, yy + 32);
      ctx.textAlign = 'left'; ctx.font = '600 28px Rubik, system-ui, sans-serif'; ctx.fillText(e.r.nick || 'Koşucu', x + 106, yy + 32, w - 360);
      ctx.textAlign = 'right'; ctx.fillStyle = e.info.startsWith('yakal') ? '#FFB3B3' : C.yellow; ctx.font = '600 24px Rubik, system-ui, sans-serif';
      ctx.fillText(e.info, x + w - 50, yy + 32);
    });
    ctx.textAlign = 'center'; ctx.fillStyle = C.yellow; ctx.font = '600 26px Rubik, system-ui, sans-serif';
    ctx.fillText(`Yeni lobi ${Math.ceil(Math.max(0, phaseT))} sn içinde · tekrar katılmak için yorum yaz`, W / 2, y + h - 34, w - 40);
    ctx.restore();
  }

  return {
    event, update, draw,
    roster: () => [],
    seed() {},
    reset() { nextLobby.clear(); startLobby(); phaseT = LOBBY; },
    resetScores() { for (const k of Object.keys(wins)) delete wins[k]; saveWins(wins); raceNo = 1; saveNum('kosu-yaris-no', 1); },
  };
}

const CONFETTI = ['#D7263D', '#FFD23F', '#FFFFFF', '#3E6FA8', '#5E8C4A'];
function bannerStyle(bg = C.red, color = '#fff') {
  return { bg, color, subColor: color, font: `400 96px ${TITLE_FONT}`, subFont: '600 40px Rubik, system-ui, sans-serif', tilt: -0.03, radius: 18 };
}
function fmtTime(s) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; }
function loadWins() { try { return JSON.parse(localStorage.getItem('kosu-galibiyet') || '{}') || {}; } catch { return {}; } }
function saveWins(w) { try { localStorage.setItem('kosu-galibiyet', JSON.stringify(w)); } catch {} }
function loadNum(k, d) { try { return Number(localStorage.getItem(k)) || d; } catch { return d; } }
function saveNum(k, v) { try { localStorage.setItem(k, String(v)); } catch {} }

