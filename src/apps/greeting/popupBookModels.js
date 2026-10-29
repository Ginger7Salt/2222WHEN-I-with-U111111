// src/apps/greeting/popupBookModels.js
//
// 跳出式模型的注册表。每个模型是一个函数：
//   build({ THREE, params, palette, helpers }) -> { root, setPop(p), tick(dt, now), pickables, onTap(hit) }
// root 会被挂在"右页正面"的中心；setPop(p) 里 p 从 0（平躺折起）到 1（完全立起）。
// 模型不认识（或还没实现）时 buildModel 返回 null，调用方把那一页当纯文字页。
//
// 第一刀的阅读器骨架还没有任何模型；下一刀在这里加 house（小房子夜景）。

const BUILDERS = {};

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
