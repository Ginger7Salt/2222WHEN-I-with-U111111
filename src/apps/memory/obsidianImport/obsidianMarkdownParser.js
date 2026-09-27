// Obsidian markdown note parser.
//
// Pure, synchronous, defensive: turns one .md file's raw text into a note
// title + frontmatter + a flat list of heading-based sections. No DB access
// and no File/Blob APIs here on purpose - see obsidianImportService.js for
// reading files and writing parsed sections into memories.

import { MEMORY_TYPE_OPTIONS, MEMORY_TYPES } from '../memoryConstants';

const VALID_MEMORY_TYPES = new Set(Object.values(MEMORY_TYPES));

const TYPE_LABEL_BY_ID = new Map(
  MEMORY_TYPE_OPTIONS.map((option) => [option.id, option.label])
);

const TYPE_ID_BY_LABEL = new Map(
  MEMORY_TYPE_OPTIONS.map((option) => [option.label, option.id])
);

// The one line this project's Obsidian export writes right under each
// memory's heading, and the one line parseObsidianNote() below recognizes
// on the way back in - kept as a matched read/write pair here so the two
// directions can never drift out of sync with each other. Anything that
// doesn't match this exact shape is just left as ordinary note content,
// so a plain, hand-written Obsidian note is completely unaffected.
const MEMORY_METADATA_LINE_PATTERN = (
  /^>\s*类型[:：]\s*(.+?)\s*[·,，]\s*重要度[:：]\s*([1-5])\s*$/
);

export const buildMemoryMetadataLine = ({ type, importance }) => {
  const label = TYPE_LABEL_BY_ID.get(type)
    || TYPE_LABEL_BY_ID.get(MEMORY_TYPES.FACT);

  const safeImportance = Math.min(
    5,
    Math.max(1, Math.round(Number(importance) || 3))
  );

  return `> 类型：${label} · 重要度：${safeImportance}`;
};

// Looks for the metadata line as the very first line of a section's
// content. Returns null (leaving the section untouched) unless the line
// matches exactly and its type label is one this project recognizes -
// a manually edited or unrelated blockquote line is never mistaken for it.
const extractMemoryMetadataLine = (content) => {
  const lines = String(content || '').split(/\r?\n/);
  const match = lines[0]?.match(MEMORY_METADATA_LINE_PATTERN);

  if (!match) return null;

  const [, label, importanceText] = match;
  const type = TYPE_ID_BY_LABEL.get(label.trim());

  if (!type) return null;

  return {
    type,
    importance: Number(importanceText),
    remainingContent: lines.slice(1).join('\n').trim()
  };
};

const FRONTMATTER_DELIMITER = /^---\s*$/;

const stripQuotes = (value) => {
  const trimmed = String(value || '').trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const parseInlineListValue = (value) => {
  const trimmed = value.trim();

  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null;
  }

  const inner = trimmed.slice(1, -1).trim();

  if (!inner) return [];

  return inner
    .split(',')
    .map((item) => stripQuotes(item))
    .filter(Boolean);
};

// A minimal, defensive frontmatter reader - handles the common Obsidian
// shapes (scalar values, inline "[a, b]" lists, and simple "- item" block
// lists) without pulling in a full YAML parser. Anything it can't
// confidently parse is left as a raw string rather than thrown away, and a
// missing/malformed frontmatter block never blocks parsing the note body.
export const parseFrontmatter = (rawText) => {
  const text = String(rawText || '').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);

  if (!FRONTMATTER_DELIMITER.test(lines[0] || '')) {
    return { frontmatter: {}, body: text };
  }

  let endIndex = -1;

  for (let i = 1; i < lines.length; i += 1) {
    if (FRONTMATTER_DELIMITER.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    // Unterminated "---" block - treat the whole thing as body rather
    // than silently dropping the note's content.
    return { frontmatter: {}, body: text };
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const bodyLines = lines.slice(endIndex + 1);
  const frontmatter = {};

  let currentListKey = null;

  for (const line of frontmatterLines) {
    const listItemMatch = line.match(/^\s*-\s+(.*)$/);

    if (listItemMatch && currentListKey) {
      if (!Array.isArray(frontmatter[currentListKey])) {
        frontmatter[currentListKey] = [];
      }

      frontmatter[currentListKey].push(stripQuotes(listItemMatch[1]));
      continue;
    }

    const keyValueMatch = line.match(
      /^\s*([A-Za-z0-9_\-一-鿿]+)\s*:\s*(.*)$/
    );

    if (!keyValueMatch) {
      currentListKey = null;
      continue;
    }

    const [, key, rawValue] = keyValueMatch;

    if (!rawValue.trim()) {
      // Empty value on this line usually means a "- item" block list
      // follows on the next lines.
      currentListKey = key;
      frontmatter[key] = [];
      continue;
    }

    currentListKey = null;

    const inlineList = parseInlineListValue(rawValue);

    frontmatter[key] = inlineList !== null
      ? inlineList
      : stripQuotes(rawValue);
  }

  return {
    frontmatter,
    body: bodyLines.join('\n')
  };
};

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;

const cleanHeadingText = (value) => (
  String(value || '')
    .replace(/#+\s*$/, '')
    .trim()
);

// Splits a note body into heading-based sections. Every heading line (any
// level) starts a new section, and a section's content is everything up to
// the next heading line regardless of level - this keeps the mapping
// predictable (each heading becomes its own memory entry) rather than
// nesting subsections' text inside their parent's entry. Content that
// appears before the first heading becomes its own leading section, using
// the note's own title as a fallback heading.
export const splitBodyIntoSections = (body, fallbackTitle = '') => {
  const lines = String(body || '').split(/\r?\n/);
  const sections = [];

  const leadingLines = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) return;

    const content = current.contentLines.join('\n').trim();

    if (content) {
      sections.push({
        title: current.title,
        level: current.level,
        content
      });
    }

    current = null;
  };

  for (const line of lines) {
    const headingMatch = line.match(HEADING_PATTERN);

    if (headingMatch) {
      pushCurrent();

      current = {
        title: cleanHeadingText(headingMatch[2]) || '未命名标题',
        level: headingMatch[1].length,
        contentLines: []
      };

      continue;
    }

    if (current) {
      current.contentLines.push(line);
    } else {
      leadingLines.push(line);
    }
  }

  pushCurrent();

  const leadingContent = leadingLines.join('\n').trim();

  if (leadingContent) {
    sections.unshift({
      title: fallbackTitle || '笔记正文',
      level: 0,
      content: leadingContent
    });
  }

  return sections;
};

const deriveNoteTitle = (fileName, frontmatter) => {
  const fmTitle = String(frontmatter?.title || '').trim();

  if (fmTitle) return fmTitle;

  const baseName = String(fileName || '')
    .split('/')
    .pop()
    .replace(/\.md$/i, '')
    .trim();

  return baseName || '未命名笔记';
};

const normalizeFrontmatterType = (value) => {
  const raw = String(value || '').trim().toLowerCase();

  return VALID_MEMORY_TYPES.has(raw) ? raw : null;
};

const normalizeFrontmatterImportance = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return null;

  return Math.min(5, Math.max(1, Math.round(numberValue)));
};

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
};

// Parses one note's raw markdown text into a title, its frontmatter, and a
// flat list of importable entries (one per heading-level section, per the
// confirmed "按标题分块" design). Each entry carries its own client-side id
// so the import UI can let the user pick which ones to bring in, and an
// optional per-entry type/importance - taken from this project's own
// "> 类型：... · 重要度：n" marker line when a section starts with one (see
// above; this is how re-importing this project's own Obsidian export
// recovers the original type/importance instead of falling back to the
// import screen's defaults), otherwise from the note's frontmatter, when
// it specifies one (falling back to whatever default the import screen
// picks otherwise).
//
// `relativePath` is optional and only meaningful when the note came from a
// folder scan (the watch-folder entry point) rather than a flat file picker
// - it disambiguates same-named notes living in different subfolders, so
// callers that recurse into subfolders should always pass it. It falls
// back to `fileName` for the plain multi-file-picker path, which never
// exposes folder structure.
export const parseObsidianNote = (fileName, rawText, { relativePath = '' } = {}) => {
  const { frontmatter, body } = parseFrontmatter(rawText);
  const noteTitle = deriveNoteTitle(fileName, frontmatter);
  const rawSections = splitBodyIntoSections(body, noteTitle);
  const identityPath = relativePath || fileName;

  const entries = rawSections.map((section, index) => {
    const metadataMatch = extractMemoryMetadataLine(section.content);

    return {
      clientEntryId: `${identityPath}::${index}::${section.title}`,
      title: section.title,
      content: metadataMatch
        ? metadataMatch.remainingContent
        : section.content,
      level: section.level,
      type: metadataMatch?.type
        || normalizeFrontmatterType(frontmatter.type),
      importance: metadataMatch?.importance
        || normalizeFrontmatterImportance(frontmatter.importance)
    };
  });

  return {
    fileName,
    relativePath: identityPath,
    noteTitle,
    frontmatter,
    tags: normalizeTags(frontmatter.tags),
    entries
  };
};