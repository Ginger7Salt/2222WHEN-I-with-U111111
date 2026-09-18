import React, { useEffect, useState } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import db from '../../db';
import InnerWorldApp from './InnerWorldApp';

export const InnerWorldEntryList = ({ onBack }) => {
  const [chats, setChats] = useState([]);
  const [charactersById, setCharactersById] = useState({});
  const [activeChatId, setActiveChatId] = useState(null);

  useEffect(() => {
    (async () => {
      const [allChats, allCharacters] = await Promise.all([
        db.chats.toArray(),
        db.characters.toArray(),
      ]);

      setChats(allChats);
      setCharactersById(Object.fromEntries(allCharacters.map((c) => [c.id, c])));
    })();
  }, []);

  if (activeChatId) {
    const chat = chats.find((c) => c.id === activeChatId);
    return (
      <InnerWorldApp
        chatId={activeChatId}
        characterId={chat?.characterId}
        onClose={() => setActiveChatId(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <header className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <button type="button" onClick={onBack} className="rounded-full border border-white/15 p-2">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="font-serif text-sm tracking-wide text-white/85">内心主页</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-2">
        {chats.length === 0 && (
          <p className="mt-10 text-center text-xs text-white/40">还没有任何聊天。</p>
        )}

        <div className="space-y-2">
          {chats.map((chat) => {
            const character = charactersById[chat.characterId];
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => setActiveChatId(chat.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition active:scale-[0.98]"
              >
                {character?.avatar ? (
                  <img
                    src={character.avatar}
                    alt={character.name}
                    className="h-10 w-10 shrink-0 rounded-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 font-serif text-sm">
                    {character?.name?.[0] || '?'}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-sm text-white/90">
                    {character?.name || '未知角色'}
                  </p>
                  <p className="truncate text-[10px] text-white/40">
                    {chat.title || `聊天窗 #${String(chat.id).padStart(4, '0')}`}
                  </p>
                </div>

                <Lock className="h-3.5 w-3.5 shrink-0 text-white/25" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InnerWorldEntryList;