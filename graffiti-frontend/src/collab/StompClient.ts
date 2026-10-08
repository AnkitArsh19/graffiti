import { Client, IMessage } from "@stomp/stompjs";
import { getWebSocketUrl } from "../lib/api";

export interface CollabOp {
  type: "OP";
  id: string;
  roomId: string;
  shapeId: string;
  opType: "CREATE_OR_UPDATE" | "DELETE";
  payload: any;
  lamportTs: number;
  authorId: string;
  createdAt: string;
}

export interface PresenceMessage {
  type: "PRESENCE";
  authorId: string;
  presenceType: string;
  payload: any;
  sessionId?: string;
  timestamp?: number;
}

export interface AiGhostMessage { type: "AI_GHOST_OP"; requestId: string; payload: { proposedElements?: any[]; ghostPreview?: boolean; [key: string]: any }; }

type MessageHandler = (msg: CollabOp | PresenceMessage | AiGhostMessage) => void;

/**
 * STOMP WebSocket client for real-time collaborative whiteboard sync.
 * Connects to the Spring Boot backend STOMP broker and handles
 * op broadcast and presence relay.
 */
export class StompClient {
  private client: Client | null = null;
  private slug: string;
  private token: string | null;
  private onMessage: MessageHandler;
  private onConnectionChange: (connected: boolean) => void;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 15000;
  private hasConnected = false;
  private isDisposed = false;
  private reconnectTimer: any = null;
  private watchdogTimer: any = null;
  private onReconnect?: () => void;
  private outboundOpQueue: Array<{ destination: string; body: string }> = [];

  get isConnected(): boolean {
    return Boolean(this.client && this.client.connected);
  }

  constructor(
    slug: string,
    token: string | null,
    onMessage: MessageHandler,
    onConnectionChange: (connected: boolean) => void,
    onReconnect?: () => void,
  ) {
    this.slug = slug;
    this.token = token;
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
    this.onReconnect = onReconnect;

    this.handleOnlineOrVisible = this.handleOnlineOrVisible.bind(this);
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnlineOrVisible);
      window.addEventListener("focus", this.handleOnlineOrVisible);
      document.addEventListener("visibilitychange", this.handleOnlineOrVisible);
    }
  }

  private handleOnlineOrVisible() {
    if (this.isDisposed) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (!this.isConnected) {
      this.reconnectNow();
    }
  }

  connect() {
    this.isDisposed = false;
    const wsUrl = getWebSocketUrl();

    this.client = new Client({
      brokerURL: wsUrl,
      connectHeaders: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      reconnectDelay: 2000, // Built-in STOMP auto-reconnect delay
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,

      onConnect: () => {
        const reconnecting = this.hasConnected;
        this.hasConnected = true;
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.onConnectionChange(true);

        // Subscribe to room topic
        this.client?.subscribe(`/topic/rooms/${this.slug}`, (message: IMessage) => {
          try {
            const parsed = JSON.parse(message.body);
            this.onMessage(parsed);
          } catch (err) {
            console.error("Failed to parse STOMP message:", err);
          }
        });

        // Flush all buffered operations created while offline/connecting
        while (this.outboundOpQueue.length > 0) {
          const item = this.outboundOpQueue.shift();
          if (item && this.client?.connected) {
            this.client.publish(item);
          }
        }

        if (reconnecting) {
          this.onReconnect?.();
        }
      },

      onDisconnect: () => {
        this.onConnectionChange(false);
      },

      onStompError: (frame) => {
        console.warn("STOMP error:", frame.headers["message"], frame.body);
        this.onConnectionChange(false);
      },

      onWebSocketClose: () => {
        this.onConnectionChange(false);
      },

      onWebSocketError: () => {
        this.onConnectionChange(false);
      },
    });

    this.client.activate();
    this.startWatchdog();
  }

  private startWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    // Periodically verify connection liveness every 4 seconds
    this.watchdogTimer = setInterval(() => {
      if (this.isDisposed) return;
      if (!this.isConnected) {
        this.reconnectNow();
      }
    }, 4000);
  }

  public async reconnectNow() {
    if (this.isDisposed) return;
    if (this.client) {
      if (!this.client.connected) {
        try {
          await this.client.deactivate();
          if (!this.isDisposed) {
            this.client.activate();
          }
        } catch {
          if (!this.isDisposed) {
            this.client.activate();
          }
        }
      }
    } else {
      this.connect();
    }
  }

  /**
   * Send a structural canvas operation.
   */
  sendOp(shapeId: string, opType: "CREATE_OR_UPDATE" | "DELETE" | "AI_REQUEST", payload: any, authorId: string, lamportTs?: number) {
    const msg = {
      destination: `/app/rooms/${this.slug}/op`,
      body: JSON.stringify({ shapeId, opType, payload, authorId, lamportTs }),
    };
    if (this.isConnected) {
      this.client?.publish(msg);
    } else {
      this.outboundOpQueue.push(msg);
      if (this.outboundOpQueue.length > 5000) {
        this.outboundOpQueue.shift();
      }
      this.reconnectNow();
    }
  }

  /**
   * Send an ephemeral presence event (cursor position, selection, etc).
   */
  sendPresence(authorId: string, presenceType: string, payload: any) {
    if (!this.client?.connected) return;
    this.client.publish({
      destination: `/app/rooms/${this.slug}/presence`,
      body: JSON.stringify({ authorId, type: presenceType, payload }),
    });
  }

  disconnect() {
    this.isDisposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnlineOrVisible);
      window.removeEventListener("focus", this.handleOnlineOrVisible);
      document.removeEventListener("visibilitychange", this.handleOnlineOrVisible);
    }
    this.outboundOpQueue = [];
    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
  }
}
