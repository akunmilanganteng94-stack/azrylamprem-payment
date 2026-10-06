/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HeaderNavbar } from './components/HeaderNavbar';
import { SidebarDrawer } from './components/SidebarDrawer';
import { BottomNavigation } from './components/BottomNavigation';
import { ToastContainer } from './components/ToastContainer';
import { AuthModal } from './components/AuthModal';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { OrderPage } from './pages/OrderPage';
import { DepositPage } from './pages/DepositPage';
import { ChatPage } from './pages/ChatPage';
import { ProfilePage } from './pages/ProfilePage';
import { HistoryPage } from './pages/HistoryPage';
import { ReferralPage } from './pages/ReferralPage';
import { CaraKerjaPage } from './pages/CaraKerjaPage';
import { JobGmailModal } from './pages/JobGmailModal';
import { AnnouncementsModal } from './pages/AnnouncementsModal';
import { PresetAmModal } from './pages/PresetAmModal';
import { PresetAmPage } from './pages/PresetAmPage';
import { AdminPanel } from './admin/AdminPanel';
import { db, collection, onSnapshot, query, where } from './firebase';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jobGmailModalOpen, setJobGmailModalOpen] = useState(false);
  const [announcementsModalOpen, setAnnouncementsModalOpen] = useState(false);
  const [presetAmModalOpen, setPresetAmModalOpen] = useState(false);
  // Unread announcements count
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(1);

  // Listen to path or hash (e.g. #admin or /admin)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const hash = window.location.hash;
      if (pathname.includes('/admin') || hash === '#admin') {
        setActiveTab('admin');
      }
    }
  }, []);

  // Update hash when tab changes
  const handleSelectTab = (tab: string) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      if (tab === 'admin') {
        window.location.hash = '#admin';
      } else if (tab === 'home') {
        window.location.hash = '';
      } else {
        window.location.hash = `#${tab}`;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Realtime unread count
  useEffect(() => {
    const q = query(collection(db, 'announcements'), where('isActive', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      setUnreadAnnouncements(snap.size || 1);
    }, (err) => console.warn('Announcements count notice:', err));
    return () => unsub();
  }, []);

  // Loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-black text-xl flex items-center justify-center mb-3 shadow-lg shadow-orange-500/25 animate-pulse">
          AZ
        </div>
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-semibold mt-3">Memuat AZPREM...</span>
      </div>
    );
  }

  // Wajib masuk/daftar akun terlebih dahulu sebelum ke dashboard
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900">
        <AuthPage />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 antialiased font-sans flex flex-col justify-between selection:bg-orange-500 selection:text-white">
      {/* Mobile-first centered frame container */}
      <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen shadow-2xl relative flex flex-col border-x border-slate-200/50">
        
        {/* Top Navbar Header (Visible prominently on Home) */}
        {activeTab === 'home' && (
          <HeaderNavbar
            onOpenSidebar={() => setSidebarOpen(true)}
            onOpenChat={() => handleSelectTab('chat')}
            onOpenAnnouncements={() => setAnnouncementsModalOpen(true)}
            unreadCount={unreadAnnouncements}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1">
          {activeTab === 'home' && (
            <HomePage
              onSelectTab={handleSelectTab}
              onOpenJobGmail={() => setJobGmailModalOpen(true)}
              onOpenPresetAm={() => handleSelectTab('preset')}
            />
          )}

          {activeTab === 'order' && (
            <OrderPage
              onGoToDeposit={() => handleSelectTab('deposit')}
              onOpenPresetAm={() => handleSelectTab('preset')}
            />
          )}

          {activeTab === 'preset' && (
            <PresetAmPage
              onBack={() => handleSelectTab('home')}
              onGoToOrder={() => handleSelectTab('order')}
            />
          )}

          {activeTab === 'deposit' && (
            <DepositPage
              onGoToHistory={() => handleSelectTab('riwayat')}
            />
          )}

          {activeTab === 'chat' && (
            <ChatPage />
          )}

          {activeTab === 'profil' && (
            <ProfilePage
              onGoToDeposit={() => handleSelectTab('deposit')}
              onGoToReferral={() => handleSelectTab('referral')}
              onGoToAdmin={() => handleSelectTab('admin')}
            />
          )}

          {activeTab === 'riwayat' && (
            <HistoryPage />
          )}

          {activeTab === 'referral' && (
            <ReferralPage />
          )}

          {activeTab === 'carakerja' && (
            <CaraKerjaPage
              onGoToOrder={() => handleSelectTab('order')}
            />
          )}

          {activeTab === 'admin' && (
            <AdminPanel onBack={() => handleSelectTab('home')} />
          )}
        </main>

        {/* Fixed Bottom Navigation */}
        {activeTab !== 'admin' && (
          <BottomNavigation
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            onOpenPresetAm={() => setPresetAmModalOpen(true)}
          />
        )}

        {/* Sidebar Drawer */}
        <SidebarDrawer
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
        />

        {/* Job Gmail Modal */}
        <JobGmailModal
          isOpen={jobGmailModalOpen}
          onClose={() => setJobGmailModalOpen(false)}
          onGoToChat={() => {
            setJobGmailModalOpen(false);
            handleSelectTab('chat');
          }}
        />

        {/* Announcements Modal */}
        <AnnouncementsModal
          isOpen={announcementsModalOpen}
          onClose={() => setAnnouncementsModalOpen(false)}
        />

        {/* Search Preset AM Modal (Gratis via TikTok URL) */}
        <PresetAmModal
          isOpen={presetAmModalOpen}
          onClose={() => setPresetAmModalOpen(false)}
        />

        {/* Auth Modal (Login / Register / Forgot Password) */}
        <AuthModal />

        {/* Global Toast Notifications */}
        <ToastContainer />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
