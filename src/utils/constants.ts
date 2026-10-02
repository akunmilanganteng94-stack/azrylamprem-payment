import { AppSettings } from '../types';

export const ALIGHT_MOTION_IMAGE = "https://cdn.phototourl.com/member/2026-10-02-34487271-8084-48b6-b4d6-0450392c6a56.png";

export const DEFAULT_SETTINGS: AppSettings = {
  websiteName: "AZPREM",
  bannerTitle: "Selamat Datang di AZPREM!",
  bannerSubtitle: "Order Alight Motion Premium dengan cepat, aman, dan praktis.",
  currentRate: 3500,
  amVerifPrice: 600,
  amBulkPrice: 500,
  amVerifActive: true,
  amBulkActive: true,
  isStoreOpen: true,
  depositActive: true,
  minDeposit: 1000,
  maxDeposit: 100000,
  referralBonusPercent: 5,
  referralTargetFriends: 20,
  referralTargetReward: 10000,
  productImageUrl: ALIGHT_MOTION_IMAGE,
  jobGmailText: "Kirim email Gmail yang sudah siap. Dapatkan imbalan langsung setelah verifikasi tim AZPREM.",
  customStats: {
    useManualStats: false,
    totalUsers: 150,
    totalOrders: 420,
    totalDeposits: 5200000
  },
  caraKerjaSteps: [
    { step: 1, title: "Daftar / Login", desc: "Buat akun atau masuk menggunakan email terdaftar Anda." },
    { step: 2, title: "Deposit Saldo", desc: "Isi saldo mulai dari Rp1.000 via QRIS otomatis 24 jam." },
    { step: 3, title: "Pilih Order AM", desc: "Buka menu Order untuk memilih layanan Alight Motion." },
    { step: 4, title: "Pilih Tipe Produk", desc: "Pilih opsi AM Verif (Rp600) atau AM Bulk (Rp500/akun)." },
    { step: 5, title: "Lakukan Proses", desc: "Kirim link verifikasi untuk AM Verif atau pilih jumlah akun untuk AM Bulk." },
    { step: 6, title: "Tunggu Hasil", desc: "Sistem memproses secara otomatis dalam hitungan detik." },
    { step: 7, title: "Lihat Riwayat", desc: "Cek detail pesanan dan akun Alight Motion di tab Riwayat." }
  ]
};

export const ADMIN_EMAILS = [
  'apriliansyahazril10@gmail.com',
  'admin@azprem.com'
];

export function formatRupiah(amount: any): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(isNaN(num) ? 0 : num);
}

export function formatDate(dateVal?: any): string {
  if (!dateVal) return '-';
  try {
    let d: Date;
    if (typeof dateVal === 'object' && dateVal !== null) {
      if (typeof dateVal.toDate === 'function') {
        d = dateVal.toDate();
      } else if ('seconds' in dateVal) {
        d = new Date(Number(dateVal.seconds) * 1000);
      } else if (dateVal instanceof Date) {
        d = dateVal;
      } else {
        d = new Date(String(dateVal));
      }
    } else if (typeof dateVal === 'number') {
      d = new Date(dateVal);
    } else {
      d = new Date(String(dateVal));
    }

    if (isNaN(d.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return '-';
  }
}
