export interface UserProfile {
  uid: string;
  nama: string;
  email: string;
  saldo: number;
  totalOrder: number;
  totalDeposit: number;
  referralCode: string;
  referredBy?: string | null;
  bonusReferral: number;
  tanggalDaftar?: string;
  statusAkun: 'aktif' | 'suspended';
  role: 'user' | 'admin';
  muteUntil?: number | null;
  createdAt?: string;
  hasOrderedAM?: boolean;
}

export interface BulkAccountItem {
  email: string;
  inboxUrl?: string;
}

export interface OrderItem {
  id?: string;
  orderId: string;
  userId: string;
  userEmail: string;
  productType: 'AM Verif' | 'AM Bulk';
  product: string;
  targetEmail?: string;
  count?: number;
  price: number;
  status: 'Berhasil' | 'Gagal' | 'Pending';
  response?: string;
  accounts?: BulkAccountItem[];
  createdAt: string;
}

export interface DepositItem {
  id?: string;
  depositId: string;
  userId: string;
  userEmail: string;
  nominal: number;
  fee?: number;
  uniqueCode?: number;
  totalPayment?: number;
  invoice: string;
  qrisUrl?: string;
  qrUrl?: string;
  qrisImage?: string;
  qrisContent?: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  createdAt: string;
  paidAt?: string;
  isSimulated?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'admin';
  text: string;
  createdAt: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'penting' | 'promo';
  isActive: boolean;
  createdAt: string;
}

export interface AppSettings {
  websiteName: string;
  bannerTitle: string;
  bannerSubtitle: string;
  currentRate: number;
  amVerifPrice: number;
  amBulkPrice: number;
  amVerifActive: boolean;
  amBulkActive: boolean;
  isStoreOpen: boolean;
  depositActive: boolean;
  minDeposit: number;
  maxDeposit: number;
  referralBonusPercent: number;
  referralTargetFriends: number;
  referralTargetReward: number;
  productImageUrl?: string;
  jobGmailText?: string;
  bqAccountId?: string;
  bqSecretToken?: string;
  bqUmkmName?: string;
  staticQrString?: string;
  customStats?: {
    useManualStats: boolean;
    totalUsers: number;
    totalOrders: number;
    totalDeposits: number;
  };
  caraKerjaSteps?: { step: number; title: string; desc: string }[];
}
