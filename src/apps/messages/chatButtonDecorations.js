// 聊天室按钮贴图/CSS 装饰 —— 发送按钮、「回应」按钮、爪印更多入口按钮
// 三个槏位共用的纯函数文件，不碰 DB。
//
// 数据存在 chat.decorations = { sendButton, respondButton, topButton }，
// 每个字段是用户自己写的一段 CSS 声明文字（不带 selector，只是
// selector { ... } 里面的内容，比如 "background: pink; border-radius: 999px;"），
// 具体包进哪个 selector 由 ChatRoom.jsx 的 decorationStyle 负责。
//
// 用户要的是「CSS 书写为主」，因为比起单纯换图片，写 CSS 还能顺手改
// 颜色、圆角、阴影这些——但从 0 开始手写一段 background-image 的
// base64 对大多数人还是太难了，所以保留一个「上传贴图」小助手按钮：
// 选图之后帮忙压缩转 base64，自动拼成 background-image 声明塞进这段
// CSS 文字里，用户还能接着手动改其它属性。

export const DECORATION_FIELDS = ['sendButton', 'respondButton', 'topButton'];

export const DECORATION_FIELD_LABELS = {
  sendButton: '发送按钮',
  respondButton: '「回应」按钮',
  topButton: '爪印更多入口按钮',
};

// 每次上传新图片，先把旧的 background-image / background-size /
// background-position 声明摘掉，再把新的一组追加到末尾——避免反复
// 上传后文本框里堆满好几条旧的 background-image，同时完全不影响
// 用户自己写的其它声明（颜色、圆角、阴影……）。
export const upsertBackgroundImageDeclaration = (cssText, dataUrl) => {
  const declaration =
    `background-image: url("${dataUrl}");\n`
    + 'background-size: cover;\n'
    + 'background-position: center;';

  const stripped = String(cssText || '')
    .replace(/background-image\s*:\s*[^;]+;?/gi, '')
    .replace(/background-size\s*:\s*[^;]+;?/gi, '')
    .replace(/background-position\s*:\s*[^;]+;?/gi, '')
    .trim();

  return stripped ? `${stripped}\n${declaration}` : declaration;
};

// 三个按钮本身都带着无条件的行内 style（background/color），普通样式
// 规则天生压不过行内样式——跟 chatColorStyle 里颜色选择器那几条规则
// 需要 !important 是同一个原因。用户在文本框里写的是干净的 CSS（不用
// 自己记得加 !important），真正注入 <style> 标签时由这个函数统一在
// 每条声明末尾补上 !important，保证写什么都能生效。
export const forceImportantDeclarations = (cssText) => (
  String(cssText || '')
    .split(';')
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => (/!important\s*$/i.test(decl) ? decl : `${decl} !important`))
    .map((decl) => `${decl};`)
    .join('\n')
);