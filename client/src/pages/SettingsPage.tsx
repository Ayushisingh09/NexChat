import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import {
  Camera, Check, Pencil, Mail, Phone, FileText, User,
  Loader2, AlertCircle, AtSign, LogOut, Shield, Eye, EyeOff,
  Calendar, Trash2, Monitor, Smartphone, MonitorSmartphone,
  QrCode, Copy, Link2, Lock, ArrowRight, MonitorSmartphone as DevicesIcon,
  Bell, Volume2, Image, Palette, Database, KeyRound,
  Cloud, Keyboard, Wrench, Sparkles, Wand2, RefreshCw, X, ChevronRight,
} from 'lucide-react';
import QRCode from 'qrcode';
import { usersApi, type Session } from '../api/users.api';
import { authApi } from '../api/auth.api';
import { useMediaUpload } from '../hooks/useMediaUpload';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAIImage } from '../hooks/useAIImage';
import { Avatar } from '../components/layout/Avatar';
import { ImageGeneration } from '../components/ui/ai-chat-image-generation-1';
import { ListItem } from '../components/layout/ListItem';
import { AvatarCropper } from '../components/modals/AvatarCropper';
import { TopBar } from '../components/layout/TopBar';
import { SettingsWallpaper } from '../components/settings/SettingsWallpaper';
import { SettingsNotifications } from '../components/settings/SettingsNotifications';
import { SettingsStorage } from '../components/settings/SettingsStorage';
import { SettingsPrivacySecurity } from '../components/settings/SettingsPrivacySecurity';
import { SettingsBackup } from '../components/settings/SettingsBackup';
import { SettingsShortcuts } from '../components/settings/SettingsShortcuts';
import { SettingsAppearance } from '../components/settings/SettingsAppearance';
import { SettingsAdvanced } from '../components/settings/SettingsAdvanced';

type Section = 'profile' | 'privacy' | 'account' | 'devices'
  | 'wallpaper' | 'notifications' | 'storage' | 'security'
  | 'backup' | 'shortcuts' | 'appearance' | 'advanced';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const user       = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearAuth  = useAuthStore((s) => s.clearAuth);

  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading, progress } = useMediaUpload();
  const { generate: generateAiImage } = useAIImage();

  const [section, setSection] = useState<Section>('profile');
  // Master–detail: on mobile the section list is shown first, then drills into
  // the selected section. On desktop both panes are always visible.
  const isMobile = useIsMobile();
  const [mobileDetail, setMobileDetail] = useState(false);

  // fields
  const [name, setName]   = useState('');
  const [bio, setBio]     = useState('');
  const [uname, setUname] = useState('');
  const [lsv, setLsv]     = useState<'EVERYONE' | 'NOBODY'>('EVERYONE');
  const [isPublic, setIsPublic] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  const [notifSound, setNotifSound] = useState(true);

  // avatar / crop
  const [cropSrc, setCropSrc]   = useState<string | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [removing, setRemoving] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  // AI avatar gen
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenUrl, setAiGenUrl] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSaving, setAiSaving] = useState(false);

  // editing
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');

  // change password
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwDone, setPwDone] = useState(false);

  // change email
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'form' | 'otp' | 'done'>('form');
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  // change username
  const [unameOpen, setUnameOpen] = useState(false);
  const [unameNew, setUnameNew] = useState('');
  const [unamePw, setUnamePw] = useState('');
  const [unameSaving, setUnameSaving] = useState(false);
  const [unameError, setUnameError] = useState('');

  // blocked users
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  // delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // logout
  const [logoutStep, setLogoutStep] = useState<'idle' | 'confirm' | 'busy'>('idle');

  // sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionErr, setSessionErr] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  // share / QR
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const username = (user as any)?.username as string | undefined;
  const shareLink = username ? `${window.location.origin}/u/${username}` : '';

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionErr('');
    try {
      setSessions(await usersApi.getSessions());
    } catch {
      setSessionErr('Could not load sessions');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadBlocked = useCallback(async () => {
    setBlockedLoading(true);
    try {
      setBlockedUsers(await usersApi.getBlocked());
    } catch { /* ignore */ }
    finally { setBlockedLoading(false); }
  }, []);

  const syncFromUser = useCallback((u: typeof user) => {
    if (!u) return;
    setName(u.displayName || '');
    setBio(u.bio || '');
    setUname((u as any).username || '');
    setLsv((u as any).lastSeenVisibility || 'EVERYONE');
    setIsPublic((u as any).isPublic ?? false);
    setNotifsEnabled((u as any).notificationsEnabled ?? true);
    setNotifSound((u as any).notificationSound ?? true);
  }, []);

  // initial sync + refresh from server
  useEffect(() => {
    syncFromUser(user);
    usersApi.getMe().then((fresh) => {
      const merged = { ...user!, ...fresh };
      updateUser(merged);
      syncFromUser(merged);
    }).catch(() => {});
  }, []); // eslint-disable-line

  useEffect(() => { if (section === 'devices') loadSessions(); }, [section, loadSessions]);
  useEffect(() => { if (section === 'privacy') loadBlocked(); }, [section, loadBlocked]);

  useEffect(() => {
    if (!shareLink) { setQrDataUrl(null); return; }
    QRCode.toDataURL(shareLink, { margin: 1, width: 220, color: { dark: '#0a0a0c', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [shareLink]);

  const copyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  // ─── Avatar ────────────────────────────────────────────────────────
  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';
    setCropSrc(URL.createObjectURL(file));
    setUploadErr('');
  };
  const onCropConfirm = (blob: Blob) => {
    if (preview) URL.revokeObjectURL(preview);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setPreview(URL.createObjectURL(blob));
    setPendingBlob(blob);
    setUploadErr('');
  };
  const onCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };
  const saveAvatar = async () => {
    if (!pendingBlob) return;
    setUploadErr('');
    try {
      const file = new File([pendingBlob], 'avatar.jpg', { type: 'image/jpeg' });
      const { publicUrl } = await uploadFile(file);
      const updated = await usersApi.updateProfile({ avatar: publicUrl });
      updateUser({ ...user!, ...updated, avatar: publicUrl });
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setPendingBlob(null);
    } catch {
      setUploadErr('Upload failed — try again');
    }
  };
  const cancelAvatar = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPendingBlob(null);
    setUploadErr('');
  };
  const removeAvatar = async () => {
    setRemoving(true);
    setUploadErr('');
    try {
      const updated = await usersApi.updateProfile({ avatar: null });
      updateUser({ ...user!, ...updated, avatar: undefined });
    } catch {
      setUploadErr('Could not remove photo');
    } finally {
      setRemoving(false);
    }
  };

  // ─── AI Avatar Gen ──────────────────────────────────────────────────
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiPrompt.length < 3) {
      setAiError('Prompt must be at least 3 characters');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiGenUrl(null);
    try {
      const imageUrl = await generateAiImage({ prompt: aiPrompt.trim(), type: 'avatar' });
      setAiGenUrl(imageUrl);
    } catch (err: any) {
      setAiError(err?.response?.data?.message || err?.message || 'Generation failed. Try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiSetAvatar = async () => {
    if (!aiGenUrl) return;
    setAiSaving(true);
    setAiError(null);
    try {
      // The backend already uploaded the image and returned a public URL.
      const updated = await usersApi.updateProfile({ avatar: aiGenUrl });
      updateUser({ ...user!, ...updated, avatar: aiGenUrl });
      setAiGenOpen(false);
      setAiPrompt('');
      setAiGenUrl(null);
    } catch {
      setAiError('Failed to set avatar');
    } finally {
      setAiSaving(false);
    }
  };

  const handleAiClose = () => {
    setAiGenOpen(false);
    setAiPrompt('');
    setAiGenUrl(null);
    setAiError(null);
    setAiLoading(false);
  };

  // ─── Field save ─────────────────────────────────────────────────────
  const saveField = async () => {
    if (!name.trim()) { setSaveErr('Name is required'); return; }
    if (uname && !/^[a-zA-Z0-9_]{3,30}$/.test(uname)) {
      setSaveErr('3–30 chars, letters / numbers / _');
      return;
    }
    setSaving(true); setSaveErr('');
    try {
      const updated = await usersApi.updateProfile({
        displayName: name.trim(),
        bio: bio.trim() || null,
        username: uname.trim() || null,
      });
      updateUser({ ...user!, ...updated });
      setEditing(null);
    } catch (err: any) {
      setSaveErr(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };
  const cancelEdit = () => {
    syncFromUser(user);
    setEditing(null);
    setSaveErr('');
  };

  // ─── Privacy ────────────────────────────────────────────────────────
  const toggleLsv = async (val: 'EVERYONE' | 'NOBODY') => {
    setLsv(val);
    try {
      const updated = await usersApi.updateProfile({ lastSeenVisibility: val });
      updateUser({ ...user!, ...updated });
    } catch { setLsv(val === 'EVERYONE' ? 'NOBODY' : 'EVERYONE'); }
  };

  // ─── Logout / sessions ──────────────────────────────────────────────
  const doLogout = async () => {
    setLogoutStep('busy');
    try { if (refreshToken) await authApi.logout(refreshToken); } catch {}
    clearAuth();
  };
  const revokeSession = async (s: Session) => {
    if (s.current) { setLogoutStep('confirm'); return; }
    setRevokingId(s.id);
    setSessionErr('');
    try {
      await usersApi.revokeSession(s.id);
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
    } catch {
      setSessionErr('Could not sign out that device');
    } finally {
      setRevokingId(null);
    }
  };
  const revokeOthers = async () => {
    setRevokingOthers(true);
    setSessionErr('');
    try {
      await usersApi.revokeOtherSessions();
      setSessions((prev) => prev.filter((x) => x.current));
    } catch {
      setSessionErr('Could not sign out other devices');
    } finally {
      setRevokingOthers(false);
    }
  };

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const avatarSrc = preview || user?.avatar || null;
  const initials  = (user?.displayName || '?')[0].toUpperCase();
  const R = 52, circ = 2 * Math.PI * R;

  const NAV: { key: Section; icon: React.ReactNode; label: string; desc: string }[] = [
    { key: 'profile',       icon: <User className="w-[18px] h-[18px]" />,          label: 'Profile',       desc: 'Name, photo & bio' },
    { key: 'account',       icon: <AtSign className="w-[18px] h-[18px]" />,        label: 'Account',       desc: 'Password & security' },
    { key: 'privacy',       icon: <Shield className="w-[18px] h-[18px]" />,        label: 'Privacy',       desc: 'Visibility & blocks' },
    { key: 'devices',       icon: <DevicesIcon className="w-[18px] h-[18px]" />,   label: 'Devices',       desc: 'Active sessions' },
    { key: 'wallpaper',     icon: <Image className="w-[18px] h-[18px]" />,         label: 'Wallpaper',     desc: 'Chat background & blur' },
    { key: 'notifications', icon: <Bell className="w-[18px] h-[18px]" />,          label: 'Notifications', desc: 'Sound, preview & more' },
    { key: 'storage',       icon: <Database className="w-[18px] h-[18px]" />,      label: 'Storage',       desc: 'Auto-download & cache' },
    { key: 'security',      icon: <KeyRound className="w-[18px] h-[18px]" />,      label: 'Security',      desc: 'App lock & privacy' },
    { key: 'backup',        icon: <Cloud className="w-[18px] h-[18px]" />,         label: 'Backup',        desc: 'Export & restore' },
    { key: 'appearance',    icon: <Palette className="w-[18px] h-[18px]" />,       label: 'Appearance',    desc: 'Font & bubble style' },
    { key: 'shortcuts',     icon: <Keyboard className="w-[18px] h-[18px]" />,      label: 'Shortcuts',     desc: 'Keyboard commands' },
    { key: 'advanced',      icon: <Wrench className="w-[18px] h-[18px]" />,        label: 'Advanced',      desc: 'Debug & reset data' },
  ];

  const currentNav = NAV.find((n) => n.key === section);

  const handleBack = () => {
    if (isMobile && mobileDetail) setMobileDetail(false);
    else navigate('/chat');
  };
  const openSection = (key: Section) => {
    setSection(key);
    setMobileDetail(true);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0b0e] text-zinc-200 overflow-hidden animate-fade-in">
      {cropSrc && <AvatarCropper src={cropSrc} onConfirm={onCropConfirm} onCancel={onCropCancel} />}

      <TopBar
        title={isMobile && mobileDetail ? (currentNav?.label || 'Settings') : 'Settings'}
        onBack={handleBack}
        className="shrink-0"
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left nav — full-width section menu on mobile, fixed sidebar on desktop */}
        <nav className={`${mobileDetail ? 'hidden md:flex' : 'flex'} w-full md:w-[300px] shrink-0 md:border-r border-white/[0.06] p-3 sm:p-4 flex-col gap-1 overflow-y-auto`}>
          {/* Profile mini-card → jumps to the profile section */}
          <button type="button"
            onClick={() => openSection('profile')}
            className="flex items-center gap-3 px-2 py-3 mb-2 rounded-2xl hover:bg-white/[0.05] transition-colors text-left"
          >
            <Avatar src={avatarSrc || user?.avatar} name={user?.displayName} size="lg" presence="online" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-white truncate">{user?.displayName || 'NexChat User'}</p>
              {username
                ? <p className="text-[12px] text-emerald-400/80 truncate">@{username}</p>
                : <p className="text-[12px] text-zinc-500 truncate">View and edit profile</p>}
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 md:hidden" />
          </button>

          {NAV.map((n) => {
            const active = section === n.key;
            return (
              <button type="button"
                key={n.key}
                onClick={() => openSection(n.key)}
                title={n.label}
                className={`group flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition-all text-left ${
                  active
                    ? 'md:bg-[#1f2c34] text-zinc-100'
                    : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                }`}
              >
                <span className={`grid place-items-center w-9 h-9 rounded-xl shrink-0 transition-colors ${
                  active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.04] text-zinc-400 group-hover:text-zinc-200'
                }`}>{n.icon}</span>
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="text-[14px] font-semibold leading-tight text-zinc-100">{n.label}</span>
                  <span className="text-[11.5px] text-zinc-500 leading-tight truncate">{n.desc}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 md:hidden" />
              </button>
            );
          })}

          <div className="mt-auto pt-2">
            <button type="button"
              onClick={() => { openSection('account'); setLogoutStep('confirm'); }}
              title="Sign out"
              className="w-full flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-zinc-400 hover:bg-red-500/[0.1] hover:text-red-300 transition-all"
            >
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-white/[0.04] shrink-0"><LogOut className="w-[18px] h-[18px]" /></span>
              <span className="text-[14px] font-semibold">Sign out</span>
            </button>
          </div>
        </nav>

        {/* Content */}
        <main className={`${mobileDetail ? 'flex' : 'hidden md:flex'} flex-1 overflow-y-auto flex-col`}>
          <div className="w-full max-w-2xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
            {/* Section heading */}
            <div className="mb-6 flex items-center gap-3 animate-slide-up">
              <span className="grid place-items-center w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 shrink-0">
                {currentNav?.icon}
              </span>
              <div className="min-w-0">
                <h1 className="text-[20px] font-bold text-white leading-tight truncate">{currentNav?.label}</h1>
                <p className="text-[12.5px] text-zinc-500 truncate">{currentNav?.desc}</p>
              </div>
            </div>

            {/* ── PROFILE ── */}
            {section === 'profile' && (
              <div className="space-y-6 animate-slide-up">
                {/* Avatar hero */}
                <Card>
                  <div className="flex flex-col items-center py-2">
                    <div className="relative mb-4 cursor-pointer group" style={{ width: 120, height: 120 }}
                      onClick={() => { if (!uploading && !removing) fileRef.current?.click(); }}>
                      <svg className="absolute inset-0 -rotate-90 pointer-events-none" width="120" height="120" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                        {uploading && (
                          <circle cx="60" cy="60" r={R} fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round"
                            strokeDasharray={circ} strokeDashoffset={circ - (progress / 100) * circ}
                            style={{ transition: 'stroke-dashoffset .25s ease' }} />
                        )}
                      </svg>
                      <div className="absolute inset-[7px] rounded-full overflow-hidden bg-zinc-800 ring-[3px] ring-black/60 select-none">
                        {avatarSrc
                          ? <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-zinc-400">{initials}</div>}
                      </div>
                      <div className="absolute inset-[7px] rounded-full bg-black/0 group-hover:bg-black/55 transition-all flex flex-col items-center justify-center opacity-0 group-hover:opacity-100">
                        {uploading
                          ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                          : <><Camera className="w-6 h-6 text-white mb-0.5" /><span className="text-[9px] font-bold text-white uppercase tracking-widest">Change</span></>}
                      </div>
                      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFilePick} />
                    </div>

                    <p className="text-[19px] font-bold text-white leading-tight">{user?.displayName || 'NexChat User'}</p>
                    {username && <p className="text-[13px] text-emerald-400/80 mt-0.5">@{username}</p>}

                    {pendingBlob ? (
                      <div className="flex gap-2 mt-4">
                        <button type="button" onClick={saveAvatar} disabled={uploading}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors active:scale-[0.98]">
                          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Photo
                        </button>
                        <button type="button" onClick={cancelAvatar} disabled={uploading}
                          className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] disabled:opacity-50 text-zinc-300 text-[12px] font-semibold transition-colors">Cancel</button>
                      </div>
                    ) : user?.avatar ? (
                      <button type="button" onClick={removeAvatar} disabled={removing}
                        className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-xl text-red-400/90 hover:text-red-300 hover:bg-red-500/[0.08] disabled:opacity-50 text-[12px] font-semibold transition-colors">
                        {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Remove photo
                      </button>
                    ) : null}

                    {!pendingBlob && (
                      <button type="button" onClick={() => setAiGenOpen(true)}
                        className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-500/[0.08] text-[12px] font-semibold transition-colors">
                        <Sparkles className="w-3.5 h-3.5" /> Generate with AI
                      </button>
                    )}

                    {uploadErr && <p className="text-[11px] text-red-400 mt-2 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" />{uploadErr}</p>}
                    {uploading && <p className="text-[11px] text-emerald-400/70 mt-1">{progress}% uploading…</p>}
                  </div>
                </Card>

                {aiGenOpen && (
                   <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 animate-fade-in" onClick={handleAiClose}>
                     <div className="bg-zinc-900 border border-white/[0.07] rounded-2xl shadow-pop w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[15px] font-bold text-white flex items-center gap-2"><Wand2 className="w-4 h-4 text-emerald-400" /> AI Avatar</h3>
                        <button onClick={handleAiClose} className="p-1.5 text-zinc-500 hover:text-white rounded-full hover:bg-white/10 transition">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value.slice(0, 500))}
                        placeholder="Describe your avatar..."
                        rows={3}
                        className="w-full bg-white/[0.05] text-[13px] text-zinc-100 rounded-xl border border-white/[0.08] p-3 outline-none focus:border-emerald-500/60 resize-none transition placeholder-zinc-500"
                      />
                      <div className="flex justify-between items-center mt-1.5 mb-3">
                        <span className="text-[10px] text-zinc-600">{aiPrompt.length}/500</span>
                        {aiError && <span className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{aiError}</span>}
                      </div>

                      <button type="button" onClick={handleAiGenerate} disabled={aiLoading || aiPrompt.length < 3}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-[13px] font-semibold transition active:scale-[0.98] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed mb-3">
                        {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {aiLoading ? 'Generating...' : 'Generate'}
                      </button>

                      {aiLoading && (
                        <div className="aspect-square rounded-xl shimmer-bg flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
                        </div>
                      )}

                      {aiGenUrl && !aiLoading && (
                        <div className="space-y-3">
                          <ImageGeneration duration={2200} startDelay={0}>
                            <img src={aiGenUrl} alt="Generated avatar" className="aspect-square w-full object-cover" />
                          </ImageGeneration>
                          <button type="button" onClick={handleAiSetAvatar} disabled={aiSaving}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-semibold transition active:scale-[0.98] disabled:opacity-50">
                            {aiSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {aiSaving ? 'Saving...' : 'Set as Profile Picture'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Card title="Public info">
                  <IField label="Display Name" icon={<User className="w-4 h-4" />}
                    display={user?.displayName || '—'} active={editing === 'name'} saving={saving}
                    error={editing === 'name' ? saveErr : ''}
                    onEdit={() => { setEditing('name'); setSaveErr(''); }} onSave={saveField} onCancel={cancelEdit}>
                    <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveField()} maxLength={50}
                      className="w-full bg-transparent text-[14px] text-zinc-100 border-b border-emerald-500/60 pb-0.5 outline-none" />
                  </IField>
                  <IField label="About" icon={<FileText className="w-4 h-4" />}
                    display={user?.bio || 'Hey there! I am using NexChat.'} active={editing === 'bio'} saving={saving}
                    error={editing === 'bio' ? saveErr : ''}
                    onEdit={() => { setEditing('bio'); setSaveErr(''); }} onSave={saveField} onCancel={cancelEdit}>
                    <textarea autoFocus value={bio} onChange={(e) => setBio(e.target.value)} maxLength={255} rows={2}
                      className="w-full bg-transparent text-[14px] text-zinc-100 border-b border-emerald-500/60 pb-0.5 outline-none resize-none" />
                  </IField>
                  <IField label="Username" icon={<AtSign className="w-4 h-4" />}
                    display={username ? `@${username}` : 'Not set'} active={editing === 'username'} saving={saving}
                    error={editing === 'username' ? saveErr : ''}
                    onEdit={() => { setEditing('username'); setSaveErr(''); }} onSave={saveField} onCancel={cancelEdit}>
                    <div className="flex items-baseline border-b border-emerald-500/60">
                      <span className="text-emerald-500 mr-0.5">@</span>
                      <input autoFocus value={uname}
                        onChange={(e) => setUname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && saveField()} maxLength={30} placeholder="username"
                        className="flex-1 bg-transparent text-[14px] text-zinc-100 pb-0.5 outline-none" />
                    </div>
                  </IField>
                  {user?.email && <ROField icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} last={!user?.phone} />}
                  {user?.phone && <ROField icon={<Phone className="w-4 h-4" />} label="Phone" value={user.phone} last />}
                </Card>

                <Card title="Share Profile">
                  {username ? (
                    <div className="flex flex-col items-center py-2">
                      {qrDataUrl && (
                        <div className="p-2.5 bg-white rounded-2xl shadow-elevated">
                          <img src={qrDataUrl} alt="Profile QR code" width={180} height={180} className="rounded-lg" />
                        </div>
                      )}
                      <p className="text-[11px] text-zinc-500 mt-3 text-center">Scan or share this link to start a chat with you</p>
                      <button type="button" onClick={copyLink}
                        className="flex items-center gap-2 mt-2 px-3 py-2 max-w-full rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] transition-colors">
                        <Link2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="text-[12px] text-zinc-300 truncate">{shareLink.replace(/^https?:\/\//, '')}</span>
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[12px] text-zinc-500 py-1 flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-zinc-600" />
                      Set a <span className="text-emerald-400">username</span> to get a shareable link and QR code.
                    </p>
                  )}
                </Card>
              </div>
            )}

            {/* ── PRIVACY ── */}
            {section === 'privacy' && (
              <div className="space-y-6 animate-slide-up">
                <Card title="Last Seen">
                  <div className="space-y-2">
                    {(['EVERYONE', 'NOBODY'] as const).map((val) => (
                      <button type="button" key={val} onClick={() => toggleLsv(val)}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                          lsv === val ? 'border-emerald-500/40 bg-emerald-500/[0.07]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]'
                        }`}>
                        <span className={lsv === val ? 'text-emerald-400' : 'text-zinc-600'}>
                          {val === 'EVERYONE' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </span>
                        <div className="flex-1">
                          <p className={`text-[13px] font-semibold ${lsv === val ? 'text-zinc-100' : 'text-zinc-400'}`}>
                            {val === 'EVERYONE' ? 'Everyone' : 'Nobody'}
                          </p>
                          <p className="text-[11px] text-zinc-600 mt-0.5">
                            {val === 'EVERYONE' ? 'Others can see when you were last online' : 'Your last seen is hidden'}
                          </p>
                        </div>
                        {lsv === val && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </Card>

                <Card title="Discoverability">
                  <button type="button" onClick={async () => {
                    const next = !isPublic; setIsPublic(next);
                    try { const updated = await usersApi.updateProfile({ isPublic: next }); updateUser({ ...user!, ...updated }); }
                    catch { setIsPublic(!next); }
                  }}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                      isPublic ? 'border-emerald-500/40 bg-emerald-500/[0.07]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]'
                    }`}>
                    <span className={isPublic ? 'text-emerald-400' : 'text-zinc-600'}>
                      {isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </span>
                    <div className="flex-1">
                      <p className={`text-[13px] font-semibold ${isPublic ? 'text-zinc-100' : 'text-zinc-400'}`}>Public Profile</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        {isPublic ? 'Anyone can find you by searching' : 'Only existing contacts can find you'}
                      </p>
                    </div>
                    {isPublic && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>
                </Card>

                <Card title="Notifications">
                  <div className="space-y-2">
                    <button type="button" onClick={async () => {
                      const next = !notifsEnabled; setNotifsEnabled(next);
                      try { const updated = await usersApi.updateProfile({ notificationsEnabled: next }); updateUser({ ...user!, ...updated }); }
                      catch { setNotifsEnabled(!next); }
                    }}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                        notifsEnabled ? 'border-emerald-500/40 bg-emerald-500/[0.07]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]'
                      }`}>
                      <span className={notifsEnabled ? 'text-emerald-400' : 'text-zinc-600'}>
                        <Bell className="w-4 h-4" />
                      </span>
                      <div className="flex-1">
                        <p className={`text-[13px] font-semibold ${notifsEnabled ? 'text-zinc-100' : 'text-zinc-400'}`}>Push Notifications</p>
                        <p className="text-[11px] text-zinc-600 mt-0.5">
                          {notifsEnabled ? 'Notifications are enabled' : 'All push notifications are disabled'}
                        </p>
                      </div>
                      {notifsEnabled && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>

                    <button type="button" onClick={async () => {
                      const next = !notifSound; setNotifSound(next);
                      try { const updated = await usersApi.updateProfile({ notificationSound: next }); updateUser({ ...user!, ...updated }); }
                      catch { setNotifSound(!next); }
                    }}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                        notifSound ? 'border-emerald-500/40 bg-emerald-500/[0.07]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]'
                      }`}>
                      <span className={notifSound ? 'text-emerald-400' : 'text-zinc-600'}>
                        <Volume2 className="w-4 h-4" />
                      </span>
                      <div className="flex-1">
                        <p className={`text-[13px] font-semibold ${notifSound ? 'text-zinc-100' : 'text-zinc-400'}`}>Notification Sound</p>
                        <p className="text-[11px] text-zinc-600 mt-0.5">
                          {notifSound ? 'Sound plays for new notifications' : 'Notifications are silent'}
                        </p>
                      </div>
                      {notifSound && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>
                  </div>
                </Card>

                <Card title="Blocked Users">
                  {blockedLoading ? (
                    <div className="flex items-center gap-2 py-3 text-zinc-500 text-[12px]"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                  ) : blockedUsers.length === 0 ? (
                    <p className="text-[12px] text-zinc-600 py-2">No one is blocked</p>
                  ) : (
                    <div className="space-y-2">
                      {blockedUsers.map((u: any) => (
                        <ListItem
                          key={u.id}
                          className="p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
                          avatar={{ src: u.avatar, name: u.displayName }}
                          primaryText={u.displayName || 'Unknown'}
                          actions={
                            <button type="button" onClick={async () => {
                              setUnblockingId(u.id);
                              try { await usersApi.unblock(u.id); setBlockedUsers((prev) => prev.filter((x) => x.id !== u.id)); }
                              catch { /* ignore */ } finally { setUnblockingId(null); }
                            }} disabled={unblockingId === u.id}
                              className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-red-400 hover:bg-red-500/[0.08] disabled:opacity-50 transition-colors">
                              {unblockingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Unblock'}
                            </button>
                          }
                        />
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ── ACCOUNT ── */}
            {section === 'account' && (
              <div className="space-y-6 animate-slide-up">
                <Card title="Account Info">
                  {(user as any)?.createdAt && (
                    <ROField icon={<Calendar className="w-4 h-4" />} label="Member Since"
                      value={new Date((user as any).createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />
                  )}
                  {user?.email && <ROField icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />}
                  {user?.phone && <ROField icon={<Phone className="w-4 h-4" />} label="Phone" value={user.phone} last />}
                </Card>

                <Card title="Security">
                  {/* change password */}
                  <Expand icon={<Lock className="w-4 h-4" />} label="Change Password" open={pwOpen}
                    onToggle={() => { setPwOpen(!pwOpen); setPwDone(false); setPwError(''); }}>
                    {pwDone ? (
                      <div className="flex items-center gap-2 text-emerald-400 text-[13px] py-2"><Check className="w-4 h-4" /> Password updated</div>
                    ) : (
                      <>
                        {pwError && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{pwError}</p>}
                        <Input type="password" placeholder="Current password" value={pwCurrent} onChange={setPwCurrent} />
                        <Input type="password" placeholder="New password" value={pwNew} onChange={setPwNew} />
                        <Input type="password" placeholder="Confirm new password" value={pwConfirm} onChange={setPwConfirm} />
                        <button type="button" onClick={async () => {
                          if (pwNew !== pwConfirm) { setPwError('Passwords do not match'); return; }
                          if (pwNew.length < 6) { setPwError('Password must be at least 6 characters'); return; }
                          setPwSaving(true); setPwError('');
                          try { await authApi.changePassword(pwCurrent, pwNew); setPwDone(true); setPwCurrent(''); setPwNew(''); setPwConfirm(''); }
                          catch (err: any) { setPwError(err.response?.data?.message || 'Failed to update password'); }
                          finally { setPwSaving(false); }
                        }} disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
                          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors">
                          {pwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Update Password
                        </button>
                      </>
                    )}
                  </Expand>

                  {/* change email */}
                  <Expand icon={<Mail className="w-4 h-4" />} label="Change Email" hint={user?.email} open={emailOpen}
                    onToggle={() => { setEmailOpen(!emailOpen); setEmailStep('form'); setEmailError(''); }}>
                    {emailStep === 'done' ? (
                      <div className="flex items-center gap-2 text-emerald-400 text-[13px] py-2"><Check className="w-4 h-4" /> Email updated to {newEmail}</div>
                    ) : (
                      <>
                        {emailError && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{emailError}</p>}
                        {emailStep === 'form' && (
                          <>
                            <Input type="email" placeholder="New email address" value={newEmail} onChange={setNewEmail} />
                            <Input type="password" placeholder="Current password" value={emailPw} onChange={setEmailPw} />
                            <button type="button" onClick={async () => {
                              if (!newEmail.includes('@')) { setEmailError('Enter a valid email'); return; }
                              setEmailSaving(true); setEmailError('');
                              try { await usersApi.sendEmailChangeOtp(newEmail, emailPw); setEmailStep('otp'); }
                              catch (err: any) { setEmailError(err.response?.data?.message || 'Failed to send OTP'); }
                              finally { setEmailSaving(false); }
                            }} disabled={emailSaving || !newEmail || !emailPw}
                              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors">
                              {emailSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send OTP'}
                            </button>
                          </>
                        )}
                        {emailStep === 'otp' && (
                          <>
                            <p className="text-[12px] text-zinc-500">Enter the 6-digit code sent to {newEmail}</p>
                            <input type="text" maxLength={6} placeholder="000000" value={emailCode}
                              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              className="w-full px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-[13px] text-zinc-100 outline-none focus:border-emerald-500/60 transition-colors text-center tracking-[8px] font-bold" />
                            <button type="button" onClick={async () => {
                              if (emailCode.length !== 6) { setEmailError('Enter a valid 6-digit code'); return; }
                              setEmailSaving(true); setEmailError('');
                              try { await usersApi.confirmEmailChange(emailCode); setEmailStep('done'); updateUser({ ...user!, email: newEmail } as any); }
                              catch (err: any) { setEmailError(err.response?.data?.message || 'Failed to verify code'); }
                              finally { setEmailSaving(false); }
                            }} disabled={emailSaving || emailCode.length !== 6}
                              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors">
                              {emailSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Verify & Update'}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </Expand>

                  {/* change username */}
                  <Expand icon={<AtSign className="w-4 h-4" />} label="Change Username" hint={username ? `@${username}` : 'Not set'} open={unameOpen}
                    onToggle={() => { setUnameOpen(!unameOpen); setUnameError(''); setUnameNew(''); setUnamePw(''); }} last>
                    {unameError && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{unameError}</p>}
                    <div className="flex items-baseline border border-white/[0.06] rounded-xl px-3 py-2.5 bg-white/[0.02]">
                      <span className="text-emerald-500 mr-0.5 text-[13px]">@</span>
                      <input type="text" placeholder="username" value={unameNew}
                        onChange={(e) => setUnameNew(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} maxLength={30}
                        className="flex-1 bg-transparent text-[13px] text-zinc-100 outline-none" />
                    </div>
                    <Input type="password" placeholder="Current password" value={unamePw} onChange={setUnamePw} />
                    <button type="button" onClick={async () => {
                      if (!/^[a-zA-Z0-9_]{3,30}$/.test(unameNew)) { setUnameError('3–30 chars, letters / numbers / _'); return; }
                      setUnameSaving(true); setUnameError('');
                      try { await usersApi.changeUsername(unameNew, unamePw); updateUser({ ...user!, username: unameNew } as any); setUnameOpen(false); }
                      catch (err: any) { setUnameError(err.response?.data?.message || 'Failed to update username'); }
                      finally { setUnameSaving(false); }
                    }} disabled={unameSaving || !unameNew || !unamePw}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors">
                      {unameSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Update Username
                    </button>
                  </Expand>
                </Card>

                {/* danger zone */}
                <Card title="Danger Zone" danger>
                  {logoutStep === 'confirm' ? (
                    <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-4 space-y-3">
                      <p className="text-[13px] text-zinc-200 font-medium text-center">Sign out of NexChat?</p>
                      <p className="text-[11px] text-zinc-500 text-center">You'll need to sign in again.</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setLogoutStep('idle')} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-[12px] font-semibold transition-colors">Cancel</button>
                        <button type="button" onClick={doLogout} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[12px] font-semibold transition-colors">Sign Out</button>
                      </div>
                    </div>
                  ) : logoutStep === 'busy' ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-zinc-400"><Loader2 className="w-5 h-5 animate-spin text-red-400" /><span className="text-[13px]">Signing out…</span></div>
                  ) : (
                    <button type="button" onClick={() => setLogoutStep('confirm')}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 text-[13px] font-semibold transition-all active:scale-[0.98] mb-3">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  )}

                  <button type="button" onClick={() => setDeleteOpen(!deleteOpen)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/[0.08] hover:bg-red-500/[0.15] border border-red-500/20 text-red-400 text-[13px] font-semibold transition-all">
                    <Trash2 className="w-4 h-4" /> Delete Account
                  </button>
                  {deleteOpen && (
                    <div className="mt-3 bg-red-950/30 border border-red-500/20 rounded-2xl p-4 space-y-3">
                      <p className="text-[13px] text-zinc-200 font-medium text-center">This cannot be undone.</p>
                      <p className="text-[11px] text-zinc-500 text-center">All your messages, conversations, and data will be permanently deleted.</p>
                      {deleteError && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{deleteError}</p>}
                      <Input type="password" placeholder="Enter your password" value={deletePw} onChange={setDeletePw} danger />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setDeleteOpen(false); setDeletePw(''); setDeleteError(''); }} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-[12px] font-semibold transition-colors">Cancel</button>
                        <button type="button" onClick={async () => {
                          if (!deletePw) { setDeleteError('Password is required'); return; }
                          setDeleteSaving(true); setDeleteError('');
                          try { await usersApi.deleteAccount(deletePw); clearAuth(); }
                          catch (err: any) { setDeleteError(err.response?.data?.message || 'Failed to delete account'); }
                          finally { setDeleteSaving(false); }
                        }} disabled={deleteSaving || !deletePw}
                          className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors flex items-center justify-center gap-1">
                          {deleteSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ── DEVICES ── */}
            {section === 'devices' && (
              <div className="space-y-6 animate-slide-up">
                <Card title="Active Sessions" action={sessions.length > 1 ? (
                  <button type="button" onClick={revokeOthers} disabled={revokingOthers}
                    className="flex items-center gap-1 text-[11px] font-semibold text-red-400/90 hover:text-red-300 disabled:opacity-50 transition-colors">
                    {revokingOthers ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Sign out others
                  </button>
                ) : undefined}>
                  {sessionsLoading ? (
                    <div className="flex items-center gap-2 py-3 text-zinc-500 text-[12px]"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                  ) : sessionErr ? (
                    <p className="text-[11px] text-red-400 flex items-center gap-1.5 py-2"><AlertCircle className="w-3 h-3" />{sessionErr}</p>
                  ) : (
                    <div className="space-y-2">
                      {sessions.map((s) => {
                        const DeviceIcon = s.os === 'iOS' || s.os === 'Android' ? Smartphone : s.os === 'Unknown' ? MonitorSmartphone : Monitor;
                        return (
                          <div key={s.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${
                            s.current ? 'border-emerald-500/30 bg-emerald-500/[0.05]' : 'border-white/[0.06] bg-white/[0.02]'
                          }`}>
                            <span className={s.current ? 'text-emerald-400' : 'text-zinc-500'}><DeviceIcon className="w-4 h-4" /></span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-zinc-200 truncate">
                                {s.browser} on {s.os}
                                {s.current && <span className="ml-2 text-[10px] font-bold text-emerald-400 uppercase tracking-wide">This device</span>}
                              </p>
                              <p className="text-[11px] text-zinc-600 truncate">{s.ip || 'Unknown IP'} · {s.current ? 'active now' : relativeTime(s.lastUsedAt)}</p>
                            </div>
                            <button type="button" onClick={() => revokeSession(s)} disabled={revokingId === s.id}
                              title={s.current ? 'Sign out' : 'Sign out this device'}
                              className="p-2 rounded-xl text-zinc-600 hover:text-red-400 hover:bg-red-500/[0.08] disabled:opacity-50 transition-colors shrink-0">
                              {revokingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ── WALLPAPER ── */}
            {section === 'wallpaper' && (
              <div className="space-y-6 animate-slide-up">
                <Card title="Chat Wallpaper"><SettingsWallpaper /></Card>
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {section === 'notifications' && (
              <div className="space-y-6 animate-slide-up">
                <Card title="Notification Preferences"><SettingsNotifications /></Card>
              </div>
            )}

            {/* ── STORAGE ── */}
            {section === 'storage' && (
              <div className="space-y-6 animate-slide-up">
                <Card title="Data & Storage"><SettingsStorage /></Card>
              </div>
            )}

            {/* ── SECURITY ── */}
            {section === 'security' && (
              <div className="space-y-6 animate-slide-up">
                <Card title="Privacy & Security"><SettingsPrivacySecurity /></Card>
              </div>
            )}

            {/* ── BACKUP ── */}
            {section === 'backup' && (
              <div className="space-y-6 animate-slide-up">
                <Card title="Chat Backup"><SettingsBackup /></Card>
              </div>
            )}

            {/* ── APPEARANCE ── */}
            {section === 'appearance' && (
              <div className="space-y-6 animate-slide-up">
                <Card title="Appearance"><SettingsAppearance /></Card>
              </div>
            )}

            {/* ── SHORTCUTS ── */}
            {section === 'shortcuts' && (
              <div className="space-y-6 animate-slide-up">
                <Card title="Keyboard Shortcuts"><SettingsShortcuts /></Card>
              </div>
            )}

            {/* ── ADVANCED ── */}
            {section === 'advanced' && (
              <div className="space-y-6 animate-slide-up">
                <Card title="Advanced"><SettingsAdvanced /></Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

// ── Reusable presentational pieces ───────────────────────────────────────────
const Card: React.FC<{ title?: string; danger?: boolean; action?: React.ReactNode; children: React.ReactNode }> = ({ title, danger, action, children }) => (
  <section className={`rounded-2xl border p-4 sm:p-6 ${danger ? 'border-red-500/20 bg-[#1a2332]/45' : 'border-white/10 bg-[#1a2332]/45'}`}>
    {title && (
      <div className="flex items-center justify-between mb-3">
        <h2 className={`text-[11px] font-bold uppercase tracking-wider ${danger ? 'text-red-400/80' : 'text-zinc-400'}`}>{title}</h2>
        {action}
      </div>
    )}
    {children}
  </section>
);

const Input: React.FC<{ type: string; placeholder: string; value: string; onChange: (v: string) => void; danger?: boolean }> = ({ type, placeholder, value, onChange, danger }) => (
  <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
    className={`w-full px-3 py-2.5 rounded-xl border border-white/10 bg-[#1f2c34]/50 text-[13px] text-zinc-100 outline-none transition-colors ${danger ? 'focus:border-red-500/60' : 'focus:border-emerald-500/60'}`} />
);

interface ExpandProps { icon: React.ReactNode; label: string; hint?: string; open: boolean; onToggle: () => void; last?: boolean; children: React.ReactNode }
const Expand: React.FC<ExpandProps> = ({ icon, label, hint, open, onToggle, last, children }) => (
  <div className={last ? '' : 'border-b border-white/[0.06]'}>
    <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 py-3.5 hover:bg-white/[0.06] transition-colors rounded-xl px-1">
      <span className="text-emerald-400/70 shrink-0">{icon}</span>
      <span className="flex-1 text-left text-[14px] text-zinc-200 font-medium">{label}</span>
      {hint && <span className="text-[12px] text-zinc-500 truncate max-w-[40%]">{hint}</span>}
      <ArrowRight className={`w-4 h-4 text-zinc-500 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`} />
    </button>
    {open && <div className="px-1 pb-4 space-y-3">{children}</div>}
  </div>
);

interface IFieldProps {
  icon: React.ReactNode; label: string; display: string;
  active: boolean; saving: boolean; error: string;
  onEdit: () => void; onSave: () => void; onCancel: () => void; children: React.ReactNode;
}
const IField: React.FC<IFieldProps> = ({ icon, label, display, active, saving, error, onEdit, onSave, onCancel, children }) => (
  <div className={`group flex items-start gap-4 px-1 py-3.5 border-b border-white/[0.05] transition-colors ${!active ? 'hover:bg-white/[0.06] cursor-pointer rounded-xl' : ''}`}
    onClick={!active ? onEdit : undefined}>
    <span className="mt-0.5 text-emerald-600/70 shrink-0">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">{label}</p>
      {active ? (
        <>
          {children}
          {error && <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />{error}</p>}
          <div className="flex gap-3 mt-3">
            <button type="button" onClick={(e) => { e.stopPropagation(); onSave(); }} disabled={saving}
              className="flex items-center gap-1 text-[12px] font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onCancel(); }} disabled={saving}
              className="text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors">Cancel</button>
          </div>
        </>
      ) : (
        <p className="text-[14px] text-zinc-200 break-words">{display}</p>
      )}
    </div>
    {!active && <Pencil className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 mt-0.5 shrink-0 transition-colors" />}
  </div>
);

const ROField: React.FC<{ icon: React.ReactNode; label: string; value: string; last?: boolean }> = ({ icon, label, value, last }) => (
  <div className={`flex items-start gap-4 px-1 py-3.5 ${last ? '' : 'border-b border-white/[0.05]'}`}>
    <span className="mt-0.5 text-zinc-700 shrink-0">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-[14px] text-zinc-400 truncate">{value}</p>
    </div>
  </div>
);

export default SettingsPage;
