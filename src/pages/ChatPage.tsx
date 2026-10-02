import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/constants';
import { 
  Send, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  Users, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { 
  db, 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot 
} from '../firebase';
import { ChatMessage } from '../types';

export const ChatPage: React.FC = () => {
  const { user, profile, isAdmin, showToast } = useAuth();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [muteRemaining, setMuteRemaining] = useState<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if user is currently muted
  useEffect(() => {
    if (!profile?.muteUntil) {
      setMuteRemaining(0);
      return;
    }

    const checkMute = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((profile.muteUntil! - now) / 1000));
      setMuteRemaining(diff);
    };

    checkMute();
    const interval = setInterval(checkMute, 1000);
    return () => clearInterval(interval);
  }, [profile?.muteUntil]);

  // Realtime community messages listener
  useEffect(() => {
    const messagesRef = collection(db, 'community_chats');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(150));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        msgs.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
      });
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (err) => {
      console.warn('Community chat listener notice:', err);
    });

    return () => unsubscribe();
  }, []);

  // Handle send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (muteRemaining > 0) {
      showToast(`Anda sedang dibisukan. Tunggu ${formatRemaining(muteRemaining)}`, 'error');
      return;
    }

    const trimmed = inputText.trim();
    if (!trimmed) return;

    // 1. Client & Server URL Validation
    const urlPattern = /(https?:\/\/|www\.|wa\.me\/|t\.me\/|discord\.gg\/|[a-zA-Z0-9-]+\.(com|id|me|net|org|io|xyz|app|top|biz|info|cc|co))/i;
    let isBlocked = urlPattern.test(trimmed);

    setSending(true);
    try {
      // Backend validation
      const validateRes = await fetch('/api/chat/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed })
      });
      const valData = await validateRes.json();
      if (valData.blocked) {
        isBlocked = true;
      }

      // If blocked: Mute user for 30 minutes and DO NOT SEND
      if (isBlocked) {
        const muteUntilTime = Date.now() + 30 * 60 * 1000;
        await updateDoc(doc(db, 'users', user.uid), {
          muteUntil: muteUntilTime
        });

        setInputText('');
        showToast('Pesan berisi link/URL tidak diperbolehkan. Akun Anda dibisukan selama 30 menit.', 'error');
        setSending(false);
        return;
      }

      // If clean: Add message to Community Chat in Firestore
      const messageData = {
        senderId: user.uid,
        senderName: profile?.nama || user.displayName || 'Member AZPREM',
        senderRole: isAdmin ? 'admin' : 'user',
        text: trimmed,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'community_chats'), messageData);
      setInputText('');
    } catch (err: any) {
      showToast('Gagal mengirim pesan', 'error');
    } finally {
      setSending(false);
    }
  };

  const formatRemaining = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-4 flex flex-col h-[calc(100vh-60px)]">
      {/* Header - No Left Arrow */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Komunitas AZPREM
              </h2>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-xs text-slate-500">Ruang diskusi sesama member aktif</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-500" />
            <span>Publik</span>
          </span>
        </div>
      </div>

      {/* Rules Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-2.5 my-2 shrink-0 flex items-center gap-2 text-xs text-amber-900 font-medium">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          Dilarang mengirim link/URL. Pelanggaran otomatis dibisukan (mute) 30 menit.
        </span>
      </div>

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-600">Belum ada obrolan</p>
            <p className="text-[11px] text-slate-400 max-w-[200px]">
              Jadilah yang pertama menyapa member lain di Komunitas AZPREM!
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === user?.uid;
            const isMsgAdmin = msg.senderRole === 'admin';
            return (
              <div
                key={msg.id || `msg-${idx}`}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-0.5 px-1">
                  <span>{isMe ? 'Anda' : msg.senderName || 'Member'}</span>
                  {isMsgAdmin && (
                    <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.2 rounded font-extrabold flex items-center gap-0.5">
                      <ShieldCheck className="w-2.5 h-2.5" /> Admin
                    </span>
                  )}
                </div>
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                    isMe
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-br-none'
                      : isMsgAdmin
                      ? 'bg-orange-50 border border-orange-200 text-slate-900 rounded-bl-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)}
                  </p>
                  <div
                    className={`flex items-center justify-end gap-1 text-[9px] mt-1 ${
                      isMe ? 'text-orange-100' : 'text-slate-400'
                    }`}
                  >
                    <span>{formatDate(msg.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Muted Warning Banner */}
      {muteRemaining > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 mb-2 flex items-center gap-2.5 text-xs text-rose-800 font-bold shrink-0">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="flex-1">
            <div>Akun Anda sedang dibisukan karena melanggar aturan link.</div>
            <div className="text-[11px] text-rose-600 font-normal">
              Dapat chat kembali dalam: <strong>{formatRemaining(muteRemaining)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Input Message Form */}
      <form onSubmit={handleSendMessage} className="pt-2 shrink-0">
        <div className="flex items-center gap-2 bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500 transition-all">
          <input
            type="text"
            disabled={muteRemaining > 0 || sending || !user}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              muteRemaining > 0
                ? `Dibisukan (${formatRemaining(muteRemaining)})`
                : 'Tulis pesan untuk semua member...'
            }
            className="flex-1 px-3 py-2 text-xs sm:text-sm bg-transparent focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 rounded-xl"
          />
          <button
            type="submit"
            disabled={muteRemaining > 0 || sending || !inputText.trim() || !user}
            className="w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
