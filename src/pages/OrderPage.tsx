import React, { useState, useEffect } from 'react';
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
  Check,
  Search,
  Lock
} from 'lucide-react';
import { db, doc, setDoc, updateDoc } from '../firebase';
import { BulkAccountItem } from '../types';

interface OrderPageProps {
  onGoToDeposit: () => void;
  onOpenPresetAm?: () => void;
}

export const OrderPage: React.FC<OrderPageProps> = ({ onGoToDeposit, onOpenPresetAm }) => {
  const { user, profile, settings, updateUserBalance, showToast, setAuthModalOpen } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<'bulk' | 'verif'>('bulk');

  const saldo = profile?.saldo || 0;
  const amVerifPrice = settings.amVerifPrice || 600;
  const amBulkPrice = settings.amBulkPrice || 500;

  const isStoreOpen = settings.isStoreOpen !== false;
  const isVerifActive = isStoreOpen && settings.amVerifActive !== false;
  const isBulkActive = isStoreOpen && settings.amBulkActive !== false;

  // Auto-switch to active product if one product is closed
  useEffect(() => {
    if (!isStoreOpen) return;
    if (selectedProduct === 'bulk' && !isBulkActive && isVerifActive) {
      setSelectedProduct('verif');
    } else if (selectedProduct === 'verif' && !isVerifActive && isBulkActive) {
      setSelectedProduct('bulk');
    }
  }, [isBulkActive, isVerifActive, selectedProduct, isStoreOpen]);

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
  const bulkTotalPrice = bulkCount * amBulkPrice;

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
      let res = await fetch('/api/am/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Endpoint': 'am/send' },
        body: JSON.stringify({ email: verifEmail.trim(), __endpoint: 'am/send' })
      });
      
      let data: any = null;
      let textRes = await res.text();
      try {
        data = JSON.parse(textRes);
      } catch {
        try {
          const fbRes = await fetch('/api/index?endpoint=am/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Endpoint': 'am/send' },
            body: JSON.stringify({ email: verifEmail.trim(), __endpoint: 'am/send' })
          });
          const fbText = await fbRes.text();
          data = JSON.parse(fbText);
        } catch {}
      }
      
      if (!data) {
        showToast('Respon server tidak valid saat mengirim email verifikasi', 'error');
        return;
      }

      if (data.status !== false) {
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
      let res = await fetch('/api/am/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Endpoint': 'am/verify' },
        body: JSON.stringify({ 
          email: verifEmail.trim(), 
          link: verifLink.trim(),
          __endpoint: 'am/verify'
        })
      });
      
      let data: any = null;
      let textRes = await res.text();
      try {
        data = JSON.parse(textRes);
      } catch {
        try {
          const fbRes = await fetch('/api/index?endpoint=am/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Endpoint': 'am/verify' },
            body: JSON.stringify({ 
              email: verifEmail.trim(), 
              link: verifLink.trim(),
              __endpoint: 'am/verify'
            })
          });
          const fbText = await fbRes.text();
          data = JSON.parse(fbText);
        } catch {}
      }

      if (!data) {
        showToast('Respon server tidak valid saat verifikasi link', 'error');
        return;
      }

      if (data.status !== false) {
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

  // Helper to extract clean email & inboxUrl directly from AM Bulk API response
  const parseBulkAccounts = (raw: any): BulkAccountItem[] => {
    const list: BulkAccountItem[] = [];
    if (!raw) return list;

    let parsed = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }

    const pushItem = (item: any) => {
      if (!item) return;
      if (typeof item === 'string') {
        const parts = item.split('|');
        if (parts.length > 1) {
          const em = parts[0].trim();
          const inb = parts[1].trim();
          if (em) list.push({ email: em, inboxUrl: inb });
        } else if (item.trim()) {
          list.push({ email: item.trim(), inboxUrl: '' });
        }
      } else if (typeof item === 'object') {
        const em = String(item.email || item.gmail || item.user || '').trim();
        const inbox = String(item.inboxUrl || item.inbox_url || item.inbox || item.url || item.link || '').trim();
        if (em) {
          list.push({ email: em, inboxUrl: inbox });
        }
      }
    };

    // 1. Zyvor Bulk V3 standard response: results: [{ email, inboxUrl }]
    if (Array.isArray(parsed.results)) {
      parsed.results.forEach(pushItem);
    } else if (Array.isArray(parsed.data)) {
      parsed.data.forEach(pushItem);
    } else if (Array.isArray(parsed.accounts)) {
      parsed.accounts.forEach(pushItem);
    } else if (Array.isArray(parsed.result)) {
      parsed.result.forEach(pushItem);
    } else if (Array.isArray(parsed)) {
      parsed.forEach(pushItem);
    } else if (typeof parsed === 'object') {
      if (parsed.email) {
        pushItem(parsed);
      } else {
        Object.values(parsed).forEach(v => {
          if (Array.isArray(v)) {
            v.forEach(pushItem);
          } else if (typeof v === 'object' && v !== null && (v as any).email) {
            pushItem(v);
          }
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
      let res = await fetch('/api/am/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Endpoint': 'am/bulk' },
        body: JSON.stringify({ count: String(bulkCount), __endpoint: 'am/bulk' })
      });
      
      let data: any = null;
      let textRes = await res.text();
      try {
        data = JSON.parse(textRes);
      } catch {
        try {
          const fbRes = await fetch('/api/index?endpoint=am/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Endpoint': 'am/bulk' },
            body: JSON.stringify({ count: String(bulkCount), __endpoint: 'am/bulk' })
          });
          const fbText = await fbRes.text();
          data = JSON.parse(fbText);
        } catch {}
      }

      if (!data) {
        showToast('Respon server tidak valid saat memproses AM Bulk', 'error');
        return;
      }

      if (data.status !== false) {
        // Ambil akun ASLI langsung dari respon API
        const parsedAccounts = parseBulkAccounts(data);

        // Jika API tidak mengembalikan akun, JANGAN potong saldo dan tampilkan error
        if (parsedAccounts.length === 0) {
          showToast(data.message || 'Server AM Bulk tidak mengembalikan akun. Saldo Anda aman.', 'error');
          return;
        }

        const orderId = `AZP-AMB-${Date.now()}`;
        await updateUserBalance(user.uid, -bulkTotalPrice);

        await updateDoc(doc(db, 'users', user.uid), {
          hasOrderedAM: true
        });

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
        showToast(`Berhasil order ${parsedAccounts.length} akun Alight Motion Bulk!`, 'success');
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
      {/* Header with Search Preset AM right beside it */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Order Alight Motion
          </h2>
          <p className="text-xs text-slate-500">Pilih layanan resmi & otomatis</p>
        </div>

        {onOpenPresetAm && (
          <button
            onClick={onOpenPresetAm}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500 hover:from-orange-600 hover:to-rose-600 text-white text-xs font-black shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer group shrink-0"
            title="Search Preset AM 5MB & XML Gratis"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </div>
            <span>Preset AM</span>
          </button>
        )}
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

      {/* Product Type Tabs: Produk Pertama AM Bulk, Produk Kedua AM Verif */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
        <button
          type="button"
          disabled={!isBulkActive}
          aria-disabled={!isBulkActive}
          onClick={() => {
            if (!isBulkActive) {
              showToast('Layanan AM Bulk sedang ditutup dan tidak dapat diakses', 'error');
              return;
            }
            setSelectedProduct('bulk');
            setBulkSuccessData(null);
          }}
          className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex flex-col items-center justify-center gap-0.5 transition-all select-none ${
            !isBulkActive
              ? 'opacity-40 bg-slate-200/70 text-slate-400 cursor-not-allowed pointer-events-none border border-dashed border-slate-300'
              : selectedProduct === 'bulk'
              ? 'bg-white text-orange-600 shadow-md cursor-pointer'
              : 'text-slate-500 hover:text-slate-900 cursor-pointer'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
              !isBulkActive ? 'bg-slate-300 text-slate-500' : 'bg-orange-500 text-white'
            }`}>1</span>
            <span>AM Bulk</span>
            {!isBulkActive ? (
              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black bg-rose-500 text-white inline-flex items-center gap-0.5 shadow-xs">
                <Lock className="w-2.5 h-2.5" /> Ditutup
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-emerald-100 text-emerald-700">
                Buka
              </span>
            )}
          </div>
          <span className="text-[11px] font-semibold opacity-90">
            {!isBulkActive ? 'Tidak Dapat Diakses' : `${formatRupiah(amBulkPrice)} / akun`}
          </span>
        </button>

        <button
          type="button"
          disabled={!isVerifActive}
          aria-disabled={!isVerifActive}
          onClick={() => {
            if (!isVerifActive) {
              showToast('Layanan AM Verif sedang ditutup dan tidak dapat diakses', 'error');
              return;
            }
            setSelectedProduct('verif');
            setVerifStep(1);
            setVerifSuccessData(null);
          }}
          className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex flex-col items-center justify-center gap-0.5 transition-all select-none ${
            !isVerifActive
              ? 'opacity-40 bg-slate-200/70 text-slate-400 cursor-not-allowed pointer-events-none border border-dashed border-slate-300'
              : selectedProduct === 'verif'
              ? 'bg-white text-orange-600 shadow-md cursor-pointer'
              : 'text-slate-500 hover:text-slate-900 cursor-pointer'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
              !isVerifActive ? 'bg-slate-300 text-slate-500' : 'bg-slate-300 text-slate-700'
            }`}>2</span>
            <span>AM Verif</span>
            {!isVerifActive ? (
              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black bg-rose-500 text-white inline-flex items-center gap-0.5 shadow-xs">
                <Lock className="w-2.5 h-2.5" /> Ditutup
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-emerald-100 text-emerald-700">
                Buka
              </span>
            )}
          </div>
          <span className="text-[11px] font-semibold opacity-90">
            {!isVerifActive ? 'Tidak Dapat Diakses' : `${formatRupiah(amVerifPrice)} / akun`}
          </span>
        </button>
      </div>

      {/* Saldo Warning Banner if low */}
      {user && saldo < (selectedProduct === 'bulk' ? bulkTotalPrice : amVerifPrice) && (
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

      {/* PRODUCT 1: AM BULK SECTION (PRODUK PERTAMA) */}
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

          {!isBulkActive ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="font-black text-rose-900 text-base">Layanan AM Bulk Sedang Ditutup</h4>
              <p className="text-xs text-rose-700 max-w-xs mx-auto leading-relaxed">
                Pemesanan AM Bulk dinonaktifkan sementara oleh Admin. Harap gunakan layanan AM Verif atau tunggu hingga dibuka kembali.
              </p>
            </div>
          ) : bulkSuccessData ? (
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

      {/* PRODUCT 2: AM VERIF SECTION (PRODUK KEDUA) */}
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

          {!isVerifActive ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="font-black text-rose-900 text-base">Layanan AM Verif Sedang Ditutup</h4>
              <p className="text-xs text-rose-700 max-w-xs mx-auto leading-relaxed">
                Pemesanan AM Verif dinonaktifkan sementara oleh Admin. Harap gunakan layanan AM Bulk atau tunggu hingga dibuka kembali.
              </p>
            </div>
          ) : verifSuccessData ? (
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
    </div>
  );
};
