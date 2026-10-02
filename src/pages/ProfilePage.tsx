import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatRupiah, formatDate } from '../utils/constants';
import { 
  User, 
  Wallet, 
  ShieldCheck, 
  Key, 
  LogOut, 
  Copy, 
  Check, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { db, doc, updateDoc } from '../firebase';

interface ProfilePageProps {
  onGoToDeposit: () => void;
  onGoToReferral: () => void;
  onGoToAdmin: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onGoToDeposit,
  onGoToAdmin
}) => {
  const { user, profile, isAdmin, logout, resetPassword, showToast, setAuthModalOpen } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(profile?.nama || '');
  const [savingName, setSavingName] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleUpdateName = async () => {
    if (!user || !newName.trim()) return;
    setSavingName(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        nama: newName.trim()
      });
      setEditingName(false);
      showToast('Nama profil berhasil diubah', 'success');
    } catch (err: any) {
      showToast('Gagal mengubah nama', 'error');
    } finally {
      setSavingName(false);
    }
  };

  const handleResetPass = async () => {
    if (!user?.email) return;
    try {
      await resetPassword(user.email);
    } catch {
      // toast shown in context
    }
  };

  const copyCode = () => {
    if (!profile?.referralCode) return;
    navigator.clipboard.writeText(profile.referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    showToast('Kode referral disalin', 'info');
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 pb-24 pt-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto shadow-md">
          <User className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-900">Belum Masuk Akun</h3>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          Masuk atau buat akun baru untuk mengakses saldo, riwayat transaksi, dan fitur eksklusif AZPREM.
        </p>
        <button
          onClick={() => setAuthModalOpen(true)}
          className="w-full max-w-xs mx-auto py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-sm rounded-2xl shadow-md active:scale-95 transition-all cursor-pointer"
        >
          Masuk / Daftar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-4 space-y-4">
      {/* Header without Left Arrow */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Akun & Profil
          </h2>
          <p className="text-xs text-slate-500">Kelola informasi akun Anda</p>
        </div>
      </div>

      {/* User Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white flex items-center justify-center font-black text-xl shadow-md">
            {(profile?.nama || user.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 w-full"
                />
                <button
                  onClick={handleUpdateName}
                  disabled={savingName}
                  className="px-2.5 py-1 bg-orange-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 truncate">
                    {profile?.nama || user.displayName || 'Pengguna'}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    setNewName(profile?.nama || '');
                    setEditingName(true);
                  }}
                  className="text-[11px] font-bold text-orange-600 hover:underline cursor-pointer"
                >
                  Ubah
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                Status: {profile?.statusAkun || 'Aktif'}
              </span>
              {isAdmin && (
                <span className="text-[10px] font-extrabold bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3" /> Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Saldo Snapshot */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Saldo Tersedia
            </span>
            <span className="text-lg font-black text-orange-600">
              {formatRupiah(profile?.saldo || 0)}
            </span>
          </div>
          <button
            onClick={onGoToDeposit}
            className="px-3.5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs rounded-xl shadow-sm hover:from-orange-600 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Deposit</span>
          </button>
        </div>
      </div>

      {/* Account Info Details */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md space-y-3">
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
          Detail Akun
        </h4>
        <div className="divide-y divide-slate-100 text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-500">Kode Referral</span>
            <button
              onClick={copyCode}
              className="font-mono font-bold text-orange-600 flex items-center gap-1.5 hover:opacity-80 cursor-pointer"
            >
              <span>{profile?.referralCode || '-'}</span>
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-500">Bonus Referral</span>
            <span className="font-bold text-slate-800">
              {formatRupiah(profile?.bonusReferral || 0)}
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-500">Total Order</span>
            <span className="font-bold text-slate-800">
              {profile?.totalOrder || 0} Transaksi
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-500">Total Deposit</span>
            <span className="font-bold text-slate-800">
              {formatRupiah(profile?.totalDeposit || 0)}
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-slate-500">Tanggal Daftar</span>
            <span className="font-medium text-slate-700">
              {formatDate(profile?.createdAt || profile?.tanggalDaftar)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions & Settings */}
      <div className="bg-white rounded-3xl p-2 border border-slate-100 shadow-md space-y-1">
        {isAdmin && (
          <button
            onClick={onGoToAdmin}
            className="w-full flex items-center justify-between p-3 rounded-2xl text-left hover:bg-orange-50 text-orange-700 font-bold text-xs transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div>Admin Panel</div>
                <div className="text-[10px] text-orange-500 font-normal">
                  Kelola pengguna, order, deposit, dan pengaturan
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-orange-400" />
          </button>
        )}
        <button
          onClick={handleResetPass}
          className="w-full flex items-center justify-between p-3 rounded-2xl text-left hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <span>Reset Password Akun</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
        <a
          href="https://www.azryl.my.id/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between p-3 rounded-2xl text-left hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <ExternalLink className="w-4 h-4" />
            </div>
            <span>Kunjungi Website Resmi (azryl.my.id)</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </a>
      </div>

      {/* Logout Button */}
      <button
        onClick={logout}
        className="w-full py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-xs rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        <span>Keluar dari Akun</span>
      </button>
    </div>
  );
};
