import React, { useState } from "react";
import { 
  Youtube, Tv, Play, Folder, Globe, ArrowRight, Sparkles, Check, LogIn, ExternalLink, Search, Film
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Presets representing popular links for quick testing
const PRESETS: Record<string, Array<{ title: string; url: string; icon: string; length: string }>> = {
  youtube: [
    { title: "Иван Васильевич меняет профессию", url: "https://www.youtube.com/watch?v=a50qT9bW_T0", icon: "🍿", length: "1:33:00" },
    { title: "Операция «Ы» и другие приключения Шурика", url: "https://www.youtube.com/watch?v=1stL8U6K2_0", icon: "🎬", length: "1:35:00" },
    { title: "Rick Astley - Never Gonna Give You Up", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", icon: "🎸", length: "3:32" }
  ],
  vk: [
    { title: "VK Fest: Главное Музыкальное Шоу", url: "https://vk.com/video_ext.php?oid=-220550000&id=456239149", icon: "🎵", length: "3:45:00" },
    { title: "Эксклюзивный трейлер VK Видео 2026", url: "https://vk.com/video_ext.php?oid=-220550000&id=456239150", icon: "🔥", length: "2:15" }
  ],
  rutube: [
    { title: "Rutube Наука: Тайны квантовой физики", url: "https://rutube.ru/video/bc04f35e9f85c479e497f1fbc71db441/", icon: "🔋", length: "24:15" },
    { title: "Космический таймлапс в 8К", url: "https://rutube.ru/video/3cb33a92b23a9d7bb36093fbdb5949d1/", icon: "🌌", length: "12:00" }
  ],
  drive: [
    { title: "Кинематографичный ролик Исландии (direct mp4)", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4", icon: "🏔️", length: "1:00" },
    { title: "Летний загородный пейзаж (direct mp4)", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", icon: "⛵", length: "0:15" }
  ],
  web: [
    { title: "Big Buck Bunny Full HD", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", icon: "🐇", length: "9:56" },
    { title: "Sintel - Фантастический мультфильм", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4", icon: "🏹", length: "14:48" }
  ]
};

interface PlatformSelectorProps {
  onSelectPlatform: (platformId: string, url: string) => void;
  activePlatform?: string;
  onPlatformChange?: (platformId: string) => void;
  className?: string;
}

export default function PlatformSelector({ 
  onSelectPlatform, 
  activePlatform,
  onPlatformChange,
  className = "" 
}: PlatformSelectorProps) {
  const [internalSelected, setInternalSelected] = useState<string>("youtube");
  const selectedPlatform = activePlatform || internalSelected;
  const [inputUrl, setInputUrl] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const platforms = [
    {
      id: "youtube",
      name: "YouTube",
      gradient: "from-rose-500/10 to-red-600/20 hover:from-rose-500/20 hover:to-red-600/30",
      border: "border-red-500/20 hover:border-red-500/50",
      glow: "hover:shadow-[0_0_20px_rgba(239,68,68,0.35)]",
      iconColor: "text-red-500",
      icon: <Youtube className="w-7 h-7" />,
      tagline: "Каталог YouTube",
      placeholder: "Вставьте ссылку для YouTube...",
      prefix: "https://www.youtube.com/watch?v="
    },
    {
      id: "vk",
      name: "VK Видео",
      gradient: "from-blue-500/10 to-indigo-600/20 hover:from-blue-500/20 hover:to-indigo-600/30",
      border: "border-blue-500/20 hover:border-blue-500/50",
      glow: "hover:shadow-[0_0_20px_rgba(59,130,246,0.35)]",
      iconColor: "text-blue-500",
      icon: <Tv className="w-7 h-7" />,
      tagline: "VK Видео / Эфиры",
      placeholder: "Вставьте ссылку для VK...",
      prefix: "https://vk.com/video_ext.php?"
    },
    {
      id: "rutube",
      name: "Rutube",
      gradient: "from-emerald-500/10 to-teal-600/20 hover:from-emerald-500/20 hover:to-teal-600/30",
      border: "border-emerald-500/20 hover:border-emerald-500/50",
      glow: "hover:shadow-[0_0_20px_rgba(16,185,129,0.35)]",
      iconColor: "text-emerald-500",
      icon: <Play className="w-7 h-7 fill-current" />,
      tagline: "Rutube трансляции",
      placeholder: "Вставьте ссылку для Rutube...",
      prefix: "https://rutube.ru/video/"
    },
    {
      id: "drive",
      name: "Drive",
      gradient: "from-amber-500/10 to-amber-600/20 hover:from-amber-500/20 hover:to-amber-600/30",
      border: "border-amber-500/20 hover:border-amber-500/50",
      glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.35)]",
      iconColor: "text-amber-500",
      icon: <Folder className="w-7 h-7" />,
      tagline: "Облачные медиа",
      placeholder: "Вставьте ссылку на файл для Drive (MP4/m3u8)...",
      prefix: "https://"
    },
    {
      id: "web",
      name: "Web Link",
      gradient: "from-purple-500/10 to-fuchsia-600/20 hover:from-purple-500/20 hover:to-fuchsia-600/30",
      border: "border-purple-500/20 hover:border-purple-500/50",
      glow: "hover:shadow-[0_0_20px_rgba(168,85,247,0.35)]",
      iconColor: "text-purple-500",
      icon: <Globe className="w-7 h-7" />,
      tagline: "Любой видеопоток",
      placeholder: "Вставьте ссылку для Web...",
      prefix: "http"
    }
  ];

  const handlePlatformClick = (platformId: string) => {
    setInternalSelected(platformId);
    onPlatformChange?.(platformId);
    const matched = platforms.find(p => p.id === platformId);
    setInputUrl(matched?.prefix || "");
    setSearchFilter("");
  };

  const handleLaunch = (urlToUse?: string) => {
    const finalUrl = urlToUse || inputUrl;
    if (!finalUrl.trim() || !selectedPlatform) return;
    onSelectPlatform(selectedPlatform, finalUrl.trim());
  };

  const currentPlatformInfo = platforms.find(p => p.id === selectedPlatform);
  const activePresets = selectedPlatform ? PRESETS[selectedPlatform] || [] : [];
  const filteredPresets = activePresets.filter(preset => 
    preset.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div id="homes-platform-selector" className={`bg-[#0b0416]/95 border border-[#3e1f6c]/30 p-5 rounded-3xl backdrop-blur-2xl shadow-[0_20px_45px_rgba(0,0,0,0.7)] relative overflow-hidden ${className}`}>
      {/* Homes laser blur backgrounds */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#c41cad]/10 rounded-full blur-2xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none animate-pulse" style={{ animationDelay: "1s" }} />

      {/* Header Info */}
      <div className="flex items-center justify-between mb-4.5 select-none relative z-10">
        <div className="flex items-center gap-2">
          <Film className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
          <h3 className="font-display font-black text-xs sm:text-sm text-zinc-100 uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-indigo-200 to-fuchsia-300">
            МЕДИАПЛОЩАДКА HOMES SYNC
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[8px] sm:text-[9px] text-[#b3a8d9] font-mono font-bold tracking-wider uppercase">
            HOMES СИНХРОНИЗАЦИЯ
          </span>
        </div>
      </div>

       {/* Futuristic Adaptive Platform Grid Layout */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 relative z-10 w-full">
        {platforms.map((platform) => {
          const isSelected = selectedPlatform === platform.id;
          return (
            <button
              id={`platform-selector-btn-${platform.id}`}
              key={platform.id}
              onClick={() => handlePlatformClick(platform.id)}
              className={`group relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 select-none cursor-pointer overflow-hidden ${
                isSelected 
                  ? "bg-[#1f113a] border-indigo-500 text-white shadow-[0_0_25px_rgba(124,58,237,0.55)] opacity-100 scale-102" 
                  : `bg-[#100922]/45 border-[#301c52]/30 text-zinc-400 opacity-45 hover:opacity-100 hover:text-white ${platform.gradient} ${platform.border} ${platform.glow} hover:scale-103`
              }`}
            >
              {/* Dynamic light reflection line */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Central Glowing Icon */}
              <div className={`w-13 h-13 rounded-2xl bg-zinc-950/80 border border-zinc-800/40 flex items-center justify-center shadow-md transform group-hover:scale-108 transition-all duration-300 ${platform.iconColor}`}>
                {platform.icon}
              </div>

              {/* Title label */}
              <span className="text-zinc-200 font-extrabold text-xs mt-3.5 tracking-wider group-hover:text-indigo-300 transition-colors">
                {platform.name}
              </span>

              {/* Dynamic tag hint */}
              <span className="text-[8px] text-zinc-500 font-mono mt-1 font-semibold block transition-colors group-hover:text-zinc-400">
                {platform.tagline}
              </span>

              {/* Active neon dot indicator */}
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 flex items-center justify-center">
                  <span className="absolute w-2.5 h-2.5 bg-indigo-400 rounded-full animate-ping opacity-75" />
                  <span className="relative w-2 h-2 rounded-full bg-indigo-500" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Accordion extension depending on active platform selection */}
      <AnimatePresence>
        {selectedPlatform && currentPlatformInfo && (
          <motion.div
            key={selectedPlatform}
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 18 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="border-t border-[#311b51]/45 pt-4.5 space-y-4 relative z-10 w-full"
          >
            {/* Direct Input Card Panel */}
            <div className="bg-[#0f071f] p-4 rounded-2xl border border-[#301c52]/40 shadow-inner space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
                  Настройка трансляции ({currentPlatformInfo.name})
                </span>
                <span className="text-[9px] text-[#b3a8d9] font-mono bg-[#251842] border border-[#3f2575]/20 px-2.5 py-0.5 rounded-full select-none">
                  Формат поддерживается
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  id="platform-direct-input"
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder={currentPlatformInfo.placeholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleLaunch();
                    }
                  }}
                  className="flex-1 bg-zinc-950 border border-zinc-850 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 outline-none text-xs sm:text-sm px-4.5 py-3 h-11 rounded-1.5xl text-zinc-150 font-medium placeholder-zinc-550 text-left transition-all font-sans"
                />
                <button
                  id="platform-direct-submit"
                  onClick={() => handleLaunch()}
                  disabled={!inputUrl.trim() || inputUrl === currentPlatformInfo.prefix}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900 disabled:text-zinc-650 disabled:border-transparent text-white text-xs font-bold px-5 h-11 rounded-1.5xl transition-all cursor-pointer flex items-center justify-center gap-1 bg-gradient-to-r hover:from-indigo-550 hover:to-indigo-650"
                >
                  <span>Запуск</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Presets Gallery Block */}
            {activePresets.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between select-none">
                  <span className="text-[9px] font-extrabold text-[#9d8ebd]/90 uppercase tracking-widest block">
                    Популярные видео в Sferium ({currentPlatformInfo.name})
                  </span>
                  
                  {/* Micro search filter */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-2.8 h-2.8 text-zinc-500" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Быстрый поиск..."
                      className="bg-[#0f071f] text-[9px] pl-7 pr-3 py-1 rounded-lg border border-[#301c52]/40 outline-none focus:border-indigo-500/50 text-zinc-300 w-36 transition-all"
                    />
                  </div>
                </div>

                {/* Scroller cards list */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[160px] overflow-y-auto pr-1">
                  {filteredPresets.length === 0 ? (
                    <div className="text-[10px] text-zinc-500 italic py-5 text-center col-span-2">
                      Поиск не дал результатов
                    </div>
                  ) : (
                    filteredPresets.map((preset, idx) => (
                      <div
                        key={preset.url + "_" + idx}
                        onClick={() => handleLaunch(preset.url)}
                        className="group/preset flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/45 border border-zinc-900/55 hover:border-indigo-500/45 hover:bg-zinc-900/60 transition-all cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span className="text-base bg-[#180e2d] w-8 h-8 shrink-0 flex items-center justify-center rounded-lg shadow-inner">
                            {preset.icon || "📺"}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10.5px] font-bold text-zinc-250 truncate group-hover/preset:text-indigo-400 transition-colors">
                              {preset.title}
                            </span>
                            <span className="text-[8px] text-zinc-500 font-mono mt-0.5">Время: {preset.length}</span>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-all text-[8px] font-extrabold uppercase shrink-0 cursor-pointer"
                        >
                          Выбрать
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
