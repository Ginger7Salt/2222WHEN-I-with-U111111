const OFFLINE_INVITE_PATTERN = /\[OFFLINE_INVITE:\s*([^\]]+)\]\s*$/i;

export const extractOfflineInviteDirective = (rawContent = '') => {
  const text = String(rawContent || '');
  const match = text.match(OFFLINE_INVITE_PATTERN);

  if (!match) {
    return { content: text, invite: null };
  }

  const content = text.slice(0, match.index).trim();
  const parts = match[1].split('|').map((part) => part.trim());

  const sceneLabel = parts[0] || '一次线下见面';
  const sceneDescription = parts[1] || '';
  const delayMinutes = Math.min(10080, Math.max(30, parseInt(parts[2], 10) || 60));

  return {
    content,
    invite: {
      sceneLabel,
      sceneDescription,
      scheduledFor: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
    },
  };
};