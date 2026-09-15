import React, { useState, useEffect, useCallback } from 'react';
import db from '../../db';
import InnerWorldLockScreen from './InnerWorldLockScreen';
import InnerWorldHome from './InnerWorldHome';

export const InnerWorldApp = ({ chatId, characterId, onClose }) => {
  const [chat, setChat] = useState(null);
  const [character, setCharacter] = useState(null);
  const [unlockedEntry, setUnlockedEntry] = useState(null);
  const [isLoadingBase, setIsLoadingBase] = useState(true);

  const loadBase = useCallback(async () => {
    const chatRecord = await db.chats.get(chatId);
    if (!chatRecord) {
      setIsLoadingBase(false);
      return;
    }

    const charRecord = await db.characters.get(characterId || chatRecord.characterId);
    setChat(chatRecord);
    setCharacter(charRecord);
    setIsLoadingBase(false);
  }, [chatId, characterId]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  if (isLoadingBase || !chat || !character) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
      </div>
    );
  }

  if (unlockedEntry) {
    return (
      <InnerWorldHome
        chatId={chatId}
        characterId={character.id}
        character={character}
        chat={chat}
        entry={unlockedEntry}
        onClose={onClose}
      />
    );
  }

  return (
    <InnerWorldLockScreen
      chatId={chatId}
      characterId={character.id}
      character={character}
      chat={chat}
      onUnlocked={setUnlockedEntry}
      onClose={onClose}
    />
  );
};

export default InnerWorldApp;