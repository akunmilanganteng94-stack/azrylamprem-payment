import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatRupiah } from '../utils/constants';
import { 
  QrCode, 
  Wallet, 
  Clock, 
  CheckCircle2, 
  Copy, 
  RefreshCw, 
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  PlusCircle,
  Download
} from 'lucide-react';
import { db, doc, setDoc, updateDoc, onSnapshot, increment } from '../firebase';

interface DepositPageProps {
  onGoToHistory: () => void;
}

export const DepositPage: React.FC<DepositPageProps> = ({ onGoToHistory }) => {
  const { user, profile, settings, updateUserBalance, showToast, setAuthModalOpen } = useAuth();
  const [nominal, setNominal] = useState<number>(1000);
  const [inputVal, setInputVal] = useState<string>('1000');
  const [loading, setLoading] = useState(false);

  // Active QRIS state with complete breakdown (No fee, only deposit + unique code)
  const [activeDeposit, setActiveDeposit] = useState<{
    depositId: string;
    invoice: string;
    transactionId?: string;
    nominal: number;
    uniqueCode: number;
    totalPayment: number;
    qrUrl: string;
    qrisImage: string;
    expiredAt: string;
    expiresAtTimestamp?: number;
  } | null>(null);

  const [timeLeft, setTimeLeft] = useState<number>(30 * 60);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const hasCompletedRef = useRef(false);

  const minDeposit = settings.minDeposit || 1000;
  const maxDeposit = settings.maxDeposit || 100000;
  const isDepositActive = settings.depositActive !== false;

  // Pilihan nominal deposit dengan 1k (Rp1.000)
  const quickAmounts = [1000, 5000, 10000, 20000, 50000, 100000];

  const handleNominalChange = (valStr: string) => {
    const raw = valStr.replace(/\D/g, '');
    setInputVal(raw);
    const num = parseInt(raw, 10) || 0;
    setNominal(num);
  };

  const handleSelectQuick = (amount: number) => {
    setNominal(amount);
    setInputVal(String(amount));
  };

  // Muat QRIS aktif yang tersimpan saat pindah fitur / kembali ke halaman deposit
  useEffect(() => {
    try {
      const saved = localStorage.getItem('AZPREM_ACTIVE_DEPOSIT');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.expiresAtTimestamp) {
          const remaining = Math.floor((parsed.expiresAtTimestamp - Date.now()) / 1000);
          if (remaining > 0) {
            setActiveDeposit(parsed);
            setTimeLeft(remaining);
            setIsExpired(false);
            return;
          } else {
            // QRIS telah melebihi batas waktu 30 menit: Tampilkan status Gagal (Waktu Habis)
            setActiveDeposit(parsed);
            setTimeLeft(0);
            setIsExpired(true);
            try {
              localStorage.removeItem('AZPREM_ACTIVE_DEPOSIT');
            } catch {}
            if (parsed.invoice) {
              setDoc(doc(db, 'deposits', parsed.invoice), {
                status: 'gagal',
                isExpired: true,
                expiredAt: new Date().toISOString(),
                gagalReason: 'Waktu pembayaran 30 menit telah habis tanpa transfer'
              }, { merge: true }).catch(() => {});
            }
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Notice loading saved deposit from localStorage:', e);
    }
  }, [user]);

  // Timer countdown: 30 menit dari API. Bila habis dan belum bayar -> status Kadaluwarsa
  useEffect(() => {
    if (!activeDeposit || paymentSuccess || isExpired) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsExpired(true);
          try {
            localStorage.removeItem('AZPREM_ACTIVE_DEPOSIT');
          } catch {}
          if (activeDeposit) {
            setDoc(doc(db, 'deposits', activeDeposit.invoice), {
              status: 'gagal',
              isExpired: true,
              expiredAt: new Date().toISOString(),
              gagalReason: 'Waktu pembayaran 30 menit telah habis tanpa transfer'
            }, { merge: true }).catch(() => {});
          }
          showToast('Waktu pembayaran QRIS 30 menit telah habis. Transaksi dianggap Gagal.', 'error');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeDeposit, paymentSuccess, isExpired]);

  // Complete Payment helper (Automatic Credit)
  const completePayment = async (invoice: string, amount: number) => {
    if (!user || hasCompletedRef.current) return;
    hasCompletedRef.current = true;

    try {
      try {
        localStorage.removeItem('AZPREM_ACTIVE_DEPOSIT');
      } catch {}

      const depRef = doc(db, 'deposits', invoice);
      try {
        await setDoc(depRef, {
          depositId: invoice,
          invoice,
          userId: user.uid,
          userEmail: user.email || '',
          nominal: amount,
          fee: 0,
          uniqueCode: activeDeposit?.uniqueCode || 0,
          totalPayment: activeDeposit?.totalPayment || amount,
          status: 'paid',
          paidAt: new Date().toISOString()
        }, { merge: true });
      } catch (depErr) {
        console.warn('Notice updating deposit status:', depErr);
      }

      // Increment user balance and totalDeposit atomically or via updateUserBalance
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          saldo: increment(amount),
          totalDeposit: increment(amount)
        });
      } catch (usrErr) {
        console.warn('Notice updating user balance in firestore, using context fallback:', usrErr);
        await updateUserBalance(user.uid, amount);
      }

      setPaymentSuccess(true);
      showToast(`Deposit ${formatRupiah(amount)} berhasil masuk ke saldo Anda!`, 'success');
    } catch (err: any) {
      console.warn('Payment completion notice:', err);
      await updateUserBalance(user.uid, amount);
      setPaymentSuccess(true);
      showToast(`Deposit ${formatRupiah(amount)} berhasil masuk ke saldo Anda!`, 'success');
    }
  };

  // Helper to extract transaction_id from activeDeposit, payload, or QR URL
  const getDepositTxId = (dep: any): string => {
    if (dep?.transactionId) return dep.transactionId;
    if (dep?.transaction_id) return dep.transaction_id;
    const qr = dep?.qrUrl || dep?.qrisUrl || dep?.qrisImage || '';
    const match = String(qr).match(/\/qris\/([A-Za-z0-9_-]+)/);
    if (match && match[1]) return match[1].replace('.png', '');
    return '';
  };

  // 1. DEPOSIT MASUK OTOMATIS: Real-time Firestore snapshot listener
  useEffect(() => {
    if (!activeDeposit || paymentSuccess) return;

    const depDocRef = doc(db, 'deposits', activeDeposit.invoice);
    const unsub = onSnapshot(depDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'paid' && !paymentSuccess) {
          completePayment(activeDeposit.invoice, activeDeposit.nominal);
        }
      }
    }, (err) => {
      console.warn('Deposit realtime listener notice:', err);
    });

    return () => unsub();
  }, [activeDeposit, paymentSuccess]);

  // 2. DEPOSIT MASUK OTOMATIS: Background auto-polling check every 3 seconds (Backend + Direct BuatQRIS API)
  useEffect(() => {
    if (!activeDeposit || paymentSuccess) return;

    const txId = getDepositTxId(activeDeposit);

    const checkPayment = async () => {
      let isPaid = false;

      // A. Cek via backend Vercel
      try {
        const res = await fetch('/api/check-qris', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Endpoint': 'check-qris' },
          body: JSON.stringify({
            invoice: activeDeposit.invoice,
            transactionId: txId,
            qrUrl: activeDeposit.qrUrl || activeDeposit.qrisImage,
            __endpoint: 'check-qris'
          })
        });
        const text = await res.text();
        const data = JSON.parse(text);
        if (data && (data.payment_status === 'paid' || data.status === 'paid')) {
          isPaid = true;
        }
      } catch {}

      // B. Cek langsung ke BuatQRIS API (fallback tanpa ketergantungan serverless)
      if (!isPaid && txId) {
        try {
          const accountId = (settings.bqAccountId || 'user_6abf79a7a4eb20.34050239').trim();
          const secretToken = (settings.bqSecretToken || 'sk_live_106d5dea5067b91f16a3bbdeaaba51146a3d686718ae81650db0b9c1ac2a7fa3').trim();
          if (accountId && secretToken) {
            const formData = new URLSearchParams();
            formData.append('action', 'api_check_status');
            formData.append('account_id', accountId);
            formData.append('secret_token', secretToken);
            formData.append('transaction_id', txId);

            const directRes = await fetch('https://api.buatqris.site', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: formData.toString()
            });
            const dj: any = await directRes.json();
            const st = String(dj?.status || dj?.data?.status || dj?.payment_status || '').toLowerCase();
            if (st === 'success' || st === 'paid' || st === 'settlement' || st === 'berhasil') {
              isPaid = true;
            }
          }
        } catch {}
      }

      if (isPaid && !paymentSuccess && !hasCompletedRef.current) {
        completePayment(activeDeposit.invoice, activeDeposit.nominal);
      }
    };

    // Jalankan segera saat pertama kali dimuat
    checkPayment();

    const interval = setInterval(checkPayment, 3000);
    return () => clearInterval(interval);
  }, [activeDeposit, paymentSuccess, settings]);

  // Handle Download QR image
  const handleDownloadQR = async () => {
    if (!activeDeposit) return;
    const qrSrc = activeDeposit.qrUrl || activeDeposit.qrisImage;
    if (!qrSrc) return;

    try {
      if (qrSrc.startsWith('data:image')) {
        const link = document.createElement('a');
        link.href = qrSrc;
        link.download = `QRIS-AZPREM-${activeDeposit.invoice}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Gambar QRIS berhasil diunduh ke galeri', 'success');
        return;
      }
      const response = await fetch(qrSrc);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `QRIS-AZPREM-${activeDeposit.invoice}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      showToast('Gambar QRIS berhasil diunduh ke galeri', 'success');
    } catch {
      window.open(qrSrc, '_blank');
      showToast('Membuka gambar QRIS untuk disimpan', 'info');
    }
  };

  // Handle Create QRIS
  const handleCreateQRIS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (!isDepositActive) {
      showToast('Layanan deposit sedang ditutup sementara oleh Admin', 'error');
      return;
    }

    if (nominal < minDeposit) {
      showToast(`Nominal deposit minimal ${formatRupiah(minDeposit)}`, 'error');
      return;
    }

    if (nominal > maxDeposit) {
      showToast(`Nominal deposit maksimal ${formatRupiah(maxDeposit)}`, 'error');
      return;
    }

    setLoading(true);
    hasCompletedRef.current = false;

    try {
      const invoice = `AZP-DEP-${Date.now()}`;
      let payload: any = null;

      // 1. Coba panggil serverless backend /api/create-qris
      try {
        const res = await fetch('/api/create-qris', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: nominal,
            invoice,
            userEmail: user.email || ''
          })
        });

        if (res.ok) {
          const textRes = await res.text();
          try {
            const data = JSON.parse(textRes);
            if (data.status || data.success) {
              payload = data.data || data;
            }
          } catch {}
        }
      } catch (err) {
        console.warn('Backend call notice, falling back to direct gateway:', err);
      }

      // 2. Jika backend Vercel tidak mengembalikan JSON, panggil langsung API BuatQRIS (CORS didukung penuh)
      if (!payload) {
        const accountId = (settings.bqAccountId || 'user_6abf79a7a4eb20.34050239').trim();
        const secretToken = (settings.bqSecretToken || 'sk_live_106d5dea5067b91f16a3bbdeaaba51146a3d686718ae81650db0b9c1ac2a7fa3').trim();
        const umkmName = (settings.bqUmkmName || 'AZPREM STORE').trim();

        if (accountId && secretToken) {
          const formData = new URLSearchParams();
          formData.append('action', 'api_create_qris');
          formData.append('account_id', accountId);
          formData.append('secret_token', secretToken);
          formData.append('amount', String(nominal));
          formData.append('description', invoice);
          formData.append('qris_method', 'qris_two');
          formData.append('fee_by', 'merchant');
          formData.append('umkm_name', umkmName);

          const directRes = await fetch('https://api.buatqris.site', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
          });

          const directJson: any = await directRes.json();
          if (directJson && (directJson.success || directJson.status === 'success') && directJson.data) {
            const d = directJson.data;
            const uniqueCode = Number(d.unique_code || d.amount_uniq || 0);
            const totalPayment = Number(d.total_amount || (nominal + uniqueCode));
            const qrUrl = d.qr_url || d.qris_image;
            const qrisImage = d.qris_image || qrUrl;

            payload = {
              invoice,
              transaction_id: d.transaction_id,
              amount: nominal,
              fee: 0,
              unique_code: uniqueCode,
              total_payment: totalPayment,
              qr_url: qrUrl,
              qris_image: qrisImage,
              expired_at: d.expired_at || new Date(Date.now() + 30 * 60 * 1000).toISOString()
            };
          } else {
            showToast(directJson?.message || 'Gagal membuat QRIS dari API BuatQRIS', 'error');
            return;
          }
        } else {
          showToast('Gateway QRIS belum dikonfigurasi di Admin Panel', 'error');
          return;
        }
      }

      if (payload) {
        const qrUrl = payload.qr_url || payload.qris_url || payload.qris_image;
        const qrisImage = payload.qris_image || payload.qr_url;
        const uniqueCode = Number(payload.unique_code || payload.uniqueCode || 0);
        // Fee dihapus: HANYA deposit + kode unik
        const totalPayment = Number(payload.total_payment || (nominal + uniqueCode));
        const txId = payload.transaction_id || getDepositTxId(payload);

        const depositDoc = {
          depositId: invoice,
          invoice,
          transactionId: txId,
          userId: user.uid,
          userEmail: user.email || '',
          nominal,
          fee: 0,
          uniqueCode,
          totalPayment,
          qrUrl,
          qrisImage,
          qrisUrl: qrUrl,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        try {
          await setDoc(doc(db, 'deposits', invoice), depositDoc);
        } catch (dbErr) {
          console.warn('Notice saving deposit document:', dbErr);
        }

        const expiresAtTimestamp = Date.now() + 30 * 60 * 1000;
        const newDeposit = {
          depositId: invoice,
          invoice,
          transactionId: txId,
          nominal,
          uniqueCode,
          totalPayment,
          qrUrl,
          qrisImage,
          expiredAt: payload.expired_at || new Date(expiresAtTimestamp).toISOString(),
          expiresAtTimestamp
        };

        try {
          localStorage.setItem('AZPREM_ACTIVE_DEPOSIT', JSON.stringify(newDeposit));
        } catch (err) {
          console.warn('Notice saving active deposit to localStorage:', err);
        }

        setActiveDeposit(newDeposit);
        setTimeLeft(30 * 60);
        setPaymentSuccess(false);
        showToast('QRIS berhasil dibuat. Silakan scan pembayaran.', 'success');
      } else {
        showToast('Gagal membuat QRIS', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem QRIS', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Manual Check QRIS Status with direct fallback
  const handleCheckStatus = async () => {
    if (!activeDeposit) return;
    setCheckingStatus(true);
    const txId = getDepositTxId(activeDeposit);

    try {
      let isPaid = false;

      // 1. Cek via backend
      try {
        const res = await fetch('/api/check-qris', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Endpoint': 'check-qris' },
          body: JSON.stringify({
            invoice: activeDeposit.invoice,
            transactionId: txId,
            qrUrl: activeDeposit.qrUrl || activeDeposit.qrisImage,
            __endpoint: 'check-qris'
          })
        });
        const text = await res.text();
        const data = JSON.parse(text);
        if (data && (data.payment_status === 'paid' || data.status === 'paid')) {
          isPaid = true;
        }
      } catch {}

      // 2. Fallback cek langsung ke BuatQRIS API
      if (!isPaid && txId) {
        const accountId = (settings.bqAccountId || 'user_6abf79a7a4eb20.34050239').trim();
        const secretToken = (settings.bqSecretToken || 'sk_live_106d5dea5067b91f16a3bbdeaaba51146a3d686718ae81650db0b9c1ac2a7fa3').trim();
        if (accountId && secretToken) {
          const formData = new URLSearchParams();
          formData.append('action', 'api_check_status');
          formData.append('account_id', accountId);
          formData.append('secret_token', secretToken);
          formData.append('transaction_id', txId);

          const directRes = await fetch('https://api.buatqris.site', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
          });
          const dj: any = await directRes.json();
          const st = String(dj?.status || dj?.data?.status || dj?.payment_status || '').toLowerCase();
          if (st === 'success' || st === 'paid' || st === 'settlement' || st === 'berhasil') {
            isPaid = true;
          }
        }
      }

      if (isPaid) {
        await completePayment(activeDeposit.invoice, activeDeposit.nominal);
      } else {
        showToast('Pembayaran belum terdeteksi. Sistem mengecek otomatis setiap saat...', 'info');
      }
    } catch (err: any) {
      showToast('Gagal memeriksa status pembayaran', 'error');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} disalin ke clipboard`, 'info');
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-4 space-y-4">
      {/* Header without Left Arrow */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Deposit Saldo
          </h2>
          <p className="text-xs text-slate-500">QRIS Instan Otomatis 24 Jam</p>
        </div>
      </div>

      {/* Notice if Deposit Closed by Admin */}
      {!isDepositActive && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-3.5 flex items-center gap-2.5 text-xs font-bold">
          <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
          <span>Layanan Deposit sedang Ditutup Sementara oleh Admin.</span>
        </div>
      )}

      {/* Saldo Saat Ini */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Saldo Saat Ini
            </span>
            <span className="text-lg font-black text-slate-900">
              {formatRupiah(profile?.saldo || 0)}
            </span>
          </div>
        </div>
        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
          Aktif
        </span>
      </div>

      {/* ACTIVE QRIS DISPLAY MODAL/CARD */}
      {activeDeposit && !paymentSuccess ? (
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-lg space-y-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest block">
                QRIS Pembayaran
              </span>
              <h3 className="text-base font-black text-slate-900">
                {activeDeposit.invoice}
              </h3>
            </div>
            {isExpired ? (
              <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full font-mono text-xs font-bold border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>GAGAL (WAKTU HABIS)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full font-mono text-xs font-bold border border-rose-100">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatSeconds(timeLeft)}</span>
              </div>
            )}
          </div>

          {/* QR Render Element: Real API QRIS with Official QRIS Look */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-full max-w-[280px]">
              <div
                id="qrBox"
                className={`w-full mx-auto p-4 bg-white border-2 rounded-3xl shadow-xl flex flex-col items-center justify-center transition-all ${
                  isExpired
                    ? 'border-rose-300 opacity-40 filter grayscale-[40%]'
                    : 'border-orange-200/90'
                }`}
              >
                {/* Official QRIS Header */}
                <div className="w-full flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                  <span className="text-[12px] font-black tracking-wider text-rose-600">QRIS</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">PEMBAYARAN NASIONAL</span>
                </div>

                <img
                  src={activeDeposit.qrUrl || activeDeposit.qrisImage}
                  alt="QRIS Pembayaran Resmi"
                  className="w-full h-auto max-h-[300px] object-contain rounded-xl block mx-auto"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.onerror = null;
                    if (activeDeposit.qrisImage) {
                      target.src = activeDeposit.qrisImage;
                    }
                  }}
                />

                {/* Download QR Button */}
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  disabled={isExpired}
                  className={`mt-3.5 w-full py-2.5 px-3 rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all ${
                    isExpired
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-95 cursor-pointer'
                  }`}
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Download Gambar QR</span>
                </button>
              </div>

              {/* Expired Overlay */}
              {isExpired && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] rounded-3xl flex flex-col items-center justify-center p-5 text-center text-white space-y-2.5 z-10 shadow-2xl animate-in fade-in zoom-in-95">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/40">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <span className="font-black text-sm uppercase tracking-wider text-rose-200">
                    QRIS Gagal (Waktu Habis)
                  </span>
                  <p className="text-[11px] text-slate-200 leading-relaxed max-w-[210px]">
                    Batas waktu pembayaran 30 menit telah berakhir tanpa transfer. Transaksi deposit ini dianggap gagal.
                  </p>
                  <button
                    onClick={() => {
                      setActiveDeposit(null);
                      setIsExpired(false);
                      setPaymentSuccess(false);
                      setTimeLeft(30 * 60);
                      try {
                        localStorage.removeItem('AZPREM_ACTIVE_DEPOSIT');
                      } catch {}
                    }}
                    className="mt-1 px-4 py-2 bg-white text-slate-900 font-black text-xs rounded-xl shadow hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                  >
                    Buat Deposit Baru
                  </button>
                </div>
              )}
            </div>

            <span className={`text-[11px] font-semibold mt-2.5 text-center ${isExpired ? 'text-rose-600' : 'text-slate-500'}`}>
              {isExpired
                ? 'Pembayaran ditutup otomatis karena melewati batas waktu 30 menit.'
                : 'Scan dengan DANA, GoPay, OVO, ShopeePay, BCA, atau Mobile Banking apa saja'}
            </span>
          </div>

          {/* Payment Detail: HANYA Deposit + Kode Unik (Fee Dihapus Sesuai Permintaan) */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5 text-xs border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
              <span className="text-slate-500 font-medium">Nomor Invoice:</span>
              <button
                onClick={() => handleCopy(activeDeposit.invoice, 'Nomor Invoice')}
                className="font-mono font-bold text-slate-800 flex items-center gap-1 hover:text-orange-600 cursor-pointer"
              >
                <span>{activeDeposit.invoice}</span>
                <Copy className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600">Nominal Deposit:</span>
              <span className="font-bold text-slate-800">
                {formatRupiah(activeDeposit.nominal)}
              </span>
            </div>

            {Boolean(activeDeposit.uniqueCode) && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Kode Unik:</span>
                <span className="font-mono font-bold text-orange-600">
                  +{activeDeposit.uniqueCode}
                </span>
              </div>
            )}

            <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-900 block">Total yang Harus Dibayar:</span>
                <span className="text-[10px] text-orange-600 font-bold">Wajib pas hingga digit terakhir</span>
              </div>
              <div className="text-right flex items-center gap-1.5">
                <span className="text-lg font-black text-orange-600 font-mono tracking-tight">
                  {formatRupiah(activeDeposit.totalPayment)}
                </span>
                <button
                  onClick={() => handleCopy(String(activeDeposit.totalPayment), 'Total Transfer')}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                  title="Salin Total Pembayaran"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
              <span className="text-slate-500 font-medium">Status:</span>
              {isExpired ? (
                <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  <span>Gagal (Waktu Habis)</span>
                </span>
              ) : (
                <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>Menunggu Pembayaran</span>
                </span>
              )}
            </div>
          </div>

          {/* Important transfer notice */}
          {isExpired ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-[11px] text-rose-900 font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                QRIS ini sudah <strong>Kadaluwarsa</strong>. Jangan melakukan pembayaran ke QRIS ini lagi. Silakan klik tombol di bawah untuk membuat deposit baru.
              </span>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Transfer tepat <strong>{formatRupiah(activeDeposit.totalPayment)}</strong>. Setelah scan & bayar, saldo Anda akan <strong>langsung masuk otomatis</strong> ke akun dalam beberapa detik tanpa perlu klik apapun!
              </span>
            </div>
          )}

          {/* Action button: Tombol Cek Status atau Buat Deposit Baru jika Kadaluwarsa */}
          <div className="space-y-2">
            {isExpired ? (
              <button
                onClick={() => {
                  setActiveDeposit(null);
                  setIsExpired(false);
                  setPaymentSuccess(false);
                  setTimeLeft(30 * 60);
                  try {
                    localStorage.removeItem('AZPREM_ACTIVE_DEPOSIT');
                  } catch {}
                }}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-black text-sm shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Buat Deposit Baru</span>
              </button>
            ) : (
              <button
                onClick={handleCheckStatus}
                disabled={checkingStatus}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-sm shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 hover:from-orange-600 hover:to-amber-600 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
                <span>{checkingStatus ? 'Mengecek...' : 'Cek Status Pembayaran'}</span>
              </button>
            )}
          </div>
        </div>
      ) : paymentSuccess ? (
        /* SUCCESS DISPLAY */
        <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900">Deposit Berhasil!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Saldo akun AZPREM Anda telah bertambah secara otomatis.
            </p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 space-y-1">
            <div className="text-xs text-emerald-700 font-semibold">Total Masuk</div>
            <div className="text-2xl font-black text-emerald-900">
              {formatRupiah(activeDeposit?.nominal || nominal)}
            </div>
            <div className="text-[11px] text-emerald-600 font-mono mt-1">
              Invoice: {activeDeposit?.invoice}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveDeposit(null);
                setPaymentSuccess(false);
                hasCompletedRef.current = false;
              }}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Deposit Lagi
            </button>
            <button
              onClick={onGoToHistory}
              className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
            >
              Lihat Riwayat
            </button>
          </div>
        </div>
      ) : (
        /* CREATE DEPOSIT FORM */
        <form onSubmit={handleCreateQRIS} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Masukkan Nominal (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400">
                Rp
              </span>
              <input
                type="text"
                required
                disabled={!isDepositActive}
                value={inputVal ? parseInt(inputVal, 10).toLocaleString('id-ID') : ''}
                onChange={(e) => handleNominalChange(e.target.value)}
                placeholder="1.000"
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base sm:text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all disabled:opacity-50"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-1 font-semibold">
              <span>Min: {formatRupiah(minDeposit)}</span>
              <span>Max: {formatRupiah(maxDeposit)}</span>
            </div>
          </div>

          {/* Quick Nominal Selectors with 1k (Rp1.000) option */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Pilihan Cepat
            </label>
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={!isDepositActive}
                  onClick={() => handleSelectQuick(amt)}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all border disabled:opacity-50 cursor-pointer ${
                    nominal === amt
                      ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-orange-300'
                  }`}
                >
                  {formatRupiah(amt)}
                </button>
              ))}
            </div>
          </div>

          {/* Guidelines with 30-minute validity */}
          <div className="bg-orange-50/60 rounded-2xl p-3.5 border border-orange-100 text-xs text-orange-900 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-orange-600 shrink-0" />
              <span>Instruksi Pembayaran:</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-orange-800/90 space-y-0.5 pl-1">
              <li>QRIS aktif selama 30 menit dari API setelah dibuat.</li>
              <li>Scan kode menggunakan e-wallet / mobile banking apa saja.</li>
              <li>Saldo akan langsung masuk secara otomatis.</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading || !isDepositActive}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm rounded-2xl shadow-md shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <QrCode className="w-4 h-4" />
                <span>Bayar Sekarang ({formatRupiah(nominal)})</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};
