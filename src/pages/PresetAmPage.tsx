import React, { useState, useEffect } from 'react';
import { 
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
  Flame,
  ArrowLeft,
  Download,
  HelpCircle,
  Share2,
  Film,
  History,
  Clock,
  Users,
  ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, collection, addDoc, query, orderBy, limit, onSnapshot } from '../firebase';

interface PresetAmPageProps {
  onBack?: () => void;
  onGoToOrder?: () => void;
}

interface PresetItem {
  type: '5mb' | 'xml' | 'other';
  title: string;
  url: string;
  source?: string;
}

export interface PresetHistoryItem {
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

// Data awal riwayat preset komunitas pengguna
const SEED_COMMUNITY_HISTORY: PresetHistoryItem[] = [
  {
    id: 'seed-1',
    tiktokUrl: 'https://vt.tiktok.com/ZSbCCPGMs/',
    author: '@xeinzpreset',
    title: 'Jedag Jedug Mengkane Sound Viral Full Bass',
    url5mb: 'https://alight.link/H8mGq',
    urlXml: 'https://drive.google.com/file/d/1sample_preset_jedag_jedug_xml/view',
    userEmail: 'ak***@gmail.com',
    userName: 'Akon',
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
    userName: 'Rian',
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
    userName: 'Bayu AM',
    createdAt: new Date(Date.now() - 1000 * 60 * 65).toISOString()
  },
  {
    id: 'seed-4',
    tiktokUrl: 'https://vt.tiktok.com/ZSbCC991C/',
    author: '@djpim.am',
    title: 'DJ Basuri Remix Jedag Jedug Kane No Counter',
    url5mb: 'https://alight.link/preset?id=dj_basuri_remix_5mb',
    urlXml: 'https://drive.google.com/file/d/1sample_dj_basuri_xml/view',
    userEmail: 'dim***@gmail.com',
    userName: 'Dimas',
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  }
];

export const PresetAmPage: React.FC<PresetAmPageProps> = ({ onBack, onGoToOrder }) => {
  const { user, profile, showToast } = useAuth();
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState<any | null>(null);
  const [parsedPresets, setParsedPresets] = useState<PresetItem[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [historyList, setHistoryList] = useState<PresetHistoryItem[]>(SEED_COMMUNITY_HISTORY);
  const [historyFilter, setHistoryFilter] = useState('');

  // Subscribe real-time ke koleksi Firestore preset_history (Riwayat Semua User)
  useEffect(() => {
    try {
      const q = query(collection(db, 'preset_history'), orderBy('createdAt', 'desc'), limit(30));
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
        console.warn('preset_history subscription notice:', err);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Failed to listen to preset_history:', err);
    }
  }, []);

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
      showToast('Masukkan link video TikTok terlebih dahulu', 'error');
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
      // 1. Coba proxy serverless internal
      let data: any = null;
      try {
        const res = await fetch(`/api/am/preset?url=${encodeURIComponent(query)}`);
        if (res.ok) {
          data = await res.json();
        }
      } catch (proxyErr) {
        console.warn('Proxy notice:', proxyErr);
      }

      // 2. Fallback direct client fetch
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
        showToast(`Berhasil menemukan ${extracted.length} link preset 5MB & XML!`, 'success');

        // Otomatis simpan ke Riwayat Semua User di Firestore
        try {
          const { p5mb: saved5mb, pXml: savedXml } = getDualPresetCards(extracted);
          const maskedEmail = user?.email
            ? user.email.replace(/^(.)(.*)(@.*)$/, (_, f, m, e) => f + '***' + e)
            : 'user@azprem';

          const newHistoryItem: any = {
            tiktokUrl: query,
            author: data?.data?.author || '@kreator_tiktok',
            title: data?.data?.title || (data?.data?.author ? `Preset Alight Motion by ${data.data.author}` : 'Preset Alight Motion Viral TikTok'),
            url5mb: saved5mb?.url || '',
            urlXml: savedXml?.url || '',
            userEmail: maskedEmail,
            userName: profile?.nama || user?.displayName || 'Pengguna',
            createdAt: new Date().toISOString()
          };

          await addDoc(collection(db, 'preset_history'), newHistoryItem);
        } catch (saveErr) {
          console.warn('Failed saving to preset_history:', saveErr);
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

  // Helper to resolve dual 5MB and XML presets
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

    if (!p5mb && list.length > 0) {
      p5mb = list[0];
    }
    if (!pXml && list.length > 1) {
      pXml = list[1];
    }

    // Companion fallback if only 1 was returned by creator
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
      const other = list.find(p => p.url !== pXml?.url);
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
    <div className="max-w-md mx-auto px-4 pb-28 pt-4 space-y-5 animate-in fade-in">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Search Preset AM
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white shadow-sm">
                GRATIS
              </span>
            </div>
            <p className="text-xs text-slate-500">Ambil link preset 5MB & XML dari TikTok</p>
          </div>
        </div>

        {onGoToOrder && (
          <button
            onClick={onGoToOrder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Order AM</span>
          </button>
        )}
      </div>

      {/* Hero Banner: Neon Futuristic Style */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 text-white shadow-xl border border-slate-800/80">
        {/* Glow ambient circles */}
        <div className="absolute -top-12 -right-12 w-44 h-44 bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-orange-500/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Sparkles className="w-3 h-3" />
              TikTok AM Finder
            </span>
            <span className="text-[10px] font-bold text-slate-400 font-mono">
              v2.0 Nexadev
            </span>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
              Cari & Ekstrak Preset Alight Motion
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Cukup tempel link video TikTok, sistem otomatis memunculkan <strong>Preset 5MB</strong> dan <strong>File XML</strong> secara instan & tanpa biaya.
            </p>
          </div>

          <div className="pt-1 flex items-center gap-2 text-[10px] font-bold text-slate-300">
            <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg">
              <Zap className="w-3 h-3 text-orange-400" /> Format 5MB
            </span>
            <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg">
              <FileCode className="w-3 h-3 text-sky-400" /> Format XML
            </span>
          </div>
        </div>
      </div>

      {/* Main Search Input Form Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-md space-y-4">
        <form onSubmit={handleSearchPreset} className="space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-orange-600" />
                <span>Link Video TikTok:</span>
              </label>
              <button
                type="button"
                onClick={handlePaste}
                className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Tempel Otomatis</span>
              </button>
            </div>

            <div className="relative">
              <input
                type="url"
                required
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="https://vt.tiktok.com/ZSbCCPGMs/ ..."
                className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all placeholder:text-slate-400 shadow-inner"
              />
              {tiktokUrl && (
                <button
                  type="button"
                  onClick={() => setTiktokUrl('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Quick example chips */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
            <span className="font-semibold text-slate-400">Contoh link:</span>
            <button
              type="button"
              onClick={() => setTiktokUrl('https://vt.tiktok.com/ZSbCCPGMs/')}
              className="px-2 py-0.5 bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 rounded-lg text-[10px] font-mono transition-colors cursor-pointer truncate max-w-[240px]"
            >
              vt.tiktok.com/ZSbCCPGMs/
            </button>
          </div>

          {/* Glowing Search Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500 hover:from-orange-600 hover:to-rose-600 text-white rounded-2xl font-black text-sm shadow-md shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menganalisis Video TikTok...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 stroke-[2.8]" />
                <span>Cari Preset 5MB & XML Sekarang (Gratis)</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* RESULTS DISPLAY: DUAL 5MB AND XML CARDS */}
      {hasSearched && !loading && (
        <div className="space-y-4 animate-in fade-in">
          {/* Creator Details if available */}
          {resultData?.data?.author && (
            <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <Film className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="font-black text-slate-900 block leading-tight">
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
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Buka Video</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              )}
            </div>
          )}

          {/* DUAL 5MB & XML SECTION (HARUS DUA) */}
          {parsedPresets.length > 0 && p5mb && pXml ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Hasil Link Preset Ditemukan (2 Format)
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <CheckCircle2 className="w-3 h-3" />
                  Siap Pakai
                </span>
              </div>

              {/* CARD 1: PRESET AM 5MB */}
              <div className="bg-white rounded-3xl p-5 border-2 border-orange-200 shadow-md space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-28 h-28 bg-orange-400/10 rounded-full blur-xl pointer-events-none"></div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/25">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-orange-500 text-white tracking-wider">
                          PRESET 5MB
                        </span>
                        <span className="text-[10px] font-extrabold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                          100% GRATIS
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                        Alight Motion Link (Langsung Buka Proyek di App)
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-orange-600">#01</span>
                </div>

                {/* Monospace Link Box */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-mono break-all select-all text-slate-800 shadow-inner">
                  {p5mb.url}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={p5mb.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-3 rounded-2xl font-black text-xs bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 active:scale-95 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Buka Preset di AM</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleCopy(p5mb.url, 'Preset 5MB')}
                    className="py-3 px-3 bg-white hover:bg-orange-50 text-slate-700 rounded-2xl font-bold text-xs border border-orange-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    {copiedUrl === p5mb.url ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-orange-600" />}
                    <span>{copiedUrl === p5mb.url ? 'Tersalin!' : 'Salin Link 5MB'}</span>
                  </button>
                </div>
              </div>

              {/* CARD 2: PRESET AM XML */}
              <div className="bg-white rounded-3xl p-5 border-2 border-sky-200 shadow-md space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-28 h-28 bg-sky-400/10 rounded-full blur-xl pointer-events-none"></div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-sky-600 text-white tracking-wider">
                          PRESET XML
                        </span>
                        <span className="text-[10px] font-extrabold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          100% GRATIS
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                        File XML Proyek (Google Drive / MediaFire)
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-sky-600">#02</span>
                </div>

                {/* Monospace Link Box */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-mono break-all select-all text-slate-800 shadow-inner">
                  {pXml.url}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={pXml.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-3 rounded-2xl font-black text-xs bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white flex items-center justify-center gap-2 shadow-md shadow-sky-600/25 active:scale-95 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download / Buka XML</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleCopy(pXml.url, 'Preset XML')}
                    className="py-3 px-3 bg-white hover:bg-sky-50 text-slate-700 rounded-2xl font-bold text-xs border border-sky-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    {copiedUrl === pXml.url ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-sky-600" />}
                    <span>{copiedUrl === pXml.url ? 'Tersalin!' : 'Salin Link XML'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* If no preset found in the video */
            <div className="space-y-4">
              <div className="bg-amber-50 rounded-3xl p-5 border border-amber-200 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="font-black text-amber-900 text-sm">
                  Link Preset Tidak Ditemukan Pada Video Ini
                </h4>
                <p className="text-xs text-amber-800 leading-relaxed max-w-sm mx-auto">
                  {resultData?.data?.message || 'Kreator tidak menyertakan link preset 5MB atau XML di deskripsi, komentar, maupun bio video TikTok ini.'}
                </p>
                <span className="text-[11px] text-amber-700 font-semibold block">
                  Anda tetap dapat menggunakan preset pada Riwayat Semua User di bawah ini!
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RIWAYAT SEMUA USER (PENCARIAN PRESET KOMUNITAS) */}
      <div className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-xs">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>Riwayat Semua User</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </h3>
              <p className="text-[10.5px] text-slate-500">
                Preset 5MB & XML yang dicari oleh seluruh pengguna AZPREM
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shrink-0">
            {historyList.length} Preset
          </span>
        </div>

        {/* Quick Filter Search Box */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={historyFilter}
            onChange={(e) => setHistoryFilter(e.target.value)}
            placeholder="Cari riwayat user (judul / kreator / email)..."
            className="w-full pl-8 pr-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs"
          />
          {historyFilter && (
            <button
              onClick={() => setHistoryFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* History Cards List */}
        <div className="space-y-3">
          {historyList
            .filter((item) => {
              if (!historyFilter.trim()) return true;
              const q = historyFilter.toLowerCase();
              return (
                item.title?.toLowerCase().includes(q) ||
                item.author?.toLowerCase().includes(q) ||
                item.userEmail?.toLowerCase().includes(q)
              );
            })
            .map((item, idx) => (
              <div
                key={item.id || idx}
                className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-sm space-y-3 hover:border-orange-200 transition-all"
              >
                {/* User & Time Meta Header */}
                <div className="flex items-center justify-between text-[11px] pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                      👤
                    </span>
                    <span className="font-bold text-slate-800">{item.userEmail || 'Pengguna'}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {(() => {
                        if (!item.createdAt) return 'Baru saja';
                        try {
                          const diffSec = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 1000);
                          if (diffSec < 60) return 'Baru saja';
                          if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mnt lalu`;
                          if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
                          return `${Math.floor(diffSec / 86400)} hari lalu`;
                        } catch {
                          return 'Baru saja';
                        }
                      })()}
                    </span>
                  </div>

                  <span className="text-[10px] font-extrabold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">
                    {item.author || '@tiktok'}
                  </span>
                </div>

                {/* Preset Title & Video Link */}
                <div>
                  <h4 className="text-xs font-black text-slate-900 leading-snug">
                    {item.title || 'Preset Alight Motion Viral'}
                  </h4>
                  {item.tiktokUrl && (
                    <div className="flex items-center gap-2 mt-1">
                      <a
                        href={item.tiktokUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10.5px] font-bold text-slate-500 hover:text-orange-600 inline-flex items-center gap-1 truncate max-w-[260px]"
                      >
                        <Video className="w-3 h-3 text-rose-500 shrink-0" />
                        <span className="truncate">{item.tiktokUrl}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>

                {/* DUA TOMBOL PRESET: 5MB & XML (HARUS DUA) */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Button 1: 5MB */}
                  <div className="space-y-1">
                    <a
                      href={item.url5mb || item.urlXml}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 shadow-sm shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Buka 5MB di AM</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.url5mb || item.urlXml, 'Preset 5MB')}
                      className="w-full py-1 text-[10px] font-bold text-slate-500 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin 5MB</span>
                    </button>
                  </div>

                  {/* Button 2: XML */}
                  <div className="space-y-1">
                    <a
                      href={item.urlXml || item.url5mb}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 shadow-sm shadow-sky-600/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download XML</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.urlXml || item.url5mb, 'Preset XML')}
                      className="w-full py-1 text-[10px] font-bold text-slate-500 hover:text-sky-600 bg-slate-50 hover:bg-sky-50 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin XML</span>
                    </button>
                  </div>
                </div>

                {/* Gunakan Ulang Link Video TikTok */}
                <div className="pt-1 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setTiktokUrl(item.tiktokUrl);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      showToast('Link video TikTok dimasukkan ke input pencarian!', 'info');
                    }}
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>Cari Ulang Video Ini</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* PANDUAN IMPORT PRESET AM */}
      <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200/80 space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-orange-500" />
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Panduan Cara Membuka Preset di Alight Motion
          </h4>
        </div>

        <div className="space-y-2 text-xs text-slate-600">
          <div className="p-3 bg-white rounded-2xl border border-slate-200/60 space-y-1">
            <span className="font-extrabold text-orange-600 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> Cara Menggunakan Preset 5MB:
            </span>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Klik tombol <strong>"Buka Preset di AM"</strong>. Browser akan otomatis membuka aplikasi Alight Motion Anda dan mengunduh elemen proyek secara instan.
            </p>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200/60 space-y-1">
            <span className="font-extrabold text-sky-600 flex items-center gap-1">
              <FileCode className="w-3.5 h-3.5" /> Cara Menggunakan Preset XML:
            </span>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Unduh file XML dari Google Drive/MediaFire, buka File Manager, pilih file <strong>.xml</strong>, klik Bagikan (Share) lalu kirim langsung ke aplikasi <strong>Alight Motion</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
