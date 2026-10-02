import React, { useState, useEffect } from 'react';
import { X, Bell, Sparkles, AlertCircle, Info, Tag } from 'lucide-react';
import { db, collection, query, orderBy, onSnapshot } from '../firebase';
import { AnnouncementItem } from '../types';
import { formatDate } from '../utils/constants';

interface AnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnnouncementsModal: React.FC<AnnouncementsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: AnnouncementItem[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as AnnouncementItem;
        if (data.isActive !== false) {
          list.push({ ...data, id: docSnap.id });
        }
      });
      setAnnouncements(list);
    }, (err) => console.warn('Announcements notice:', err));

    return () => unsub();
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" />

      <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 z-10 border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Pengumuman</h3>
              <p className="text-[11px] text-slate-400">Informasi terbaru seputar AZPREM</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="overflow-y-auto py-3 space-y-3 flex-1 pr-1">
          {announcements.length === 0 ? (
            <div className="text-center py-10 space-y-2 text-slate-400">
              <Bell className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Tidak ada pengumuman baru</p>
              <p className="text-[11px] text-slate-400">
                Pemberitahuan promo & update sistem akan tampil di sini.
              </p>
            </div>
          ) : (
            announcements.map((item) => {
              const isPenting = item.type === 'penting';
              const isPromo = item.type === 'promo';
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all space-y-1.5 ${
                    isPenting
                      ? 'bg-rose-50/70 border-rose-200'
                      : isPromo
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        isPenting
                          ? 'bg-rose-500 text-white'
                          : isPromo
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-800 text-white'
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-black text-slate-900">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {item.content}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Close Button */}
        <div className="pt-2 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
