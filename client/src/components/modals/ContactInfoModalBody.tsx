import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, Shield, Phone, Check, UserPlus, Crown, Pencil, Search, UserMinus, Timer, Camera, Loader2, Clock, Trash2, FileText, Calendar, AtSign, Image, File, Link2, Mic, Users, UserCheck, Globe, ChevronDown, ChevronUp, Lock, Unlock, MessageCircle, UserCog, UserRoundCheck, HeartHandshake, Eraser, LogOut } from "lucide-react";
import { Avatar } from "../layout/Avatar";
import { MediaGallery } from "./MediaGallery";
import { InviteManager } from "./InviteManager";
import { formatLastSeen } from '../../utils/time.utils';
import { messagesApi } from '../../api/messages.api';
import { conversationsApi } from '../../api/conversations.api';
import type { PaginatedParticipants } from '../../api/conversations.api';

const PARTICIPANTS_PAGE_SIZE = 30;
const INITIAL_SHOW = 10;

export const ContactInfoModalBody: React.FC<{ p: any }> = ({ p }) => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['conversation-stats', p.conversation.id],
    queryFn: () => messagesApi.getStats(p.conversation.id),
    enabled: !!p.conversation.id,
  });

  const [participantOffset, setParticipantOffset] = useState(0);
  const [allParticipants, setAllParticipants] = useState<any[]>([]);
  const [participantsTotal, setParticipantsTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [groupSettingsTab, setGroupSettingsTab] = useState<'general' | 'permissions' | 'members' | 'advanced'>('general');

  const sortedParticipants = [...allParticipants].sort((a: any, b: any) => {
    const roleOrder = (r: string) => (r === 'ADMIN' ? 0 : 1);
    const aRole = a.role || a._role || (p.conversation.participants || []).find((m: any) => m.id === a.id)?.role;
    const bRole = b.role || b._role || (p.conversation.participants || []).find((m: any) => m.id === b.id)?.role;
    const roleDiff = roleOrder(aRole) - roleOrder(bRole);
    if (roleDiff !== 0) return roleDiff;
    return new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime();
  });

  const displayedParticipants = showAllMembers
    ? sortedParticipants
    : sortedParticipants.slice(0, INITIAL_SHOW);

  const loadParticipants = async (offset: number) => {
    setLoadingMore(true);
    try {
      const res: PaginatedParticipants = await conversationsApi.getParticipants(p.conversation.id, offset, PARTICIPANTS_PAGE_SIZE);
      if (offset === 0) {
        setAllParticipants(res.participants);
      } else {
        setAllParticipants(prev => [...prev, ...res.participants]);
      }
      setParticipantsTotal(res.total);
      setParticipantOffset(offset + res.participants.length);
    } catch (err) {
      console.error('Failed to load participants:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (p.conversation.type === 'GROUP') {
      loadParticipants(0);
    }
  }, [p.conversation.id, p.conversation.type]);

  const handleLoadMore = () => {
    loadParticipants(participantOffset);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="flex-grow overflow-y-auto">
      {/* Main User Card */}
      <div className="relative flex flex-col items-center p-6 pt-8 border-b border-wa-border/40 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(124,58,237,0.16),transparent_70%)] pointer-events-none" />
        {p.conversation.type === 'GROUP' && p.isAdmin ? (
          <div
            className="relative mb-4 cursor-pointer group"
            style={{ width: 120, height: 120 }}
            onClick={() => { if (!p.uploading && !p.removingLogo) p.fileRef.current?.click(); }}
          >
            <svg className="absolute inset-0 -rotate-90 pointer-events-none" width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={52} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
              {p.uploading && (
                <circle cx="60" cy="60" r={52} fill="none" stroke="#10b981" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52}
                  strokeDashoffset={2 * Math.PI * 52 - (p.progress / 100) * (2 * Math.PI * 52)}
                  style={{ transition: 'stroke-dashoffset .25s ease' }}
                />
              )}
            </svg>
            <div className="absolute inset-[5px] rounded-full overflow-hidden bg-zinc-800 ring-[3px] ring-black select-none">
              <Avatar src={p.conversation.avatar} name={p.displayName} size="2xl" className="w-full h-full" />
            </div>
            <div className="absolute inset-[5px] rounded-full bg-black/0 group-hover:bg-black/55 transition-all flex flex-col items-center justify-center opacity-0 group-hover:opacity-100">
              {p.uploading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <>
                  <Camera className="w-5 h-5 text-white mb-0.5" />
                  <span className="text-[9px] font-bold text-white uppercase tracking-widest">Change</span>
                </>
              )}
            </div>
            <input ref={p.fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={p.onFilePick} />
          </div>
        ) : (
          <Avatar
            src={p.conversation.type === 'GROUP' ? p.conversation.avatar : p.otherParticipant?.avatar}
            name={p.displayName}
            size="2xl"
            className="relative mb-3 ring-2 ring-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]"
          />
        )}
        {p.conversation.type === 'GROUP' && p.isAdmin && p.conversation.avatar && (
          <button
            type="button"
            onClick={p.handleRemoveLogo}
            disabled={p.removingLogo}
            className="flex items-center gap-1.5 mt-1 text-red-400 hover:text-red-300 transition-colors text-[11px] font-semibold"
          >
            {p.removingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Remove Photo</span>
          </button>
        )}
        {p.conversation.type === 'GROUP' && p.isAdmin && p.editingName ? (
          <div className="flex items-center gap-2 w-full max-w-[260px]">
            <input
              autoFocus
              value={p.groupNameDraft}
              onChange={(e) => p.setGroupNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && p.handleSaveName()}
              className="flex-grow px-2.5 py-1.5 bg-[#141416] border border-wa-border/40 rounded-lg text-sm text-wa-primary focus:outline-none focus:border-wa-green/60"
            />
            <button type="button" onClick={p.handleSaveName} disabled={p.savingName} className="p-1.5 bg-wa-green text-wa-sidebar rounded-lg hover:bg-wa-green/90 transition shrink-0">
              <Check className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => p.setEditingName(false)} className="p-1.5 text-wa-secondary hover:text-wa-primary transition shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative flex items-center gap-2">
            <h4 className="text-xl font-bold tracking-tight text-wa-primary">{p.displayName}</h4>
            {p.conversation.type === 'GROUP' && p.isAdmin && (
              <button type="button" onClick={() => { p.setGroupNameDraft(p.conversation.name || ''); p.setEditingName(true); }} title="Edit group name" className="p-1 text-wa-secondary hover:text-wa-green rounded-full hover:bg-wa-sidebar-hover transition">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        {p.conversation.type === 'GROUP' ? (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-wa-secondary">{participantsTotal || p.conversation.participants?.length || 0} participants</span>
            {p.conversation.isPublic && (
              <span className="text-[10px] bg-wa-green/10 text-wa-green border border-wa-green/25 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <Unlock className="w-2.5 h-2.5" /> Public
              </span>
            )}
          </div>
        ) : (
          <span className={`relative mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${p.otherParticipant?.isOnline ? 'bg-wa-accent/10 text-wa-accent border-emerald-500/25' : 'bg-white/[0.04] text-wa-secondary border-white/10'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.otherParticipant?.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
            {p.otherParticipant?.isOnline ? 'Online' : 'Offline'}
          </span>
        )}
      </div>

      {/* Group Description */}
      {p.conversation.type === 'GROUP' && (
        <SettingsSection title="About">
          {p.isAdmin && !p.editingDescription && (
            <button type="button" onClick={() => { p.setGroupDescriptionDraft(p.conversation.description || ''); p.setEditingDescription(true); }}
              className="text-[11px] font-semibold text-wa-green hover:underline flex items-center gap-1 shrink-0">
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
          {p.editingDescription ? (
            <div className="col-span-full space-y-2">
              <textarea
                value={p.groupDescriptionDraft}
                onChange={(e) => p.setGroupDescriptionDraft(e.target.value)}
                placeholder="Add a group description..."
                className="w-full px-2.5 py-1.5 bg-[#141416] border border-wa-border/40 rounded-lg text-xs text-wa-primary focus:outline-none focus:border-wa-green/60 h-20 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => p.setEditingDescription(false)} className="px-2.5 py-1 text-xs text-wa-secondary hover:text-wa-primary transition">Cancel</button>
                <button type="button" onClick={p.handleSaveDescription} disabled={p.savingDescription}
                  className="px-2.5 py-1 bg-wa-green text-wa-sidebar font-bold text-xs rounded-lg transition hover:bg-wa-green/90">
                  {p.savingDescription ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-wa-secondary leading-relaxed italic col-span-full">
              {p.conversation.description || 'No description provided.'}
            </p>
          )}
        </SettingsSection>
      )}

      {/* Contact Details (DIRECT) */}
      {p.conversation.type === 'DIRECT' && p.otherParticipant && (
        <DirectContactDetails p={p} formatDate={formatDate} />
      )}

      {/* Group Participants */}
      {p.conversation.type === 'GROUP' && (
        <div className="border-b border-wa-border/40">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h5 className="text-xs font-semibold text-wa-secondary uppercase tracking-wider">
              Participants · {participantsTotal || p.conversation.participants?.length || 0}
            </h5>
            <div className="flex items-center gap-2">
              {allParticipants.length < participantsTotal && participantsTotal > INITIAL_SHOW && (
                <button type="button"
                  onClick={() => setShowAllMembers(!showAllMembers)}
                  className="text-[11px] font-semibold text-wa-green hover:underline flex items-center gap-1"
                >
                  {showAllMembers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showAllMembers ? 'Show less' : `Show all (${participantsTotal})`}
                </button>
              )}
              {p.isAdmin && (
                <button type="button" onClick={() => p.setShowAddMembers((v: any) => !v)} className="flex items-center gap-1 text-[11px] font-semibold text-wa-green hover:underline">
                  <UserPlus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>
          </div>

          {/* Add members panel */}
          {p.isAdmin && p.showAddMembers && (
            <div className="mx-4 mb-3 bg-[#141416] border border-wa-border/40 rounded-xl p-3 space-y-2.5 animate-scale-in origin-top">
              <div className="relative flex items-center bg-[#18181b] rounded-lg px-2.5 py-1.5 border border-wa-border/40">
                <Search className="w-4 h-4 text-wa-secondary mr-2 shrink-0" />
                <input type="text" value={p.contactSearch} onChange={(e) => p.setContactSearch(e.target.value)}
                  placeholder="Search contacts" className="bg-transparent border-none text-xs text-wa-primary placeholder-wa-secondary focus:outline-none w-full" />
              </div>
              <div className="max-h-[160px] overflow-y-auto divide-y divide-wa-border/30">
                {p.contactResults.filter((u: any) => !(p.conversation.participants || []).some((m: any) => m.id === u.id)).length === 0 ? (
                  <div className="text-center text-[11px] text-wa-secondary py-3">No contacts to add</div>
                ) : (
                  p.contactResults.filter((u: any) => !(p.conversation.participants || []).some((m: any) => m.id === u.id))
                    .map((u: any) => {
                      const sel = p.selectedToAdd.includes(u.id);
                      return (
                        <div key={u.id} onClick={() => p.setSelectedToAdd((prev: string[]) => prev.includes(u.id) ? prev.filter((i: string) => i !== u.id) : [...prev, u.id])}
                          className="flex items-center justify-between py-1.5 px-1 cursor-pointer hover:bg-wa-sidebar-hover/40 rounded transition">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <Avatar src={u.avatar} name={u.displayName} size="sm" className="shrink-0" />
                            <span className="text-[13px] font-semibold truncate text-wa-primary">{u.displayName}</span>
                          </div>
                          <div className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-wa-green border-wa-green text-wa-sidebar' : 'border-wa-secondary/60'}`}>
                            {sel && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
              <button type="button" onClick={p.handleAddMembers} disabled={p.selectedToAdd.length === 0 || p.addingMembers}
                className="w-full py-2 bg-wa-green text-wa-sidebar text-[11px] font-bold rounded-lg hover:bg-wa-green/90 disabled:bg-wa-secondary/30 disabled:text-wa-secondary transition">
                {p.addingMembers ? 'Adding…' : `Add ${p.selectedToAdd.length || ''} member${p.selectedToAdd.length === 1 ? '' : 's'}`}
              </button>
            </div>
          )}

          <div className="px-4 pb-4 space-y-0.5">
            {loadingMore && allParticipants.length === 0 ? (
              <div className="space-y-1.5 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-2 px-3">
                    <div className="w-9 h-9 rounded-full bg-white/[0.04] animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-28 bg-white/[0.04] rounded-full animate-pulse" />
                      <div className="h-2 w-16 bg-white/[0.02] rounded-full animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayedParticipants.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-zinc-500 italic">No participants found</div>
            ) : (
              displayedParticipants.map((member: any) => {
                const isMe = member.id === p.currentUser?.id;
                const memberInConv = (p.conversation.participants || []).find((m: any) => m.id === member.id);
                const role = member.role || memberInConv?.role;
                const isAdmin = role === 'ADMIN';
                return (
                  <div key={member.id} className="group/member flex items-center justify-between min-w-0 py-1.5 px-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <div
                      onClick={() => !isMe && p.handleMemberClick(member.id)}
                      className={`flex items-center space-x-3 min-w-0 flex-1 ${!isMe ? 'cursor-pointer' : ''}`}
                    >
                      <div className="relative shrink-0">
                        <Avatar src={member.avatar} name={member.displayName} size="sm" className="shrink-0" />
                        {isAdmin && (
                          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center ring-[1.5px] ring-[#0d0d11]">
                            <Crown className="w-2 h-2 text-black" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm truncate block leading-tight ${isMe ? 'font-semibold text-wa-green' : 'font-medium text-wa-primary'}`}>
                            {isMe ? 'You' : member.displayName}
                          </span>
                          {isAdmin && (
                            <span className="shrink-0 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded uppercase tracking-wider leading-none">
                              Admin
                            </span>
                          )}
                        </div>
                        {member.joinedAt && (
                          <span className="text-[10px] text-zinc-500">Joined {formatDate(member.joinedAt)}</span>
                        )}
                      </div>
                    </div>
                    {p.isAdmin && !isMe && (
                      <div className="flex items-center gap-1 shrink-0 ml-2 opacity-0 group-hover/member:opacity-100 transition-opacity">
                        <button type="button" onClick={() => p.handleToggleRole(member.id, role)}
                          title={isAdmin ? 'Dismiss as admin' : 'Make admin'}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-white/[0.06] transition">
                          <Crown className={`w-3.5 h-3.5 ${isAdmin ? 'fill-current text-amber-400' : ''}`} />
                        </button>
                        <button type="button" onClick={() => p.handleRemoveMember(member.id)}
                          title="Remove from group"
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-white/[0.06] transition">
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {showAllMembers && participantOffset < participantsTotal && (
              <button type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-2.5 mt-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.03] rounded-xl transition flex items-center justify-center gap-2 border border-dashed border-white/[0.06]"
              >
                {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {loadingMore ? 'Loading...' : `Load more (${participantsTotal - participantOffset} remaining)`}
              </button>
            )}
            {!showAllMembers && participantsTotal > INITIAL_SHOW && (
              <button type="button"
                onClick={() => setShowAllMembers(true)}
                className="w-full py-2 mt-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.03] rounded-xl transition flex items-center justify-center gap-2"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Show all {participantsTotal} participants
              </button>
            )}
          </div>
        </div>
      )      }

      {/* Group Info — visible to all */}
      {p.conversation.type === 'GROUP' && (
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <h6 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-3">Group Info</h6>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
            {p.conversation.description && (
              <div className="flex items-start gap-3 px-4 py-3">
                <FileText className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Description</p>
                  <p className="text-xs text-zinc-200 leading-relaxed mt-0.5">{p.conversation.description}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 px-4 py-3">
              <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Created</p>
                <p className="text-xs text-zinc-200 mt-0.5">
                  {p.conversation.createdAt ? formatDate(p.conversation.createdAt) : 'Unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Members</p>
                <p className="text-xs text-zinc-200 mt-0.5">{participantsTotal || p.conversation.participants?.length || 0}</p>
              </div>
            </div>
            {p.conversation.isPublic && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Visibility</p>
                  <p className="text-xs text-emerald-400 mt-0.5">Public Group</p>
                </div>
              </div>
            )}
            {p.conversation.isAnnouncementMode && (
              <div className="flex items-center gap-3 px-4 py-3">
                <MessageCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Mode</p>
                  <p className="text-xs text-amber-400 mt-0.5">Announcement Only</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Group Settings (Admins Only) — Tabbed View */}
      {p.conversation.type === 'GROUP' && p.isAdmin && (
        <div className="mx-4 my-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Tab headers */}
          <div className="flex border-b border-white/[0.06]">
            {(['general', 'permissions', 'members', 'advanced'] as const).map((tab) => (
              <button type="button"
                key={tab}
                onClick={() => setGroupSettingsTab(tab)}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-[0.1em] transition-all relative ${
                  groupSettingsTab === tab
                    ? 'text-wa-green'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span className="relative z-10">
                  {tab === 'general' ? 'General' : tab === 'permissions' ? 'Permissions' : tab === 'members' ? 'Members' : 'Advanced'}
                </span>
                {groupSettingsTab === tab && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-wa-green rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">
            {/* General Tab */}
            {groupSettingsTab === 'general' && (
              <>
                <ToggleSetting
                  icon={p.conversation.isPublic ? Unlock : Lock}
                  label="Public Group"
                  desc="Anyone can find and join this group"
                  checked={p.conversation.isPublic || false}
                  onChange={(checked) => p.handleUpdateGroupSetting('isPublic', checked)}
                  color="green"
                />
                <ToggleSetting
                  icon={MessageCircle}
                  label="Announcement Mode"
                  desc="Only admins can send messages"
                  checked={p.conversation.isAnnouncementMode || false}
                  onChange={(checked) => p.handleUpdateGroupSetting('isAnnouncementMode', checked)}
                />
              </>
            )}

            {/* Permissions Tab */}
            {groupSettingsTab === 'permissions' && (
              <>
                <ToggleSetting
                  icon={UserCog}
                  label="Admin Approval Required"
                  desc="Approve members joining via invite"
                  checked={p.conversation.requiresApproval || false}
                  onChange={(checked) => p.handleUpdateGroupSetting('requiresApproval', checked)}
                />
                <SelectSetting
                  icon={UserPlus}
                  label="Who can invite"
                  value={p.conversation.invitePermission || 'EVERYONE'}
                  options={[
                    { value: 'EVERYONE', label: 'Everyone' },
                    { value: 'ADMINS', label: 'Admins only' },
                  ]}
                  onChange={(v) => p.handleUpdateGroupSetting('invitePermission', v)}
                />
                <SelectSetting
                  icon={MessageCircle}
                  label="Who can send messages"
                  value={p.conversation.messagePermission || 'EVERYONE'}
                  options={[
                    { value: 'EVERYONE', label: 'Everyone' },
                    { value: 'ADMINS', label: 'Admins only' },
                  ]}
                  onChange={(v) => p.handleUpdateGroupSetting('messagePermission', v)}
                />
                <SelectSetting
                  icon={Pencil}
                  label="Who can edit group info"
                  value={p.conversation.editPermission || 'ADMINS'}
                  options={[
                    { value: 'EVERYONE', label: 'Everyone' },
                    { value: 'ADMINS', label: 'Admins only' },
                  ]}
                  onChange={(v) => p.handleUpdateGroupSetting('editPermission', v)}
                />
              </>
            )}

            {/* Members Tab */}
            {groupSettingsTab === 'members' && (
              <>
                <button type="button"
                  onClick={() => p.setShowAddMembers(!p.showAddMembers)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-wa-green/10 hover:bg-wa-green/15 text-wa-green text-xs font-semibold transition"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Members
                </button>
                <p className="text-center text-[11px] text-zinc-500">
                  {participantsTotal || p.conversation.participants?.length || 0} total members
                </p>
              </>
            )}

            {/* Advanced Tab */}
            {groupSettingsTab === 'advanced' && (
              <>
                <button type="button"
                  onClick={() => p.handleArchive()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs font-semibold transition"
                >
                  <Timer className="w-4 h-4" />
                  {p.conversation.archivedAt ? 'Unarchive Group' : 'Archive Group'}
                </button>
                <button type="button"
                  onClick={() => p.handleDeleteChat()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 text-red-400 text-xs font-semibold transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Group
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pending Join Requests */}
      {p.conversation.type === 'GROUP' && p.isAdmin && p.conversation.requiresApproval && p.pendingRequests.length > 0 && (
        <SettingsSection title={<span className="text-amber-500">Join Requests ({p.pendingRequests.length})</span>}>
          <div className="space-y-2.5 col-span-full">
            {p.pendingRequests.map((req: any) => (
              <div key={req.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Avatar src={req.user.avatar} name={req.user.displayName} size="sm" className="shrink-0" />
                  <span className="text-xs font-semibold text-wa-primary truncate">{req.user.displayName}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => p.handleJoinRequest(req.id, 'APPROVE')} className="bg-wa-green text-wa-sidebar text-[10px] font-bold px-2.5 py-1 rounded-lg hover:bg-wa-green/90 transition">Approve</button>
                  <button type="button" onClick={() => p.handleJoinRequest(req.id, 'REJECT')} className="bg-red-950/30 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-red-500/25 hover:bg-red-950/50 transition">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </SettingsSection>
      )}

      {/* Audit Log */}
      {p.conversation.type === 'GROUP' && (
        <SettingsSection title="History Audit Log">
          <button type="button" onClick={() => p.setShowAuditLog((v: any) => !v)} className="col-span-full flex items-center justify-between text-xs font-semibold text-wa-secondary">
            <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Activity Log</span>
            <span className="text-wa-green text-[11px] normal-case">{p.showAuditLog ? 'Hide' : 'View'}</span>
          </button>
          {p.showAuditLog && (
            <div className="col-span-full space-y-2 max-h-[180px] overflow-y-auto divide-y divide-wa-border/30 animate-scale-in origin-top">
              {p.loadingAuditLog ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-wa-secondary"><Loader2 className="w-4 h-4 animate-spin" /> Loading logs…</div>
              ) : p.auditLogs.length === 0 ? (
                <p className="text-[11px] text-wa-secondary py-2 italic">No history recorded yet.</p>
              ) : (
                p.auditLogs.map((log: any) => (
                  <div key={log.id} className="pt-2 text-[11px] space-y-0.5">
                    <div className="flex justify-between text-[9px] text-wa-secondary">
                      <span className="font-semibold text-wa-primary">{log.actor.displayName}</span>
                      <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-wa-secondary leading-normal">{p.formatAuditLogAction(log)}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </SettingsSection>
      )}

      {/* Invite Links */}
      {p.conversation.type === 'GROUP' && p.isAdmin && (
        <InviteManager conversationId={p.conversation.id} />
      )}

      {/* Shared Content (GROUP only — DIRECT shows in ContactDetails) */}
      {p.conversation.type === 'GROUP' && (
        <div className="px-4 py-4 border-b border-wa-border/40 space-y-3">
          <h5 className="text-xs font-semibold text-wa-secondary uppercase tracking-wider">Shared Content</h5>
          {statsLoading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-wa-secondary"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading stats…</div>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={<Image className="w-4 h-4 text-wa-green" />} value={stats.media} label="Media" />
              <StatCard icon={<File className="w-4 h-4 text-amber-500" />} value={stats.files} label="Files" />
              <StatCard icon={<Link2 className="w-4 h-4 text-sky-400" />} value={stats.links} label="Links" />
              <StatCard icon={<Mic className="w-4 h-4 text-wa-accent" />} value={stats.voice} label="Voice" />
            </div>
          ) : null}
        </div>
      )}

      {/* Media Gallery */}
      <MediaGallery conversationId={p.conversation.id} />

      {/* Notification Settings */}
      <div className="px-4 py-4 border-b border-wa-border/40 space-y-2">
        <span className="text-xs font-semibold text-wa-secondary uppercase tracking-wider block">Notifications</span>
        <div className="grid grid-cols-3 gap-1.5">
          {(['ALL', 'MENTIONS_ONLY', 'MUTE'] as const).map((pref) => (
            <button type="button" key={pref} onClick={() => p.handleUpdateNotificationPreference(pref)}
              className={`py-1.5 px-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all duration-150 ${
                (p.conversation.notificationPreference || 'ALL') === pref
                  ? 'bg-wa-green/15 text-wa-green border-wa-green/35'
                  : 'bg-transparent text-wa-secondary border-wa-border/40 hover:bg-wa-sidebar-hover hover:text-wa-primary'
              }`}>
              {pref === 'ALL' ? 'All' : pref === 'MENTIONS_ONLY' ? 'Mentions' : 'Mute'}
            </button>
          ))}
        </div>
      </div>

      {/* Disappearing Messages */}
      {(p.conversation.type === 'DIRECT' || p.isAdmin) && (
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <DisappearingMessages p={p} />
        </div>
      )}

      {/* Danger Zone — Action Buttons */}
      <div className="px-4 py-5 space-y-2.5">
        {p.conversation.type === 'DIRECT' ? (
          <>
            {p.isBlocked ? (
              <button type="button"
                onClick={p.handleToggleBlock}
                className="w-full py-2.5 bg-wa-accent/15 text-wa-accent border border-emerald-500/30 font-semibold text-[13px] rounded-2xl hover:bg-wa-accent/25 transition"
              >
                Unblock {p.displayName}
              </button>
            ) : (
              <button type="button"
                onClick={() => p.setShowConfirmBlock(true)}
                className="w-full py-2.5 bg-red-500/[0.08] text-red-400 border border-red-500/25 font-semibold text-[13px] rounded-2xl hover:bg-red-500/15 transition"
              >
                Block {p.displayName}
              </button>
            )}

            <div className="flex gap-2">
              <button type="button"
                onClick={() => p.setShowReport(true)}
                className="flex-1 py-2.5 text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] text-[13px] font-semibold rounded-2xl border border-white/[0.07] transition"
              >
                Report
              </button>
              <button type="button"
                onClick={p.handleClearChat}
                disabled={p.clearing}
                className="flex-1 py-2.5 bg-white/[0.03] text-zinc-200 font-semibold text-[13px] rounded-2xl hover:bg-white/[0.06] transition flex items-center justify-center gap-2 border border-white/[0.07]"
              >
                <Eraser className="w-4 h-4 text-amber-500" />
                <span>{p.clearing ? 'Clearing…' : 'Clear'}</span>
              </button>
            </div>

            <button type="button"
              onClick={p.handleDeleteChat}
              disabled={p.deleting}
              className="w-full py-2.5 bg-red-500/[0.08] text-red-400 border border-red-500/25 font-semibold text-[13px] rounded-2xl hover:bg-red-500/15 transition flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>{p.deleting ? 'Deleting…' : 'Delete Chat'}</span>
            </button>
          </>
        ) : (
          <>
            <button type="button"
              onClick={p.handleClearChat}
              disabled={p.clearing}
              className="w-full py-2.5 bg-white/[0.03] text-zinc-200 font-semibold text-[13px] rounded-2xl hover:bg-white/[0.06] transition flex items-center justify-center gap-2 border border-white/[0.07]"
            >
              <Eraser className="w-4 h-4 text-amber-500" />
              <span>{p.clearing ? 'Clearing…' : 'Clear Chat'}</span>
            </button>

            <button type="button"
              onClick={p.handleDeleteChat}
              disabled={p.deleting}
              className="w-full py-2.5 bg-red-500/[0.08] text-red-400 border border-red-500/25 font-semibold text-[13px] rounded-2xl hover:bg-red-500/15 transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>{p.deleting ? 'Leaving…' : 'Leave Group'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ── Helper Components ── */

const SettingsSection: React.FC<{ title: any; children: React.ReactNode }> = ({ title, children }) => (
  <div className="px-4 py-4 border-b border-wa-border/40 space-y-3">
    <h5 className="text-xs font-semibold text-wa-secondary uppercase tracking-wider flex items-center gap-2">{title}</h5>
    <div className="space-y-2.5">
      {children}
    </div>
  </div>
);

const ToggleSetting: React.FC<{
  icon: React.ComponentType<any>;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  color?: string;
}> = ({ icon: Icon, label, desc, checked, onChange, color = 'wa-green' }) => (
  <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-wa-sidebar-hover/30 transition">
    <div className="flex items-center gap-2.5 min-w-0">
      <Icon className={`w-4 h-4 shrink-0 ${checked ? `text-${color}` : 'text-wa-secondary'}`} />
      <div className="min-w-0">
        <span className="text-xs font-semibold text-wa-primary block leading-tight">{label}</span>
        <span className="text-[10px] text-wa-secondary leading-tight block">{desc}</span>
      </div>
    </div>
    <button type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-wa-green' : 'bg-wa-border/60'
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
        checked ? 'translate-x-5' : ''
      }`} />
    </button>
  </div>
);

const SelectSetting: React.FC<{
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}> = ({ icon: Icon, label, value, options, onChange }) => (
  <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-wa-sidebar-hover/30 transition">
    <div className="flex items-center gap-2.5 min-w-0">
      <Icon className="w-4 h-4 shrink-0 text-wa-secondary" />
      <span className="text-xs font-semibold text-wa-primary">{label}</span>
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#141416] border border-wa-border/40 rounded-lg px-2.5 py-1 text-xs text-wa-primary font-semibold focus:outline-none focus:border-wa-green/60 cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const StatCard: React.FC<{ icon: React.ReactNode; value: number; label: string }> = ({ icon, value, label }) => (
  <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3 hover:bg-white/[0.06] hover:border-white/10 transition-colors duration-150">
    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.04] shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-base font-bold text-wa-primary leading-tight tabular-nums">{value}</p>
      <p className="text-[9px] text-wa-secondary uppercase tracking-wider font-semibold truncate">{label}</p>
    </div>
  </div>
);

const DisappearingMessages: React.FC<{ p: any }> = ({ p }) => {
  const [open, setOpen] = useState(false);
  const options: [string, number | null][] = [['Off', null], ['24 hours', 86400], ['7 days', 604800], ['90 days', 7776000]];
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-2 px-3 text-xs font-semibold text-wa-primary rounded-xl transition border border-wa-border/40 hover:bg-wa-sidebar-hover/60">
        <span className="flex items-center gap-2.5">
          <Timer className={`w-4 h-4 ${p.ttl ? 'text-wa-green' : 'text-wa-secondary'}`} />
          <span>Disappearing messages</span>
        </span>
        <span className={`text-[11px] ${p.ttl ? 'text-wa-green' : 'text-wa-secondary'}`}>{p.ttlLabel(p.ttl)}</span>
      </button>
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-[#141416] border border-wa-border rounded-xl shadow-pop p-1 animate-scale-in">
          {options.map(([label, secs]) => (
            <button type="button" key={label} onClick={() => { p.handleSetDisappearing(secs); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition ${p.ttl === secs ? 'text-wa-green bg-wa-green/10' : 'text-wa-primary hover:bg-wa-sidebar-hover'}`}>
              <span>{label}</span>
              {p.ttl === secs && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Direct Contact Details ── */
const DirectContactDetails: React.FC<{ p: any; formatDate: (iso: string) => string }> = ({ p, formatDate }) => {
  const [sendingRequest, setSendingRequest] = useState(false);
  const [showMutualGroupList, setShowMutualGroupList] = useState(false);
  const isSelf = p.otherParticipant?.id === p.currentUser?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contact-details', p.conversation.id],
    queryFn: () => conversationsApi.getContactDetails(p.conversation.id),
    enabled: !!p.conversation.id && !isSelf,
  });

  const friendStatus = data?.friendStatus || 'none';
  const stats = data?.stats;
  const mutualGroups = data?.mutualGroups || 0;
  const mutualGroupIds = data?.mutualGroupIds || [];
  const mutualFriends = data?.mutualFriends || 0;

  const handleSendFriendRequest = async () => {
    if (!p.otherParticipant?.id) return;
    setSendingRequest(true);
    try {
      const { friendsApi } = await import('../../api/friends.api');
      await friendsApi.sendRequest(p.otherParticipant.id);
    } catch (err) {
      console.error('Failed to send friend request:', err);
    } finally {
      setSendingRequest(false);
    }
  };

  const resolveMutualGroups = (): { id: string; name: string; avatar?: string }[] => {
    const conversations = queryClient.getQueryData<any[]>(['conversations']);
    if (!Array.isArray(conversations)) return [];
    return mutualGroupIds
      .map((id: string) => conversations.find((c: any) => c.id === id))
      .filter(Boolean)
      .map((c: any) => ({ id: c.id, name: c.name || 'Unnamed Group', avatar: c.avatar }));
  };

  const mutualGroupList = showMutualGroupList ? resolveMutualGroups() : [];

  const other = p.otherParticipant;

  if (isLoading) {
    return (
      <div className="px-4 py-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-3.5 w-28 bg-white/[0.04] rounded-full animate-pulse" />
            <div className="h-2.5 w-20 bg-white/[0.04] rounded-full animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
        <div className="h-10 rounded-2xl bg-white/[0.03] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/[0.06]">
      {/* Friend Relationship Card */}
      {!isSelf && friendStatus && (
        <div className="px-4 py-3.5">
          <FriendBadge
            status={friendStatus}
            loading={sendingRequest}
            onAdd={handleSendFriendRequest}
          />
        </div>
      )}

      {/* Profile Info — Glass Card */}
      <div className="px-4 py-4">
        <h6 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-3">About</h6>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
          {other?.bio && (
            <ProfileRow icon={<FileText className="w-3.5 h-3.5" />} label="Bio" value={other.bio} />
          )}
          {other?.phone && (
            <ProfileRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={other.phone} />
          )}
          {other?.username && (
            <ProfileRow icon={<AtSign className="w-3.5 h-3.5" />} label="Username" value={`@${other.username}`} />
          )}
          {other?.createdAt && (
            <ProfileRow icon={<Calendar className="w-3.5 h-3.5" />} label="Joined" value={formatDate(other.createdAt)} />
          )}
          {!other?.isOnline && other?.lastSeen && (
            <ProfileRow icon={<Clock className="w-3.5 h-3.5" />} label="Last seen" value={formatLastSeen(other.lastSeen)} />
          )}
          <ProfileRow icon={<Shield className="w-3.5 h-3.5" />} label="ID" value={other?.id?.slice(0, 12) + '…'} mono />
        </div>
      </div>

      {/* Shared Content — Stat Tiles */}
      <div className="px-4 py-4">
        <h6 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-3">Shared</h6>
        <div className="grid grid-cols-4 gap-1.5">
          <StatTile icon={<Image className="w-3.5 h-3.5" />} value={stats?.media ?? 0} label="Media" />
          <StatTile icon={<File className="w-3.5 h-3.5" />} value={stats?.files ?? 0} label="Files" />
          <StatTile icon={<Link2 className="w-3.5 h-3.5" />} value={stats?.links ?? 0} label="Links" />
          <StatTile icon={<Mic className="w-3.5 h-3.5" />} value={stats?.voice ?? 0} label="Voice" />
        </div>
      </div>

      {/* Mutual Connections — Pills */}
      {(mutualGroups > 0 || mutualFriends > 0) && (
        <div className="px-4 py-4">
          <h6 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-3">Mutual</h6>
          <div className="flex flex-wrap gap-2">
            {mutualGroups > 0 && (
              <button type="button" onClick={() => setShowMutualGroupList(!showMutualGroupList)} className="focus:outline-none">
                <MutualPill icon={<Users className="w-3 h-3" />} count={mutualGroups} label="groups" color="violet" />
              </button>
            )}
            {mutualFriends > 0 && (
              <MutualPill icon={<HeartHandshake className="w-3 h-3" />} count={mutualFriends} label="friends" color="emerald" />
            )}
          </div>
          {/* Expanded group list */}
          {showMutualGroupList && mutualGroupList.length > 0 && (
            <div className="mt-3 space-y-1 animate-scale-in origin-top">
              {mutualGroupList.map((g) => (
                <button type="button"
                  key={g.id}
                  onClick={() => navigate(`/conversation/${g.id}`)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.04] transition text-left"
                >
                  <Avatar src={g.avatar} name={g.name} size="sm" className="shrink-0" />
                  <span className="text-xs font-semibold text-zinc-200 truncate">{g.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FriendBadge: React.FC<{ status: string; loading: boolean; onAdd: () => void }> = ({ status, loading, onAdd }) => {
  if (status === 'friend') {
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-emerald-500/[0.07] border border-emerald-500/15 rounded-2xl">
        <div className="w-7 h-7 rounded-xl bg-emerald-500/15 flex items-center justify-center">
          <UserRoundCheck className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <span className="text-sm font-semibold text-emerald-400">Friend</span>
      </div>
    );
  }
  if (status === 'pending_sent') {
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-500/[0.07] border border-amber-500/15 rounded-2xl">
        <div className="w-7 h-7 rounded-xl bg-amber-500/15 flex items-center justify-center">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <span className="text-sm font-semibold text-amber-400">Request sent</span>
      </div>
    );
  }
  if (status === 'pending_received') {
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-sky-500/[0.07] border border-sky-500/15 rounded-2xl">
        <div className="w-7 h-7 rounded-xl bg-sky-500/15 flex items-center justify-center">
          <UserCheck className="w-3.5 h-3.5 text-sky-400" />
        </div>
        <span className="text-sm font-semibold text-sky-400">Request received</span>
      </div>
    );
  }
  return (
    <button type="button"
      onClick={onAdd}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-wa-accent/15 to-emerald-500/15 text-wa-accent border border-wa-accent/20 rounded-2xl text-sm font-bold hover:from-wa-accent/25 hover:to-emerald-500/25 transition-all disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
      {loading ? 'Sending...' : 'Add Friend'}
    </button>
  );
};

const ProfileRow: React.FC<{ icon: React.ReactNode; label: string; value: string; mono?: boolean }> = ({ icon, label, value, mono }) => (
  <div className="flex items-center gap-3 px-3.5 py-2.5">
    <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-zinc-400 shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <p className={`text-xs font-medium ${mono ? 'font-mono text-zinc-400 tracking-tight' : 'text-zinc-200'}`}>{value}</p>
      <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">{label}</p>
    </div>
  </div>
);

const StatTile: React.FC<{ icon: React.ReactNode; value: number; label: string }> = ({ icon, value, label }) => (
  <div className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/10 transition-colors">
    <div className="text-zinc-400">{icon}</div>
    <span className="text-sm font-bold text-zinc-100 tabular-nums leading-none">{value}</span>
    <span className="text-[8px] text-zinc-500 uppercase tracking-wider font-semibold">{label}</span>
  </div>
);

const MutualPill: React.FC<{ icon: React.ReactNode; count: number; label: string; color: 'violet' | 'emerald' }> = ({ icon, count, label, color }) => {
  const ring = color === 'violet' ? 'border-violet-500/20 text-violet-300' : 'border-emerald-500/20 text-emerald-300';
  const bg = color === 'violet' ? 'bg-violet-500/8' : 'bg-emerald-500/8';
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border ${ring} ${bg}`}>
      {icon}
      <span className="text-xs font-bold tabular-nums">{count}</span>
      <span className="text-[10px] text-zinc-400">{label}</span>
    </div>
  );
};
