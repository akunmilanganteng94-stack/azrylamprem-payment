import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  UserCheck, 
  Wallet, 
  Zap, 
  Sliders, 
  Send, 
  Clock, 
  ClipboardList, 
  HelpCircle,
  Sparkles
} from 'lucide-react';

interface CaraKerjaPageProps {
  onGoToOrder: () => void;
}

export const CaraKerjaPage: React.FC<CaraKerjaPageProps> = ({ onGoToOrder }) => {
  const { settings } = useAuth();

  const stepIcons = [
    UserCheck,
    Wallet,
    Zap,
    Sliders,
    Send,
    Clock,
    ClipboardList
  ];

  const steps = settings.caraKerjaSteps || [
    { step: 1, title: 'Daftar / Login', desc: 'Buat akun AZPREM atau masuk menggunakan email Gmail terdaftar.' },
    { step: 2, title: 'Deposit Saldo', desc: 'Isi saldo akun minimal Rp1.000 via scan QRIS otomatis 24 jam.' },
    { step: 3, title: 'Pilih Order AM', desc: 'Buka menu Order untuk memilih layanan Alight Motion Premium.' },
    { step: 4, title: 'Pilih AM Verif / AM Bulk', desc: 'Pilih AM Verif (Rp600) untuk akun sendiri atau AM Bulk (Rp500) untuk banyak akun.' },
    { step: 5, title: 'Lakukan Proses', desc: 'Kirim link verifikasi untuk AM Verif, atau tentukan jumlah akun untuk AM Bulk.' },
    { step: 6, title: 'Tunggu Hasil', desc: 'Sistem cloud otomatis memproses transaksi dalam hitungan detik.' },
    { step: 7, title: 'Lihat Riwayat', desc: 'Cek detail akun dan status transaksi yang sudah berhasil di menu Riwayat.' }
  ];

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-4 space-y-4">
      {/* Header without Left Arrow */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Cara Kerja
          </h2>
          <p className="text-xs text-slate-500">Panduan mudah order di AZPREM</p>
        </div>
      </div>

      {/* Intro banner */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-100 mb-1">
          <Sparkles className="w-4 h-4 text-amber-200" />
          <span>Langkah Praktis & Cepat</span>
        </div>
        <h3 className="text-base font-black">7 Langkah Mudah Alight Motion Premium</h3>
        <p className="text-xs text-white/90 mt-1">
          Ikuti panduan berikut agar pesanan Anda diproses secepat kilat tanpa kendala.
        </p>
      </div>

      {/* Steps List */}
      <div className="space-y-3">
        {steps.map((item, index) => {
          const Icon = stepIcons[index % stepIcons.length] || HelpCircle;
          return (
            <div
              key={item.step}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-start gap-3.5"
            >
              <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-black text-sm shrink-0 border border-orange-100">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                    Langkah {item.step}
                  </span>
                  <h4 className="text-sm font-black text-slate-900 truncate">
                    {item.title}
                  </h4>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action CTA */}
      <div className="pt-2">
        <button
          onClick={onGoToOrder}
          className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black text-sm shadow-md shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          <span>Mulai Order Sekarang</span>
        </button>
      </div>
    </div>
  );
};
