import React, { useEffect, useState } from 'react';
import { 
  Wallet, 
  Zap, 
  Mail, 
  Users, 
  BookOpen, 
  MessageCircle, 
  ClipboardList, 
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertOctagon,
  Globe,
  ExternalLink,
  Code2,
  CheckCircle2,
  Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatRupiah } from '../utils/constants';
import { db, collection, onSnapshot } from '../firebase';

interface HomePageProps {
  onSelectTab: (tab: string) => void;
  onOpenJobGmail: () => void;
  onOpenPresetAm?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectTab,
  onOpenJobGmail,
  onOpenPresetAm
}) => {
  const { profile, settings, user, setAuthModalOpen } = useAuth();

  // Real Firestore statistics
  const [realUsersCount, setRealUsersCount] = useState<number>(0);
  const [realOrdersCount, setRealOrdersCount] = useState<number>(0);
  const [realDepositsSum, setRealDepositsSum] = useState<number>(0);

  useEffect(() => {
    // Listen to real users count
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setRealUsersCount(snapshot.size);
    }, (err) => console.warn('Users stat error:', err));

    // Listen to real orders count
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setRealOrdersCount(snapshot.size);
    }, (err) => console.warn('Orders stat error:', err));

    // Listen to real deposits sum
    const unsubDeposits = onSnapshot(collection(db, 'deposits'), (snapshot) => {
      let sum = 0;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status === 'paid') {
          sum += (Number(data.nominal) || 0);
        }
      });
      setRealDepositsSum(sum);
    }, (err) => console.warn('Deposits stat error:', err));

    return () => {
      unsubUsers();
      unsubOrders();
      unsubDeposits();
    };
  }, []);

  // Compute final displayed statistics (realtime or admin custom override)
  const displayUsers = settings.customStats?.useManualStats
    ? (settings.customStats.totalUsers ?? realUsersCount)
    : realUsersCount;

  const displayOrders = settings.customStats?.useManualStats
    ? (settings.customStats.totalOrders ?? realOrdersCount)
    : realOrdersCount;

  const displayDeposits = settings.customStats?.useManualStats
    ? (settings.customStats.totalDeposits ?? realDepositsSum)
    : realDepositsSum;

  const saldo = profile?.saldo || 0;
  const bonusReferral = profile?.bonusReferral || 0;
  const isStoreOpen = settings.isStoreOpen !== false;

  const quickServices = [
    {
      id: 'order_am',
      name: 'Order AM',
      desc: 'Alight Motion',
      iconImg: settings.productImageUrl || 'https://cdn.phototourl.com/member/2026-10-02-34487271-8084-48b6-b4d6-0450392c6a56.png',
      isImage: true,
      action: () => onSelectTab('order')
    },
    {
      id: 'preset_am',
      name: 'Preset AM',
      desc: '5MB & XML Gratis',
      icon: Search,
      color: 'bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-sm shadow-orange-500/20',
      action: onOpenPresetAm
    },
    {
      id: 'azryl_web',
      name: 'Web Azryl',
      desc: 'azryl.my.id',
      icon: Globe,
      color: 'bg-emerald-50 text-emerald-600',
      action: () => window.open('https://www.azryl.my.id/', '_blank')
    },
    {
      id: 'referral',
      name: 'Referral',
      desc: 'Ajak Teman',
      icon: Users,
      color: 'bg-indigo-50 text-indigo-600',
      action: () => onSelectTab('referral')
    },
    {
      id: 'cara_kerja',
      name: 'Cara Kerja',
      desc: 'Panduan',
      icon: BookOpen,
      color: 'bg-sky-50 text-sky-600',
      action: () => onSelectTab('carakerja')
    },
    {
      id: 'chat_room',
      name: 'Chat Room',
      desc: 'Komunitas AM',
      icon: MessageCircle,
      color: 'bg-purple-50 text-purple-600',
      action: () => onSelectTab('chat')
    },
    {
      id: 'riwayat',
      name: 'Riwayat',
      desc: 'Catatan Transaksi',
      icon: ClipboardList,
      color: 'bg-amber-50 text-amber-600',
      action: () => onSelectTab('riwayat')
    },
    {
      id: 'deposit',
      name: 'Deposit',
      desc: 'Isi Saldo',
      icon: Wallet,
      color: 'bg-rose-50 text-rose-600',
      action: () => onSelectTab('deposit')
    },
  ];

  return (
    <div className="space-y-5 pb-8 px-4 max-w-md mx-auto -mt-14 relative z-20">
      {/* Store Closed Banner if Admin closed the store */}
      {!isStoreOpen && (
        <div className="bg-rose-500 text-white rounded-2xl p-3 shadow-lg flex items-center gap-2.5 text-xs font-bold animate-pulse">
          <AlertOctagon className="w-5 h-5 shrink-0" />
          <span>Toko AZPREM saat ini sedang Tutup / Maintenance. Pemesanan dinonaktifkan sementara.</span>
        </div>
      )}

      {/* Card Saldo Utama */}
      <div className="bg-white rounded-3xl p-5 shadow-xl shadow-slate-200/60 border border-slate-100 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-orange-400/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Saldo Akun Utama
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Aktif
          </span>
        </div>

        {/* Saldo Nominal */}
        <div className="mb-2">
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {formatRupiah(saldo)}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-0.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Bonus Referral: <strong className="text-orange-600 font-bold">{formatRupiah(bonusReferral)}</strong></span>
          </div>
        </div>

        {/* Tiga Tombol Utama: Deposit, Order, & Search Preset AM di Pinggir Order */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
          <button
            onClick={() => {
              if (!user) {
                setAuthModalOpen(true);
              } else {
                onSelectTab('deposit');
              }
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm shadow-md shadow-orange-500/25 active:scale-98 transition-all cursor-pointer"
          >
            <Wallet className="w-4 h-4 shrink-0" />
            <span>Deposit</span>
          </button>

          <button
            onClick={() => onSelectTab('order')}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm shadow-md shadow-slate-900/10 active:scale-98 transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Order</span>
          </button>

          {/* Tombol Search Preset AM Tepat di Pinggir Fitur Order */}
          <button
            onClick={onOpenPresetAm}
            title="Search Preset AM 5MB & XML (100% Gratis)"
            className="flex items-center justify-center gap-1 py-3 px-3 rounded-2xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-black text-xs shadow-md shadow-orange-500/25 active:scale-95 transition-all cursor-pointer group shrink-0 relative overflow-hidden"
          >
            <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="font-extrabold text-[11px] hidden xs:inline">Preset</span>
          </button>
        </div>
      </div>

      {/* Banner Selamat Datang di AZPREM */}
      <div className="bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 rounded-3xl p-5 text-white shadow-xl shadow-orange-500/15 relative overflow-hidden">
        {/* Glow circles */}
        <div className="absolute right-0 bottom-0 translate-x-6 translate-y-6 w-32 h-32 rounded-full bg-white/10 blur-xl"></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3 h-3 text-amber-200" /> Garansi Resmi
          </div>
          <h2 className="text-lg font-black tracking-tight mb-1">
            {settings.bannerTitle || 'Selamat Datang di AZPREM!'}
          </h2>
          <p className="text-xs text-orange-50/90 leading-relaxed max-w-[260px] mb-4">
            {settings.bannerSubtitle || 'Order Alight Motion Premium dengan cepat, aman, dan praktis.'}
          </p>
          <button
            onClick={() => onSelectTab('order')}
            className="inline-flex items-center gap-2 bg-white text-orange-600 hover:bg-orange-50 font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <span>Mulai Sekarang</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Section: Layanan Cepat (7 services) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-black text-slate-900 tracking-tight">
            Layanan Cepat
          </h3>
          <span className="text-[11px] font-semibold text-orange-600">
            Akses Instan
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
          {quickServices.map((srv) => (
            <button
              key={srv.id}
              onClick={srv.action}
              className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-200 flex flex-col items-center text-center transition-all group active:scale-95 cursor-pointer"
            >
              {srv.isImage ? (
                <div className="w-11 h-11 rounded-xl overflow-hidden shadow-sm mb-1.5 border border-slate-100 group-hover:scale-105 transition-transform bg-slate-50">
                  <img
                    src={srv.iconImg}
                    alt={srv.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-105 transition-transform ${srv.color}`}>
                  {srv.icon && <srv.icon className="w-5 h-5" />}
                </div>
              )}
              <span className="text-[11px] font-extrabold text-slate-800 line-clamp-1 group-hover:text-orange-600 transition-colors">
                {srv.name}
              </span>
              <span className="text-[9px] font-medium text-slate-400 line-clamp-1">
                {srv.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Section: Watermark Azryl (Sesuai Permintaan User: Statistik diganti Watermark Azryl) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 text-white shadow-xl border border-slate-800/80 group">
        {/* Glow background accents */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-orange-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-orange-500/25 transition-all"></div>
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-rose-500/15 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center font-black text-white text-xs shadow-md shadow-orange-500/30">
                AZ
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black tracking-tight text-white">AZRYL</span>
                  <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black bg-orange-500 text-white tracking-wider">OFFICIAL</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">www.azryl.my.id</span>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/10 text-emerald-400 border border-emerald-400/20 backdrop-blur-sm">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Verified Creator
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            Platform resmi Alight Motion Premium, verifikasi akun otomatis, dan pencarian preset tercepat karya <strong>Azryl</strong>.
          </p>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Created with passion by Azryl</span>
            </span>
            <a
              href="https://www.azryl.my.id/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-orange-400 hover:text-orange-300 hover:underline transition-colors cursor-pointer"
            >
              <span>Kunjungi Web</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
