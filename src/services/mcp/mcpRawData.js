const parseJsonText = (value) => {
  if (typeof value !== 'string') return null;

  let text = value.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(text);
  } catch {}

  const starts = [text.indexOf('{'), text.indexOf('[')]
    .filter((index) => index >= 0);

  if (!starts.length) return null;

  const start = Math.min(...starts);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));

  if (end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

export const parseToolRawData = (toolResult) => {
  if (toolResult == null) return null;

  const root =
    toolResult?.result && typeof toolResult.result === 'object'
      ? toolResult.result
      : toolResult;

  if (
    root &&
    typeof root === 'object' &&
    root.structuredContent !== undefined &&
    root.structuredContent !== null
  ) {
    return typeof root.structuredContent === 'string'
      ? parseJsonText(root.structuredContent)
      : root.structuredContent;
  }

  if (typeof root === 'string') {
    return parseJsonText(root) || root;
  }

  const textPart = Array.isArray(root?.content)
    ? root.content.find((part) => part?.type === 'text')
    : null;

  const parsedText = parseJsonText(textPart?.text);

  if (parsedText !== null) return parsedText;

  return root;
};

export const getToolText = (toolResult) => {
  const root =
    toolResult?.result && typeof toolResult.result === 'object'
      ? toolResult.result
      : toolResult;

  if (typeof root === 'string') return root;

  return Array.isArray(root?.content)
    ? root.content
        .filter((part) => part?.type === 'text')
        .map((part) => part.text)
        .join('\n')
    : '';
};
