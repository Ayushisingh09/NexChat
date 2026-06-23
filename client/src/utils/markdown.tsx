import React from 'react';

interface Segment {
  type: 'text' | 'bold' | 'italic' | 'code' | 'strikethrough' | 'link';
  content: string;
  url?: string;
}

const URL_PATTERN = /https?:\/\/\S+/g;

function linkify(text: string): React.ReactNode {
  const parts = text.split(URL_PATTERN);
  return parts.map((part, j) => {
    const isUrl = URL_PATTERN.test(part);
    URL_PATTERN.lastIndex = 0;
    return isUrl ? (
      <a key={j} href={part} target="_blank" rel="noreferrer"
        className="text-sky-400 hover:underline break-all">
        {part}
      </a>
    ) : (
      <span key={j}>{part}</span>
    );
  });
}

export function parseMarkdown(text: string): React.ReactNode {
  const segments: Segment[] = [];
  let remaining = text;

  const patterns: [RegExp, (match: RegExpExecArray) => Segment][] = [
    [/`([^`]+)`/g, (m) => ({ type: 'code', content: m[1] })],
    [/\*\*(.+?)\*\*/g, (m) => ({ type: 'bold', content: m[1] })],
    [/\*(.+?)\*/g, (m) => ({ type: 'italic', content: m[1] })],
    [/~~(.+?)~~/g, (m) => ({ type: 'strikethrough', content: m[1] })],
  ];

  while (remaining.length > 0) {
    let earliestIndex = remaining.length;
    let earliestMatch: { patternIndex: number; match: RegExpExecArray } | null = null;

    for (let i = 0; i < patterns.length; i++) {
      const regex = new RegExp(patterns[i][0].source, 'g');
      const match = regex.exec(remaining);
      if (match && match.index < earliestIndex) {
        earliestIndex = match.index;
        earliestMatch = { patternIndex: i, match };
      }
    }

    if (!earliestMatch) break;

    const { patternIndex, match } = earliestMatch;
    if (match.index > 0) {
      segments.push({ type: 'text', content: remaining.slice(0, match.index) });
    }
    segments.push(patterns[patternIndex][1](match));
    remaining = remaining.slice(match.index + match[0].length);
  }

  if (remaining.length > 0) {
    segments.push({ type: 'text', content: remaining });
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <React.Fragment key={`seg-${i}`}>{linkify(seg.content)}</React.Fragment>;
        if (seg.type === 'bold') return <strong key={`seg-${i}`}>{seg.content}</strong>;
        if (seg.type === 'italic') return <em key={`seg-${i}`}>{seg.content}</em>;
        if (seg.type === 'code') return (
          <code key={`seg-${i}`} className="bg-black/30 px-1.5 py-0.5 rounded text-[13px] font-mono">
            {seg.content}
          </code>
        );
        if (seg.type === 'strikethrough') return <del key={`seg-${i}`} className="opacity-60">{seg.content}</del>;
        return <span key={`seg-${i}`}>{seg.content}</span>;
      })}
    </>
  );
}
