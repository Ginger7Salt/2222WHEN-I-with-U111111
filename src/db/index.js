import Dexie from 'dexie';

export const db = new Dexie('WhenIWithUDatabase');

db.version(1).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, avatar, bio, worldBook, isAutoMessageActive',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, characterId, author, content, date',
  travels: '++id, destination, status, timestamp',
  todos: '++id, title, dueDate, isCompleted',
  settings: 'key, value'
});

db.version(2).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, characterId, author, content, date',
  travels: '++id, destination, status, timestamp',
  todos: '++id, title, dueDate, isCompleted',
  settings: 'key, value',
});

db.version(3).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  settings: 'key, value'
});

db.version(4).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  settings: 'key, value',

  travels: '++id, characterId, destination, status, userPersona, luggageNotes, durationHours, startTime, endTime, flightNo, hotelName, coverPhoto, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead'
});

db.version(5).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  settings: 'key, value',

  travels: '++id, characterId, destination, status, userPersona, luggageNotes, durationHours, startTime, endTime, flightNo, hotelName, coverPhoto, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, authorType, characterId, npcId, authorName, authorAvatar, mediaUrl, imagePrompt, content, location, likes, isLiked, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, replyToCommentId, replyToName, senderType, characterId, npcId, senderName, senderAvatar, content, timestamp',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value'
});

db.version(6).stores({
  profile: 'id',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, isNpc',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt',
  messages: '++id, characterId, timestamp',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, date, characterId',
  todos: '++id, category, dueDate, status',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt'
}).upgrade(async (tx) => {
  await tx.table('snapshots').toCollection().modify((snapshot) => {
    if (snapshot.createdAt == null && snapshot.timestamp != null) {
      snapshot.createdAt = snapshot.timestamp;
    }
  });

  await tx.table('snapshotComments').toCollection().modify((comment) => {
    if (comment.createdAt == null && comment.timestamp != null) {
      comment.createdAt = comment.timestamp;
    }
  });
});

db.version(7).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt'
});

db.version(8).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt'
});

db.version(9).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt'
});

db.version(10).stores({
  stickers: '++id, name, url, category, createdAt'
});

db.version(11).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt'
});

db.version(12).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt'
});

db.version(13).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',
  travels: '++id, characterId, status, createdAt',
  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp', 
});

db.version(14).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp'
});

db.version(15).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt'
});

db.version(16).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',

  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt'
});

// 🛠️ Version 17: 提问箱 (AskBox) 逻辑表定义
db.version(17).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',

  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',

  // 👈 Version 17 新增提问箱数据表
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt'
});


// 🛠️ Version 18: 新增平行轨迹 (ParallelOrbit) 日常记录表
db.version(18).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',

  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  // 👈 Version 18 新增平行轨迹数据表
  parallelOrbits: '++id, chatId, characterId, timestamp'
});

// 🛠️ Version 19: 新增用户作息日程表
db.version(19).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',

  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits: '++id, chatId, characterId, timestamp',
  
  // 👈 Version 19 新增用户作息表
    schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt'

});

// 🛠️ Version 20: 新增用户作息日程表
db.version(20).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',

  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits: '++id, chatId, characterId, timestamp',
  
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date,weeks, createdAt'

});

db.version(21).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',

  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits: '++id, chatId, characterId, timestamp',

  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',

  // 对话内由 AI 自主安排的稍后联系计划。
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt'
});

db.version(22).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',

  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits: '++id, chatId, characterId, timestamp',

  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',

   // 对话内由 AI 自主安排的稍后联系计划。
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',
  memories: '++id, &memoryId, chatId, type, status, importance, confidence, createdAt, updatedAt, sourceState',
  memoryCandidates: '++id, &candidateId, chatId, type, status, priority, createdAt, updatedAt',

  // 每次人工或系统修订保留一份快照。
  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',

  // 每个聊天窗仅保留一条任务状态记录。
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',

  // 仅放全局记忆模块设置，不放 API Key。
  memorySettings: 'key'
});


db.version(23).stores({
    profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',
  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',
  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',
  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',

  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits: '++id, chatId, characterId, timestamp',

  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',

   // 对话内由 AI 自主安排的稍后联系计划。
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',
  memories: '++id, &memoryId, chatId, type, status, importance, confidence, createdAt, updatedAt, sourceState',
  memoryCandidates: '++id, &candidateId, chatId, type, status, priority, createdAt, updatedAt',

  // 每次人工或系统修订保留一份快照。
  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',

  // 每个聊天窗仅保留一条任务状态记录。
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',

  // 仅放全局记忆模块设置，不放 API Key。
  memorySettings: 'key',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt'
}).upgrade(async (tx) => {
  const now = new Date().toISOString();

  await tx.table('memories').toCollection().modify((memory) => {
    const normalizedContent = String(memory.content || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[，。！？；：“”‘’、,.!?;:()[\]{}]/g, '');

    if (memory.status === 'corrected') {
      memory.status = 'dormant';
    }

    memory.normalizedContent = memory.normalizedContent || normalizedContent;
    memory.sourceKind = memory.sourceKind || 'conversation';
    memory.useCount = Number(memory.useCount || 0);
    memory.lastUsedAt = memory.lastUsedAt || null;
    memory.lastRetrievedAt = memory.lastRetrievedAt || null;
    memory.userEditedAt = memory.userEditedAt || null;
    memory.userConfirmedAt = memory.userConfirmedAt || null;
    memory.supersedesMemoryId = memory.supersedesMemoryId || null;
    memory.supersededByMemoryId = memory.supersededByMemoryId || null;
    memory.duplicateOfMemoryId = memory.duplicateOfMemoryId || null;
    memory.conflictWithMemoryIds = Array.isArray(memory.conflictWithMemoryIds)
      ? memory.conflictWithMemoryIds
      : [];
    memory.updatedAt = memory.updatedAt || now;
  });

  await tx.table('memoryCandidates').toCollection().modify((candidate) => {
    candidate.proposalType = candidate.proposalType || 'create';
    candidate.targetMemoryId = candidate.targetMemoryId || null;
    candidate.relatedMemoryIds = Array.isArray(candidate.relatedMemoryIds)
      ? candidate.relatedMemoryIds
      : [];
    candidate.similarityScore = Number(candidate.similarityScore || 0);
    candidate.conflictReason = candidate.conflictReason || '';
  });
});

db.version(24).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',

  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',

  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',

  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits: '++id, chatId, characterId, timestamp',

  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',

  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',

  /*
   * The Bond Connection
   *
   * 所有连接与工具配置仅保存在当前用户的 IndexedDB。
   * 认证信息未来可保存于 mcpConnections.auth，但绝不进入导出文件。
   */
  mcpConnections: `
    &id,
    enabled,
    endpoint,
    transport,
    status,
    createdAt,
    updatedAt
  `,

  /*
   * 每个 MCP Server 发现的工具，以及用户对单个工具的本地开关与风险标记。
   */
  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  /*
   * 用户明确作出的调用授权。
   *
   * scope:
   * - once：仅本次，实际不持久化
   * - chat：当前聊天
   * - character：当前角色
   * - global：全局
   */
  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  /*
   * 仅记录调用摘要和状态，不能保存聊天全文、认证 Token 或敏感工具结果。
   */
  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    status,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt]
  `
});

db.version(25).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',

  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',
  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',

  /*
   * provider:
   * generic | modelscope | bridge | custom
   *
   * transport:
   * streamable-http | bridge-http | sse | bridge-websocket | custom
   *
   * executionMode:
   * browser-direct | user-bridge | user-executor
   */
  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    status,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt]
  `,

  /*
   * OAuth 的临时 state / PKCE 信息。
   * access token、refresh token 不得写入导出文件。
   */
  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  /*
   * 用户自行运行的 Bridge 的登记和健康状态。
   * 并不代表本项目负责启动、托管或维护 Bridge。
   */
  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  /*
   * 自动化 / 后台执行器接口预留。
   * 本轮先建立数据兼容，不启用自动任务 UI。
   */
  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt]
  `
});


db.version(26).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',

  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',
  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',

  /*
   * provider:
   * generic | modelscope | bridge | custom
   *
   * transport:
   * streamable-http | bridge-http | sse | bridge-websocket | custom
   *
   * executionMode:
   * browser-direct | user-bridge | user-executor
   */
  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

 mcpActivities: `
  ++id,
  connectionId,
  toolName,
  chatId,
  characterId,
  source,
  automationId,
  executorId,
  status,
  errorCode,
  createdAt,
  [connectionId+createdAt],
  [chatId+createdAt],
  [source+createdAt]
`,

  /*
   * OAuth 的临时 state / PKCE 信息。
   * access token、refresh token 不得写入导出文件。
   */
  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  /*
   * 用户自行运行的 Bridge 的登记和健康状态。
   * 并不代表本项目负责启动、托管或维护 Bridge。
   */
  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  /*
   * 自动化 / 后台执行器接口预留。
   * 本轮先建立数据兼容，不启用自动任务 UI。
   */
  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt]
  `
});

db.version(27).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',

  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',
  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt]
  `
});


db.version(28).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',

  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',
  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt]
  `
});


db.version(29).stores({

    profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',

  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',
  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,
});


db.version(30).stores({

    profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',

  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',
  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  newspapers: '++id, date, characterId, createdAt',
  marginNotes: '++id, date, characterId, language, createdAt'
});

db.version(31).stores({

      profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',

  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',
  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  newspapers: '++id, date, characterId, createdAt',
  marginNotes: '++id, date, characterId, language, createdAt',

  companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,

  companionshipTurns: `
    ++id,
    sessionId,
    chatId,
    scheduledFor,
    status,
    createdAt,
    [sessionId+scheduledFor]
  `,
});

db.version(31).stores({

      profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',

  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',
  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  newspapers: '++id, date, characterId, createdAt',
  marginNotes: '++id, date, characterId, language, createdAt',

  companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,

  companionshipTurns: `
    ++id,
    sessionId,
    chatId,
    scheduledFor,
    status,
    createdAt,
    [sessionId+scheduledFor]
  `,
   companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,
});



db.version(32).stores({

      profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',

  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',
  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  newspapers: '++id, date, characterId, createdAt',
  marginNotes: '++id, date, characterId, language, createdAt',

  companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,

  companionshipTurns: `
    ++id,
    sessionId,
    chatId,
    scheduledFor,
    status,
    createdAt,
    [sessionId+scheduledFor]
  `,
});

db.version(33).stores({

      profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',

  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',
  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  newspapers: '++id, date, characterId, createdAt',
  marginNotes: '++id, date, characterId, language, createdAt',

  companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,

  companionshipTurns: `
    ++id,
    sessionId,
    chatId,
    scheduledFor,
    status,
    createdAt,
    [sessionId+scheduledFor]
  `,
   companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,
  companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,
  companionshipEvents: `
    ++id,
    sessionId,
    chatId,
    type,
    createdAt,
    timestamp
  `,
   companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,

  companionshipEvents: `
    ++id,
    sessionId,
    chatId,
    type,
    createdAt,
    timestamp
  `,
});

db.version(34).stores({

      profile: 'id, name, handle, bio, location, joined, avatar, banner',
  pinnedGallery: 'id, title, caption, photos',

  characters: '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',
  chats: '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',
  messages: '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks: '++id, type, title, isEnabled',
  homeBoard: '++id, characterId, characterName, avatar, content, timestamp, isRead',
  diaries: '++id, chatId, characterId, author, title, date, timestamp',
  todos: '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels: '++id, characterId, status, createdAt',
  travelWishlists: '++id, characterId, creator, destination, reason, isMatched, createdAt',
  travelPostcards: '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots: '++id, characterId, createdAt, linkedChatId, timestamp',
  snapshotComments: '++id, snapshotId, characterId, createdAt',
  snapshotRelations: '++id, characterId, targetCharacterId, relation',
  snapshotSettings: 'key, value',

  settings: 'key',
  pebblings: '++id, characterId, status, stoneType, createdAt, respondAt',
  stickers: '++id, name, url, category, createdAt',

  imaginariumChats: '++id, title, createdAt, updatedAt',
  imaginariumMessages: '++id, chatId, senderId, timestamp',
  imaginariumSummaries: '++id, chatId, createdAt',

  ensembleChats: '++id, title, createdAt, updatedAt',
  ensembleMessages: '++id, chatId, senderId, timestamp',
  ensembleSummaries: '++id, chatId, createdAt',

  habitats: '++id, name, type, guardianCharacterId, createdAt',
  habitatLogs: '++id, habitatId, logType, timestamp',

  ephemeras: '++id, characterId, templateType, title, createdAt',
  dailyOfferingImages: '++id, createdAt, updatedAt',
  dailyOfferings: 'date, characterId, createdAt',
  askBoxQuestions: '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',
  parallelOrbits: '++id, chatId, characterId, timestamp',
  schedules: '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',
  scheduledMessages: '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions: '++id, &revisionId, memoryId, chatId, action, createdAt',
  memoryJobs: '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',
  memorySettings: 'key',
    characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,


  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt] `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  newspapers: '++id, date, characterId, createdAt',
  marginNotes: '++id, date, characterId, language, createdAt',

  companionshipTurns: `
    ++id,
    sessionId,
    chatId,
    scheduledFor,
    status,
    createdAt,
    [sessionId+scheduledFor]
  `,
   companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,
  companionshipEvents: `
    ++id,
    sessionId,
    chatId,
    type,
    createdAt,
    timestamp
  `,
});


db.version(35).stores({
  profile: 'id, name, handle, bio, location, joined, avatar, banner',

  pinnedGallery: 'id, title, caption, photos',

  characters:
    '++id, name, handle, avatar, bio, extraNotes, summaryFrequency, isAutoMessageActive, statusList, userPersona, userAvatar',

  chats:
    '++id, characterId, mode, title, summary, bgImage, bgOpacity, customCss, keepAlive, updatedAt, userName, userAvatar, userPersona, inputPlaceholder, typingText, typingStyle, isBgDimmed, soundEnabled',

  messages:
    '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex',

  worldBooks:
    '++id, type, title, isEnabled',

  homeBoard:
    '++id, characterId, characterName, avatar, content, timestamp, isRead',

  diaries:
    '++id, chatId, characterId, author, title, date, timestamp',

  todos:
    '++id, title, dueDate, priority, category, characterId, isCompleted, createdAt',

  travels:
    '++id, characterId, status, createdAt',

  travelWishlists:
    '++id, characterId, creator, destination, reason, isMatched, createdAt',

  travelPostcards:
    '++id, travelId, characterId, spotName, photoStyle, letterContent, giftItem, metPerson, timestamp, isRead',

  snapshots:
    '++id, characterId, createdAt, linkedChatId, timestamp',

  snapshotComments:
    '++id, snapshotId, characterId, createdAt',

  snapshotRelations:
    '++id, characterId, targetCharacterId, relation',

  snapshotSettings:
    'key, value',

  settings:
    'key',

  pebblings:
    '++id, characterId, status, stoneType, createdAt, respondAt',

  stickers:
    '++id, name, url, category, createdAt',

  imaginariumChats:
    '++id, title, createdAt, updatedAt',

  imaginariumMessages:
    '++id, chatId, senderId, timestamp',

  imaginariumSummaries:
    '++id, chatId, createdAt',

  ensembleChats:
    '++id, title, createdAt, updatedAt',

  ensembleMessages:
    '++id, chatId, senderId, timestamp',

  ensembleSummaries:
    '++id, chatId, createdAt',

  habitats:
    '++id, name, type, guardianCharacterId, createdAt',

  habitatLogs:
    '++id, habitatId, logType, timestamp',

  ephemeras:
    '++id, characterId, templateType, title, createdAt',

  dailyOfferingImages:
    '++id, createdAt, updatedAt',

  dailyOfferings:
    'date, characterId, createdAt',

  askBoxQuestions:
    '++id, characterId, sender, isAnonymous, content, reply, replyAt, needPassword, password, isPasswordUnlocked, createdAt',

  parallelOrbits:
    '++id, chatId, characterId, timestamp',

  schedules:
    '++id, characterId, title, dayOfWeek, startTime, endTime, category, date, weeks, createdAt',

  scheduledMessages:
    '++id, chatId, characterId, status, scheduledFor, createdAt',

  memories: `
    ++id,
    &memoryId,
    chatId,
    type,
    status,
    importance,
    confidence,
    subject,
    topicKey,
    memoryScope,
    temporalStatus,
    createdAt,
    updatedAt,
    sourceState,
    normalizedContent,
    supersededByMemoryId,
    supersedesMemoryId,
    duplicateOfMemoryId,
    [chatId+status],
    [chatId+type+status],
    [chatId+normalizedContent],
    [chatId+topicKey],
    [chatId+temporalStatus]
  `,

  memoryCandidates: `
    ++id,
    &candidateId,
    chatId,
    type,
    status,
    priority,
    subject,
    topicKey,
    proposalType,
    targetMemoryId,
    createdAt,
    updatedAt,
    [chatId+status],
    [chatId+proposalType],
    [chatId+targetMemoryId],
    [chatId+topicKey]
  `,

  memoryRevisions:
    '++id, &revisionId, memoryId, chatId, action, createdAt',

  memoryJobs:
    '++id, &chatId, status, nextRunAt, lastProcessedMessageId, updatedAt',

  memorySettings:
    'key',

  characterStates: `
    &chatId,
    characterId,
    dominantEmotion,
    intensity,
    updatedAt,
    lastInteractionAt,
    [characterId+updatedAt]
  `,

  mcpConnections: `
    &id,
    enabled,
    endpoint,
    provider,
    transport,
    executionMode,
    bridgeId,
    status,
    authStatus,
    createdAt,
    updatedAt
  `,

  mcpTools: `
    &id,
    connectionId,
    toolName,
    enabled,
    riskLevel,
    updatedAt,
    [connectionId+toolName]
  `,

  mcpPermissions: `
    &id,
    connectionId,
    toolName,
    chatId,
    characterId,
    decision,
    scope,
    updatedAt,
    [connectionId+toolName],
    [chatId+connectionId+toolName],
    [characterId+connectionId+toolName]
  `,

  mcpActivities: `
    ++id,
    connectionId,
    toolName,
    chatId,
    characterId,
    source,
    automationId,
    executorId,
    status,
    errorCode,
    createdAt,
    [connectionId+createdAt],
    [chatId+createdAt],
    [source+createdAt]
  `,

  mcpOAuthSessions: `
    &id,
    connectionId,
    state,
    status,
    expiresAt,
    createdAt,
    updatedAt,
    [connectionId+status]
  `,

  mcpBridges: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpExecutors: `
    &id,
    endpoint,
    status,
    createdAt,
    updatedAt
  `,

  mcpAutomations: `
    &id,
    enabled,
    connectionId,
    toolName,
    executorId,
    triggerType,
    createdAt,
    updatedAt
  `,

  mcpAutomationRuns: `
    ++id,
    automationId,
    connectionId,
    status,
    startedAt,
    completedAt,
    [automationId+startedAt]
  `,

  newspapers:
    '++id, date, characterId, createdAt',

  marginNotes:
    '++id, date, characterId, language, createdAt',

  companionshipSessions: `
    ++id,
    chatId,
    characterId,
    status,
    nextTriggerAt,
    endsAt,
    updatedAt
  `,

  companionshipTurns: `
    ++id,
    sessionId,
    chatId,
    scheduledFor,
    status,
    createdAt,
    [sessionId+scheduledFor]
  `,

  companionshipEvents: `
    ++id,
    sessionId,
    chatId,
    type,
    createdAt,
    timestamp
  `,

  almanacConfigs:
    '&chatId, updatedAt',

  almanacRecords: `
    ++id,
    chatId,
    characterId,
    eventType,
    timestamp,
    dateKey,
    localHour,
    [chatId+dateKey],
    [chatId+eventType],
    [chatId+eventType+dateKey]
  `
});

db.version(36).stores({
  almanacConfigs:
    '&chatId, updatedAt, timezone',

  almanacRecords: `
    ++id,
    chatId,
    characterId,
    eventType,
    timestamp,
    dateKey,
    localHour,
    timezone,
    count,
    firstTimestamp,
    lastTimestamp,
    [chatId+dateKey],
    [chatId+eventType],
    [chatId+eventType+dateKey]
  `
});

db.version(37).stores({
  messages:
    '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex, [chatId+timestamp]',
 
  scheduledMessages:
    '++id, chatId, characterId, status, scheduledFor, createdAt, [status+scheduledFor]'
});

db.version(38).stores({
  almanacMilestones: `
    ++id,
    chatId,
    type,
    date,
    isRecurring,
    showCountdown,
    allowNaturalReminder,
    createdAt,
    updatedAt,
    [chatId+date],
    [chatId+type]
  `
});

db.version(39).stores({
  xinjiEntries:
    '++id, chatId, characterId, type, date, isRecurringYearly, createdAt',
});

db.version(40).stores({
  workflows: `
    ++id,
    chatId,
    characterId,
    enabled,
    lastRunDate,
    [chatId+enabled]
  `,
});

db.version(41).stores({
  workflowRuns: `
    ++id,
    workflowId,
    chatId,
    characterId,
    status,
    source,
    runAt,
    [workflowId+runAt]
  `,
});

db.version(42).stores({
  // 工作流/档案专属的用户主页配置，与全局 profile 彻底解耦
  // key 可以是 'user_profile' 或者角色专属自定义ID
  workflowProfiles: '&key, updatedAt',
});

db.version(43).stores({
  // 内心主页：每个chat一条，随日期滚动重置（密码、当日尝试次数）
  innerWorldAccess: `
    &chatId,
    characterId,
    date,
    password,
    attemptsUsed,
    isUnlocked,
    updatedAt
  `,

  // 内心主页：每天一条历史记录，用于心情/性格维度的成长曲线
  innerWorldEntries: `
    ++id,
    chatId,
    characterId,
    date,
    createdAt,
    updatedAt,
    [chatId+date]
  `,
});


db.version(44).stores({
  places: `
    ++id,
    chatId,
    name,
    lat,
    lng,
    radius,
    isNamed,
    firstVisitAt,
    lastVisitAt,
    visitCount,
    createdAt,
    [chatId+isNamed]
  `,
  locationSettings: `
    &chatId,
    enabled,
    currentPlaceId,
    pendingNamingPlaceId,
    lastCheckAt,
    updatedAt
  `,
});

db.version(45).stores({
  rhythmNotes: `
    ++id,
    scheduleId,
    characterId,
    date,
    content,
    createdAt,
    [scheduleId+date],
    [characterId+date]
  `
});

db.version(46).stores({
  messages:
    '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex, mode, offlineSessionId, [chatId+timestamp], [chatId+mode]',

  offlineSessions: `
    ++id,
    chatId,
    characterId,
    status,
    proposedBy,
    scheduledFor,
    createdAt,
    updatedAt,
    [chatId+status]
  `,

  archivedMessages:
    '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex, mode, offlineSessionId, archivedAt, [chatId+timestamp]',

  archiveStats:
    '&chatId, totalArchivedDays, totalArchivedMessages, lastArchivedAt, updatedAt',
});


// 追加在 src/db/index.js 的最后（在 db.version(46)... 之后）

db.version(47).stores({
  // snapshots 升级：增加 chatId, authorType, npcId 索引，便于按消息框沙盒快速筛选
  snapshots:
    '++id, chatId, characterId, authorType, npcId, createdAt, timestamp',

  // snapshotComments 升级：增加 chatId, senderType 索引
  snapshotComments:
    '++id, snapshotId, chatId, senderType, characterId, npcId, createdAt',

  // 独立主页表：每个 chatId 独立的 User 或 Char 资料
  // profileKey 格式: `user_${chatId}` 或 `char_${chatId}_${characterId}`
  snapshotProfiles:
    '&profileKey, chatId, targetType, targetId, updatedAt'
}).upgrade(async (tx) => {
  // 平滑迁移旧动态：如果有 linkedChatId 则写入 chatId，补齐 authorType
  await tx.table('snapshots').toCollection().modify((snapshot) => {
    if (!snapshot.chatId && snapshot.linkedChatId) {
      snapshot.chatId = Number(snapshot.linkedChatId);
    }
    if (!snapshot.authorType) {
      snapshot.authorType = snapshot.characterId ? 'character' : 'user';
    }
    if (!snapshot.createdAt) {
      snapshot.createdAt = snapshot.timestamp || Date.now();
    }
  });

  // 平滑迁移旧评论：补齐 createdAt 与 senderType
  await tx.table('snapshotComments').toCollection().modify((comment) => {
    if (!comment.senderType) {
      comment.senderType = comment.characterId ? 'character' : (comment.npcId ? 'npc' : 'user');
    }
    if (!comment.createdAt) {
      comment.createdAt = comment.timestamp || Date.now();
    }
  });
});

db.version(48).stores({
  // 轻提醒：用户自定义的生活化提醒（如"中午提醒吃保健品"）
  almanacReminders: `
    ++id,
    chatId,
    content,
    time,
    enabled,
    lastFiredDateKey,
    createdAt,
    updatedAt,
    [chatId+enabled]
  `,

  // 重要日期：简化版的生日/纪念日记录
  almanacImportantDates: `
    ++id,
    chatId,
    title,
    date,
    isRecurringYearly,
    createdAt,
    updatedAt,
    [chatId+date]
  `,
});

// ============================================================
// 【局部替换说明】
// 位置：src/db/index.js
// 操作：在现有 `db.version(48).stores({...});` 代码块之后、
//       `export default db;` 之前，插入下面这一整段 `db.version(49)`。
// 不要动 v48 及之前的任何代码，也不要删除 export default db; 之后的内容。
// ============================================================

db.version(49).stores({
  // NPC 改为按 chatId 专属：每个消息框/世界线拥有自己独立的 NPC 列表
  snapshotNpcs: `
    ++id,
    chatId,
    name,
    roleTag,
    avatar,
    createdAt,
    [chatId+createdAt]
  `,

  // snapshotRelations 结构改造：从"仅角色↔角色"扩展为通用的
  // "角色/NPC 之间任意组合的关系"，且限定在具体某个 chatId（世界线）下。
  // sourceType / targetType 取值: 'character' | 'npc'
  // 关系无方向性要求，查询时按需双向匹配。
  snapshotRelations: `
    ++id,
    chatId,
    sourceType,
    sourceId,
    targetType,
    targetId,
    relation,
    createdAt,
    [chatId+sourceType+sourceId],
    [chatId+targetType+targetId]
  `
}).upgrade(async (tx) => {
  // ---- 迁移 1：旧的全局 NPC 列表 -> 复制进所有已存在的 chats ----
  try {
    const oldNpcsSetting = await tx.table('snapshotSettings').get('npcs');
    const oldNpcs = oldNpcsSetting?.value || [];

    if (oldNpcs.length > 0) {
      const allChats = await tx.table('chats').toArray();
      const now = Date.now();

      for (const chat of allChats) {
        for (const npc of oldNpcs) {
          await tx.table('snapshotNpcs').add({
            chatId: chat.id,
            name: npc.name || '未命名NPC',
            roleTag: npc.roleTag || '路人NPC',
            avatar: npc.avatar || '',
            createdAt: now
          });
        }
      }
    }
  } catch (err) {
    console.error('[db v49 迁移] 复制旧 NPC 数据失败:', err);
  }

  // ---- 迁移 2：旧的 snapshotRelations（角色↔角色）-> 软废弃，物理保留 ----
  // 旧数据无法推断归属哪个 chatId，因此保留数据但标记 chatId: null，
  // 新的按 chatId 查询逻辑不会再读到这些记录，相当于软废弃，不物理删除。
  try {
    await tx.table('snapshotRelations').toCollection().modify((rel) => {
      if (rel.chatId === undefined) {
        rel.chatId = null;
        rel.sourceType = 'character';
        rel.sourceId = rel.characterId;
        rel.targetType = 'character';
        rel.targetId = rel.targetCharacterId;
      }
    });
  } catch (err) {
    console.error('[db v49 迁移] 软废弃旧 snapshotRelations 失败:', err);
  }
});

// ============================================================
// v50：一次性数据修复
// messages 表结构本身不变（索引跟 v46 一致），单纯为了挂一个
// upgrade 钩子，所以照抄一遍现有的 messages 索引声明。
// ============================================================
db.version(50).stores({
  messages:
    '++id, chatId, characterId, sender, type, metadata, quotedMessageId, isRead, timestamp, versions, currentVersionIndex, mode, offlineSessionId, [chatId+timestamp], [chatId+mode]',
}).upgrade(async (tx) => {
  // ---- 迁移：把 messages 表里数字型 timestamp（少数几处旧代码路径
  // 遗留下来的，比如发表情贴纸、提问箱转发消息）统一转换成字符串型
  // ISO 时间戳，跟其余绝大多数消息保持同一类型。
  // 原因：IndexedDB 的复合索引 [chatId+timestamp] 是先比较数据类型、
  // 再比较值的，数字和字符串混在一起会导致同一个聊天框里的消息
  // 按索引查询时整体分成两堆，顺序错乱。这里只改类型，不改语义上
  // 代表的具体时刻。 ----
  try {
    let fixedCount = 0;
    await tx.table('messages').toCollection().modify((msg) => {
      if (typeof msg.timestamp === 'number') {
        msg.timestamp = new Date(msg.timestamp).toISOString();
        fixedCount += 1;
      }
    });
    console.log(`[db v50 迁移] 已修复 ${fixedCount} 条消息的 timestamp 类型`);
  } catch (err) {
    console.error('[db v50 迁移] 修复 messages timestamp 类型失败:', err);
  }
});

export default db;


