import { create } from 'zustand';

export const SIDEBAR_MIN_WIDTH = 280;
export const SIDEBAR_MAX_WIDTH = 520;
const SIDEBAR_DEFAULT_WIDTH = 320;

const clampSidebarWidth = (w: number) =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(w)));

const readStoredSidebarWidth = (): number => {
  try {
    const raw = localStorage.getItem('nexchat:sidebarWidth');
    if (raw) return clampSidebarWidth(parseInt(raw, 10));
  } catch { /* ignore */ }
  return SIDEBAR_DEFAULT_WIDTH;
};

interface UiState {
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  isNewChatOpen: boolean;
  setNewChatOpen: (open: boolean) => void;
  isProfileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  isGroupModalOpen: boolean;
  setGroupModalOpen: (open: boolean) => void;
  isContactInfoOpen: boolean;
  setContactInfoOpen: (open: boolean) => void;
  isStarredOpen: boolean;
  setStarredOpen: (open: boolean) => void;
  isPinnedOpen: boolean;
  setPinnedOpen: (open: boolean) => void;
  storyViewerIndex: number | null;
  setStoryViewerIndex: (index: number | null) => void;
  isCreateStoryOpen: boolean;
  setCreateStoryOpen: (open: boolean) => void;
  isFriendRequestsOpen: boolean;
  setFriendRequestsOpen: (open: boolean) => void;
  isCallPickerOpen: boolean;
  setCallPickerOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarWidth: readStoredSidebarWidth(),
  setSidebarWidth: (width) => {
    const clamped = clampSidebarWidth(width);
    try { localStorage.setItem('nexchat:sidebarWidth', String(clamped)); } catch { /* ignore */ }
    set({ sidebarWidth: clamped });
  },
  isNewChatOpen: false,
  setNewChatOpen: (open) => set({ isNewChatOpen: open }),
  isProfileOpen: false,
  setProfileOpen: (open) => set({ isProfileOpen: open }),
  isGroupModalOpen: false,
  setGroupModalOpen: (open) => set({ isGroupModalOpen: open }),
  isContactInfoOpen: false,
  setContactInfoOpen: (open) => set({ isContactInfoOpen: open }),
  isStarredOpen: false,
  setStarredOpen: (open) => set({ isStarredOpen: open }),
  isPinnedOpen: false,
  setPinnedOpen: (open) => set({ isPinnedOpen: open }),
  storyViewerIndex: null,
  setStoryViewerIndex: (index) => set({ storyViewerIndex: index }),
  isCreateStoryOpen: false,
  setCreateStoryOpen: (open) => set({ isCreateStoryOpen: open }),
  isFriendRequestsOpen: false,
  setFriendRequestsOpen: (open) => set({ isFriendRequestsOpen: open }),
  isCallPickerOpen: false,
  setCallPickerOpen: (open) => set({ isCallPickerOpen: open }),
}));
