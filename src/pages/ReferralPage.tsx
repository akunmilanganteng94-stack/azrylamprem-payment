import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatRupiah, formatDate } from '../utils/constants';
import { 
  Users, 
  Copy, 
  Gift, 
  Check, 
  Clock, 
  CheckCircle2 
} from 'lucide-react';
import { db, collection, query, where, onSnapshot } from '../firebase';
import { UserProfile } from '../types';

export const ReferralPage: React.FC = () => {
  const { user, profile, settings, showToast, setAuthModalOpen } = useAuth();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [referredUsers, setReferredUsers] = useState<UserProfile[]>([]);

  const referralCode = profile?.referralCode || 'AZP-DEMO';
  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/?ref=${referralCode}` 
    : `https://www.azryl.my.id/?ref=${referralCode}`;

  const targetFriends = settings.referralTargetFriends || 20;
  const targetReward = settings.referralTargetReward || 10000;
  const bonusPercent = settings.referralBonusPercent || 5;

  // Fetch list of users registered using this user's referral code in real-time
  useEffect(() => {
    if (!profile?.referralCode) return;
    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', profile.referralCode)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach(docSnap => {
        list.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      });
      setReferredUsers(list);
    }, (err) => console.warn('Referral listener notice:', err));

    return () => unsub();
  }, [profile?.referralCode]);

  // Valid referred friends are those who have ordered AM at least once
  const validReferredUsers = referredUsers.filter(u => u.hasOrderedAM || (u.totalOrder && u.totalOrder > 0));
  const validCount = validReferredUsers.length;
  const progressPercent = Math.min(100, Math.round((validCount / targetFriends) * 100));

  const copyToClipboard = (text: string, isLink: boolean) => {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
    showToast('Tersalin ke clipboard!', 'success');
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-4 space-y-4">
      {/* Header without Left Arrow */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Program Referral Nyata
          </h2>
          <p className="text-xs text-slate-500">Bonus Rp10.000 tiap 20 teman valid + {bonusPercent}% komisi</p>
        </div>
      </div>

      {/* Hero Reward Banner */}
      <div className="bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 rounded-3xl p-5 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase">
            <Gift className="w-3.5 h-3.5 text-amber-200" />
            <span>Target: {formatRupiah(targetReward)} / {targetFriends} Teman</span>
          </div>

          <div>
            <h3 className="text-xl font-black tracking-tight">
              Ajak 20 Teman, Dapatkan Rp10.000!
            </h3>
            <p className="text-xs text-orange-100 mt-1 leading-relaxed">
              Teman wajib membeli produk Alight Motion minimal 1 kali agar terhitung <strong>Berhasil</strong>. Plus dapatkan komisi {bonusPercent}% setiap teman belanja!
            </p>
          </div>

          {/* Progress towards 20 Valid Friends */}
          <div className="bg-black/20 rounded-2xl p-3 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Progres Teman Valid:</span>
              <span>{validCount} / {targetFriends} Teman ({progressPercent}%)</span>
            </div>
            <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            {validCount >= targetFriends && (
              <span className="text-[11px] text-amber-200 font-extrabold flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Target Tercapai! Bonus Rp10.000 Telah Aktif!
              </span>
            )}
          </div>

          <div className="pt-2 grid grid-cols-2 gap-2 border-t border-white/20 text-center">
            <div className="bg-white/10 rounded-xl p-2">
              <span className="text-[10px] text-orange-100 font-semibold block">
                Total Terdaftar
              </span>
              <span className="text-base font-black">{referredUsers.length} Orang</span>
            </div>
            <div className="bg-white/10 rounded-xl p-2">
              <span className="text-[10px] text-orange-100 font-semibold block">
                Bonus Terkumpul
              </span>
              <span className="text-base font-black">
                {formatRupiah(profile?.bonusReferral || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Code & Link Box */}
      {!user ? (
        <div className="bg-white rounded-3xl p-6 text-center space-y-3 border border-slate-100 shadow-md">
          <Users className="w-10 h-10 text-orange-500 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">
            Masuk untuk mendapatkan kode referral Anda
          </h4>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="w-full py-2.5 bg-orange-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
          >
            Masuk / Daftar Akun
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Kode Referral Anda
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-mono text-base font-black text-orange-600 tracking-widest text-center">
                {referralCode}
              </div>
              <button
                onClick={() => copyToClipboard(referralCode, false)}
                className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
              >
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Disalin' : 'Salin'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Link Undangan
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 font-mono truncate"
              />
              <button
                onClick={() => copyToClipboard(referralLink, true)}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List of Referred Friends */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Riwayat Teman Terdaftar ({referredUsers.length})
          </h4>
          <span className="text-[10px] font-bold text-orange-600">
            {validCount} Berhasil Beli AM
          </span>
        </div>

        {referredUsers.length === 0 ? (
          <div className="text-center py-6 text-slate-400 space-y-1">
            <Users className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">Belum ada teman terdaftar</p>
            <p className="text-[11px] text-slate-400">
              Bagikan kode atau link referral Anda kepada teman untuk mulai mengumpulkan reward.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {referredUsers.map((refUser, idx) => {
              const hasOrdered = refUser.hasOrderedAM || (refUser.totalOrder && refUser.totalOrder > 0);
              return (
                <div key={refUser.uid || `ref-${idx}`} className="py-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${hasOrdered ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {(refUser.nama || 'U')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold text-slate-900 truncate">{refUser.nama}</h5>
                      <span className="text-[10px] text-slate-400 block truncate">
                        Terdaftar: {formatDate(refUser.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {hasOrdered ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Berhasil</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-500" />
                        <span>Belum Order</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
