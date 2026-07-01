/**
 * SyncTV API & WebSocket Client Library
 * Production-ready TypeScript implementation for full room sync integration.
 * For use in React, React Native, Node.js or web clients.
 */

export interface SyncTVConfig {
  serverUrl: string; // e.g. "http://185.125.103.34:8280"
  roomId: string;
  username: string;
  password?: string;
  onStateChange?: (state: SyncTVState) => void;
  onMessage?: (message: SyncTVMessage) => void;
  onParticipantChange?: (participants: string[]) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
}

export interface SyncTVState {
  isPlaying: boolean;
  currentTime: number; // in seconds
  videoUrl?: string;
  sender?: string;
}

export interface SyncTVMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

export class SyncTVClient {
  private socket: WebSocket | null = null;
  private serverUrl: string;
  private roomId: string;
  private username: string;
  private password?: string;
  private listeners: { [key: string]: Function[] } = {};
  private heartbeatTimer: any = null;
  private isReconnectEnabled = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Track state to prevent recursive state echo loops
  private lastReceivedState: SyncTVState = { isPlaying: false, currentTime: 0 };

  constructor(config: SyncTVConfig) {
    this.serverUrl = config.serverUrl;
    this.roomId = config.roomId;
    this.username = config.username;
    this.password = config.password;

    if (config.onStateChange) this.on("state", config.onStateChange);
    if (config.onMessage) this.on("message", config.onMessage);
    if (config.onParticipantChange) this.on("participants", config.onParticipantChange);
    if (config.onError) this.on("error", config.onError);
    if (config.onClose) this.on("close", config.onClose);
  }

  /**
   * Helper to construct WebSocket URL
   */
  private getWsUrl(): string {
    let base = this.serverUrl;
    if (!base.startsWith("http") && !base.startsWith("ws")) {
      // If no protocol is specified, infer from current origin
      const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
      base = `${isHttps ? "wss://" : "ws://"}${base}`;
    } else {
      // Convert http/https to ws/wss
      base = base.replace(/^http/, "ws");
    }
    // Ensure trailing slash is handled or cleaned
    base = base.replace(/\/+$/, "");
    
    const params = new URLSearchParams({
      room: this.roomId,
      name: this.username,
    });
    if (this.password) {
      params.append("password", this.password);
    }

    // SyncTV default WebSocket join path
    return `${base}/api/v1/room/join?${params.toString()}`;
  }

  /**
   * Initialize and connect WebSocket
   */
  public connect(): Promise<void> {
    this.isReconnectEnabled = true;
    const wsUrl = this.getWsUrl();
    this.emit("log", { type: "info", text: `Connecting to SyncTV at: ${wsUrl}` });

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit("open", {});
          this.emit("log", { type: "success", text: "Successfully connected to SyncTV WebSocket Server!" });
          resolve();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onerror = (error) => {
          this.emit("error", error);
          this.emit("log", { type: "error", text: `WebSocket error: ${JSON.stringify(error)}` });
          reject(error);
        };

        this.socket.onclose = () => {
          this.stopHeartbeat();
          this.emit("close", {});
          this.emit("log", { type: "warn", text: "WebSocket connection closed." });
          this.handleReconnect();
        };
      } catch (err) {
        this.emit("log", { type: "error", text: `Exception during connection: ${err}` });
        reject(err);
      }
    });
  }

  /**
   * Send Play command
   */
  public sendPlay(currentTime: number) {
    this.send("play", { time: currentTime, isPlaying: true });
    this.emit("log", { type: "send", text: `Sent command: [PLAY] at ${currentTime.toFixed(2)}s` });
  }

  /**
   * Send Pause command
   */
  public sendPause(currentTime: number) {
    this.send("pause", { time: currentTime, isPlaying: false });
    this.emit("log", { type: "send", text: `Sent command: [PAUSE] at ${currentTime.toFixed(2)}s` });
  }

  /**
   * Send Seek/Skip command
   */
  public sendSeek(currentTime: number) {
    this.send("seek", { time: currentTime });
    this.emit("log", { type: "send", text: `Sent command: [SEEK] to ${currentTime.toFixed(2)}s` });
  }

  /**
   * Send Chat message
   */
  public sendMessage(text: string) {
    this.send("chat", { text });
    this.emit("log", { type: "send", text: `Sent Chat message: "${text}"` });
  }

  /**
   * Disconnect socket cleanly
   */
  public disconnect() {
    this.isReconnectEnabled = false;
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.emit("log", { type: "info", text: "Disconnected cleanly by client requested action." });
  }

  /**
   * Internal mechanism to route WebSocket messages
   */
  private handleMessage(rawData: string) {
    try {
      const data = JSON.parse(rawData);
      this.emit("log", { type: "received", text: `Received raw event from SyncTV: ${rawData}` });

      // SyncTV typically uses message forms like standard events or action wrappers
      const type = (data.type || data.event || "").toLowerCase();
      const payload = data.payload || data.data || data;

      switch (type) {
        // Play action sync
        case "play":
        case "resume":
          this.lastReceivedState = {
            isPlaying: true,
            currentTime: payload.time || payload.currentTime || 0,
            sender: payload.sender || payload.user || "Other User"
          };
          this.emit("state", this.lastReceivedState);
          break;

        // Pause action sync
        case "pause":
        case "stop":
          this.lastReceivedState = {
            isPlaying: false,
            currentTime: payload.time || payload.currentTime || 0,
            sender: payload.sender || payload.user || "Other User"
          };
          this.emit("state", this.lastReceivedState);
          break;

        // Seek action sync
        case "seek":
        case "seek_skip":
          this.lastReceivedState = {
            isPlaying: payload.isPlaying !== undefined ? payload.isPlaying : this.lastReceivedState.isPlaying,
            currentTime: payload.time || payload.currentTime || 0,
            sender: payload.sender || payload.user || "Other User"
          };
          this.emit("state", this.lastReceivedState);
          break;

        // Initial room state snapshot or updates
        case "room_state":
        case "sync":
        case "state":
          this.lastReceivedState = {
            isPlaying: payload.isPlaying === true || payload.playing === true,
            currentTime: payload.time || payload.currentTime || payload.position || 0,
            videoUrl: payload.videoUrl || payload.url || "",
            sender: payload.sender || "System"
          };
          this.emit("state", this.lastReceivedState);
          break;

        // Chat text messages
        case "chat":
        case "message":
          const message: SyncTVMessage = {
            id: payload.id || Math.random().toString(36).substring(2),
            sender: payload.sender || payload.user || payload.name || "Anon",
            text: payload.text || payload.content || "",
            timestamp: payload.timestamp || Date.now()
          };
          this.emit("message", message);
          break;

        // Room occupants / participants
        case "participants":
        case "members":
        case "users":
          const names = Array.isArray(payload) 
            ? payload 
            : Array.isArray(payload.names) 
            ? payload.names 
            : [];
          this.emit("participants", names);
          break;

        // Unknown custom commands
        default:
          this.emit("customEvent", { type, payload });
          break;
      }
    } catch (err) {
      this.emit("log", { type: "error", text: `Error parsing websocket message frame: ${err}` });
    }
  }

  /**
   * Send JSON message raw
   */
  private send(action: string, data: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.emit("log", { type: "error", text: `Cannot send command, WebSocket not active. State: ${this.socket?.readyState}` });
      return;
    }

    const payload = JSON.stringify({
      type: action.toUpperCase(),
      payload: {
        ...data,
        sender: this.username,
        timestamp: Date.now()
      }
    });

    this.socket.send(payload);
  }

  /**
   * Heartbeat to prevent socket termination timeouts
   */
  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      // Send ping or empty frame if socket is active
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "PING", payload: { timestamp: Date.now() } }));
      }
    }, 25000); // 25 seconds keep-alive
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Automatic reconnection routine
   */
  private handleReconnect() {
    if (!this.isReconnectEnabled) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("log", { type: "error", text: "Maximum reconnection attempts reached. Idle." });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000); // Exponential backoff capped at 10s
    this.emit("log", { type: "warn", text: `Attempting reconnection in ${(delay / 1000).toFixed(1)}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})` });

    setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  /**
   * Event Listener Registration
   */
  public on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Remove Event Listener
   */
  public off(event: string, callback: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  private emit(event: string, data: any) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(`Error in event callback for ${event}:`, e);
      }
    });
  }

  /**
   * Static API Helper to create rooms via HTTP POST
   */
  public static async createRoom(serverUrl: string, options: {
    room: string;
    password?: string;
    videoUrl?: string;
    videoType?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const cleanUrl = serverUrl.replace(/\/+$/, "");
    try {
      const response = await fetch(`${cleanUrl}/api/v1/room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: options.room,
          name: options.room,
          password: options.password || "",
          videoUrl: options.videoUrl || "",
          videoType: options.videoType || "universal"
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: errText || `HTTP error ${response.status}` };
      }

      const resJson = await response.json();
      return { success: true, data: resJson };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }
}
