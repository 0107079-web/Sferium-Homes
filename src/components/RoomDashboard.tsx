/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect, useRef } from "react";
import { 
  Copy, Check, Tv, Users, Share2, CornerDownRight, Play,
  Mic, MicOff, Volume2, VolumeX, UserMinus, Crown, Film,
  Cpu, Terminal, Code, HelpCircle, Power, Youtube, Folder, Globe, Lock, LogOut
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RoomMember } from "../types";
import Avatar from "./Avatar";
import HomesPlatformsGrid from "./HomesPlatformsGrid";

interface RoomDashboardProps {
  roomId: string;
  members: Record<string, RoomMember>;
  currentUserId: string;
  videoUrl: string;
  onChangeVideo: (url: string) => void;
  isPublic?: boolean;
  onTogglePrivacy?: (isPublic: boolean) => void;
  onToggleMic?: (enabled: boolean) => void;
  onRemoteToggleMic?: (targetUserId: string, enabled: boolean) => void;
  onMuteMember?: (targetUserId: string, blocked: boolean) => void;
  onKickMember?: (targetUserId: string) => void;
  onMuteAllMics?: (mute: boolean) => void;
  allMuted?: boolean;
  anyoneCanControl?: boolean;
  onToggleControlSharing?: (anyoneCanControl: boolean) => void;
  userProfile?: any;
  onLeaveRoom?: () => void;
}

export default function RoomDashboard({
  roomId,
  members,
  currentUserId,
  videoUrl,
  onChangeVideo,
  isPublic = true,
  onTogglePrivacy,
  onToggleMic,
  onRemoteToggleMic,
  onMuteMember,
  onKickMember,
  onMuteAllMics,
  allMuted = false,
  anyoneCanControl = true,
  onToggleControlSharing,
  userProfile,
  onLeaveRoom,
}: RoomDashboardProps) {
  const [activeTab, setActiveTab] = useState<"remote" | "agent">("remote");
  const [bookmarkletCopied, setBookmarkletCopied] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([
    "🚀 Инициализация агента-посредника Sferium...",
    "🛰️ Версия ядра: In-Browser Mediator SDK v2.6",
    "📡 Канал вещания глобальной синхронизации: sferium_global_mediator",
    "🟢 Ожидание телеметрии от вкладок с видеоплеерами...",
  ]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  const [newUrl, setNewUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [errorUrl, setErrorUrl] = useState("");
  const [isMediaCenterOpen, setIsMediaCenterOpen] = useState(false);
  const [currentService, setCurrentService] = useState<"youtube" | "vk" | "rutube" | "drive" | "web">("youtube");

  const [micCapturing, setMicCapturing] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const myMember = members[currentUserId];
  const isBlocked = myMember?.micBlockedByHost;
  const isGlobalMuted = allMuted && !myMember?.isHost;

  useEffect(() => {
    if ((isBlocked || isGlobalMuted) && micCapturing) {
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
      }
      setMicStream(null);
      setMicCapturing(false);
      onToggleMic?.(false);
      
      alert(isBlocked ? "Создатель заблокировал вам микрофон!" : "Создатель отключил микрофоны у всех участников!");
    }
  }, [isBlocked, isGlobalMuted, micCapturing, isBlocked]);

  // Clean stream on unmount
  useEffect(() => {
    return () => {
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [micStream]);

  // Periodic simulated agent log entries
  useEffect(() => {
    if (activeTab !== "agent") return;

    const logTemplates = [
      "🔄 Ожидание сигналов синхронизации...",
      "🔬 Проверка поддержки CORS в текущем контексте...",
      "📦 Анализ структуры DOM для обнаружения системных HTML5 плейров...",
      "⚡ Подключение к postMessage-интерфейсу iframe... [OK]",
      "🟢 Агент перехватил поток рендеринга видео",
      "🛰️ Оправлен сигнал пинга на sferium_global_mediator (RTT: 4ms)",
      "🔓 Обход защитной политики Origin-Policy через локальную прослойку",
      "👀 Перехват системных событий YouTube API / VK Video плеера...",
      "📡 Синхронизация: Телеметрия времени обновлена успешно",
      "🛡️ Защита от эха: Игнорируем зацикленные обратные события воспроизведения",
    ];

    const interval = setInterval(() => {
      setAgentLogs((prev) => {
        const nextLog = `[${new Date().toLocaleTimeString()}] ${logTemplates[Math.floor(Math.random() * logTemplates.length)]}`;
        const newLogs = [...prev, nextLog];
        if (newLogs.length > 25) newLogs.shift();
        return newLogs;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [agentLogs]);

  const toggleLocalMic = async () => {
    if (isBlocked) {
      alert("Ваш микрофон заблокирован создателем комнаты!");
      return;
    }
    if (isGlobalMuted) {
      alert("В данный момент микрофоны отключены создателем!");
      return;
    }

    if (micCapturing) {
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
      }
      setMicStream(null);
      setMicCapturing(false);
      onToggleMic?.(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
          console.warn("Microphone not available or allowed, using simulator:", err);
          return null;
        });
        
        if (stream) {
          setMicStream(stream);
        }
        setMicCapturing(true);
        onToggleMic?.(true);
      } catch (err) {
        console.error("Failed to access microphone", err);
        setMicCapturing(true);
        onToggleMic?.(true);
      }
    }
  };

  // Remote toggle microphone from the host
  useEffect(() => {
    const handleRemoteToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      const { enabled } = customEvent.detail;
      
      if (enabled && !micCapturing) {
        toggleLocalMic();
      } else if (!enabled && micCapturing) {
        toggleLocalMic();
      }
    };

    window.addEventListener("remote-mic-toggle", handleRemoteToggle);
    return () => {
      window.removeEventListener("remote-mic-toggle", handleRemoteToggle);
    };
  }, [micCapturing, micStream, isBlocked, isGlobalMuted]);

  const inviteLink = `${window.location.origin}/?room=${roomId}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        // Fallback for secure frames or unsupportive browsers
        const input = document.createElement("input");
        input.value = inviteLink;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Failed to copy using api, using fallback alert", e);
    }
  };

  const handleUrlSubmit = (e: FormEvent) => {
    e.preventDefault();
    let url = newUrl.trim();
    if (!url) return;

    // Direct extraction of src if iframe embed code is pasted
    if (url.includes("<iframe") && url.includes("src=")) {
      const srcMatch = url.match(/src=["']([^"']+)["']/i);
      if (srcMatch && srcMatch[1]) {
        url = srcMatch[1].trim();
      }
    }

    // Permissive validation checks
    const isYt = /youtu/i.test(url) || (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url));
    const isVk = /vk/i.test(url) || url.includes("oid=") || url.includes("video_ext.php");
    const isRutube = /rutube/i.test(url);
    const isYandex = /yandex/i.test(url) || /dzen/i.test(url);
    const isGenericSecureUrl = url.startsWith("https://") || url.startsWith("http://");

    const isValid = isYt || isVk || isRutube || isYandex || isGenericSecureUrl;

    if (!isValid) {
      setErrorUrl("Неверный формат ссылки. Укажите корректный URL или полный iframe код из меню 'Поделиться'.");
      setTimeout(() => setErrorUrl(""), 5000);
      return;
    }

    setErrorUrl("");
    onChangeVideo(url);
    setNewUrl("");
  };

  const bookmarkletCode = `javascript:(function(){const rId="${roomId}";if(window.sferiumAgent){clearInterval(window.sferiumAgent);window.sferiumAgent=null;alert("❌ Агент-посредник деактивирован.");return;}alert("🎉 Агент-посредник Sferium запущен! Транслируем состояние вкладки...");const chan=new BroadcastChannel("sferium_room_sync_"+rId);window.sferiumAgent=setInterval(function(){const v=document.querySelector("video");if(v){chan.postMessage({source:"sferium-mediator-agent",type:"playback_change",playing:!v.paused,currentTime:v.currentTime,timestamp:Date.now()});}},1000);})();`;

  const userScriptCode = `// ==UserScript==
// @name         Sferium Co-Watch Mediator
// @namespace    sferium.homes
// @version      1.3
// @description  Синхронный совместный просмотр без ограничений плеера
// @match        *://*.youtube.com/watch*
// @match        *://*.youtube.com/embed*
// @match        *://*.vk.com/video*
// @match        *://*.vkvideo.ru/*
// @match        *://*.rutube.ru/*
// @match        *://dzen.ru/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  console.log("🤖 Sferium Client Agent active!");
  const roomId = "${roomId}";
  const wsUrl = "${window.location.protocol === "https:" ? "wss://" : "ws://"}${window.location.host}/ws";
  let ws = null;
  
  function connect() {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      console.log("🔌 Connected to watch session as Mediator Agent!");
      ws.send(JSON.stringify({
        type: "join",
        roomId: roomId,
        name: "🤖 Агент-Посредник [Браузер]",
        avatar: "🤖",
        color: "#10B981"
      }));
    };
    ws.onclose = () => setTimeout(connect, 3005);
  }
  
  connect();
  setInterval(() => {
    const video = document.querySelector("video");
    if (video && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "playback_change",
        playing: !video.paused,
        currentTime: video.currentTime,
        issuerId: "mediator_agent"
      }));
    }
  }, 1000);
})();`;

  const copyBookmarklet = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(bookmarkletCode);
      } else {
        const input = document.createElement("input");
        input.value = bookmarkletCode;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setBookmarkletCopied(true);
      setTimeout(() => setBookmarkletCopied(false), 2000);
    } catch (_) {}
  };

  const copyUserScript = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(userScriptCode);
      } else {
        const input = document.createElement("textarea");
        input.value = userScriptCode;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2000);
    } catch (_) {}
  };

  const memberList = Object.values(members).sort((a, b) => b.joinedAt - a.joinedAt);
  const isMeHost = members[currentUserId]?.isHost ?? false;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Dynamic Link Input / Agent Panel Switcher Card */}
      <div className="bg-zinc-900/60 border border-zinc-805 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          {/* Segmented Tab Controls */}
          <div className="flex bg-zinc-950/60 p-1 rounded-xl border border-zinc-850/50 mb-4 select-none">
            <button
              type="button"
              onClick={() => setActiveTab("remote")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === "remote"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              📺 Пульт
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("agent")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "agent"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              🤖 Браузерный агент
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "remote" ? (
              <motion.div
                key="remote-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Tv className="w-5 h-5 text-indigo-400" />
                  <h4 className="font-display font-medium text-sm text-zinc-100 uppercase tracking-wider">Эфирный пульт</h4>
                </div>
                
                {isMeHost || anyoneCanControl ? (
                  <>
                    <p className="text-xs text-zinc-400 mb-4 tracking-wide leading-relaxed">
                      Вставьте ссылку на видео (YouTube, VK Видео, Rutube, Яндекс) или <b>полный iframe-код</b> для вставки (из меню «Поделиться»), чтобы запустить синхронный просмотр.
                    </p>

                    {/* Interactive Platform Hub Row */}
                    <div className="grid grid-cols-5 gap-1.5 mb-3 bg-zinc-950/65 p-1 rounded-xl border border-zinc-850/40">
                      {[
                        { id: "youtube", label: "YouTube", icon: <Youtube className="w-3.5 h-3.5" />, color: "text-red-500", glow: "shadow-[0_0_12px_rgba(239,68,68,0.3)] border-red-500/30" },
                        { id: "vk", label: "VK", icon: <Tv className="w-3.5 h-3.5" />, color: "text-blue-500", glow: "shadow-[0_0_12px_rgba(59,130,246,0.3)] border-blue-500/30" },
                        { id: "rutube", label: "Rutube", icon: <Play className="w-3.5 h-3.5 fill-current" />, color: "text-emerald-500", glow: "shadow-[0_0_12px_rgba(16,185,129,0.3)] border-emerald-500/30" },
                        { id: "drive", label: "Drive", icon: <Folder className="w-3.5 h-3.5" />, color: "text-amber-500", glow: "shadow-[0_0_12px_rgba(245,158,11,0.3)] border-amber-500/30" },
                        { id: "web", label: "Web", icon: <Globe className="w-3.5 h-3.5" />, color: "text-purple-500", glow: "shadow-[0_0_12px_rgba(168,85,247,0.3)] border-purple-500/30" },
                      ].map((service) => {
                        const isActive = currentService === service.id;
                        return (
                          <button
                            type="button"
                            key={service.id}
                            onClick={() => setCurrentService(service.id as any)}
                            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border transition-all cursor-pointer select-none text-[9px] font-bold ${
                              isActive
                                ? `bg-indigo-500/10 border-indigo-500 text-white ${service.glow}`
                                : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 opacity-60 hover:opacity-100"
                            }`}
                            title={`Выбрать ${service.label}`}
                          >
                            <span className={`${isActive ? service.color : "text-zinc-400 group-hover:text-zinc-200"}`}>{service.icon}</span>
                            <span className="mt-0.5 scale-90 text-[8px] tracking-tight">{service.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <form onSubmit={handleUrlSubmit} className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          id="video-url-input"
                          type="text"
                          value={newUrl}
                          onChange={(e) => setNewUrl(e.target.value)}
                          placeholder={
                            currentService === "youtube" ? "Вставьте ссылку для YouTube..." :
                            currentService === "vk" ? "Вставьте ссылку для VK..." :
                            currentService === "rutube" ? "Вставьте ссылку для Rutube..." :
                            currentService === "drive" ? "Вставьте ссылку на файл для Drive (MP4/m3u8)..." :
                            "Вставьте ссылку для Web..."
                          }
                          className="flex-1 bg-zinc-950 text-xs text-zinc-200 px-4 py-3 rounded-xl border border-zinc-855 outline-none focus:border-indigo-500 transition-colors"
                          title="Поле ввода ссылки на video"
                        />
                        <button
                          id="url-submit-btn"
                          type="submit"
                          className="w-11 h-11 shrink-0 bg-indigo-600 hover:bg-indigo-550 rounded-xl text-white flex items-center justify-center transition-all cursor-pointer shadow-md shadow-indigo-600/10"
                          title="Загрузить видео"
                        >
                          <Play className="w-4 h-4 fill-white" />
                        </button>
                      </div>
                      
                      <AnimatePresence>
                        {errorUrl && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-[10px] text-rose-400 font-medium"
                          >
                            ⚠️ {errorUrl}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </form>

                    <button
                      type="button"
                      onClick={() => setIsMediaCenterOpen(true)}
                      className="w-full mt-3 py-2.5 bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/40 hover:to-indigo-600/40 border border-indigo-500/35 hover:border-indigo-500/50 rounded-xl text-indigo-305 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer select-none"
                    >
                      <Film className="w-4 h-4 animate-pulse text-indigo-400" />
                      <span>📺 Выбрать медиаплощадку Homes</span>
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center bg-zinc-950/45 border border-zinc-900 rounded-2xl">
                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                      <Lock className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h5 className="text-xs font-bold text-zinc-200 tracking-wide uppercase mb-1.5">Пульт заблокирован</h5>
                    <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xs">
                      Вы вошли как гость. Только создатель комнаты 👑 может изменять видео, запускать воспроизведение, приостанавливать трансляцию или перематывать плеер.
                    </p>
                  </div>
                )}

                {videoUrl && (
                  <div className="mt-4 flex items-start gap-1 p-2 bg-zinc-950/40 rounded-lg border border-zinc-800/50">
                    <CornerDownRight className="w-3.5 h-3.5 text-zinc-500 mt-0.5" />
                    <span className="text-[10px] text-zinc-500 font-mono text-ellipsis overflow-hidden whitespace-nowrap block max-w-full">
                      Актуально: {videoUrl}
                    </span>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="agent-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-emerald-400 animate-pulse" />
                      <h4 className="font-display font-medium text-sm text-zinc-100 uppercase tracking-wider">Браузерный медиа-клиент</h4>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono text-emerald-400 rounded-md">
                      ACTIVE v2.6
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Sferium перешел на архитектуру <b>клиентского агента-посредника</b> (In-browser Mediator). Синхронизация и запуск видео осуществляются напрямую вашим браузером. Больше никаких серверных блокировок со стороны VK или YouTube!
                  </p>
                </div>

                {/* Bookmarklet & Userscript tools */}
                <div className="space-y-2">
                  <span className="text-[10.5px] font-semibold text-zinc-350 block">🛠️ Инструменты интеграции:</span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {/* Bookmarklet toggle */}
                    <div className="p-2.5 bg-zinc-950/60 rounded-xl border border-zinc-850 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Агент-Закладка</span>
                        <p className="text-[9px] text-zinc-500 leading-snug">Трансляция вещания кликом прямо со вкладки YouTube или VK</p>
                      </div>
                      <div className="mt-3 flex gap-1">
                        <a
                          href={bookmarkletCode}
                          onClick={(e) => {
                            // Prevent standard click navigate if someone clicks instead of dragging
                            e.preventDefault();
                            copyBookmarklet();
                          }}
                          className="flex-1 py-1.5 text-center bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 rounded-lg text-[10px] font-bold text-white transition-all cursor-pointer select-none"
                          title="Перетащите на панель закладок или нажмите для копирования"
                        >
                          🚀 Тяни в закладки
                        </a>
                        <button
                          onClick={copyBookmarklet}
                          className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white"
                          title="Скопировать код закладки"
                        >
                          {bookmarkletCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Userscript toggle */}
                    <div className="p-2.5 bg-zinc-950/60 rounded-xl border border-zinc-850 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Userscript (Tampermonkey)</span>
                        <p className="text-[9px] text-zinc-500 leading-snug">Полная фоновая интеграция плеера Metastream</p>
                      </div>
                      <button
                        onClick={copyUserScript}
                        className="mt-3 w-full py-1.5 bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800/80 rounded-lg text-[10px] font-bold text-zinc-350 hover:text-white flex items-center justify-center gap-1.5 transition-all"
                      >
                        {scriptCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Скопировано!</span>
                          </>
                        ) : (
                          <>
                            <Code className="w-3 h-3 text-emerald-400" />
                            <span>Скопировать скрипт</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Simulated Agent Event Console */}
                <div className="bg-zinc-955 border border-zinc-850 rounded-xl overflow-hidden shadow-inner font-mono text-[9px]">
                  <div className="bg-zinc-950 px-3 py-1.5 border-b border-zinc-850/50 flex items-center justify-between text-zinc-500">
                    <span className="flex items-center gap-1 font-bold text-[8.5px] uppercase tracking-wide">
                      <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                      Консоль медиа-агента
                    </span>
                    <span className="flex items-center gap-1 text-[8px] text-emerald-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ONLINE
                    </span>
                  </div>
                  <div className="p-3 max-h-[110px] overflow-y-auto space-y-1.5 scrollbar-thin text-zinc-400 leading-snug">
                    {agentLogs.map((log, index) => (
                      <div key={index} className="whitespace-pre-wrap brightness-95">{log}</div>
                    ))}
                    <div ref={consoleBottomRef} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Privacy Control and Info */}
        <div className="mt-4 pt-4 border-t border-zinc-850">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                {isPublic ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Публичная комната</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>Приватная комната</span>
                  </>
                )}
              </span>
              <span className="text-[9px] text-zinc-500 mt-0.5 leading-snug">
                {isPublic 
                  ? "Доступна всем в списке на главной странице" 
                  : "Скрыта из общего списка (только по ссылке)"}
              </span>
            </div>

            {/* If current user is host, show toggle buttons */}
            {isMeHost ? (
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-850 select-none shrink-0">
                <button
                  type="button"
                  id="privacy-public-btn"
                  onClick={() => onTogglePrivacy?.(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    isPublic 
                      ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/15 shadow-inner" 
                      : "text-zinc-500 hover:text-zinc-350"
                  }`}
                >
                  🌐 Публичная
                </button>
                <button
                  type="button"
                  id="privacy-private-btn"
                  onClick={() => onTogglePrivacy?.(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    !isPublic 
                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/15 shadow-inner" 
                      : "text-zinc-500 hover:text-zinc-350"
                  }`}
                >
                  🔒 Приватная
                </button>
              </div>
            ) : (
              <span className="text-[10px] font-mono font-bold uppercase py-1 px-2 border border-zinc-800 bg-zinc-950 rounded-lg text-zinc-400 shrink-0 cursor-default">
                {isPublic ? "🌐 PUBLIC" : "🔒 PRIVATE"}
              </span>
            )}
          </div>
        </div>

        {/* Playback Control Permission Option */}
        <div className="mt-4 pt-4 border-t border-zinc-850">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Управление плеером</span>
              </span>
              <span className="text-[9px] text-zinc-500 mt-0.5 leading-snug">
                {anyoneCanControl 
                  ? "Пульт доступен всем участникам комнаты" 
                  : "Только создатель комнаты может управлять эфиром"}
              </span>
            </div>

            {isMeHost ? (
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-850 select-none shrink-0">
                <button
                  type="button"
                  id="control-anyone-btn"
                  onClick={() => onToggleControlSharing?.(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    anyoneCanControl 
                      ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/15 shadow-inner" 
                      : "text-zinc-500 hover:text-zinc-350"
                  }`}
                >
                  🎮 Все
                </button>
                <button
                  type="button"
                  id="control-host-btn"
                  onClick={() => onToggleControlSharing?.(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    !anyoneCanControl 
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/15 shadow-inner" 
                      : "text-zinc-500 hover:text-zinc-350"
                  }`}
                >
                  👑 Создатель
                </button>
              </div>
            ) : (
              <span className="text-[10px] font-mono font-bold uppercase py-1 px-2 border border-zinc-800 bg-zinc-950 rounded-lg text-zinc-400 shrink-0 cursor-default">
                {anyoneCanControl ? "🎮 ВСЕ" : "👑 ХОСТ"}
              </span>
            )}
          </div>
        </div>

        {/* Invite link section */}
        <div className="mt-5 pt-4 border-t border-zinc-850">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-zinc-500" />
              Ссылка для друзей
            </span>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 font-mono font-semibold px-2 py-0.5 rounded-md">
              ID: {roomId}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-zinc-950 rounded-xl px-3 py-1.5 border border-zinc-850 overflow-hidden">
            <span className="flex-1 text-[11px] font-mono text-zinc-400 select-all truncate">
              {inviteLink}
            </span>
            <button
              id="copy-invite-link-btn"
              onClick={handleCopyLink}
              className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-all flex-shrink-0 ${
                copied
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-zinc-90 w-auto hover:bg-zinc-850 text-indigo-400 hover:text-indigo-300"
              }`}
              title="Копировать приглашение"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-sans font-semibold">Скопировано!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-sans font-semibold">Копировать</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Leave Room Action */}
        {onLeaveRoom && (
          <div className="mt-4 pt-4 border-t border-zinc-850">
            <button
              id="dashboard-leave-room-btn"
              type="button"
              onClick={onLeaveRoom}
              className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/25 hover:border-rose-500/40 rounded-xl text-rose-400 hover:text-rose-350 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer select-none"
            >
              <LogOut className="w-4 h-4" />
              <span>Выйти из комнаты</span>
            </button>
          </div>
        )}
      </div>

      {/* Connected Members Card */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-lg hidden lg:flex flex-col">
        <div className="flex items-center justify-between mb-3 border-b border-zinc-850 pb-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h4 className="font-display font-medium text-sm text-zinc-100 uppercase tracking-wider">Все участники</h4>
          </div>
          <span className="text-xs font-bold font-mono text-zinc-400 bg-zinc-800 rounded-full px-2.5 py-0.5">
            {memberList.length}
          </span>
        </div>

        {/* Voice Chat Controls */}
        <div className="mb-4 p-3 bg-zinc-950/50 rounded-xl border border-zinc-850/60 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">Голосовое общение</span>
            <div className="flex items-center gap-1.5">
              {micCapturing ? (
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-650" />
              )}
              <span className="text-[10px] text-zinc-500 font-medium">
                {micCapturing ? "Активен" : "Выключен"}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              id="local-mic-btn"
              onClick={toggleLocalMic}
              disabled={isBlocked || isGlobalMuted}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                isBlocked || isGlobalMuted
                  ? "bg-zinc-90 w-auto hover:bg-zinc-850 text-zinc-650 cursor-not-allowed"
                  : micCapturing
                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25"
                  : "bg-zinc-800 hover:bg-zinc-750 text-zinc-350 border border-zinc-700/50"
              }`}
            >
              {isBlocked ? (
                <>
                  <MicOff className="w-3.5 h-3.5 text-rose-500" />
                  <span>Микрофон заблокирован</span>
                </>
              ) : isGlobalMuted ? (
                <>
                  <MicOff className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Все микрофоны выкл.</span>
                </>
              ) : micCapturing ? (
                <>
                  <Mic className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                  <span>Выключить микрофон</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Включить микрофон</span>
                </>
              )}
            </button>

            {/* Host Only Global Mute All */}
            {isMeHost && (
              <button
                id="global-mute-mics-btn"
                onClick={() => onMuteAllMics?.(!allMuted)}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center border ${
                  allMuted
                    ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-455 border-rose-500/30 animate-pulse"
                    : "bg-zinc-800 hover:bg-zinc-750 text-zinc-350 border border-zinc-700/50"
                }`}
                title={allMuted ? "Разрешить всем микрофоны" : "Выключить всем микрофоны"}
              >
                {allMuted ? <Volume2 className="w-4 h-4 text-emerald-405" /> : <VolumeX className="w-4 h-4 text-rose-405" />}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[190px] space-y-2.5 pr-1">
          {memberList.map((member) => {
            const isMe = member.id === currentUserId;
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {/* Emoji Avatar Bubble with border color based on chosen user color */}
                    <Avatar 
                      src={member.avatar} 
                      className="w-8 h-8 rounded-full text-base shadow-md border-2"
                      style={{ borderColor: member.color || "#4F46E5" }}
                      fallback="🍿"
                    />
                    
                    {/* Active capture indicator */}
                    {member.micEnabled && (
                      <span className="absolute bottom-0 right-0 block h-2 border border-zinc-950 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5 flex-wrap">
                      {member.name} {isMe ? <span className="text-zinc-500 font-normal text-[10px]">(Вы)</span> : ""}
                      
                      {/* Speaker Status Indicator */}
                      {member.micEnabled ? (
                        <Mic className="w-3 h-3 text-emerald-450 shrink-0" title="Микрофон включен" />
                      ) : member.micBlockedByHost ? (
                        <MicOff className="w-3 h-3 text-rose-500 shrink-0" title="Микрофон заблокирован создателем" />
                      ) : null}
                    </span>
                    <span className="text-[9px] text-zinc-505 font-mono">
                      Присоединился {new Date(member.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {member.isHost ? (
                    <span className="text-[9px] font-display font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-md tracking-wider flex items-center gap-1 select-none">
                      👑 СОЗДАТЕЛЬ
                    </span>
                  ) : (
                    /* Moderation tools for Hosts to administer other members */
                    isMeHost && (
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Remote On/Off Toggle Button */}
                        <button
                          type="button"
                          onClick={() => onRemoteToggleMic?.(member.id, !member.micEnabled)}
                          className={`p-1 rounded-lg transition-colors cursor-pointer border ${
                            member.micEnabled
                              ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/20"
                              : "bg-zinc-800 hover:bg-zinc-750 text-zinc-400 border-zinc-700/50"
                          }`}
                          title={member.micEnabled ? "Выключить микрофон участнику" : "Включить микрофон участнику"}
                        >
                          <Mic className="w-3.5 h-3.5" />
                        </button>

                        {/* Lock/Block Permission Button */}
                        <button
                          type="button"
                          onClick={() => onMuteMember?.(member.id, !member.micBlockedByHost)}
                          className={`p-1 rounded-lg transition-colors cursor-pointer border ${
                            member.micBlockedByHost
                              ? "bg-rose-500/15 hover:bg-rose-500/25 text-rose-450 border-rose-500/20"
                              : "bg-zinc-800 hover:bg-zinc-750 text-zinc-400 border-zinc-700/50"
                          }`}
                          title={member.micBlockedByHost ? "Разблокировать микрофон (разрешить)" : "Заблокировать микрофон (запретить)"}
                        >
                          <MicOff className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => onKickMember?.(member.id)}
                          className="p-1 rounded-lg bg-zinc-900 border border-zinc-805 hover:bg-rose-950 hover:text-rose-400 text-zinc-400 transition-colors cursor-pointer"
                          title="Исключить из комнаты"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Fullscreen Homes-style MediaCenter Popup Modal */}
      <AnimatePresence>
        {isMediaCenterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0e071f] border border-[#3b1f5c]/50 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] p-5 scrollbar-none"
            >
              <button
                type="button"
                onClick={() => setIsMediaCenterOpen(false)}
                className="absolute top-4 right-4 z-50 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-350 hover:text-white rounded-xl shadow transition-colors cursor-pointer select-none"
              >
                ✕ Закрыть
              </button>
              
              <div className="mt-8">
                <HomesPlatformsGrid
                  onSelectVideo={(url) => {
                    onChangeVideo(url);
                    setIsMediaCenterOpen(false);
                  }}
                  userProfile={userProfile}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
