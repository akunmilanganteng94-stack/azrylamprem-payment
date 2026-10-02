import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatRupiah, formatDate } from '../utils/constants';
import { 
  ArrowLeft, 
  ShieldCheck, 
  LayoutDashboard, 
  Users, 
  ShoppingBag, 
  Wallet, 
  Settings, 
  Bell, 
  MessageSquare, 
  BarChart3, 
  Search, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Send, 
  Save, 
  AlertTriangle,
  Lock,
  Unlock,
  Package,
  Copy
} from 'lucide-react';
import { 
  db, 
  collection, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  increment
} from '../firebase';
import { UserProfile, OrderItem, DepositItem, AnnouncementItem, ChatMessage } from '../types';

interface AdminPanelProps {
  onBack: () => void;
}

type AdminTab = 
  | 'dashboard'
  | 'users'
  | 'orders'
  | 'deposits'
  | 'settings'
  | 'products'
  | 'announcements'
  | 'chats'
  | 'stats';

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const { user, isAdmin, settings, updateSettings, showToast } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Data states
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [ordersList, setOrdersList] = useState<OrderItem[]>([]);
  const [depositsList, setDepositsList] = useState<DepositItem[]>([]);
  const [announcementsList, setAnnouncementsList] = useState<AnnouncementItem[]>([]);
  const [chatRoomsList, setChatRoomsList] = useState<any[]>([]);

  // Selected chat room for admin reply
  const [selectedChatUser, setSelectedChatUser] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [adminReplyText, setAdminReplyText] = useState('');

  // Search queries
  const [searchUser, setSearchUser] = useState('');
  const [orderFilter, setOrderFilter] = useState<'All' | 'Berhasil' | 'Gagal' | 'Pending'>('All');
  const [depositFilter, setDepositFilter] = useState<'All' | 'paid' | 'pending' | 'failed'>('All');

  // Edit balance modal
  const [editingBalanceUser, setEditingBalanceUser] = useState<UserProfile | null>(null);
  const [balanceDelta, setBalanceDelta] = useState<string>('0');

  // Form states for settings
  const [formSettings, setFormSettings] = useState({ ...settings });
  const [testingBq, setTestingBq] = useState(false);
  const [bqTestResult, setBqTestResult] = useState<{ status: boolean; message: string } | null>(null);

  useEffect(() => {
    setFormSettings({ ...settings });
  }, [settings]);

  const handleTestBq = async () => {
    if (!formSettings.bqAccountId || !formSettings.bqSecretToken) {
      showToast('Harap masukkan Account ID dan Secret Token terlebih dahulu', 'error');
      return;
    }
    setTestingBq(true);
    setBqTestResult(null);
    try {
      const res = await fetch('/api/test-buatqris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: formSettings.bqAccountId,
          secretToken: formSettings.bqSecretToken
        })
      });
      const data = await res.json();
      setBqTestResult({ status: data.status, message: data.message });
      if (data.status) {
        showToast('Koneksi ke API BuatQRIS Berhasil! Akun valid.', 'success');
      } else {
        showToast(data.message || 'Kredensial tidak valid', 'error');
      }
    } catch {
      setBqTestResult({ status: false, message: 'Gagal menghubungi server API' });
      showToast('Gagal menghubungi API', 'error');
    } finally {
      setTestingBq(false);
    }
  };

  // New announcement form
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnType, setNewAnnType] = useState<'info' | 'penting' | 'promo'>('info');

  // Sync users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserProfile[] = [];
      snap.forEach(docSnap => {
        list.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      });
      setUsersList(list);
    }, (err) => console.warn('Admin users notice:', err));
    return () => unsub();
  }, []);

  // Sync orders
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: OrderItem[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as OrderItem);
      });
      setOrdersList(list);
    }, (err) => console.warn('Admin orders notice:', err));
    return () => unsub();
  }, []);

  // Sync deposits
  useEffect(() => {
    const q = query(collection(db, 'deposits'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: DepositItem[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DepositItem);
      });
      setDepositsList(list);
    }, (err) => console.warn('Admin deposits notice:', err));
    return () => unsub();
  }, []);

  // Sync announcements
  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: AnnouncementItem[] = [];
      snap.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id } as AnnouncementItem);
      });
      setAnnouncementsList(list);
    }, (err) => console.warn('Admin announcements notice:', err));
    return () => unsub();
  }, []);

  // Sync chat threads
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'chats'), (snap) => {
      const list: any[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setChatRoomsList(list);
    }, (err) => console.warn('Admin chats notice:', err));
    return () => unsub();
  }, []);

  // Sync selected chat messages
  useEffect(() => {
    if (!selectedChatUser) return;
    const q = query(collection(db, 'chats', selectedChatUser.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = [];
      snap.forEach(docSnap => {
        msgs.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
      });
      setChatMessages(msgs);
    }, (err) => console.warn('Admin chat thread notice:', err));
    return () => unsub();
  }, [selectedChatUser]);

  // Check admin authorization
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-900">Akses Ditolak</h3>
        <p className="text-xs text-slate-500">
          Anda tidak memiliki izin Administrator untuk mengakses halaman ini.
        </p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
        >
          Kembali
        </button>
      </div>
    );
  }

  // Dashboard Stats Calculations
  const totalUser = usersList.length;
  const totalOrder = ordersList.length;
  const orderBerhasil = ordersList.filter(o => o.status === 'Berhasil').length;
  const orderGagal = ordersList.filter(o => o.status === 'Gagal').length;
  const totalDepositAmount = depositsList
    .filter(d => d.status === 'paid')
    .reduce((acc, curr) => acc + (curr.nominal || 0), 0);
  const totalUserBalance = usersList.reduce((acc, curr) => acc + (curr.saldo || 0), 0);
  const activeUserCount = usersList.filter(u => u.statusAkun !== 'suspended').length;

  // Handle Edit Balance
  const handleSaveBalance = async () => {
    if (!editingBalanceUser) return;
    const delta = parseFloat(balanceDelta) || 0;
    try {
      const userRef = doc(db, 'users', editingBalanceUser.uid);
      await updateDoc(userRef, {
        saldo: increment(delta)
      });
      showToast(`Saldo ${editingBalanceUser.nama} berhasil diubah (${delta >= 0 ? '+' : ''}${formatRupiah(delta)})`, 'success');
      setEditingBalanceUser(null);
    } catch (err: any) {
      showToast('Gagal mengubah saldo', 'error');
    }
  };

  // Toggle user suspension
  const handleToggleSuspend = async (u: UserProfile) => {
    const newStatus = u.statusAkun === 'suspended' ? 'aktif' : 'suspended';
    try {
      await updateDoc(doc(db, 'users', u.uid), { statusAkun: newStatus });
      showToast(`Status user diubah menjadi: ${newStatus}`, 'success');
    } catch {
      showToast('Gagal memperbarui status user', 'error');
    }
  };

  // Toggle user mute
  const handleToggleMute = async (u: UserProfile) => {
    const isMuted = u.muteUntil && u.muteUntil > Date.now();
    const newMute = isMuted ? null : Date.now() + 30 * 60 * 1000;
    try {
      await updateDoc(doc(db, 'users', u.uid), { muteUntil: newMute });
      showToast(isMuted ? 'User berhasil di-unmute' : 'User dibisukan (mute) selama 30 menit', 'success');
    } catch {
      showToast('Gagal mengubah status mute', 'error');
    }
  };

  // Approve / Mark Paid deposit
  const handleApproveDeposit = async (dep: DepositItem) => {
    try {
      await updateDoc(doc(db, 'deposits', dep.depositId), {
        status: 'paid',
        paidAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'users', dep.userId), {
        saldo: increment(dep.nominal),
        totalDeposit: increment(dep.nominal)
      });
      showToast(`Deposit ${dep.invoice} berhasil disetujui & saldo ditambahkan!`, 'success');
    } catch {
      showToast('Gagal memproses persetujuan deposit', 'error');
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings(formSettings);
    } catch {
      // toast shown in context
    }
  };

  // Create announcement
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) return;
    try {
      await addDoc(collection(db, 'announcements'), {
        title: newAnnTitle.trim(),
        content: newAnnContent.trim(),
        type: newAnnType,
        isActive: true,
        createdAt: new Date().toISOString()
      });
      setNewAnnTitle('');
      setNewAnnContent('');
      showToast('Pengumuman berhasil diterbitkan!', 'success');
    } catch {
      showToast('Gagal membuat pengumuman', 'error');
    }
  };

  // Delete announcement
  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
      showToast('Pengumuman dihapus', 'info');
    } catch {
      showToast('Gagal menghapus', 'error');
    }
  };

  // Send admin chat reply
  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatUser || !adminReplyText.trim()) return;
    try {
      const msg = {
        chatId: selectedChatUser.id,
        senderId: user?.uid || 'admin',
        senderName: 'Admin AZPREM',
        senderRole: 'admin',
        text: adminReplyText.trim(),
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'chats', selectedChatUser.id, 'messages'), msg);
      await updateDoc(doc(db, 'chats', selectedChatUser.id), {
        lastMessage: adminReplyText.trim(),
        lastSenderRole: 'admin',
        updatedAt: new Date().toISOString()
      });
      setAdminReplyText('');
    } catch {
      showToast('Gagal mengirim balasan chat', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-28 pt-4 space-y-4">
      {/* Top Navbar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Admin Panel AZPREM
              </h2>
              <span className="bg-orange-100 text-orange-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Root
              </span>
            </div>
            <p className="text-xs text-slate-400">Pusat Manajemen Sistem & Transaksi</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none bg-slate-100 p-1.5 rounded-2xl">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'users', label: 'User', icon: Users },
          { id: 'orders', label: 'Order', icon: ShoppingBag },
          { id: 'deposits', label: 'Deposit', icon: Wallet },
          { id: 'products', label: 'Produk', icon: Package },
          { id: 'settings', label: 'Setting', icon: Settings },
          { id: 'announcements', label: 'Notifikasi', icon: Bell },
          { id: 'chats', label: 'Chat', icon: MessageSquare },
          { id: 'stats', label: 'Statistik', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total User
              </span>
              <span className="text-2xl font-black text-slate-900">{totalUser}</span>
              <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
                {activeUserCount} Akun Aktif
              </span>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Order
              </span>
              <span className="text-2xl font-black text-orange-600">{totalOrder}</span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                Sukses: {orderBerhasil} | Gagal: {orderGagal}
              </span>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Deposit
              </span>
              <span className="text-lg sm:text-xl font-black text-emerald-600 truncate block">
                {formatRupiah(totalDepositAmount)}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                {depositsList.filter(d => d.status === 'paid').length} Pembayaran
              </span>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Saldo User
              </span>
              <span className="text-lg sm:text-xl font-black text-slate-900 truncate block">
                {formatRupiah(totalUserBalance)}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                Liabilitas Saldo
              </span>
            </div>
          </div>

          {/* Quick Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent Orders */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Order Terbaru
                </h4>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-xs font-bold text-orange-600 hover:underline cursor-pointer"
                >
                  Semua
                </button>
              </div>
              {ordersList.slice(0, 5).map((o, idx) => {
                const isSuccess = o.status === 'Berhasil';
                const isPending = o.status === 'Pending';
                return (
                  <div key={o.orderId || o.id || `recent-order-${idx}`} className="flex items-center justify-between text-xs py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <div className="font-bold text-slate-800">{o.productType}</div>
                      <div className="text-[10px] text-slate-400">{o.targetEmail || o.userEmail}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{formatRupiah(o.price)}</div>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        isSuccess
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                          : isPending
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {isSuccess && <CheckCircle2 className="w-3 h-3 text-white" />}
                        <span>{o.status}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent Deposits */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Deposit Terbaru
                </h4>
                <button
                  onClick={() => setActiveTab('deposits')}
                  className="text-xs font-bold text-orange-600 hover:underline cursor-pointer"
                >
                  Semua
                </button>
              </div>
              {depositsList.slice(0, 5).map((d, idx) => (
                <div key={d.depositId || d.id || `recent-dep-${idx}`} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                  <div>
                    <div className="font-bold text-slate-800">{d.invoice}</div>
                    <div className="text-[10px] text-slate-400">{d.userEmail}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-600">{formatRupiah(d.nominal)}</div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${d.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {d.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">
              Kelola Pengguna ({usersList.length})
            </h3>
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Cari nama / email..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {usersList
              .filter(u => 
                (u.nama || '').toLowerCase().includes(searchUser.toLowerCase()) ||
                (u.email || '').toLowerCase().includes(searchUser.toLowerCase())
              )
              .map((u, idx) => {
                const isMuted = u.muteUntil && u.muteUntil > Date.now();
                return (
                  <div key={u.uid || `user-${idx}`} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{u.nama}</span>
                        {u.role === 'admin' && (
                          <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.2 rounded font-bold">Admin</span>
                        )}
                        {u.statusAkun === 'suspended' && (
                          <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-bold">Suspended</span>
                        )}
                        {isMuted && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">Muted</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Saldo: <strong className="text-orange-600">{formatRupiah(u.saldo || 0)}</strong> | Ref: {u.referralCode}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingBalanceUser(u);
                          setBalanceDelta('0');
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-xs font-bold cursor-pointer"
                        title="Edit Saldo"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleMute(u)}
                        className={`p-1.5 rounded-lg text-xs font-bold cursor-pointer ${isMuted ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        title={isMuted ? 'Unmute' : 'Mute 30m'}
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleSuspend(u)}
                        className={`p-1.5 rounded-lg text-xs font-bold cursor-pointer ${u.statusAkun === 'suspended' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        title={u.statusAkun === 'suspended' ? 'Aktifkan' : 'Suspend'}
                      >
                        {u.statusAkun === 'suspended' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Edit Balance Modal */}
      {editingBalanceUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div onClick={() => setEditingBalanceUser(null)} className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm cursor-pointer" />
          <div className="relative bg-white rounded-3xl p-5 max-w-xs w-full z-10 shadow-xl space-y-3">
            <h4 className="text-sm font-black text-slate-900">
              Edit Saldo: {editingBalanceUser.nama}
            </h4>
            <div className="text-xs text-slate-500">
              Saldo saat ini: <strong>{formatRupiah(editingBalanceUser.saldo || 0)}</strong>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Nominal Penyesuaian (+ untuk tambah, - untuk potong)
              </label>
              <input
                type="number"
                value={balanceDelta}
                onChange={(e) => setBalanceDelta(e.target.value)}
                placeholder="Contoh: 5000 atau -2000"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingBalanceUser(null)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveBalance}
                className="flex-1 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl shadow cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ORDER MANAGEMENT */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">
              Semua Order AM ({ordersList.length})
            </h3>
            <div className="flex items-center gap-1">
              {(['All', 'Berhasil', 'Gagal', 'Pending'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setOrderFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${orderFilter === st ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {ordersList
              .filter(o => orderFilter === 'All' || o.status === orderFilter)
              .map((o, idx) => {
                const isSuccess = o.status === 'Berhasil';
                const isPending = o.status === 'Pending';
                return (
                  <div key={o.orderId || o.id || `order-${idx}`} className="py-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{o.productType} ({formatRupiah(o.price)})</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                        isSuccess
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                          : isPending
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {isSuccess && <CheckCircle2 className="w-3 h-3 text-white" />}
                        <span>{o.status}</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      User: {o.userEmail} | ID: {o.orderId}
                    </div>
                    {o.targetEmail && (
                      <div className="text-[11px] text-orange-600 font-mono">
                        Target: {o.targetEmail}
                      </div>
                    )}
                    {o.count && (
                      <div className="text-[11px] text-slate-600">
                        Jumlah: {o.count} Akun
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400">
                      {formatDate(o.createdAt)}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 4: DEPOSIT MANAGEMENT */}
      {activeTab === 'deposits' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">
              Transaksi Deposit ({depositsList.length})
            </h3>
            <div className="flex items-center gap-1">
              {(['All', 'paid', 'pending', 'failed'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setDepositFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${depositFilter === st ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {depositsList
              .filter(d => depositFilter === 'All' || d.status === depositFilter)
              .map((d, idx) => (
                <div key={d.depositId || d.id || `dep-${idx}`} className="py-3 flex items-center justify-between text-xs gap-2">
                  <div>
                    <div className="font-bold text-slate-900">{d.invoice}</div>
                    <div className="text-[11px] text-slate-500">{d.userEmail}</div>
                    <div className="text-[10px] text-slate-400">{formatDate(d.createdAt)}</div>
                  </div>
                  <div className="text-right space-y-1 shrink-0">
                    <div className="font-black text-emerald-600 text-sm">
                      {formatRupiah(d.totalPayment || d.nominal)}
                    </div>
                    {Boolean(d.uniqueCode) && (
                      <div className="text-[10px] text-slate-400">
                        Nominal: {formatRupiah(d.nominal)} (+Kode {d.uniqueCode})
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                        d.status === 'paid'
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {d.status === 'paid' && <CheckCircle2 className="w-3 h-3 text-white" />}
                        <span>{d.status === 'paid' ? 'Sukses Masuk' : 'Pending'}</span>
                      </span>
                      {d.status === 'pending' && (
                        <button
                          onClick={() => handleApproveDeposit(d)}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold shadow hover:bg-emerald-700 active:scale-95 cursor-pointer"
                        >
                          Approve Masuk
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 5: PRODUCT MANAGEMENT */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-5">
          <h3 className="text-sm font-black text-slate-900">
            Manajemen Toko & Produk Alight Motion
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-orange-50/70 p-4 rounded-2xl border border-orange-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Status Toko Utama</h4>
                <p className="text-[11px] text-slate-500">Tutup toko untuk menghentikan seluruh pemesanan</p>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ isStoreOpen: !(settings.isStoreOpen !== false) })}
                className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer ${
                  settings.isStoreOpen !== false
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-rose-600 text-white hover:bg-rose-700'
                }`}
              >
                {settings.isStoreOpen !== false ? 'TOKO BUKA' : 'TOKO DITUTUP'}
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Jalur Deposit QRIS</h4>
                <p className="text-[11px] text-slate-500">Buka atau tutup jalur deposit otomatis</p>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ depositActive: !(settings.depositActive !== false) })}
                className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer ${
                  settings.depositActive !== false
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-rose-600 text-white hover:bg-rose-700'
                }`}
              >
                {settings.depositActive !== false ? 'DEPOSIT AKTIF' : 'DEPOSIT DITUTUP'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AM Verif Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs">1. AM Verif</h4>
                <button
                  type="button"
                  onClick={() => updateSettings({ amVerifActive: !settings.amVerifActive })}
                  className={`px-3 py-1 rounded-full text-[10px] font-black cursor-pointer ${settings.amVerifActive ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'}`}
                >
                  {settings.amVerifActive ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}
                </button>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Harga per Akun (Rp)
                </label>
                <input
                  type="number"
                  value={formSettings.amVerifPrice}
                  onChange={(e) => setFormSettings({ ...formSettings, amVerifPrice: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            {/* AM Bulk Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs">2. AM Bulk</h4>
                <button
                  type="button"
                  onClick={() => updateSettings({ amBulkActive: !settings.amBulkActive })}
                  className={`px-3 py-1 rounded-full text-[10px] font-black cursor-pointer ${settings.amBulkActive ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'}`}
                >
                  {settings.amBulkActive ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}
                </button>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Harga per Akun (Rp)
                </label>
                <input
                  type="number"
                  value={formSettings.amBulkPrice}
                  onChange={(e) => setFormSettings({ ...formSettings, amBulkPrice: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              URL Gambar Produk
            </label>
            <input
              type="text"
              value={formSettings.productImageUrl || ''}
              onChange={(e) => setFormSettings({ ...formSettings, productImageUrl: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
            />
          </div>

          <button
            onClick={() => updateSettings({
              amVerifPrice: formSettings.amVerifPrice,
              amBulkPrice: formSettings.amBulkPrice,
              productImageUrl: formSettings.productImageUrl
            })}
            className="px-5 py-2.5 bg-orange-500 text-white font-bold text-xs rounded-xl shadow hover:bg-orange-600 cursor-pointer"
          >
            Simpan Perubahan Produk
          </button>
        </div>
      )}

      {/* TAB 6: WEBSITE SETTINGS */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-5 text-xs">
          <h3 className="text-sm font-black text-slate-900">
            Pengaturan Gateway QRIS API, Website & Referral
          </h3>

          {/* Section: BuatQRIS Open API Gateway */}
          <div className="bg-orange-50/70 p-4 rounded-2xl border border-orange-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                  <span>Gateway QRIS Otomatis (BuatQRIS Open API)</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Foto QRIS & Kode Unik dibuat 100% resmi dari API BuatQRIS sehingga dapat di-scan oleh semua Bank & E-Wallet tanpa pesan "QR tidak tersedia".
                </p>
              </div>
              <a
                href="https://app.buatqris.site"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-bold text-orange-600 bg-white px-2.5 py-1 rounded-xl shadow-sm border border-orange-200 hover:bg-orange-50 inline-flex items-center gap-1 shrink-0"
              >
                <span>Daftar / Buka Dashboard</span>
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Account ID (ID Akun BuatQRIS)
                </label>
                <input
                  type="text"
                  value={formSettings.bqAccountId || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, bqAccountId: e.target.value.trim() })}
                  placeholder="Contoh: 100543415"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Secret Token (Token Rahasia BuatQRIS)
                </label>
                <input
                  type="password"
                  value={formSettings.bqSecretToken || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, bqSecretToken: e.target.value.trim() })}
                  placeholder="Token rahasia dari menu Open API"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Toko di QRIS (UMKM Name)
                </label>
                <input
                  type="text"
                  value={formSettings.bqUmkmName || 'AZPREM STORE'}
                  onChange={(e) => setFormSettings({ ...formSettings, bqUmkmName: e.target.value })}
                  placeholder="Contoh: AZPREM STORE"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  String QRIS Toko Statis (Alternatif / Opsional)
                </label>
                <input
                  type="text"
                  value={formSettings.staticQrString || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, staticQrString: e.target.value.trim() })}
                  placeholder="000201010211266..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestBq}
                disabled={testingBq}
                className="px-3 py-2 bg-white border border-orange-300 hover:bg-orange-100 text-orange-700 font-bold rounded-xl shadow-sm text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{testingBq ? 'Mengetes...' : 'Test Koneksi BuatQRIS API'}</span>
              </button>
              {bqTestResult && (
                <span className={`text-[11px] font-bold ${bqTestResult.status ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {bqTestResult.message}
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-slate-900 text-xs">Webhook / Callback URL</h4>
                <p className="text-[11px] text-slate-500">Pasang URL ini pada menu Callback di dashboard gateway pembayaran Anda</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                Otomatis 24 Jam
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={typeof window !== 'undefined' ? `${window.location.origin}/api/webhook` : 'https://azprem.vercel.app/api/webhook'}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
              />
              <button
                type="button"
                onClick={() => {
                  const url = typeof window !== 'undefined' ? `${window.location.origin}/api/webhook` : 'https://azprem.vercel.app/api/webhook';
                  navigator.clipboard.writeText(url);
                  showToast('URL Webhook berhasil disalin!', 'success');
                }}
                className="px-3 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow hover:bg-slate-800 shrink-0 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Webhook</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-slate-900 text-xs">Statistik Beranda (Dashboard)</h4>
                <p className="text-[11px] text-slate-500">Pilih antara sinkronisasi Firestore real-time atau nilai manual</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const currentManual = Boolean(formSettings.customStats?.useManualStats);
                  setFormSettings({
                    ...formSettings,
                    customStats: {
                      useManualStats: !currentManual,
                      totalUsers: formSettings.customStats?.totalUsers || totalUser,
                      totalOrders: formSettings.customStats?.totalOrders || totalOrder,
                      totalDeposits: formSettings.customStats?.totalDeposits || totalDepositAmount,
                    }
                  });
                }}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer ${
                  formSettings.customStats?.useManualStats
                    ? 'bg-orange-500 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {formSettings.customStats?.useManualStats ? 'MODE MANUAL AKTIF' : 'MODE REALTIME FIRESTORE'}
              </button>
            </div>

            {formSettings.customStats?.useManualStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Angka Total User</label>
                  <input
                    type="number"
                    value={formSettings.customStats?.totalUsers || 0}
                    onChange={(e) => setFormSettings({
                      ...formSettings,
                      customStats: {
                        useManualStats: true,
                        totalUsers: parseInt(e.target.value) || 0,
                        totalOrders: formSettings.customStats?.totalOrders || 0,
                        totalDeposits: formSettings.customStats?.totalDeposits || 0
                      }
                    })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Angka Order AM</label>
                  <input
                    type="number"
                    value={formSettings.customStats?.totalOrders || 0}
                    onChange={(e) => setFormSettings({
                      ...formSettings,
                      customStats: {
                        useManualStats: true,
                        totalUsers: formSettings.customStats?.totalUsers || 0,
                        totalOrders: parseInt(e.target.value) || 0,
                        totalDeposits: formSettings.customStats?.totalDeposits || 0
                      }
                    })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Angka Total Deposit (Rp)</label>
                  <input
                    type="number"
                    value={formSettings.customStats?.totalDeposits || 0}
                    onChange={(e) => setFormSettings({
                      ...formSettings,
                      customStats: {
                        useManualStats: true,
                        totalUsers: formSettings.customStats?.totalUsers || 0,
                        totalOrders: formSettings.customStats?.totalOrders || 0,
                        totalDeposits: parseInt(e.target.value) || 0
                      }
                    })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-black text-slate-900 text-xs">Pengaturan Target Referral</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Teman Valid</label>
                <input
                  type="number"
                  value={formSettings.referralTargetFriends || 20}
                  onChange={(e) => setFormSettings({ ...formSettings, referralTargetFriends: parseInt(e.target.value) || 20 })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Reward (Rp)</label>
                <input
                  type="number"
                  value={formSettings.referralTargetReward || 10000}
                  onChange={(e) => setFormSettings({ ...formSettings, referralTargetReward: parseInt(e.target.value) || 10000 })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Persen Bonus Komisi (%)</label>
                <input
                  type="number"
                  value={formSettings.referralBonusPercent || 5}
                  onChange={(e) => setFormSettings({ ...formSettings, referralBonusPercent: parseInt(e.target.value) || 5 })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Website</label>
              <input
                type="text"
                value={formSettings.websiteName}
                onChange={(e) => setFormSettings({ ...formSettings, websiteName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Judul Banner Home</label>
              <input
                type="text"
                value={formSettings.bannerTitle}
                onChange={(e) => setFormSettings({ ...formSettings, bannerTitle: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Subjudul Banner</label>
              <input
                type="text"
                value={formSettings.bannerSubtitle}
                onChange={(e) => setFormSettings({ ...formSettings, bannerSubtitle: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Minimal Deposit (Rp)</label>
              <input
                type="number"
                value={formSettings.minDeposit}
                onChange={(e) => setFormSettings({ ...formSettings, minDeposit: parseInt(e.target.value) || 1000 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Maksimal Deposit (Rp)</label>
              <input
                type="number"
                value={formSettings.maxDeposit}
                onChange={(e) => setFormSettings({ ...formSettings, maxDeposit: parseInt(e.target.value) || 100000 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-md hover:from-orange-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Semua Pengaturan</span>
          </button>
        </form>
      )}

      {/* TAB 7: ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateAnnouncement} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3 text-xs">
            <h3 className="text-sm font-black text-slate-900">Buat Pengumuman Baru</h3>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Judul Pengumuman</label>
              <input
                type="text"
                required
                value={newAnnTitle}
                onChange={(e) => setNewAnnTitle(e.target.value)}
                placeholder="Contoh: Promo Spesial Alight Motion Weekend!"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tipe</label>
              <select
                value={newAnnType}
                onChange={(e: any) => setNewAnnType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="info">Info</option>
                <option value="promo">Promo</option>
                <option value="penting">Penting</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Isi Pesan</label>
              <textarea
                rows={3}
                required
                value={newAnnContent}
                onChange={(e) => setNewAnnContent(e.target.value)}
                placeholder="Tuliskan isi pengumuman..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-500 text-white font-bold rounded-xl shadow hover:bg-orange-600 cursor-pointer"
            >
              Terbitkan Pengumuman
            </button>
          </form>

          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Daftar Pengumuman Aktif
            </h4>
            <div className="divide-y divide-slate-100">
              {announcementsList.map((a, idx) => (
                <div key={a.id || `ann-${idx}`} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{a.title}</span>
                      <span className="text-[9px] bg-slate-100 px-1.5 py-0.2 rounded font-bold uppercase">{a.type}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{a.content}</p>
                    <span className="text-[9px] text-slate-400">{formatDate(a.createdAt)}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteAnnouncement(a.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: CHAT ROOMS MANAGEMENT */}
      {activeTab === 'chats' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-2 md:col-span-1 max-h-[500px] overflow-y-auto">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
              Daftar Chat User ({chatRoomsList.length})
            </h4>
            {chatRoomsList.map((room, idx) => (
              <div
                key={room.id || `room-${idx}`}
                onClick={() => setSelectedChatUser(room)}
                className={`p-3 rounded-2xl cursor-pointer transition-all border ${
                  selectedChatUser?.id === room.id
                    ? 'bg-orange-50 border-orange-200 text-orange-900'
                    : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold text-xs truncate">{room.userName || 'User'}</div>
                <div className="text-[10px] text-slate-400 truncate">{room.userEmail}</div>
                <p className="text-[11px] text-slate-600 line-clamp-1 mt-1 font-medium">
                  {typeof room.lastMessage === 'string' ? room.lastMessage : (room.lastMessage ? JSON.stringify(room.lastMessage) : 'Belum ada pesan')}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm md:col-span-2 flex flex-col h-[500px]">
            {selectedChatUser ? (
              <>
                <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{selectedChatUser.userName}</h4>
                    <p className="text-[11px] text-slate-400">{selectedChatUser.userEmail}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 text-xs">
                  {chatMessages.map((msg, idx) => (
                    <div key={msg.id || `msg-${idx}`} className={`flex flex-col ${msg.senderRole === 'admin' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-2xl ${msg.senderRole === 'admin' ? 'bg-orange-500 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
                        {typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)}
                      </div>
                      <span className="text-[9px] text-slate-400 mt-0.5">{formatDate(msg.createdAt)}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendAdminReply} className="pt-2 flex gap-2">
                  <input
                    type="text"
                    value={adminReplyText}
                    onChange={(e) => setAdminReplyText(e.target.value)}
                    placeholder="Ketik balasan admin..."
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-500 text-white font-bold text-xs rounded-xl shadow hover:bg-orange-600 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-slate-400 text-xs">
                Pilih salah satu user di sebelah kiri untuk melihat dan membalas chat.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 9: STATISTICS */}
      {activeTab === 'stats' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-900">
            Statistik & Pertumbuhan AZPREM
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
              <span className="text-xs font-bold text-orange-900">Ringkasan Konversi Order</span>
              <div className="text-2xl font-black text-orange-600 mt-1">
                {totalOrder > 0 ? ((orderBerhasil / totalOrder) * 100).toFixed(1) : 100}%
              </div>
              <p className="text-[11px] text-orange-700 mt-1">
                Persentase order AM yang berhasil diselesaikan tanpa kendala.
              </p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <span className="text-xs font-bold text-emerald-900">Rata-rata Deposit per Transaksi</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {depositsList.filter(d => d.status === 'paid').length > 0 
                  ? formatRupiah(Math.round(totalDepositAmount / depositsList.filter(d => d.status === 'paid').length))
                  : formatRupiah(15000)}
              </div>
              <p className="text-[11px] text-emerald-700 mt-1">
                Nilai deposit rata-rata pengguna aktif AZPREM.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
