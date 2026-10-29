// src/apps/greeting/popupBookScene.js
//
// 立体书的 three.js 场景：一本摊开放在桌上的双页书（透视俯视），点封面翻开，
// 左页是文字页，右页是从纸面立起来的小模型。
//
// 这个文件 import 了 three，所以阅读器必须用 import('./popupBookScene') 动态加载，
// 不进主包。基于已确认的参考页 popupbook-v3.html 实现。
//
// 状态：cur = 0 封面；1..n 第 k 个跨页；n+1 末页（合上这一本）。
// 叶（leaf）= 一张可翻的纸/板。叶 k 的正面 = 第 k 个跨页的右页（k >= 1，叶 0 正面是封面），
// 背面 = 第 k+1 个跨页的左页（最后一叶的背面是末页）。

import * as THREE from 'three';
import {
  BH,
  BW,
  PH,
  PW,
  boardBackCanvas,
  buildPageSpecs,
  coverCanvas,
  pageCanvas,
} from './popupBookPaper';
import { buildModel } from './popupBookModels';

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, REDUCED ? 1 : ms));

const disposeObject = (root) => {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
    mats.forEach((mat) => {
      Object.keys(mat).forEach((key) => {
        const value = mat[key];
        if (value && value.isTexture) value.dispose();
      });
      mat.dispose();
    });
  });
};

// book: popupBooks 里的一行；theme: { coverBg, coverFg, coverDark }；
// callbacks: onState(state)、onOpened()。
export const createBookScene = ({ canvas, book, theme, labels, onState, onOpened }) => {
  const palette = book.palette || { ink: '#2b2622', paper: '#f4f0e7', mute: '#8a8175', accent: '#7b7494' };
  const spreads = Array.isArray(book.spreads) ? book.spreads : [];
  const n = spreads.length;
  const leafCount = n + 1;
  const lowPower = Math.min(window.innerWidth, window.innerHeight) < 700;

  /* ---------------- 渲染器 / 相机 / 灯光 ---------------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const target = new THREE.Vector3(0, 0.5, 0.15);
  const orbit = { az: 0, el: (54 * Math.PI) / 180, tAz: 0, tEl: (54 * Math.PI) / 180, dist: 9 };

  scene.add(new THREE.HemisphereLight(0xffffff, 0xe6e3dc, 1.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.25);
  sun.position.set(-3.2, 6.4, 3.4);
  sun.castShadow = true;
  const shadowSize = lowPower ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -4;
  sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -4;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 16;
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 4;
  scene.add(sun);

  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.22 }));
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = -0.002;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  const fit = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needW = PW * 2 + 0.55;
    const needH = 4.35;
    const dW = needW / (2 * tanV * camera.aspect);
    const dH = needH / (2 * tanV);
    orbit.dist = Math.max(dW, dH) * 1.02;
  };

  /* ---------------- 贴图 ---------------- */
  const textures = [];
  const mkTex = (c, rot180) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (rot180) {
      t.center.set(0.5, 0.5);
      t.rotation = Math.PI;
    }
    textures.push(t);
    return t;
  };

  const { leftSpecs, rightSpecs, endSpec } = buildPageSpecs(book);

  /* ---------------- 书 ---------------- */
  const root = new THREE.Group();
  scene.add(root);
  const bookG = new THREE.Group();
  root.add(bookG);

  const boardColor = theme.coverDark ? 0x16161a : 0xe4dfd4;
  const backBoard = new THREE.Mesh(
    new THREE.BoxGeometry(BW, 0.05, BH),
    new THREE.MeshStandardMaterial({ color: boardColor, roughness: 0.7 }),
  );
  backBoard.castShadow = true;
  backBoard.receiveShadow = true;
  backBoard.position.set(BW / 2, 0.025, 0);
  bookG.add(backBoard);

  const sideDark = new THREE.MeshStandardMaterial({ color: theme.coverDark ? 0x17171a : 0xd8d2c4, roughness: 0.7 });
  const sidePaper = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 1 });
  const leafMaterials = (frontTex, backTex, dark) => {
    const side = dark ? sideDark : sidePaper;
    const face = (t, glow) =>
      new THREE.MeshStandardMaterial({
        map: t,
        roughness: 0.95,
        emissive: 0xffffff,
        emissiveMap: t,
        emissiveIntensity: glow,
      });
    return [side, side, face(frontTex, dark && theme.coverDark ? 0 : 0.28), face(backTex, 0.28), side, side];
  };
  const makeLeaf = (w, d, th, mats) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), mats);
    m.position.x = w / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    g.userData.mesh = m;
    return g;
  };

  const leaves = [];
  const coverTheme = { bg: theme.coverBg, fg: theme.coverFg, dark: theme.coverDark };
  const coverTex = mkTex(
    coverCanvas(
      {
        title: book.cover?.title,
        motif: book.cover?.motif,
        sign: book.sign,
        no: `BK.${String(book.id ?? 0).padStart(3, '0')}`,
        kindLabel: labels?.kind || '',
      },
      coverTheme,
    ),
  );
  const firstLeft = leftSpecs[0] || endSpec;
  leaves[0] = makeLeaf(
    BW,
    BH,
    0.04,
    leafMaterials(coverTex, mkTex(boardBackCanvas(firstLeft, palette, theme.coverBg), true), true),
  );
  for (let k = 1; k <= n; k += 1) {
    const front = mkTex(pageCanvas(rightSpecs[k - 1], palette));
    const back = mkTex(pageCanvas(k < n ? leftSpecs[k] : endSpec, palette), true);
    leaves[k] = makeLeaf(PW, PH, 0.02, leafMaterials(front, back, false));
  }
  const yRight = [];
  const yLeft = [];
  for (let i = 0; i < leafCount; i += 1) {
    yRight[i] = 0.04 + (leafCount - i) * 0.035;
    yLeft[i] = 0.025 + i * 0.0375;
  }
  leaves.forEach((l) => bookG.add(l));

  /* ---------------- 跳出式模型（挂在各叶正面） ---------------- */
  const TOP = 0.01;
  const models = []; // models[k] 对应叶 k 的正面（k >= 1）
  for (let k = 1; k <= n; k += 1) {
    const spec = spreads[k - 1]?.right;
    const popRoot = new THREE.Group();
    popRoot.position.set(PW / 2, TOP, 0);
    leaves[k].add(popRoot);
    const made = spec?.model ? buildModel(spec.model, { THREE, params: spec.params, palette, theme }) : null;
    if (made) {
      popRoot.add(made.root);
      made.setPop(0);
    }
    models[k] = made;
  }

  /* ---------------- 状态 / 动画 ---------------- */
  const S = { cur: 0, open: 0, leaf: new Array(leafCount).fill(0), pop: new Array(leafCount).fill(0), busy: false };
  let disposed = false;
  let paused = false;

  const tween = (ms, fn) =>
    new Promise((resolve) => {
      const t0 = performance.now();
      const f = (now) => {
        if (disposed) {
          resolve();
          return;
        }
        const t = Math.min(1, (now - t0) / (REDUCED ? 1 : ms));
        fn(t);
        if (t < 1) requestAnimationFrame(f);
        else resolve();
      };
      requestAnimationFrame(f);
    });
  const animateTo = (key, idx, to, ms) => {
    const from = idx == null ? S[key] : S[key][idx];
    return tween(ms, (t) => {
      const v = from + (to - from) * ease(t);
      if (idx == null) S[key] = v;
      else S[key][idx] = v;
    });
  };

  const applyPose = () => {
    bookG.position.x = (-PW / 2) * (1 - S.open);
    leaves.forEach((l, i) => {
      const e = S.leaf[i];
      l.rotation.z = Math.PI * e;
      l.position.y = yRight[i] + (yLeft[i] - yRight[i]) * e + Math.sin(Math.PI * e) * 0.16;
    });
    for (let k = 1; k <= n; k += 1) {
      const m = models[k];
      if (m) m.setPop(S.pop[k]);
    }
  };

  const labelOf = (cur) => {
    if (cur === 0) return '封面';
    if (cur === n + 1) return '合上';
    return spreads[cur - 1]?.left?.items?.find((it) => it.t === 'h')?.s || `第 ${cur} 页`;
  };
  const emit = () => {
    if (onState) onState({ cur: S.cur, total: n + 2, busy: S.busy, label: labelOf(S.cur) });
  };

  const popUp = async (k) => {
    if (!models[k]) return;
    await sleep(150);
    await animateTo('pop', k, 1, 1100);
  };
  const popDown = async (k) => {
    if (!models[k] || S.pop[k] === 0) return;
    await animateTo('pop', k, 0, 650);
  };

  const openCover = async () => {
    await Promise.all([animateTo('open', null, 1, 1500), animateTo('leaf', 0, 1, 1500)]);
    await popUp(1);
  };
  const closeCover = async () => {
    for (let k = 1; k <= n; k += 1) await popDown(k);
    await Promise.all([animateTo('leaf', 0, 0, 1500), animateTo('open', null, 0, 1500)]);
  };

  // 翻过第 k 叶（从 spread k 到 k+1，或到末页）
  const turnForward = async (k) => {
    await popDown(k);
    await animateTo('leaf', k, 1, 1500);
    if (k + 1 <= n) await popUp(k + 1);
  };
  const turnBack = async (k) => {
    if (k + 1 <= n) await popDown(k + 1);
    await animateTo('leaf', k, 0, 1500);
    await popUp(k);
  };

  const step = async (dir) => {
    if (S.busy || disposed) return;
    S.busy = true;
    try {
      if (dir > 0) {
        if (S.cur === 0) {
          S.cur = 1;
          emit();
          if (onOpened) onOpened();
          await openCover();
        } else if (S.cur <= n) {
          const k = S.cur;
          S.cur += 1;
          emit();
          await turnForward(k);
        } else {
          // 末页 -> 依次翻回并合上
          S.cur = 0;
          emit();
          for (let k = n; k >= 1; k -= 1) await animateTo('leaf', k, 0, 700);
          await closeCover();
        }
      } else if (S.cur === 0) {
        // 已经是封面
      } else if (S.cur === 1) {
        S.cur = 0;
        emit();
        await closeCover();
      } else {
        const k = S.cur - 1;
        S.cur -= 1;
        emit();
        await turnBack(k);
      }
    } finally {
      S.busy = false;
      if (!disposed) emit();
    }
  };

  /* ---------------- 输入：轨道旋转 / 点击 ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const setNdc = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  let down = null;
  const onDown = (e) => {
    setNdc(e);
    down = { x: e.clientX, y: e.clientY, az: orbit.tAz, el: orbit.tEl, moved: false };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* 部分环境不支持 */
    }
  };
  const onMove = (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 6) down.moved = true;
    orbit.tAz = Math.max(-0.5, Math.min(0.5, down.az - dx * 0.004));
    orbit.tEl = Math.max(0.66, Math.min(1.25, down.el + dy * 0.004));
  };
  const onUp = (e) => {
    if (!down) return;
    if (!down.moved) {
      setNdc(e);
      if (S.cur === 0) {
        if (ray.intersectObject(leaves[0], true)[0]) step(1);
      } else {
        const m = models[S.cur];
        if (m && m.onTap && m.pickables) {
          const hit = ray.intersectObjects(m.pickables, true)[0];
          if (hit) m.onTap(hit);
        }
      }
    }
    down = null;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  const onLost = (e) => {
    e.preventDefault();
    paused = true;
  };
  const onRestored = () => {
    paused = false;
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  window.addEventListener('resize', fit);

  /* ---------------- 主循环 ---------------- */
  let raf = 0;
  let lastT = performance.now();
  const frame = (now) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - lastT) / 1000);
    lastT = now;
    if (paused || document.hidden) return;
    orbit.az += (orbit.tAz - orbit.az) * 0.12;
    orbit.el += (orbit.tEl - orbit.el) * 0.12;
    camera.position.set(
      target.x + orbit.dist * Math.sin(orbit.az) * Math.cos(orbit.el),
      target.y + orbit.dist * Math.sin(orbit.el),
      target.z + orbit.dist * Math.cos(orbit.az) * Math.cos(orbit.el),
    );
    camera.lookAt(target);
    applyPose();
    for (let k = 1; k <= n; k += 1) {
      const m = models[k];
      if (m && m.tick && S.pop[k] > 0.01) m.tick(dt, now / 1000);
    }
    renderer.render(scene, camera);
  };

  fit();
  emit();
  raf = requestAnimationFrame(frame);

  const dispose = () => {
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', fit);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    models.forEach((m) => m && m.dispose && m.dispose());
    disposeObject(scene);
    textures.forEach((t) => t.dispose());
    [sideDark, sidePaper].forEach((m) => m.dispose());
    renderer.dispose();
    try {
      renderer.forceContextLoss();
    } catch (_) {
      /* 已经丢失 */
    }
  };

  return {
    step,
    dispose,
    // 给自动化验证用：直接读/写内部状态。
    debug: { S, orbit, camera, leaves },
  };
};
