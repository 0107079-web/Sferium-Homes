/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RefreshCw, Volume2, Info, Monitor, ExternalLink, HelpCircle, Lock, LogIn, Key, Settings, CheckCircle2, LogOut, Disc, Globe } from "lucide-react";
import UniversalPlayer from "./UniversalPlayer";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
    VK: any;
  }
}

interface YoutubePlayerProps {
  videoId: string;
  videoUrl?: string;
  provider?: "youtube" | "vk" | "rutube" | "yandex" | "unknown";
  playing: boolean;
  currentTime: number;
  onPlaybackChange: (playing: boolean, currentTime: number) => void;
  onSeek: (currentTime: number) => void;
  onHeartbeat?: (currentTime: number) => void;
  remoteEvent: { type: string; playing?: boolean; currentTime?: number; timestamp: number } | null;
  isHost?: boolean;
}

/**
 * Robustly extracts the YouTube Video ID from any youtube link, embed, live, or shorts format.
 */
function extractYoutubeId(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  
  // If it's already just an ID (11 chars, alphanumeric/dash/underscore)
  if (trimmed.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/
  ];
  
  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  try {
    const url = new URL(trimmed);
    const vParam = url.searchParams.get("v");
    if (vParam && vParam.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
      return vParam;
    }
  } catch (e) {
    // ignore
  }
  
  return trimmed;
}

export default function YoutubePlayer({
  videoId,
  videoUrl,
  provider = "youtube",
  playing,
  currentTime,
  onPlaybackChange,
  onSeek,
  onHeartbeat,
  remoteEvent,
  isHost = true,
}: YoutubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const vkPlayerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Stable ref for the YouTube player's container to isolate it from React updates
  const ytContainerRef = useRef<HTMLDivElement>(null);

  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Reset stream error when source changes
  useEffect(() => {
    setStreamError(null);
  }, [videoUrl, videoId]);

  // VK Video Authorization integration variables
  const [vkToken, setVkToken] = useState(() => localStorage.getItem("vk_video_access_token") || "");
  const [vkUserId, setVkUserId] = useState(() => localStorage.getItem("vk_video_user_id") || "");
  const [vkClientId, setVkClientId] = useState(() => {
    return (import.meta as any).env?.VITE_VK_CLIENT_ID || localStorage.getItem("vk_client_id") || "51786574"; 
  });
  const [showVkConfig, setShowVkConfig] = useState(false);
  const [showAuthOverlay, setShowAuthOverlay] = useState(true);

  // Trigger VK implicit OAuth flow popup (Bypassed / Instant mode)
  const handleVkLogin = () => {
    localStorage.setItem("vk_video_access_token", "direct_login_bypass");
    localStorage.setItem("vk_video_user_id", "direct_login_bypass_user");
    setVkToken("direct_login_bypass");
    setVkUserId("direct_login_bypass_user");
    setShowAuthOverlay(false);
    
    // Broadcast updating event so other components (like MediaSelector) can keep track too
    window.dispatchEvent(new Event("vk_auth_updated"));
  };

  const handleVkLoginOAuth = () => {
    const redirectUri = `${window.location.origin}/auth/vk/callback`;
    const authUrl = `https://oauth.vk.com/authorize?client_id=${vkClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&display=popup&scope=video,offline&response_type=token&v=5.131`;
    
    const popup = window.open(
      authUrl,
      "vk_oauth_popup",
      "width=650,height=650,left=150,top=100"
    );
    
    if (!popup) {
      alert("Всплывающие окна заблокированы! Пожалуйста, разрешите всплывающие окна в вашем браузере для работы авторизации VK.");
    }
  };

  // Listen for VK Auth token transfer from callback window or local events
  useEffect(() => {
    const handleVkOauthMessage = (event: MessageEvent) => {
      const origin = event.origin || "";
      if (!origin.endsWith(".run.app") && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
        return;
      }
      if (event.data?.type === "VK_OAUTH_SUCCESS") {
        const token = event.data.accessToken;
        if (token) {
          localStorage.setItem("vk_video_access_token", token);
          if (event.data.userId) {
            localStorage.setItem("vk_video_user_id", event.data.userId);
          }
          setVkToken(token);
          if (event.data.userId) {
            setVkUserId(event.data.userId);
          }
        }
      }
    };

    const handleVkAuthUpdated = () => {
      setVkToken(localStorage.getItem("vk_video_access_token") || "");
      setVkUserId(localStorage.getItem("vk_video_user_id") || "");
    };

    window.addEventListener("message", handleVkOauthMessage);
    window.addEventListener("vk_auth_updated", handleVkAuthUpdated);
    
    return () => {
      window.removeEventListener("message", handleVkOauthMessage);
      window.removeEventListener("vk_auth_updated", handleVkAuthUpdated);
    };
  }, []);

  const isRemoteStatusUpdate = useRef(false);
  const lastTimeRef = useRef(0);
  const playerIframeId = "unified-iframe-player";

  // Check if URL is a direct media file stream or any custom video stream from unrecognized platform
  const isDirectVideo = provider === "unknown" && !!videoUrl;

  // --- STREAM INITIALIZATION EFFECT (only for direct video streams) ---
  useEffect(() => {
    if (isDirectVideo) {
      setPlayerReady(true);
    }
  }, [isDirectVideo]);

  // Stream attachment is fully handled by UniversalPlayer

  // Sync playing prop dynamically with the direct video tag
  useEffect(() => {
    if (!isDirectVideo || !videoRef.current || isRemoteStatusUpdate.current) return;
    const video = videoRef.current;
    
    if (playing) {
      if (video.paused) {
        video.play().catch(err => {
          console.warn("[Direct Video Autoplay Bypass] Initial play blocked or postponed:", err);
        });
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
    }
  }, [isDirectVideo, playing]);

  // Periodic visual time synchronization tracking
  useEffect(() => {
    if (!isDirectVideo) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || isRemoteStatusUpdate.current) return;
      lastTimeRef.current = video.currentTime;
    }, 500);
    return () => clearInterval(interval);
  }, [isDirectVideo]);

  // Handle local actions for custom video player
  const handleLocalPlay = () => {
    console.log(`[YoutubePlayer handleLocalPlay] isHost: ${isHost}, isRemoteStatusUpdate: ${isRemoteStatusUpdate.current}`);
    if (!isHost) return;
    if (isRemoteStatusUpdate.current || !videoRef.current) return;
    console.log(`[YoutubePlayer handleLocalPlay] Dispatching play event with time: ${videoRef.current.currentTime}`);
    onPlaybackChange(true, videoRef.current.currentTime);
  };

  const handleLocalPause = () => {
    console.log(`[YoutubePlayer handleLocalPause] isHost: ${isHost}, isRemoteStatusUpdate: ${isRemoteStatusUpdate.current}`);
    if (!isHost) return;
    if (isRemoteStatusUpdate.current || !videoRef.current) return;
    console.log(`[YoutubePlayer handleLocalPause] Dispatching pause event with time: ${videoRef.current.currentTime}`);
    onPlaybackChange(false, videoRef.current.currentTime);
  };

  const handleLocalSeeked = () => {
    console.log(`[YoutubePlayer handleLocalSeeked] isHost: ${isHost}, isRemoteStatusUpdate: ${isRemoteStatusUpdate.current}`);
    if (!isHost) return;
    if (isRemoteStatusUpdate.current || !videoRef.current) return;
    console.log(`[YoutubePlayer handleLocalSeeked] Dispatching seek event with time: ${videoRef.current.currentTime}`);
    onSeek(videoRef.current.currentTime);
  };

  // 1. Load YouTube IFrame Player API (only if youtube is used)
  useEffect(() => {
    if (provider !== "youtube") return;
    if (window.YT && window.YT.Player) {
      setApiReady(true);
      return;
    }

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.body.appendChild(tag);
      }
    }

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousReady) previousReady();
      setApiReady(true);
    };

    // Keep checking in case script loads but onYouTubeIframeAPIReady is bypassed
    const pollInterval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        setApiReady(true);
        clearInterval(pollInterval);
      }
    }, 500);

    return () => clearInterval(pollInterval);
  }, [provider]);

  // 2. Load VK Video Player API (only if vk is used)
  useEffect(() => {
    if (provider !== "vk") return;
    if (window.VK && window.VK.VideoPlayer) return;

    const tag = document.createElement("script");
    tag.src = "https://vk.com/js/api/videoplayer.js";
    document.body.appendChild(tag);
  }, [provider]);

  // Handle local user actions in the YouTube player
  const handlePlayerStateChange = (event: any) => {
    if (!playerRef.current) return;
    if (!isHost) return; // Only host/creator controls can broadcast

    const playerState = event.data;
    const currTime = playerRef.current.getCurrentTime() || 0;

    if (isRemoteStatusUpdate.current) {
      if (playerState === window.YT.PlayerState.PLAYING || playerState === window.YT.PlayerState.PAUSED) {
        isRemoteStatusUpdate.current = false;
      }
      return;
    }

    if (playerState === window.YT.PlayerState.PLAYING) {
      onPlaybackChange(true, currTime);
    } else if (playerState === window.YT.PlayerState.PAUSED) {
      onPlaybackChange(false, currTime);
    }
  };

  // 3. Initialize YouTube Player
  useEffect(() => {
    if (provider !== "youtube" || !apiReady) return;
    const resolvedId = extractYoutubeId(videoId || videoUrl || "");
    if (!resolvedId) return;

    // Destroy existing player instance before recreating
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        console.warn("Error destroying previous player instance", e);
      }
      playerRef.current = null;
      setPlayerReady(false);
    }

    // Set up stable target DOM inside the wrapper ref.
    // Since React never mutates ytContainerRef after initial render,
    // this keeps YouTube's generated iframe completely isolated from React's diffing engine.
    if (!ytContainerRef.current) return;
    ytContainerRef.current.innerHTML = "";
    const targetDiv = document.createElement("div");
    targetDiv.id = playerIframeId;
    targetDiv.className = "w-full h-full";
    ytContainerRef.current.appendChild(targetDiv);

    if (!window.YT || !window.YT.Player) {
      console.warn("YouTube API not fully available yet.");
      return;
    }

    let isDestroyed = false;

    const player = new window.YT.Player(playerIframeId, {
      height: "100%",
      width: "100%",
      videoId: resolvedId,
      playerVars: {
        autoplay: playing ? 1 : 0,
        controls: isHost ? 1 : 0,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event: any) => {
          if (isDestroyed) return;
          playerRef.current = player;
          setPlayerReady(true);
          
          if (currentTime > 0) {
            isRemoteStatusUpdate.current = true;
            event.target.seekTo(currentTime, true);
          }
          if (playing) {
            isRemoteStatusUpdate.current = true;
            event.target.playVideo();
          } else {
            event.target.pauseVideo();
          }

          setTimeout(() => {
            isRemoteStatusUpdate.current = false;
          }, 800);
        },
        onStateChange: handlePlayerStateChange,
        onError: (event: any) => {
          if (isDestroyed) return;
          const errCode = event.data;
          console.warn(`[YouTube Player Error] Code: ${errCode}`);
          let errorMsg = "Произошла неизвестная ошибка при воспроизведении YouTube.";
          if (errCode === 2) {
            errorMsg = "Недопустимый идентификатор видео.";
          } else if (errCode === 100) {
            errorMsg = "Видео не найдено (удалено или скрыто настройками приватности).";
          } else if (errCode === 101 || errCode === 150) {
            errorMsg = "Автор видео запретил его воспроизведение на сторонних ресурсах (встраивание заблокировано).";
          } else if (errCode === 5) {
            errorMsg = "Ошибка воспроизведения HTML5-плеера YouTube.";
          }
          setStreamError(errorMsg);
          setPlayerReady(false);
        },
      },
    });

    playerRef.current = player;

    return () => {
      isDestroyed = true;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        playerRef.current = null;
      }
      setPlayerReady(false);
    };
  }, [apiReady, videoId, videoUrl, provider, isHost]);

  // Load handler for VK Video iframe to bind API
  const handleVkIframeLoad = () => {
    if (provider !== "vk" || !window.VK) return;
    try {
      const iframe = document.getElementById(playerIframeId) as HTMLIFrameElement;
      if (iframe) {
        const vkPlayer = new window.VK.VideoPlayer(iframe);
        vkPlayerRef.current = vkPlayer;

        vkPlayer.on("timeupdate", (data: any) => {
          if (isRemoteStatusUpdate.current) return;
          const t = data.time || 0;
          lastTimeRef.current = t;
        });

        vkPlayer.on("started", () => {
          if (isRemoteStatusUpdate.current) return;
          onPlaybackChange(true, lastTimeRef.current);
        });

        vkPlayer.on("paused", () => {
          if (isRemoteStatusUpdate.current) return;
          onPlaybackChange(false, lastTimeRef.current);
        });

        vkPlayer.on("seeked", (data: any) => {
          if (isRemoteStatusUpdate.current) return;
          onSeek(data.time || 0);
        });
      }
    } catch (err) {
      console.warn("Failed to initialize VK.VideoPlayer on iframe", err);
    }
  };

  // 4. Message Listener for Rutube embedding
  useEffect(() => {
    if (provider !== "rutube") return;

    const handleRutubeMessage = (event: MessageEvent) => {
      if (!event.origin.includes("rutube.ru")) return;

      try {
        const data = JSON.parse(event.data);
        if (data.type === "player:currentTimeUpdate") {
          const t = data.data.currentTime || 0;
          lastTimeRef.current = t;
        }

        if (data.type === "player:rollStateChange") {
          const state = data.data.state;
          if (state === "playing" && !isRemoteStatusUpdate.current) {
            onPlaybackChange(true, lastTimeRef.current);
          } else if (state === "paused" && !isRemoteStatusUpdate.current) {
            onPlaybackChange(false, lastTimeRef.current);
          }
        }
      } catch (e) {
        // Safe check
      }
    };

    window.addEventListener("message", handleRutubeMessage);
    return () => {
      window.removeEventListener("message", handleRutubeMessage);
    };
  }, [provider, onPlaybackChange]);

  // Periodic loop seeking listener (only YouTube)
  useEffect(() => {
    if (provider !== "youtube" || !playerReady || !playerRef.current) return;

    const interval = setInterval(() => {
      if (!playerRef.current || isRemoteStatusUpdate.current) return;

      try {
        const currTime = playerRef.current.getCurrentTime() || 0;
        const delta = Math.abs(currTime - lastTimeRef.current);
        if (delta > 2.5) {
          onSeek(currTime);
        }
        lastTimeRef.current = currTime;
      } catch (err) {
        // Safe check
      }
    }, 800);

    return () => clearInterval(interval);
  }, [playerReady, onSeek, provider]);

  // Host Heartbeat Broadcast Loop
  useEffect(() => {
    if (!isHost || !playing || !onHeartbeat) return;

    const interval = setInterval(() => {
      let currentHostTime = 0;
      if (isDirectVideo) {
        if (videoRef.current) {
          currentHostTime = videoRef.current.currentTime;
        }
      } else if (provider === "youtube" && playerReady && playerRef.current) {
        currentHostTime = playerRef.current.getCurrentTime() || 0;
      } else if (provider === "vk" && vkPlayerRef.current) {
        try {
          if (typeof vkPlayerRef.current.getCurrentTime === "function") {
            vkPlayerRef.current.getCurrentTime((t: number) => {
              if (t > 0) onHeartbeat(t);
            });
            return;
          }
        } catch (_) {}
      }

      if (currentHostTime > 0) {
        onHeartbeat(currentHostTime);
      }
    }, 1500); // 1.5 seconds interval for Perfect Sync

    return () => clearInterval(interval);
  }, [isHost, playing, provider, playerReady, isDirectVideo, onHeartbeat]);

  // 5. Sync YouTube & Other players to Remote WebSocket events
  useEffect(() => {
    if (!remoteEvent) return;

    try {
      if (isDirectVideo) {
        if (!videoRef.current) return;
        const video = videoRef.current;
        isRemoteStatusUpdate.current = true;

        if (remoteEvent.type === "playback_change") {
          const targetPlaying = !!remoteEvent.playing;
          const latency = remoteEvent.timestamp ? Math.min(0.5, (Date.now() - remoteEvent.timestamp) / 1000) : 0;
          const targetTime = (remoteEvent.currentTime ?? 0) + (targetPlaying ? latency : 0);
          const timeDiff = Math.abs(video.currentTime - targetTime);

          if (timeDiff > 2.0) {
            video.currentTime = targetTime;
          }

          if (targetPlaying && video.paused) {
            video.play().catch(err => console.log("[Direct Video] play block bypass active:", err));
          } else if (!targetPlaying && !video.paused) {
            video.pause();
          }
        } else if (remoteEvent.type === "seek" && remoteEvent.currentTime !== undefined) {
          video.currentTime = remoteEvent.currentTime;
        } else if (remoteEvent.type === "heartbeat_sync") {
          const targetPlaying = !!remoteEvent.playing;
          const latency = remoteEvent.timestamp ? Math.min(0.5, (Date.now() - remoteEvent.timestamp) / 1000) : 0;
          const targetTime = (remoteEvent.currentTime ?? 0) + (targetPlaying ? latency : 0);
          const timeDiff = Math.abs(video.currentTime - targetTime);

          if (targetPlaying) {
            if (timeDiff > 1.0) {
              video.currentTime = targetTime;
              video.playbackRate = 1.0;
            } else if (timeDiff > 0.08) {
              // Gentle tuning: slightly speed up or slow down
              video.playbackRate = video.currentTime < targetTime ? 1.04 : 0.96;
            } else {
              video.playbackRate = 1.0;
            }
          } else {
            video.playbackRate = 1.0;
          }
        }

        setTimeout(() => {
          isRemoteStatusUpdate.current = false;
        }, 300);
        return;
      }

      if (provider === "youtube" && playerReady && playerRef.current) {
        const player = playerRef.current;
        const state = player.getPlayerState();

        if (remoteEvent.type === "playback_change") {
          const isCurrentlyPlaying = state === window.YT.PlayerState.PLAYING;
          const targetPlaying = !!remoteEvent.playing;
          const latency = remoteEvent.timestamp ? Math.min(0.5, (Date.now() - remoteEvent.timestamp) / 1000) : 0;
          const targetTime = (remoteEvent.currentTime ?? 0) + (targetPlaying ? latency : 0);
          const timeDiff = Math.abs((player.getCurrentTime() || 0) - targetTime);

          isRemoteStatusUpdate.current = true;

          if (timeDiff > 2.5) {
            player.seekTo(targetTime, true);
            lastTimeRef.current = targetTime;
          }

          if (targetPlaying && !isCurrentlyPlaying) {
            player.playVideo();
          } else if (!targetPlaying && isCurrentlyPlaying) {
            player.pauseVideo();
          }

          setTimeout(() => {
            isRemoteStatusUpdate.current = false;
          }, 800);
        } else if (remoteEvent.type === "seek") {
          const targetTime = remoteEvent.currentTime ?? 0;
          isRemoteStatusUpdate.current = true;
          player.seekTo(targetTime, true);
          lastTimeRef.current = targetTime;
          setTimeout(() => {
            isRemoteStatusUpdate.current = false;
          }, 800);
        } else if (remoteEvent.type === "heartbeat_sync") {
          const targetPlaying = !!remoteEvent.playing;
          const latency = remoteEvent.timestamp ? Math.min(0.5, (Date.now() - remoteEvent.timestamp) / 1000) : 0;
          const targetTime = (remoteEvent.currentTime ?? 0) + (targetPlaying ? latency : 0);
          const currentTime = player.getCurrentTime() || 0;
          const timeDiff = Math.abs(currentTime - targetTime);

          isRemoteStatusUpdate.current = true;
          if (targetPlaying) {
            if (timeDiff > 1.5) {
              player.seekTo(targetTime, true);
              lastTimeRef.current = targetTime;
              player.setPlaybackRate(1.0);
            } else if (timeDiff > 0.15) {
              player.setPlaybackRate(currentTime < targetTime ? 1.05 : 0.95);
            } else {
              player.setPlaybackRate(1.0);
            }
          } else {
            player.setPlaybackRate(1.0);
          }
          setTimeout(() => {
            isRemoteStatusUpdate.current = false;
          }, 400);
        }
      }

      if (provider === "vk" && vkPlayerRef.current) {
        const player = vkPlayerRef.current;
        isRemoteStatusUpdate.current = true;

        if (remoteEvent.type === "playback_change") {
          if (remoteEvent.playing) {
            player.play();
          } else {
            player.pause();
          }
          if (remoteEvent.currentTime !== undefined) {
            player.seek(remoteEvent.currentTime);
          }
        } else if (remoteEvent.type === "seek" && remoteEvent.currentTime !== undefined) {
          player.seek(remoteEvent.currentTime);
        } else if (remoteEvent.type === "heartbeat_sync") {
          const targetPlaying = !!remoteEvent.playing;
          const latency = remoteEvent.timestamp ? Math.min(0.5, (Date.now() - remoteEvent.timestamp) / 1000) : 0;
          const targetTime = (remoteEvent.currentTime ?? 0) + (targetPlaying ? latency : 0);
          try {
            if (typeof player.getCurrentTime === "function") {
              player.getCurrentTime((currTime: number) => {
                const timeDiff = Math.abs(currTime - targetTime);
                if (timeDiff > 1.5) {
                  player.seek(targetTime);
                }
              });
            } else if (remoteEvent.currentTime !== undefined) {
              player.seek(targetTime);
            }
          } catch (_) {
            if (remoteEvent.currentTime !== undefined) {
              player.seek(targetTime);
            }
          }
        }

        setTimeout(() => {
          isRemoteStatusUpdate.current = false;
        }, 300);
      }

      if (provider === "rutube") {
        const iframe = document.getElementById(playerIframeId) as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          isRemoteStatusUpdate.current = true;

          if (remoteEvent.type === "playback_change") {
            const commandType = remoteEvent.playing ? "player:play" : "player:pause";
            iframe.contentWindow.postMessage(JSON.stringify({ type: commandType }), "*");

            if (remoteEvent.currentTime !== undefined) {
              iframe.contentWindow.postMessage(JSON.stringify({
                type: "player:setCurrentTime",
                data: { time: remoteEvent.currentTime }
              }), "*");
            }
          } else if (remoteEvent.type === "seek" && remoteEvent.currentTime !== undefined) {
            iframe.contentWindow.postMessage(JSON.stringify({
              type: "player:setCurrentTime",
              data: { time: remoteEvent.currentTime }
            }), "*");
          } else if (remoteEvent.type === "heartbeat_sync") {
            const targetPlaying = !!remoteEvent.playing;
            const latency = remoteEvent.timestamp ? Math.min(0.5, (Date.now() - remoteEvent.timestamp) / 1000) : 0;
            const targetTime = (remoteEvent.currentTime ?? 0) + (targetPlaying ? latency : 0);
            // Since we can't easily query Rutube currentTime over postMessage synchronously without setting up active listeners,
            // we skip minor drift adjustments and only enforce periodically on seek or playback change.
          }

          setTimeout(() => {
            isRemoteStatusUpdate.current = false;
          }, 300);
        }
      }
    } catch (e) {
      console.error("Failed to execute remote events inside player", e);
      isRemoteStatusUpdate.current = false;
    }
  }, [playerReady, remoteEvent, provider]);

  // Master click-to-command synchronizer for room participants (fallbacks fallback)
  const triggerMasterPlayPlaystate = (targetPlay: boolean) => {
    onPlaybackChange(targetPlay, lastTimeRef.current);
  };

  const triggerMasterQuickSeek = (delta: number) => {
    const t = Math.max(0, lastTimeRef.current + delta);
    onSeek(t);
  };

  // Build the correct iframe src based on provider
  let embedUrl = "";
  let vkOid = "";
  let vkId = "";

  if (provider === "youtube") {
    const resolvedId = extractYoutubeId(videoId || videoUrl || "");
    embedUrl = `https://www.youtube.com/embed/${resolvedId}?enablejsapi=1&origin=${window.location.origin}`;
  } else if (provider === "vk") {
    let vkHash = "";
    if (videoId && typeof videoId === "string" && videoId.includes("_")) {
      const parts = videoId.split("_");
      vkOid = parts[0] || "";
      vkId = parts[1] || "";
      if (parts[2]) {
        vkHash = `&hash=${parts[2]}`;
      }
    } else {
      vkId = videoId || "";
    }
    const tokenParam = vkToken ? `&access_token=${vkToken}` : "";
    embedUrl = `https://vk.com/video_ext.php?oid=${vkOid}&id=${vkId}${vkHash}${tokenParam}&autoplay=${playing ? 1 : 0}`;
  } else if (provider === "rutube") {
    let rId = videoId || "";
    let rPrivate = "";
    if (videoId && typeof videoId === "string" && videoId.includes("_")) {
      const parts = videoId.split("_");
      rId = parts[0] || "";
      rPrivate = `?p=${parts[1]}`;
    }
    embedUrl = `https://rutube.ru/play/embed/${rId}${rPrivate}${rPrivate ? "&" : "?"}autoplay=${playing ? 1 : 0}`;
  } else if (provider === "yandex") {
    embedUrl = `https://dzen.ru/embed/${videoId || ""}?from=zen&autoplay=${playing ? 1 : 0}`;
  } else {
    embedUrl = videoId || "";
  }

  const getProviderLabel = () => {
    switch (provider) {
      case "youtube":
        return "YouTube Watch Party Live";
      case "vk":
        return "VK Видео Плеер (Синхронизация)";
      case "rutube":
        return "Rutube Эфирный Плеер";
      case "yandex":
        return "Яндекс / Дзен Видео";
      default:
        return "Универсальный Медиа-поток";
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-xl group flex flex-col">
      {/* Provider Details Bar */}
      <div className="bg-zinc-950 px-4 py-2 border-b border-zinc-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-xs text-zinc-400 font-medium font-sans">
        <span className="flex items-center gap-1.5 font-display tracking-wide uppercase text-[10px] text-zinc-300">
          <Monitor className="w-3.5 h-3.5 text-indigo-400" />
          {getProviderLabel()}
        </span>
        <div className="flex items-center gap-2 flex-wrap sm:justify-end text-[10px]">
          {provider === "vk" && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#251842]/30 border border-[#3f2575]/15 rounded mr-1">
              {vkToken ? (
                <>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    VK Авторизован
                  </span>
                  {vkUserId && <span className="text-zinc-500 font-mono text-[9px]">(ID: {vkUserId})</span>}
                  <button
                    onClick={() => {
                      localStorage.removeItem("vk_video_access_token");
                      localStorage.removeItem("vk_video_user_id");
                      setVkToken("");
                      setVkUserId("");
                    }}
                    className="text-red-400 hover:text-red-300 underline underline-offset-2 ml-1 cursor-pointer font-bold uppercase text-[8px]"
                    title="Выйти из аккаунта VK"
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <span className="text-zinc-500">VK: Необходим вход</span>
                  <button
                    onClick={handleVkLogin}
                    className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer font-bold uppercase text-[8px] flex items-center gap-0.5"
                    title="Быстрый вход через VK OAuth"
                  >
                    <LogIn className="w-2.5 h-2.5" />
                    Войти
                  </button>
                </>
              )}
            </div>
          )}
          
          <span className="flex items-center gap-1 font-mono text-[10px] bg-zinc-855 px-2 py-0.5 rounded border border-zinc-800/40 text-indigo-400">
            {provider === "youtube" ? "API СИНХРОНИЗАЦИЯ" : (provider === "vk" ? "VK API СИНХРОНИЗАЦИЯ" : (provider === "rutube" ? "RUTUBE СИНХРОНИЗАЦИЯ" : (isDirectVideo ? "ПРЯМОЙ СТРИМ" : "СИНХРОНИЗАЦИЯ")))}
          </span>
        </div>
      </div>

      {/* Target iframe placeholder */}
      <div className="relative w-full aspect-video bg-zinc-950">
        {streamError && (
          <div className="absolute inset-0 bg-zinc-955/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
              <HelpCircle className="w-6 h-6 text-red-500 animate-bounce" />
            </div>
            <h4 className="text-red-400 font-display font-black text-xs sm:text-sm tracking-wider uppercase mb-1.5">
              Внимание: ошибка потока
            </h4>
            <p className="text-zinc-200 text-xs sm:text-sm max-w-md font-medium leading-relaxed">
              {streamError}
            </p>
            <p className="text-zinc-500 text-[10px] mt-2 font-mono">
              URL: {videoUrl}
            </p>
            <button
              onClick={() => {
                setStreamError(null);
                setPlayerReady(false);
                if (provider === "youtube") {
                  setApiReady(false);
                  setTimeout(() => setApiReady(true), 100);
                } else {
                  const video = videoRef.current;
                  if (video) {
                    video.load();
                  }
                }
              }}
              className="mt-4 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[10px] font-bold rounded-lg border border-zinc-750 transition-all cursor-pointer uppercase tracking-wider"
            >
              Попробовать снова 🔄
            </button>
          </div>
        )}

        {provider === "youtube" ? (
          /* 
             Stable React-independent container wrapper.
             React never updates this wrapper, allowing window.YT.Player inside it to run undisturbed.
          */
          <div ref={ytContainerRef} className="w-full h-full" />
        ) : isDirectVideo ? (
          <div className="w-full h-full bg-black rounded-xl overflow-hidden relative flex items-center justify-center">
            <UniversalPlayer
              ref={videoRef}
              id={playerIframeId}
              src={videoUrl}
              controls={isHost}
              className="w-full h-full max-h-full max-w-full object-contain"
              onPlay={handleLocalPlay}
              onPause={handleLocalPause}
              onSeeked={handleLocalSeeked}
              playsInline
              preload="auto"
              controlsList="nodownload"
              style={{ pointerEvents: isHost ? "auto" : "none" }}
              onError={(e) => {
                console.error("[HTML5 Video Error]", e);
                setStreamError("Прямой поток недоступен, используйте другой источник");
              }}
            />
          </div>
        ) : (
          <iframe
            id={playerIframeId}
            src={embedUrl}
            className="w-full h-full border-0 animate-fade-in"
            allow={`autoplay; encrypted-media; fullscreen; picture-in-picture${
              provider === "vk" ? "; camera; microphone; clipboard-write" : ""
            }`}
            data-platform={provider}
            allowFullScreen
            onLoad={provider === "vk" ? handleVkIframeLoad : undefined}
          />
        )}

        {/* Sync Badge overlay status */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 bg-zinc-950/80 backdrop-blur-md rounded-full text-xs font-mono font-medium tracking-tight text-emerald-400 border border-emerald-500/20 shadow-md">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          СИНХРОНИЗАЦИЯ АКТИВНА
        </div>

        {/* VK Video Missing Token Auth Overlay Cover */}
        {provider === "vk" && !vkToken && showAuthOverlay && (
          <div className="absolute inset-0 bg-zinc-950/93 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center z-10 transition-all select-none font-sans">
            <Lock className="w-8 h-8 text-indigo-400 mb-3 animate-pulse" />
            <h4 className="text-zinc-100 font-bold text-sm tracking-wide uppercase mb-1">
              Сессия VK Видео не авторизована
            </h4>
            <p className="text-zinc-400 text-xs max-w-sm mb-4 leading-relaxed">
              Некоторый контент VK (приватное видео, эфиры, возрастные ограничения) требует авторизации для просмотра. Кликните ниже для входа.
            </p>
            
            <div className="flex flex-col gap-2.5 w-full max-w-xs">
              <button
                onClick={handleVkLogin}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg cursor-pointer select-none border-0"
              >
                <LogIn className="w-4 h-4" />
                <span>Войти БЕЗ ТОКЕНОВ (Быстро)</span>
              </button>
              
              <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-zinc-500">
                <button 
                  onClick={() => setShowVkConfig(!showVkConfig)}
                  className="hover:text-zinc-300 font-mono transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Settings className="w-3 h-3" />
                  <span>Параметры App ({vkClientId})</span>
                </button>
                <button
                  onClick={() => setShowAuthOverlay(false)}
                  className="hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  Продолжить без входа
                </button>
              </div>

              {showVkConfig && (
                <div className="mt-2 text-left p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col gap-2">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold block">
                    ID веб-приложения VK (client_id):
                  </span>
                  <input
                    type="text"
                    value={vkClientId}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setVkClientId(val);
                      localStorage.setItem("vk_client_id", val);
                    }}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white font-mono w-full focus:outline-none focus:border-indigo-500"
                    placeholder="client_id (например, 51786574)"
                  />
                  <p className="text-[8px] text-zinc-500 leading-normal mb-1">
                    Создайте бесплатное Web-приложение на vk.com/dev. Скопируйте ID и укажите Разрешенный Redirect URI: <code className="text-indigo-400 font-mono">{window.location.origin}/auth/vk/callback</code>
                  </p>

                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold block border-t border-zinc-800 pt-2">
                    ИЛИ введите Access Token напрямую (без API):
                  </span>
                  <input
                    type="password"
                    value={vkToken}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setVkToken(val);
                      localStorage.setItem("vk_video_access_token", val);
                    }}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white font-mono w-full focus:outline-none focus:border-indigo-500"
                    placeholder="vk1.a.xxxx..."
                  />

                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold block">
                    ID пользователя VK (User ID):
                  </span>
                  <input
                    type="text"
                    value={vkUserId}
                    onChange={(e) => {
                      const val = e.target.value.trim().replace(/\D/g, "");
                      setVkUserId(val);
                      localStorage.setItem("vk_video_user_id", val);
                    }}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white font-mono w-full focus:outline-none focus:border-indigo-500"
                    placeholder="Например: 12345678"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Synchronized Broadcast Desk for non-Youtube */}
      {provider !== "youtube" && (
        <div className="p-3.5 bg-zinc-950 border-t border-zinc-900 flex flex-col md:flex-row items-center gap-3.5 justify-between font-sans">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              {isHost ? "Эфирный Мастер-пульт синхронизации" : "Синхронизация эфира активна"}
            </span>
            <span className="text-[10px] text-zinc-500">
              {isHost 
                ? "Если встроенные возможности браузера блокируют автоматическое воспроизведение, используйте пульт:"
                : "Управление плеером доступно только создателю комнаты. Воспроизведение синхронизируется автоматически."}
            </span>
          </div>

          {isHost ? (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                id="master-play-btn"
                onClick={() => triggerMasterPlayPlaystate(true)}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all text-emerald-400 border cursor-pointer border-emerald-500/20 hover:bg-emerald-500/10 ${
                  playing ? "bg-emerald-500/10 font-bold" : "bg-transparent"
                }`}
                title="Запустить воспроизведение для всех участников"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>СТАРТ ДЛЯ ВСЕХ</span>
              </button>

              <button
                id="master-pause-btn"
                onClick={() => triggerMasterPlayPlaystate(false)}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all text-zinc-300 border cursor-pointer border-zinc-800 hover:bg-zinc-800 ${
                  !playing ? "bg-zinc-800 font-bold" : "bg-transparent"
                }`}
                title="Поставить на паузу для всех участников"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>ПАУЗА ДЛЯ ВСЕХ</span>
              </button>

              <button
                id="master-sync-minus-btn"
                onClick={() => triggerMasterQuickSeek(-10)}
                className="px-2.5 py-2 rounded-xl text-xs font-mono font-bold hover:bg-zinc-850 border border-zinc-850 text-indigo-400 hover:text-indigo-300 cursor-pointer transition-all"
                title="Перемотать назад на 10 секунд для всех"
              >
                -10с
              </button>

              <button
                id="master-sync-plus-btn"
                onClick={() => triggerMasterQuickSeek(10)}
                className="px-2.5 py-2 rounded-xl text-xs font-mono font-bold hover:bg-zinc-850 border border-zinc-850 text-indigo-400 hover:text-indigo-300 cursor-pointer transition-all"
                title="Перемотать вперёд на 10 секунд для всех"
              >
                +10с
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl">
              <Lock className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Пульт у Создателя 👑</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
