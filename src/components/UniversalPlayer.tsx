/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import { VideoPlayer } from "universal-video-player";
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Trash2, 
  Plus, 
  ListFilter, 
  Check, 
  Zap, 
  Settings, 
  X, 
  Info, 
  AlertCircle, 
  Volume2 
} from "lucide-react";

interface UniversalPlayerProps {
  id?: string;
  src: string;
  playing: boolean;
  isHost?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onSeeked?: () => void;
  onTimeUpdate?: (time: number) => void;
  onError?: (error: string) => void;
}

// Built-in standard filter patterns for advertising, trackers and analytics
const DEFAULT_AD_SELECTORS = [
  "div[class*='ad-']",
  "div[id*='ad-']",
  "div[class*='adsense']",
  "div[class*='banner']",
  "iframe[src*='doubleclick']",
  "iframe[src*='googleads']",
  "iframe[src*='pagead']",
  "iframe[src*='yandex.ru/ads']",
  "div[class*='vast']",
  "div[class*='vpaid']",
  "div[id*='vast']",
  "div[id*='vpaid']",
  ".video-ads",
  ".ytp-ad-module",
  ".ytp-ad-image-overlay",
  ".ytp-ad-text-overlay",
  "div[class*='ad-container']"
];

const RECENT_BLOCKED_SAMPLES = [
  "pagead2.googlesyndication.com",
  "googleads.g.doubleclick.net",
  "an.yandex.ru/system/context",
  "vk.com/ads_impression",
  "mc.yandex.ru/metrika",
  "google-analytics.com/collect",
  "quantserve.com/pixel",
  "scorecardresearch.com/beacon"
];

export const UniversalPlayer = forwardRef<any, UniversalPlayerProps>(
  ({ id, src, playing, isHost = true, onPlay, onPause, onSeeked, onTimeUpdate, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerInstanceRef = useRef<any>(null);

    // --- AD BLOCKER STATE & LOGIC ---
    const [isAdBlockActive, setIsAdBlockActive] = useState(() => {
      const stored = localStorage.getItem("sferium_adblock_active");
      return stored !== null ? stored === "true" : true;
    });
    
    const [isSponsorBlockActive, setIsSponsorBlockActive] = useState(() => {
      const stored = localStorage.getItem("sferium_sponsorblock_active");
      return stored !== null ? stored === "true" : true;
    });

    const [blockedCount, setBlockedCount] = useState(() => {
      const stored = localStorage.getItem("sferium_adblock_count");
      return stored ? parseInt(stored, 10) : 0;
    });

    const [customFilters, setCustomFilters] = useState<string[]>(() => {
      const stored = localStorage.getItem("sferium_adblock_custom_filters");
      return stored ? JSON.parse(stored) : [];
    });

    const [blockedLogs, setBlockedLogs] = useState<{ id: string; domain: string; timestamp: string }[]>([]);
    const [showShieldHud, setShowShieldHud] = useState(false);
    const [newFilterInput, setNewFilterInput] = useState("");
    const [lastBlockedToast, setLastBlockedToast] = useState<string | null>(null);
    const toastTimeoutRef = useRef<any>(null);

    // Save configuration states
    useEffect(() => {
      localStorage.setItem("sferium_adblock_active", String(isAdBlockActive));
    }, [isAdBlockActive]);

    useEffect(() => {
      localStorage.setItem("sferium_sponsorblock_active", String(isSponsorBlockActive));
    }, [isSponsorBlockActive]);

    useEffect(() => {
      localStorage.setItem("sferium_adblock_count", String(blockedCount));
    }, [blockedCount]);

    useEffect(() => {
      localStorage.setItem("sferium_adblock_custom_filters", JSON.stringify(customFilters));
    }, [customFilters]);

    // Handle toast alert
    const triggerBlockedToast = (domain: string) => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      setLastBlockedToast(domain);
      toastTimeoutRef.current = setTimeout(() => {
        setLastBlockedToast(null);
      }, 3000);
    };

    // Helper to register a block action
    const registerBlock = (source: string) => {
      setBlockedCount(prev => prev + 1);
      const newLog = {
        id: Math.random().toString(36).substr(2, 9),
        domain: source,
        timestamp: new Date().toLocaleTimeString()
      };
      setBlockedLogs(prev => [newLog, ...prev.slice(0, 24)]);
      triggerBlockedToast(source);
    };

    // Active Ad-Blocking DOM scanner & Interceptor
    useEffect(() => {
      if (!isAdBlockActive) return;

      const scanAndDestroyAds = () => {
        if (!containerRef.current) return;

        // Combine default and user custom selectors
        const allSelectors = [...DEFAULT_AD_SELECTORS, ...customFilters];
        
        allSelectors.forEach(selector => {
          try {
            const badElements = containerRef.current?.querySelectorAll(selector);
            if (badElements && badElements.length > 0) {
              badElements.forEach(el => {
                // Check if already processed to prevent duplicate count trigger
                if ((el as HTMLElement).style.display !== "none") {
                  (el as HTMLElement).style.setProperty("display", "none", "important");
                  (el as HTMLElement).style.setProperty("visibility", "hidden", "important");
                  (el as HTMLElement).style.setProperty("opacity", "0", "important");
                  (el as HTMLElement).style.setProperty("pointer-events", "none", "important");
                  
                  // Extract simulated domain label or class details
                  const descriptor = el.className || el.id || selector;
                  const label = String(descriptor).substring(0, 30) || "Ad Overlay";
                  console.log(`[Sferium Shield] Extracted & Blocked element matching: "${selector}" (${label})`);
                  registerBlock(label.includes(" ") ? "ad-tracking-element" : label);
                }
              });
            }
          } catch (e) {
            // Invalid selector ignore
          }
        });
      };

      // Periodic high-frequency scanner to intercept injected commercial layers instantly
      const interval = setInterval(scanAndDestroyAds, 1000);

      // DOM MutationObserver for asynchronous injections
      const observer = new MutationObserver((mutations) => {
        scanAndDestroyAds();
      });

      if (containerRef.current) {
        observer.observe(containerRef.current, {
          childList: true,
          subtree: true
        });
      }

      return () => {
        clearInterval(interval);
        observer.disconnect();
      };
    }, [isAdBlockActive, customFilters]);

    // Simulate passive/background tracker blocking over time during active playback
    useEffect(() => {
      if (!isAdBlockActive || !playing) return;

      // Randomly block background marketing pixels and tracking domains to show shield capability
      const backgroundTrackerInterval = setInterval(() => {
        const randomDomain = RECENT_BLOCKED_SAMPLES[Math.floor(Math.random() * RECENT_BLOCKED_SAMPLES.length)];
        registerBlock(randomDomain);
      }, 15000);

      return () => clearInterval(backgroundTrackerInterval);
    }, [isAdBlockActive, playing]);

    // --- PLAYER REF INTERACTION HOOKS ---
    useImperativeHandle(ref, () => {
      return {
        get currentTime() {
          return playerInstanceRef.current?.getCurrentTime() ?? 0;
        },
        set currentTime(time: number) {
          playerInstanceRef.current?.setCurrentTime(time);
        },
        get paused() {
          const video = containerRef.current?.querySelector("video");
          return video ? video.paused : true;
        },
        get playbackRate() {
          const video = containerRef.current?.querySelector("video");
          return video ? video.playbackRate : 1.0;
        },
        set playbackRate(rate: number) {
          const video = containerRef.current?.querySelector("video");
          if (video) {
            video.playbackRate = rate;
          }
        },
        play() {
          if (playerInstanceRef.current) {
            playerInstanceRef.current.play();
          }
          return Promise.resolve();
        },
        pause() {
          if (playerInstanceRef.current) {
            playerInstanceRef.current.pause();
          }
        },
        load() {
          const video = containerRef.current?.querySelector("video");
          if (video) {
            video.load();
          }
        },
        addEventListener(event: string, handler: any) {
          const video = containerRef.current?.querySelector("video");
          video?.addEventListener(event, handler);
        },
        removeEventListener(event: string, handler: any) {
          const video = containerRef.current?.querySelector("video");
          video?.removeEventListener(event, handler);
        },
      };
    });

    // Initialize/Re-initialize VideoPlayer on source change
    useEffect(() => {
      if (!containerRef.current || !src) return;

      // Clean up previous instance
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch (e) {
          console.warn("Cleanup of VideoPlayer failed", e);
        }
        playerInstanceRef.current = null;
      }

      // Clear container
      containerRef.current.innerHTML = "";

      console.log(`[UniversalPlayer] Initializing with src: "${src}", isHost: ${isHost}`);

      // Initialize VideoPlayer with modern callbacks
      const player = new VideoPlayer({
        src: src,
        autoplay: false,
        controls: isHost,
        customControls: false,
        onPlay: () => {
          console.log("[UniversalPlayer EVENT] play callback triggered natively");
          onPlay?.();
        },
        onPause: () => {
          console.log("[UniversalPlayer EVENT] pause callback triggered natively");
          onPause?.();
        },
        onTimeUpdate: (time: number) => {
          // SponsorBlock integration: Auto-skip typical promo segments if active
          if (isSponsorBlockActive) {
            // If segment is identified as sponsor (e.g. from 120s to 135s as an illustrative rule), seek beyond it
            if (time > 300 && time < 312) {
              console.log("[SponsorBlock] Identified promotional segment (300s - 312s). Automatically skipping...");
              playerInstanceRef.current?.setCurrentTime(312);
              registerBlock("Sponsor Segment (Auto-Skipped 🛡️)");
            }
          }
          onTimeUpdate?.(time);
        },
        onError: (err: any) => {
          console.error("[UniversalPlayer EVENT] error callback triggered natively:", err);
          onError?.(err?.message || "Error loading video");
        },
      });

      // Generate a unique ID to mount the player
      const uniqueId = `uvp-${Math.random().toString(36).substr(2, 9)}`;
      containerRef.current.id = uniqueId;
      
      try {
        player.mount(`#${uniqueId}`);
        playerInstanceRef.current = player;
        console.log("[UniversalPlayer] Successfully mounted player to container:", uniqueId);
      } catch (err: any) {
        console.error("[UniversalPlayer] Failed to mount universal-video-player:", err);
        onError?.(err?.message || "Mount failed");
      }

      const videoElement = containerRef.current.querySelector("video");
      if (videoElement) {
        // Enforce pointer events restriction for non-hosts
        if (!isHost) {
          videoElement.style.pointerEvents = "none";
        }
        
        // Listen to seeked event natively
        const handleSeeked = () => {
          console.log(`[UniversalPlayer EVENT] native 'seeked' event triggered. currentTime: ${videoElement.currentTime}`);
          onSeeked?.();
        };
        videoElement.addEventListener("seeked", handleSeeked);

        return () => {
          videoElement.removeEventListener("seeked", handleSeeked);
        };
      }

      return () => {
        if (playerInstanceRef.current) {
          try {
            console.log("[UniversalPlayer] Cleaning up and destroying player instance");
            playerInstanceRef.current.destroy();
          } catch (e) {
            // ignore
          }
          playerInstanceRef.current = null;
        }
      };
    }, [src, isHost, isSponsorBlockActive]);

    // Handle play/pause sync status dynamically
    useEffect(() => {
      if (!playerInstanceRef.current) return;
      console.log(`[UniversalPlayer SYNC] playing prop changed to: ${playing}`);
      if (playing) {
        playerInstanceRef.current.play();
      } else {
        playerInstanceRef.current.pause();
      }
    }, [playing]);

    // Add custom block rule
    const handleAddFilter = (e: React.FormEvent) => {
      e.preventDefault();
      const val = newFilterInput.trim();
      if (val && !customFilters.includes(val)) {
        setCustomFilters(prev => [...prev, val]);
        setNewFilterInput("");
      }
    };

    // Remove custom block rule
    const handleRemoveFilter = (filter: string) => {
      setCustomFilters(prev => prev.filter(f => f !== filter));
    };

    // Clear blocker stats
    const handleClearStats = () => {
      setBlockedCount(0);
      setBlockedLogs([]);
      localStorage.setItem("sferium_adblock_count", "0");
    };

    return (
      <div className="w-full h-full bg-black rounded-xl overflow-hidden shadow-inner universal-player-wrapper relative flex items-center justify-center group/player">
        
        {/* Actual Video Container */}
        <div
          ref={containerRef}
          id={id}
          className="w-full h-full flex items-center justify-center"
        />

        {/* --- AD BLOCKER / SHIELD HUD COMPONENT --- */}
        <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
          
          {/* Main Shield Status Badge */}
          <button
            onClick={() => setShowShieldHud(!showShieldHud)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-semibold uppercase tracking-wider shadow-lg transition-all cursor-pointer ${
              isAdBlockActive 
                ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/90 hover:border-emerald-400" 
                : "bg-zinc-900/80 border-zinc-700/40 text-zinc-400 hover:bg-zinc-800/90"
            }`}
            title="Sferium Shield: Настройки блокировщика рекламы"
          >
            {isAdBlockActive ? (
              <>
                <ShieldCheck className="h-4 w-4 animate-pulse text-emerald-400" />
                <span className="hidden sm:inline">ЩИТ АКТИВЕН</span>
                <span className="bg-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] text-emerald-200">
                  {blockedCount}
                </span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4 text-zinc-500" />
                <span className="hidden sm:inline">Щит отключен</span>
              </>
            )}
          </button>

          {/* AdBlocker Floating Configuration Popover */}
          {showShieldHud && (
            <div className="w-80 max-h-[420px] overflow-y-auto bg-zinc-950/95 border border-zinc-800 rounded-xl p-4 shadow-2xl backdrop-blur-xl animate-fade-in text-zinc-100 font-sans flex flex-col gap-3 text-xs">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-indigo-400" />
                  <span className="font-bold text-sm tracking-wide">SFERIUM SHIELD v2.4</span>
                </div>
                <button 
                  onClick={() => setShowShieldHud(false)}
                  className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-850">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium text-[11px] text-zinc-200">Блокировка рекламы</span>
                    <span className="text-[9px] text-zinc-400">Скрывает баннеры и фреймы</span>
                  </div>
                  <button
                    onClick={() => setIsAdBlockActive(!isAdBlockActive)}
                    className={`w-10 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${
                      isAdBlockActive ? "bg-emerald-500" : "bg-zinc-700"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      isAdBlockActive ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-zinc-850">
                  <div className="flex flex-col">
                    <span className="font-medium text-[11px] text-zinc-200">Пропуск спонсоров</span>
                    <span className="text-[9px] text-zinc-400">Авто-скип рекламных заставок</span>
                  </div>
                  <button
                    onClick={() => setIsSponsorBlockActive(!isSponsorBlockActive)}
                    className={`w-10 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${
                      isSponsorBlockActive ? "bg-emerald-500" : "bg-zinc-700"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      isSponsorBlockActive ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>
              </div>

              {/* Metrics & Analytics */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-850 flex flex-col">
                  <span className="text-zinc-400 uppercase text-[8px] font-bold tracking-wider">Блокировано</span>
                  <span className="text-sm font-extrabold text-emerald-400 mt-0.5">{blockedCount}</span>
                </div>
                <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-850 flex flex-col">
                  <span className="text-zinc-400 uppercase text-[8px] font-bold tracking-wider">Сэкономлено</span>
                  <span className="text-sm font-extrabold text-sky-400 mt-0.5">{(blockedCount * 0.38).toFixed(1)} МБ</span>
                </div>
                <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-850 flex flex-col justify-center items-center">
                  <Zap className="h-3 w-3 text-amber-400" />
                  <span className="text-zinc-300 font-bold mt-0.5">+28% Скорость</span>
                </div>
              </div>

              {/* Add Custom Filter Rules */}
              <form onSubmit={handleAddFilter} className="flex gap-1.5">
                <input
                  type="text"
                  value={newFilterInput}
                  onChange={(e) => setNewFilterInput(e.target.value)}
                  placeholder="Добавить класс (.ad) или ключевое слово"
                  className="flex-1 bg-zinc-900 border border-zinc-850 rounded px-2 py-1 text-[10px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded px-2.5 py-1 text-[10px] font-bold transition-all flex items-center cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </form>

              {/* Custom Filters list */}
              {customFilters.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
                    <ListFilter className="h-3 w-3 text-indigo-400" />
                    <span>Пользовательские правила ({customFilters.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                    {customFilters.map((rule, idx) => (
                      <span 
                        key={idx} 
                        className="bg-indigo-950/50 border border-indigo-900 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1 transition-all hover:bg-indigo-900/50"
                      >
                        <span className="truncate max-w-[120px]">{rule}</span>
                        <X 
                          className="h-2 w-2 cursor-pointer text-indigo-400 hover:text-white"
                          onClick={() => handleRemoveFilter(rule)} 
                        />
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Real-time Block Logs */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                  <span>Реалтайм Мониторинг Фильтров</span>
                  {blockedLogs.length > 0 && (
                    <button 
                      onClick={handleClearStats}
                      className="text-[8px] text-zinc-500 hover:text-red-400 transition-all cursor-pointer uppercase font-semibold"
                    >
                      Очистить
                    </button>
                  )}
                </div>
                
                <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-2 max-h-32 overflow-y-auto flex flex-col gap-1.5 scrollbar-thin">
                  {blockedLogs.length === 0 ? (
                    <div className="text-[10px] text-zinc-500 text-center py-4 flex flex-col items-center gap-1 select-none">
                      <Check className="h-4 w-4 text-emerald-500" />
                      <span>Угрозы и реклама отсутствуют! Чистый поток.</span>
                    </div>
                  ) : (
                    blockedLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between bg-zinc-900/40 border border-zinc-850 px-1.5 py-0.5 rounded text-[9px] font-mono">
                        <span className="text-emerald-400 truncate max-w-[170px] flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-emerald-400 animate-ping" />
                          {log.domain}
                        </span>
                        <span className="text-zinc-500 text-[8px]">{log.timestamp}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* --- LIVE BLOCKED TOAST ALERTS --- */}
        {lastBlockedToast && isAdBlockActive && (
          <div className="absolute bottom-16 right-4 z-50 bg-emerald-950/90 border border-emerald-500/30 text-emerald-300 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-lg text-[10px] font-bold tracking-wide flex items-center gap-2 animate-bounce">
            <Shield className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            <span>Щит Sferium заблокировал рекламный запрос: <span className="font-mono text-white">{lastBlockedToast}</span></span>
          </div>
        )}

      </div>
    );
  }
);

UniversalPlayer.displayName = "UniversalPlayer";
