import React, { useState, useEffect, useRef } from "react";
import { 
  Database, Wifi, Terminal, Copy, Check, Play, Pause, SkipForward, Send, Key, 
  HelpCircle, Monitor, RefreshCw, FileCode, CheckCircle2, ChevronRight, X, Sparkles, Smartphone, Code2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SyncTVClient } from "../services/synctv";

interface SyncTvDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SyncTvDashboard({ isOpen, onClose }: SyncTvDashboardProps) {
  // Config states initialized with user's exact credentials
  const [serverUrl, setServerUrl] = useState(() => {
    return localStorage.getItem("sferium_synctv_server_url") || (typeof window !== "undefined" ? window.location.origin : "https://sferium.homes");
  });
  const [roomId, setRoomId] = useState("sferium-test-room");
  const [username, setUsername] = useState("DevUser");
  const [password, setPassword] = useState("");
  const [testVideoUrl, setTestVideoUrl] = useState("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");

  // Connection/Status states
  const [client, setClient] = useState<SyncTVClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [activeTab, setActiveTab] = useState<"tester" | "typescript" | "flutter" | "universal" | "docs">("tester");
  const [logs, setLogs] = useState<Array<{ id: string; time: string; type: string; text: string }>>([]);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  
  // Player state tracking
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll terminal logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Persist serverUrl to localStorage
  useEffect(() => {
    localStorage.setItem("sferium_synctv_server_url", serverUrl);
  }, [serverUrl]);

  // Clean disconnect on unmount
  useEffect(() => {
    return () => {
      if (client) {
        client.disconnect();
      }
    };
  }, [client]);

  const addLog = (type: string, text: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { id: Math.random().toString(), time, type, text }]);
  };

  // Copy-paste utility
  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  // Test dynamic server creation and websocket entry
  const handleConnect = async () => {
    if (connectionStatus === "connected" && client) {
      client.disconnect();
      setConnectionStatus("disconnected");
      setIsConnected(false);
      addLog("info", "Disconnected client state manually.");
      return;
    }

    setConnectionStatus("connecting");
    addLog("info", `Step 1: Attempting to synchronize Room creation via REST pre-flight...`);

    // Pre-create room via SyncTV REST API dynamically
    const createRes = await SyncTVClient.createRoom(serverUrl, {
      room: roomId,
      password,
      videoUrl: testVideoUrl,
      videoType: "universal"
    });

    if (createRes.success) {
      addLog("success", `REST pre-flight Room Created or Confirmed! Result: ${JSON.stringify(createRes.data)}`);
    } else {
      addLog("warn", `Optional REST creation skipped/returned (likely already exists or public token bypass required: ${createRes.error})`);
    }

    addLog("info", `Step 2: Starting WebSocket handshaking on SyncTV...`);

    const newClient = new SyncTVClient({
      serverUrl,
      roomId,
      username,
      password,
      onStateChange: (state) => {
        if (state.isPlaying !== undefined) setPlaying(state.isPlaying);
        if (state.currentTime !== undefined) setCurrentTime(state.currentTime);
        addLog("received", `Received Play State Sync: IsPlaying=${state.isPlaying}, Time=${state.currentTime.toFixed(2)}s, sender=${state.sender}`);
      },
      onMessage: (msg) => {
        addLog("received", `📨 Chat message received from [${msg.sender}]: ${msg.text}`);
      },
      onParticipantChange: (users) => {
        addLog("info", `Participant roster updated. Present users: [${users.join(", ")}]`);
      },
      onError: (err) => {
        addLog("error", `Connection Encountered Error: ${JSON.stringify(err)}`);
      },
      onClose: () => {
        addLog("warn", `WS Connection closed.`);
        setConnectionStatus("disconnected");
        setIsConnected(false);
      }
    });

    // Custom logger hook within class
    newClient.on("log", (logItem: any) => {
      addLog(logItem.type, logItem.text);
    });

    newClient.on("open", () => {
      setConnectionStatus("connected");
      setIsConnected(true);
      setClient(newClient);
    });

    try {
      await newClient.connect();
    } catch (e) {
      addLog("error", `Handshake operation failed. Ensure Docker Container is up on Port 8280.`);
      setConnectionStatus("disconnected");
    }
  };

  // Dispatch live sync commands
  const handlePlayCommand = () => {
    if (!client) return;
    const nextState = !playing;
    setPlaying(nextState);
    if (nextState) {
      client.sendPlay(currentTime);
    } else {
      client.sendPause(currentTime);
    }
  };

  const handleSeekCommand = (seconds: number) => {
    if (!client) return;
    const newTime = Math.max(0, currentTime + seconds);
    setCurrentTime(newTime);
    client.sendSeek(newTime);
  };

  const handleSendChat = () => {
    if (!client) return;
    client.sendMessage("Hello from Sferium integration suite! 🚀");
  };

  // Snippets definitions
  const typescriptCode = `/**
 * Custom SyncTV WebSocket Client for React / React Native / JavaScript
 * Save as: services/SyncTVService.ts
 */

export interface SyncTVConfig {
  serverUrl: string; // e.g. "ws://185.125.103.34:8280"
  roomId: string;
  username: string;
  password?: string;
  onStateUpdate: (isPlaying: boolean, currentTime: number) => void;
  onChatMessage?: (sender: string, text: string) => void;
  onConnected?: () => void;
}

export class SyncTVService {
  private ws: WebSocket | null = null;
  private config: SyncTVConfig;

  constructor(config: SyncTVConfig) {
    this.config = config;
  }

  public connect() {
    const wsUrl = this.buildUrl();
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("Connected to SyncTV Server!");
      if (this.config.onConnected) this.config.onConnected();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const type = (message.type || message.event || "").toLowerCase();
        const payload = message.payload || message.data || message;

        switch (type) {
          case "play":
            this.config.onStateUpdate(true, payload.time || payload.currentTime || 0);
            break;
          case "pause":
            this.config.onStateUpdate(false, payload.time || payload.currentTime || 0);
            break;
          case "seek":
            this.config.onStateUpdate(true, payload.time || payload.currentTime || 0);
            break;
          case "chat":
            if (this.config.onChatMessage) {
              this.config.onChatMessage(payload.sender, payload.text);
            }
            break;
        }
      } catch (err) {
        console.error("Failed to parse SyncTV WS packet:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("SyncTV closed. Reconnecting...");
      setTimeout(() => this.connect(), 3000);
    };
  }

  private buildUrl(): string {
    const base = this.config.serverUrl.replace(/^http/, "ws");
    const params = new URLSearchParams({
      room: this.config.roomId,
      name: this.config.username,
    });
    if (this.config.password) {
      params.append("password", this.config.password);
    }
    return \`\${base}/api/v1/room/join?\${params.toString()}\`;
  }

  public sendPlay(seconds: number) {
    this.send("PLAY", { time: seconds });
  }

  public sendPause(seconds: number) {
    this.send("PAUSE", { time: seconds });
  }

  public sendSeek(seconds: number) {
    this.send("SEEK", { time: seconds });
  }

  private send(type: string, payload: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type,
      payload: { ...payload, sender: this.config.username }
    }));
  }

  public disconnect() {
    if (this.ws) this.ws.close();
  }
}`;

  const flutterCode = `/// Custom SyncTV WebSocket Client for Flutter / Dart
/// Dependencies: web_socket_channel
/// Save as: services/synctv_service.dart

import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

class SyncTVState {
  final bool isPlaying;
  final double currentTime;
  final String sender;

  SyncTVState({required this.isPlaying, required this.currentTime, required this.sender});
}

class SyncTVService {
  final String serverUrl; // e.g. "ws://185.125.103.34:8280"
  final String roomId;
  final String username;
  final String? password;

  WebSocketChannel? _channel;
  bool isConnected = false;

  // Callbacks
  Function(SyncTVState)? onStateUpdate;
  Function(String sender, String text)? onChatMessage;

  SyncTVService({
    required this.serverUrl,
    required this.roomId,
    required this.username,
    this.password,
  });

  void connect() {
    final wsUri = _buildWsUri();
    _channel = WebSocketChannel.connect(wsUri);
    isConnected = true;

    _channel!.stream.listen((message) {
      _handlePacket(message);
    }, onDone: () {
      isConnected = false;
      // Reconnect loop if needed
    }, onError: (err) {
      isConnected = false;
    });
  }

  Uri _buildWsUri() {
    final baseUrl = serverUrl.replaceAll("http://", "ws://").replaceAll("https://", "wss://");
    final buffer = StringBuffer(baseUrl)
      ..write("/api/v1/room/join")
      ..write("?room=")
      ..write(Uri.encodeComponent(roomId))
      ..write("&name=")
      ..write(Uri.encodeComponent(username));
    
    if (password != null && password!.isNotEmpty) {
      buffer.write("&password=\${Uri.encodeComponent(password!)}");
    }
    return Uri.parse(buffer.toString());
  }

  void _handlePacket(String raw) {
    try {
      final json = jsonDecode(raw);
      final type = (json['type'] ?? json['event'] ?? '').toString().toLowerCase();
      final payload = json['payload'] ?? json['data'] ?? json;

      switch (type) {
        case 'play':
          onStateUpdate?.call(SyncTVState(
            isPlaying: true,
            currentTime: (payload['time'] ?? payload['currentTime'] ?? 0.0).toDouble(),
            sender: payload['sender'] ?? 'unknown',
          ));
          break;
        case 'pause':
          onStateUpdate?.call(SyncTVState(
            isPlaying: false,
            currentTime: (payload['time'] ?? payload['currentTime'] ?? 0.0).toDouble(),
            sender: payload['sender'] ?? 'unknown',
          ));
          break;
        case 'seek':
          onStateUpdate?.call(SyncTVState(
            isPlaying: true, // Keep playing on seek
            currentTime: (payload['time'] ?? payload['currentTime'] ?? 0.0).toDouble(),
            sender: payload['sender'] ?? 'unknown',
          ));
          break;
      }
    } catch (e) {
      print("Error decoding packet: \$e");
    }
  }

  void play(double seconds) => _send("PLAY", {"time": seconds});
  void暂停(double seconds) => _send("PAUSE", {"time": seconds});
  void seek(double seconds) => _send("SEEK", {"time": seconds});

  void _send(String type, Map<String, dynamic> data) {
    if (_channel == null) return;
    _channel!.sink.add(jsonEncode({
      "type": type,
      "payload": {
        ...data,
        "sender": username,
        "timestamp": DateTime.now().millisecondsSinceEpoch,
      }
    }));
  }

  void dispose() {
    _channel?.sink.close();
  }
}`;

  const universalPlayerCode = `// UniversalPlayer Integration Component (React & TypeScript)
import React, { useEffect, useRef } from "react";
import Hls from "hls.js";
import dashjs from "dashjs";

export default function UniversalPlayer({ src }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    video.innerHTML = "";
    video.src = "";

    if (src.endsWith(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        video.src = src;
      }
      return;
    }

    if (src.endsWith(".mpd")) {
      const player = dashjs.MediaPlayer().create();
      player.initialize(video, src, true);
      return;
    }

    video.src = src;
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      playsInline
      style={{ width: "100%", height: "100%", backgroundColor: "black" }}
    />
  );
}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            id="synctv-dashboard-root"
            className="w-full max-w-6xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                  <Database className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                    SyncTV Server & Integration Console
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Connect and synchronize real-time actions on your SyncTV Docker server at <span className="text-indigo-400">185.125.103.34:8280</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-xl transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Layout body */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-4">
              
              {/* Sidebar Tabs */}
              <div className="p-4 bg-zinc-950/40 border-r border-zinc-800/80 col-span-1 flex flex-col gap-1 overflow-y-auto">
                <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase px-2 mb-2">Рабочее пространство</span>
                
                <button
                  onClick={() => setActiveTab("tester")}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-2 transition ${
                    activeTab === "tester" 
                      ? "bg-indigo-600 font-medium text-white" 
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                  }`}
                >
                  <Wifi className="w-4 h-4" />
                  Тестирование SyncTV
                </button>

                <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase px-2 mt-4 mb-2">Интеграционные SDK</span>

                <button
                  onClick={() => setActiveTab("typescript")}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-2 transition ${
                    activeTab === "typescript" 
                      ? "bg-indigo-600 font-medium text-white" 
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                  }`}
                >
                  <Code2 className="w-4 h-4 text-sky-400" />
                  JavaScript / React SDK
                </button>

                <button
                  onClick={() => setActiveTab("flutter")}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-2 transition ${
                    activeTab === "flutter" 
                      ? "bg-indigo-600 font-medium text-white" 
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-teal-400" />
                  Flutter / Dart SDK
                </button>

                <button
                  onClick={() => setActiveTab("universal")}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-2 transition ${
                    activeTab === "universal" 
                      ? "bg-indigo-600 font-medium text-white" 
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                  }`}
                >
                  <Monitor className="w-4 h-4 text-emerald-400" />
                  Интеграция с плеером
                </button>

                <button
                  onClick={() => setActiveTab("docs")}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-2 transition ${
                    activeTab === "docs" 
                      ? "bg-indigo-600 font-medium text-white" 
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                  }`}
                >
                  <HelpCircle className="w-4 h-4 text-violet-400" />
                  Гайд и диагностика
                </button>
              </div>

              {/* Main Workspace content */}
              <div className="col-span-3 p-6 overflow-y-auto flex flex-col h-full bg-zinc-900/40">
                
                {/* 1. TESTER SPACE */}
                {activeTab === "tester" && (
                  <div className="flex-1 flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Server details config */}
                      <div className="space-y-4 p-5 bg-zinc-950/30 border border-zinc-800/80 rounded-2xl">
                        <h4 className="text-xs font-semibold text-zinc-300 tracking-wider uppercase mb-1 flex items-center gap-1.5">
                          <SettingsIcon className="w-3.5 h-3.5 text-indigo-400" />
                          Параметры подключения
                        </h4>
                        
                        <div>
                          <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">Сервер SyncTV (IP:Порт)</label>
                          <input 
                            type="text" 
                            value={serverUrl} 
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="http://185.125.103.34:8280" 
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-zinc-100 outline-none transition"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">ID Комнаты</label>
                            <input 
                              type="text" 
                              value={roomId} 
                              onChange={(e) => setRoomId(e.target.value)}
                              placeholder="sferium-test-room" 
                              className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-zinc-100 outline-none transition"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">Никнейм</label>
                            <input 
                              type="text" 
                              value={username} 
                              onChange={(e) => setUsername(e.target.value)}
                              placeholder="DevUser" 
                              className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-zinc-100 outline-none transition"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">Пароль (Опционально)</label>
                            <input 
                              type="password" 
                              value={password} 
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Без пароля" 
                              className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-zinc-100 outline-none transition"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">Тип плеера</label>
                            <select 
                              className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-zinc-100 outline-none transition"
                              disabled
                            >
                              <option>Plyr (Стандартный)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">Ссылка на тестовое видео</label>
                          <input 
                            type="text" 
                            value={testVideoUrl} 
                            onChange={(e) => setTestVideoUrl(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-zinc-400 focus:text-zinc-200 outline-none transition"
                          />
                        </div>

                        <button
                          onClick={handleConnect}
                          className={`w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition ${
                            connectionStatus === "connected"
                              ? "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                              : connectionStatus === "connecting"
                              ? "bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 cursor-not-allowed"
                              : "bg-indigo-600 hover:bg-indigo-500 text-white"
                          }`}
                        >
                          <RefreshCw className={`w-4 h-4 ${connectionStatus === "connecting" ? "animate-spin" : ""}`} />
                          {connectionStatus === "connected" ? "Отключиться от SyncTV" : connectionStatus === "connecting" ? "Подключение к серверу..." : "Подключиться к SyncTV на порту 8280"}
                        </button>
                      </div>

                      {/* Right: Actions inside connection */}
                      <div className="space-y-4 p-5 bg-zinc-950/30 border border-zinc-800/80 rounded-2xl flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-300 tracking-wider uppercase mb-3 flex items-center gap-1.5">
                            <Play className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                            Симуляция Плеера и Действий
                          </h4>
                          
                          <p className="text-xs text-zinc-400 mb-4 mb-2">
                            После подключения вы можете регулировать ползунок времени и нажимать кнопки, чтобы отправлять в WebSocket реальные SyncTV события (play/pause/seek) и проверять синхронизацию.
                          </p>
                          
                          {/* Player UI */}
                          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-zinc-400">Статус воспроизведения:</span>
                              <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${playing ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"}`}>
                                {playing ? "Воспроизведение" : "Пауза"}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] text-zinc-500">
                                <span>Текущее время</span>
                                <span>{currentTime.toFixed(1)} сек</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" 
                                max="300"
                                value={currentTime}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value);
                                  setCurrentTime(value);
                                  if (isConnected) {
                                    client?.sendSeek(value);
                                  }
                                }}
                                className="w-full accent-indigo-500 cursor-pointer"
                              />
                            </div>

                            <div className="flex gap-2 justify-center pt-2">
                              <button
                                onClick={() => handleSeekCommand(-10)}
                                disabled={!isConnected}
                                className="p-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition"
                              >
                                -10 сек
                              </button>
                              <button
                                onClick={handlePlayCommand}
                                disabled={!isConnected}
                                className="p-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition flex items-center gap-1.5 font-medium"
                              >
                                {playing ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                                {playing ? "Остановить" : "Запустить"}
                              </button>
                              <button
                                onClick={() => handleSeekCommand(10)}
                                disabled={!isConnected}
                                className="p-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition"
                              >
                                +10 сек
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                          <div className="flex gap-2">
                            <button
                              onClick={handleSendChat}
                              disabled={!isConnected}
                              className="w-full py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Отправить тест-сообщение в чат
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Console Logger */}
                    <div className="flex-1 min-h-[220px] max-h-[350px] bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col">
                      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2">
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Terminal className="w-4 h-4 text-emerald-400" />
                          WebSocket Лог Терминал синхронизации
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-ping" : "bg-red-500"}`} />
                          <span className="text-[11px] text-zinc-400 font-medium">
                            {isConnected ? "АКТИВНО" : "ОТКЛЮЧЕНО"}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
                        {logs.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-zinc-500 italic">
                            Нажмите кнопку "Подключиться", чтобы запустить тестовый поток событий...
                          </div>
                        ) : (
                          logs.map(log => (
                            <div key={log.id} className="leading-5">
                              <span className="text-zinc-500">[{log.time}]</span>{" "}
                              <span className={`font-semibold ${
                                log.type === "success" ? "text-emerald-400" :
                                log.type === "error" ? "text-red-400" :
                                log.type === "warn" ? "text-yellow-400" :
                                log.type === "send" ? "text-blue-400" :
                                log.type === "received" ? "text-purple-400" : "text-zinc-300"
                              }`}>
                                {log.type.toUpperCase()}:
                              </span>{" "}
                              <span className={log.type === "received" || log.type === "send" ? "text-zinc-200" : "text-zinc-400"}>
                                {log.text}
                              </span>
                            </div>
                          ))
                        )}
                        <div ref={logsEndRef} />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. TYPESCRIPT CLIENT CODE TAB */}
                {activeTab === "typescript" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-zinc-900 px-4 py-3 border border-zinc-800 rounded-xl">
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-100">TypeScript / JS Client Service</h4>
                        <p className="text-xs text-zinc-400">Полнофункциональная SDK обертка над WebSocket для React / React Native.</p>
                      </div>
                      <button
                        onClick={() => handleCopy("ts", typescriptCode)}
                        className="p-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        {copiedStates["ts"] ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {copiedStates["ts"] ? "Скопировано!" : "Копировать"}
                      </button>
                    </div>

                    <pre className="p-4 bg-zinc-950 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed text-zinc-300 max-h-[50vh] border border-zinc-800/80">
                      <code>{typescriptCode}</code>
                    </pre>
                  </div>
                )}

                {/* 3. FLUTTER / DART SDK TAB */}
                {activeTab === "flutter" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-zinc-900 px-4 py-3 border border-zinc-800 rounded-xl">
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-100">Dart / Flutter Integration Client</h4>
                        <p className="text-xs text-zinc-400">Напишите этот класс в вашем Flutter-приложении для синхронизации мобильного плеера.</p>
                      </div>
                      <button
                        onClick={() => handleCopy("flutter", flutterCode)}
                        className="p-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        {copiedStates["flutter"] ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {copiedStates["flutter"] ? "Скопировано!" : "Копировать"}
                      </button>
                    </div>

                    <pre className="p-4 bg-zinc-950 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed text-zinc-300 max-h-[50vh] border border-zinc-800/80">
                      <code>{flutterCode}</code>
                    </pre>
                  </div>
                )}

                {/* 4. PLAYER INTEGRATION TAB */}
                {activeTab === "universal" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-zinc-900 px-4 py-3 border border-zinc-800 rounded-xl">
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-100">UniversalPlayer Integration Component</h4>
                        <p className="text-xs text-zinc-400">Слушайте события запуска/паузы и обновляйте поток.</p>
                      </div>
                      <button
                        onClick={() => handleCopy("universal", universalPlayerCode)}
                        className="p-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        {copiedStates["universal"] ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {copiedStates["universal"] ? "Скопировано!" : "Копировать"}
                      </button>
                    </div>

                    <pre className="p-4 bg-zinc-950 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed text-zinc-200 max-h-[50vh] border border-zinc-800/80">
                      <code>{universalPlayerCode}</code>
                    </pre>
                  </div>
                )}

                {/* 5. DIAGNOSTICS & DOCS */}
                {activeTab === "docs" && (
                  <div className="space-y-5 text-zinc-300 text-sm leading-relaxed">
                    <div className="bg-zinc-950/30 border border-zinc-800 p-5 rounded-2xl">
                      <h3 className="text-base font-semibold text-zinc-100 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                        Диагностика и проверка доступности SyncTV
                      </h3>
                      <p className="mb-4">
                        Вы запустили SyncTV (synctvorg/synctv) в Docker на порту <strong>8280</strong>. Чтобы проверить доступность сервера прямо с вашего компьютера или мобильного устройства:
                      </p>

                      <div className="space-y-3 bg-zinc-950 p-4 border border-zinc-800/60 rounded-xl">
                        <div>
                          <span className="text-xs font-semibold text-zinc-400 block mb-1">Проверка доступности портов в терминале:</span>
                          <code className="p-1 px-2 bg-zinc-900 text-yellow-500 rounded font-mono text-xs">
                            curl -I http://185.125.103.34:8280
                          </code>
                        </div>
                        <p className="text-xs text-zinc-500">
                          Должно вернуться HTTP 200/302 или заголовок перенаправления на главную SyncTV страницу.
                        </p>
                      </div>
                    </div>

                    <div className="bg-zinc-950/30 border border-zinc-800 p-5 rounded-2xl space-y-3">
                      <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-violet-400" />
                        Как расширить возможности SyncTV?
                      </h3>
                      <p>
                        SyncTV осуществляет синхронизацию в реальном времени. Если вы хотите обогатить возможности системы для мобильного приложения, рассмотрите три расширения:
                      </p>
                      
                      <ul className="list-disc pl-5 text-zinc-400 space-y-2 text-xs">
                        <li>
                          <strong className="text-zinc-200">Собственные Webhooks:</strong> Добавьте в SyncTV Docker контейнер прокси-сервер на Node.js, который ловит WebSocket трафик и записывает в вашу БД (PostgreSQL/Sferium) лог историй засмотренных видео.
                        </li>
                        <li>
                          <strong className="text-zinc-200">Автоматический детекшн рекламы:</strong> Игнорируйте скачки плеера, длящиеся меньше 2 секунд в обе стороны, чтобы гости не дергали стрим при перемотке буферов.
                        </li>
                        <li>
                          <strong className="text-zinc-200">Шифрование чата:</strong> Сжимайте посылаемый в чат текст по base64/AES, чтобы обеспечить конфиденциальность комнат ваших гостей.
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <span>Сделано для мобильных платформ React Native / Flutter</span>
              <span className="text-indigo-400 font-medium">Sferium SyncTV Integration Platform</span>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
