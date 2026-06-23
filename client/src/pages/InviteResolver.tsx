import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

export const PENDING_CHAT_KEY = 'nexchat_pending_chat_username';

// Handles /u/:username deep links. We stash the target username and bounce to
// the right place; ChatPage consumes the stash and opens the conversation
// (so the same code path works whether the user was already logged in or not).
const InviteResolver: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const user = useAuthStore((s) => s.user);

  if (username) {
    sessionStorage.setItem(PENDING_CHAT_KEY, username);
  }

  return <Navigate to={user ? '/chat' : '/auth'} replace />;
};

export default InviteResolver;
