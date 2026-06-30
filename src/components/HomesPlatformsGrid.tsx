import React, { useState, useEffect } from "react";
import { 
  Play, Search, Clock, Heart, Plus, Trash2, ShieldAlert, 
  Folder, Compass, Music, Settings, Tv, Globe, RefreshCw, CheckCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../types";

// Static premium mock assets that play actual high-quality synchronized open-source files
const BRAND_PRESETS: Record<string, any[]> = {
  YouTube: [
    {
      title: "Иван Васильевич меняет профессию (Советская комедия)",
      url: "https://www.youtube.com/watch?v=a50qT9bW_T0",
      thumbnail: "🍿",
      duration: "1:33:00",
      views: "15M"
    },
    {
      title: "Операция «Ы» и другие приключения Шурика",
      url: "https://www.youtube.com/watch?v=1stL8U6K2_0",
      thumbnail: "🎬",
      duration: "1:35:00",
      views: "21M"
    },
    {
      title: "Путешествие по Камчатке: Гейзеры и ледники",
      url: "https://www.youtube.com/watch?v=2K4Vb68MskE",
      thumbnail: "🦊",
      duration: "42:00",
      views: "890K"
    },
    {
      title: "Rick Astley - Never Gonna Give You Up",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      thumbnail: "🎮",
      duration: "3:32",
      views: "1.4B"
    }
  ],
  VKVideo: [
    {
      title: "VK Fest: Главное Шоу и Выступления",
      url: "https://vk.com/video_ext.php?oid=-220550000&id=456239149",
      thumbnail: "🎵",
      duration: "3:45:00",
      views: "4.8M"
    },
    {
      title: "VK Видео трейлер: Лучшие Эксклюзивы 2026",
      url: "https://vk.com/video_ext.php?oid=-220550000&id=456239150",
      thumbnail: "📺",
      duration: "2:15",
      views: "1.2M"
    }
  ],
  RUTUBE: [
    {
      title: "Rutube Наука: Тайны времени и квантовой физики",
      url: "https://rutube.ru/video/bc04f35e9f85c479e497f1fbc71db441/",
      thumbnail: "🚀",
      duration: "24:15",
      views: "220K"
    },
    {
      title: "Космос Рутуб: Снимки черной дыры в 8К",
      url: "https://rutube.ru/video/3cb33a92b23a9d7bb36093fbdb5949d1/",
      thumbnail: "🌌",
      duration: "12:00",
      views: "85K"
    }
  ],
  Netflix: [
    {
      title: "Sintel (Netflix Original Animated Sci-Fi Trailer)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
      thumbnail: "🧙",
      duration: "14:48",
      views: "32M",
      category: "Sci-Fi / Animation"
    },
    {
      title: "Tears of Steel (VFX Blockbuster Showcase)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
      thumbnail: "🤖",
      duration: "12:14",
      views: "18M",
      category: "Cyberpunk"
    },
    {
      title: "Big Buck Bunny (Family Adventure CGI)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      thumbnail: "🐰",
      duration: "9:56",
      views: "54M",
      category: "Comedy / Family"
    }
  ],
  Prime: [
    {
      title: "Caminandes: Llama's Quest (Prime Original Short)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
      thumbnail: "🦙",
      duration: "2:30",
      views: "4.5M",
      category: "Comedy Short"
    },
    {
      title: "Elephants Dream (Prime Premium VFX)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
      thumbnail: "🐘",
      duration: "10:53",
      views: "8M",
      category: "Surreal Drama"
    }
  ],
  Twitch: [
    {
      title: "Official ESR Esports Stream (Live Replay)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
      thumbnail: "🎮",
      duration: "Live",
      views: "450K"
    },
    {
      title: "Retro Arcade Marathon with Host DJ",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      thumbnail: "👾",
      duration: "Live",
      views: "230K"
    }
  ],
  YTLive: [
    {
      title: "NASA Space Live: Космическая Спецтрансляция МКС",
      url: "https://www.youtube.com/watch?v=21X5lGlDOfg",
      thumbnail: "🛰️",
      duration: "LIVE",
      views: "89K watching"
    },
    {
      title: "Lo-Fi Beats Study Study: Музыка для Релакса и Кодинга",
      url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      thumbnail: "☕",
      duration: "LIVE",
      views: "120K watching"
    }
  ],
  Drive: [
    {
      title: "Iceland_4K_Cinematic_Vlog.mp4",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
      thumbnail: "📂",
      duration: "1:00",
      views: "Private Drive File"
    },
    {
      title: "Summer_Pool_Party_With_Friends.mov",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      thumbnail: "🏊",
      duration: "0:15",
      views: "Private Drive File"
    }
  ],
  Photos: [
    {
      title: "Family_Vacation_Cooking_Sunset.mp4",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
      thumbnail: "☀️",
      duration: "0:15",
      views: "My Photo Stream"
    },
    {
      title: "Pet_Puppy_Chasing_Bubbles_Epic_Moment.mp4",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
      thumbnail: "🐶",
      duration: "0:15",
      views: "My Photo Stream"
    }
  ],
  HomesDJ: [
    {
      title: "Epic Dance Drum & Bass vs Lo-Fi Beat Remix",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
      thumbnail: "💿",
      duration: "5:30",
      views: "Homes DJ Automated Mix"
    }
  ],
  Karaoke: [
    {
      title: "Сплин - Выхода нет (Караоке Инструментал с текстом)",
      url: "https://www.youtube.com/watch?v=680w8A6K7G8",
      thumbnail: "🎤",
      duration: "3:45",
      views: "Karaoke Special"
    },
    {
      title: "Король и Шут - Лесник (Текст песни & Караоке)",
      url: "https://www.youtube.com/watch?v=0k1L7K7r47c",
      thumbnail: "🧛",
      duration: "3:10",
      views: "Karaoke Special"
    },
    {
      title: "Queen - Bohemian Rhapsody (Official Karaoke Lyrics)",
      url: "https://www.youtube.com/watch?v=F3F7z9iF_Fw",
      thumbnail: "👑",
      duration: "5:55",
      views: "Karaoke Special"
    }
  ]
};

interface HomesPlatformsGridProps {
  onSelectVideo: (url: string) => void;
  userProfile?: UserProfile | null;
  className?: string;
}

export default function HomesPlatformsGrid({ 
  onSelectVideo, 
  userProfile,
  className = "" 
}: HomesPlatformsGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [localHistory, setLocalHistory] = useState<any[]>([]);
  const [likedList, setLikedList] = useState<any[]>([]);
  const [customPlaylist, setCustomPlaylist] = useState<any[]>([]);
  
  // Custom link states for manually entered videos
  const [customUrl, setCustomUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  // Sync / load watch history & likes
  const fetchLocalData = () => {
    try {
      const histStr = localStorage.getItem("homes_guest_history") || "[]";
      setLocalHistory(JSON.parse(histStr));

      const likesStr = localStorage.getItem("homes_guest_likes") || "[]";
      setLikedList(JSON.parse(likesStr));

      const playStr = localStorage.getItem("homes_guest_playlist") || "[]";
      setCustomPlaylist(JSON.parse(playStr));
    } catch (e) {
      console.warn("Failed loading storage items", e);
    }
  };

  useEffect(() => {
    fetchLocalData();
    window.addEventListener("homes_history_updated", fetchLocalData);
    return () => {
      window.removeEventListener("homes_history_updated", fetchLocalData);
    };
  }, []);

  // Compute unified user watching history dynamically
  const unifiedHistory = (() => {
    const firestoreHistory = userProfile?.history || [];
    // Convert Firestore history to standard component format
    const formattedFirestore = firestoreHistory.map((item: any) => ({
      title: item.title || "Просмотренное видео",
      url: item.videoUrl,
      thumbnail: "🎬",
      duration: item.duration || "0:15:00",
      views: `${item.membersCount || 1} участников`,
      timestamp: item.watchedAt
    }));

    // Localguest format
    const formattedLocal = localHistory.map((item: any) => ({
      title: item.title || "Просмотренное видео",
      url: item.videoUrl,
      thumbnail: item.thumbnail || "🍿",
      duration: item.duration || "15:00",
      views: `${item.membersCount || 1} участников`,
      timestamp: item.watchedAt
    }));

    // Combine & sort by timestamp descending
    const combined = [...formattedFirestore, ...formattedLocal];
    const uniqueMap = new Map();
    combined.forEach(item => {
      // De-duplicate by URL to keep only most recent
      if (!uniqueMap.has(item.url)) {
        uniqueMap.set(item.url, item);
      } else {
        const existing = uniqueMap.get(item.url);
        if (item.timestamp > existing.timestamp) {
          uniqueMap.set(item.url, item);
        }
      }
    });

    return Array.from(uniqueMap.values()).sort((a,b) => b.timestamp - a.timestamp);
  })();

  // Compute Unified Likes list
  const unifiedLikes = (() => {
    const firestoreLikes = userProfile?.favorites || [];
    const formattedFirestore = firestoreLikes.map((url: string) => ({
      title: "Пользовательская закладка",
      url,
      thumbnail: "❤️",
      duration: "Ссылка",
      views: "Избранное клуба"
    }));

    const formattedLocal = likedList.map((item: any) => ({
      title: item.title || "Любимое видео",
      url: item.videoUrl,
      thumbnail: "💖",
      duration: "Лайк",
      views: "Локальный лайк"
    }));

    const combined = [...formattedFirestore, ...formattedLocal];
    const uniqueMap = new Map();
    combined.forEach(item => {
      uniqueMap.set(item.url, item);
    });
    return Array.from(uniqueMap.values());
  })();

  const handleAddCustomPlaylistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl) return;
    const title = customTitle.trim() || `Пользовательский стрим #${customPlaylist.length + 1}`;
    
    const newItem = {
      title,
      url: customUrl,
      thumbnail: "⭐",
      duration: "Web Видео",
      views: "Плейлист"
    };

    const updated = [newItem, ...customPlaylist].slice(0, 50);
    setCustomPlaylist(updated);
    localStorage.setItem("homes_guest_playlist", JSON.stringify(updated));
    setCustomUrl("");
    setCustomTitle("");
  };

  const handleDeletePlaylistItem = (url: string) => {
    const updated = customPlaylist.filter(v => v.url !== url);
    setCustomPlaylist(updated);
    localStorage.setItem("homes_guest_playlist", JSON.stringify(updated));
  };

  // Render list of matching items based on selected category or search query
  const getRenderItems = () => {
    const trimQuery = searchQuery.trim().toLowerCase();

    if (activeCategory === "History") {
      return unifiedHistory.filter(v => v.title.toLowerCase().includes(trimQuery));
    }
    if (activeCategory === "Likes") {
      return unifiedLikes.filter(v => v.title.toLowerCase().includes(trimQuery));
    }
    if (activeCategory === "Playlist") {
      return customPlaylist.filter(v => v.title.toLowerCase().includes(trimQuery));
    }

    if (activeCategory && BRAND_PRESETS[activeCategory]) {
      return BRAND_PRESETS[activeCategory].filter(v => v.title.toLowerCase().includes(trimQuery));
    }

    // If search typed but no category, search everywhere
    if (trimQuery) {
      const allPresets = Object.values(BRAND_PRESETS).flat();
      const combined = [...allPresets, ...unifiedHistory, ...unifiedLikes, ...customPlaylist];
      const unique = Array.from(new Map(combined.map(item => [item.url, item])).values());
      return unique.filter(v => v.title.toLowerCase().includes(trimQuery));
    }

    return null;
  };

  const renderItems = getRenderItems();

  // Platforms definition with matching exact logo visual
  const platforms = [
    { id: "YouTube", name: "YouTube", customStyle: "bg-red-600/10 hover:bg-red-600/20 border-red-500/20 text-red-400 font-black tracking-tighter" },
    { id: "X", name: "X", customStyle: "bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-white font-display" },
    { id: "VKVideo", name: "VK Видео", customStyle: "bg-blue-600/10 hover:bg-blue-600/20 border-blue-500/20 text-blue-400 font-bold" },
    { id: "RUTUBE", name: "RUTUBE", customStyle: "bg-emerald-600/10 hover:bg-emerald-600/20 border-emerald-500/20 text-emerald-400 font-display font-bold uppercase tracking-widest" },
    { id: "Netflix", name: "NETFLIX", customStyle: "bg-[#E50914]/10 hover:bg-[#E50914]/20 border-red-600/30 text-rose-500 font-extrabold uppercase tracking-widest" },
    { id: "Prime", name: "prime", customStyle: "bg-cyan-600/15 hover:bg-cyan-600/25 border-cyan-500/30 text-cyan-400 font-sans italic tracking-tighter font-black" },
    { id: "Twitch", name: "twitch", customStyle: "bg-purple-600/10 hover:bg-purple-600/20 border-purple-500/20 text-purple-400 font-sans font-extrabold lowercase" },
    { id: "YTLive", name: "🔴 LIVE", customStyle: "bg-indigo-600/10 hover:bg-indigo-600/20 border-indigo-500/20 text-indigo-400 font-semibold" },
    { id: "Playlist", name: "Playlist", customStyle: "bg-emerald-500/5 hover:bg-emerald-500/15 border-emerald-500/20 text-emerald-300 font-serif italic text-base" },
    { id: "Drive", name: "▲ Drive", customStyle: "bg-yellow-600/10 hover:bg-yellow-600/20 border-yellow-500/20 text-yellow-500 font-mono" },
    { id: "Photos", name: "☘ Photos", customStyle: "bg-teal-600/10 hover:bg-teal-600/20 border-teal-500/20 text-teal-400 font-sans font-semibold" },
    { id: "Web", name: "🌐 WEB", customStyle: "bg-[#251842] hover:bg-[#322159] border-indigo-500/20 text-white font-mono font-bold" },
    { id: "HomesDJ", name: "homes DJ", customStyle: "bg-rose-600/10 hover:bg-rose-600/20 border-rose-500/20 text-rose-400 font-serif font-black underline tracking-wide" },
    { id: "Karaoke", name: "🎤 Karaoke", customStyle: "bg-amber-600/10 hover:bg-amber-600/20 border-amber-500/20 text-amber-500 font-bold" },
    { id: "Likes", name: "💖 Likes", customStyle: "bg-pink-600/10 hover:bg-pink-600/20 border-pink-500/20 text-pink-400 font-black italic tracking-wider" },
    { id: "History", name: "🕘 History", customStyle: "bg-zinc-800/10 hover:bg-zinc-800/20 border-zinc-500/20 text-zinc-300 font-semibold uppercase tracking-wider" }
  ];

  return (
    <div className={`bg-zinc-900/40 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl w-full ${className}`}>
      {/* Sferium / Homes Header */}
      <div className="flex items-center justify-between mb-4.5 select-none">
        <div className="flex items-center gap-2">
          <Tv className="w-5 h-5 text-indigo-400 animate-pulse" />
          <h3 className="font-display font-extrabold text-sm sm:text-base text-zinc-100 uppercase tracking-wider">
            {activeCategory ? `МЕДИА / ${activeCategory.toUpperCase()}` : "ПЛОЩАДКИ И СТРИМИНГ"}
          </h3>
        </div>
        {activeCategory && (
          <button
            onClick={() => {
              setActiveCategory(null);
              setSearchQuery("");
            }}
            className="text-[10px] bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-300 font-bold px-2.5 py-1 rounded-lg uppercase transition-all"
          >
            ← К площадкам
          </button>
        )}
      </div>

      {/* Styled homes-style search bar: "искать видео, сериал или фильм..." */}
      <div className="relative mb-5 w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="искать видео, сериал или фильм..."
          className="w-full bg-zinc-950 text-xs sm:text-sm pl-10 pr-10 py-3.5 h-12 rounded-xl border border-zinc-850 outline-none focus:border-indigo-500/50 transition-colors placeholder-zinc-500 text-zinc-100 shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300 font-bold"
          >
            Сброс
          </button>
        )}
      </div>

      {/* Search results or Category listing if selected */}
      <AnimatePresence mode="wait">
        {renderItems !== null ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar"
          >
            {activeCategory === "Playlist" && (
              <form onSubmit={handleAddCustomPlaylistItem} className="bg-zinc-950/60 p-3 rounded-2xl border border-zinc-850 mb-3 space-y-2">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Добавить свою ссылку в Playlist</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Вставьте ссылку (.mp4, YouTube, Rutube, VK...)"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="flex-1 bg-zinc-900 text-xs p-2 rounded-lg outline-none border border-zinc-800 focus:border-indigo-500/50"
                  />
                  <input
                    type="text"
                    placeholder="Название (опционально)..."
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="sm:w-1/3 bg-zinc-900 text-xs p-2 rounded-lg outline-none border border-zinc-800 focus:border-indigo-500/50"
                  />
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-2 text-xs font-bold transition-colors">
                    + Добавить
                  </button>
                </div>
              </form>
            )}

            {renderItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500 select-none flex flex-col items-center justify-center gap-2">
                <span>📁 Видео не найдены в этой секции.</span>
                {activeCategory === "History" && (
                  <span className="text-[10px] opacity-70">История появится после просмотра видео внутри комнаты!</span>
                )}
                {activeCategory === "Likes" && (
                  <span className="text-[10px] opacity-70">Добавляйте видео в Избранное из личного кабинета, чтобы они появились здесь.</span>
                )}
              </div>
            ) : (
              renderItems.map((video, idx) => (
                <div 
                  key={video.url + "_" + idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/40 border border-zinc-900/50 hover:border-indigo-500/30 transition-all select-none group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-xl bg-zinc-900 w-10 h-10 shrink-0 flex items-center justify-center rounded-xl">{video.thumbnail || "🎬"}</span>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-indigo-400 transition-colors truncate max-w-[200px] sm:max-w-[180px] md:max-w-[280px]">
                        {video.title}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-bold text-zinc-400 bg-zinc-850 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                          {activeCategory || "Каталог"}
                        </span>
                        <span className="text-[9px] text-zinc-500 font-mono shrink-0">{video.duration}</span>
                        <span className="text-[9px] text-zinc-500 shrink-0">• {video.views || "100K просмотров"}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {activeCategory === "Playlist" && (
                      <button 
                        onClick={() => handleDeletePlaylistItem(video.url)}
                        className="p-1 px-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded-lg text-[9px] font-bold uppercase transition-all"
                        title="Удалить из плейлиста"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectVideo(video.url)}
                      className="px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-all text-[10px] font-bold rounded-xl uppercase tracking-wider cursor-pointer"
                    >
                      Смотреть
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        ) : (
          /* Homes Classic 4x4 Grid view */
          <motion.div 
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5 select-none"
          >
            {platforms.map((platform) => {
              // Get item count / active flag
              let subLabel = "Каталог";
              if (platform.id === "History") {
                subLabel = unifiedHistory.length > 0 ? `${unifiedHistory.length} видео` : "История";
              } else if (platform.id === "Likes") {
                subLabel = unifiedLikes.length > 0 ? `${unifiedLikes.length} видео` : "Любимое";
              } else if (platform.id === "Playlist") {
                subLabel = customPlaylist.length > 0 ? `${customPlaylist.length} треков` : "Свой список";
              } else if (BRAND_PRESETS[platform.id]) {
                subLabel = `${BRAND_PRESETS[platform.id].length} стримов`;
              }

              return (
                <button
                  type="button"
                  key={platform.id}
                  onClick={() => {
                    if (platform.id === "Web") {
                      setActiveCategory("Web");
                      setSearchQuery("");
                      // Also fill in sample custom entry
                      return;
                    }
                    setActiveCategory(platform.id);
                  }}
                  className={`relative overflow-hidden cursor-pointer h-24 rounded-2xl border flex flex-col justify-between p-4.5 transition-all text-left group shadow-lg ${platform.customStyle}`}
                >
                  {/* Outer gradient hover sweep animation */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  
                  <div className="flex justify-between items-start w-full">
                    {/* Platform Brand Styled Text Render */}
                    <span className="text-xl sm:text-2xl tracking-tight leading-none">
                      {platform.name}
                    </span>
                    <Play className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all text-white fill-white" />
                  </div>

                  <div className="flex justify-between items-center w-full">
                    <span className="text-[10px] text-zinc-400 font-mono scale-95 tracking-tight group-hover:text-zinc-200 transition-colors">
                      {subLabel}
                    </span>
                    {platform.id === "History" && unifiedHistory.length > 0 && (
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.5 rounded">ЛОГ</span>
                    )}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual raw Web video input panel if activeCategory is Web */}
      <AnimatePresence>
        {activeCategory === "Web" && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 bg-zinc-950 p-4 rounded-2xl border border-zinc-850 space-y-3"
          >
            <div className="flex gap-1.5 items-center">
              <Globe className="w-4 h-4 text-indigo-400" />
              <p className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Подключение любого интернет-видео</p>
            </div>
            <p className="text-[10px] text-zinc-500 leading-normal">
              Вставьте прямой URL адрес к любому потоковому .mp4, HLS (.m3u8), YouTube ссылку или фрейм вставки. Sferium синхронизирует его для вашего клуба трансляций!
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://example.com/movie.mp4 или любая ссылка..."
                className="flex-1 bg-zinc-900 text-xs px-3 py-2.5 rounded-xl border border-zinc-800 outline-none focus:border-indigo-500 text-zinc-100"
              />
              <button
                onClick={() => {
                  if (customUrl) {
                    onSelectVideo(customUrl);
                    setCustomUrl("");
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-550 text-white text-xs font-bold px-4 rounded-xl transition-all"
              >
                Запуск
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
