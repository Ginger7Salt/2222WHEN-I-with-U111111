// src/apps/textgames/skull/skullView.js
//
// 对局界面要显示的“文案和标签”，从引擎状态直接算出来的纯函数：
// - buildHerald：桌子中央宣告圈里的阶段、标题、说明、叫数、翻牌进度；
// - getSeatBids：每个座位头像下面那个“叫 3 / 弃权”的小标签。
// 不碰 DB、不碰 React，所以可以脱离浏览器测试（见 skullView.selftest.mjs）。
// 单独放一个文件，是为了让 useSkullMatch.js 只管时序、SkullGame.jsx 只管
// 渲染，两边都不用夹带一大段文案拼接。

import { PHASE, WINS_TO_WIN, cardsLeft } from './skullEngine.js';

const USER_SEAT = 0;

// 每个座位当前的叫数标签：{ [seat]: { kind: 'bid' | 'pass', text } }。
export const getSeatBids = (game) => {
  const out = {};
  if (!game || !game.bid) return out;
  game.passed.forEach((seat) => {
    out[seat] = { kind: 'pass', text: '弃权' };
  });
  out[game.bid.player] = { kind: 'bid', text: `叫 ${game.bid.count}` };
  return out;
};

const progressOf = (game, failed) => {
  if (!game.bid) return null;
  const total = game.bid.count;
  return Array.from({ length: total }, (_, i) => {
    if (i < game.rosesFlipped) return 1;
    if (failed && i === game.rosesFlipped) return 'bad';
    return 0;
  });
};

const roundOverHerald = (game, nameOf) => {
  const r = game.result;
  const who = nameOf(r.challenger);
  const isUser = r.challenger === USER_SEAT;

  if (r.success) {
    const wins = game.players[r.challenger].wins;
    return {
      phase: '本轮结束',
      title: isUser ? '翻牌成功' : `${who}翻牌成功`,
      desc: `${isUser ? '你' : who}拿到一枚胜利印记（${wins} / ${WINS_TO_WIN}）。`,
      bid: [String(r.bid), '叫的数'],
      progress: progressOf(game, false),
      kind: 'good',
    };
  }

  const owner = nameOf(r.skullOwner);
  const own = r.skullOwner === r.challenger;
  const out = game.players[r.challenger].eliminated;
  const tail = out ? `${isUser ? '你' : who}的牌用光了，被淘汰。` : '';
  return {
    phase: '本轮结束',
    title: isUser ? '翻到了骷髅' : `${who}翻到了骷髅`,
    desc: own
      ? `${isUser ? '你' : who}翻到了自己的骷髅，失去一张牌。${tail}`
      : `${isUser ? '你' : who}翻到了${owner}的骷髅，被抽走一张牌。${tail}`,
    bid: [String(r.bid), '叫的数'],
    progress: progressOf(game, true),
    kind: 'warn',
  };
};

// nameOf(seat)：座位叫什么，用户是“你”。
export const buildHerald = (game, nameOf) => {
  if (!game) return null;

  const cur = game.currentIndex;
  const mine = cur === USER_SEAT;
  const name = nameOf(cur);

  if (game.phase === PHASE.ENDED) {
    const winner = game.winnerIndex;
    const isUser = winner === USER_SEAT;
    return {
      phase: '本局结束',
      title: isUser ? '你赢了这一局' : `${nameOf(winner)}赢了这一局`,
      desc:
        game.endedBy === 'wins'
          ? `${isUser ? '你' : nameOf(winner)}集齐了两枚胜利印记。`
          : `${isUser ? '你' : nameOf(winner)}是最后留在桌上的人。`,
      kind: isUser ? 'good' : '',
    };
  }

  if (game.phase === PHASE.ROUND_OVER) return roundOverHerald(game, nameOf);

  switch (game.phase) {
    case PHASE.PLACING:
      return mine
        ? {
            phase: '放牌阶段',
            title: '轮到你了',
            desc: '选一张手牌扣在面前。每个人都要先放一张。',
            kind: '',
            timer: true,
          }
        : { phase: '放牌阶段', title: `${name}正在放牌`, desc: '每个人都要先放一张。', kind: '' };

    case PHASE.ADDING:
      return mine
        ? {
            phase: '放牌或叫数',
            title: '再放一张，还是开始叫数',
            desc: '叫数就是说出你认为能连续翻开几朵蔷薇。桌上牌的总数是上限。',
            kind: '',
            timer: true,
          }
        : { phase: '放牌或叫数', title: `${name}在想……`, desc: '', kind: '' };

    case PHASE.BIDDING: {
      const bidder = nameOf(game.bid.player);
      const base = {
        phase: '叫数阶段',
        bid: [String(game.bid.count), `${bidder}叫的`],
        kind: '',
      };
      return mine
        ? { ...base, title: '要加价还是弃权', desc: '只能比当前叫数更高，或者弃权。', timer: true }
        : { ...base, title: `${name}在考虑`, desc: '' };
    }

    case PHASE.FLIPPING: {
      const challenger = game.bid.player;
      const mineFlip = challenger === USER_SEAT;
      const ownDone =
        (game.flipped[challenger] || 0) >= game.players[challenger].stack.length;
      const base = {
        phase: '翻牌阶段',
        bid: [String(game.bid.count), mineFlip ? '你要翻开的蔷薇数' : `${nameOf(challenger)}要翻开的蔷薇数`],
        progress: progressOf(game, false),
        kind: 'good',
      };
      if (!mineFlip) {
        return { ...base, title: `${nameOf(challenger)}在翻牌`, desc: `已翻开 ${game.rosesFlipped} / ${game.bid.count}。` };
      }
      return ownDone
        ? {
            ...base,
            title: `已翻开 ${game.rosesFlipped} / ${game.bid.count}`,
            desc: '选一位对手，翻TA面前最上面的牌。',
            timer: true,
          }
        : {
            ...base,
            title: '先翻开你自己的牌',
            desc: '规则：必须先翻完自己面前的牌，才能翻别人的。',
            timer: true,
          };
    }

    case PHASE.DISCARDING:
      return mine
        ? {
            phase: '弃牌',
            title: '选一张牌弃掉',
            desc: '你翻到了自己的骷髅，要永久弃掉一张牌。手牌和桌上的牌都可以选。',
            kind: 'warn',
            timer: true,
          }
        : { phase: '弃牌', title: `${name}在选弃哪张牌`, desc: `${name}翻到了自己的骷髅。`, kind: 'warn' };

    default:
      return null;
  }
};

// 结算时给角色用的小工具：这一局剩几张牌（淘汰的是 0）。
export const getCardCounts = (game) => game.players.map((p, i) => cardsLeft(game, i));