import db from '../../db';

const getTodayDateKey = () => new Date().toISOString().slice(0, 10);

export async function ensureAccessRecord(chatId, characterId) {
  const today = getTodayDateKey();
  const existing = await db.innerWorldAccess.get(chatId);

  if (existing && existing.date === today) {
    return existing;
  }

  const fresh = {
    chatId,
    characterId,
    date: today,
    password: null,
    attemptsUsed: 0,
    isUnlocked: false,
    updatedAt: Date.now(),
  };

  await db.innerWorldAccess.put(fresh);
  return fresh;
}

export async function isLockedOutToday(chatId) {
  const record = await ensureAccessRecord(chatId);
  return !record.isUnlocked && record.attemptsUsed >= 3;
}

export async function attemptUnlock(chatId, guess) {
  const record = await ensureAccessRecord(chatId);

  if (record.isUnlocked) {
    return { success: true, alreadyUnlocked: true };
  }

  if (record.attemptsUsed >= 3) {
    return { success: false, lockedOut: true, remaining: 0 };
  }

  const isCorrect = typeof record.password === 'string'
    && guess.trim() === record.password.trim();

  const nextAttempts = record.attemptsUsed + 1;

  await db.innerWorldAccess.update(chatId, {
    attemptsUsed: nextAttempts,
    isUnlocked: isCorrect,
    updatedAt: Date.now(),
  });

  return {
    success: isCorrect,
    lockedOut: !isCorrect && nextAttempts >= 3,
    remaining: Math.max(0, 3 - nextAttempts),
  };
}

export async function savePassword(chatId, password) {
  await db.innerWorldAccess.update(chatId, {
    password,
    updatedAt: Date.now(),
  });
}