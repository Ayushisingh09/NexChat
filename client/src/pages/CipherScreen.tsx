import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Send, Plus, MessageSquare, X, Loader2, AlertCircle,
  PanelLeftOpen, PanelLeftClose, Menu, ChevronLeft, Home, SlidersHorizontal,
  Copy, Check, RefreshCw, Search, Download, GitFork, Mic, MicOff, MoreVertical,
  Pencil, Trash, User, ThumbsUp, ThumbsDown, Sparkles,
} from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import { CipherLogo } from '../components/layout/CipherLogo';
import { useCipher } from '../hooks/useCipher';
import MarkdownRenderer from '../components/chat/MarkdownRenderer';
import { LoadingBreadcrumb } from '@/components/ui/animated-loading-svg-text-shimmer';
import { motion } from 'framer-motion';

const ALL_SUGGESTIONS = [
  'Explain quantum computing in simple terms',
  'Write a poem about artificial intelligence',
  'Help me debug a JavaScript async/await issue',
  'What are the best practices for React performance?',
  'Give me a daily productivity routine',
  'Summarize the theory of relativity',
  'Write a short story about time travel',
  'Explain how blockchain works',
  'What is the meaning of life?',
  'Compare REST vs GraphQL API design',
  'Teach me how to meditate',
  'Explain machine learning like I am 10',
  'Write a cover letter for a software job',
  'What are the laws of thermodynamics?',
  'Help me plan a healthy weekly meal prep',
  'Describe the Roman Empire briefly',
  'What is the best way to learn a new language?',
  'Write a haiku about the ocean',
  'Explain how encryption works',
  'Give me tips for public speaking',
];

function pickSuggestions(count = 5): string[] {
  return [...ALL_SUGGESTIONS].sort(() => Math.random() - 0.5).slice(0, count);
}

function SidebarSkeleton() {
  return (
    <div className="space-y-1 px-3 py-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-4 h-4 rounded bg-white/[0.04] animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-3.5 rounded-full bg-white/[0.04] animate-pulse mb-1.5" style={{ width: `${60 + (i % 3) * 15}%` }} />
            <div className="h-2.5 rounded-full bg-white/[0.03] animate-pulse w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

const CipherScreen: React.FC = () => {
  const navigate = useNavigate();
  const { conversationId: urlConvId } = useParams<{ conversationId?: string }>();
  const {
    messages, conversations, activeConversationId, sendMessage, loading, streamingContent,
    usage, error, clearHistory, selectConversation, createNewConversation, deleteConversation,
    retry, customPrompt, updateCustomPrompt, tier, regenerate, searchMessages, searchResults,
    searchQuery, setSearchQuery, setSearchResults, showSearch, setShowSearch, exportConversation, createBranch,
    startVoiceInput, isListening, voiceTranscript,
    renameConversation, conversationsLoading, loadMoreConversations, submitFeedback,
  } = useCipher(urlConvId);

  const [input, setInput] = useState('');
  const [suggestions] = useState(() => pickSuggestions());
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'good' | 'bad'>>({});
  const [reasonForId, setReasonForId] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [thankYouId, setThankYouId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounce = useRef<any>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    document.body.style.overflow = showMobileSidebar || showSettings ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showMobileSidebar, showSettings]);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [openMenuId]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    sendMessage(text);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSelectConversation = useCallback((id: string | null) => {
    selectConversation(id);
    setShowMobileSidebar(false);
    if (id) {
      window.history.replaceState(null, '', `/cipher/${id}`);
    } else {
      window.history.replaceState(null, '', '/cipher');
    }
  }, [selectConversation]);

  const handleCopy = async (id: string, content: string) => {
    try { await navigator.clipboard.writeText(content); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {}
  };

  const handleRegenerate = async (id: string) => {
    setRegeneratingId(id);
    await regenerate(id);
    setRegeneratingId(null);
  };

  const BAD_REASON_SUGGESTIONS = [
    'Inaccurate or incorrect information',
    'Too verbose / not concise enough',
    'Did not understand my question',
    'Response was not helpful',
    'Tone or style was inappropriate',
  ];

  const handleFeedback = async (id: string, type: 'good' | 'bad') => {
    if (type === 'good') {
      try {
        await submitFeedback(id, type);
        setFeedbackGiven((prev) => ({ ...prev, [id]: type }));
        setThankYouId(id);
        setTimeout(() => setThankYouId(null), 2500);
      } catch {}
      return;
    }
    setReasonForId(id);
    setReasonText('');
  };

  const submitReason = async (id: string) => {
    const reason = reasonText.trim();
    setReasonForId(null);
    setReasonText('');
    setFeedbackGiven((prev) => ({ ...prev, [id]: 'bad' }));
    try { await submitFeedback(id, 'bad', reason || undefined); } catch {}
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => searchMessages(val), 300);
  };

  const searchResultConvName = (convId: string) => {
    return conversations.find((c) => c.id === convId)?.title || 'Unknown';
  };

  const startRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentTitle);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      renameConversation(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
    if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
  };

  const handleSidebarScroll = useCallback(() => {
    if (!sidebarScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = sidebarScrollRef.current;
    if (scrollHeight - scrollTop - clientHeight < 80) {
      loadMoreConversations();
    }
  }, [loadMoreConversations]);

  const isUnlimited = usage && usage.dailyLimit === null;
  const usagePercent = usage && usage.dailyLimit ? (usage.tokensUsed / usage.dailyLimit) * 100 : 0;
  const usageColor = usagePercent >= 80 ? 'bg-red-500' : usagePercent >= 50 ? 'bg-yellow-500' : 'bg-wa-accent';

  const canExport = tier?.tier?.features?.exportChat;
  const canBranch = tier?.tier?.features?.branching;
  const canSearch = tier?.tier?.features?.search;
  const canVoice = tier?.tier?.features?.voiceInput;

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.05]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Conversations</span>
        <button onClick={createNewConversation} className="p-1 text-zinc-500 hover:text-white rounded hover:bg-white/10 transition" aria-label="New conversation"><Plus className="w-4 h-4" /></button>
      </div>
      <div ref={sidebarScrollRef} onScroll={handleSidebarScroll} className="flex-1 overflow-y-auto scrollbar-none">
        {conversationsLoading && conversations.length === 0 ? (
          <SidebarSkeleton />
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-[12px] text-zinc-600">No conversations yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleSelectConversation(conv.id)}
              className={`group w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors cursor-pointer ${conv.id === activeConversationId ? 'bg-wa-accent/10 text-white border-r-2 border-wa-accent' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'}`}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <div className="flex-1 min-w-0">
                {renamingId === conv.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={handleRenameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-[13px] font-medium bg-white/[0.06] text-white rounded px-1.5 py-0.5 outline-none border border-white/20"
                    maxLength={80}
                  />
                ) : (
                  <p className="text-[13px] font-medium truncate">{conv.title}</p>
                )}
                <p className="text-[10px] text-zinc-600">{conv._count?.messages || 0} messages</p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                <button
                  onClick={(e) => startRename(conv.id, conv.title, e)}
                  className="p-1 text-zinc-600 hover:text-white rounded transition"
                  aria-label="Rename"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="p-1 text-zinc-600 hover:text-red-400 rounded transition"
                  aria-label="Delete"
                >
                  <Trash className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
        {conversationsLoading && conversations.length > 0 && (
          <div className="py-2 text-center">
            <Loader2 className="w-4 h-4 text-zinc-600 animate-spin mx-auto" />
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="h-screen bg-[#1a1a1e] text-white flex flex-col">
      <TopBar
        title={tier ? `Cipher (${tier.tier.name})` : 'Cipher'}
        onBack={() => navigate('/chat')}
        leftAction={
          <div className="flex items-center gap-0.5">
            <button onClick={() => setShowMobileSidebar(true)} className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition md:hidden" aria-label="Open conversations"><Menu className="w-5 h-5" /></button>
            <button onClick={() => navigate('/chat')} className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition" aria-label="Home"><Home className="w-5 h-5" /></button>
          </div>
        }
        rightAction={
          <div className="flex items-center gap-1">
            {canSearch && (
              <button onClick={() => setShowSearch((v) => !v)} className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition" aria-label="Search"><Search className="w-5 h-5" /></button>
            )}
            <button onClick={() => setShowSidebar((v) => !v)} className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition hidden md:block" aria-label="Toggle sidebar">
              {showSidebar ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
            <button onClick={createNewConversation} className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition" aria-label="New conversation"><Plus className="w-5 h-5" /></button>
            <button onClick={() => setShowSettings(true)} className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition" aria-label="Settings"><SlidersHorizontal className="w-5 h-5" /></button>
          </div>
        }
      />

      {showSearch && (
        <div className="bar-glass border-b border-white/[0.05] px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 bg-white/[0.06] rounded-xl px-3 py-2 border border-white/[0.08] focus-within:border-emerald-500/50 transition">
              <Search className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search all Cipher messages..."
                className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder-zinc-500"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto scrollbar-none">
                {searchResults.slice(0, 20).map((r) => (
                  <button key={r.id} onClick={() => { selectConversation(r.conversationId); setShowSearch(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.04] text-[12px] transition">
                    <span className="text-zinc-500">{searchResultConvName(r.conversationId)}</span>
                    <p className="text-zinc-300 truncate mt-0.5">{r.content.slice(0, 120)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {showSidebar && (
          <div className="hidden md:flex w-64 shrink-0 border-r border-white/[0.05] flex-col bg-[#141416]">{sidebarContent}</div>
        )}

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {messages.length === 0 && !loading ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
              {/* animated glow background */}
              <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full filter blur-[128px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-[128px] animate-pulse [animation-delay:700ms]" />
                <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-fuchsia-500/10 rounded-full filter blur-[96px] animate-pulse [animation-delay:1000ms]" />
              </div>
              <motion.div
                className="relative z-10 flex flex-col items-center w-full max-w-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-600/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center mb-5 shadow-lg"><CipherLogo className="w-9 h-9 text-amber-400" /></div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="inline-block"
                >
                  <h2 className="text-3xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 to-white/40 pb-1">How can I help today?</h2>
                  <motion.div
                    className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: '100%', opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                  />
                </motion.div>
                <motion.p
                  className="text-[13px] text-white/40 mt-3 mb-8 max-w-xs leading-relaxed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  I'm Cipher, your AI assistant. Ask me anything — I'm here to help.
                </motion.p>
                <div className="flex items-center justify-center flex-wrap gap-2.5 w-full">
                  {suggestions.map((s, i) => (
                    <motion.button
                      key={s}
                      onClick={() => { sendMessage(s); }}
                      className="group flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[13px] text-zinc-300 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.16] transition active:scale-[0.97] leading-snug backdrop-blur-md"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.06 }}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400/70 group-hover:text-amber-400 transition shrink-0" />
                      <span className="text-left">{s}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 scrollbar-none min-w-0">
              <div className="max-w-3xl mx-auto space-y-6 w-full min-w-0">
                {messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  const isConsecutive = idx > 0 && messages[idx - 1].role === msg.role;
                  const isRegenerating = regeneratingId === msg.id;
                  return (
                    <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-3 ${isConsecutive ? 'mt-1' : 'mt-6'} ${isUser ? 'animate-msg-in-right' : 'animate-msg-in-left'}`}>
                      {!isUser && (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-600/30 to-orange-500/20 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <CipherLogo className="w-[18px] h-[18px] text-amber-400" />
                        </div>
                      )}
                      {isUser ? (
                        <div className="group relative max-w-[85%] min-w-0">
                          <div className="px-4 py-2.5 bg-white/[0.07] rounded-2xl rounded-br-md border border-white/[0.06]">
                            <p className="text-[14px] leading-relaxed text-white/90 whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-1 px-1">
                            <span className="text-[9px] text-white/30">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1 max-w-full md:max-w-[85%]">
                          {isRegenerating ? (
                            <div className="flex items-center gap-2 py-1"><Loader2 className="w-4 h-4 animate-spin text-emerald-400" /><span className="text-[13px] text-zinc-400">Regenerating...</span></div>
                          ) : (
                            <div className="min-w-0 break-words"><MarkdownRenderer content={msg.content} /></div>
                          )}
                          {!isRegenerating && (
                            <>
                              <div className="flex items-center flex-wrap gap-1 mt-2">
                                <button onClick={() => handleFeedback(msg.id, 'good')} className={`p-1.5 rounded-lg transition ${feedbackGiven[msg.id] === 'good' ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/[0.06]'}`} aria-label="Good response" title="Good response">
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleFeedback(msg.id, 'bad')} className={`p-1.5 rounded-lg transition ${feedbackGiven[msg.id] === 'bad' ? 'text-red-400 bg-red-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/[0.06]'}`} aria-label="Bad response" title="Bad response">
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleCopy(msg.id, msg.content)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition" aria-label="Copy" title="Copy">
                                  {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => handleRegenerate(msg.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition" aria-label="Regenerate" title="Regenerate">
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                {(canBranch || canExport) && (
                                  <div className="relative">
                                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === msg.id ? null : msg.id); }} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition" aria-label="More options">
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </button>
                                    {openMenuId === msg.id && (
                                      <div className="absolute bottom-full left-0 mb-1 z-50 bg-zinc-800 border border-white/[0.1] rounded-xl shadow-pop py-1 min-w-[160px] animate-scale-in" onClick={(e) => e.stopPropagation()}>
                                        {canBranch && (
                                          <button onClick={() => { createBranch(msg.id); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-zinc-300 hover:text-white hover:bg-white/[0.06] transition">
                                            <GitFork className="w-3.5 h-3.5" /> Branch from here
                                          </button>
                                        )}
                                        {canExport && activeConversationId && (
                                          <button onClick={() => { exportConversation('md'); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-zinc-300 hover:text-white hover:bg-white/[0.06] transition">
                                            <Download className="w-3.5 h-3.5" /> Export chat
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <span className="text-[9px] text-white/25 ml-1">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>

                              {thankYouId === msg.id && (
                                <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
                                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span className="text-[12px] text-emerald-300">Thanks for your feedback!</span>
                                </div>
                              )}

                              {reasonForId === msg.id && (
                                <div className="mt-2 max-w-md animate-fade-in">
                                  <p className="text-[12px] text-zinc-400 mb-2 font-medium">What was the issue?</p>
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {BAD_REASON_SUGGESTIONS.map((s) => (
                                      <button key={s} onClick={() => { setReasonText(s); submitReason(msg.id); }}
                                        className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[11px] text-zinc-300 hover:text-white hover:border-white/20 transition">
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      autoFocus
                                      value={reasonText}
                                      onChange={(e) => setReasonText(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') submitReason(msg.id); if (e.key === 'Escape') { setReasonForId(null); setReasonText(''); } }}
                                      placeholder="Or type your own reason..."
                                      maxLength={1000}
                                      className="flex-1 min-w-0 bg-white/[0.06] text-[12px] text-white rounded-lg px-3 py-2 outline-none border border-white/[0.08] focus:border-red-500/40 placeholder-zinc-600 transition"
                                    />
                                    <button onClick={() => submitReason(msg.id)} className="px-3 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-[12px] font-medium transition shrink-0">Send</button>
                                    <button onClick={() => { setReasonForId(null); setReasonText(''); }} className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition shrink-0"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {isUser && (
                        <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4 text-zinc-400" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {loading && streamingContent && (
                  <div className="flex justify-start items-start gap-2.5 animate-msg-in-left">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-600/30 to-orange-500/20 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <CipherLogo className="w-[18px] h-[18px] text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1 max-w-full md:max-w-[85%] break-words">
                      <MarkdownRenderer content={streamingContent} />
                      <span className="inline-block w-2 h-4 ml-0.5 bg-emerald-400 rounded-sm animate-pulse align-text-bottom" />
                    </div>
                  </div>
                )}

                {loading && !streamingContent && (
                  <div className="flex justify-start items-start gap-2.5 animate-msg-in-left">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-600/30 to-orange-500/20 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <CipherLogo className="w-[18px] h-[18px] text-amber-400" />
                    </div>
                    <div className="dark px-1 py-2.5">
                      <LoadingBreadcrumb text="Thinking" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {usage && messages.length > 0 && !isUnlimited && (
            <div className="px-4 py-2 bar-glass border-t border-white/[0.05]">
              <div className="max-w-3xl mx-auto flex items-center justify-between mb-1">
                <span className="text-[10px] text-zinc-500">{usage.tokensUsed.toLocaleString()} / {usage.dailyLimit!.toLocaleString()} tokens</span>
                {usagePercent >= 80 && <span className="text-[10px] text-red-400 font-medium">{Math.round(usagePercent)}% used</span>}
              </div>
              <div className="max-w-3xl mx-auto h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${usageColor}`} style={{ width: `${Math.min(usagePercent, 100)}%` }} />
              </div>
            </div>
          )}
          {isUnlimited && messages.length > 0 && (
            <div className="px-4 py-2 bar-glass border-t border-white/[0.05] text-center">
              <span className="text-[10px] text-emerald-400 font-medium">Unlimited tokens — no daily limit</span>
            </div>
          )}

          {error && (
            <div className="px-4 py-2.5 flex items-center justify-between bg-red-500/10 border-t border-red-500/20">
              <div className="flex items-center gap-2 text-[12px] text-red-300"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>
              <button onClick={retry} className="text-[11px] text-red-400 hover:text-red-300 font-semibold underline">Retry</button>
            </div>
          )}

          <div className="px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <div className="flex items-end gap-2.5 max-w-3xl mx-auto w-full backdrop-blur-2xl bg-white/[0.02] rounded-2xl border border-white/[0.06] focus-within:border-violet-500/30 shadow-2xl px-3 py-2 transition-colors">
              {canVoice && (
                <div className="relative">
                  {isListening && (
                    <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ backgroundColor: 'rgb(239,68,68)' }} />
                  )}
                  <button onClick={startVoiceInput} disabled={loading}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition shrink-0 relative z-10 ${
                      isListening
                        ? 'bg-red-500/20 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                        : 'text-zinc-500 hover:text-white hover:bg-white/[0.06]'
                    }`}
                    aria-label="Voice input"
                    title={canVoice ? 'Voice input' : 'Voice input not available in your plan'}>
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  {isListening && (
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-red-400 font-medium whitespace-nowrap">Listening...</span>
                  )}
                </div>
              )}
              <textarea ref={textareaRef} value={isListening ? voiceTranscript : input}
                onChange={(e) => { if (!isListening && e.target.value.length <= 2000) setInput(e.target.value); }}
                onKeyDown={isListening ? undefined : handleKeyDown}
                placeholder={isListening ? 'Listening...' : 'Message Cipher...'} rows={1}
                className="flex-1 bg-transparent text-[14px] text-white/90 px-2 py-3 max-h-[144px] outline-none resize-none border-none placeholder-zinc-500 transition scrollbar-none"
                disabled={loading}
              />
              <div className="flex items-center gap-2">
                {input.length > 1800 && (
                  <span className={`text-[10px] tabular-nums ${input.length >= 2000 ? 'text-red-400' : 'text-zinc-500'}`}>{input.length}/2000</span>
                )}
                <motion.button onClick={handleSend} disabled={!input.trim() || loading}
                  whileTap={{ scale: 0.9 }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition shrink-0 ${
                    input.trim() && !loading
                      ? 'bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-[0_0_16px_rgba(139,92,246,0.35)] hover:brightness-110'
                      : 'bg-white/[0.05] text-white/40 cursor-not-allowed'
                  }`}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowMobileSidebar(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#1a1a1e] border-r border-white/[0.07] flex flex-col animate-slide-in">
            <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.05]">
              <span className="text-[13px] font-semibold text-white">Conversations</span>
              <button onClick={() => setShowMobileSidebar(false)} className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition"><ChevronLeft className="w-5 h-5" /></button>
            </div>
            <div ref={sidebarScrollRef} onScroll={handleSidebarScroll} className="flex-1 overflow-y-auto scrollbar-none">
              {conversationsLoading && conversations.length === 0 ? (
                <SidebarSkeleton />
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-[13px] text-zinc-500">No conversations yet</div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`group w-full flex items-center gap-3 px-3 py-3 text-left transition-colors cursor-pointer ${conv.id === activeConversationId ? 'bg-wa-accent/10 text-white border-l-2 border-wa-accent' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'}`}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      {renamingId === conv.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={handleRenameKeyDown}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-[13px] font-medium bg-white/[0.06] text-white rounded px-1.5 py-0.5 outline-none border border-white/20"
                          maxLength={80}
                        />
                      ) : (
                        <p className="text-[13px] font-medium truncate">{conv.title}</p>
                      )}
                      <p className="text-[10px] text-zinc-600">{conv._count?.messages || 0} messages</p>
                    </div>
                  </div>
                ))
              )}
              {conversationsLoading && conversations.length > 0 && (
                <div className="py-2 text-center">
                  <Loader2 className="w-4 h-4 text-zinc-600 animate-spin mx-auto" />
                </div>
              )}
            </div>
            <div className="p-3 border-t border-white/[0.05]">
              <button onClick={() => { createNewConversation(); setShowMobileSidebar(false); }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/15 border border-white/[0.08] text-[13px] text-emerald-400 hover:text-emerald-300 font-medium transition"><Plus className="w-4 h-4" />New conversation</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 animate-fade-in" onClick={() => setShowSettings(false)}>
          <div className="bg-zinc-900 border border-white/[0.07] rounded-2xl shadow-pop w-full max-w-sm mx-4 p-5 max-h-[80vh] overflow-y-auto scrollbar-none" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-white">Cipher Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-white/10 transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <h4 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Your Plan</h4>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] text-white font-semibold">{tier?.tier?.name || 'Free'}</span>
                  {tier && tier.tier.dailyTokenLimit !== null && (
                    <span className="text-[11px] text-zinc-500">{tier.tier.dailyTokenLimit.toLocaleString()} tokens/day</span>
                  )}
                  {tier && tier.tier.dailyTokenLimit === null && (
                    <span className="text-[11px] text-emerald-400 font-medium">Unlimited</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(tier?.tier?.features || {}).map(([key, val]) => (
                    <span key={key} className={`text-[10px] px-2 py-0.5 rounded-full ${val ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <h4 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Usage</h4>
                {isUnlimited ? (
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] text-zinc-300">Tokens used today</span>
                    <span className="text-[13px] text-emerald-400 font-medium">{usage?.tokensUsed.toLocaleString() || '0'} / Unlimited</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] text-zinc-300">Tokens used today</span>
                      <span className="text-[13px] text-white font-medium">{usage ? usage.tokensUsed.toLocaleString() : '0'} / {usage && usage.dailyLimit ? usage.dailyLimit.toLocaleString() : '50,000'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mb-2">
                      <div className={`h-full rounded-full transition-all duration-500 ${usagePercent >= 80 ? 'bg-red-500' : usagePercent >= 50 ? 'bg-yellow-500' : 'bg-wa-accent'}`} style={{ width: `${Math.min(usagePercent, 100)}%` }} />
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">{usage ? `${usage.messageCount} messages` : '0 messages'}</span>
                  <span className="text-zinc-500">{usage?.resetsAt ? `Resets ${new Date(usage.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <h4 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Custom Instructions</h4>
                <p className="text-[11px] text-zinc-500 mb-2 leading-relaxed">Add your own instructions that Cipher will follow in all conversations.</p>
                <textarea value={customPrompt} onChange={(e) => updateCustomPrompt(e.target.value)} placeholder="e.g. Always respond in Spanish, Be concise, Use technical language..." rows={4}
                  className="w-full bg-white/[0.06] text-[13px] text-white rounded-xl px-3 py-2.5 outline-none resize-none border border-white/[0.08] focus:border-emerald-500/50 placeholder-zinc-600 transition scrollbar-none" />
              </div>

              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <h4 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">About Cipher</h4>
                <p className="text-[13px] text-zinc-300 leading-relaxed">Cipher is your private AI assistant built into NexChat. It can help with summaries, writing, Q&A, and answering questions about NexChat features.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear confirm modal */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 animate-fade-in" onClick={() => setShowConfirmClear(false)}>
          <div className="bg-zinc-900 border border-white/[0.07] rounded-2xl shadow-pop w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-white mb-2">Clear all conversations?</h3>
            <p className="text-[13px] text-zinc-400 mb-5">This will delete all Cipher conversations and messages. This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirmClear(false)} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-[13px] font-semibold transition">Cancel</button>
              <button onClick={() => { clearHistory(); setShowConfirmClear(false); }} className="flex-1 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 text-white text-[13px] font-semibold transition">Clear all</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CipherScreen;
