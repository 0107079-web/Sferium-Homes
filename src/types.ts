/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RoomMember {
  id: string;
  name: string;
  avatar: string; // Emoji or preset id
  color: string;  // Hex color code for user visual identity
  isHost: boolean;
  joinedAt: number;
  micEnabled?: boolean;
  micBlockedByHost?: boolean;
  uid?: string;   // Firebase UID if authenticated
  disconnected?: boolean; // True if temporarily disconnected (page reload or network drop)
  disconnectedAt?: number; // Timestamp when user disconnected for reload/exit grace periods
}

export interface ChatMessage {
  id: string;
  type: "chat" | "system";
  userId?: string;
  name?: string;
  userName?: string;
  color?: string;
  avatar?: string;
  text: string;
  timestamp: number;
  reactions?: Record<string, string[]>; // emoji -> array of userIds who reacted
}

export interface RoomState {
  roomId: string;
  videoUrl: string;
  videoId: string;
  provider?: "youtube" | "vk" | "rutube" | "yandex" | "unknown";
  playing: boolean;
  currentTime: number;
  lastUpdated: number; // UTC unix timestamp when play/pause/seek was altered
  members: Record<string, RoomMember>;
  chatHistory: ChatMessage[];
  isPublic?: boolean;
  allMuted?: boolean;
  anyoneCanControl?: boolean;
  currentVideoTitle?: string;
}

export type WSMessage =
  | {
      type: "join";
      roomId: string;
      name: string;
      avatar: string;
      color: string;
      uid?: string;
    }
  | {
      type: "exit_room";
    }
  | {
      type: "room_state";
      state: RoomState;
      userId: string;
    }
  | {
      type: "change_video";
      videoUrl: string;
    }
  | {
      type: "playback_change";
      playing: boolean;
      currentTime: number;
      issuerId: string;
      timestamp?: number;
    }
  | {
      type: "seek";
      currentTime: number;
      issuerId: string;
      timestamp?: number;
    }
  | {
      type: "heartbeat_sync";
      currentTime: number;
      playing?: boolean;
      timestamp?: number;
    }
  | {
      type: "chat_message";
      text: string;
    }
  | {
      type: "chat_broadcast";
      message: ChatMessage;
    }
  | {
      type: "members_update";
      members: Record<string, RoomMember>;
    }
  | {
      type: "play";
      currentTime?: number;
    }
  | {
      type: "pause";
      currentTime?: number;
    }
  | {
      type: "sendTime";
      currentTime: number;
    }
  | {
      type: "set_privacy";
      isPublic: boolean;
    }
  | {
      type: "toggle_mic";
      enabled: boolean;
    }
  | {
      type: "mute_member";
      targetUserId: string;
      blocked: boolean;
    }
  | {
      type: "kick_member";
      targetUserId: string;
    }
  | {
      type: "mute_all_mics";
      mute: boolean;
    }
  | {
      type: "kicked_notification";
    }
  | {
      type: "room_closed_notification";
    }
  | {
      type: "react_message";
      messageId: string;
      emoji: string;
    }
  | {
      type: "remote_toggle_mic";
      targetUserId: string;
      enabled: boolean;
    }
  | {
      type: "remote_toggle_mic_request";
      enabled: boolean;
    }
  | {
      type: "toggle_control_sharing";
      anyoneCanControl: boolean;
    };

export interface UserProfile {
  uid: string;
  displayName: string;
  avatar: string;
  color: string;
  email?: string;
  provider: "google" | "email" | "vk" | "yandex";
  createdAt: number;
  updatedAt: number;
  favorites: string[];
  history: {
    roomId: string;
    videoUrl: string;
    watchedAt: number;
    title?: string;
    membersCount?: number;
    duration?: string;
    secondsWatched?: number;
  }[];
  invitePermission?: "all" | "friends" | "none";
  limitInvites?: boolean;
  friends?: string[];
  pastRoomPartners?: {
    uid: string;
    displayName: string;
    avatar: string;
    color: string;
    sharedAt: number;
  }[];
}

