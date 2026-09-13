import React, { useState } from 'react';
import CharacterGallery from './CharacterGallery';
import CharacterProfilePage from './CharacterProfilePage';

/**
 * ProfileHub —— 挂到 AppGrid 里的入口组件
 *
 * 只有两个视图，靠一个 state 切换，没有底部 tab bar：
 *   'gallery'  —— 胶卷式选人页
 *   'profile'  —— 选中角色后的个人主页
 *
 * 用法（在 AppGrid.jsx 或 App.jsx 的路由里）：
 *   <ProfileHub onExit={() => setActiveApp(null)} />
 */
export const ProfileHub = ({ onExit }) => {
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);

  if (selectedCharacterId) {
    return (
      <CharacterProfilePage
        characterId={selectedCharacterId}
        onBack={() => setSelectedCharacterId(null)}
      />
    );
  }

  return (
    <CharacterGallery
      onOpenCharacter={(character) => setSelectedCharacterId(character.id)}
      onBack={onExit}
    />
  );
};

export default ProfileHub;