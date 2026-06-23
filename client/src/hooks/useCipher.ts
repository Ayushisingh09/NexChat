import { useState, useEffect, useCallback, useRef } from 'react';
import { cipherApi, type CipherMessage, type CipherConversation, type UsageResponse, type TierInfo } from '../api/cipher.api';
import { showToast } from '../components/layout/ToastHost';

const CUSTOM_PROMPT_KEY = 'cipher_custom_prompt';

const getStoredPrompt = (): string => {
  try { return localStorage.getItem(CUSTOM_PROMPT_KEY) || ''; } catch { return ''; }
};
const storePrompt = (value: string) => {
  try { localStorage.setItem(CUSTOM_PROMPT_KEY, value); } catch {}
};

const CONV_PAGE_SIZE = 30;

export const useCipher = (initialConversationId?: string) => {
  const [messages, setMessages] = useState<CipherMessage[]>([]);
  const [conversations, setConversations] = useState<CipherConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId || null);
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>(getStoredPrompt);
  const [tier, setTier] = useState<TierInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CipherMessage[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsPage, setConversationsPage] = useState(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const recognitionRef = useRef<any>(null);

  const updateCustomPrompt = useCallback((value: string) => {
    setCustomPrompt(value);
    storePrompt(value);
  }, []);

  const fetchUsage = useCallback(async () => {
    try { const data = await cipherApi.getUsage(); setUsage(data); } catch {}
  }, []);

  const fetchTier = useCallback(async () => {
    try { const data = await cipherApi.getTier(); setTier(data); } catch {}
  }, []);

  const fetchConversations = useCallback(async (page = 1, append = false) => {
    try {
      setConversationsLoading(true);
      const data = await cipherApi.getConversations(page, CONV_PAGE_SIZE);
      if (append) {
        setConversations((prev) => [...prev, ...data]);
      } else {
        setConversations(data);
      }
      setHasMoreConversations(data.length === CONV_PAGE_SIZE);
      setConversationsPage(page);
    } catch {} finally {
      setConversationsLoading(false);
    }
  }, []);

  const loadMoreConversations = useCallback(() => {
    if (!conversationsLoading && hasMoreConversations) {
      fetchConversations(conversationsPage + 1, true);
    }
  }, [conversationsLoading, hasMoreConversations, conversationsPage, fetchConversations]);

  const fetchHistory = useCallback(async (conversationId?: string) => {
    try {
      const data = await cipherApi.getHistory(conversationId);
      setMessages(data);
      setError(null);
    } catch { setError('Failed to load history'); }
  }, []);

  useEffect(() => {
    fetchUsage();
    fetchTier();
    fetchConversations();
  }, [fetchUsage, fetchTier, fetchConversations]);

  useEffect(() => {
    if (initialConversationId && conversations.length > 0) {
      const exists = conversations.find((c) => c.id === initialConversationId);
      if (exists) {
        setActiveConversationId(initialConversationId);
      }
    }
  }, [initialConversationId, conversations]);

  useEffect(() => {
    if (activeConversationId) {
      fetchHistory(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, fetchHistory]);

  const selectConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setStreamingContent('');

    const tempUserMsg: CipherMessage = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId || '',
      role: 'user',
      content: text,
      tokensUsed: 0,
      provider: '',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);

    let accumulatedContent = '';

    try {
      await cipherApi.chatStream(text, activeConversationId || undefined, customPrompt || undefined, {
        onToken: (token) => {
          accumulatedContent += token;
          setStreamingContent(accumulatedContent);
        },
        onConversationId: (id) => {
          setActiveConversationId(id);
          fetchConversations();
          setMessages((prev) => prev.map((m) => m.id === tempUserMsg.id ? { ...m, conversationId: id } : m));
          window.history.replaceState(null, '', `/cipher/${id}`);
        },
        onDone: (result) => {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== tempUserMsg.id),
            { ...tempUserMsg, id: `user-${Date.now()}`, conversationId: result.conversationId },
            { id: result.messageId, conversationId: result.conversationId, role: 'assistant', content: accumulatedContent, tokensUsed: result.tokensUsed, provider: result.provider, createdAt: new Date().toISOString() },
          ]);
          setLoading(false);
          setStreamingContent('');
          setUsage((prev) => prev ? { ...prev, tokensUsed: result.dailyUsed, remaining: prev.dailyLimit !== null ? prev.dailyLimit - result.dailyUsed : null } : prev);
        },
        onError: (errorMsg) => {
          setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
          setError(errorMsg);
          setLoading(false);
          setStreamingContent('');
        },
      });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setError(err?.message || 'Connection error. Check your internet.');
      setLoading(false);
      setStreamingContent('');
    }
  }, [activeConversationId, fetchConversations, customPrompt]);

  const regenerate = useCallback(async (messageId: string) => {
    try {
      setLoading(true);
      const result = await cipherApi.regenerateMessage(messageId);
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, content: result.content, tokensUsed: result.tokensUsed, provider: result.provider } : m));
      fetchUsage();
      setLoading(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to regenerate');
      setLoading(false);
    }
  }, [fetchUsage]);

  const submitFeedback = useCallback(async (messageId: string, feedbackType: 'good' | 'bad', reason?: string) => {
    try {
      await cipherApi.submitFeedback(messageId, feedbackType, reason);
    } catch {
      showToast('Failed to submit feedback');
      throw new Error('feedback failed');
    }
  }, []);

  const searchMessages = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    try {
      const results = await cipherApi.searchMessages(q);
      setSearchResults(results);
    } catch { setSearchResults([]); }
  }, []);

  const exportConversation = useCallback(async (format: 'md' | 'json' = 'md') => {
    if (!activeConversationId) return;
    try {
      await cipherApi.exportConversation(activeConversationId, format);
      showToast('Conversation exported');
    } catch { showToast('Export failed'); }
  }, [activeConversationId]);

  const createBranch = useCallback(async (messageId?: string) => {
    if (!activeConversationId) return;
    try {
      const conv = await cipherApi.createBranch(activeConversationId, messageId);
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(conv.id);
      setMessages([]);
      showToast('Branch created');
    } catch { showToast('Branch failed'); }
  }, [activeConversationId]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    if (!title.trim()) return;
    try {
      const updated = await cipherApi.updateConversation(id, title.trim());
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title: updated.title } : c));
    } catch { showToast('Failed to rename'); }
  }, []);

  const startVoiceInput = useCallback(() => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
      if (voiceTranscript.trim()) {
        sendMessage(voiceTranscript.trim());
        setVoiceTranscript('');
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice input not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognitionRef.current = recognition;
    setIsListening(true);
    setVoiceTranscript('');
    let finalText = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setVoiceTranscript(finalText + interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      if (finalText.trim()) {
        sendMessage(finalText.trim());
      }
      setVoiceTranscript('');
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
      setVoiceTranscript('');
      showToast('Voice input failed');
    };

    recognition.start();
  }, [sendMessage, isListening]);

  const createNewConversation = useCallback(async () => {
    try {
      const conv = await cipherApi.createConversation();
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(conv.id);
      setMessages([]);
      setError(null);
    } catch { showToast('Failed to create conversation'); }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await cipherApi.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) { setActiveConversationId(null); setMessages([]); }
    } catch { showToast('Failed to delete conversation'); }
  }, [activeConversationId]);

  const clearHistory = useCallback(async () => {
    try {
      await cipherApi.clearHistory();
      setMessages([]); setConversations([]); setActiveConversationId(null); setUsage(null);
      fetchUsage();
    } catch { setError('Failed to clear history'); }
  }, [fetchUsage]);

  const retry = useCallback(() => {
    if (activeConversationId) fetchHistory(activeConversationId);
    fetchUsage();
  }, [activeConversationId, fetchHistory, fetchUsage]);

  return {
    messages, conversations, activeConversationId, sendMessage, loading, streamingContent,
    usage, error, clearHistory, fetchHistory, selectConversation, createNewConversation,
    deleteConversation, retry, customPrompt, updateCustomPrompt, tier, regenerate,
    searchMessages, searchResults, searchQuery, setSearchQuery, setSearchResults, showSearch, setShowSearch,
    exportConversation, createBranch, startVoiceInput, isListening, voiceTranscript,
    renameConversation, conversationsLoading, loadMoreConversations, hasMoreConversations,
    submitFeedback,
  };
};
