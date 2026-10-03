// 和好券面板 — 2026-10 magazine editorial 版本
//
// 标签结构：
//   [ISSUE] 写一张 — 选模板 / 自由文本 → 吐票机动效 → 飞走
//   [ARCHIVE] 券夹 — 只看角色发给用户的券；支持朱砂盖章兑现
//
// 数据流：
//   用户发出的券通过 onSendCoupon 写成真实聊天消息（sender:'user'），
//   不在券夹里展示；
//   券夹只展示 sender:'character' 的券（listCouponsForChat 已按此过滤）。
//   AI 知道自己持有多少张：aiService.js 的 couponPromptBlock 注入。

import React, { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import { listCouponsForChat, redeemCoupon } from './couponService';
import { COUPON_TEMPLATES } from './couponTypes';
import './coupon.css';

const TICKET_HOLD_MS = 2200;
const TICKET_FLY_MS  = 560;

// 极简条形码 SVG（纯装饰）
const BarcodeSVG = () => (
  <svg className="coupon-barcode" viewBox="0 0 60 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0"  width="2"  height="18" fill="currentColor"/>
    <rect x="4"  width="1"  height="18" fill="currentColor"/>
    <rect x="7"  width="3"  height="18" fill="currentColor"/>
    <rect x="12" width="1"  height="18" fill="currentColor"/>
    <rect x="15" width="2"  height="18" fill="currentColor"/>
    <rect x="19" width="1"  height="18" fill="currentColor"/>
    <rect x="22" width="4"  height="18" fill="currentColor"/>
    <rect x="28" width="1"  height="18" fill="currentColor"/>
    <rect x="31" width="2"  height="18" fill="currentColor"/>
    <rect x="35" width="1"  height="18" fill="currentColor"/>
    <rect x="38" width="3"  height="18" fill="currentColor"/>
    <rect x="43" width="1"  height="18" fill="currentColor"/>
    <rect x="46" width="2"  height="18" fill="currentColor"/>
    <rect x="50" width="1"  height="18" fill="currentColor"/>
    <rect x="53" width="3"  height="18" fill="currentColor"/>
    <rect x="58" width="2"  height="18" fill="currentColor"/>
  </svg>
);

export const CouponWalletPanel = ({ isOpen, onClose, chatId, character, onSendCoupon }) => {
  const [activeTab,        setActiveTab]        = useState('create');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [freeText,         setFreeText]         = useState('');
  const [previewVisible,   setPreviewVisible]   = useState(false);
  const [previewFlying,    setPreviewFlying]    = useState(false);
  const [isSending,        setIsSending]        = useState(false);
  const [sentNotice,       setSentNotice]       = useState(false);
  const [coupons,          setCoupons]          = useState([]);
  const [stampingId,       setStampingId]       = useState(null);

  const reload = async () => {
    const list = await listCouponsForChat(chatId);
    setCoupons(list);
  };

  useEffect(() => {
    if (!isOpen || !chatId) return;

    setActiveTab('create');
    setSelectedTemplate(null);
    setFreeText('');
    setPreviewVisible(false);
    setPreviewFlying(false);
    setSentNotice(false);

    void reload();
  }, [isOpen, chatId]);

  if (!isOpen) return null;

  const previewTitle = selectedTemplate || (freeText.trim() ? '自定义券' : '');
  const previewNote  = freeText.trim()
    || (selectedTemplate ? `兑换一次${selectedTemplate.replace('券', '')}时间。` : '');

  const canSend = Boolean(selectedTemplate || freeText.trim()) && !isSending;

  const handleSend = async () => {
    if (!canSend) return;

    const title = selectedTemplate || '自定义券';
    const note  = freeText.trim() || `兑换一次${title.replace('券', '')}时间。`;

    setIsSending(true);
    setSentNotice(false);
    setPreviewFlying(false);
    setPreviewVisible(true);

    await onSendCoupon?.({ title, note });

    window.setTimeout(() => {
      setPreviewFlying(true);

      window.setTimeout(() => {
        setPreviewVisible(false);
        setPreviewFlying(false);
        setSelectedTemplate(null);
        setFreeText('');
        setIsSending(false);
        setSentNotice(true);
      }, TICKET_FLY_MS);
    }, TICKET_HOLD_MS);
  };

  const handleRedeem = async (item) => {
    if (item.status !== 'pending') return;

    const key = `${item.source}-${item.id}`;
    setStampingId(key);

    window.setTimeout(async () => {
      await redeemCoupon(item);
      await reload();
      setStampingId(null);
    }, 520);
  };

  const pendingCount  = coupons.filter((c) => c.status === 'pending').length;
  const redeemedCount = coupons.filter((c) => c.status === 'redeemed').length;

  const todayStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <div className="coupon-overlay">
      {/* 弥散光斑背景 */}
      <div className="coupon-diffuse" aria-hidden="true">
        <div className="coupon-orb coupon-orb--1" />
        <div className="coupon-orb coupon-orb--2" />
      </div>

      {/* 可滚动区域 */}
      <div className="coupon-scroll-root">
        <div className="coupon-magazine-card">
          {/* 印刷对位十字标 */}
          <div className="coupon-crop coupon-crop--tl" aria-hidden="true" />
          <div className="coupon-crop coupon-crop--tr" aria-hidden="true" />
          <div className="coupon-crop coupon-crop--bl" aria-hidden="true" />
          <div className="coupon-crop coupon-crop--br" aria-hidden="true" />

          {/* -------- MASTHEAD -------- */}
          <div className="coupon-masthead">
            <div className="coupon-masthead-index">
              <span>COLLECTION N°01 · MAKE-UP SERIES</span>
              <span>{todayStr}</span>
            </div>

            <div className="coupon-masthead-main">
              <div className="coupon-masthead-title-wrap">
                <div className="coupon-masthead-cn">和好券</div>
                <div className="coupon-masthead-latin">make-up coupon · édition spéciale</div>
              </div>

              <button
                type="button"
                className="coupon-masthead-close"
                onClick={onClose}
                aria-label="关闭"
              >
                <X size={14} strokeWidth={1.8} />
              </button>
            </div>

            <div className="coupon-masthead-recipient">
              致&nbsp;<strong>{character?.name || '对方'}</strong>，一张用心的券
            </div>
          </div>

          {/* -------- TAB SWITCHER -------- */}
          <div className="coupon-nav-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'create'}
              className={`coupon-mag-tab ${activeTab === 'create' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              ✦ ISSUE
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'wallet'}
              className={`coupon-mag-tab ${activeTab === 'wallet' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('wallet')}
            >
              ◈ ARCHIVE
            </button>
          </div>

          {/* ======================================================
              ISSUE TAB — 写一张
          ====================================================== */}
          {activeTab === 'create' && (
            <div key="create" className="coupon-pane">
              <div className="coupon-edition-label">挑一个模板</div>

              <div className="coupon-chips-grid">
                {COUPON_TEMPLATES.map((template) => (
                  <button
                    key={template}
                    type="button"
                    className={`coupon-editorial-chip ${selectedTemplate === template ? 'is-active' : ''}`}
                    onClick={() => setSelectedTemplate(
                      selectedTemplate === template ? null : template
                    )}
                  >
                    {template}
                  </button>
                ))}
              </div>

              <div className="coupon-edition-label">或者自己写</div>

              <textarea
                className="coupon-editorial-textarea"
                placeholder="这张券可以兑换一次……（留空则用模板默认描述）"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={3}
              />

              <button
                type="button"
                className="coupon-submit-btn"
                disabled={!canSend}
                onClick={handleSend}
              >
                {isSending ? '正在送出…' : '发出这张券'}
              </button>

              {sentNotice && (
                <div className="coupon-sent-whisper">
                  已送到 {character?.name || '对方'} 的聊天记录里，关掉面板就能看到。
                </div>
              )}

              {/* 吐票机 */}
              <div className="coupon-press-area">
                <div className="coupon-press-badge">PRINTING SLOT</div>
                <div className="coupon-press-slit" />

                <div
                  className={[
                    'coupon-paper-ticket',
                    !previewVisible           ? 'is-hidden'   : '',
                    previewVisible && !previewFlying ? 'is-printing' : '',
                    previewFlying             ? 'is-flying'   : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="coupon-ticket-eyebrow">
                    <span>TO · {character?.name || '对方'}</span>
                    <span>HANDMADE</span>
                  </div>

                  <div className="coupon-ticket-heading">
                    {previewTitle || '新的一张券'}
                  </div>

                  <div className="coupon-ticket-perforation" />

                  <div className="coupon-ticket-body">
                    {previewNote || '选个模板或者自己写点内容'}
                  </div>

                  <div className="coupon-ticket-colophon">
                    <span>{todayStr}</span>
                    <BarcodeSVG />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================
              ARCHIVE TAB — 券夹
          ====================================================== */}
          {activeTab === 'wallet' && (
            <div key="wallet" className="coupon-pane">
              <div className="coupon-wallet-preface">
                这里收着 {character?.name || '对方'} 发给你的券。
                你自己发出的券在聊天记录里都能看到。
              </div>

              <div className="coupon-tally-bar">
                <div className="coupon-tally-item">
                  <div className="coupon-tally-title">PENDING</div>
                  <div className="coupon-tally-count">{pendingCount}</div>
                </div>
                <div className="coupon-tally-item">
                  <div className="coupon-tally-title">REDEEMED</div>
                  <div className="coupon-tally-count">{redeemedCount}</div>
                </div>
                <div className="coupon-tally-item">
                  <div className="coupon-tally-title">TOTAL</div>
                  <div className="coupon-tally-count">{coupons.length}</div>
                </div>
              </div>

              {coupons.length > 0 ? (
                <div className="coupon-archive-list">
                  {coupons.map((item) => {
                    const key = `${item.source}-${item.id}`;
                    const isStamping = stampingId === key;

                    return (
                      <div
                        key={key}
                        className={`coupon-archive-card ${item.status === 'redeemed' ? 'is-redeemed' : ''}`}
                      >
                        {/* 朱砂盖章层 */}
                        <div className={`coupon-stamp-layer ${isStamping ? 'is-active' : ''}`}>
                          <div className="coupon-stamp-seal">REDEEMED</div>
                        </div>

                        <div className="coupon-archive-meta">
                          <span>{character?.name || 'TA'} 发出</span>
                          <span>
                            {new Date(item.createdAt).toLocaleDateString('zh-CN', {
                              month: '2-digit',
                              day:   '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="coupon-archive-title">{item.title}</div>

                        <div className="coupon-archive-note">{item.note}</div>

                        <div className="coupon-archive-footer">
                          <span className={`coupon-archive-status ${item.status}`}>
                            {item.status === 'redeemed' ? 'REDEEMED' : 'PENDING'}
                          </span>

                          {item.status === 'pending' && (
                            <button
                              type="button"
                              className="coupon-archive-redeem-btn"
                              onClick={() => handleRedeem(item)}
                            >
                              <Check size={12} strokeWidth={2.2} />
                              兑现
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="coupon-archive-empty">
                  还没有收到券 — 等 {character?.name || '对方'} 发一张给你吧。
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CouponWalletPanel;