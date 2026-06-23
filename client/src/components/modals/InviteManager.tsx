import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Copy, Check, Trash2, Plus, Loader2 } from 'lucide-react';
import { conversationsApi } from '../../api/conversations.api';
import type { GroupInvite } from '../../api/conversations.api';

interface InviteManagerProps {
  conversationId: string;
}

const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

export const InviteManager: React.FC<InviteManagerProps> = ({ conversationId }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [expiresInHours, setExpiresInHours] = useState<number | undefined>(undefined);
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ['invites', conversationId],
    queryFn: () => conversationsApi.listInvites(conversationId),
    enabled: open,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['invites', conversationId] });

  const handleCreate = async () => {
    setCreating(true);
    try {
      await conversationsApi.createInvite(conversationId, { expiresInHours, maxUses });
      await refresh();
    } catch (err) {
      console.error('Failed to create invite:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token: string) => {
    try {
      await conversationsApi.revokeInvite(token);
      await refresh();
    } catch (err) {
      console.error('Failed to revoke invite:', err);
    }
  };

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const describeLimits = (inv: GroupInvite) => {
    const parts: string[] = [];
    if (inv.expiresAt) parts.push(`expires ${new Date(inv.expiresAt).toLocaleDateString()}`);
    if (inv.maxUses) parts.push(`${inv.useCount}/${inv.maxUses} uses`);
    else parts.push(`${inv.useCount} uses`);
    return parts.join(' · ');
  };

  return (
    <div className="bg-wa-sidebar p-4 border-b border-wa-border space-y-3">
      <button type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-[12px] font-semibold text-wa-secondary uppercase tracking-wider"
      >
        <span className="flex items-center gap-2">
          <Link2 className="w-4 h-4" /> Invite via link
        </span>
        <span className="text-wa-green text-[11px] normal-case">{open ? 'Hide' : 'Manage'}</span>
      </button>

      {open && (
        <div className="space-y-2 animate-scale-in origin-top">
          {isLoading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-wa-secondary">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : invites.length === 0 ? (
            <p className="text-[11px] text-wa-secondary py-1">No active invite links.</p>
          ) : (
            invites.map((inv) => (
              <div
                key={inv.token}
                className="flex items-center justify-between gap-2 bg-[#141416] border border-wa-border/60 rounded-lg px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[12px] text-wa-primary font-mono truncate">/invite/{inv.token.slice(0, 10)}…</p>
                  <p className="text-[10px] text-wa-secondary">{describeLimits(inv)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button"
                    onClick={() => handleCopy(inv.token)}
                    title="Copy link"
                    className="p-1.5 text-wa-secondary hover:text-wa-green hover:bg-wa-sidebar-hover rounded-full transition"
                  >
                    {copiedToken === inv.token ? <Check className="w-3.5 h-3.5 text-wa-green" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button type="button"
                    onClick={() => handleRevoke(inv.token)}
                    title="Revoke link"
                    className="p-1.5 text-wa-secondary hover:text-red-400 hover:bg-wa-sidebar-hover rounded-full transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}

          <div className="flex gap-2 items-center bg-[#141416] p-2 border border-wa-border/50 rounded-lg text-[11px] animate-scale-in">
            <div className="flex-1 space-y-1 text-left">
              <label className="text-wa-secondary block font-bold uppercase tracking-wider text-[8px]">Expires</label>
              <select
                value={expiresInHours === undefined ? '' : String(expiresInHours)}
                onChange={(e) => setExpiresInHours(e.target.value === '' ? undefined : Number(e.target.value))}
                className="w-full bg-[#18181b] border border-wa-border rounded px-1 py-0.5 text-wa-primary focus:outline-none"
              >
                <option value="">Never</option>
                <option value="1">1 Hour</option>
                <option value="24">1 Day</option>
                <option value="168">7 Days</option>
                <option value="720">30 Days</option>
              </select>
            </div>

            <div className="flex-1 space-y-1 text-left">
              <label className="text-wa-secondary block font-bold uppercase tracking-wider text-[8px]">Max Uses</label>
              <select
                value={maxUses === undefined ? '' : String(maxUses)}
                onChange={(e) => setMaxUses(e.target.value === '' ? undefined : Number(e.target.value))}
                className="w-full bg-[#18181b] border border-wa-border rounded px-1 py-0.5 text-wa-primary focus:outline-none"
              >
                <option value="">Unlimited</option>
                <option value="1">1 use</option>
                <option value="5">5 uses</option>
                <option value="10">10 uses</option>
                <option value="25">25 uses</option>
                <option value="100">100 uses</option>
              </select>
            </div>
          </div>

          <button type="button"
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 py-2 bg-wa-green/15 text-wa-green text-[11px] font-bold uppercase tracking-wide rounded-lg hover:bg-wa-green/25 transition disabled:opacity-60"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create invite link
          </button>
        </div>
      )}
    </div>
  );
};
