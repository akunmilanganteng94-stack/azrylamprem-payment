import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatRupiah, formatDate } from '../utils/constants';
import { 
  ClipboardList, 
  Zap, 
  Wallet, 
  Copy, 
  X, 
  Check, 
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { db, collection, query, where, orderBy, onSnapshot } from '../firebase';
import { OrderItem, DepositItem, BulkAccountItem } from '../types';

// Helper to extract REAL accounts directly from raw API response in Firestore
function extractRealAccounts(data: any): BulkAccountItem[] {
  const list: BulkAccountItem[] = [];

  const pushItem = (item: any) => {
    if (!item) return;
    if (typeof item === 'string') {
      const parts = item.split('|');
      if (parts.length > 1) {
        list.push({ email: parts[0].trim(), inboxUrl: parts[1].trim() });
      } else if (item.trim()) {
        list.push({ email: item.trim(), inboxUrl: '' });
      }
    } else if (typeof item === 'object') {
      const em = String(item.email || item.gmail || item.user || '').trim();
      const inb = String(item.inboxUrl || item.inbox_url || item.inbox || item.url || item.link || '').trim();
      if (em) {
        list.push({ email: em, inboxUrl: inb });
      }
    }
  };

  // 1. Cek data.response mentah dari API Zyvor
  if (data?.response) {
    try {
      const raw = typeof data.response === 'string' ? JSON.parse(data.response) : data.response;
      if (Array.isArray(raw?.results)) {
        raw.results.forEach(pushItem);
      } else if (Array.isArray(raw?.data)) {
        raw.data.forEach(pushItem);
      } else if (Array.isArray(raw?.accounts)) {
        raw.accounts.forEach(pushItem);
      }
      if (list.length > 0) return list;
    } catch {}
  }

  // 2. Cek data.accounts yang sudah tersimpan
  if (Array.isArray(data?.accounts) && data.accounts.length > 0) {
    const isDummy = data.accounts.some((a: any) => a.email && String(a.email).includes('am_premium_'));
    if (!isDummy) {
      data.accounts.forEach(pushItem);
      if (list.length > 0) return list;
    }
  }

  return list;
}

type CombinedHistoryItem = {
  id: string;
  type: 'order' | 'deposit';
  title: string;
  subtitle: string;
  amount: number;
  status: 'Berhasil' | 'Pending' | 'Gagal';
  date: string;
  referenceId: string;
  raw: any;
};

export const HistoryPage: React.FC = () => {
  const { user, showToast, setAuthModalOpen } = useAuth();
  const [filter, setFilter] = useState<'Semua' | 'Order' | 'Deposit' | 'Berhasil' | 'Pending' | 'Gagal'>('Semua');
  const [historyItems, setHistoryItems] = useState<CombinedHistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CombinedHistoryItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Listen to orders
    const ordersQ = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubOrders = onSnapshot(ordersQ, (snap) => {
      const ordersList: CombinedHistoryItem[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as OrderItem;
        const isVerif = data.productType === 'AM Verif';
        const realAccounts = isVerif ? [] : extractRealAccounts(data);
        const enrichedData = {
          ...data,
          accounts: realAccounts.length > 0 ? realAccounts : data.accounts
        };

        ordersList.push({
          id: docSnap.id,
          type: 'order',
          title: isVerif ? 'Akun Alight Motion Berhasil Premium' : `Order AM Bulk (${data.count || realAccounts.length || 1} Akun)`,
          subtitle: isVerif ? (data.targetEmail || 'Akun Premium') : `${data.count || realAccounts.length || 1} Akun Alight Motion`,
          amount: data.price,
          status: data.status === 'Berhasil' ? 'Berhasil' : data.status === 'Pending' ? 'Pending' : 'Gagal',
          date: data.createdAt,
          referenceId: data.orderId,
          raw: enrichedData
        });
      });

      // Listen to deposits
      const depositsQ = query(
        collection(db, 'deposits'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubDeposits = onSnapshot(depositsQ, (depSnap) => {
        const depositsList: CombinedHistoryItem[] = [];
        depSnap.forEach((docSnap) => {
          const data = docSnap.data() as DepositItem;
          const isDepositPaid = data.status === 'paid';
          const isDepositExpired = data.status === 'expired' || (
            data.status === 'pending' &&
            data.createdAt &&
            (Date.now() - new Date(data.createdAt).getTime() > 30 * 60 * 1000)
          );
          const displayStatus: 'Berhasil' | 'Pending' | 'Gagal' = isDepositPaid
            ? 'Berhasil'
            : isDepositExpired
            ? 'Gagal'
            : 'Pending';

          depositsList.push({
            id: docSnap.id,
            type: 'deposit',
            title: 'Deposit Saldo',
            subtitle: isDepositExpired ? 'QRIS Kadaluwarsa' : 'QRIS Otomatis',
            amount: data.nominal,
            status: displayStatus,
            date: data.createdAt,
            referenceId: data.invoice,
            raw: { ...data, isExpired: isDepositExpired }
          });
        });

        // Combine and sort by date descending
        const combined = [...ordersList, ...depositsList].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setHistoryItems(combined);
      }, (err) => console.warn('Deposits history notice:', err));

      return () => unsubDeposits();
    }, (err) => console.warn('Orders history notice:', err));

    return () => unsubOrders();
  }, [user]);

  const filteredItems = historyItems.filter((item) => {
    if (filter === 'Semua') return true;
    if (filter === 'Order') return item.type === 'order';
    if (filter === 'Deposit') return item.type === 'deposit';
    if (filter === 'Berhasil') return item.status === 'Berhasil';
    if (filter === 'Pending') return item.status === 'Pending';
    if (filter === 'Gagal') return item.status === 'Gagal';
    return true;
  });

  const handleCopy = (txt: string, id: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('Teks disalin ke clipboard', 'info');
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-4 space-y-4">
      {/* Header without Left Arrow */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Riwayat Transaksi
          </h2>
          <p className="text-xs text-slate-500">Catatan Order & Deposit Anda</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {(['Semua', 'Order', 'Deposit', 'Berhasil', 'Pending', 'Gagal'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              filter === cat
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Items List */}
      {!user ? (
        <div className="bg-white rounded-3xl p-8 text-center space-y-3 border border-slate-100 shadow-md">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">Masuk untuk melihat riwayat</h4>
          <p className="text-xs text-slate-400">
            Riwayat tersimpan aman di akun AZPREM Anda.
          </p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="px-5 py-2.5 bg-orange-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
          >
            Masuk Sekarang
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center space-y-2 border border-slate-100 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-700">Belum ada transaksi</h4>
          <p className="text-xs text-slate-400">
            Transaksi yang Anda lakukan akan muncul otomatis di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item, idx) => {
            const isOrder = item.type === 'order';
            const isSuccess = item.status === 'Berhasil';
            const isPending = item.status === 'Pending';

            return (
              <div
                key={item.id || item.referenceId || `hist-${idx}`}
                onClick={() => setSelectedItem(item)}
                className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                      isOrder ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {isOrder ? <Zap className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      {formatDate(item.date)}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`text-xs sm:text-sm font-black ${
                      isOrder ? 'text-slate-900' : 'text-emerald-600'
                    }`}
                  >
                    {isOrder ? '-' : '+'}
                    {formatRupiah(item.amount)}
                  </div>
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${
                      isSuccess
                        ? 'bg-emerald-50 text-emerald-700'
                        : isPending
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {item.type === 'deposit' && (item.raw?.isExpired || item.raw?.status === 'expired')
                      ? 'Kadaluwarsa'
                      : item.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            onClick={() => setSelectedItem(null)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm cursor-pointer"
          />

          <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-5 z-10 border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">
                Detail Transaksi
              </h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center py-2">
              <span className="text-xs font-bold text-slate-400">Total Transaksi</span>
              <div className="text-2xl font-black text-slate-900 mt-0.5">
                {formatRupiah(selectedItem.amount)}
              </div>
              <span
                className={`inline-block text-xs font-bold px-3 py-1 rounded-full mt-2 ${
                  selectedItem.status === 'Berhasil'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedItem.status === 'Pending'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {selectedItem.type === 'deposit' && (selectedItem.raw?.isExpired || selectedItem.raw?.status === 'expired')
                  ? 'Kadaluwarsa'
                  : selectedItem.status}
              </span>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2 text-xs border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Nomor Transaksi:</span>
                <button
                  onClick={() => handleCopy(selectedItem.referenceId, 'ref')}
                  className="font-mono font-bold text-slate-800 flex items-center gap-1 hover:text-orange-600 cursor-pointer"
                >
                  <span>{selectedItem.referenceId}</span>
                  {copiedId === 'ref' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Layanan:</span>
                <span className="font-bold text-slate-800">
                  {selectedItem.title}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Waktu:</span>
                <span className="font-semibold text-slate-800">
                  {formatDate(selectedItem.date)}
                </span>
              </div>
            </div>

            {/* If AM Verif: Akun Alight Motion Berhasil Premium */}
            {selectedItem.type === 'order' && selectedItem.raw?.productType === 'AM Verif' && (
              <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-100 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Akun Alight Motion Berhasil Premium</span>
                </div>
                <div className="text-xs text-slate-700">
                  Email Akun: <strong className="font-mono text-emerald-800">{selectedItem.raw.targetEmail}</strong>
                </div>
              </div>
            )}

            {/* If AM Bulk: Tampilkan email dan inboxUrl DOANG, serta fitur salin keduanya! */}
            {selectedItem.type === 'order' && selectedItem.raw?.productType === 'AM Bulk' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Daftar Akun AM Bulk Resmi:</span>
                  </div>
                  {Array.isArray(selectedItem.raw.accounts) && selectedItem.raw.accounts.length > 1 && (
                    <button
                      onClick={() => {
                        const allText = selectedItem.raw.accounts
                          .map((acc: BulkAccountItem, i: number) => `Akun #${i+1}:\nEmail: ${acc.email}\nInbox URL: ${acc.inboxUrl || '-'}`)
                          .join('\n\n');
                        handleCopy(allText, 'all-accounts');
                      }}
                      className="text-[10px] font-bold text-orange-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedId === 'all-accounts' ? 'Semua Disalin!' : 'Salin Semua'}</span>
                    </button>
                  )}
                </div>

                {Array.isArray(selectedItem.raw.accounts) && selectedItem.raw.accounts.length > 0 ? (
                  selectedItem.raw.accounts.map((acc: BulkAccountItem, idx: number) => {
                    const combinedText = `Email: ${acc.email}\nInbox URL: ${acc.inboxUrl || ''}`;
                    return (
                      <div
                        key={`hist-acc-${idx}`}
                        className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2.5 shadow-sm"
                      >
                        {/* 1. Gmail / Email Bar */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                            Gmail / Email Akun:
                          </span>
                          <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
                            <span className="font-mono font-bold text-slate-900 break-all select-all">
                              {acc.email}
                            </span>
                            <button
                              onClick={() => handleCopy(acc.email, `mail-${idx}`)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              {copiedId === `mail-${idx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              <span>Salin</span>
                            </button>
                          </div>
                        </div>

                        {/* 2. Inbox URL Bar */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Inbox URL:
                            </span>
                            {acc.inboxUrl && (
                              <a
                                href={acc.inboxUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-bold text-orange-600 hover:underline inline-flex items-center gap-1"
                              >
                                <span>Buka Link Inbox</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
                            <span className="font-mono text-[11px] text-slate-600 break-all select-all">
                              {acc.inboxUrl || 'Tidak ada link'}
                            </span>
                            {acc.inboxUrl && (
                              <button
                                onClick={() => handleCopy(acc.inboxUrl || '', `url-${idx}`)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                {copiedId === `url-${idx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                <span>Salin</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 3. Button Salin Keduanya (Gmail & Inbox URL) */}
                        <button
                          onClick={() => handleCopy(combinedText, `both-${idx}`)}
                          className="w-full py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold text-[11px] shadow-sm flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer"
                        >
                          {copiedId === `both-${idx}` ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === `both-${idx}` ? 'Keduanya Berhasil Disalin!' : 'Salin Keduanya (Email & Inbox URL)'}</span>
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-slate-50 p-3 rounded-2xl text-xs text-slate-500 text-center">
                    Detail akun telah tersimpan di sistem.
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setSelectedItem(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
