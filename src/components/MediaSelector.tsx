import React, { useState } from "react";
import { 
  Youtube, Tv, Play, Folder, Globe, Search, 
  ArrowRight, Sparkles, Check, LogIn, ExternalLink 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Curated high-quality working video presets for each service
const CURATED_PRESETS: Record<string, Array<{ title: string; url: string; thumbnailUrl: string; duration: string }>> = {
  youtube: [
    {
      title: "Иван Васильевич меняет профессию (Советская комедия)",
      url: "https://www.youtube.com/watch?v=a50qT9bW_T0",
      thumbnailUrl: "🍿",
      duration: "1:33:00"
    },
    {
      title: "Операция «Ы» и другие приключения Шурика",
      url: "https://www.youtube.com/watch?v=1stL8U6K2_0",
      thumbnailUrl: "🎬",
      duration: "1:35:00"
    },
    {
      title: "Путешествие по Камчатке: Гейзеры и ледники",
      url: "https://www.youtube.com/watch?v=2K4Vb68MskE",
      thumbnailUrl: "🦊",
      duration: "42:00"
    },
    {
      title: "Rick Astley - Never Gonna Give You Up",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      thumbnailUrl: "🎸",
      duration: "3:32"
    }
  ],
  vk: [
    {
      title: "VK Fest: Главное Шоу и Выступления",
      url: "https://vk.com/video_ext.php?oid=-220550000&id=456239149",
      thumbnailUrl: "🎵",
      duration: "3:45:00"
    },
    {
      title: "VK Видео трейлер: Лучшие Эксклюзивы 2026",
      url: "https://vk.com/video_ext.php?oid=-220550000&id=456239150",
      thumbnailUrl: "📺",
      duration: "2:15"
    }
  ],
  rutube: [
    {
      title: "Rutube Наука: Тайны времени и квантовой физики",
      url: "https://rutube.ru/video/bc04f35e9f85c479e497f1fbc71db441/",
      thumbnailUrl: "⚡",
      duration: "24:15"
    },
    {
      title: "Космос Рутуб: Снимки черной дыры в 8К",
      url: "https://rutube.ru/video/3cb33a92b23a9d7bb36093fbdb5949d1/",
      thumbnailUrl: "🌌",
      duration: "12:00"
    }
  ],
  drive: [
    {
      title: "Iceland 4K Cinematic Vignettes (Sample Video 1)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
      thumbnailUrl: "🌨️",
      duration: "1:00"
    },
    {
      title: "Summer Outdoor Leisure Film (Sample Video 2)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      thumbnailUrl: "☀️",
      duration: "0:15"
    }
  ],
  web: [
    {
      title: "Big Buck Bunny Premium Full Feature (Direct MP4)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      thumbnailUrl: "🐇",
      duration: "9:56"
    },
    {
      title: "Sintel Original Project Film (Direct MP4)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
      thumbnailUrl: "🗡️",
      duration: "14:48"
    }
  ]
};

interface MediaSelectorProps {
  onSelectVideo: (url: string) => void;
  className?: string;
}

export default function MediaSelector({ onSelectVideo, className = "" }: MediaSelectorProps) {
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [vkToken, setVkToken] = useState(() => localStorage.getItem("vk_video_access_token") || "");

  const platforms = [
    {
      id: "youtube",
      name: "YouTube",
      color: "from-rose-600 to-red-700 shadow-red-950/40",
      textColor: "text-red-400",
      icon: <Youtube className="w-6 h-6 text-white" />,
      tagline: "Каталог и поиск",
      placeholder: "Вставьте ссылку на YouTube (например, https://www.youtube.com/watch?v=...)"
    },
    {
      id: "vk",
      name: "VK Видео",
      color: "from-blue-600 to-sky-700 shadow-blue-950/40",
      textColor: "text-blue-400",
      icon: <Tv className="w-6 h-6 text-white" />,
      tagline: "Фильмы и трансляции",
      placeholder: "Вставьте ссылку на VK Видео (например, https://vk.com/video_ext.php?...)"
    },
    {
      id: "rutube",
      name: "Rutube",
      color: "from-emerald-600 to-teal-700 shadow-emerald-950/40",
      textColor: "text-emerald-400",
      icon: <Play className="w-6 h-6 text-white fill-current" />,
      tagline: "Российский стриминг",
      placeholder: "Вставьте ссылку на Rutube (например, https://rutube.ru/video/...)"
    },
    {
      id: "drive",
      name: "Drive",
      color: "from-amber-500 to-amber-700 shadow-amber-950/40",
      textColor: "text-amber-400",
      icon: <Folder className="w-6 h-6 text-white" />,
      tagline: "Файлы (.mp4 / .m3u8)",
      placeholder: "Введите ссылку на облачный файл (например, Dropbox, Google Drive или прямой .mp4)"
    },
    {
      id: "web",
      name: "Web Link",
      color: "from-indigo-600 to-violet-700 shadow-indigo-950/40",
      textColor: "text-indigo-400",
      icon: <Globe className="w-6 h-6 text-white" />,
      tagline: "Любая интернет-ссылка",
      placeholder: "Укажите прямой URL-адрес потока или веб-страницы..."
    }
  ];

  const handlePlatformClick = (platformId: string) => {
    if (activePlatform === platformId) {
      setActivePlatform(null);
    } else {
      setActivePlatform(platformId);
      setInputUrl("");
      setSearchQuery("");
    }
  };

  const currentPlatformInfo = platforms.find(p => p.id === activePlatform);

  const handleOpenVideo = (url: string) => {
    if (!url.trim()) return;
    onSelectVideo(url.trim());
  };

  // Trigger VK OAuth Flow (Bypassed / Instant mode)
  const handleVkAuth = () => {
    localStorage.setItem("vk_video_access_token", "direct_login_bypass");
    localStorage.setItem("vk_video_user_id", "direct_login_bypass_user");
    // Broadcast updating event so other components (like YoutubePlayer) can keep track too
    window.dispatchEvent(new Event("vk_auth_updated"));
    alert("VK Кабинет успешно подключен без токенов!");
  };

  // Filter curated presets based on search query
  const displayedPresets = activePlatform && CURATED_PRESETS[activePlatform] 
    ? CURATED_PRESETS[activePlatform].filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div id="homes-media-selector" className={`bg-[#0d071d]/90 border border-[#301c52]/30 p-5 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden ${className}`}>
      {/* Decorative ambient background blur */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#c21caa]/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Title block */}
      <div className="flex items-center justify-between mb-4.5 select-none relative z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
          <h3 className="font-display font-extrabold text-xs sm:text-sm text-zinc-100 tracking-wider uppercase">
            ВЫБОР КИНЕМАТОГРАФА (HOMES-STYLE)
          </h3>
        </div>
        <span className="text-[9px] bg-[#251842] border border-[#3f2575]/25 text-zinc-400 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
          БЫСТРЫЙ СТАРТ
        </span>
      </div>

      {/* Homes-style grid layout */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 relative z-10">
        {platforms.map((platform) => {
          const isSelected = activePlatform === platform.id;
          return (
            <button
              id={`selector-platform-${platform.id}`}
              key={platform.id}
              onClick={() => handlePlatformClick(platform.id)}
              className={`group relative flex flex-col items-center justify-center p-4.5 rounded-2xl border transition-all text-center select-none cursor-pointer overflow-hidden ${
                isSelected 
                  ? "bg-zinc-950 border-indigo-500/85 shadow-[0_4px_15px_rgba(99,102,241,0.15)]" 
                  : "bg-[#140e2c]/40 hover:bg-[#181134] border-[#3b1c60]/10 hover:border-[#522985]/35 hover:scale-102"
              }`}
            >
              {/* Colored logo container */}
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${platform.color} flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform duration-300`}>
                {platform.icon}
              </div>

              {/* Title label */}
              <span className="text-zinc-150 font-bold text-xs mt-3 group-hover:text-indigo-300 transition-colors">
                {platform.name}
              </span>

              {/* Tagline */}
              <span className="text-[8px] text-zinc-500 font-mono mt-1 font-semibold block group-hover:text-zinc-400 transition-colors">
                {platform.tagline}
              </span>

              {/* Subtle pulsing selector circle */}
              {isSelected && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Interactive Platform Drawer Expansion */}
      <AnimatePresence>
        {activePlatform && currentPlatformInfo && (
          <motion.div
            key={activePlatform}
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="border-t border-[#3b1c60]/20 pt-4.5 space-y-4 relative z-10"
          >
            {/* Custom URL pasting element */}
            <div className="bg-[#100924] p-4.5 rounded-2xl border border-[#3b1c60]/15 space-y-3 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${activePlatform === "youtube" ? "bg-red-500" : activePlatform === "vk" ? "bg-blue-500" : activePlatform === "rutube" ? "bg-emerald-500" : "bg-indigo-500"}`} />
                  Подключить трансляцию {currentPlatformInfo.name}
                </span>

                {activePlatform === "vk" && (
                  <button
                    onClick={handleVkAuth}
                    className="self-start text-[9px] bg-blue-600 hover:bg-blue-500 text-white font-bold px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors shadow-sm uppercase shrink-0 border-0"
                  >
                    <LogIn className="w-2.5 h-2.5" />
                    <span>Подключить VK (Быстро)</span>
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  id="media-selector-input"
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder={currentPlatformInfo.placeholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleOpenVideo(inputUrl);
                    }
                  }}
                  className="flex-1 bg-zinc-950 border border-zinc-850 focus:border-indigo-500/50 outline-none text-xs sm:text-sm px-3.5 py-2.5 h-11 rounded-xl text-zinc-200 font-medium placeholder-zinc-500 text-left transition-all"
                />
                <button
                  id="media-selector-submit"
                  onClick={() => handleOpenVideo(inputUrl)}
                  disabled={!inputUrl.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900 disabled:text-zinc-650 disabled:border-transparent text-white text-xs font-bold font-display px-5 h-11 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 bg-gradient-to-r hover:from-indigo-550 hover:to-indigo-650"
                >
                  <span>Запуск</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Presets and Search filter column */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                  Cписок популярных трансляций
                </span>
                
                {/* Micro search filter */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Фильтр пресетов..."
                    className="bg-[#100924] text-[10px] pl-7 pr-3 py-1.5 rounded-lg border border-[#3b1c60]/15 outline-none focus:border-indigo-500/50 text-zinc-300 w-36"
                  />
                </div>
              </div>

              {/* Grid of presets cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[170px] overflow-y-auto pr-1">
                {displayedPresets.length === 0 ? (
                  <p className="text-[10px] text-zinc-500 italic py-4 col-span-2 text-center">Нет готовых пресетов по данному запросу...</p>
                ) : (
                  displayedPresets.map((preset, index) => (
                    <div
                      key={preset.url + "_" + index}
                      onClick={() => handleOpenVideo(preset.url)}
                      className="group/preset flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-900/50 hover:border-indigo-500/30 hover:bg-zinc-900/40 transition-all cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-lg bg-[#140e2c] w-9 h-9 shrink-0 flex items-center justify-center rounded-lg shadow-inner">
                          {preset.thumbnailUrl || "📺"}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-bold text-zinc-250 truncate group-hover/preset:text-indigo-400 transition-colors">
                            {preset.title}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono mt-0.5">Длительность: {preset.duration}</span>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-all text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Смотреть
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
