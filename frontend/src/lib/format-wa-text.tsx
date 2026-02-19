import React from 'react';

/**
 * Parse WhatsApp formatting syntax and return React elements.
 * Supports: *bold*, _italic_, ~strikethrough~, ```monospace```
 */
export function formatWAText(text: string): React.ReactNode {
  if (!text) return text;

  // Process ```monospace``` first (multi-char delimiter, greedy-safe)
  const parts = text.split(/(```[\s\S]+?```)/g);

  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```') && part.length > 6) {
      const inner = part.slice(3, -3);
      return (
        <code key={i} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
          {inner}
        </code>
      );
    }
    return <React.Fragment key={i}>{formatInline(part)}</React.Fragment>;
  });
}

/**
 * Process inline formatting: *bold*, _italic_, ~strikethrough~
 * Uses a single regex pass to handle all three inline formats.
 */
function formatInline(text: string): React.ReactNode {
  // Match *bold*, _italic_, ~strikethrough~ — must not be empty inside
  const regex = /(\*[^\s*](?:[^*]*[^\s*])?\*|_[^\s_](?:[^_]*[^\s_])?_|~[^\s~](?:[^~]*[^\s~])?~)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const full = match[0];
    const char = full[0];
    const inner = full.slice(1, -1);

    if (char === '*') {
      parts.push(<strong key={match.index}>{inner}</strong>);
    } else if (char === '_') {
      parts.push(<em key={match.index}>{inner}</em>);
    } else if (char === '~') {
      parts.push(<s key={match.index}>{inner}</s>);
    }

    lastIndex = match.index + full.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}
