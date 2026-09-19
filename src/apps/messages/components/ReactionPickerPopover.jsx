import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { REACTION_TYPES } from './reactionTypes';

// 长按消息气泡后浮起来的反应选择面板：丝滑的弹出/收起动效
// （用 motion 做弹簧过渡，不是生硬的显隐），每个反应类型都用
// 自己的颜色，情绪一眼能看出来，不是清一色的灰调小图标。
//
// open 时会顺带铺一层全屏透明背景，点背景或者选完一个反应都会
// 收起面板，跟大多数聊天软件"长按点反应"的手感一致。
const ReactionPickerPopover = ({ open, isUser, selectedType, onPick, onClose }) => (
  <AnimatePresence>
    {open && (
      <>
        <div
          className="fixed inset-0 z-40"
          onPointerDown={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 6 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          className={`absolute z-50 bottom-full mb-2 flex items-center gap-1 rounded-full border p-1.5 shadow-lg ${
            isUser ? 'right-0' : 'left-0'
          }`}
          style={{
            background: 'var(--card-bg-gradient)',
            borderColor: 'var(--card-border)',
          }}
        >
          {REACTION_TYPES.map((reactionType, index) => {
            const isSelected = selectedType === reactionType.id;
            const ReactionIcon = reactionType.Icon;

            return (
              <motion.button
                key={reactionType.id}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onPick(reactionType.id)}
                title={reactionType.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ scale: 1.22, y: -3 }}
                whileTap={{ scale: 0.92 }}
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{
                  background: isSelected ? reactionType.color : 'var(--control-soft-bg)',
                  color: isSelected ? '#fff' : reactionType.color,
                }}
              >
                <ReactionIcon
                  className="h-4 w-4"
                  fill={isSelected ? 'currentColor' : 'none'}
                />
              </motion.button>
            );
          })}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

export default ReactionPickerPopover;