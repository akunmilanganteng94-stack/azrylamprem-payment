import React from 'react';
import { Home, Zap, Wallet, MessageCircle, User } from 'lucide-react';

interface BottomNavigationProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'order', label: 'Order', icon: Zap },
    { id: 'deposit', label: 'Deposit', icon: Wallet },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'profil', label: 'Akun', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 z-40 py-1.5 px-3 max-w-md mx-auto shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all relative ${
                isActive ? 'text-orange-500 scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-colors ${
                  isActive ? 'bg-orange-50 text-orange-600' : 'bg-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[11px] font-bold mt-0.5 tracking-tight ${isActive ? 'text-orange-600' : 'text-slate-500'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 absolute -bottom-0.5"></span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
