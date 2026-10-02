import React from 'react';
import { Menu, MessageCircle, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderNavbarProps {
  onOpenSidebar: () => void;
  onOpenChat: () => void;
  onOpenAnnouncements: () => void;
  unreadCount?: number;
}

export const HeaderNavbar: React.FC<HeaderNavbarProps> = ({
  onOpenSidebar,
  onOpenChat,
  onOpenAnnouncements,
  unreadCount = 0
}) => {
  const { profile, user, setAuthModalOpen } = useAuth();
  const userName = profile?.nama || user?.displayName || user?.email?.split('@')[0] || 'Tamu';

  return (
    <header className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white pt-6 pb-20 px-4 sm:px-6 rounded-b-[2rem] shadow-lg shadow-orange-500/20 relative z-10">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Left: Hamburger & Greetings */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            aria-label="Menu"
            className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-95 hover:bg-white/25 transition-all shadow-sm cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[10px] tracking-wider uppercase font-semibold text-white/80 block">
              SELAMAT DATANG,
            </span>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-lg font-black tracking-tight drop-shadow-sm truncate max-w-[170px] sm:max-w-[200px]">
                Hai, {userName}
              </h1>
              {!user && (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="text-[11px] bg-white text-orange-600 font-bold px-2 py-0.5 rounded-full shadow-sm active:scale-95 cursor-pointer"
                >
                  Masuk
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Chat and Notification */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenChat}
            aria-label="Buka Chat Room"
            className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-95 hover:bg-white/25 transition-all relative shadow-sm cursor-pointer"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenAnnouncements}
            aria-label="Pengumuman"
            className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-95 hover:bg-white/25 transition-all relative shadow-sm cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-md animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
