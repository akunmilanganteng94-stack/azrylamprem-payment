import React from 'react';
import { 
  ClipboardList, 
  CreditCard, 
  Users, 
  MessageCircle, 
  BookOpen, 
  Bell, 
  User, 
  LogOut, 
  X, 
  ShieldCheck, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
}) => {
  const { user, profile, isAdmin, logout, setAuthModalOpen } = useAuth();

  const menuItems = [
    { id: 'riwayat', label: 'Riwayat', icon: ClipboardList },
    { id: 'deposit', label: 'Deposit', icon: CreditCard },
    { id: 'referral', label: 'Referral', icon: Users },
    { id: 'chat', label: 'Chat Room', icon: MessageCircle },
    { id: 'carakerja', label: 'Cara Kerja', icon: BookOpen },
    { id: 'pengumuman', label: 'Pengumuman', icon: Bell },
    { id: 'profil', label: 'Profil', icon: User },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in cursor-pointer"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 max-w-[290px] w-full bg-white shadow-2xl z-50 flex flex-col justify-between transition-transform duration-300 ease-out animate-in slide-in-from-left">
        <div>
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 font-black text-lg tracking-wider">
                AZ
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black text-slate-900 tracking-tight">AZPREM</span>
                  <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> PRO
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500">Premium Store</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-220px)]">
            <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Menu Utama
            </div>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Admin Panel button if authorized */}
            {isAdmin && (
              <div className="pt-2">
                <div className="px-3 py-1 text-[10px] font-bold text-orange-500 uppercase tracking-wider">
                  Admin Area
                </div>
                <button
                  onClick={() => {
                    onSelectTab('admin');
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                    activeTab === 'admin'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-orange-600" />
                  <span>Admin Panel</span>
                </button>
              </div>
            )}

            {/* Website External Link */}
            <a
              href="https://www.azryl.my.id/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-orange-600 transition-colors mt-2"
            >
              <span>azryl.my.id</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Bottom User Area */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-950 text-white flex items-center justify-center font-bold text-sm shadow">
                  {(profile?.nama || user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {profile?.nama || user.displayName || 'Pengguna'}
                  </h4>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  await logout();
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setAuthModalOpen(true);
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>Masuk / Daftar Akun</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
