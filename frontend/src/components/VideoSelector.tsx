/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { Youtube, Tv, Globe, Play, FolderPlus } from "lucide-react";

interface VideoSelectorProps {
  onSelectVideo: (url: string) => void;
  currentVideoUrl?: string;
}

export default function SferiumVideoSelector({
  onSelectVideo,
  currentVideoUrl = "",
}: VideoSelectorProps) {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<"youtube" | "vk" | "rutube" | "direct">("youtube");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return;
    onSelectVideo(cleanUrl);
    setUrl("");
  };

  const presetUrls = [
    { title: "🌌 Cosmic ambient stream", url: "https://www.youtube.com/watch?v=ScMzIvxBSi4", type: "youtube" },
    { title: "🧘 Chill Synth Beats Lofi", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk", type: "youtube" },
    { title: "🐋 Ocean Deep Life Relax", url: "https://www.youtube.com/watch?v=ScMzIvxBSi4", type: "youtube" },
  ];

  return (
    <div id="sferium-video-selector-console" className="bg-zinc-900/40 border border-zinc-850 p-5 rounded-2xl space-y-4">
      <div className="flex items-center gap-2 border-b border-zinc-850 pb-2">
        <Play className="w-4 h-4 text-indigo-400 fill-current" />
        <h4 className="font-display font-bold text-xs text-zinc-100 uppercase tracking-widest">Каналы Трансляции</h4>
      </div>

      {/* Segment tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-950/65 rounded-xl border border-zinc-850/40 select-none">
        {[
          { id: "youtube", label: "YT", icon: <Youtube className="w-3.5 h-3.5" /> },
          { id: "vk", label: "VK", icon: <Tv className="w-3.5 h-3.5" /> },
          { id: "rutube", label: "Rutube", icon: <Play className="w-3.5 h-3.5 fill-current" /> },
          { id: "direct", label: "Файл", icon: <Globe className="w-3.5 h-3.5" /> },
        ].map((tab) => {
          const isActive = platform === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setPlatform(tab.id as any)}
              className={`py-2 px-1 rounded-lg flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                isActive 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15" 
                  : "text-zinc-500 hover:text-zinc-350"
              }`}
            >
              <span>{tab.icon}</span>
              <span className="text-[9px] font-bold uppercase tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* URL Submit Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          id="selector-url-field"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={
            platform === "youtube" ? "Вставьте ссылку на YouTube видео..." :
            platform === "vk" ? "Вставьте iframe или ссылку на VK Видео..." :
            platform === "rutube" ? "Вставьте ссылку на Rutube..." :
            "Вставьте прямую ссылку на .mp4 или .m3u8 файл..."
          }
          className="flex-1 bg-zinc-950 text-xs text-zinc-200 px-4 py-3.5 rounded-xl border border-zinc-855 outline-none focus:border-indigo-500 transition-colors"
          title="Ввод ссылки на эфир"
        />
        <button
          id="selector-play-btn"
          type="submit"
          className="px-4 bg-indigo-600 hover:bg-indigo-550 rounded-xl text-white flex items-center justify-center transition-all cursor-pointer shadow-md shadow-indigo-600/10"
          title="Запустить эфир"
        >
          <Play className="w-4 h-4 fill-white" />
        </button>
      </form>

      {/* Preset recommendations */}
      <div className="space-y-2 pt-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">Рекомендации Sferium:</span>
        <div className="space-y-1.5">
          {presetUrls.map((preset, index) => (
            <button
              type="button"
              key={index}
              onClick={() => onSelectVideo(preset.url)}
              className="w-full text-left px-3.5 py-2.5 bg-zinc-950/40 hover:bg-zinc-950 border border-zinc-850/50 hover:border-zinc-800 rounded-xl transition-all text-xs font-mono text-zinc-400 hover:text-white flex items-center justify-between cursor-pointer"
            >
              <span>{preset.title}</span>
              <FolderPlus className="w-3.5 h-3.5 text-zinc-650" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
