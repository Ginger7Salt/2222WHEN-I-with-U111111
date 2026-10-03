// 和好券面板：从聊天室的互动菜单里打开，两个标签——写一张（模板 +
// 自由文本混合，发出去后小票机会"打印"出来）、券夹（双方所有券的
// 列表，点未兑现的券可以兑现，播放一个盖章动效）。
//
// 打开时顺手跑一次 10 天自动清理（只影响用户自己发出、已兑现超过
// 10 天的券，不碰聊天消息——见 couponService.js 顶部注释）。

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  cleanupExpiredCoupons,
  createCoupon,
  listCouponsForChat,
  redeemCoupon,
} from './couponService';
import { COUPON_TEMPLATES } from './couponTypes';
import './coupon.css';

export const CouponWalletPanel = ({ isOpen, onClose, chatId, character }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [freeText, setFreeText] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
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

    void cleanupExpiredCoupons(chatId).then(reload);
  }, [isOpen, chatId]);

  if (!isOpen) return null;

  const previewTitle = selectedTemplate || (freeText.trim() ? '自定义券' : '');
  const previewNote = freeText.trim()
    || (selectedTemplate ? `兑换一次${selectedTemplate.replace('券', '')}时间。` : '');

  const canSend = Boolean(selectedTemplate || freeText.trim());

  const handleSend = async () => {
    if (!canSend) return;

    const title = selectedTemplate || '自定义券';
    const note = freeText.trim() || `兑换一次${title.replace('券', '')}时间。`;

    setPreviewVisible(true);

    await createCoupon({ chatId, title, note });

    window.setTimeout(async () => {
      setPreviewVisible(false);
      setSelectedTemplate(null);
      setFreeText('');
      await reload();
      setActiveTab('wallet');
    }, 650);
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
      <div className="coupon-header">
        <div>
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
              发出这张券
            </button>

            <div className="coupon-machine">
              <div className="coupon-machine-label">PRINTING SLOT</div>
              <div className="coupon-slit" />
              <div className={`coupon-ticket ${previewVisible ? '' : 'is-hidden'}`}>
                <div className="coupon-ticket-label">{previewTitle || '等待填写'}</div>
                <div className="coupon-ticket-title">{previewTitle || '新的一张券'}</div>
                <div className="coupon-ticket-perforation" />
                <div className="coupon-ticket-note">
                  {previewNote || '选个模板或者自己写点内容'}
                </div>
                <div className="coupon-ticket-foot">
                  <span>{new Date().toLocaleDateString('zh-CN')}</span>
                  <span>TO {character?.name || '对方'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div>
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
                      onClick={() => handleRedeem(item)}
                    >
                      <div className={`coupon-stamp-overlay ${stampingId === key ? 'show' : ''}`}>
                        <div className="coupon-stamp-mark">已兑现</div>
                      </div>

                      <div className="coupon-card-tag">
                        {item.fromRole === 'character' ? `${character?.name || 'TA'} 发出` : '你发出'}
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
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="coupon-empty">还没有券，去"写一张"发第一张吧。</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CouponWalletPanel;