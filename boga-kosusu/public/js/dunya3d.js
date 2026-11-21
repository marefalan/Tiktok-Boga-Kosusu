// Boğa Koşusu 3B dünyası (Three.js): alçak poligonlu köy yolu, çitler, ağaçlar, seyirciler,
// bloklu koşucular ve boğa. Pist ekseni: mesafe d (m) → z = -d. Şerit (-1..1) → x = şerit × 4.2.
import * as THREE from './vendor/three.module.min.js';

export const ROAD_HALF = 5;
const LANE_X = 4.2;
const SKY_TOP = '#5AA9E6', SKY_BOTTOM = '#CFEAF7';

function rnd(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

export function createWorld(canvas, { length = 400, outW = 1080, outH = 1920, quality = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(Math.round(outW * quality), Math.round(outH * quality), false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(SKY_BOTTOM, 70, 240);

  const camera = new THREE.PerspectiveCamera(52, outW / outH, 0.5, 600);

  // ışıklar
  scene.add(new THREE.HemisphereLight('#DDF0FF', '#6E8B4A', 1.15));
  const sun = new THREE.DirectionalLight('#FFF1DC', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 40, bottom: -40, near: 1, far: 140 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const mats = new Map();
  const mat = (color, opts = {}) => {
    const key = color + JSON.stringify(opts);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...opts }));
    return mats.get(key);
  };

  buildTerrain(scene, length, mat);
  const props = buildProps(scene, length, mat);
  const fans = buildFans(scene, length);

  // ---------- kamera ----------
  const camPos = new THREE.Vector3(0, 8, 20), camLook = new THREE.Vector3(0, 1, 0);
  function setCamera(focusD, aheadM, dt, sway = 0, height = 8.5) {
    const tp = new THREE.Vector3(sway, height, -(focusD + aheadM));
    const tl = new THREE.Vector3(sway * 0.3, 1.0, -(focusD - 5));
    const k = 1 - Math.pow(0.08, dt);
    camPos.lerp(tp, k); camLook.lerp(tl, k);
    camera.position.copy(camPos); camera.lookAt(camLook);
    // güneş gölgesi kamerayı izler
    sun.position.set(camLook.x + 25, 45, camLook.z - 10);
    sun.target.position.set(camLook.x, 0, camLook.z + 5);
  }
  // Kamerayı iki noktayı (yakın: en öndeki koşucu, uzak: boğa) birlikte gösterecek şekilde kur.
  // Kamera yakın noktanın önünde ve yukarıda durur; bakış açısı iki noktanın tam ortasına ayarlanır.
  function frame(nearD, farD, dt, sway = 0) {
    const span = Math.max(8, nearD - farD);
    const back = 9 + span * 0.12, h = 7.5 + span * 0.16;     // grup açıldıkça kamera geri ve yukarı çekilir
    const camD = nearD + back;
    const aNear = Math.atan2(h - 1, back), aFar = Math.atan2(h - 1, back + span);
    const pitch = (aNear + aFar) / 2, lookDist = h / Math.tan(pitch);
    const tp = new THREE.Vector3(sway, h, -camD);
    const tl = new THREE.Vector3(sway * 0.3, 0, -(camD - lookDist));
    const k = 1 - Math.pow(0.02, dt);
    camPos.lerp(tp, k); camLook.lerp(tl, k);
    camera.position.copy(camPos); camera.lookAt(camLook);
    sun.position.set(camLook.x + 25, 45, camLook.z - 10);
    sun.target.position.set(camLook.x, 0, camLook.z + 5);
  }
  function snapCamera() { camera.position.copy(camPos); camera.lookAt(camLook); }

  const v = new THREE.Vector3();
  function project(x, y, z) {
    v.set(x, y, z).project(camera);
    return { x: (v.x + 1) / 2 * outW, y: (1 - v.y) / 2 * outH, visible: v.z < 1 && v.z > -1 };
  }

  return {
    THREE, scene, camera, renderer,
    laneX: (lane) => lane * LANE_X,
    makeRunner: (look) => makeRunner(scene, look, mat),
    makeBull: () => makeBull(scene, mat),
    setGate: (on) => { props.gate.visible = on; },
    setCamera, frame, snapCamera, project,
    update(t, hype) { fans.update(t, hype); props.update(t); },
    render() { renderer.render(scene, camera); },
    // çözünürlük ölçeği (0.5-1): zayıf ekran kartlarında akıcılık için düşürülür
    setQuality(q) { quality = q; renderer.setSize(Math.round(outW * q), Math.round(outH * q), false); },
    get quality() { return quality; },
  };
}

// ---------- gökyüzü ----------
function skyTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, SKY_TOP); gr.addColorStop(0.6, '#9FD3F2'); gr.addColorStop(1, SKY_BOTTOM);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- arazi + yol ----------
function buildTerrain(scene, length, mat) {
  const L = length + 260, startZ = 60;
  // engebeli çimen: yolun iki yanı yükselerek tepelere döner
  const geo = new THREE.PlaneGeometry(260, L, 70, 120);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, startZ - L / 2);
  const pos = geo.attributes.position, colors = [];
  const r = rnd(7), cA = new THREE.Color('#7DBA55'), cB = new THREE.Color('#5E9C40'), cC = new THREE.Color('#9CC86A'), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), ax = Math.abs(x);
    let h = 0;
    if (ax > 7) h = Math.pow((ax - 7) / 30, 1.6) * 9 + Math.sin(z * 0.05 + x * 0.08) * 1.4 * Math.min(1, (ax - 7) / 10) + (r() - 0.5) * 0.6 * Math.min(1, (ax - 7) / 6);
    pos.setY(i, ax < 6.2 ? -0.05 : h);
    tmp.copy(cA).lerp(r() < 0.5 ? cB : cC, r() * 0.7);
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // toprak yol: tekerlek izli doku
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#D9B47E'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${120 + Math.random() * 60},${85 + Math.random() * 40},${45 + Math.random() * 30},${0.12 + Math.random() * 0.2})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4); }
  g.fillStyle = 'rgba(140,100,60,0.22)'; [58, 198].forEach((x) => g.fillRect(x - 10, 0, 20, 256));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, L / 12); tex.anisotropy = 8;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, L), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, startZ - L / 2);
  road.receiveShadow = true;
  scene.add(road);
  // yol kenarı bordürü
  for (const sx of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, L), mat('#B98F5C'));
    curb.position.set(sx * (ROAD_HALF + 0.15), 0.06, startZ - L / 2); curb.receiveShadow = true;
    scene.add(curb);
  }
}

// ---------- yol kenarı nesneleri ----------
function buildProps(scene, length, mat) {
  const r = rnd(42);
  const zEnd = -(length + 200), zStart = 50;
  const dummy = new THREE.Object3D();

  // çit direkleri + raylar
  // dizi boyutu döngüyle birebir aynı sayılır (eksik ayrılırsa fazla direkler bozuk çizilir)
  const postZ = [];
  for (let z = zStart; z > zEnd; z -= 3) postZ.push(z);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 1.25, 0.22), mat('#7A4A24'), postZ.length * 2);
  let i = 0;
  for (const z of postZ) for (const sx of [-1, 1]) {
    dummy.position.set(sx * (ROAD_HALF + 0.7), 0.62, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    posts.setMatrixAt(i++, dummy.matrix);
  }
  posts.count = i; posts.castShadow = true; scene.add(posts);
  for (const sx of [-1, 1]) for (const y of [0.55, 1.05]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, zStart - zEnd), mat('#D9772E'));
    rail.position.set(sx * (ROAD_HALF + 0.7), y, (zStart + zEnd) / 2); rail.castShadow = true;
    scene.add(rail);
  }

  // ağaçlar: çam (iki koni) ve yuvarlak (ikosahedron)
  const N = 520;
  const pineA = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 3.2, 7), mat('#2F7A3B'), N);
  const pineB = new THREE.InstancedMesh(new THREE.ConeGeometry(1.15, 2.4, 7), mat('#3B8E45'), N);
  const round = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.7, 0), mat('#4E9C45'), N);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6), mat('#6B4226'), N * 2);
  let ip = 0, ir = 0, it = 0;
  for (let k = 0; k < N * 1.6; k++) {
    const side = r() < 0.5 ? -1 : 1, x = side * (10 + Math.pow(r(), 0.8) * 70), z = zStart - r() * (zStart - zEnd);
    const ground = Math.pow((Math.abs(x) - 7) / 30, 1.6) * 9;
    const s = 0.8 + r() * 0.9;
    dummy.rotation.set(0, r() * 6, 0);
    dummy.scale.set(s, s, s); dummy.position.set(x, ground + 0.8 * s, z); dummy.updateMatrix();
    if (it < N * 2) trunk.setMatrixAt(it++, dummy.matrix);
    if (r() < 0.6 && ip < N) {
      dummy.position.set(x, ground + 2.9 * s, z); dummy.updateMatrix(); pineA.setMatrixAt(ip, dummy.matrix);
      dummy.position.set(x, ground + 4.3 * s, z); dummy.updateMatrix(); pineB.setMatrixAt(ip, dummy.matrix); ip++;
    } else if (ir < N) {
      dummy.position.set(x, ground + 2.8 * s, z); dummy.updateMatrix(); round.setMatrixAt(ir++, dummy.matrix);
    }
  }
  pineA.count = ip; pineB.count = ip; round.count = ir; trunk.count = it;
  for (const m of [pineA, pineB, round, trunk]) { m.castShadow = true; scene.add(m); }

  // köy evleri: beyaz duvar, kırmızı çatı (yol boyunca ve bitişin ardında)
  const houses = new THREE.Group();
  const addHouse = (x, z, s, rot) => {
    const h = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4 * s, 3 * s, 4 * s), mat('#F6F1E6'));
    body.position.y = 1.5 * s; body.castShadow = true; body.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3 * s, 1.8 * s, 4), mat('#C2553D'));
    roof.position.y = 3.9 * s; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 1.5 * s, 0.1), mat('#6B4226'));
    door.position.set(0, 0.75 * s, 2 * s + 0.05);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 0.8 * s, 0.1), mat('#5B8FB9'));
    win.position.set(1.1 * s, 2 * s, 2 * s + 0.05);
    h.add(body, roof, door, win);
    h.position.set(x, Math.max(0, Math.pow((Math.abs(x) - 7) / 30, 1.6) * 9), z); h.rotation.y = rot;
    houses.add(h);
  };
  for (let z = 20; z > zEnd; z -= 34 + r() * 30) {
    const side = r() < 0.5 ? -1 : 1;
    addHouse(side * (13 + r() * 6), z, 0.9 + r() * 0.4, side > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  for (let k = 0; k < 9; k++) addHouse(-24 + k * 6, -(length + 70 + (k % 3) * 8), 1 + (k % 2) * 0.3, 0);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 12, 3), mat('#F6F1E6')); tower.position.set(4, 6, -(length + 95)); tower.castShadow = true;
  const tRoof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.5, 4), mat('#C2553D')); tRoof.position.set(4, 13.7, -(length + 95)); tRoof.rotation.y = Math.PI / 4;
  houses.add(tower, tRoof);
  scene.add(houses);

  // uzak dağlar
  for (let k = 0; k < 14; k++) {
    const s = 25 + r() * 30, x = -160 + k * 25 + r() * 10;
    const m = new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.1, 6), mat(k % 2 ? '#7FA37A' : '#8DB089'));
    m.position.set(x, s * 0.45, -(length + 230 + r() * 40)); scene.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(s * 0.32, s * 0.35, 6), mat('#F2F5F2'));
    cap.position.set(x, s * 0.45 + s * 0.38, m.position.z); scene.add(cap);
  }

  // başlangıç ve bitiş takları + mesafe tabelaları
  scene.add(arch(0, 'BAŞLANGIÇ', '#3E6FA8', false, mat));
  scene.add(arch(-length, 'BİTİŞ', '#D7263D', true, mat));
  for (let d = 100; d < length; d += 100) scene.add(sign(-d, `${d} m`, mat));

  // ağıl kapısı (lobide kapalı)
  const gate = new THREE.Group();
  for (const y of [0.35, 0.85, 1.35]) { const b = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 + 1.4, 0.18, 0.18), mat('#8B5A2B')); b.position.y = y; b.castShadow = true; gate.add(b); }
  for (let k = 0; k <= 8; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.18), mat('#7A4A24')); p.position.set(-ROAD_HALF - 0.7 + k * ((ROAD_HALF * 2 + 1.4) / 8), 0.8, 0); p.castShadow = true; gate.add(p); }
  gate.position.z = 5;
  scene.add(gate);

  return { gate, update() {} };
}

function textTexture(text, bg, fg, w = 512, h = 96, font = '900 64px Bungee, Rubik, sans-serif') {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4, w - 20);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function arch(z, text, color, finish, mat) {
  const g = new THREE.Group();
  const W = ROAD_HALF * 2 + 1.6;
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), mat(color)); p.position.set(sx * W / 2, 4, 0); p.castShadow = true; g.add(p); }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 1.1, 0.3), [mat(color), mat(color), mat(color), mat(color),
    new THREE.MeshStandardMaterial({ map: textTexture(text, color, '#FFFFFF'), roughness: 0.7 }), new THREE.MeshStandardMaterial({ map: textTexture(text, color, '#FFFFFF'), roughness: 0.7 })]);
  banner.position.y = 8; banner.castShadow = true; g.add(banner);
  if (finish) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 2;
    const x = c.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i, j, 1, 1); }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 1.2), new THREE.MeshStandardMaterial({ map: t }));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.03; line.receiveShadow = true; g.add(line);
  } else {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 0.3), new THREE.MeshStandardMaterial({ color: '#FFFFFF' }));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.03; g.add(line);
  }
  g.position.z = z;
  return g;
}

function sign(z, text, mat) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), mat('#7A4A24')); p.position.y = 1.1; g.add(p);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.1), new THREE.MeshStandardMaterial({ map: textTexture(text, '#FFF6E5', '#1E1410', 256, 112, '800 64px Rubik, sans-serif') }));
  b.position.y = 2.3; b.rotation.y = Math.PI; b.castShadow = true; g.add(b);
  g.position.set(ROAD_HALF + 1.6, 0, z);
  return g;
}

// ---------- seyirciler (çitin ardında, coşunca zıplar) ----------
function buildFans(scene, length) {
  const r = rnd(99), list = [];
  for (let d = -10; d < length + 20; d += 9 + r() * 14) {
    const side = r() < 0.5 ? -1 : 1, n = 3 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) list.push({ x: side * (ROAD_HALF + 1.6 + r() * 2.2), z: -(d + k * 0.9 + r()), ph: r() * 6, h: 0.9 + r() * 0.25 });
  }
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), list.length);
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), list.length);
  const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), new THREE.MeshStandardMaterial({ color: '#F2EFE8', flatShading: true }), list.length);
  const c = new THREE.Color(), shirts = ['#D7263D', '#F6F1E6', '#3E6FA8', '#FFD23F', '#5E8C4A', '#D7263D'], skins = ['#F3D3B8', '#E5B593', '#C98E66', '#9A6342'];
  list.forEach((f, i) => { body.setColorAt(i, c.set(shirts[i % shirts.length])); head.setColorAt(i, c.set(skins[(i * 7) % 4])); });
  for (const m of [body, head, legs]) { m.castShadow = true; scene.add(m); }
  const d = new THREE.Object3D();
  function update(t, hype) {
    list.forEach((f, i) => {
      const j = Math.max(0, Math.sin(t * 7 + f.ph)) * 0.35 * hype;
      d.rotation.set(0, f.x < 0 ? Math.PI / 2 : -Math.PI / 2, 0); d.scale.set(1, 1, 1);
      d.position.set(f.x, 0.3 + j, f.z); d.updateMatrix(); legs.setMatrixAt(i, d.matrix);
      d.position.set(f.x, 1.0 * f.h + j, f.z); d.updateMatrix(); body.setMatrixAt(i, d.matrix);
      d.position.set(f.x, 1.62 * f.h + j, f.z); d.updateMatrix(); head.setMatrixAt(i, d.matrix);
    });
    body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = legs.instanceMatrix.needsUpdate = true;
  }
  update(0, 0.2);
  return { update };
}

// ---------- bloklu koşucu ----------
const faceCache = new Map();
function faceTexture(skin, mood = 'happy') {
  const key = skin + mood;
  if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = skin; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#2A1A14';
  g.beginPath(); g.ellipse(21, 28, 4.5, 6.5, 0, 0, Math.PI * 2); g.ellipse(43, 28, 4.5, 6.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(22.5, 26, 1.6, 0, Math.PI * 2); g.arc(44.5, 26, 1.6, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2A1A14'; g.lineWidth = 3; g.lineCap = 'round';
  if (mood === 'panic') { g.fillStyle = '#5A1E1E'; g.beginPath(); g.ellipse(32, 46, 6, 7, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(14, 17); g.lineTo(26, 20); g.moveTo(50, 17); g.lineTo(38, 20); g.stroke(); }
  else { g.beginPath(); g.arc(32, 40, 10, 0.25, Math.PI - 0.25); g.stroke(); }
  g.fillStyle = 'rgba(230,110,110,0.35)'; g.beginPath(); g.arc(14, 40, 4, 0, Math.PI * 2); g.arc(50, 40, 4, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  faceCache.set(key, t);
  return t;
}

function makeRunner(scene, look, mat) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const box = (w, h, d, color) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.castShadow = true; return m; };
  // bacaklar (kalçadan döner)
  const legs = [-1, 1].map((sx) => {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.2, 0.82, 0);
    const leg = box(0.34, 0.66, 0.36, look.bottom); leg.position.y = -0.33 - 0.08;
    const shoe = box(0.36, 0.16, 0.44, look.shoe); shoe.position.set(0, -0.74, -0.04);
    pivot.add(leg, shoe); body.add(pivot); return pivot;
  });
  const torso = box(0.86, 0.78, 0.44, look.top); torso.position.y = 1.22; body.add(torso);
  if (look.sash) { const s = box(0.9, 0.14, 0.48, look.sash); s.position.y = 0.88; body.add(s); }
  const scarfM = box(0.6, 0.16, 0.5, look.scarf || '#D7263D'); scarfM.position.y = 1.62; body.add(scarfM);
  const tri = box(0.26, 0.26, 0.06, look.scarf || '#D7263D'); tri.position.set(0, 1.5, -0.26); tri.rotation.z = Math.PI / 4; body.add(tri);
  // kollar (omuzdan döner)
  const arms = [-1, 1].map((sx) => {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.58, 1.55, 0);
    const arm = box(0.28, 0.62, 0.3, look.sleeves ? look.top : look.skin); arm.position.y = -0.3;
    const hand = box(0.26, 0.18, 0.28, look.skin); hand.position.y = -0.68;
    pivot.add(arm, hand); body.add(pivot); return pivot;
  });
  // baş: ön yüzde (−z, kameraya bakan) yüz dokusu
  const skinM = mat(look.skin);
  const faceHappy = new THREE.MeshStandardMaterial({ map: faceTexture(look.skin, 'happy'), roughness: 0.8 });
  const facePanic = new THREE.MeshStandardMaterial({ map: faceTexture(look.skin, 'panic'), roughness: 0.8 });
  const headMats = [skinM, skinM, skinM, skinM, skinM, faceHappy];
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), headMats); head.castShadow = true;
  head.position.y = 1.98; body.add(head);
  const hair = box(0.66, 0.16, 0.66, look.hair); hair.position.y = 2.33; body.add(hair);
  if (look.hairStyle === 2) { const back = box(0.66, 0.5, 0.14, look.hair); back.position.set(0, 2.08, 0.3); body.add(back); }
  if (look.hairStyle === 3) { const bun = box(0.3, 0.26, 0.3, look.hair); bun.position.set(0, 2.5, 0.1); body.add(bun); }
  root.rotation.y = 0;   // −z'ye (ileri, kameraya) bakar
  scene.add(root);

  let ph = Math.random() * 6, panicked = false;
  return {
    root,
    headTop: 2.6,
    // mode: 'idle' | 'run' | 'panic' | 'tossed'
    pose(mode, dt, speed = 6) {
      if (mode === 'run' || mode === 'panic') {
        ph += dt * (4 + speed * 0.9);
        const s = Math.sin(ph);
        legs[0].rotation.x = s * 0.85; legs[1].rotation.x = -s * 0.85;
        if (mode === 'panic') {
          arms[0].rotation.set(0, 0, -2.6 - s * 0.25); arms[1].rotation.set(0, 0, 2.6 - s * 0.25);
        } else { arms[0].rotation.set(-s * 0.95, 0, -0.08); arms[1].rotation.set(s * 0.95, 0, 0.08); }
        body.position.y = Math.abs(Math.cos(ph)) * 0.12;
        body.rotation.x = -0.12;
      } else if (mode === 'idle') {
        ph += dt * 2;
        legs[0].rotation.x = legs[1].rotation.x = 0;
        arms[0].rotation.set(0, 0, -0.12 - Math.sin(ph) * 0.05); arms[1].rotation.set(0, 0, 0.12 + Math.sin(ph) * 0.05);
        body.position.y = Math.abs(Math.sin(ph)) * 0.04; body.rotation.x = 0;
      } else if (mode === 'tossed') {
        ph += dt * 10;
        legs[0].rotation.x = Math.sin(ph) * 1.2; legs[1].rotation.x = -Math.sin(ph) * 1.2;
        arms[0].rotation.set(0, 0, -2.2 + Math.sin(ph) * 0.6); arms[1].rotation.set(0, 0, 2.2 - Math.sin(ph) * 0.6);
      }
      const wantPanic = mode === 'panic' || mode === 'tossed';
      if (wantPanic !== panicked) { panicked = wantPanic; headMats[5] = wantPanic ? facePanic : faceHappy; head.material = headMats.slice(); }
    },
    dispose() { scene.remove(root); },
  };
}

// ---------- boğa ----------
function makeBull(scene, mat) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const base = '#3B2418', hi = '#5C3A26', dark = '#1E120C';
  const box = (w, h, d, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); m.castShadow = true; body.add(m); return m; };
  box(1.5, 1.15, 2.5, base, 0, 1.45, 0.15);              // gövde
  box(1.6, 1.0, 1.0, base, 0, 1.75, -0.75);              // omuz kamburu
  box(1.1, 0.35, 0.9, hi, 0, 2.3, -0.7);                 // kambur üstü
  box(1.2, 0.5, 2.0, '#4A2E20', 0, 0.95, 0.15);          // karın
  // baş (ileri, aşağı eğik: hücum)
  const headG = new THREE.Group(); headG.position.set(0, 1.55, -1.4); headG.rotation.x = 0.45; body.add(headG);
  const hb = (w, h, d, color, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); m.castShadow = true; headG.add(m); return m; };
  hb(0.95, 0.85, 0.95, base, 0, 0, -0.35);
  hb(0.8, 0.5, 0.35, '#B98A72', 0, -0.2, -0.9);          // burun
  hb(0.14, 0.14, 0.05, dark, -0.18, -0.18, -1.08); hb(0.14, 0.14, 0.05, dark, 0.18, -0.18, -1.08);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 6, 14), mat('#FFD23F', { metalness: 0.6, roughness: 0.35 })); ring.position.set(0, -0.42, -1.07); headG.add(ring);
  for (const sx of [-1, 1]) {
    hb(0.2, 0.16, 0.05, '#FFFFFF', sx * 0.3, 0.12, -0.83);
    hb(0.1, 0.1, 0.03, '#C21E1E', sx * 0.3, 0.12, -0.86);
    const brow = hb(0.26, 0.07, 0.05, dark, sx * 0.3, 0.26, -0.84); brow.rotation.z = sx * -0.35;
    hb(0.4, 0.16, 0.22, hi, sx * 0.6, 0.18, -0.25);       // kulak
    // boynuz: dışa ve yukarı kıvrılan tüp
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(sx * 0.4, 0.3, -0.4), new THREE.Vector3(sx * 1.25, 0.35, -0.45), new THREE.Vector3(sx * 1.15, 1.05, -0.65));
    const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.1, 6), mat('#EFE3C8')); horn.castShadow = true; headG.add(horn);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), mat('#EFE3C8')); tip.position.set(sx * 1.15, 1.18, -0.68); headG.add(tip);
  }
  // bacaklar
  const legs = [[-0.5, -0.75], [0.5, -0.75], [-0.5, 1.05], [0.5, 1.05]].map(([x, z]) => {
    const p = new THREE.Group(); p.position.set(x, 1.05, z);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.95, 0.36), mat(base)); l.position.y = -0.47; l.castShadow = true;
    const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.42), mat(dark)); hoof.position.y = -0.98;
    p.add(l, hoof); body.add(p); return p;
  });
  // kuyruk
  const tail = new THREE.Group(); tail.position.set(0, 1.95, 1.4); body.add(tail);
  const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5), mat(base)); tl.position.y = -0.55; tail.add(tl);
  const tuft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), mat(dark)); tuft.position.y = -1.15; tail.add(tuft);
  root.scale.setScalar(1.35);
  scene.add(root);
  let ph = 0;
  return {
    root, headTop: 4.1,
    pose(running, dt, speed = 6) {
      ph += dt * (running ? 3 + speed * 0.9 : 2);
      const s = Math.sin(ph);
      if (running) {
        legs[0].rotation.x = s * 0.8; legs[1].rotation.x = s * 0.6; legs[2].rotation.x = -s * 0.8; legs[3].rotation.x = -s * 0.6;
        body.position.y = Math.abs(Math.sin(ph)) * 0.22; body.rotation.x = Math.sin(ph) * 0.06;
        headG.rotation.x = 0.5 + Math.sin(ph) * 0.08;
      } else {
        legs.forEach((l) => (l.rotation.x *= 0.8));
        body.position.y = 0; body.rotation.x = 0;
        headG.rotation.x = 0.25 + Math.sin(ph * 0.7) * 0.1;
        // ön toynakla toprak eşeleme
        legs[0].rotation.x = Math.max(0, Math.sin(ph * 1.5)) * -0.5;
      }
      tail.rotation.z = Math.sin(ph * 1.3) * 0.4; tail.rotation.x = 0.4;
    },
  };
}
