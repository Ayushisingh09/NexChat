import 'highlight.js/styles/a11y-dark.css';
import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Download } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

function extractLanguage(children: React.ReactNode): string {
  const child = React.Children.toArray(children)[0];
  if (React.isValidElement(child) && child.props && typeof child.props === 'object' && 'className' in child.props) {
    const className = (child.props as any).className;
    if (typeof className === 'string') {
      const match = className.match(/language-(\w+)/);
      if (match) return match[1];
    }
  }
  return '';
}

function extractText(children: React.ReactNode): string {
  const child = React.Children.toArray(children)[0];
  if (React.isValidElement(child) && child.props && typeof child.props === 'object' && 'children' in child.props) {
    const kids = (child.props as any).children;
    if (typeof kids === 'string') return kids;
  }
  if (typeof child === 'string') return child;
  return '';
}

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [copied, setCopied] = useState(false);
  const language = extractLanguage(children);
  const text = extractText(children);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [text]);

  const handleDownload = useCallback(() => {
    const ext = language || 'txt';
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [text, language]);

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-white/[0.06] bg-black/40 max-w-full min-w-0">
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/[0.04] border-b border-white/[0.06]">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{language || 'code'}</span>
        <div className="flex items-center gap-1 transition">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
            aria-label="Copy code"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
            aria-label="Download code"
          >
            <Download className="w-3 h-3" />
            Download
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto max-w-full p-4 text-[13px] leading-relaxed">{children}</pre>
    </div>
  );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-invert max-w-none text-[14px] leading-relaxed overflow-hidden min-w-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return <code className="px-1.5 py-0.5 rounded-md bg-white/[0.08] text-emerald-300 text-[13px] font-mono" {...props}>{children}</code>;
            }
            return <code className={`${className || ''} block text-[13px] font-mono leading-relaxed`} {...props}>{children}</code>;
          },
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-white/90">{children}</li>,
          h1: ({ children }) => <h1 className="text-lg font-bold mb-3 mt-5 text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-4 text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[15px] font-semibold mb-2 mt-3 text-white">{children}</h3>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-emerald-500/50 pl-4 my-3 text-zinc-400 italic">{children}</blockquote>,
          table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full border-collapse text-[13px]">{children}</table></div>,
          thead: ({ children }) => <thead className="bg-white/[0.06]">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 text-left text-zinc-300 font-medium border-b border-white/[0.08]">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 border-b border-white/[0.06] text-white/80">{children}</td>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">{children}</a>,
          hr: () => <hr className="border-white/[0.08] my-4" />,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-white/90">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
