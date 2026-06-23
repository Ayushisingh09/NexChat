import React, { useState, useRef, useEffect } from 'react';
import { Smile, Paperclip, Mic, Send, X, Image, File, Trash2, Clock, Users } from 'lucide-react';
import type { Message, User } from '../../types/chat.types';
import { Avatar } from '../layout/Avatar';
import { mediaApi } from '../../api/media.api';

interface MessageInputProps {
  conversationId: string;
  isGroup: boolean;
  isAdmin?: boolean;
  isAnnouncementMode?: boolean;
  participants: User[];
  currentUserId?: string;
  onSend: (
    content: string,
    type: 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO',
    mentionedUserIds?: string[],
    mentionEveryone?: boolean
  ) => void;
  onSchedule?: (content: string, scheduledAt: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  replyTo: Message | null;
  onCancelReply: () => void;
  onAttachFile: (file: File) => void;
  editingMessage: Message | null;
  editingText: string;
  onSubmitEdit: (content: string) => void;
  onCancelEdit: () => void;
}

const EVERYONE = '__everyone__';

const MAX_MESSAGE_LENGTH = 4096;
const COUNTER_THRESHOLD = 3800;

const popularEmojis = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '😊', '😍', '🥰',
  '😘', '😜', '😎', '🤩', '🥳', '🤔', '🤨', '😐', '😑', '🙄',
  '😬', '😴', '😷', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳',
  '😢', '😭', '😠', '😡', '🤬', '😱', '😰', '😓', '🥱', '😴',
  '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘',
  '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚',
  '👋', '✍️', '🙏', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜',
  '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
  '🔥', '✨', '🌟', '⭐', '🎈', '🎉', '🎊', '🎁', '🎂', '🎄'
];

export const MessageInput: React.FC<MessageInputProps> = ({
  conversationId,
  isGroup,
  isAdmin,
  participants,
  currentUserId,
  onSend,
  onSchedule,
  onTypingStart,
  onTypingStop,
  replyTo,
  onCancelReply,
  onAttachFile,
  editingMessage,
  editingText,
  onSubmitEdit,
  onCancelEdit,
  isAnnouncementMode,
}) => {
  if (isGroup && isAnnouncementMode && !isAdmin) {
    return (
      <div className="flex items-center justify-center py-4 bar-glass safe-bottom border-t border-white/5 text-xs text-wa-secondary select-none w-full shrink-0">
        <Users className="w-4 h-4 mr-2 text-wa-secondary" />
        <span>Only admins can send messages in this group</span>
      </div>
    );
  }

  const draftKey = `draft:${conversationId}`;
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(`draft:${conversationId}`) || '';
    } catch {
      return '';
    }
  });
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleValue, setScheduleValue] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dismissedUrl, setDismissedUrl] = useState<string | null>(null);

  const typingTimeoutRef = useRef<any>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const cancelledRef = useRef(false);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Track confirmed mentions: displayName -> userId. Used to resolve ids at send time.
  const mentionMapRef = useRef<Map<string, string>>(new Map());

  const mentionCandidates: User[] =
    mentionQuery !== null
      ? [
          // Admins of groups can notify the whole group with @everyone
          ...(isGroup && isAdmin && 'everyone'.startsWith(mentionQuery.toLowerCase())
            ? [{ id: EVERYONE, displayName: 'everyone' } as User]
            : []),
          ...participants
            .filter((p) => p.id !== currentUserId)
            .filter((p) => (p.displayName || '').toLowerCase().includes(mentionQuery.toLowerCase()))
            .slice(0, 6),
        ]
      : [];

  // Detect a "@token" being typed right before the caret
  const detectMention = (value: string, caret: number) => {
    const upToCaret = value.slice(0, caret);
    const match = upToCaret.match(/(?:^|\s)@([\w]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const applyMention = (user: User) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/(^|\s)@([\w]*)$/, `$1@${user.displayName} `);
    const after = text.slice(caret);
    const next = before + after;
    mentionMapRef.current.set(user.displayName || '', user.id);
    setText(next);
    setMentionQuery(null);
    setTimeout(() => {
      textarea.focus();
      const pos = before.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  // Resolve mentioned user ids from the final text (only names still present count)
  const resolveMentions = (value: string): string[] => {
    const ids: string[] = [];
    mentionMapRef.current.forEach((id, name) => {
      if (value.includes(`@${name}`)) ids.push(id);
    });
    return [...new Set(ids)];
  };

  // Cleanup recording resources on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        cancelledRef.current = true;
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        setRecordSeconds(0);

        if (cancelledRef.current || chunksRef.current.length === 0) return;

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const ext = (recorder.mimeType || 'audio/webm').includes('ogg') ? 'ogg' : 'webm';
        const file = new window.File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
        onAttachFile(file);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error('Failed to start voice recording:', err);
    }
  };

  const stopRecording = (cancel: boolean) => {
    cancelledRef.current = cancel;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const formatRecordTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isEditing = !!editingMessage;

  // Auto-resize textarea logic
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`; // cap at ~6 lines
  }, [text]);

      // Load the message text into the input when entering edit mode
  useEffect(() => {
    if (editingMessage) {
      setText(editingText);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [editingMessage, editingText]);

  // Persist draft per conversation (skip while editing or recording — those aren't drafts)
  useEffect(() => {
    if (isEditing || isRecording) return;
    try {
      if (text) localStorage.setItem(draftKey, text);
      else localStorage.removeItem(draftKey);
    } catch {
      /* ignore quota errors */
    }
  }, [text, draftKey, isEditing, isRecording]);

  // Reset input and preview when switching conversations
  useEffect(() => {
    try {
      setText(localStorage.getItem(`draft:${conversationId}`) || '');
    } catch {
      setText('');
    }
    setPreviewData(null);
    setDismissedUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Pre-fetch link previews from the server proxy as the user types
  useEffect(() => {
    if (isEditing || isRecording) {
      setPreviewData(null);
      setPreviewLoading(false);
      return;
    }

    const URL_RE = /https?:\/\/[^\s<]+/i;
    const match = text.match(URL_RE);
    const url = match?.[0]?.replace(/[.,;:!?)]+$/, '') || null;

    if (!url) {
      setPreviewData(null);
      setPreviewLoading(false);
      return;
    }

    if (url === dismissedUrl) {
      return;
    }

    if (previewData?.url === url || previewLoading) {
      return;
    }

    let active = true;
    const fetchPreview = async () => {
      setPreviewLoading(true);
      try {
        const data = await mediaApi.linkPreview(url);
        if (active) {
          setPreviewData(data);
        }
      } catch (err) {
        console.error('Failed to pre-fetch preview:', err);
      } finally {
        if (active) {
          setPreviewLoading(false);
        }
      }
    };

    fetchPreview();

    return () => {
      active = false;
    };
  }, [text, dismissedUrl, previewData?.url, previewLoading, isEditing, isRecording]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, MAX_MESSAGE_LENGTH);
    setText(val);

    // @mention detection (groups only)
    if (isGroup) {
      detectMention(val, e.target.selectionStart ?? val.length);
    }

    if (isEditing) return; // no typing indicators while editing

    // Trigger typing event start
    if (val && !text) {
      onTypingStart();
    }

    // Typing debounce logic (emit typing:stop after 2s idle)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop();
    }, 1500);
  };

  const handleSend = () => {
    if (!text.trim() || text.length > MAX_MESSAGE_LENGTH) return;

    if (isEditing) {
      onSubmitEdit(text.trim());
      setText('');
      textareaRef.current?.focus();
      return;
    }

    setSending(true);
    setTimeout(() => setSending(false), 300);
    const resolved = isGroup ? resolveMentions(text) : [];
    const mentionEveryone = resolved.includes(EVERYONE);
    const mentions = resolved.filter((id) => id !== EVERYONE);
    onSend(text, 'TEXT', mentions.length ? mentions : undefined, mentionEveryone || undefined);
    mentionMapRef.current.clear();
    setMentionQuery(null);
    setText('');
    setPreviewData(null);
    setDismissedUrl(null);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    onTypingStop();
    setShowEmojiPicker(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    textareaRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention autocomplete navigation takes precedence
    if (mentionQuery !== null && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyMention(mentionCandidates[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Escape' && isEditing) {
      e.preventDefault();
      onCancelEdit();
      setText('');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openSchedulePicker = () => {
    // Default to one hour from now, rounded to the next 5 minutes, in local time.
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    setScheduleValue(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setShowSchedulePicker(true);
    setShowAttachments(false);
    setShowEmojiPicker(false);
  };

  const handleScheduleConfirm = () => {
    if (!onSchedule || !text.trim() || !scheduleValue) return;
    const when = new Date(scheduleValue);
    if (isNaN(when.getTime()) || when.getTime() <= Date.now()) return;
    onSchedule(text.trim(), when.toISOString());
    setText('');
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setShowSchedulePicker(false);
    onTypingStop();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAttachFile(file);
    }
    setShowAttachments(false);
    setShowEmojiPicker(false);
  };

  const handleEmojiClick = (emoji: string) => {
    setText((prev) => prev + emoji);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  return (
    <div className="flex flex-col shrink-0 relative z-20 bar-glass safe-bottom border-t border-white/[0.04] w-full min-w-0">

      {/* @mention autocomplete dropdown */}
      {mentionQuery !== null && mentionCandidates.length > 0 && (
        <div className="absolute bottom-full left-3 mb-1 w-64 max-h-56 overflow-y-auto bg-[#1f2c34] border border-white/[0.06] rounded-2xl shadow-elevated p-1.5 z-50 animate-scale-in origin-bottom-left">
          {mentionCandidates.map((p, i) => (
            <button type="button"
              key={p.id}
              onMouseDown={(e) => {
                e.preventDefault();
                applyMention(p);
              }}
              onMouseEnter={() => setMentionIndex(i)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition text-left ${
                i === mentionIndex ? 'bg-white/[0.06]' : 'hover:bg-white/[0.06]'
              }`}
            >
              {p.id === EVERYONE ? (
                <span className="w-8 h-8 rounded-full bg-wa-green/20 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-wa-green" />
                </span>
              ) : (
                <Avatar src={p.avatar} name={p.displayName} size="sm" className="shrink-0" />
              )}
              <span className="text-[13px] font-semibold text-wa-primary truncate">
                {p.displayName}
                {p.id === EVERYONE && <span className="block text-[10px] font-normal text-wa-secondary">Notify all participants</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Edit banner above input area */}
      {isEditing && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#1f2c34] border-b border-white/[0.04] text-xs text-wa-secondary z-30 animate-slide-down">
          <div className="border-l-[3px] border-amber-400 pl-3 py-0.5 min-w-0">
            <span className="font-semibold text-amber-400 block">Editing message</span>
            <span className="truncate block max-w-[500px] text-wa-secondary">{editingText}</span>
          </div>
          <button type="button"
            onClick={() => {
              onCancelEdit();
              setText('');
            }}
            aria-label="Cancel edit"
            className="p-1.5 hover:bg-white/[0.06] rounded-full transition-colors active:scale-90 shrink-0"
          >
            <X className="w-4 h-4 text-wa-secondary" />
          </button>
        </div>
      )}

      {/* Reply Quote Preview banner above input area */}
      {replyTo && !isEditing && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#1f2c34] border-b border-white/[0.04] text-xs text-wa-secondary z-30 animate-slide-down">
          <div className="border-l-[3px] border-wa-accent pl-3 py-0.5 min-w-0">
            <span className="font-semibold text-wa-accent block">Replying to message</span>
            <span className="truncate block max-w-[500px] text-wa-secondary">
              {replyTo.type === 'IMAGE' ? 'Photo' : replyTo.content}
            </span>
          </div>
          <button type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="p-1.5 hover:bg-white/[0.06] rounded-full transition-colors active:scale-90 shrink-0"
          >
            <X className="w-4 h-4 text-wa-secondary" />
          </button>
        </div>
      )}

      {/* Typing link preview pre-fetched card */}
      {previewData && !isEditing && (
        <div className="flex items-start justify-between px-4 py-2.5 bg-[#1f2c34] border-b border-white/[0.04] text-xs z-30 animate-slide-down relative">
          <div className="flex gap-3 min-w-0 pr-6 select-text">
            {previewData.image && (
              <div className="w-12 h-12 rounded-xl bg-wa-surface-2 overflow-hidden shrink-0 mt-0.5 border border-white/[0.04]">
                <img src={previewData.image} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="border-l-2 border-wa-accent pl-2.5 py-0.5 min-w-0 text-left">
              {previewData.siteName && (
                <span className="text-[10px] text-wa-secondary uppercase tracking-wider block mb-0.5 truncate">
                  {previewData.siteName}
                </span>
              )}
              {previewData.title && (
                <span className="text-[12.5px] font-semibold text-wa-primary block truncate max-w-[420px]">
                  {previewData.title}
                </span>
              )}
              {previewData.description && (
                <span className="text-[11px] text-wa-secondary line-clamp-2 leading-tight mt-0.5 max-w-[450px]">
                  {previewData.description}
                </span>
              )}
            </div>
          </div>
          <button type="button"
            onClick={() => {
              setDismissedUrl(previewData.url);
              setPreviewData(null);
            }}
            aria-label="Remove link preview"
            className="absolute top-2.5 right-2.5 p-1 hover:bg-white/[0.06] rounded-full transition-colors active:scale-90 shrink-0"
          >
            <X className="w-3.5 h-3.5 text-wa-secondary" />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="w-full px-3 sm:px-4 py-2">
        {isRecording ? (
          /* Recording bar replaces the normal input row */
          <div className="flex items-center justify-between w-full h-12 bg-[#1f2c34] rounded-full px-4 animate-fade-in">
            <button type="button"
              onClick={() => stopRecording(true)}
              title="Cancel recording"
              aria-label="Cancel recording"
              className="p-2 text-red-400 hover:text-red-300 hover:bg-white/[0.06] rounded-full transition active:scale-90"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2 text-wa-secondary">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm tabular-nums font-medium text-wa-primary">{formatRecordTime(recordSeconds)}</span>
              <span className="text-xs">Recording...</span>
            </div>
            <button type="button"
              onClick={() => stopRecording(false)}
              title="Send voice message"
              aria-label="Send voice message"
              className="send-btn p-2.5 rounded-full"
            >
              <Send className="w-5 h-5 fill-current" />
            </button>
          </div>
        ) : (
        <div className="w-full bg-[#1f2c34] rounded-full px-4 sm:px-5 py-2.5 flex items-center gap-2 transition-all duration-200">
          {/* Emoji picker toggle */}
          <button type="button"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowAttachments(false);
            }}
            title="Emojis"
            aria-label="Insert emoji"
            className={`p-1.5 rounded-xl transition-all duration-150 active:scale-90 shrink-0 ${
              showEmojiPicker ? 'text-wa-accent bg-wa-accent/10' : 'text-zinc-400 hover:text-wa-primary hover:bg-white/[0.06]'
            }`}
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Custom Emoji Picker Board */}
          {showEmojiPicker && (
            <div className="absolute bottom-16 left-3 sm:left-4 bg-[#1f2c34] border border-white/[0.06] rounded-2xl shadow-elevated p-3 z-50 w-[268px] sm:w-[280px] flex flex-col select-none animate-scale-in origin-bottom-left">
              <div className="flex justify-between items-center mb-2 shrink-0">
                <span className="text-[10px] font-bold text-wa-secondary uppercase tracking-wider">Emojis</span>
                <button type="button"
                  onClick={() => setShowEmojiPicker(false)}
                  className="text-wa-secondary hover:text-wa-primary text-xs transition-colors"
                >
                  Close
                </button>
              </div>
              <div className="h-44 overflow-y-auto grid grid-cols-7 gap-1 pr-1 scrollbar-thin">
                {popularEmojis.map((emoji, i) => (
                  <button type="button"
                    key={`${emoji}-${i}`}
                    onClick={() => handleEmojiClick(emoji)}
                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/[0.06] rounded-lg transition-transform duration-100 hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Auto-resize Textarea Input */}
          <div className="flex-grow flex items-center py-1.5 min-h-[20px] max-h-[100px] overflow-y-auto">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={handleTextChange}
              onKeyDown={handleKeyPress}
              placeholder="Type a message"
              className="w-full bg-transparent border-none text-[14px] text-white placeholder-zinc-400 focus:outline-none resize-none align-middle min-h-[20px]"
            />
            {text.length >= COUNTER_THRESHOLD && (
              <span
                className={`shrink-0 self-end pb-0.5 pl-2 text-[11px] tabular-nums ${
                  text.length >= MAX_MESSAGE_LENGTH ? 'text-red-400 font-semibold' : 'text-zinc-500'
                }`}
              >
                {MAX_MESSAGE_LENGTH - text.length}
              </span>
            )}
          </div>

          {/* Attachment & Mic */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Attachment menu trigger */}
            <div className="relative">
              <button type="button"
                onClick={() => {
                  setShowAttachments(!showAttachments);
                  setShowEmojiPicker(false);
                }}
                aria-label="Attach file"
                className={`p-1.5 rounded-xl transition-all duration-150 active:scale-90 ${
                  showAttachments ? 'text-wa-accent bg-wa-accent/10' : 'text-zinc-400 hover:text-wa-primary hover:bg-white/[0.06]'
                }`}
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Attachment drop menu */}
              {showAttachments && (
                <div className="absolute bottom-12 right-0 bg-[#1f2c34] border border-white/[0.06] rounded-2xl shadow-elevated p-2 flex flex-col space-y-0.5 select-none z-50 w-44 animate-scale-in origin-bottom-right">
                  <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-3 px-3 py-2 text-sm text-wa-primary hover:bg-white/[0.06] rounded-xl transition-colors"
                  >
                    <Image className="w-5 h-5 text-indigo-400" />
                    <span>Photos &amp; Videos</span>
                  </button>
                  <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-3 px-3 py-2 text-sm text-wa-primary hover:bg-white/[0.06] rounded-xl transition-colors"
                  >
                    <File className="w-5 h-5 text-sky-400" />
                    <span>Document</span>
                  </button>
                  {onSchedule && !isEditing && (
                    <button type="button"
                      onClick={openSchedulePicker}
                      disabled={!text.trim()}
                      title={text.trim() ? 'Schedule this message' : 'Type a message first'}
                      className="flex items-center space-x-3 px-3 py-2 text-sm text-wa-primary hover:bg-white/[0.06] rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Clock className="w-5 h-5 text-amber-400" />
                      <span>Schedule message</span>
                    </button>
                  )}
                </div>
              )}

              {/* Schedule date-time picker popover */}
              {showSchedulePicker && (
                <div className="absolute bottom-12 right-0 bg-[#1f2c34] border border-white/[0.06] rounded-2xl shadow-elevated p-4 z-50 w-72 animate-scale-in origin-bottom-right">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-wa-secondary uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> Send later
                    </span>
                    <button type="button"
                      onClick={() => setShowSchedulePicker(false)}
                      className="text-wa-secondary hover:text-wa-primary text-xs transition-colors"
                    >
                      Close
                    </button>
                  </div>
                  <p className="text-xs text-wa-secondary mb-2 line-clamp-2 break-words">"{text.trim()}"</p>
                  <input
                    type="datetime-local"
                    value={scheduleValue}
                    onChange={(e) => setScheduleValue(e.target.value)}
                    className="w-full bg-white/[0.04] text-wa-primary text-sm rounded-xl px-3 py-2 border border-white/[0.06] focus:outline-none focus:ring-1 focus:ring-wa-accent/30 mb-3 [color-scheme:dark]"
                  />
                  <button type="button"
                    onClick={handleScheduleConfirm}
                    disabled={!scheduleValue || new Date(scheduleValue).getTime() <= Date.now()}
                    className="w-full py-2 bg-wa-accent hover:bg-wa-accent-2 text-white text-sm font-semibold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Schedule
                  </button>
                </div>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,application/*,text/*"
            />

            {/* Send / Mic */}
            {text.trim() ? (
              <button type="button"
                onClick={handleSend}
                aria-label="Send message"
                className={`send-btn p-2 rounded-xl ${sending ? 'animate-send-pulse' : ''}`}
              >
                <Send className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button type="button"
                onClick={startRecording}
                title="Record Voice"
                aria-label="Record voice message"
                className="p-1.5 text-zinc-400 hover:text-wa-primary hover:bg-white/[0.06] rounded-xl transition-all duration-150 active:scale-90"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
