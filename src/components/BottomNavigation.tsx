import React from 'react';
import { Home, Zap, Search, Wallet, MessageCircle, User } from 'lucide-react';

interface BottomNavigationProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenPresetAm?: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onSelectTab,
  onOpenPresetAm,
}) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'order', label: 'Order', icon: Zap },
    { 
      id: 'preset', 
      label: 'Preset AM', 
      icon: Search, 
      isPreset: true,
      action: onOpenPresetAm 
    },
    { id: 'deposit', label: 'Deposit', icon: Wallet },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'profil', label: 'Akun', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 z-40 py-1 px-1.5 sm:px-3 max-w-md mx-auto shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isPreset = item.isPreset;

          const handleClick = () => {
            onSelectTab(item.id);
          };

          return (
            <button
              key={item.id}
              onClick={handleClick}
              className={`flex flex-col items-center justify-center py-1 px-1 sm:px-2 rounded-2xl transition-all relative cursor-pointer group flex-1 max-w-[68px] ${
                isActive ? 'text-orange-500 scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {isPreset ? (
                /* Ultra-Cool Glowing Search Preset Icon Right Beside Order */
                <div className="relative">
                  <div className={`p-1.5 rounded-xl bg-gradient-to-tr from-rose-500 via-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30 group-hover:scale-110 group-active:scale-95 transition-transform flex items-center justify-center ${
                    isActive ? 'ring-2 ring-orange-500 ring-offset-2 scale-105' : ''
                  }`}>
                    <Search className="w-4 h-4 stroke-[2.8]" />
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ring-2 ring-white absolute -top-0.5 -right-0.5 animate-pulse"></span>
                </div>
              ) : (
                <div
                  className={`p-1.5 rounded-xl transition-colors ${
                    isActive ? 'bg-orange-50 text-orange-600' : 'bg-transparent'
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                </div>
              )}

              <span
                className={`text-[9.5px] sm:text-[10px] font-black mt-0.5 tracking-tight truncate leading-tight ${
                  isPreset
                    ? 'text-orange-600 font-extrabold'
                    : isActive
                    ? 'text-orange-600'
                    : 'text-slate-500'
                }`}
              >
                {item.label}
              </span>

              {isActive && !isPreset && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 absolute -bottom-0.5"></span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
