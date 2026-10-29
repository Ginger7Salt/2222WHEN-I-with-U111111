// src/apps/greeting/popupBookModels.js
//
// 跳出式模型的注册表。每个模型是一个函数：
//   builder({ THREE, params, palette }) -> { root, setPop(p), tick(dt, t), pickables, onTap(hit) }
// root 会被挂在"右页正面"的中心（x、z 以页面中心为原点，页面范围约 x ±1、z ±1.3，y 向上）；
// setPop(p) 里 p 从 0（平躺折起）到 1（完全立起）；tick 只在模型立起时才会被调用。
// 模型不认识或构建失败时 buildModel 返回 null，调用方把那一页当纯文字页。
//
// 参数 params 在进入这里之前已经被 popupBookAiService.normalizeModel 校验过，
// 这里仍然只读自己认识的字段。
//
// 已有模型：house（小房子夜景）。

import { SERIF, mkCanvas } from './popupBookPaper';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// 从 delay 开始、持续 dur 的那一段 p，映射成 0..1 再缓动
const stage = (p, delay, dur) => easeInOut(clamp01((p - delay) / dur));

// 固定种子的伪随机：星星位置每次都一样，不会每次翻开都变。
const makeRng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

/* ----------------------------- house：小房子夜景 ----------------------------- */

const drawSky = ({ ink, paper, mute }, w, h, params) => {
  const c = mkCanvas(1024, Math.round((1024 * h) / w));
  const x = c.getContext('2d');
  const cw = c.width;
  const ch = c.height;

  x.fillStyle = ink;
  x.fillRect(0, 0, cw, ch);
  // 一点点渐变，让夜空不是死板的纯色
  const g = x.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, 'rgba(255,255,255,0.07)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, cw, ch);

  // 月亮
  const mx = cw * 0.8;
  const my = ch * 0.24;
  const mr = cw * 0.075;
  x.fillStyle = paper;
  if (params.moon === 'crescent') {
    // 在月亮圆里挖掉一个偏移的圆（evenodd），不会留下和夜空不一样的色块
    x.save();
    x.beginPath();
    x.arc(mx, my, mr, 0, Math.PI * 2);
    x.clip();
    x.beginPath();
    x.rect(0, 0, cw, ch);
    x.arc(mx + mr * 0.5, my - mr * 0.18, mr * 0.88, 0, Math.PI * 2);
    x.fill('evenodd');
    x.restore();
  } else {
    x.beginPath();
    x.arc(mx, my, mr, 0, Math.PI * 2);
    x.fill();
  }

  // 星星：小十字
  const rng = makeRng(20260101 + params.stars * 7);
  x.strokeStyle = paper;
  x.lineCap = 'round';
  for (let i = 0; i < params.stars; i += 1) {
    const sx = cw * (0.08 + rng() * 0.62);
    const sy = ch * (0.08 + rng() * 0.5);
    const r = cw * (0.012 + rng() * 0.014);
    x.lineWidth = 3;
    x.globalAlpha = 0.6 + rng() * 0.4;
    x.beginPath();
    x.moveTo(sx - r, sy);
    x.lineTo(sx + r, sy);
    x.moveTo(sx, sy - r);
    x.lineTo(sx, sy + r);
    x.stroke();
  }
  x.globalAlpha = 1;

  // 一圈细边，和其他纸片的线稿呼应
  x.strokeStyle = mute;
  x.globalAlpha = 0.6;
  x.lineWidth = 4;
  x.strokeRect(6, 6, cw - 12, ch - 12);
  x.globalAlpha = 1;
  return c;
};

const drawLabel = ({ paper, ink, mute }, w, h, text) => {
  const c = mkCanvas(512, Math.round((512 * h) / w));
  const x = c.getContext('2d');
  x.fillStyle = paper;
  x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = mute;
  x.lineWidth = 3;
  x.strokeRect(2, 2, c.width - 4, c.height - 4);
  x.fillStyle = ink;
  x.font = `500 ${Math.round(c.height * 0.5)}px ${SERIF}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, c.width / 2, c.height / 2 + 2, c.width - 24);
  return c;
};

const buildHouse = ({ THREE, params: rawParams, palette }) => {
  const root = new THREE.Group();
  const params = {
    windows: Number(rawParams?.windows) || 2,
    stars: Number.isFinite(Number(rawParams?.stars)) ? Number(rawParams.stars) : 4,
    moon: rawParams?.moon === 'full' ? 'full' : 'crescent',
    label: String(rawParams?.label || ''),
  };

  const lineMat = new THREE.LineBasicMaterial({ color: 0x2b2622, transparent: true, opacity: 0.8 });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xf8f4ea, roughness: 0.95, metalness: 0 });
  const hillMat = new THREE.MeshStandardMaterial({ color: 0xe6dfcd, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.accent), roughness: 0.9 });
  const doorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.ink), roughness: 0.9 });
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0xf8f4ea, roughness: 1, transparent: true, opacity: 0.85 });
  const winOn = new THREE.Color('#fbf1cf');
  const winOff = new THREE.Color('#b9b2a3');

  const edged = (mesh, angle = 25) => {
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, angle), lineMat));
    return mesh;
  };
  const shadowed = (mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  /* 夜空卡：立在最后面 */
  const SKY_W = 1.84;
  const SKY_H = 1.4;
  const sky = new THREE.Group();
  sky.position.set(0, 0, -1.05);
  const skyTex = new THREE.CanvasTexture(drawSky(palette, SKY_W, SKY_H, params));
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyFace = new THREE.MeshBasicMaterial({ map: skyTex });
  const skyMats = [paperMat, paperMat, paperMat, paperMat, skyFace, paperMat];
  const skyMesh = shadowed(new THREE.Mesh(new THREE.BoxGeometry(SKY_W, SKY_H, 0.02), skyMats));
  skyMesh.position.set(0, SKY_H / 2, -0.012);
  skyMesh.receiveShadow = false;
  sky.add(skyMesh);
  root.add(sky);

  /* 小山：一张波浪形上沿的纸片，立在夜空前面 */
  const HILL_H = 0.42;
  const hillShape = new THREE.Shape();
  hillShape.moveTo(-0.95, 0);
  hillShape.lineTo(0.95, 0);
  for (let i = 0; i <= 24; i += 1) {
    const hx = 0.95 - (1.9 * i) / 24;
    hillShape.lineTo(hx, 0.27 + 0.1 * Math.sin(hx * 3.3 + 0.7) + 0.03 * Math.sin(hx * 9));
  }
  hillShape.closePath();
  const hill = new THREE.Group();
  hill.position.set(0, 0, -0.62);
  const hillMesh = shadowed(new THREE.Mesh(new THREE.ExtrudeGeometry(hillShape, { depth: 0.02, bevelEnabled: false }), hillMat));
  hillMesh.position.z = -0.024;
  edged(hillMesh);
  hill.add(hillMesh);
  root.add(hill);

  /* 小房子：立体的，所以收起时把进深压扁，免得穿进纸面 */
  const house = new THREE.Group();
  house.position.set(-0.06, 0, 0.12);
  const houseInner = new THREE.Group();
  house.add(houseInner);

  const BODY_W = 0.8;
  const BODY_H = 0.58;
  const BODY_D = 0.56;
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(BODY_W, BODY_H, BODY_D), paperMat));
  body.position.set(0, BODY_H / 2, 0);
  edged(body);
  houseInner.add(body);

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-0.56, 0);
  roofShape.lineTo(0.56, 0);
  roofShape.lineTo(0, 0.42);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 0.68, bevelEnabled: false });
  roofGeo.translate(0, 0, -0.34);
  const roof = shadowed(new THREE.Mesh(roofGeo, roofMat));
  roof.position.set(0, BODY_H, 0);
  edged(roof);
  houseInner.add(roof);

  const chimney = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), paperMat));
  chimney.position.set(0.25, BODY_H + 0.24, -0.1);
  edged(chimney);
  houseInner.add(chimney);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.31, 0.02), doorMat);
  door.position.set(-0.17, 0.155, BODY_D / 2 + 0.005);
  houseInner.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), new THREE.MeshBasicMaterial({ color: winOn }));
  knob.position.set(-0.12, 0.15, BODY_D / 2 + 0.02);
  houseInner.add(knob);

  // 亮着的窗：第 1 扇在正面右侧，第 2 扇在右侧墙，第 3 扇是山墙上的圆窗
  const winMats = [];
  const pickables = [body];
  const addWindow = (geo, pos, rotY) => {
    const mat = new THREE.MeshBasicMaterial({ color: winOn });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.rotation.y = rotY;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat));
    winMats.push(mat);
    houseInner.add(mesh);
    pickables.push(mesh);
  };
  const windowCount = Math.max(1, Math.min(3, params.windows));
  if (windowCount >= 1) addWindow(new THREE.PlaneGeometry(0.22, 0.22), [0.17, 0.34, BODY_D / 2 + 0.004], 0);
  if (windowCount >= 2) addWindow(new THREE.PlaneGeometry(0.2, 0.2), [BODY_W / 2 + 0.004, 0.34, 0.02], Math.PI / 2);
  if (windowCount >= 3) addWindow(new THREE.CircleGeometry(0.07, 24), [0, BODY_H + 0.15, 0.34 + 0.004], 0);

  // 烟：三个小球，循环上升、变淡
  const puffs = [];
  for (let i = 0; i < 3; i += 1) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), smokeMat.clone());
    puff.userData.phase = i / 3;
    houseInner.add(puff);
    puffs.push(puff);
  }
  root.add(house);

  /* 标牌：房子前面的一小张纸牌 */
  let plaque = null;
  const PL_W = 0.92;
  const PL_H = 0.17;
  if (params.label) {
    plaque = new THREE.Group();
    plaque.position.set(0, 0, 0.95);
    const tex = new THREE.CanvasTexture(drawLabel(palette, PL_W, PL_H, params.label));
    tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.MeshBasicMaterial({ map: tex });
    const mesh = shadowed(new THREE.Mesh(new THREE.BoxGeometry(PL_W, PL_H, 0.012), [paperMat, paperMat, paperMat, paperMat, face, paperMat]));
    mesh.position.set(0, PL_H / 2 + 0.02, -0.01);
    plaque.add(mesh);
    root.add(plaque);
  }

  /* 状态：窗灯开关 + 点一下房子弹一下 */
  let lightsOn = true;
  let bounce = 0; // 1 -> 0
  let smokeT = 0;

  const setPop = (p) => {
    const qSky = stage(p, 0, 0.5);
    const qHill = stage(p, 0.12, 0.5);
    const qHouse = stage(p, 0.3, 0.5);
    const qLabel = stage(p, 0.55, 0.45);

    // 折起时贴在纸面上：每一片错开一点高度，避免叠在一起闪烁
    sky.rotation.x = (Math.PI / 2) * (1 - qSky);
    sky.visible = qSky > 0.01;
    hill.rotation.x = (Math.PI / 2) * (1 - qHill);
    hill.visible = qHill > 0.01;
    skyMesh.position.z = -0.012;
    hillMesh.position.z = -0.036;

    house.rotation.x = (Math.PI / 2) * (1 - qHouse);
    houseInner.scale.z = 0.02 + 0.98 * qHouse;
    house.visible = qHouse > 0.01;

    if (plaque) {
      plaque.rotation.x = (Math.PI / 2) * (1 - qLabel);
      plaque.visible = qLabel > 0.01;
    }
  };

  const tick = (dt, t) => {
    smokeT += dt;
    puffs.forEach((puff) => {
      const k = (smokeT * 0.22 + puff.userData.phase) % 1;
      puff.position.set(0.25 + Math.sin(k * 5 + puff.userData.phase * 6) * 0.05 + k * 0.08, BODY_H + 0.42 + k * 0.42, -0.1);
      const s = 0.55 + k * 0.9;
      puff.scale.setScalar(s);
      puff.material.opacity = 0.85 * (1 - k);
      puff.visible = lightsOn || k < 0.5;
    });
    if (bounce > 0) {
      bounce = Math.max(0, bounce - dt * 2.2);
      const wave = Math.sin((1 - bounce) * Math.PI * 3) * bounce;
      house.scale.set(1 - wave * 0.04, 1 + wave * 0.09, 1 - wave * 0.04);
    } else if (house.scale.y !== 1) {
      house.scale.set(1, 1, 1);
    }
    // 窗灯很轻地呼吸
    if (lightsOn) {
      const glow = 0.96 + Math.sin(t * 2.2) * 0.04;
      winMats.forEach((m) => m.color.copy(winOn).multiplyScalar(glow));
    }
  };

  const onTap = () => {
    lightsOn = !lightsOn;
    bounce = 1;
    winMats.forEach((m) => m.color.copy(lightsOn ? winOn : winOff));
  };

  return { root, setPop, tick, pickables, onTap };
};

const BUILDERS = {
  house: buildHouse,
};

export const buildModel = (name, ctx) => {
  const builder = BUILDERS[name];
  if (!builder) return null;
  try {
    return builder(ctx);
  } catch (error) {
    console.warn('立体书模型构建失败，这一页降级成纯文字：', name, error);
    return null;
  }
};