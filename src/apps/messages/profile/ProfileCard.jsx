import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { getProfileCard, getFirstMetAt } from './profileCardService';
import './profileCard.css';

// 长按头像打开的那张可翻面"资料卡"。正面：昵称 + #标签 + 签名（像一张
// 黑白证件）；背面：初次见面日期 + 当前版本号 + 一句说明文字。内容来自
// chat.profileNickname / profileTag / currentSignature，由
// profileCardService.js 的后台节奏自己更新——这里只负责展示，不包含
// 任何编辑入口（跟原始签名的设计取舍一致：用户只"看"，不直接改）。
const ProfileCard = ({ open, onClose, chatId, character }) => {
  const [card, setCard] = useState(null);
  const [firstMetAt, setFirstMetAt] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (!open || !chatId) return;

    setIsFlipped(false);

    let cancelled = false;

    (async () => {
      const [cardData, firstMet] = await Promise.all([
        getProfileCard(chatId),
        getFirstMetAt(chatId),
      ]);

      if (cancelled) return;
      setCard(cardData);
      setFirstMetAt(firstMet);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, chatId]);

  if (!open) return null;

  const nickname = card?.nickname || character?.name || '';
  const tag = card?.tag || '';
  const signature = card?.signature || '这里还什么都没写';
  const edition = card?.edition || 0;

  const firstMetLabel = firstMetAt
    ? new Date(firstMetAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    : '—';

  const daysTogether = firstMetAt
    ? Math.max(1, Math.floor((Date.now() - new Date(firstMetAt).getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  const editionLabel = edition > 0 ? `No.${String(edition).padStart(2, '0')}` : '—';

  return (
    <div
      className="profile-card-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="profile-card-stage">
        <button
          type="button"
          className="profile-card-close"
          onClick={onClose}
          aria-label="关闭资料卡"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          className={`profile-card-flip${isFlipped ? ' is-flipped' : ''}`}
          onClick={() => setIsFlipped((previous) => !previous)}
        >
          <div className="profile-card-face profile-card-face-front">
            <div className="profile-card-band">
              <div className="profile-card-band-brand">
                <div className="profile-card-band-mark">
                  {character?.name?.[0] || 'C'}
                </div>
                <span className="profile-card-band-title">Companion ID</span>
              </div>
              <div className="profile-card-band-chip">
                <span className="dot" />
                Ongoing
              </div>
            </div>

            <div className="profile-card-body">
              <div className="profile-card-photo">
                {character?.avatar && <img src={character.avatar} alt={nickname} />}
                <div className="profile-card-seal">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
              </div>

              <div className="profile-card-fields">
                <div className="profile-card-name-row">
                  <div className="profile-card-k">Nickname</div>
                  <div className="profile-card-name">{nickname}</div>
                </div>

                <div className="profile-card-meta-grid">
                  <div className="profile-card-meta-item">
                    <div className="profile-card-k">Tag</div>
                    <div className="v">{tag || '—'}</div>
                  </div>
                  <div className="profile-card-meta-item">
                    <div className="profile-card-k">Since</div>
                    <div className="v">{firstMetLabel}</div>
                  </div>
                  <div className="profile-card-meta-item">
                    <div className="profile-card-k">Days</div>
                    <div className="v">{daysTogether ?? '—'}</div>
                  </div>
                  <div className="profile-card-meta-item">
                    <div className="profile-card-k">Edition</div>
                    <div className="v">{editionLabel}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="profile-card-sig-strip">
              <div className="profile-card-barcode-bars" />

              <div className="profile-card-sig-text-wrap">
                <div className="profile-card-sig-text">{signature}</div>
                <div className="profile-card-sig-label">Authorized Signature</div>
              </div>
            </div>

            <div className="profile-card-flip-affordance">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 12a9 9 0 0 1 15-6.7M21 12a9 9 0 0 1-15 6.7" />
                <path d="M17 3v4h-4M7 21v-4h4" />
              </svg>
            </div>
          </div>

          <div className="profile-card-face profile-card-face-back">
            <div className="profile-card-stripe" />
            <div className="profile-card-back-pad">
              <div className="profile-card-terms">
                这张卡记录着TA在这段关系里的样子——昵称、标签和亲笔签名，
                会跟着心情更新，每次更新都会留下一个新版本号。
              </div>

              <div className="profile-card-notes-row">
                <div className="profile-card-note-block">
                  <div className="profile-card-k">初次见面</div>
                  <div className="v">{firstMetLabel}</div>
                </div>
                <div className="profile-card-note-block">
                  <div className="profile-card-k">当前版本</div>
                  <div className="v">EDITION {editionLabel.replace('No.', '')}</div>
                </div>
              </div>
            </div>

            <div className="profile-card-back-foot">
              <span>UPDATED EACH TIME SIGNATURE CHANGES</span>
              <span>#{String(chatId).padStart(4, '0')}</span>
            </div>

            <div className="profile-card-flip-affordance">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 12a9 9 0 0 1 15-6.7M21 12a9 9 0 0 1-15 6.7" />
                <path d="M17 3v4h-4M7 21v-4h4" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;