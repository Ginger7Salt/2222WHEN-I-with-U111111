// src/apps/messages/phoneScreen/phoneScreenDirective.js
//
// "角色发自己手机截图"的系统提示词说明。
//
// 跟 chatImageGen/chatImageGenDirective.js 同一个惯例：只有这个聊天窗自己
// 开启了开关（chat.phoneScreenEnabled，chats 表上新增的无索引字段，不需要
// 升级 db.version），AI 才会被告知有这个标签；没开的聊天里这段说明一个字
// 都不会出现。没有冷却/频率限制，什么时候发完全由角色自己判断。
//
// 标签格式的细节和为什么不用 JSON，见 phoneScreenSpec.js 文件头。

export const buildPhoneScreenPromptNote = (chat) => {
  if (chat?.phoneScreenEnabled !== true) return '';

  return `
【可选：发手机截图】
这个聊天窗开启了"手机截图"：你可以像真的截了一张自己手机屏幕发给对方
一样，用下面这个标签（对方只会看到一张手机截图，看不到标签原文）：
[PHONESHOT: lockscreen | 手机风格 | 时间 | 电量 | 壁纸主色 | 通知1 ;; 通知2 ;; 通知3]
- 用竖线 | 分隔，前五项的顺序不能变，第一项固定写 lockscreen（目前只支
  持锁屏通知栏这一种画面）。
- 手机风格：ios 或 android，按角色设定里用的手机来选。
- 时间：24小时制 HH:MM，要跟此刻对话的时间感一致。
- 电量：1到100的整数。
- 壁纸主色：一个十六进制颜色，比如 #3b4a6b，按角色的性格或此刻心情选，
  偏深的颜色更好看。
- 通知：1到6条，条与条之间用 ;; 隔开；每一条写成 应用名::标题::正文，
  还可以在最后再加一项 ::时间（比如 刚刚、5分钟前）。
- 通知内容要符合角色自己的生活和人际关系，不要跟你们当前聊的内容矛盾；
  应用名、标题、正文都用文字写，不要写表情符号。
- 整个标签里面不能出现右方括号 ]。
例：
[PHONESHOT: lockscreen | ios | 23:47 | 18 | #2f3b57 | 微信::妈妈::你到家了吗，记得给我回个电话 ;; 外卖::骑手已送达::您的订单已送达，祝您用餐愉快 ;; 日历::提醒::明天上午九点 项目评审会议::5分钟前]
只在你确实想让对方"看一眼你的手机"的时候用，不要每条回复都发，正常聊天
就好，你自己判断合适的时机，没有次数或冷却限制。
`;
};

export default { buildPhoneScreenPromptNote };
