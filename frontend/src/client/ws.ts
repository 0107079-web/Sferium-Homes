/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WSEventCallback = (data: any) => void;

export class SferiumWSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Record<string, Set<WSEventCallback>> = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Base delay in ms
  private pingIntervalId: any = null;
  private isIntentionalClose = false;

  constructor(url: string) {
    this.url = url;
  }

  public connect(): void {
    this.isIntentionalClose = false;
    this.emit("status_change", { status: "connecting" });

    try {
      this.ws = new WebSocket(this.url);
      this.setupHandlers();
    } catch (error) {
      this.emit("status_change", { status: "failed", error });
      this.scheduleReconnect();
    }
  }

  private setupHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.emit("status_change", { status: "connected" });
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "pong") {
          this.emit("pong", data);
          return;
        }
        
        // General event routing based on message type
        if (data.type) {
          this.emit(data.type, data);
        }
        this.emit("message", data);
      } catch (err) {
        console.warn("⚠️ Failed to parse WebSocket JSON payload:", err);
      }
    };

    this.ws.onclose = (event) => {
      this.stopHeartbeat();
      this.emit("status_change", { status: "disconnected", code: event.code });
      if (!this.isIntentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      this.emit("error", { error });
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("status_change", { status: "failed", message: "Превышен лимит попыток переподключения." });
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff calculation
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
    console.log(`🔌 Reconnecting to WebSocket in ${(delay / 1000).toFixed(1)}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingIntervalId = setInterval(() => {
      this.send({ type: "ping", timestamp: Date.now() });
    }, 10000); // Ping every 10 seconds
  }

  private stopHeartbeat(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  public send(data: Record<string, any>): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  public close(): void {
    this.isIntentionalClose = true;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // --- SIMPLE EVENT EMITTER PATTERN ---
  public on(event: string, callback: WSEventCallback): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(callback);
  }

  public off(event: string, callback: WSEventCallback): void {
    if (this.listeners[event]) {
      this.listeners[event].delete(callback);
    }
  }

  private emit(event: string, data: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in event listener ${event}:`, err);
        }
      });
    }
  }
}
