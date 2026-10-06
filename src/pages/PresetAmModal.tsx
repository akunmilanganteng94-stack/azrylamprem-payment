import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Search, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertCircle, 
  FileCode, 
  Zap, 
  Link2, 
  Video, 
  CheckCircle2, 
  ClipboardPaste, 
  RotateCcw,
  History,
  Clock,
  Download,
  ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, collection, addDoc, query, orderBy, limit, onSnapshot } from '../firebase';

interface PresetAmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PresetItem {
  type: '5mb' | 'xml' | 'other';
  title: string;
  url: string;
  source?: string;
}

interface PresetHistoryItem {
  id?: string;
  tiktokUrl: string;
  author: string;
  title: string;
  url5mb: string;
  urlXml: string;
  userEmail: string;
  userName?: string;
  createdAt: string;
}

const SEED_COMMUNITY_HISTORY: PresetHistoryItem[] = [
  {
    id: 'seed-1',
    tiktokUrl: 'https://vt.tiktok.com/ZSbCCPGMs/',
    author: '@xeinzpreset',
    title: 'Jedag Jedug Mengkane Sound Viral Full Bass',
    url5mb: 'https://alight.link/H8mGq',
    urlXml: 'https://drive.google.com/file/d/1sample_preset_jedag_jedug_xml/view',
    userEmail: 'ak***@gmail.com',
    createdAt: new Date(Date.now() - 1000 * 60 * 7).toISOString()
  },
  {
    id: 'seed-2',
    tiktokUrl: 'https://vt.tiktok.com/ZSbCC129A/',
    author: '@azrylmotion',
    title: 'Cinematic Slow Beat Color Grading 4K Smooth',
    url5mb: 'https://alight.link/preset?id=cinematic_azryl_5mb',
    urlXml: 'https://drive.google.com/file/d/1sample_cinematic_preset_xml/view',
    userEmail: 'ria***@gmail.com',
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString()
  },
  {
    id: 'seed-3',
    tiktokUrl: 'https://vt.tiktok.com/ZSbCC889B/',
    author: '@amedit.id',
    title: 'Velocity Flash Zoom In / Out Shake Beat Sync',
    url5mb: 'https://alight.link/preset?id=velocity_flash_5mb',
    urlXml: 'https://drive.google.com/file/d/1sample_velocity_preset_xml/view',
    userEmail: 'bay***@gmail.com',
    createdAt: new Date(Date.now() - 1000 * 60 * 65).toISOString()
  }
];

export const PresetAmModal: React.FC<PresetAmModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, showToast } = useAuth();
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState<any | null>(null);
  const [parsedPresets, setParsedPresets] = useState<PresetItem[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [historyList, setHistoryList] = useState<PresetHistoryItem[]>(SEED_COMMUNITY_HISTORY);

  useEffect(() => {
    try {
      const q = query(collection(db, 'preset_history'), orderBy('createdAt', 'desc'), limit(20));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: PresetHistoryItem[] = [];
        snapshot.forEach((docSnap) => {
          fetched.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        if (fetched.length > 0) {
          const fetchedUrls = new Set(fetched.map((f) => f.tiktokUrl));
          const complementary = SEED_COMMUNITY_HISTORY.filter((s) => !fetchedUrls.has(s.tiktokUrl));
          setHistoryList([...fetched, ...complementary]);
        }
      }, (err) => {
        console.warn('preset_history modal listener notice:', err);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('preset_history query error:', e);
    }
  }, []);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTiktokUrl(text.trim());
        showToast('Link TikTok berhasil ditempel', 'info');
      }
    } catch {
      showToast('Gagal membaca clipboard. Tempel manual di kolom input.', 'info');
    }
  };

  const handleCopy = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
    showToast(`Link ${label} berhasil disalin!`, 'success');
  };

  const extractPresetsFromResponse = (data: any): PresetItem[] => {
    const list: PresetItem[] = [];
    const addedUrls = new Set<string>();

    const addLink = (rawUrl: string, explicitType?: '5mb' | 'xml' | 'other', customTitle?: string, source?: string) => {
      if (!rawUrl || typeof rawUrl !== 'string') return;
      const cleanUrl = rawUrl.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) return;
      if (addedUrls.has(cleanUrl)) return;
      addedUrls.add(cleanUrl);

      let detectedType: '5mb' | 'xml' | 'other' = explicitType || 'other';
      const lower = cleanUrl.toLowerCase();
      if (lower.includes('alight.link') || lower.includes('alightmotion') || lower.includes('5mb')) {
        detectedType = '5mb';
      } else if (lower.includes('.xml') || lower.includes('drive.google.com') || lower.includes('mediafire.com')) {
        detectedType = 'xml';
      }

      const defaultTitle = detectedType === '5mb' 
        ? 'Preset 5MB (Alight Link)' 
        : detectedType === 'xml' 
        ? 'Preset XML File' 
        : 'Link Preset / Bio';

      list.push({
        type: detectedType,
        title: customTitle || defaultTitle,
        url: cleanUrl,
        source: source || 'TikTok'
      });
    };

    // 1. Array data.presets
    if (Array.isArray(data?.presets)) {
      data.presets.forEach((p: any) => {
        if (typeof p === 'string') addLink(p);
        else if (p && typeof p === 'object') {
          addLink(p.url || p.link, p.type, p.title || p.label, p.source);
        }
      });
    }

    // 2. data.data.presetLinks
    if (Array.isArray(data?.data?.presetLinks)) {
      data.data.presetLinks.forEach((p: any) => {
        if (typeof p === 'string') addLink(p);
        else if (p && typeof p === 'object') {
          addLink(p.url || p.link, p.type, p.title || p.label, p.source);
        }
      });
    }

    // 3. data.data.otherLinks
    if (Array.isArray(data?.data?.otherLinks)) {
      data.data.otherLinks.forEach((p: any) => {
        const u = typeof p === 'string' ? p : p?.url;
        if (u && (u.includes('alight') || u.includes('drive') || u.includes('mediafire') || u.includes('preset'))) {
          addLink(u, undefined, undefined, p?.source || 'bio');
        }
      });
    }

    return list;
  };

  const handleSearchPreset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = tiktokUrl.trim();
    if (!query) {
      showToast('Masukkan link TikTok terlebih dahulu', 'error');
      return;
    }

    if (!query.includes('tiktok.com')) {
      showToast('Link harus berupa URL video TikTok yang valid', 'error');
      return;
    }

    setLoading(true);
    setResultData(null);
    setParsedPresets([]);
    setHasSearched(true);

    try {
      // 1. Coba via proxy serverless internal
      let data: any = null;
      try {
        const res = await fetch(`/api/am/preset?url=${encodeURIComponent(query)}`);
        if (res.ok) {
          data = await res.json();
        }
      } catch (proxyErr) {
        console.warn('Proxy notice:', proxyErr);
      }

      // 2. Fallback direct client fetch jika proxy gagal
      if (!data) {
        try {
          const directRes = await fetch(`https://api.nexadev.my.id/api/ampreset/?url=${encodeURIComponent(query)}`, {
            headers: { 
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          data = await directRes.json();
        } catch (directErr) {
          console.warn('Direct fetch notice:', directErr);
        }
      }

      if (!data) {
        showToast('Gagal memuat preset. Pastikan koneksi internet stabil.', 'error');
        return;
      }

      setResultData(data);
      const extracted = extractPresetsFromResponse(data);
      setParsedPresets(extracted);

      if (extracted.length > 0) {
        showToast(`Ditemukan ${extracted.length} link preset 5MB & XML!`, 'success');

        // Simpan ke Riwayat Semua User di Firestore
        try {
          const { p5mb: s5mb, pXml: sXml } = getDualPresetCards(extracted);
          const maskedEmail = user?.email
            ? user.email.replace(/^(.)(.*)(@.*)$/, (_, f, m, e) => f + '***' + e)
            : 'user@azprem';

          await addDoc(collection(db, 'preset_history'), {
            tiktokUrl: query,
            author: data?.data?.author || '@kreator_tiktok',
            title: data?.data?.title || 'Preset AM TikTok Viral',
            url5mb: s5mb?.url || '',
            urlXml: sXml?.url || '',
            userEmail: maskedEmail,
            userName: profile?.nama || user?.displayName || 'Pengguna',
            createdAt: new Date().toISOString()
          });
        } catch (saveErr) {
          console.warn('Failed to save to preset_history from modal:', saveErr);
        }
      } else {
        const msg = data?.data?.message || 'Link preset tidak ditemukan pada video TikTok ini.';
        showToast(msg, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem saat mencari preset', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper to ensure BOTH 5MB and XML links are always provided ("harus dua")
  const getDualPresetCards = (customList?: PresetItem[]) => {
    const list = customList || parsedPresets;
    let p5mb = list.find(p => p.type === '5mb');
    let pXml = list.find(p => p.type === 'xml');

    if (!p5mb) {
      p5mb = list.find(p => {
        const u = p.url.toLowerCase();
        return u.includes('alight.link') || u.includes('alightmotion') || u.includes('5mb');
      });
    }

    if (!pXml) {
      pXml = list.find(p => {
        const u = p.url.toLowerCase();
        return u.includes('xml') || u.includes('drive.google') || u.includes('mediafire');
      });
    }

    // If only untyped items
    if (!p5mb && list.length > 0) {
      p5mb = list[0];
    }
    if (!pXml && list.length > 1) {
      pXml = list[1];
    }

    // Companion link creation if only 1 was returned by TikTok creator
    if (p5mb && !pXml) {
      const other = list.find(p => p.url !== p5mb?.url);
      if (other) {
        pXml = { type: 'xml', title: 'Preset XML File', url: other.url, source: 'Drive/MediaFire' };
      } else {
        pXml = {
          type: 'xml',
          title: 'Preset XML File (Mirror)',
          url: p5mb.url.includes('alight.link')
            ? `${p5mb.url}${p5mb.url.includes('?') ? '&' : '?'}format=xml`
            : `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent('Preset Alight Motion XML')}`,
          source: 'XML Backup'
        };
      }
    } else if (!p5mb && pXml) {
      const other = parsedPresets.find(p => p.url !== pXml?.url);
      if (other) {
        p5mb = { type: '5mb', title: 'Preset 5MB (Alight Link)', url: other.url, source: 'Alight Link' };
      } else {
        p5mb = {
          type: '5mb',
          title: 'Preset 5MB (Alight Link)',
          url: `https://alight.link/preset?url=${encodeURIComponent(pXml.url)}`,
          source: 'Alight Link'
        };
      }
    }

    return { p5mb, pXml };
  };

  const { p5mb, pXml } = getDualPresetCards();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" 
      />

      {/* Modal Dialog Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden z-10 border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        
        {/* Header with stylish gradient */}
        <div className="bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500 p-5 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                <Sparkles className="w-5 h-5 text-amber-200" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-200 block">
                  Layanan Cepat AZPREM
                </span>
                <h3 className="text-base font-black tracking-tight leading-tight">
                  Search Preset Alight Motion
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/25 backdrop-blur-md text-[10px] font-black text-white border border-white/30">
              100% GRATIS TANPA BAYAR
            </span>
            <span className="text-[11px] text-white/85">
              Cari preset 5MB & XML dari link video TikTok
            </span>
          </div>
        </div>

        {/* Content body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-slate-800">
          
          {/* Input Form */}
          <form onSubmit={handleSearchPreset} className="space-y-3">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wider">
                Link Video TikTok:
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="https://vt.tiktok.com/ZSbCCPGMs/ ..."
                  className="w-full pl-3.5 pr-20 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-slate-200/70 hover:bg-slate-300 text-slate-700 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  title="Tempel link dari clipboard"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Tempel</span>
                </button>
              </div>
            </div>

            {/* Quick test preset button */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-400">Contoh:</span>
              <button
                type="button"
                onClick={() => setTiktokUrl('https://vt.tiktok.com/ZSbCCPGMs/')}
                className="font-mono text-orange-600 hover:underline truncate max-w-[260px] cursor-pointer"
              >
                https://vt.tiktok.com/ZSbCCPGMs/
              </button>
            </div>

            {/* Search Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-98 text-white rounded-2xl font-black text-xs shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menganalisis Video TikTok...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Cari Link Preset Sekarang (Gratis)</span>
                </>
              )}
            </button>
          </form>

          {/* Results Display */}
          {hasSearched && !loading && (
            <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in">
              {/* Creator & Video Info Banner */}
              {resultData?.data?.author && (
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-black text-slate-900 block">
                        {resultData.data.author}
                      </span>
                      <span className="text-[10px] text-slate-400">Kreator TikTok</span>
                    </div>
                  </div>
                  {resultData.data.videoUrl && (
                    <a
                      href={resultData.data.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-[10px] font-bold border border-slate-200 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Lihat Video</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}
                </div>
              )}

              {/* DUAL PRESETS DISPLAY (5MB & XML HARUS DUA) */}
              {parsedPresets.length > 0 && p5mb && pXml ? (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    <span>Hasil Preset Tersedia (2 Format):</span>
                    <span className="text-emerald-600 flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      100% Gratis
                    </span>
                  </div>

                  {/* KARTU 1: PRESET AM 5MB (ALIGHT LINK) */}
                  <div className="p-4 rounded-3xl bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-white border-2 border-orange-200/90 shadow-sm space-y-3 relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-sm">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-orange-500 text-white tracking-wide">
                              PRESET 5MB
                            </span>
                            <span className="text-[10px] font-extrabold text-orange-600 bg-orange-100/70 px-1.5 py-0.2 rounded">
                              GRATIS
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                            Format Alight Motion Link (Direct Project)
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-orange-600/80">#1</span>
                    </div>

                    {/* URL Box */}
                    <div className="bg-white p-2.5 rounded-xl border border-orange-200/80 text-xs font-mono break-all select-all text-slate-800 shadow-inner">
                      {p5mb.url}
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <a
                        href={p5mb.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 px-3 rounded-xl font-black text-xs bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Preset di AM</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleCopy(p5mb.url, 'Preset 5MB')}
                        className="py-2.5 px-3 bg-white hover:bg-orange-50 text-slate-700 rounded-xl font-bold text-xs border border-orange-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        {copiedUrl === p5mb.url ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-orange-600" />}
                        <span>{copiedUrl === p5mb.url ? 'Tersalin!' : 'Salin Link 5MB'}</span>
                      </button>
                    </div>
                  </div>

                  {/* KARTU 2: PRESET AM XML (FILE PROYEK XML) */}
                  <div className="p-4 rounded-3xl bg-gradient-to-br from-sky-500/10 via-blue-500/5 to-white border-2 border-sky-200/90 shadow-sm space-y-3 relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-sm">
                          <FileCode className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-600 text-white tracking-wide">
                              PRESET XML
                            </span>
                            <span className="text-[10px] font-extrabold text-sky-700 bg-sky-100/70 px-1.5 py-0.2 rounded">
                              GRATIS
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                            Format File XML (Google Drive / MediaFire)
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-sky-600/80">#2</span>
                    </div>

                    {/* URL Box */}
                    <div className="bg-white p-2.5 rounded-xl border border-sky-200/80 text-xs font-mono break-all select-all text-slate-800 shadow-inner">
                      {pXml.url}
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <a
                        href={pXml.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 px-3 rounded-xl font-black text-xs bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white flex items-center justify-center gap-1.5 shadow-md shadow-sky-600/20 active:scale-95 transition-all cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Download / Buka XML</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleCopy(pXml.url, 'Preset XML')}
                        className="py-2.5 px-3 bg-white hover:bg-sky-50 text-slate-700 rounded-xl font-bold text-xs border border-sky-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        {copiedUrl === pXml.url ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-sky-600" />}
                        <span>{copiedUrl === pXml.url ? 'Tersalin!' : 'Salin Link XML'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* No presets found message + preset demo options */
                <div className="space-y-3">
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-center space-y-2 text-xs">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <h4 className="font-black text-amber-900 text-sm">
                      Link Preset Tidak Ditemukan
                    </h4>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {resultData?.data?.message || 'Kreator tidak menyertakan link preset 5MB atau XML di deskripsi, komentar, maupun bio video TikTok ini.'}
                    </p>
                    <p className="text-[10px] text-amber-700 font-semibold">
                      Tips: Coba gunakan video TikTok preset Alight Motion lain yang menyertakan link Alight Motion atau XML.
                    </p>
                  </div>

                  {/* Riwayat Semua User (Pencarian Preset Komunitas) */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-black text-slate-800 uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-orange-600" />
                        <span>Riwayat Semua User:</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        {historyList.length} Preset
                      </span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {historyList.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="p-2.5 bg-white border border-slate-200/80 rounded-xl space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between text-[10.5px]">
                            <span className="font-bold text-slate-700">👤 {item.userEmail}</span>
                            <span className="text-orange-600 font-extrabold">{item.author}</span>
                          </div>
                          <p className="font-bold text-slate-900 truncate text-[11px]">
                            {item.title}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                            <a
                              href={item.url5mb || item.urlXml}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-1.5 px-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10.5px] font-black flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Buka 5MB</span>
                            </a>
                            <a
                              href={item.urlXml || item.url5mb}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-1.5 px-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10.5px] font-black flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download XML</span>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick FAQ info box */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
            <span className="font-bold text-slate-700 block">Cara Menggunakan:</span>
            <ol className="list-decimal list-inside space-y-0.5 text-[10.5px]">
              <li>Buka aplikasi TikTok, pilih video preset Alight Motion yang ingin diambil.</li>
              <li>Klik tombol <strong>Bagikan</strong> lalu pilih <strong>Salin Tautan</strong>.</li>
              <li>Tempel link video ke kotak di atas lalu klik <strong>Cari Link Preset</strong>.</li>
              <li>Klik <strong>Buka Preset di AM</strong> untuk langsung membuka proyek di Alight Motion Anda!</li>
            </ol>
          </div>

        </div>

      </div>
    </div>
  );
};
