import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-wa-sidebar text-wa-primary select-none p-4">
      <h1 className="text-6xl font-extrabold text-wa-green mb-4">404</h1>
      <h2 className="text-xl font-bold mb-6">Page Not Found</h2>
      <p className="text-sm text-wa-secondary max-w-xs text-center mb-8">
        The page you are looking for does not exist or has been moved.
      </p>
      <button type="button"
        onClick={() => navigate('/chat')}
        className="px-6 py-2.5 bg-wa-green text-wa-sidebar font-bold text-sm rounded-lg hover:bg-[#059669] transition shadow-md"
      >
        Go to Chats
      </button>
    </div>
  );
};

export default NotFoundPage;
