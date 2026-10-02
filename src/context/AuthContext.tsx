import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  db, 
  signInWithPopup, 
  googleProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  updateProfile,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  FirebaseUser
} from '../firebase';
import { UserProfile, AppSettings } from '../types';
import { ADMIN_EMAILS, DEFAULT_SETTINGS } from '../utils/constants';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string, refCode?: string) => Promise<void>;
  loginWithGoogle: (refCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserBalance: (uid: string, deltaSaldo: number) => Promise<void>;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authModalMode: 'login' | 'register' | 'forgot';
  setAuthModalMode: (mode: 'login' | 'register' | 'forgot') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot'>('login');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Sync settings from Firestore or fallback
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...docSnap.data() as AppSettings });
      } else {
        // initialize default settings
        setDoc(doc(db, 'settings', 'global'), DEFAULT_SETTINGS).catch(console.warn);
      }
    }, (err) => {
      console.warn('Settings snapshot error:', err);
    });
    return () => unsub();
  }, []);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const merged = { ...settings, ...newSettings };
      await setDoc(doc(db, 'settings', 'global'), merged, { merge: true });
      setSettings(merged);
      showToast('Pengaturan berhasil diperbarui', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pengaturan', 'error');
      throw err;
    }
  };

  const generateReferralCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'AZP-';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Handle Firebase User state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);

        // Subscribe to user doc
        const unsubProfile = onSnapshot(userDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
          } else {
            // Document does not exist yet, create initial profile
            const isDefaultAdmin = ADMIN_EMAILS.includes(currentUser.email || '');
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              nama: currentUser.displayName || currentUser.email?.split('@')[0] || 'User AZPREM',
              email: currentUser.email || '',
              saldo: 0,
              totalOrder: 0,
              totalDeposit: 0,
              referralCode: generateReferralCode(),
              bonusReferral: 0,
              statusAkun: 'aktif',
              role: isDefaultAdmin ? 'admin' : 'user',
              createdAt: new Date().toISOString()
            };
            try {
              await setDoc(userDocRef, newProfile);
              setProfile(newProfile);
            } catch (e) {
              console.warn('Failed to set initial user doc:', e);
              setProfile(newProfile);
            }
          }
          setLoading(false);
        }, (err) => {
          console.warn('Profile listener error:', err);
          setLoading(false);
        });

        return () => unsubProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      showToast('Berhasil masuk ke AZPREM', 'success');
      setAuthModalOpen(false);
    } catch (err: any) {
      let msg = 'Gagal masuk. Periksa email & password Anda.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Email atau password salah';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Terlalu banyak percobaan. Tunggu beberapa saat.';
      }
      showToast(msg, 'error');
      throw err;
    }
  };

  const registerWithEmail = async (name: string, email: string, pass: string, refCode?: string) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(res.user, { displayName: name });
      
      const isDefaultAdmin = ADMIN_EMAILS.includes(email);
      const newProfile: UserProfile = {
        uid: res.user.uid,
        nama: name,
        email: email,
        saldo: 0,
        totalOrder: 0,
        totalDeposit: 0,
        referralCode: generateReferralCode(),
        referredBy: refCode || null,
        bonusReferral: 0,
        statusAkun: 'aktif',
        role: isDefaultAdmin ? 'admin' : 'user',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', res.user.uid), newProfile);
      setProfile(newProfile);
      showToast('Pendaftaran akun berhasil!', 'success');
      setAuthModalOpen(false);
    } catch (err: any) {
      let msg = 'Gagal mendaftar akun.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'Email ini sudah terdaftar. Silakan login.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password minimal 6 karakter.';
      }
      showToast(msg, 'error');
      throw err;
    }
  };

  const loginWithGoogle = async (refCode?: string) => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, 'users', res.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        const isDefaultAdmin = ADMIN_EMAILS.includes(res.user.email || '');
        const newProfile: UserProfile = {
          uid: res.user.uid,
          nama: res.user.displayName || res.user.email?.split('@')[0] || 'User AZPREM',
          email: res.user.email || '',
          saldo: 0,
          totalOrder: 0,
          totalDeposit: 0,
          referralCode: generateReferralCode(),
          referredBy: refCode || null,
          bonusReferral: 0,
          statusAkun: 'aktif',
          role: isDefaultAdmin ? 'admin' : 'user',
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        setProfile(newProfile);
      }
      showToast('Login Google berhasil', 'success');
      setAuthModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal login via Google', 'error');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setProfile(null);
      showToast('Anda telah keluar dari akun', 'info');
    } catch (err: any) {
      showToast('Gagal logout', 'error');
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('Link reset password telah dikirim ke email Anda', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim email reset password', 'error');
      throw err;
    }
  };

  const updateUserBalance = async (uid: string, deltaSaldo: number) => {
    try {
      const ref = doc(db, 'users', uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const cur = snap.data().saldo || 0;
        const newSaldo = Math.max(0, cur + deltaSaldo);
        await updateDoc(ref, { saldo: newSaldo });
        if (profile && profile.uid === uid) {
          setProfile({ ...profile, saldo: newSaldo });
        }
      }
    } catch (err) {
      console.warn('Update balance error:', err);
    }
  };

  const isAdmin = Boolean(
    (user?.email && ADMIN_EMAILS.includes(user.email)) ||
    profile?.role === 'admin'
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        loading,
        settings,
        updateSettings,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        resetPassword,
        updateUserBalance,
        toasts,
        showToast,
        removeToast,
        authModalOpen,
        setAuthModalOpen,
        authModalMode,
        setAuthModalMode
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
