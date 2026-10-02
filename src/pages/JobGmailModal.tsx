import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Mail, CheckCircle2, Send, Info, AlertCircle } from 'lucide-react';
import { db, collection, addDoc } from '../firebase';

interface JobGmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToChat: () => void;
}

export const JobGmailModal: React.FC<JobGmailModalProps> = ({
  isOpen,
  onClose,
  onGoToChat
}) => {
  const { user, profile, showToast, setAuthModalOpen } = useAuth();
  
  const [gmailAddress, setGmailAddress] = useState('');
  const [gmailPassword, setGmailPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (!gmailAddress.includes('@gmail.com')) {
      showToast('Harap masukkan alamat Gmail yang valid', 'error');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'job_gmail_submissions'), {
        userId: user.uid,
        userName: profile?.nama || user.displayName || 'User',
        userEmail: user.email || '',
        gmailAddress: gmailAddress.trim(),
        gmailPassword: gmailPassword.trim(),
        recoveryEmail: recoveryEmail.trim(),
        notes: notes.trim(),
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setSubmitted(true);
      showToast('Job Gmail berhasil dikirim untuk diverifikasi!', 'success');
    } catch (err: any) {
      showToast('Gagal mengirim Job Gmail', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" />

      <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 z-10 border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 font-bold shadow-sm">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900">Job Gmail AZPREM</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Kirim akun Gmail baru/segar untuk reward saldo
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-3 py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-slate-900">Data Terkirim!</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tim AZPREM akan memverifikasi akun Anda. Saldo reward akan langsung ditambahkan ke akun setelah disetujui.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setGmailAddress('');
                setGmailPassword('');
                setRecoveryEmail('');
                setNotes('');
                onClose();
              }}
              className="w-full py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow"
            >
              Selesai
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitJob} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Alamat Gmail
              </label>
              <input
                type="email"
                required
                value={gmailAddress}
                onChange={(e) => setGmailAddress(e.target.value)}
                placeholder="nama@gmail.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Password Gmail
              </label>
              <input
                type="text"
                required
                value={gmailPassword}
                onChange={(e) => setGmailPassword(e.target.value)}
                placeholder="Password email"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Email Pemulihan (Opsional)
              </label>
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="opsional@email.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Catatan Tambahan
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Fresh dibuat hari ini"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 text-[11px] text-emerald-800 space-y-0.5">
              <div className="font-bold flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                <span>Ketentuan:</span>
              </div>
              <p>Akun harus aktif, tidak terkena checkpoint/verifikasi nomor telepon ganda.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Kirim Job Gmail</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
