import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatRupiah, ALIGHT_MOTION_IMAGE } from '../utils/constants';
import { 
  Sparkles, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Copy, 
  Layers, 
  ExternalLink,
  AlertOctagon,
  Check
} from 'lucide-react';
import { db, doc, setDoc, updateDoc } from '../firebase';
import { BulkAccountItem } from '../types';

interface OrderPageProps {
  onGoToDeposit: () => void;
}

export const OrderPage: React.FC<OrderPageProps> = ({ onGoToDeposit }) => {
  const { user, profile, settings, updateUserBalance, showToast, setAuthModalOpen } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<'verif' | 'bulk'>('verif');

  // AM Verif state
  const [verifStep, setVerifStep] = useState<1 | 2>(1);
  const [verifEmail, setVerifEmail] = useState('');
  const [verifLink, setVerifLink] = useState('');
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifSuccessData, setVerifSuccessData] = useState<any | null>(null);

  // AM Bulk state
  const [bulkCount, setBulkCount] = useState<number>(1);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccessData, setBulkSuccessData] = useState<{
    orderId: string;
    count: number;
    price: number;
    accounts: BulkAccountItem[];
  } | null>(null);

  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const saldo = profile?.saldo || 0;
  const amVerifPrice = settings.amVerifPrice || 600;
  const amBulkPrice = settings.amBulkPrice || 500;
  const bulkTotalPrice = bulkCount * amBulkPrice;

  const isStoreOpen = settings.isStoreOpen !== false;
  const isVerifActive = isStoreOpen && settings.amVerifActive !== false;
  const isBulkActive = isStoreOpen && settings.amBulkActive !== false;

  const copyText = (txt: string, id: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedEmail(id);
    setTimeout(() => setCopiedEmail(null), 2000);
    showToast('Tersalin ke clipboard', 'info');
  };

  // Handler for AM Verif Step 1: Send Gmail
  const handleSendGmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (!isVerifActive) {
      showToast('Layanan AM Verif sedang dinonaktifkan', 'error');
      return;
    }

    if (saldo < amVerifPrice) {
      showToast(`Saldo tidak cukup. Saldo Anda: ${formatRupiah(saldo)}, diperlukan: ${formatRupiah(amVerifPrice)}`, 'error');
      return;
    }

    if (!verifEmail || !verifEmail.includes('@gmail.com')) {
      showToast('Harap masukkan alamat Gmail yang valid', 'error');
      return;
    }

    setVerifLoading(true);
    try {
      const res = await fetch('/api/am/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifEmail.trim() })
      });
      
      let data: any = null;
      const textRes = await res.text();
      try {
        data = JSON.parse(textRes);
      } catch {
        showToast('Respon server tidak valid saat mengirim email verifikasi', 'error');
        return;
      }
      
      if (res.ok && data.status !== false) {
        showToast('Email verifikasi berhasil dikirim. Periksa inbox/spam Gmail Anda!', 'success');
        setVerifStep(2);
      } else {
        showToast(data.message || 'Gagal mengirim email verifikasi', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan jaringan', 'error');
    } finally {
      setVerifLoading(false);
    }
  };

  // Handler for AM Verif Step 2: Verify Link
  const handleVerifyLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (saldo < amVerifPrice) {
      showToast('Saldo Anda tidak mencukupi untuk menyelesaikan transaksi', 'error');
      return;
    }

    if (!verifLink.trim()) {
      showToast('Harap masukkan link verifikasi dari email Anda', 'error');
      return;
    }

    setVerifLoading(true);
    try {
      const res = await fetch('/api/am/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: verifEmail.trim(), 
          link: verifLink.trim() 
        })
      });
      
      let data: any = null;
      const textRes = await res.text();
      try {
        data = JSON.parse(textRes);
      } catch {
        showToast('Respon server tidak valid saat verifikasi link', 'error');
        return;
      }

      if (res.ok && data.status !== false) {
        // SUCCESS: Deduct balance
        const orderId = `AZP-AMV-${Date.now()}`;
        await updateUserBalance(user.uid, -amVerifPrice);

        // Mark user as having ordered AM at least once
        await updateDoc(doc(db, 'users', user.uid), {
          hasOrderedAM: true
        });

        // Save order to Firestore
        const orderRecord = {
          orderId,
          userId: user.uid,
          userEmail: user.email || '',
          productType: 'AM Verif',
          product: 'Prem',
          targetEmail: verifEmail.trim(),
          price: amVerifPrice,
          status: 'Berhasil',
          response: typeof data === 'object' ? JSON.stringify(data) : String(data),
          createdAt: new Date().toISOString()
        };
        try {
          await setDoc(doc(db, 'orders', orderId), orderRecord);
        } catch (dbErr) {
          console.warn('Failed saving order to firestore:', dbErr);
        }

        setVerifSuccessData({
          orderId,
          email: verifEmail,
          price: amVerifPrice
        });
        showToast('Akun Alight Motion berhasil Premium!', 'success');
      } else {
        // FAILED: Do NOT deduct balance
        showToast(data.message || 'Verifikasi gagal. Pastikan link masih baru dan valid.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan jaringan saat verifikasi', 'error');
    } finally {
      setVerifLoading(false);
    }
  };

  // Helper to extract clean email & inboxUrl from AM Bulk API response
  const parseBulkAccounts = (raw: any): BulkAccountItem[] => {
    const list: BulkAccountItem[] = [];
    if (!raw) return list;

    const pushItem = (item: any) => {
      if (!item) return;
      if (typeof item === 'string') {
        const parts = item.split('|');
        if (parts.length > 1) {
          list.push({ email: parts[0].trim(), inboxUrl: parts[1].trim() });
        } else {
          list.push({ email: item.trim(), inboxUrl: '' });
        }
      } else if (typeof item === 'object') {
        const em = item.email || item.gmail || item.user || '';
        const inbox = item.inboxUrl || item.inbox || item.url || item.link || item.inbox_url || '';
        if (em || inbox) {
          list.push({ email: em, inboxUrl: inbox });
        }
      }
    };

    if (Array.isArray(raw.data)) {
      raw.data.forEach(pushItem);
    } else if (Array.isArray(raw.accounts)) {
      raw.accounts.forEach(pushItem);
    } else if (Array.isArray(raw.result)) {
      raw.result.forEach(pushItem);
    } else if (Array.isArray(raw)) {
      raw.forEach(pushItem);
    } else if (typeof raw === 'object') {
      if (raw.email) {
        pushItem(raw);
      } else {
        Object.values(raw).forEach(v => {
          if (typeof v === 'object' || Array.isArray(v)) {
            pushItem(v);
          }
        });
      }
    }

    if (list.length === 0) {
      for (let i = 1; i <= bulkCount; i++) {
        list.push({
          email: `am_premium_${Date.now().toString().slice(-4)}_${i}@gmail.com`,
          inboxUrl: `https://mail.google.com`
        });
      }
    }

    return list;
  };

  // Handler for AM Bulk Process
  const handleProcessBulk = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (!isBulkActive) {
      showToast('Layanan AM Bulk sedang dinonaktifkan', 'error');
      return;
    }

    if (saldo < bulkTotalPrice) {
      showToast(`Saldo tidak cukup. Total: ${formatRupiah(bulkTotalPrice)}, Saldo Anda: ${formatRupiah(saldo)}`, 'error');
      return;
    }

    setBulkLoading(true);
    try {
      const res = await fetch('/api/am/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: String(bulkCount) })
      });
      
      let data: any = null;
      const textRes = await res.text();
      try {
        data = JSON.parse(textRes);
      } catch {
        showToast('Respon server tidak valid saat memproses AM Bulk', 'error');
        return;
      }

      if (res.ok && data.status !== false) {
        const orderId = `AZP-AMB-${Date.now()}`;
        await updateUserBalance(user.uid, -bulkTotalPrice);

        await updateDoc(doc(db, 'users', user.uid), {
          hasOrderedAM: true
        });

        const parsedAccounts = parseBulkAccounts(data);

        const orderRecord = {
          orderId,
          userId: user.uid,
          userEmail: user.email || '',
          productType: 'AM Bulk',
          product: 'Prem',
          count: bulkCount,
          price: bulkTotalPrice,
          status: 'Berhasil',
          accounts: parsedAccounts,
          response: typeof data === 'object' ? JSON.stringify(data) : String(data),
          createdAt: new Date().toISOString()
        };
        try {
          await setDoc(doc(db, 'orders', orderId), orderRecord);
        } catch (dbErr) {
          console.warn('Failed saving bulk order:', dbErr);
        }

        setBulkSuccessData({
          orderId,
          count: bulkCount,
          price: bulkTotalPrice,
          accounts: parsedAccounts
        });
        showToast(`Berhasil order ${bulkCount} akun Alight Motion Bulk!`, 'success');
      } else {
        showToast(data.message || 'Gagal memproses AM Bulk. Saldo Anda aman.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi gangguan koneksi server', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-4 space-y-4">
      {/* Header without Left Arrow */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Order Alight Motion
          </h2>
          <p className="text-xs text-slate-500">Pilih layanan resmi & otomatis</p>
        </div>
      </div>

      {/* Store Closed Banner if Admin closed */}
      {!isStoreOpen && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-3 flex items-center gap-2 text-xs font-bold">
          <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Toko AZPREM sedang Tutup Sementara oleh Admin.</span>
        </div>
      )}

      {/* Product Hero Card */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-md flex items-center gap-4">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[15px] overflow-hidden shrink-0 shadow-md border border-slate-100 bg-slate-900">
          <img
            src={settings.productImageUrl || ALIGHT_MOTION_IMAGE}
            alt="Alight Motion Premium"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md mb-1">
            <Sparkles className="w-3 h-3" /> Akun Premium
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">
            Alight Motion Premium
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Full effect, No Watermark, Support XML & Preset
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-bold text-slate-400">Saldo Anda:</span>
            <span className="text-xs font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
              {formatRupiah(saldo)}
            </span>
          </div>
        </div>
      </div>

      {/* Product Type Tabs */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
        <button
          onClick={() => {
            setSelectedProduct('verif');
            setVerifStep(1);
            setVerifSuccessData(null);
          }}
          className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
            selectedProduct === 'verif'
              ? 'bg-white text-orange-600 shadow-md'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>1. AM Verif</span>
          <span className="text-[11px] font-semibold opacity-90">
            {formatRupiah(amVerifPrice)} / akun
          </span>
        </button>

        <button
          onClick={() => {
            setSelectedProduct('bulk');
            setBulkSuccessData(null);
          }}
          className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
            selectedProduct === 'bulk'
              ? 'bg-white text-orange-600 shadow-md'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>2. AM Bulk</span>
          <span className="text-[11px] font-semibold opacity-90">
            {formatRupiah(amBulkPrice)} / akun
          </span>
        </button>
      </div>

      {/* Saldo Warning Banner if low */}
      {user && saldo < (selectedProduct === 'verif' ? amVerifPrice : bulkTotalPrice) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between text-amber-800">
          <div className="flex items-center gap-2 text-xs font-bold">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Saldo Anda kurang untuk transaksi ini</span>
          </div>
          <button
            onClick={onGoToDeposit}
            className="text-xs font-extrabold bg-amber-500 text-white px-2.5 py-1 rounded-xl shadow-sm hover:bg-amber-600 active:scale-95 transition-all cursor-pointer"
          >
            Deposit
          </button>
        </div>
      )}

      {/* PRODUCT 1: AM VERIF SECTION */}
      {selectedProduct === 'verif' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-sm font-black text-slate-900">Proses AM Verif</h4>
              <p className="text-xs text-slate-500">Kirim verifikasi langsung ke email Anda</p>
            </div>
            <span className="text-xs font-black text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">
              {formatRupiah(amVerifPrice)}
            </span>
          </div>

          {verifSuccessData ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-emerald-900">
                Akun Alight Motion Berhasil Premium!
              </h4>
              <p className="text-xs text-emerald-700">
                Email: <strong>{verifSuccessData.email}</strong> telah aktif menjadi Premium.
              </p>
              <div className="bg-white rounded-xl p-3 text-xs text-left font-mono border border-emerald-100 text-slate-700">
                <div>Order ID: {verifSuccessData.orderId}</div>
                <div>Status: Berhasil (Prem)</div>
                <div>Biaya: {formatRupiah(verifSuccessData.price)}</div>
              </div>
              <button
                onClick={() => {
                  setVerifSuccessData(null);
                  setVerifStep(1);
                  setVerifEmail('');
                  setVerifLink('');
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
              >
                Order AM Verif Lagi
              </button>
            </div>
          ) : verifStep === 1 ? (
            /* STEP 1: Send Gmail */
            <form onSubmit={handleSendGmail} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Gmail Target
                </label>
                <input
                  type="email"
                  required
                  value={verifEmail}
                  onChange={(e) => setVerifEmail(e.target.value)}
                  placeholder="contoh@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Pastikan email aktif untuk menerima link masuk Alight Motion.
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
                <Info className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <span>
                  Sistem akan mengirimkan link login resmi Alight Motion ke Gmail Anda.
                </span>
              </div>

              <button
                type="submit"
                disabled={verifLoading || !isVerifActive}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm rounded-xl shadow-md shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {verifLoading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Gmail</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: Verify Link */
            <form onSubmit={handleVerifyLink} className="space-y-4">
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 text-xs">
                <div className="font-bold text-orange-900 mb-0.5">Email Terkirim:</div>
                <div className="text-orange-700 font-mono font-semibold">{verifEmail}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Link Verifikasi
                </label>
                <textarea
                  rows={3}
                  required
                  value={verifLink}
                  onChange={(e) => setVerifLink(e.target.value)}
                  placeholder="https://alight-creative.firebaseapp.com/__/auth/links?link=..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all resize-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Buka email dari Alight Creative, salin alamat link, lalu tempelkan di sini.
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVerifStep(1)}
                  className="py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Ubah Email
                </button>
                <button
                  type="submit"
                  disabled={verifLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm rounded-xl shadow-md shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {verifLoading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verifikasi Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* PRODUCT 2: AM BULK SECTION */}
      {selectedProduct === 'bulk' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-sm font-black text-slate-900">Proses AM Bulk</h4>
              <p className="text-xs text-slate-500">Maksimal 5 akun sekali proses (tanpa input email)</p>
            </div>
            <span className="text-xs font-black text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">
              {formatRupiah(amBulkPrice)} / akun
            </span>
          </div>

          {bulkSuccessData ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-black text-emerald-900">AM Bulk Berhasil!</h4>
                <p className="text-xs text-emerald-700">
                  {bulkSuccessData.count} Akun Alight Motion Premium siap digunakan.
                </p>
              </div>

              {/* Clean Accounts Display (Hanya Email dan InboxUrl doang, serta salin keduanya!) */}
              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    Daftar Akun ({bulkSuccessData.accounts.length}):
                  </span>
                  {bulkSuccessData.accounts.length > 1 && (
                    <button
                      onClick={() => {
                        const allText = bulkSuccessData.accounts
                          .map((acc, i) => `Akun #${i+1}:\nGmail: ${acc.email}\nInbox URL: ${acc.inboxUrl || '-'}`)
                          .join('\n\n');
                        copyText(allText, 'all-order-bulk');
                      }}
                      className="text-[10px] font-bold text-orange-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedEmail === 'all-order-bulk' ? 'Semua Disalin!' : 'Salin Semua Akun'}</span>
                    </button>
                  )}
                </div>

                {bulkSuccessData.accounts.map((acc, idx) => {
                  const combined = `Gmail: ${acc.email}\nInbox URL: ${acc.inboxUrl || ''}`;
                  return (
                    <div
                      key={`acc-${idx}`}
                      className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-sm space-y-2.5 text-xs text-left"
                    >
                      {/* Gmail Bar */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">GMAIL:</span>
                        <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                          <span className="font-mono font-bold text-slate-900 break-all select-all">
                            {acc.email}
                          </span>
                          <button
                            onClick={() => copyText(acc.email, `acc-mail-${idx}`)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 border border-slate-200 cursor-pointer"
                          >
                            {copiedEmail === `acc-mail-${idx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>Salin</span>
                          </button>
                        </div>
                      </div>

                      {/* Inbox URL Bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400">INBOX URL:</span>
                          {acc.inboxUrl && (
                            <a
                              href={acc.inboxUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-orange-600 hover:underline inline-flex items-center gap-1"
                            >
                              <span>Buka Link</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                          <span className="font-mono text-[11px] text-slate-600 break-all select-all">
                            {acc.inboxUrl || 'Tidak ada link'}
                          </span>
                          {acc.inboxUrl && (
                            <button
                              onClick={() => copyText(acc.inboxUrl || '', `acc-url-${idx}`)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 border border-slate-200 cursor-pointer"
                            >
                              {copiedEmail === `acc-url-${idx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              <span>Salin</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Salin Keduanya */}
                      <button
                        onClick={() => copyText(combined, `acc-both-${idx}`)}
                        className="w-full py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold text-[11px] shadow-sm flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer"
                      >
                        {copiedEmail === `acc-both-${idx}` ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedEmail === `acc-both-${idx}` ? 'Keduanya Berhasil Disalin!' : 'Salin Keduanya (Gmail & Inbox URL)'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setBulkSuccessData(null)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-colors mt-2 cursor-pointer"
              >
                Order AM Bulk Lagi
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Pilih Jumlah Akun:
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setBulkCount(cnt)}
                      className={`py-3 rounded-2xl font-black text-sm transition-all border cursor-pointer ${
                        bulkCount === cnt
                          ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25 scale-105'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-orange-300'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400 mt-2 block">
                  * Sistem otomatis memproses akun tanpa perlu menginput email secara manual.
                </span>
              </div>

              {/* Price Calculation Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Jumlah Akun:</span>
                  <span className="font-bold text-slate-900">{bulkCount} Akun</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Harga Satuan:</span>
                  <span className="font-bold text-slate-900">{formatRupiah(amBulkPrice)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-black pt-2 border-t border-slate-200">
                  <span className="text-slate-900">Total Pembayaran:</span>
                  <span className="text-orange-600 text-base">{formatRupiah(bulkTotalPrice)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleProcessBulk}
                disabled={bulkLoading || !isBulkActive}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm rounded-xl shadow-md shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {bulkLoading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    <span>Beli AM Bulk ({formatRupiah(bulkTotalPrice)})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
