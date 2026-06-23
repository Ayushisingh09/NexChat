import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '../../store/ui.store';
import { useConversationStore } from '../../store/conversation.store';
import { usersApi } from '../../api/users.api';
import { conversationsApi } from '../../api/conversations.api';
import type { User } from '../../types/chat.types';
import { X, Search, Check, Users, Hash, Plus, Loader2 } from 'lucide-react';
import { Avatar } from '../layout/Avatar';

interface NewGroupModalProps {
  onGroupCreated?: () => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({ onGroupCreated }) => {
  const queryClient = useQueryClient();
  const isOpen = useUiStore((state) => state.isGroupModalOpen);
  const setOpen = useUiStore((state) => state.setGroupModalOpen);
  const setActiveConversation = useConversationStore((state) => state.setActiveConversation);

  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<User[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = selectedContacts.map((c) => c.id);

  useEffect(() => {
    if (!isOpen) return;

    const fetchContacts = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await usersApi.search(searchQuery.trim());
        setContacts(res);
      } catch (err: any) {
        console.error('Failed to load contacts:', err);
        setError('Failed to load contacts');
      } finally {
        setLoading(false);
      }
    };

    if (!searchQuery.trim()) {
      fetchContacts();
      return;
    }

    const timer = setTimeout(fetchContacts, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  const handleToggleSelect = (contact: User) => {
    if (selectedContacts.some((c) => c.id === contact.id)) {
      setSelectedContacts(selectedContacts.filter((c) => c.id !== contact.id));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const group = await conversationsApi.create({
        type: 'GROUP',
        name: groupName.trim(),
        description: groupDesc.trim() || undefined,
        participantIds: selectedIds,
      });

      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConversation(group);
      onGroupCreated?.();
      setGroupName('');
      setGroupDesc('');
      setSelectedContacts([]);
      setOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 select-none animate-fade-in" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md bg-[#1a1d21] border border-wa-border/50 rounded-2xl shadow-pop flex flex-col max-h-[85vh] animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-wa-border/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-wa-green/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-wa-green" />
            </div>
            <h2 className="text-base font-bold">Create Group</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="p-1.5 hover:bg-wa-sidebar-hover rounded-full transition">
            <X className="w-5 h-5 text-wa-secondary" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 flex-grow overflow-y-auto">
          {error && (
            <div className="p-3 text-xs bg-red-950/30 border border-red-500/40 rounded-xl text-red-200 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          )}

          {/* Group Name */}
          <div>
            <label className="text-xs font-semibold text-wa-secondary block mb-1.5">Group Name</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wa-secondary" />
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Squad, Project Team..."
                className="w-full bg-[#141416] border border-wa-border/40 rounded-xl pl-10 pr-4 py-2.5 text-sm text-wa-primary focus:outline-none focus:border-wa-green/60 focus:ring-1 focus:ring-wa-green/20 transition"
              />
            </div>
          </div>

          {/* Group Description */}
          <div>
            <label className="text-xs font-semibold text-wa-secondary block mb-1.5">Description (optional)</label>
            <textarea
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              placeholder="What's this group about?"
              rows={2}
              className="w-full bg-[#141416] border border-wa-border/40 rounded-xl px-3 py-2 text-sm text-wa-primary focus:outline-none focus:border-wa-green/60 focus:ring-1 focus:ring-wa-green/20 transition resize-none"
            />
          </div>

          {/* Add Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-wa-secondary">Add Members</label>
              {selectedContacts.length > 0 && (
                <span className="text-[10px] text-wa-green font-bold">{selectedContacts.length} selected</span>
              )}
            </div>

            {/* Selected Pills */}
            {selectedContacts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3 max-h-20 overflow-y-auto">
                {selectedContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-1.5 bg-wa-green/10 border border-wa-green/25 rounded-full pl-1 pr-2 py-0.5 text-xs text-wa-primary"
                  >
                    <Avatar src={contact.avatar} name={contact.displayName} size="xs" />
                    <span className="max-w-[80px] truncate font-medium">{contact.displayName}</span>
                    <button type="button" onClick={() => handleToggleSelect(contact)} className="p-0.5 hover:bg-wa-sidebar-hover rounded-full ml-0.5">
                      <X className="w-3 h-3 text-wa-secondary hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wa-secondary" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full bg-[#141416] border border-wa-border/40 rounded-xl pl-10 pr-4 py-2 text-sm text-wa-primary focus:outline-none focus:border-wa-green/60 focus:ring-1 focus:ring-wa-green/20 transition"
              />
            </div>

            {/* Contact List */}
            <div className="space-y-0.5 max-h-44 overflow-y-auto -mx-1">
              {loading ? (
                <div className="space-y-1 p-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 py-2 px-2">
                      <div className="w-8 h-8 rounded-full bg-wa-sidebar-hover animate-pulse" />
                      <div className="flex-1 h-3 bg-wa-sidebar-hover animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-6 text-wa-secondary">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No users found</p>
                </div>
              ) : (
                contacts.slice(0, 20).map((contact) => {
                  const isSelected = selectedIds.includes(contact.id);
                  return (
                    <div
                      key={contact.id}
                      onClick={() => handleToggleSelect(contact)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition ${
                        isSelected ? 'bg-wa-green/10' : 'hover:bg-wa-sidebar-hover/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={contact.avatar} name={contact.displayName} size="sm" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium truncate block">{contact.displayName}</span>
                          {contact.username && (
                            <span className="text-[10px] text-wa-secondary">@{contact.username}</span>
                          )}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition shrink-0 ${
                        isSelected ? 'bg-wa-green border-wa-green' : 'border-wa-border hover:border-wa-secondary'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-wa-border/40 bg-[#141416]/50 rounded-b-2xl">
          <p className="text-[11px] text-wa-secondary">
            {selectedContacts.length > 0
              ? `${selectedContacts.length} member${selectedContacts.length > 1 ? 's' : ''} · can add later`
              : 'You can add members later'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-xs font-semibold text-wa-secondary hover:text-wa-primary transition">
              Cancel
            </button>
            <button type="button"
              onClick={handleCreateGroup}
              disabled={creating || !groupName.trim()}
              className="flex items-center gap-1.5 px-5 py-2 bg-wa-green text-wa-sidebar text-xs font-bold rounded-xl hover:bg-wa-green/90 disabled:bg-wa-secondary/30 disabled:text-wa-secondary transition"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {creating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
