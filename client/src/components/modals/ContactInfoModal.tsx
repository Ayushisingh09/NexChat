import React, { useState, useEffect, useRef } from 'react';
import { useUiStore } from '../../store/ui.store';
import { useConversationStore } from '../../store/conversation.store';
import { useAuthStore } from '../../store/auth.store';
import { X, AlertTriangle, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../../api/conversations.api';
import { usersApi } from '../../api/users.api';
import { reportsApi } from '../../api/reports.api';
import type { User } from '../../types/chat.types';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useMediaUpload } from '../../hooks/useMediaUpload';
import { AvatarCropper } from './AvatarCropper';
import { ContactInfoModalBody } from './ContactInfoModalBody';

export const ContactInfoModal: React.FC = () => {
  const isOpen = useUiStore((state) => state.isContactInfoOpen);
  const setOpen = useUiStore((state) => state.setContactInfoOpen);
  const conversation = useConversationStore((state) => state.activeConversation);
  const currentUser = useAuthStore((state) => state.user);

  const blockedUserIds = useConversationStore((state) => state.blockedUserIds);
  const blockUser = useConversationStore((state) => state.blockUser);
  const unblockUser = useConversationStore((state) => state.unblockUser);
  const setActiveConversation = useConversationStore((state) => state.setActiveConversation);

  const queryClient = useQueryClient();

  const [showConfirmBlock, setShowConfirmBlock] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('SPAM');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDisappearingOptions, setShowDisappearingOptions] = useState(false);

  const isArchived = !!conversation?.archivedAt;
  const ttl = conversation?.disappearingTtlSeconds ?? null;

  const ttlLabel = (secs: number | null): string => {
    if (!secs) return 'Off';
    if (secs >= 86400) return `${Math.round(secs / 86400)}d`;
    if (secs >= 3600) return `${Math.round(secs / 3600)}h`;
    return `${Math.round(secs / 60)}m`;
  };

  const handleSetDisappearing = async (ttlSeconds: number | null) => {
    if (!conversation) return;
    try {
      await conversationsApi.setDisappearing(conversation.id, ttlSeconds);
      setShowDisappearingOptions(false);
    } catch (err) {
      console.error('Failed to set disappearing messages:', err);
    }
  };

  const handleArchive = async () => {
    if (!conversation) return;
    try {
      await conversationsApi.archive(conversation.id, !isArchived);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error('Failed to archive conversation:', err);
    }
  };

  // Group management state
  const [editingName, setEditingName] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);

  // Group enhancements state
  const [editingDescription, setEditingDescription] = useState(false);
  const [groupDescriptionDraft, setGroupDescriptionDraft] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAuditLog, setLoadingAuditLog] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<User[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);

  // Group avatar edit state & handlers
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [removingLogo, setRemovingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading, progress } = useMediaUpload();

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';
    const url = URL.createObjectURL(file);
    setCropSrc(url);
  };

  const onCropConfirm = async (blob: Blob) => {
    if (!conversation) return;
    setCropSrc(null);
    try {
      const file = new File([blob], 'group_avatar.jpg', { type: 'image/jpeg' });
      const { publicUrl } = await uploadFile(file);
      await conversationsApi.updateGroup(conversation.id, { avatar: publicUrl });
      setActiveConversation({ ...conversation, avatar: publicUrl });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error('Failed to upload group avatar:', err);
    }
  };

  const onCropCancel = () => {
    setCropSrc(null);
  };

  const handleRemoveLogo = async () => {
    if (!conversation) return;
    setRemovingLogo(true);
    try {
      await conversationsApi.updateGroup(conversation.id, { avatar: '' });
      setActiveConversation({ ...conversation, avatar: undefined });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error('Failed to remove group avatar:', err);
    } finally {
      setRemovingLogo(false);
    }
  };

  const myRole = conversation?.participants?.find((p) => p.id === currentUser?.id)?.role;
  const isAdmin = myRole === 'ADMIN';

  // Load contacts when the add-members panel opens
  useEffect(() => {
    if (!showAddMembers) return;
    let active = true;
    usersApi
      .search(contactSearch)
      .then((res) => {
        if (active) setContactResults(res);
      })
      .catch((err) => console.error('Failed to search contacts:', err));
    return () => {
      active = false;
    };
  }, [showAddMembers, contactSearch]);

  const handleSaveName = async () => {
    if (!conversation || !groupNameDraft.trim()) return;
    setSavingName(true);
    try {
      await conversationsApi.updateGroup(conversation.id, { name: groupNameDraft.trim() });
      setEditingName(false);
    } catch (err) {
      console.error('Failed to update group name:', err);
    } finally {
      setSavingName(false);
    }
  };

  const handleAddMembers = async () => {
    if (!conversation || selectedToAdd.length === 0) return;
    setAddingMembers(true);
    try {
      await conversationsApi.addParticipants(conversation.id, selectedToAdd);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setSelectedToAdd([]);
      setShowAddMembers(false);
      setContactSearch('');
    } catch (err) {
      console.error('Failed to add members:', err);
    } finally {
      setAddingMembers(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!conversation) return;
    try {
      await conversationsApi.removeParticipant(conversation.id, userId);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleMemberClick = async (memberId: string) => {
    if (memberId === currentUser?.id) return;
    try {
      const chat = await conversationsApi.create({
        type: 'DIRECT',
        participantIds: [memberId],
      });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConversation(chat);
      setOpen(false);
    } catch (err) {
      console.error('Failed to open member chat:', err);
    }
  };

  const handleToggleRole = async (userId: string, currentRole?: 'MEMBER' | 'ADMIN') => {
    if (!conversation) return;
    try {
      await conversationsApi.updateParticipantRole(
        conversation.id,
        userId,
        currentRole === 'ADMIN' ? 'MEMBER' : 'ADMIN'
      );
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  // Group Enhancements effects & handlers
  useEffect(() => {
    if (!conversation || !isOpen || conversation.type !== 'GROUP' || !isAdmin || !conversation.requiresApproval) {
      setPendingRequests([]);
      return;
    }
    let active = true;
    conversationsApi.listJoinRequests(conversation.id)
      .then((res) => {
        if (active) setPendingRequests(res);
      })
      .catch((err) => console.error('Failed to load join requests:', err));
    return () => {
      active = false;
    };
  }, [isOpen, conversation?.id, isAdmin, conversation?.requiresApproval]);

  useEffect(() => {
    if (!conversation || !showAuditLog || conversation.type !== 'GROUP') return;
    let active = true;
    setLoadingAuditLog(true);
    conversationsApi.listAuditLogs(conversation.id)
      .then((res) => {
        if (active) setAuditLogs(res);
      })
      .catch((err) => console.error('Failed to load audit logs:', err))
      .finally(() => {
        if (active) setLoadingAuditLog(false);
      });
    return () => {
      active = false;
    };
  }, [showAuditLog, conversation?.id]);

  const handleSaveDescription = async () => {
    if (!conversation) return;
    setSavingDescription(true);
    try {
      await conversationsApi.updateGroup(conversation.id, { description: groupDescriptionDraft.trim() });
      setActiveConversation({ ...conversation, description: groupDescriptionDraft.trim() });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setEditingDescription(false);
    } catch (err) {
      console.error('Failed to update description:', err);
    } finally {
      setSavingDescription(false);
    }
  };

  const handleToggleAnnouncementMode = async (checked: boolean) => {
    if (!conversation) return;
    try {
      const updated = await conversationsApi.updateGroup(conversation.id, { isAnnouncementMode: checked });
      setActiveConversation(updated);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error('Failed to toggle announcement mode:', err);
    }
  };

  const handleToggleRequiresApproval = async (checked: boolean) => {
    if (!conversation) return;
    try {
      const updated = await conversationsApi.updateGroup(conversation.id, { requiresApproval: checked });
      setActiveConversation(updated);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error('Failed to toggle approval requirement:', err);
    }
  };

  const handleUpdateGroupSetting = async (key: string, value: any) => {
    if (!conversation) return;
    try {
      const updated = await conversationsApi.updateGroup(conversation.id, { [key]: value });
      setActiveConversation(updated);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error(`Failed to update group setting ${key}:`, err);
    }
  };

  const handleJoinRequest = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    if (!conversation) return;
    try {
      await conversationsApi.resolveJoinRequest(conversation.id, requestId, action);
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (action === 'APPROVE') {
        await queryClient.invalidateQueries({ queryKey: ['conversations'] });
        const list = queryClient.getQueryData<any[]>(['conversations']);
        if (list) {
          const updatedConv = list.find((c) => c.id === conversation.id);
          if (updatedConv) setActiveConversation(updatedConv);
        }
      }
    } catch (err) {
      console.error(`Failed to ${action.toLowerCase()} request:`, err);
    }
  };

  const handleUpdateNotificationPreference = async (pref: 'ALL' | 'MENTIONS_ONLY' | 'MUTE') => {
    if (!conversation) return;
    try {
      await conversationsApi.updateNotificationPreference(conversation.id, pref);
      setActiveConversation({ ...conversation, notificationPreference: pref });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error('Failed to update notification preference:', err);
    }
  };

  const formatAuditLogAction = (log: any) => {
    const targetLabel = log.target ? log.target.displayName : 'someone';
    switch (log.action) {
      case 'CREATE':
        return 'created the group';
      case 'JOIN':
        return 'joined the group';
      case 'LEAVE':
        return 'left the group';
      case 'MEMBER_ADD':
        return `added ${targetLabel}`;
      case 'MEMBER_REMOVE':
        return `removed ${targetLabel}`;
      case 'ROLE_CHANGE':
        return `${log.details || `changed role of ${targetLabel}`}`;
      case 'SETTINGS_EDIT':
        return `${log.details || 'updated group settings'}`;
      case 'REQUEST_APPROVE':
        return `approved join request for ${targetLabel}`;
      case 'REQUEST_REJECT':
        return `rejected join request for ${targetLabel}`;
      default:
        return `${log.action.toLowerCase().replace('_', ' ')}: ${log.details || ''}`;
    }
  };

  const handleClearChat = async () => {
    if (!conversation) return;
    try {
      setClearing(true);
      await conversationsApi.clear(conversation.id);
      try {
        localStorage.removeItem(`draft:${conversation.id}`);
      } catch (e) {
        // ignore storage errors
      }
      await queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setOpen(false);
    } catch (err) {
      console.error('Failed to clear conversation:', err);
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!conversation) return;
    try {
      setDeleting(true);
      await conversationsApi.delete(conversation.id);
      try {
        localStorage.removeItem(`draft:${conversation.id}`);
      } catch (e) {
        // ignore storage errors
      }
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConversation(null);
      setOpen(false);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    } finally {
      setDeleting(false);
    }
  };


  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen && !!conversation, () => setOpen(false));

  if (!isOpen || !conversation) return null;

  // DIRECT chat participant mapping
  const otherParticipant = conversation.type === 'DIRECT'
    ? conversation.participants.find((p) => p.id !== currentUser?.id)
    : null;

  const isBlocked = otherParticipant ? blockedUserIds.includes(otherParticipant.id) : false;

  const displayName = conversation.type === 'GROUP'
    ? conversation.name
    : otherParticipant?.displayName || 'Chat';

  const handleToggleBlock = async () => {
    if (!otherParticipant) return;
    try {
      if (isBlocked) {
        await unblockUser(otherParticipant.id);
      } else {
        await blockUser(otherParticipant.id);
      }
      setShowConfirmBlock(false);
    } catch (err) {
      console.error('Failed to toggle block status:', err);
    }
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otherParticipant) return;
    setReportSubmitting(true);
    try {
      await reportsApi.submit({
        reportedId: otherParticipant.id,
        reason: reportReason,
        description: reportDescription || undefined,
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowReport(false);
        setReportReason('SPAM');
        setReportDescription('');
      }, 2000);
    } catch (err) {
      console.error('Failed to submit report:', err);
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <>
      {cropSrc && <AvatarCropper src={cropSrc} onConfirm={onCropConfirm} onCancel={onCropCancel} />}
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50 select-none animate-fade-in">
      {/* Click outside backdrop to close */}
      <div className="flex-grow" onClick={() => setOpen(false)} />

      {/* Side Slide Panel */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Conversation info" tabIndex={-1} className="w-full max-w-full sm:max-w-[400px] bg-[#0d0d11] border-l border-white/10 h-full flex flex-col text-wa-primary shadow-pop animate-slide-in focus:outline-none">
        {/* Header */}
        <div className="flex items-center px-3 py-3 h-[60px] glass border-b border-white/[0.06] shrink-0 select-none">
          <button type="button"
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-white/[0.06] rounded-xl transition mr-2 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="font-bold text-white text-[15px]">
            {conversation.type === 'GROUP' ? 'Group Info' : 'Contact Info'}
          </h3>
        </div>

        {/* Panel Content Body */}
          <ContactInfoModalBody p={{
      conversation,
      currentUser,
      displayName,
      isAdmin,
      uploading,
      removingLogo,
      progress,
      fileRef,
      onFilePick,
      handleRemoveLogo,
      editingName,
      groupNameDraft,
      setGroupNameDraft,
      handleSaveName,
      savingName,
      setEditingName,
      editingDescription,
      setEditingDescription,
      groupDescriptionDraft,
      setGroupDescriptionDraft,
      savingDescription,
      handleSaveDescription,
      showAuditLog,
      setShowAuditLog,
      auditLogs,
      loadingAuditLog,
      formatAuditLogAction,
      showAddMembers,
      setShowAddMembers,
      contactSearch,
      setContactSearch,
      contactResults,
      selectedToAdd,
      setSelectedToAdd,
      handleAddMembers,
      addingMembers,
      handleMemberClick,
      handleToggleRole,
      handleRemoveMember,
      handleToggleAnnouncementMode,
      handleToggleRequiresApproval,
      handleUpdateGroupSetting,
      handleJoinRequest,
      pendingRequests,
      handleUpdateNotificationPreference,
      handleArchive,
      isArchived,
      ttl,
      ttlLabel,
      handleSetDisappearing,
      showDisappearingOptions,
      setShowDisappearingOptions,
      otherParticipant,
      isBlocked,
      handleToggleBlock,
      setShowConfirmBlock,
      setShowReport,
      handleClearChat,
      clearing,
      handleDeleteChat,
      deleting
      }} />


        </div>
      </div>

      {/* Confirm Block Dialog */}
      {showConfirmBlock && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-wa-sidebar border border-wa-border p-5 rounded-2xl max-w-sm w-full space-y-4 shadow-pop animate-scale-in">
            <h4 className="font-bold text-wa-primary text-base">Block {displayName}?</h4>
            <p className="text-xs text-wa-secondary leading-relaxed">
              Blocked contacts will no longer be able to call you or send you messages. They won't see your online status or updates.
            </p>
            <div className="flex justify-end space-x-3 pt-2 text-xs">
              <button type="button"
                onClick={() => setShowConfirmBlock(false)}
                className="font-semibold text-wa-secondary hover:text-wa-primary transition"
              >
                Cancel
              </button>
              <button type="button"
                onClick={handleToggleBlock}
                className="bg-red-600 hover:bg-red-500 text-wa-primary font-bold px-4 py-2 rounded-lg transition"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReport && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-wa-sidebar border border-wa-border p-5 rounded-2xl max-w-sm w-full space-y-4 shadow-pop animate-scale-in">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <h4 className="font-bold text-wa-primary text-base">Report {displayName}</h4>
            </div>

            {reportSuccess ? (
              <div className="flex items-center justify-center space-x-2 py-6 text-wa-green text-sm font-semibold select-none">
                <Check className="w-5 h-5" />
                <span>Report Submitted Successfully</span>
              </div>
            ) : (
              <form onSubmit={handleSendReport} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-wa-secondary uppercase tracking-wider">
                    Reason
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-2 bg-[#18181b] border border-wa-border rounded-lg text-sm text-wa-primary focus:outline-none"
                  >
                    <option value="SPAM">Spam or unwanted messages</option>
                    <option value="ABUSE">Abusive or offensive content</option>
                    <option value="HARASSMENT">Harassment or threat</option>
                    <option value="OTHER">Other reason</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-wa-secondary uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Provide additional context (optional)..."
                    className="w-full px-3 py-2 bg-[#18181b] border border-wa-border rounded-lg text-xs text-wa-primary focus:outline-none resize-none"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowReport(false)}
                    className="font-semibold text-wa-secondary hover:text-wa-primary transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="bg-wa-green text-wa-sidebar font-bold px-4 py-2 rounded-lg transition hover:bg-[#059669] disabled:opacity-50"
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Slide Animation Styling */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slideIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  );
};
