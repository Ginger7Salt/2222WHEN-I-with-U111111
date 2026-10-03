// 和好券面板：从聊天室的互动菜单里打开，两个标签——写一张（模板 +
// 自由文本混合，发出去后小票机会"打印"出来，完整展示一段时间再"飞走"）、
// 券夹（角色发给用户的券的列表，点未兑现的券可以兑现，播放一个盖章动效）。
//
// 2026-10 改版：
// - 写一张发出去之后，不再只写进看不见的 coupons 表，而是通过
//   onSendCoupon（ChatRoom.jsx 的 handleSendCoupon）写成一条真正的
//   sender:'user' 聊天消息，直接出现在聊天记录里。
// - 券夹只展示角色发给用户的券——用户自己发的券已经是聊天记录的一部分，
//   发送成功后这里不再自动跳转去券夹（那里本来就看不到刚发的这张）。
// - 票面打印出来之后停留的时间从 650ms 延长到约 2.2s，再做一个"飞走"的
//   收尾动效，而不是发出去就立刻弹走。

import React, { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import { listCouponsForChat, redeemCoupon } from './couponService';
import { COUPON_TEMPLATES } from './couponTypes';
import './coupon.css';

const TICKET_HOLD_MS = 2200;
const TICKET_FLY_MS = 560;

export const CouponWalletPanel = ({ isOpen, onClose, chatId, character, onSendCoupon }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [freeText, setFreeText] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFlying, setPreviewFlying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentNotice, setSentNotice] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [stampingId, setStampingId] = useState(null);

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
  const previewNote = freeText.trim()
    || (selectedTemplate ? `兑换一次${selectedTemplate.replace('券', '')}时间。` : '');

  const canSend = Boolean(selectedTemplate || freeText.trim()) && !isSending;

  const handleSend = async () => {
    if (!canSend) return;

    const title = selectedTemplate || '自定义券';
    const note = freeText.trim() || `兑换一次${title.replace('券', '')}时间。`;

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

    setStampingId(`${item.source}-${item.id}`);

    window.setTimeout(async () => {
      await redeemCoupon(item);
      await reload();
      setStampingId(null);
    }, 520);
  };

  const pendingCount = coupons.filter((item) => item.status === 'pending').length;
  const redeemedCount = coupons.filter((item) => item.status === 'redeemed').length;

  return (
    <div className="coupon-overlay">
      <div className="coupon-diffuse">
        <div className="coupon-orb coupon-orb--1" />
        <div className="coupon-orb coupon-orb--2" />
      </div>

      <div className="coupon-header">
        <div>
          <div className="coupon-header-eyebrow">MAKE-UP TICKET</div>
          <div className="coupon-header-title">和好券</div>
          <div className="coupon-header-sub">
            你和 {character?.name || '对方'} 的兑换券
          </div>
        </div>

        <button type="button" className="coupon-close-btn" onClick={onClose}>
          <X size={15} strokeWidth={1.8} />
        </button>
      </div>

      <div className="coupon-tabs">
        <button
          type="button"
          className={`coupon-tab-btn ${activeTab === 'create' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          写一张
        </button>
        <button
          type="button"
          className={`coupon-tab-btn ${activeTab === 'wallet' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('wallet')}
        >
          券夹
        </button>
      </div>

      <div className="coupon-body">
        {activeTab === 'create' && (
          <div>
            <div className="coupon-section-label">挑一个模板，或者自己写</div>

            <div className="coupon-template-row">
              {COUPON_TEMPLATES.map((template) => (
                <button
                  key={template}
                  type="button"
                  className={`coupon-template-chip ${selectedTemplate === template ? 'is-selected' : ''}`}
                  onClick={() => setSelectedTemplate(
                    selectedTemplate === template ? null : template
                  )}
                >
                  {template}
                </button>
              ))}
            </div>

            <textarea
              className="coupon-free-text"
              placeholder="写点具体的内容，比如：这张券可以兑换一次不讲道理的撒娇时间。"
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
            />

            <button
              type="button"
              className="coupon-send-btn"
              disabled={!canSend}
              onClick={handleSend}
            >
              {isSending ? '正在送出…' : '发出这张券'}
            </button>

            {sentNotice && (
              <div className="coupon-sent-notice">
                已经送到 {character?.name || '对方'} 的聊天气泡里啦，关掉面板就能看到。
              </div>
            )}

            <div className="coupon-machine">
              <div className="coupon-machine-label">PRINTING SLOT</div>
              <div className="coupon-slit" />
              <div
                className={`coupon-ticket ${previewVisible ? '' : 'is-hidden'} ${previewFlying ? 'is-flying' : ''}`}
              >
                <div className="coupon-ticket-label">TO {character?.name || '对方'}</div>
                <div className="coupon-ticket-title">{previewTitle || '新的一张券'}</div>
                <div className="coupon-ticket-perforation" />
                <div className="coupon-ticket-note">
                  {previewNote || '选个模板或者自己写点内容'}
                </div>
                <div className="coupon-ticket-foot">
                  <span>{new Date().toLocaleDateString('zh-CN')}</span>
                  <span>HANDMADE</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div>
            <div className="coupon-wallet-hint">
              这里只收 {character?.name || '对方'} 发给你的券——你自己发出的券，
              在和 TA 的聊天记录里就能看到。
            </div>

            <div className="coupon-wallet-stats">
              <div className="coupon-stat">
                未兑现
                <b>{pendingCount}</b>
              </div>
              <div className="coupon-stat">
                已兑现
                <b>{redeemedCount}</b>
              </div>
              <div className="coupon-stat">
                累计
                <b>{coupons.length}</b>
              </div>
            </div>

            {coupons.length > 0 ? (
              <div className="coupon-wallet-grid">
                {coupons.map((item) => {
                  const key = `${item.source}-${item.id}`;

                  return (
                    <div
                      key={key}
                      className={`coupon-card-item ${item.status === 'redeemed' ? 'is-redeemed' : ''}`}
                    >
                      <div className={`coupon-stamp-overlay ${stampingId === key ? 'show' : ''}`}>
                        <div className="coupon-stamp-mark">已兑现</div>
                      </div>

                      <div className="coupon-card-tag">
                        {character?.name || 'TA'} 发出
                        {' · '}
                        {new Date(item.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                      </div>
                      <div className="coupon-card-title">{item.title}</div>
                      <div className="coupon-card-perforation" />
                      <div className="coupon-card-note">{item.note}</div>
                      <div className="coupon-card-foot">
                        <span className={`coupon-status-pill ${item.status}`}>
                          {item.status === 'redeemed' ? '已兑现' : '待兑现'}
                        </span>
                        <span>NO. {String(item.id).padStart(4, '0')}</span>
                      </div>

                      {item.status === 'pending' && (
                        <button
                          type="button"
                          className="coupon-card-redeem-btn"
                          onClick={() => handleRedeem(item)}
                        >
                          <Check size={12} strokeWidth={2} />
                          兑现这张券
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="coupon-empty">还没有券，等 {character?.name || '对方'} 发一张给你吧。</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CouponWalletPanel;