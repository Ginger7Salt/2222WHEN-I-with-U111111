import React, { useEffect, useRef, useState } from 'react';
import { Check, Lock, Shirt, Sparkles, UtensilsCrossed } from 'lucide-react';

import { COMPANION_STAT_LABELS, FOOD_TIERS, SHOP_CLEAN_ITEMS, SHOP_CLOTHING_ITEMS, SHOP_FOOD_ITEMS, SHOP_TOOL_ITEMS, SHOP_TOY_ITEMS } from './companionShopData';
import CompanionHeartIcon from './CompanionHeartIcon';

const TIER_LABELS = {
  [FOOD_TIERS.COMMON]: null,
  [FOOD_TIERS.RARE]: '稀有',
  [FOOD_TIERS.LEGENDARY]: '传说',
};

const describeEffects = (effects) => (
  Object.entries(effects || {})
    .filter(([, value]) => value)
    .map(([key, value]) => `${COMPANION_STAT_LABELS[key] || key} +${value}`)
    .join(' · ')
);

const KEEPER_GREETING = '欢迎光临～想带点什么回去？';

// 商品图：有 url 就用图，没有就先放一个图标占位
const ItemPicture = ({ item, kind }) => {
  if (item.url) return <img src={item.url} alt="" />;
  if (kind === 'clothing') return <Shirt className="cp-ic" />;
  return <UtensilsCrossed className="cp-ic" />;
};

/*
 * 商店：一个小摊。
 *   - 顶部是遮阳棚，宠物当店员，用对话气泡跟你说话；
 *   - 商品是漂浮的大气泡，点一下选中，下面的"柜台"里看详情再买；
 *   - 食物分三档（普通/稀有/传说），衣服还是老样子：
 *       稀有：没解锁就带锁、不能买；
 *       传说：不在货架上卖，单独列在"传说库存"里，只能用已有库存"吃掉"，库存为 0 就不显示。
 *
 * shopkeeperUrl / shopkeeperName 是可选的新 prop，只用来显示店员头像，不传也能正常用。
 */
const CompanionShopModal = ({
  hearts,
  ownedClothingIds,
  unlockedRareFoodIds = [],
  unlockedRareCleanIds = [],
  unlockedRareToyIds = [],
  legendaryStock = {},
  onBuy,
  onUseLegendary,
  onBuyTool,         // (itemId) => Promise — 购买道具（冻结卡）的回调
  onClose,
  shopkeeperUrl = '',
  shopkeeperName = '',
}) => {
  const [tab, setTab] = useState('food');
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // { id, source: 'shop' | 'legendary' }
  const [keeperLine, setKeeperLine] = useState(KEEPER_GREETING);
  const [poppingId, setPoppingId] = useState(null);
  const popTimerRef = useRef(null);

  useEffect(() => () => {
    if (popTimerRef.current) window.clearTimeout(popTimerRef.current);
  }, []);

  const list = tab === 'food'
    ? SHOP_FOOD_ITEMS.filter((item) => item.tier !== FOOD_TIERS.LEGENDARY)
    : tab === 'clothing'
      ? SHOP_CLOTHING_ITEMS
      : [...SHOP_TOOL_ITEMS, ...SHOP_CLEAN_ITEMS, ...SHOP_TOY_ITEMS];

  const legendaryOwned = SHOP_FOOD_ITEMS.filter(
    (item) => item.tier === FOOD_TIERS.LEGENDARY && (legendaryStock[item.id] || 0) > 0
  );

  // 不同类别的稀有商品解锁状态，分别查各自独立的字段，不混用。
  const isRareLocked = (item) => {
    if (item.tier !== FOOD_TIERS.RARE) return false;
    if (item.category === 'clean') return !unlockedRareCleanIds.includes(item.id);
    if (item.category === 'toy') return !unlockedRareToyIds.includes(item.id);
    return !unlockedRareFoodIds.includes(item.id);
  };

  // 一个商品当前的状态：已拥有 / 稀有未解锁 / 买不起
  const getFlags = (item, source = 'shop') => {
    if (source === 'legendary') {
      return { owned: false, locked: false, canAfford: true };
    }
    return {
      owned: tab === 'clothing' && ownedClothingIds.includes(item.id),
      // 道具（含清洁/玩具）可叠加购买，不判断 owned；只有食物 tab 的
      // 稀有锁要看，clean/toy 商品不管在哪个 tab 展示，稀有锁都要判断。
      locked: (tab === 'food' || item.category === 'clean' || item.category === 'toy') && isRareLocked(item),
      canAfford: hearts >= item.price,
    };
  };

  const selectedItem = !selected ? null : (
    selected.source === 'legendary'
      ? legendaryOwned.find((item) => item.id === selected.id)
      : list.find((item) => item.id === selected.id)
  ) || null;

  const handleSelect = (item, source = 'shop') => {
    const { owned, locked, canAfford } = getFlags(item, source);
    const effects = describeEffects(item.effects);

    setSelected({ id: item.id, source });
    setError('');

    if (source === 'legendary') {
      setKeeperLine(`${item.name}～${effects}，要现在吃掉吗？`);
    } else if (locked) {
      setKeeperLine('这个要先触发特殊事件才能解锁哦。');
    } else if (owned) {
      setKeeperLine(`${item.name}你已经有啦，穿上它会更可爱～`);
    } else if (!canAfford) {
      setKeeperLine('心心还差一点点……再攒攒吧。');
    } else {
      setKeeperLine(effects ? `${item.name}：${effects}。要带一个吗？` : `${item.name}，要带一个吗？`);
    }
  };

  const handleSwitchTab = (nextTab) => {
    if (nextTab === tab) return;
    setTab(nextTab);
    setSelected(null);
    setError('');
    setKeeperLine(KEEPER_GREETING);
  };

  const popBubble = (id) => {
    setPoppingId(id);
    if (popTimerRef.current) window.clearTimeout(popTimerRef.current);
    popTimerRef.current = window.setTimeout(() => setPoppingId(null), 700);
  };

  const handleBuy = async (item) => {
    setPendingId(item.id);
    setError('');
    try {
      await onBuy(item.id);
      popBubble(item.id);
      setKeeperLine('谢谢惠顾，欢迎再来～');
    } catch (buyError) {
      setError(buyError.message || '购买失败');
    } finally {
      setPendingId(null);
    }
  };

  const handleUseLegendary = async (item) => {
    setPendingId(item.id);
    setError('');
    try {
      await onUseLegendary(item.id);
      popBubble(item.id);
      setKeeperLine('吃得真香，它看起来超满足～');
    } catch (useError) {
      setError(useError.message || '使用失败');
    } finally {
      setPendingId(null);
    }
  };

  const handleBuyTool = async (item) => {
    if (!onBuyTool) return;
    setPendingId(item.id);
    setError('');
    try {
      await onBuyTool(item.id);
      popBubble(item.id);
      setKeeperLine('冻结卡到手啦，签到断了也不怕～');
    } catch (toolError) {
      setError(toolError.message || '购买失败');
    } finally {
      setPendingId(null);
    }
  };

  // 一个漂浮的商品气泡
  const renderOrb = (item, index, source = 'shop') => {
    const { owned, locked, canAfford } = getFlags(item, source);
    const isLegendary = source === 'legendary';
    const isRare = item.tier === FOOD_TIERS.RARE;
    const isSelected = selected?.id === item.id && selected?.source === source;

    const className = [
      'cp-orb',
      isLegendary ? 'is-legendary' : isRare ? 'is-rare' : '',
      isSelected ? 'is-selected' : '',
      locked ? 'is-locked' : '',
      !isLegendary && !owned && !locked && !canAfford ? 'cant' : '',
      poppingId === item.id ? 'is-popping' : '',
    ].filter(Boolean).join(' ');

    return (
      <button
        key={`${source}-${item.id}`}
        type="button"
        className={className}
        style={{ '--i': index }}
        onClick={() => handleSelect(item, source)}
        aria-pressed={isSelected}
        aria-label={item.name}
      >
        <span className="cp-orb-ball">
          <span className="cp-orb-face">
            <ItemPicture item={item} kind={tab} />
          </span>

          {locked && <span className="cp-orb-badge lock"><Lock className="cp-ic" /></span>}
          {owned && <span className="cp-orb-badge own"><Check className="cp-ic" /></span>}
          {isLegendary && <span className="cp-orb-badge stock">×{legendaryStock[item.id]}</span>}

          {!isLegendary && !owned && !locked && (
            <span className="cp-orb-price">
              {item.price}
              <CompanionHeartIcon className="cp-heart-ic" />
            </span>
          )}
        </span>
        <span className="cp-orb-name">{item.name}</span>
      </button>
    );
  };

  const keeperText = error || keeperLine;

  // 柜台里的详情 + 购买按钮
  const renderCounter = () => {
    if (!selectedItem) {
      return <p className="cp-counter-hint">点一个泡泡，看看它是什么～</p>;
    }

    const source = selected.source;
    const { owned, locked, canAfford } = getFlags(selectedItem, source);
    const tierLabel = source === 'legendary'
      ? TIER_LABELS[FOOD_TIERS.LEGENDARY]
      : (tab === 'food' ? TIER_LABELS[selectedItem.tier] : null);

    return (
      <>
        <span className="cp-thumb">
          <ItemPicture item={selectedItem} kind={tab} />
        </span>

        <div className="cp-counter-info">
          <p className="cp-counter-name">
            {selectedItem.name}
            {tierLabel && <span className="cp-tier">{tierLabel}</span>}
          </p>
          <p className="cp-counter-fx">
            {locked
              ? '先触发特殊事件解锁'
              : (selectedItem.description || describeEffects(selectedItem.effects) || (tab === 'clothing' ? '给它换个新造型' : ''))}
          </p>
        </div>

        {source === 'legendary' ? (
          <button
            type="button"
            disabled={pendingId === selectedItem.id}
            onClick={() => handleUseLegendary(selectedItem)}
            className="cp-buy"
          >
            吃掉
          </button>
        ) : selectedItem.category === 'freeze-card' ? (
          <button
            type="button"
            disabled={!canAfford || pendingId === selectedItem.id}
            onClick={() => handleBuyTool(selectedItem)}
            className="cp-buy"
          >
            {!canAfford ? (
              '心心不足'
            ) : (
              <>
                {selectedItem.price}
                <CompanionHeartIcon className="cp-heart-ic" />
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={owned || locked || !canAfford || pendingId === selectedItem.id}
            onClick={() => handleBuy(selectedItem)}
            className="cp-buy"
          >
            {owned ? (
              '已拥有'
            ) : locked ? (
              <Lock className="cp-ic" />
            ) : (
              <>
                {selectedItem.price}
                <CompanionHeartIcon className="cp-heart-ic" />
              </>
            )}
          </button>
        )}
      </>
    );
  };

  return (
    <div className="cp-overlay">
      <div className="cp-backdrop" onClick={onClose} />

      <div className="cp-panel bottom cp-stall">
        {/* 遮阳棚 */}
        <div className="cp-awning">
          <span className="cp-heart-pill cp-stall-hearts">
            <CompanionHeartIcon className="cp-heart-ic" />
            {hearts}
          </span>
        </div>

        {/* 店员 + 说话气泡 */}
        <div className="cp-keeper">
          <span className="cp-keeper-avatar" title={shopkeeperName || undefined}>
            {shopkeeperUrl ? <img src={shopkeeperUrl} alt={shopkeeperName} /> : <Sparkles className="cp-ic" />}
          </span>
          <p className={`cp-keeper-say ${error ? 'is-error' : ''}`}>
            <span key={keeperText}>{keeperText}</span>
          </p>
        </div>

        {/* 两块挂牌：食物 / 衣服 */}
        <div className="cp-signs">
          {[{ id: 'food', label: '食物' }, { id: 'clothing', label: '衣服' }, { id: 'tools', label: '道具' }].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSwitchTab(option.id)}
              className={`cp-sign ${tab === option.id ? 'is-on' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* 漂浮的商品气泡 */}
        <div className="cp-bubbles">
          {list.map((item, index) => renderOrb(item, index))}

          {tab === 'food' && legendaryOwned.length > 0 && (
            <>
              <p className="cp-legend-title">
                <Sparkles className="cp-ic" />
                传说库存（只能靠事件获得）
              </p>
              {legendaryOwned.map((item, index) => renderOrb(item, index, 'legendary'))}
            </>
          )}
        </div>

        {/* 柜台：选中商品的详情 */}
        <div className="cp-counter">{renderCounter()}</div>

        <button type="button" className="cp-close-link" onClick={onClose}>
          先逛到这里
        </button>
      </div>
    </div>
  );
};

export default CompanionShopModal;