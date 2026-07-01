/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, FormEvent, ChangeEvent } from "react";
import { 
  Plus, LogIn, LogOut, Sparkles, MessageSquare, RefreshCw, AlertCircle, 
  PlayCircle, ShieldCheck, Copy, Check, User, Loader2, Mail, Lock, 
  KeyRound, Chrome, CheckCircle2, Users, Search, Tv, ArrowLeft, Settings, Globe, ExternalLink,
  Mic, MicOff, Volume2, VolumeX, UserMinus, Sun, Moon, Palette, UserPlus, UserCheck, Star, Disc
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import YoutubePlayer from "./components/YoutubePlayer";
import Chat from "./components/Chat";
import SyncTvDashboard from "./components/SyncTvDashboard";
import RoomDashboard from "./components/RoomDashboard";
import UserCabinet from "./components/UserCabinet";
import Avatar from "./components/Avatar";
import HomesPlatformsGrid from "./components/HomesPlatformsGrid";
import MediaSelector from "./components/MediaSelector";
import PlatformSelector from "./components/PlatformSelector";
import sferiumLogo from "./assets/images/sferium_homes_logo_hummingbird_1781429704208.jpg";
import { getApiUrl } from "./apiConfig";
import { RoomState, WSMessage, ChatMessage, RoomMember, UserProfile } from "./types";
import { 
  getCurrentUser, 
  setCurrentUser, 
  createGuestSession, 
  getLocalUserProfile, 
  saveLocalUserProfile,
  logoutLocalUser,
  registerLocalUser,
  loginLocalUser
} from "./services/localAuth";


// Constant presets for high-contrast Android 11+ branding
const VIDEO_CATALOGUE = [
  {
    title: "Иван Васильевич меняет профессию (Советская комедия)",
    url: "https://www.youtube.com/watch?v=a50qT9bW_T0",
    platform: "YouTube",
    duration: "1:33:00",
    thumbnail: "🍿",
    views: "15M",
    category: "Фильмы"
  },
  {
    title: "Операция «Ы» и другие приключения Шурика",
    url: "https://www.youtube.com/watch?v=1stL8U6K2_0",
    platform: "YouTube",
    duration: "1:35:00",
    thumbnail: "🎬",
    views: "21M",
    category: "Фильмы"
  },
  {
    title: "VK Fest: Главное Шоу и Выступления",
    url: "https://vk.com/video_ext.php?oid=-220550000&id=456239149",
    platform: "VK Видео",
    duration: "3:45:00",
    thumbnail: "🎵",
    views: "4.8M",
    category: "Музыка"
  },
  {
    title: "Rutube Наука: Тайны времени и квантовой физики",
    url: "https://rutube.ru/video/bc04f35e9f85c479e497f1fbc71db441/",
    platform: "Rutube",
    duration: "24:15",
    thumbnail: "🚀",
    views: "220K",
    category: "Образование"
  },
  {
    title: "Путешествие по Камчатке: Гейзеры и ледники",
    url: "https://www.youtube.com/watch?v=2K4Vb68MskE",
    platform: "YouTube",
    duration: "42:00",
    thumbnail: "🦊",
    views: "890K",
    category: "Путешествия"
  },
  {
    title: "Rick Astley - Never Gonna Give You Up",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    platform: "YouTube",
    duration: "3:32",
    thumbnail: "🎮",
    views: "1.4B",
    category: "Музыка"
  }
];

const AVATAR_PRESETS = ["🍿", "🎬", "🍕", "👾", "🦊", "🐱", "🚀", "🎮", "🕶️", "👑", "🦄", "🐼"];
const COLOR_PRESETS = [
  "#EF4444", // Red
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F43F5E", // Rose
];

const ONBOARDING_SLIDES = [
  {
    category: "Смотреть вместе",
    title: "Смотрите фильмы и видеоролики",
    subtitle: "с друзьями в реальном времени",
    desc: "Смотрите любимые видео в залах совместного просмотра. Наслаждайтесь каждым кадром миллисекунда в миллисекунда.",
    emoji: "🍿"
  },
  {
    category: "Живой Чат",
    title: "Переписывайтесь",
    subtitle: "прямо во время просмотра",
    desc: "Обменивайтесь мнениями, отправляйте реакции и обсуждайте сюжет в забавном текстовом чате без пауз в фильме.",
    emoji: "💬"
  },
  {
    category: "Голосовая связь",
    title: "Разговаривайте",
    subtitle: "и пойте вместе с близкими",
    desc: "Общайтесь голосом без задержек. Слышать смех и эмоции друзей — бесценно при просмотре захватывающего кино.",
    emoji: "🎙️"
  },
  {
    category: "Умная синхронизация",
    title: "Идеальная синхронизация",
    subtitle: "между разными платформами",
    desc: "Пауза хоста моментально останавливает плеер у всех гостей залов. Никто больше не отстанет на интересном моменте!",
    emoji: "⚡"
  },
  {
    category: "Объединяйте звук",
    title: "Танцуйте",
    subtitle: "под вашу любимую музыку",
    desc: "Связывайте акустические системы ваших устройств в одну мощную пространственную аудио-систему для вечеринок.",
    emoji: "🎵"
  },
  {
    category: "Все залы мира",
    title: "Кто угодно. Где угодно.",
    subtitle: "Делитесь своими залами",
    desc: "Заводите знакомства в публичных залах со всего мира или создавайте уютные уединенные комнаты только для своего круга.",
    emoji: "🌍"
  }
];

export default function App() {
  // Navigation & session state
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [isCabinetOpen, setIsCabinetOpen] = useState(false);
  const [isLobbyMediaModalOpen, setIsLobbyMediaModalOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isMobileMembersOpen, setIsMobileMembersOpen] = useState(false);
  const [isSyncTvOpen, setIsSyncTvOpen] = useState(false);
  
  // Public rooms & search video states
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [videoSearchQuery, setVideoSearchQuery] = useState("");
  const [publicRoomsSearchQuery, setPublicRoomsSearchQuery] = useState("");
  const [selectedVideoCategory, setSelectedVideoCategory] = useState<string>("Все");
  const [pendingVideoUrl, setPendingVideoUrl] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("youtube");
  
  // Local profile states
  const [nickName, setNickName] = useState(() => localStorage.getItem("yt_party_name") || "");
  const [selectedAvatar, setSelectedAvatar] = useState(() => localStorage.getItem("yt_party_avatar") || "🍿");
  const [selectedColor, setSelectedColor] = useState(() => localStorage.getItem("yt_party_color") || "#3B82F6");
  const [profileReady, setProfileReady] = useState(false);
  const [lobbyUserProfile, setLobbyUserProfile] = useState<UserProfile | null>(null);

  // Integrated Saturated Acid Background & Day/Night Mode States
  const [isDayMode, setIsDayMode] = useState<boolean>(false);
  const [acidTheme, setAcidTheme] = useState<string>(() => {
    return localStorage.getItem("homes_acid_theme") || "purple";
  });

  const ACID_THEMES: Record<string, {
    day: string;
    night: string;
    dayBase: string;
    nightBase: string;
  }> = {
    purple: {
      day: "radial-gradient(circle at 10% 20%, rgba(138, 43, 226, 0.28) 0%, transparent 50%), radial-gradient(circle at 90% 80%, rgba(0, 255, 200, 0.25) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(255, 0, 127, 0.15) 0%, transparent 65%)",
      night: "radial-gradient(circle at 10% 20%, rgba(138, 43, 226, 0.42) 0%, transparent 55%), radial-gradient(circle at 90% 80%, rgba(0, 255, 200, 0.38) 0%, transparent 55%), radial-gradient(circle at 50% 50%, rgba(255, 0, 127, 0.25) 0%, transparent 70%)",
      dayBase: "#fcf9ff",
      nightBase: "#05020c",
    },
    lime: {
      day: "radial-gradient(circle at 20% 10%, rgba(57, 255, 20, 0.25) 0%, transparent 50%), radial-gradient(circle at 80% 90%, rgba(0, 191, 255, 0.25) 0%, transparent 50%), radial-gradient(circle at 50% 40%, rgba(238, 130, 238, 0.15) 0%, transparent 65%)",
      night: "radial-gradient(circle at 20% 10%, rgba(57, 255, 20, 0.4) 0%, transparent 50%), radial-gradient(circle at 80% 90%, rgba(0, 191, 255, 0.4) 0%, transparent 50%), radial-gradient(circle at 50% 40%, rgba(238, 130, 238, 0.25) 0%, transparent 65%)",
      dayBase: "#f6fff3",
      nightBase: "#010512",
    },
    sunset: {
      day: "radial-gradient(circle at 80% 10%, rgba(255, 60, 0, 0.2) 0%, transparent 50%), radial-gradient(circle at 20% 90%, rgba(255, 0, 128, 0.22) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(255, 220, 0, 0.15) 0%, transparent 65%)",
      night: "radial-gradient(circle at 80% 10%, rgba(255, 60, 0, 0.38) 0%, transparent 55%), radial-gradient(circle at 20% 90%, rgba(255, 0, 128, 0.38) 0%, transparent 55%), radial-gradient(circle at 50% 50%, rgba(255, 215, 0, 0.25) 0%, transparent 70%)",
      dayBase: "#fff6f6",
      nightBase: "#070208",
    },
    cyan: {
      day: "radial-gradient(circle at 10% 80%, rgba(6, 182, 212, 0.25) 0%, transparent 50%), radial-gradient(circle at 90% 20%, rgba(236, 72, 153, 0.22) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.18) 0%, transparent 65%)",
      night: "radial-gradient(circle at 10% 80%, rgba(6, 182, 212, 0.4) 0%, transparent 50%), radial-gradient(circle at 90% 20%, rgba(236, 72, 153, 0.4) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.3) 0%, transparent 65%)",
      dayBase: "#f2fcfd",
      nightBase: "#01040d",
    }
  };

  const activeThemeObj = ACID_THEMES[acidTheme] || ACID_THEMES.purple;
  const activeBgGradient = isDayMode ? activeThemeObj.day : activeThemeObj.night;
  const activeBgColor = isDayMode ? activeThemeObj.dayBase : activeThemeObj.nightBase;

  useEffect(() => {
    localStorage.setItem("homes_theme", isDayMode ? "day" : "night");
    const root = document.documentElement;
    if (isDayMode) {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
  }, [isDayMode]);

  useEffect(() => {
    localStorage.setItem("homes_acid_theme", acidTheme);
  }, [acidTheme]);

  // Firebase Auth states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authNickname, setAuthNickname] = useState("");
  const [authAvatar, setAuthAvatar] = useState("🍿");
  const [authColor, setAuthColor] = useState("#3B82F6");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Real-time invites, friends, and past partners states
  const [incomingInvites, setIncomingInvites] = useState<any[]>([]);
  const [currentUserFriends, setCurrentUserFriends] = useState<string[]>([]);
  const [pastRoomPartners, setPastRoomPartners] = useState<any[]>([]);
  const [invitingStatus, setInvitingStatus] = useState<Record<string, "idle" | "loading" | "success" | "error" | "private">>({});

  // Real-time local subscriptions for invitations and user profile collections
  useEffect(() => {
    if (!currentUser) {
      setIncomingInvites([]);
      setCurrentUserFriends([]);
      setPastRoomPartners([]);
      return;
    }

    const loadLocalProfile = () => {
      const data = getLocalUserProfile(currentUser.uid, currentUser.displayName);
      setLobbyUserProfile(data);
      setCurrentUserFriends(data.friends || []);
      setPastRoomPartners(data.pastRoomPartners || []);
      setIncomingInvites((data.invitations || []).filter((inv: any) => inv.status === "pending"));
    };

    loadLocalProfile();

    // Listen to local storage update events
    window.addEventListener("sferium_local_profile_updated", loadLocalProfile);
    window.addEventListener("homes_history_updated", loadLocalProfile);

    return () => {
      window.removeEventListener("sferium_local_profile_updated", loadLocalProfile);
      window.removeEventListener("homes_history_updated", loadLocalProfile);
    };
  }, [currentUser]);

  // Decline invitation
  const handleDeclineInvite = async (invite: any) => {
    if (!currentUser) return;
    try {
      const profile = getLocalUserProfile(currentUser.uid, currentUser.displayName);
      const remaining = (profile.invitations || []).filter((inv: any) => inv.id !== invite.id);
      saveLocalUserProfile(currentUser.uid, { invitations: remaining });
      window.dispatchEvent(new Event("sferium_local_profile_updated"));
    } catch (err) {
      console.error("Error declining invite:", err);
    }
    setIncomingInvites((prev) => prev.filter((inv) => inv.id !== invite.id));
  };

  // Accept invitation
  const handleAcceptInvite = async (invite: any) => {
    if (!currentUser) return;
    try {
      const profile = getLocalUserProfile(currentUser.uid, currentUser.displayName);
      const updated = (profile.invitations || []).map((inv: any) => 
        inv.id === invite.id ? { ...inv, status: "accepted" } : inv
      );
      saveLocalUserProfile(currentUser.uid, { invitations: updated });
      window.dispatchEvent(new Event("sferium_local_profile_updated"));
    } catch (err) {
      console.error("Error accepting invite:", err);
    }
    setActiveRoomId(invite.roomId);
    setIsCabinetOpen(false);
  };

  // Toggle Friend list relationship
  const handleToggleFriend = async (partnerUid: string) => {
    if (!currentUser) {
      alert("Пожалуйста, войдите в аккаунт!");
      return;
    }
    try {
      const isAlreadyFriend = currentUserFriends.includes(partnerUid);
      const profile = getLocalUserProfile(currentUser.uid, currentUser.displayName);
      const friendsList: string[] = profile.friends || [];
      
      let updatedFriends: string[];
      if (isAlreadyFriend) {
        updatedFriends = friendsList.filter(id => id !== partnerUid);
      } else {
        updatedFriends = [...friendsList, partnerUid];
      }

      saveLocalUserProfile(currentUser.uid, { friends: updatedFriends });
      window.dispatchEvent(new Event("sferium_local_profile_updated"));
    } catch (err) {
      console.error("Error toggling friend:", err);
      alert("Не удалось изменить статус дружбы.");
    }
  };


  // Send real-time room invitation to past partner
  const sendInvitation = async (targetPartner: any) => {
    if (!currentUser) {
      alert("Вам необходимо войти в аккаунт, чтобы отправлять приглашения!");
      return;
    }
    if (!activeRoomId) {
      alert("Сначала создайте или войдите в зал, чтобы пригласить кого-то!");
      return;
    }

    const partnerUid = targetPartner.uid;
    setInvitingStatus((prev) => ({ ...prev, [partnerUid]: "loading" }));

    try {
      const targetProfile = getLocalUserProfile(partnerUid, targetPartner.displayName || "Зритель");
      const targetPermission = targetProfile.invitePermission || "all";
      const targetLimitInvites = targetProfile.limitInvites === true;

      let allowed = true;
      let blockReason = "";

      if (targetPermission === "none") {
        allowed = false;
        blockReason = "Пользователь ограничил получение приглашений.";
      } else if (targetPermission === "friends" || targetLimitInvites) {
        const targetFriends: string[] = targetProfile.friends || [];
        if (!targetFriends.includes(currentUser.uid)) {
          allowed = false;
          blockReason = "Пользователь принимает приглашения только от друзей.";
        }
      }

      if (!allowed) {
        setInvitingStatus((prev) => ({ ...prev, [partnerUid]: "private" }));
        alert(`Не удалось пригласить ${targetProfile.displayName || 'пользователя'}: ${blockReason}`);
        setTimeout(() => {
          setInvitingStatus((prev) => ({ ...prev, [partnerUid]: "idle" }));
        }, 4000);
        return;
      }

      const inviteId = `inv_${Math.random().toString(36).substring(2, 10)}`;
      const targetInvites = targetProfile.invitations || [];
      const newInvite = {
        id: inviteId,
        fromName: nickName || "Анонимный Зритель",
        roomId: activeRoomId,
        videoUrl: roomState?.videoUrl || "",
        senderUid: currentUser.uid,
        status: "pending",
        invitedAt: Date.now()
      };

      saveLocalUserProfile(partnerUid, { invitations: [...targetInvites, newInvite] });

      setInvitingStatus((prev) => ({ ...prev, [partnerUid]: "success" }));
      setTimeout(() => {
        setInvitingStatus((prev) => ({ ...prev, [partnerUid]: "idle" }));
      }, 3000);

    } catch (err: any) {
      console.error("Error sending invitation:", err);
      setInvitingStatus((prev) => ({ ...prev, [partnerUid]: "error" }));
      setTimeout(() => {
        setInvitingStatus((prev) => ({ ...prev, [partnerUid]: "idle" }));
      }, 3000);
      alert(`Не удалось отправить приглашение: ${err.message || 'неизвестная ошибка'}`);
    }
  };

  // Auto-save active room members who are authenticated to our past room partners list
  useEffect(() => {
    if (!currentUser || !roomState) return;

    const savePastPartners = async () => {
      try {
        const otherMembers: any[] = Object.values(roomState.members).filter(
          (m: any) => m.uid && m.uid !== currentUser.uid
        );
        if (otherMembers.length === 0) return;

        const profile = getLocalUserProfile(currentUser.uid, currentUser.displayName);
        const currentPartners: any[] = profile.pastRoomPartners || [];

        let updated = false;
        const newPartners = [...currentPartners];

        for (const memb of otherMembers) {
          const existingIdx = newPartners.findIndex((p) => p.uid === memb.uid);
          if (existingIdx >= 0) {
            const existing = newPartners[existingIdx];
            if (
              existing.displayName !== memb.name ||
              existing.avatar !== memb.avatar ||
              existing.color !== memb.color ||
              Date.now() - existing.sharedAt > 60000
            ) {
              newPartners[existingIdx] = {
                uid: memb.uid,
                displayName: memb.name,
                avatar: memb.avatar,
                color: memb.color,
                sharedAt: Date.now(),
              };
              updated = true;
            }
          } else {
            newPartners.push({
              uid: memb.uid,
              displayName: memb.name,
              avatar: memb.avatar,
              color: memb.color,
              sharedAt: Date.now(),
            });
            updated = true;
          }
        }

        if (updated) {
          const trimmed = newPartners.sort((a, b) => b.sharedAt - a.sharedAt).slice(0, 50);
          saveLocalUserProfile(currentUser.uid, {
            pastRoomPartners: trimmed,
          });
          window.dispatchEvent(new Event("sferium_local_profile_updated"));
        }
      } catch (err) {
        console.warn("Failed to update past room partners locally:", err);
      }
    };

    const timer = setTimeout(savePastPartners, 4000);
    return () => clearTimeout(timer);
  }, [roomState?.members, currentUser]);


  // Walkthrough Onboarding Screen
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() => {
    return localStorage.getItem("homes_onboarding_completed") === "true";
  });
  const [onboardingStep, setOnboardingStep] = useState<number>(0);

  // Social Auth popup simulation state (VK / Yandex)
  const [mainSocialPopup, setMainSocialPopup] = useState<{
    provider: "vk" | "yandex";
    isOpen: boolean;
    step: "credentials" | "authorizing";
  } | null>(null);
  const [mainSocialUsername, setMainSocialUsername] = useState("");
  const [mainSocialEmail, setMainSocialEmail] = useState("");
  const [vkLoginMethod, setVkLoginMethod] = useState<"oauth" | "manual" | "token">("manual");
  const [vkAccessTokenInput, setVkAccessTokenInput] = useState("");
  const [vkUserIdInput, setVkUserIdInput] = useState("");
  const [vkClientIdInput, setVkClientIdInput] = useState(() => localStorage.getItem("vk_client_id") || "51786574");

  const [activationStatus, setActivationStatus] = useState<{ status: "idle" | "loading" | "success" | "error"; message: string }>({ status: "idle", message: "" });

  // Handle loading session and guest setup
  useEffect(() => {
    // Load custom user or auto-fallback to guest (so they enter right away without gate screens)
    const activeUser = getCurrentUser() || createGuestSession();
    setCurrentUser(activeUser);
    setNickName(activeUser.displayName);
    setSelectedAvatar(activeUser.avatar);
    setSelectedColor(activeUser.color);
    setProfileReady(true);
    setIsAuthLoading(false);
  }, []);


  // Listen to roomState.videoUrl to auto-save to guest / local history
  useEffect(() => {
    if (roomState?.videoUrl) {
      const prevStr = localStorage.getItem("homes_guest_history") || "[]";
      try {
        const list = JSON.parse(prevStr);
        // De-duplicate: check if identical URL was recently synced
        const exists = list.some((item: any) => item.videoUrl === roomState.videoUrl);
        if (!exists) {
          const newItem = {
            roomId: activeRoomId || "lobby",
            videoUrl: roomState.videoUrl,
            watchedAt: Date.now(),
            title: (() => {
              const known = VIDEO_CATALOGUE.find(v => v.url === roomState.videoUrl);
              if (known) return known.title;
              if (roomState.videoUrl.includes("a50qT9bW_T0")) return "Иван Васильевич меняет профессию";
              if (roomState.videoUrl.includes("1stL8U6K2_0")) return "Операция «Ы» и другие приключения Шурика";
              if (roomState.videoUrl.includes("456239149")) return "VK Fest: Главное Шоу и Выступления";
              try {
                const host = new URL(roomState.videoUrl).hostname;
                return `Видео из ${host}`;
              } catch (e) {
                return "Пользовательское видео";
              }
            })(),
            duration: "12:00",
            membersCount: Object.keys(roomState.members || {}).length || 1,
            thumbnail: "🍿"
          };
          const updated = [newItem, ...list].slice(0, 50);
          localStorage.setItem("homes_guest_history", JSON.stringify(updated));
          // Dispatch a state refresh event
          window.dispatchEvent(new Event("homes_history_updated"));
        }
      } catch (e) {
        console.warn("Error parsing guest history:", e);
      }
    }
  }, [roomState?.videoUrl, activeRoomId]);

  // Custom synchronization server configuration state
  const [customServerType, setCustomServerType] = useState<"default" | "custom" >(() => {
    return (localStorage.getItem("yt_party_custom_server_active") === "false" ? "default" : "custom");
  });
  const [customServerAddress, setCustomServerAddress] = useState(() => {
    return localStorage.getItem("yt_party_custom_server_address") || "sferium.homes";
  });

  // Manual code entry states
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [copiedLocal, setCopiedLocal] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Track playback actions selectively passed to YoutubePlayer
  const [remoteEvent, setRemoteEvent] = useState<{
    type: string;
    playing?: boolean;
    currentTime?: number;
    timestamp: number;
  } | null>(null);

  // Keep track of members to trigger join/leave notifications using members in RoomState
  const prevMembersRef = useRef<Record<string, RoomMember> | null>(null);

  useEffect(() => {
    if (!roomState) {
      prevMembersRef.current = null;
      return;
    }

    const currentMembers = roomState.members;

    if (prevMembersRef.current !== null) {
      const prevMembers = prevMembersRef.current;
      const joined: RoomMember[] = [];
      const left: RoomMember[] = [];

      for (const id in currentMembers) {
        if (!prevMembers[id]) {
          joined.push(currentMembers[id]);
        }
      }

      for (const id in prevMembers) {
        if (!currentMembers[id]) {
          left.push(prevMembers[id]);
        }
      }

      if (joined.length > 0 || left.length > 0) {
        setRoomState((prev) => {
          if (!prev) return null;
          let updatedHistory = [...prev.chatHistory];
          let changed = false;

          joined.forEach((member) => {
            // Check if there is already a system message for this join to prevent duplicates
            const hasDuplicate = updatedHistory.some(
              (msg) =>
                msg.type === "system" &&
                msg.text.includes(member.name) &&
                (msg.text.includes("подключился") || msg.text.includes("присоединился"))
            );

            if (!hasDuplicate) {
              updatedHistory.push({
                id: `sys_local_join_${member.id}_${Date.now()}`,
                type: "system",
                text: `👋 ${getAestheticEmoji(member.avatar)} ${member.name} подключился к комнате`,
                timestamp: Date.now(),
              });
              changed = true;
            }
          });

          left.forEach((member) => {
            // Check if there is already a system message for this leave to prevent duplicates
            const hasDuplicate = updatedHistory.some(
              (msg) =>
                msg.type === "system" &&
                msg.text.includes(member.name) &&
                (msg.text.includes("вышел") || msg.text.includes("покинул"))
            );

            if (!hasDuplicate) {
              updatedHistory.push({
                id: `sys_local_leave_${member.id}_${Date.now()}`,
                type: "system",
                text: `🚪 ${getAestheticEmoji(member.avatar)} ${member.name} вышел из комнаты`,
                timestamp: Date.now(),
              });
              changed = true;
            }
          });

          if (changed) {
            return {
              ...prev,
              chatHistory: updatedHistory,
            };
          }
          return prev;
        });
      }
    } else {
      // For initial load, show a system notification about ourselves
      const myMember = currentMembers[currentUserId];
      if (myMember) {
        setRoomState((prev) => {
          if (!prev) return null;
          const updatedHistory = [...prev.chatHistory];
          const sysId = `sys_local_myself_${myMember.id}`;
          if (!updatedHistory.some((m) => m.id === sysId)) {
            updatedHistory.push({
              id: sysId,
              type: "system",
              text: `👋 ${getAestheticEmoji(myMember.avatar)} Вы (${myMember.name}) подключились к комнате`,
              timestamp: Date.now(),
            });
            return {
              ...prev,
              chatHistory: updatedHistory,
            };
          }
          return prev;
        });
      }
    }

    prevMembersRef.current = currentMembers;
  }, [roomState?.members, currentUserId]);

  // Support guest access without registration
  const handleGuestAccess = async () => {
    setAuthError(null);
    setIsAuthSubmitting(true);
    try {
      const guestUser = createGuestSession();
      setCurrentUser(guestUser);
      setNickName(guestUser.displayName);
      setSelectedAvatar(guestUser.avatar);
      setSelectedColor(guestUser.color);
      setProfileReady(true);
    } catch (err: any) {
      console.error(err);
      setAuthError("Не удалось войти как гость");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // Custom Local Storage Auth Handlers
  const handleAuthRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword || !authNickname) {
      setAuthError("Пожалуйста, заполните все обязательные поля");
      return;
    }
    setAuthError(null);
    setIsAuthSubmitting(true);
    try {
       const newUser = await registerLocalUser(authEmail, authPassword, authNickname.trim(), authAvatar, authColor);
       setCurrentUser(newUser);
       setNickName(newUser.displayName);
       setSelectedAvatar(newUser.avatar);
       setSelectedColor(newUser.color);
       setProfileReady(true);
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Ошибка при регистрации");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleAuthLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError("Пожалуйста, укажите почту и пароль");
      return;
    }
    setAuthError(null);
    setIsAuthSubmitting(true);
    try {
      const matchedUser = await loginLocalUser(authEmail, authPassword);
      setCurrentUser(matchedUser);
      setNickName(matchedUser.displayName);
      setSelectedAvatar(matchedUser.avatar);
      setSelectedColor(matchedUser.color);
      setProfileReady(true);
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Неверный логин или пароль.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleGoogleSignInMain = async () => {
    setAuthError(null);
    setIsAuthSubmitting(true);
    try {
      const gUid = "google_user_" + Math.random().toString(36).substring(2, 9);
      const googleUser = {
        uid: gUid,
        displayName: "Пользователь Google",
        email: "google@sferium.homes",
        avatar: "🎬",
        color: "#4285F4",
      };
      
      setCurrentUser(googleUser);
      setNickName(googleUser.displayName);
      setSelectedAvatar(googleUser.avatar);
      setSelectedColor(googleUser.color);
      
      const localProfile = getLocalUserProfile(googleUser.uid, googleUser.displayName);
      setLobbyUserProfile(localProfile);
      setProfileReady(true);
    } catch (err: any) {
      console.error(err);
      setAuthError("Не удалось авторизоваться через Google");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleRealVkAuth = () => {
    const vkClientId = import.meta.env.VITE_VK_CLIENT_ID || localStorage.getItem("vk_client_id") || "51786574";
    const redirectUri = `${window.location.origin}/auth/vk/callback`;
    const authUrl = `https://oauth.vk.com/authorize?client_id=${vkClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&display=popup&scope=video,offline&response_type=token&v=5.131`;
    
    const popup = window.open(authUrl, "vk_oauth_popup", "width=650,height=650,left=150,top=100");
    if (!popup) {
      alert("Браузер заблокировал всплывающее окно! Пожалуйста, разрешите всплывающие окна.");
    }
  };

  useEffect(() => {
    const handleVkOAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === "VK_OAUTH_SUCCESS") {
        const { accessToken, userId } = event.data;
        console.log("VK OAuth success in main App!", { accessToken, userId });
        
        try {
          localStorage.setItem("vk_video_access_token", accessToken);
          localStorage.setItem("vk_video_user_id", userId);
        } catch (e) {
          console.warn(e);
        }

        // If not logged in, perform server VK login
        if (!currentUser) {
          try {
            setIsAuthSubmitting(true);
            setAuthError(null);
            
            const response = await fetch(getApiUrl("/api/auth/vk-login"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ accessToken, userId })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || "Не удалось войти через ВКонтакте");
            }

            const data = await response.json();
            const loggedInUser = data.user;
            
            setCurrentUser(loggedInUser);
            localStorage.setItem("homes_current_user", JSON.stringify(loggedInUser));

            setNickName(loggedInUser.displayName);
            setSelectedAvatar(loggedInUser.avatar);
            setSelectedColor(loggedInUser.color);
            
            const localProfile = getLocalUserProfile(loggedInUser.uid, loggedInUser.displayName);
            setLobbyUserProfile(localProfile);
            setProfileReady(true);
          } catch (err: any) {
            console.error("VK login error:", err);
            setAuthError(err.message || "Ошибка при входе через ВКонтакте");
          } finally {
            setIsAuthSubmitting(false);
          }
        }
      }
    };

    window.addEventListener("message", handleVkOAuthMessage);
    return () => window.removeEventListener("message", handleVkOAuthMessage);
  }, [currentUser]);

  const openMainSocialAuthPopup = (prov: "vk" | "yandex") => {
    setMainSocialUsername("");
    setMainSocialEmail("");
    setVkAccessTokenInput("");
    setVkUserIdInput("");
    setVkLoginMethod("manual");
    setMainSocialPopup({
      provider: prov,
      isOpen: true,
      step: "credentials"
    });
  };

  const handleMainSocialAuthConfirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!mainSocialPopup) return;

    setAuthError(null);

    if (mainSocialPopup.provider === "vk") {
      if (vkLoginMethod === "manual" && !mainSocialUsername) {
        setAuthError("Пожалуйста, укажите имя пользователя VK");
        return;
      }
      if (vkLoginMethod === "token" && (!vkAccessTokenInput || !vkUserIdInput)) {
        setAuthError("Пожалуйста, укажите Access Token и User ID");
        return;
      }

      setMainSocialPopup(prev => prev ? { ...prev, step: "authorizing" } : null);

      try {
        const payload: any = {};
        if (vkLoginMethod === "manual") {
          payload.isManual = true;
          payload.manualName = mainSocialUsername;
          payload.manualEmail = mainSocialEmail;
          payload.userId = vkUserIdInput || undefined;
          payload.manualAvatar = "👾";
        } else {
          payload.accessToken = vkAccessTokenInput;
          payload.userId = vkUserIdInput;
        }

        const response = await fetch(getApiUrl("/api/auth/vk-login"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Не удалось авторизоваться через VK");
        }

        const data = await response.json();
        const loggedInUser = data.user;

        if (vkLoginMethod === "token") {
          localStorage.setItem("vk_video_access_token", vkAccessTokenInput);
          localStorage.setItem("vk_video_user_id", vkUserIdInput);
        }

        setCurrentUser(loggedInUser);
        localStorage.setItem("homes_current_user", JSON.stringify(loggedInUser));

        setNickName(loggedInUser.displayName);
        setSelectedAvatar(loggedInUser.avatar);
        setSelectedColor(loggedInUser.color);

        const localProfile = getLocalUserProfile(loggedInUser.uid, loggedInUser.displayName);
        setLobbyUserProfile(localProfile);
        setProfileReady(true);
        setMainSocialPopup(null);
      } catch (err: any) {
        console.error("VK login confirm error:", err);
        setAuthError(err.message || "Ошибка при входе через ВКонтакте");
        setMainSocialPopup(prev => prev ? { ...prev, step: "credentials" } : null);
      }
    } else {
      // Yandex Flow
      if (!mainSocialUsername) {
        setAuthError("Пожалуйста, укажите имя пользователя");
        return;
      }
      setMainSocialPopup(prev => prev ? { ...prev, step: "authorizing" } : null);

      setTimeout(async () => {
        try {
          const sUid = `${mainSocialPopup.provider}_user_${Math.random().toString(36).substring(2, 9)}`;
          const socialUser = {
            uid: sUid,
            displayName: mainSocialUsername,
            email: mainSocialEmail || `${mainSocialUsername.toLowerCase()}@${mainSocialPopup.provider}.com`,
            avatar: "🦊",
            color: "#EF4444",
          };
          
          setCurrentUser(socialUser);
          localStorage.setItem("homes_current_user", JSON.stringify(socialUser));

          setNickName(socialUser.displayName);
          setSelectedAvatar(socialUser.avatar);
          setSelectedColor(socialUser.color);
          
          const localProfile = getLocalUserProfile(socialUser.uid, socialUser.displayName);
          setLobbyUserProfile(localProfile);
          setProfileReady(true);
          setMainSocialPopup(null);
        } catch (err: any) {
          console.error(err);
          setAuthError("Ошибка при создании социальной сессии Yandex.");
          setMainSocialPopup(prev => prev ? { ...prev, step: "credentials" } : null);
        }
      }, 1200);
    }
  };


  // Check URL query parameters for invited rooms on boot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      const cleanRoom = roomParam.trim().toUpperCase();
      setActiveRoomId(cleanRoom);
      // Auto-set profile readiness if they have nickname configured
      if (nickName.trim()) {
        setProfileReady(true);
      }
    }
  }, []);

  // Update localStorage when details change
  useEffect(() => {
    localStorage.setItem("yt_party_name", nickName.trim());
    localStorage.setItem("yt_party_avatar", selectedAvatar);
    localStorage.setItem("yt_party_color", selectedColor);
  }, [nickName, selectedAvatar, selectedColor]);

  useEffect(() => {
    localStorage.setItem("yt_party_custom_server_active", customServerType === "custom" ? "true" : "false");
    localStorage.setItem("yt_party_custom_server_address", customServerAddress.trim());
  }, [customServerType, customServerAddress]);

  // Helper definitions for local rooms persistence
  const LOCAL_PUBLIC_ROOMS_KEY = "sferium_local_public_rooms_v1";

  const getLocalPublicRooms = (): any[] => {
    // Fallback default rooms to populate the list if empty
    const defaults = [
      {
        roomId: "GRAVITY",
        name: "Зал Гравитации",
        videoUrl: "https://www.youtube.com/watch?v=a50qT9bW_T0",
        currentVideoTitle: "Иван Васильевич меняет профессию (Советская комедия)",
        views: "15M",
        membersCount: 0,
        members: [],
        isPublic: true
      },
      {
        roomId: "KITCHEN",
        name: "Попкорн Кухня",
        videoUrl: "https://www.youtube.com/watch?v=1stL8U6K2_0",
        currentVideoTitle: "Операция «Ы» и другие приключения Шурика",
        views: "21M",
        membersCount: 0,
        members: [],
        isPublic: true
      },
      {
        roomId: "PATSANY",
        name: "Пацанский Клуб",
        videoUrl: "https://vk.com/video_ext.php?oid=-220550000&id=456239149",
        currentVideoTitle: "VK Fest: Главное Шоу и Выступления",
        views: "4.8M",
        membersCount: 0,
        members: [],
        isPublic: true
      }
    ];

    return defaults;
  };

  const saveLocalPublicRoom = (room: any) => {
    const rooms = getLocalPublicRooms();
    const index = rooms.findIndex((r) => r.roomId === room.roomId);
    if (index >= 0) {
      rooms[index] = { ...rooms[index], ...room };
    } else {
      rooms.push(room);
    }
    localStorage.setItem(LOCAL_PUBLIC_ROOMS_KEY, JSON.stringify(rooms));
  };

  const updateGeneralPublicRoomsList = (room: RoomState) => {
    if (!room.isPublic) {
      const list = getLocalPublicRooms().filter((r) => r.roomId !== room.roomId);
      localStorage.setItem(LOCAL_PUBLIC_ROOMS_KEY, JSON.stringify(list));
    } else {
      const simplifiedRoom = {
        roomId: room.roomId,
        name: `Зал ${room.roomId}`,
        videoUrl: room.videoUrl,
        currentVideoTitle: room.currentVideoTitle,
        membersCount: Object.keys(room.members).length,
        members: Object.values(room.members).map((m) => ({
          id: m.id,
          name: m.name,
          avatar: m.avatar,
          color: m.color
        })),
        isPublic: true
      };
      saveLocalPublicRoom(simplifiedRoom);
    }
  };

  function extractVideoId(url: string): string {
    try {
      if (url.includes("youtube.com") || url.includes("youtu.be")) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? match[2] : "dQw4w9WgXcQ";
      }
      if (url.includes("vk.com/video_ext.php") || url.includes("vkvideo.ru")) {
        const match = url.match(/id=([^&]+)/);
        return match ? match[1] : "456239149";
      }
      if (url.includes("rutube.ru/video/")) {
        const parts = url.split("/video/");
        if (parts[1]) {
          return parts[1].replace(/\//g, "");
        }
      }
    } catch (_) {}
    return url;
  }

  function detectProvider(url: string): "youtube" | "vk" | "rutube" | "yandex" | "unknown" {
    if (url.includes("vk.com") || url.includes("vkvideo.ru")) return "vk";
    if (url.includes("rutube.ru")) return "rutube";
    if (url.includes("yandex.ru") || url.includes("dzen.ru")) return "yandex";
    return "unknown";
  }

  // Listen for window-level postMessage telemetry from Sferium Client Mediator bookmarklet/userscript
  useEffect(() => {
    const handleMediatorPostMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.source === "sferium-mediator-agent") {
        if (data.type === "playback_change") {
          handlePlaybackChange(!!data.playing, data.currentTime ?? 0);
        } else if (data.type === "seek") {
          handleSeek(data.currentTime ?? 0);
        } else if (data.type === "change_video" && data.videoUrl) {
          handleChangeVideo(data.videoUrl);
        }
      }
    };
    window.addEventListener("message", handleMediatorPostMessage);
    return () => window.removeEventListener("message", handleMediatorPostMessage);
  }, []);

  // Connect & maintain real WebSocket synchronization across browsers and tabs
  useEffect(() => {
    if (!activeRoomId || !profileReady) return;

    setWsStatus("connecting");

    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProto}//${window.location.host}/ws` + (activeRoomId ? `?room_id=${activeRoomId}` : "");

    const myMemberId = currentUserId || `user_${Math.random().toString(36).substring(2, 9)}`;
    if (!currentUserId) {
      setCurrentUserId(myMemberId);
    }

    let socket: WebSocket;
    let reconnectTimeoutId: any;
    let pingIntervalId: any;

    function connect() {
      console.log("Connecting to real Sferium WebSocket...", wsUrl);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setWsStatus("connected");
        reconnectAttemptsRef.current = 0;

        // Send join event
        socket.send(JSON.stringify({
          type: "join",
          roomId: activeRoomId,
          name: nickName.trim() || "Гость",
          avatar: selectedAvatar,
          color: selectedColor,
          uid: myMemberId,
        }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data) return;

          console.log(`[WS Client INCOMING] Type: ${data.type}`, data);

          switch (data.type) {
            case "room_state":
              setRoomState(data.state);
              if (data.state && data.state.roomId && data.state.roomId !== activeRoomId) {
                setActiveRoomId(data.state.roomId);
              }
              if (data.userId) {
                // If backend assigned or confirmed a userId
                setCurrentUserId(data.userId);
              }
              break;

            case "heartbeat_sync":
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  playing: data.playing,
                  currentTime: data.currentTime,
                };
              });
              setRemoteEvent({
                type: "heartbeat_sync",
                playing: data.playing,
                currentTime: data.currentTime,
                timestamp: data.timestamp || Date.now(),
              });
              break;

            case "SYNC_STATE":
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  videoUrl: data.videoUrl,
                  videoId: extractVideoId(data.videoUrl),
                  provider: detectProvider(data.videoUrl),
                  playing: data.isPlaying,
                  currentTime: data.currentTime,
                };
              });
              setRemoteEvent({
                type: "playback_change",
                playing: data.isPlaying,
                currentTime: data.currentTime,
                timestamp: Date.now(),
              });
              break;

            case "join":
              setRoomState((prev) => {
                if (!prev) return null;
                const updatedMembers = { ...prev.members, [data.member.id]: data.member };
                return {
                  ...prev,
                  members: updatedMembers,
                };
              });
              break;

            case "leave":
              setRoomState((prev) => {
                if (!prev) return null;
                const { [data.memberId]: _, ...remaining } = prev.members;
                return {
                  ...prev,
                  members: remaining,
                };
              });
              break;

            case "playback_change":
              setRoomState((prev) => {
                if (!prev) return null;
                return { ...prev, playing: data.playing, currentTime: data.currentTime };
              });
              setRemoteEvent({
                type: "playback_change",
                playing: data.playing,
                currentTime: data.currentTime,
                timestamp: Date.now(),
              });
              break;

            case "seek":
              setRoomState((prev) => {
                if (!prev) return null;
                return { ...prev, currentTime: data.currentTime };
              });
              setRemoteEvent({
                type: "seek",
                currentTime: data.currentTime,
                timestamp: Date.now(),
              });
              break;

            case "change_video":
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  videoUrl: data.videoUrl,
                  videoId: data.videoId,
                  provider: data.provider,
                  currentVideoTitle: data.title,
                  playing: false,
                  currentTime: 0,
                };
              });
              break;

            case "chat_broadcast":
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  chatHistory: [...prev.chatHistory, data.message],
                };
              });
              break;

            case "members_update":
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  members: data.members,
                  membersCount: Object.keys(data.members).length,
                };
              });
              break;

            case "kicked_notification":
              handleExitRoom();
              alert("Вы были удалены из комнаты администратором.");
              break;

            case "room_closed_notification":
              handleExitRoom();
              alert("Комната была закрыта создателем.");
              break;

            case "remote_toggle_mic_request":
              window.dispatchEvent(
                new CustomEvent("remote-mic-toggle", {
                  detail: { enabled: data.enabled },
                })
              );
              break;

            default:
              break;
          }
        } catch (e) {
          console.error("Failed to parse message from WebSocket", e);
        }
      };

      socket.onclose = (event) => {
        setWsStatus("disconnected");
        console.warn("WebSocket closed. Attempting reconnect...", event);
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectTimeoutId = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, 3000);
        }
      };

      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      // Assign the real socket reference
      wsRef.current = socket;
    }

    connect();

    // Start a ping heartbeat to keep connection alive
    pingIntervalId = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, 20000);

    return () => {
      clearTimeout(reconnectTimeoutId);
      clearInterval(pingIntervalId);
      if (socket) {
        socket.close();
      }
      wsRef.current = null;
    };
  }, [activeRoomId, profileReady]);

  // Handler to alter playback locally -> send to socket
  const handlePlaybackChange = (playing: boolean, currentTime: number) => {
    if (wsRef.current) {
      const payload = {
        type: "playback_change",
        playing,
        currentTime,
      };
      console.log("[WS Client OUTGOING] Sending playback_change", payload);
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const handleSeek = (currentTime: number) => {
    if (wsRef.current) {
      const payload = {
        type: "seek",
        currentTime,
      };
      console.log("[WS Client OUTGOING] Sending seek", payload);
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const handleHeartbeat = (currentTime: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        type: "heartbeat_sync",
        currentTime,
      };
      console.log("[WS Client OUTGOING] Sending heartbeat_sync", payload);
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const handleSendMessage = (text: string) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "chat_message",
          text,
        })
      );
    }
  };

  const handleReactMessage = (messageId: string, emoji: string) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "react_message",
          messageId,
          emoji,
        })
      );
    }
  };

  const handleChangeVideo = (videoUrl: string) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "change_video",
          videoUrl,
        })
      );
    }
  };

  const handleTogglePrivacy = (isPublic: boolean) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "set_privacy",
          isPublic,
        })
      );
    }
  };

  const handleToggleControlSharing = (anyoneCanControl: boolean) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "toggle_control_sharing",
          anyoneCanControl,
        })
      );
    }
  };

  const handleToggleMic = (enabled: boolean) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "toggle_mic",
          enabled,
        })
      );
    }
  };

  const handleRemoteToggleMic = (targetUserId: string, enabled: boolean) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "remote_toggle_mic",
          targetUserId,
          enabled,
        })
      );
    }
  };

  const handleMuteMember = (targetUserId: string, blocked: boolean) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "mute_member",
          targetUserId,
          blocked,
        })
      );
    }
  };

  const handleKickMember = (targetUserId: string) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "kick_member",
          targetUserId,
        })
      );
    }
  };

  const handleMuteAllMics = (mute: boolean) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "mute_all_mics",
          mute,
        })
      );
    }
  };

  // Lobby triggers
  const handleCreateRoom = () => {
    if (!nickName.trim()) {
      setJoinError("Пожалуйста, сначала укажите ваше имя или никнейм");
      return;
    }
    setJoinError("");
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setActiveRoomId(randomCode);
    setProfileReady(true);
  };

  // Fetch rooms list periodically from server
  useEffect(() => {
    if (activeRoomId && profileReady) return;

    const fetchRooms = async () => {
      try {
        const response = await fetch(getApiUrl("/api/rooms-public"));
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.rooms)) {
            setPublicRooms(data.rooms);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed to fetch public rooms from server, using local fallback:", err);
      }
      // Fallback
      const rooms = getLocalPublicRooms();
      setPublicRooms(rooms);
    };

    fetchRooms();
    const intervalId = setInterval(fetchRooms, 3000);
    return () => clearInterval(intervalId);
  }, [activeRoomId, profileReady]);

  const handleJoinByCode = (e: FormEvent) => {
    e.preventDefault();
    if (!nickName.trim()) {
      setJoinError("Пожалуйста, сначала укажите ваше имя или никнейм");
      return;
    }
    const cleanJoinCode = joinCode.trim().toUpperCase();
    if (!cleanJoinCode) {
      setJoinError("Пожалуйста, укажите код комнаты");
      return;
    }

    setJoinError("");
    setActiveRoomId(cleanJoinCode);
    setProfileReady(true);
  };

  const getAestheticEmoji = (avatar: string) => {
    if (avatar && (avatar.startsWith("http://") || avatar.startsWith("https://") || avatar.startsWith("data:"))) {
      return "🖼️";
    }
    return avatar || "🍿";
  };

  const handleLobbyAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setJoinError("Пожалуйста, выберите файл изображения.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxDim = 120;
        let w = img.width;
        let h = img.height;
        const size = Math.min(w, h);
        canvas.width = maxDim;
        canvas.height = maxDim;
        
        if (ctx) {
          ctx.drawImage(img, (w - size) / 2, (h - size) / 2, size, size, 0, 0, maxDim, maxDim);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          setSelectedAvatar(dataUrl);
          setJoinError("");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAuthError("Пожалуйста, выберите файл изображения.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxDim = 120;
        let w = img.width;
        let h = img.height;
        const size = Math.min(w, h);
        canvas.width = maxDim;
        canvas.height = maxDim;
        
        if (ctx) {
          ctx.drawImage(img, (w - size) / 2, (h - size) / 2, size, size, 0, 0, maxDim, maxDim);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          setAuthAvatar(dataUrl);
          setAuthError("");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSynced = (name: string, avatar: string, color: string) => {
    setNickName(name);
    setSelectedAvatar(avatar);
    setSelectedColor(color);
  };

  const handleExitRoom = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("[WS Client OUTGOING] Sending exit_room");
      try {
        wsRef.current.send(JSON.stringify({ type: "exit_room" }));
      } catch (err) {
        console.error("Failed to send exit_room message", err);
      }
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    setActiveRoomId(null);
    setRoomState(null);
    setProfileReady(false);
    // Clear URL params without reloading
    window.history.pushState({}, document.title, window.location.pathname);
  };

  const scrollToChat = () => {
    const chatEl = document.getElementById("room-chat-section");
    if (chatEl) {
      chatEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCopyInviteLink = async () => {
    if (!activeRoomId) return;
    const inviteLink = `${window.location.origin}/?room=${activeRoomId}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        const input = document.createElement("input");
        input.value = inviteLink;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopiedLocal(true);
      setTimeout(() => setCopiedLocal(false), 2000);
    } catch (e) {
      console.warn("Failed to copy link via API", e);
    }
  };

  if (isAuthLoading) {
    return (
      <div 
        className={`min-h-screen w-full overflow-x-hidden flex items-center justify-center relative font-sans antialiased transition-all duration-500 bg-cover bg-no-repeat ${isDayMode ? "text-zinc-900" : "text-zinc-105"}`}
        style={{ backgroundImage: activeBgGradient, backgroundColor: activeBgColor }}
      >
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          <h2 className="font-display font-medium text-lg text-zinc-400 select-none uppercase tracking-wider">Синхронизация Sferium...</h2>
          <p className="text-xs text-zinc-550 font-mono">auth.sferium.com/checking-session</p>
        </div>
      </div>
    );
  }

  if (!currentUser && !onboardingCompleted) {
    const slide = ONBOARDING_SLIDES[onboardingStep];
    return (
      <div 
        className="min-h-screen relative font-sans antialiased flex flex-col items-center justify-center p-4 sm:p-6 select-none bg-cover bg-no-repeat text-zinc-100 overflow-hidden"
        style={{ backgroundImage: activeBgGradient, backgroundColor: activeBgColor }}
      >
        {/* Floating background glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-fuchsia-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />

        {/* Global Navbar */}
        <div className="absolute top-5 left-6 right-6 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-700 flex items-center justify-center border border-indigo-500/20 shadow-md shadow-fuchsia-500/10">
              <Disc className="w-4.5 h-4.5 text-white animate-spin-slow" />
            </div>
            <span className="font-display font-black text-sm tracking-widest text-zinc-100 uppercase">
              HOMES <span className="text-indigo-400 font-extrabold">SYNC</span>
            </span>
          </div>
          
          <button 
            type="button"
            onClick={() => {
              localStorage.setItem("homes_onboarding_completed", "true");
              setOnboardingCompleted(true);
            }}
            className="px-4 py-1.5 rounded-full bg-zinc-900/60 hover:bg-zinc-850/80 border border-zinc-800 text-zinc-400 text-xs font-semibold cursor-pointer transition-all hover:text-indigo-300"
          >
            Пропустить
          </button>
        </div>

        {/* Onboarding Main Grid Card */}
        <div className="w-full max-w-4xl bg-zinc-950/75 border border-[#3b1f5c]/25 rounded-[32px] p-6 sm:p-8 md:p-10 shadow-[0_32px_80px_rgba(10,5,25,0.75)] backdrop-blur-3xl relative z-10 flex flex-col md:flex-row gap-8 items-center justify-center min-h-[520px]">
          
          {/* Smartphone Mockup Panel (Left Half) */}
          <div className="w-full max-w-[270px] sm:max-w-[290px] aspect-[9/18] bg-[#0c061a] border-[6px] border-zinc-800 rounded-[44px] shadow-2xl relative overflow-hidden flex flex-col shrink-0 ring-4 ring-[#2b1747]/30">
            {/* Top Ear Speaker Notch */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-4 bg-zinc-900 rounded-full z-40 flex items-center justify-center">
              <div className="w-8 h-1 bg-zinc-950 rounded-full" />
            </div>

            {/* Simulated screen status bar */}
            <div className="pt-8 h-12 flex justify-between items-center px-6 text-[10px] text-zinc-500 font-medium z-30 select-none">
              <span>09:41</span>
              <div className="flex gap-1 items-center">
                <span>LTE</span>
                <span className="font-bold">100%</span>
              </div>
            </div>

            {/* Video Background playing / mock UI based on current onboarding step */}
            <div className="flex-1 relative overflow-hidden bg-black flex flex-col">
              
              {/* Loop Video playing */}
              <div className="absolute inset-0 z-0">
                <video
                  src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />
              </div>

              {/* Step Particular Widgets */}
              <div className="absolute inset-x-0 bottom-4 z-10 px-4 flex flex-col gap-2 justify-end">
                <AnimatePresence mode="wait">
                  {onboardingStep === 0 && (
                    <motion.div 
                      key="watch-w"
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-1.5"
                    >
                      {/* Notifications representing users joining */}
                      <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-2 flex items-center gap-2 text-[10px]">
                        <span className="text-sm">👩‍💻</span>
                        <div className="text-left">
                          <p className="font-bold text-white leading-normal">Julie <span className="text-indigo-300 font-normal">присоединилась</span></p>
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-2 flex items-center gap-2 text-[10px] animate-in">
                        <span className="text-sm">🧔</span>
                        <div className="text-left">
                          <p className="font-bold text-white leading-normal">Zuqi <span className="text-zinc-300 font-normal">присоединился</span></p>
                        </div>
                      </div>
                      <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-2 flex items-center gap-2 text-[10px] animate-in">
                        <span className="text-sm">👦</span>
                        <div className="text-left">
                          <p className="font-bold text-white leading-normal">Ian <span className="text-zinc-300 font-normal">присоединился</span></p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 1 && (
                    <motion.div 
                      key="chat-w"
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-1.5 flex flex-col"
                    >
                      {/* Chat Messages */}
                      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2 text-[9px] max-w-[85%] self-start text-left">
                        <span className="font-bold text-indigo-400">Julie:</span> Всем привет! 😍 Видео идет идеально.
                      </div>
                      <div className="bg-indigo-600/90 border border-indigo-500 rounded-xl p-2 text-[9px] max-w-[85%] self-end text-right">
                        Ахах, да, реакция огонь! 🔥
                      </div>
                      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2 text-[9px] max-w-[85%] self-start text-left">
                        <span className="font-bold text-orange-400">Ian:</span> Качество просто космос 🍿
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 2 && (
                    <motion.div 
                      key="voice-w"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex flex-col items-center gap-3 p-3 bg-indigo-950/60 backdrop-blur-md border border-indigo-500/20 rounded-3xl"
                    >
                      <div className="flex items-center gap-2 justify-center">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">ГОЛОСОВОЙ ЗВОНОК</span>
                      </div>
                      
                      {/* Avatars speaking waves */}
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center relative border border-white/10 text-xs">
                          👩‍💻
                          <div className="absolute inset-0 rounded-full border border-indigo-400 animate-ping" />
                        </div>
                        <div className="w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center relative border-2 border-emerald-500 text-sm font-bold">
                          🧔
                          <div className="absolute inset-0 rounded-full border border-emerald-400 animate-ping" style={{ animationDuration: "1.5s" }} />
                        </div>
                        <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center relative border border-white/10 text-xs">
                          👦
                        </div>
                      </div>
                      
                      {/* CSS Sound Waveforms */}
                      <div className="flex gap-0.5 items-end h-8 justify-center w-full">
                        {[40, 75, 55, 90, 45, 80, 50, 60, 30, 70, 85, 35].map((h, i) => (
                          <span 
                            key={i} 
                            style={{ height: `${h}%` }} 
                            className="bg-indigo-400 w-1 rounded-full animate-pulse"
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 3 && (
                    <motion.div 
                      key="sync-w"
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-2 p-3 bg-zinc-950/80 border border-zinc-850 rounded-2xl"
                    >
                      <div className="flex items-center justify-between text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                        <span>Синхронизация</span>
                        <span className="animate-pulse">● 100%</span>
                      </div>
                      
                      {/* Dual playback timelines showing total sync */}
                      <div className="space-y-1.5 font-mono text-[9px] text-zinc-300">
                        <div className="flex items-center justify-between text-left">
                          <span>Устройство 1:</span>
                          <span className="text-zinc-105 font-bold">01:45.32</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                          <div className="w-1/2 h-full bg-indigo-505" />
                        </div>
                        
                        <div className="flex items-center justify-between mt-1 text-left">
                          <span>Устройство 2:</span>
                          <span className="text-zinc-105 font-bold">01:45.32</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                          <div className="w-1/2 h-full bg-indigo-505" />
                        </div>
                      </div>
                      <span className="block text-[8px] text-center text-zinc-500 mt-1">разница кадра = 0.00ms</span>
                    </motion.div>
                  )}

                  {onboardingStep === 4 && (
                    <motion.div 
                      key="audio-w"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      className="flex flex-col items-center gap-2.5 p-3 bg-fuchsia-950/50 backdrop-blur-md border border-fuchsia-500/20 rounded-2xl"
                    >
                      <div className="text-3xl animate-bounce">🔊</div>
                      <div className="text-[10px] font-bold text-fuchsia-300 uppercase tracking-widest text-center">
                        Пространственный звук
                      </div>
                      <div className="w-full grid grid-cols-2 gap-1.5 text-[8px] font-semibold text-zinc-400 text-center uppercase">
                        <div className="bg-fuchsia-900/20 py-1 border border-fuchsia-500/10 rounded">Левый канал</div>
                        <div className="bg-fuchsia-900/20 py-1 border border-fuchsia-500/10 rounded text-fuchsia-300 animate-pulse">Правый канал</div>
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 5 && (
                    <motion.div 
                      key="join-w"
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-3 p-4 bg-zinc-950/90 border border-indigo-500/10 rounded-2xl text-center"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-lg mx-auto">
                        🍿
                      </div>
                      <div className="space-y-0.5">
                        <h6 className="text-[10px] font-bold text-zinc-200">Homes Sync запущен!</h6>
                        <p className="text-[8px] text-zinc-400 font-medium">Все лучшие функции готовы к вашему выбору.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>

            {/* Bottom Simulated Home Bar Indicator */}
            <div className="h-6 flex items-center justify-center z-30 select-none pb-1">
              <div className="w-24 h-1 bg-zinc-700 rounded-full" />
            </div>
          </div>

          {/* Texts & Controls Panel (Right Half) */}
          <div className="flex-1 flex flex-col justify-between self-stretch py-2 text-center md:text-left min-h-[360px]">
            <div>
              {/* Category tag */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-450 text-[10px] font-bold tracking-widest uppercase mb-4 max-w-max mx-auto md:mx-0">
                <span>{slide.emoji}</span>
                <span>{slide.category}</span>
              </div>

              {/* Slider Heading */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={onboardingStep}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1.5"
                >
                  <h2 className="text-2xl sm:text-3xl font-display font-medium tracking-tight text-white leading-tight">
                    {slide.title}
                  </h2>
                  <h3 className="text-lg sm:text-xl font-display font-black tracking-wide text-indigo-400 leading-snug animate-pulse">
                    {slide.subtitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-semibold pt-3 max-w-sm mx-auto md:mx-0">
                    {slide.desc}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer steps indicators */}
            <div className="flex flex-col gap-5 pt-8 md:pt-0">
              
              {/* Dots Progress Indicator */}
              <div className="flex gap-2 justify-center md:justify-start items-center">
                {ONBOARDING_SLIDES.map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setOnboardingStep(i)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      i === onboardingStep ? "w-6 bg-indigo-500 shadow-md shadow-indigo-500/30" : "w-2 bg-zinc-800 hover:bg-zinc-700"
                    }`}
                  />
                ))}
              </div>

              {/* Controls buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                {onboardingStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setOnboardingStep(prev => prev - 1)}
                    className="flex-1 py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-750 text-zinc-300 hover:text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Назад
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => {
                    if (onboardingStep < ONBOARDING_SLIDES.length - 1) {
                      setOnboardingStep(prev => prev + 1);
                    } else {
                      localStorage.setItem("homes_onboarding_completed", "true");
                      setOnboardingCompleted(true);
                    }
                  }}
                  className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-550 active:scale-95 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-xl shadow-indigo-600/10 cursor-pointer text-center"
                >
                  {onboardingStep === ONBOARDING_SLIDES.length - 1 ? "Войти в Homes ✨" : "Далее"}
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Dynamic Small Credits */}
        <p className="text-[10px] text-zinc-600 font-mono select-none tracking-widest uppercase mt-6">
          © 2026 HOMES SYNC INC. ALL RIGHTS RESERVED
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div 
        className={`min-h-screen w-full overflow-x-hidden relative font-sans antialiased flex flex-col items-center justify-center p-4 sm:p-6 select-none transition-all duration-500 bg-cover bg-no-repeat ${isDayMode ? "text-zinc-900" : "text-zinc-100"}`}
        style={{ backgroundImage: activeBgGradient, backgroundColor: activeBgColor }}
      >
        {/* Outer Glow Ambient Elements */}
        {!isDayMode && (
          <>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />
          </>
        )}

        <div className={`w-full max-w-md border rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 flex flex-col gap-5 backdrop-blur-xl transition-all duration-500 ${
          isDayMode 
            ? "bg-white/85 border-white/60 text-zinc-900 shadow-amber-500/5 ring-1 ring-black/5" 
            : "bg-zinc-950/90 border-[#3f1f6c]/30 text-zinc-100"
        }`}>
          
          {/* Logo & Headline */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-700 flex items-center justify-center border border-indigo-500/20 shadow-2xl">
              <Disc className="w-8 h-8 text-white animate-spin-slow" />
            </div>
            <div>
              <h1 className="font-display font-black text-xl tracking-wider select-none uppercase">
                HOMES <span className="text-indigo-400 font-extrabold">SYNC</span>
              </h1>
              <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase mt-1 select-none">Доступ заблокирован без авторизации</p>
            </div>
            <p className={`text-xs leading-relaxed max-w-sm mt-1 ${isDayMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
              Войдите или зарегистрируйтесь, чтобы запустить совместный просмотр видео и общаться с друзьями в реальном времени!
            </p>
            
            {/* Guest entrance without registration */}
            <button
              id="guest-access-login-btn"
              type="button"
              onClick={handleGuestAccess}
              disabled={isAuthSubmitting}
              className={`w-full py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-2 shadow-sm cursor-pointer select-none ${
                isDayMode
                  ? "bg-indigo-50 hover:bg-indigo-100/70 border-indigo-200 text-indigo-600"
                  : "bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20 text-indigo-400 hover:text-indigo-300"
              }`}
            >
              <Globe className="w-4 h-4 text-indigo-500 animate-spin-slow" />
              Войти без регистрации (как Гость)
            </button>
          </div>

          {/* Activation Status Banner */}
          {activationStatus.status !== "idle" && (
            <div className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
              activationStatus.status === "loading"
                ? "bg-indigo-500/10 border-indigo-500/25 text-indigo-300"
                : activationStatus.status === "success"
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/25 text-rose-350"
            }`}>
              {activationStatus.status === "loading" && <Loader2 className="w-4 h-4 text-indigo-450 flex-shrink-0 animate-spin mt-0.5" />}
              {activationStatus.status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-450 flex-shrink-0 mt-0.5" />}
              {activationStatus.status === "error" && <AlertCircle className="w-4 h-4 text-rose-450 flex-shrink-0 mt-0.5" />}
              <p className="text-xs font-semibold leading-relaxed">{activationStatus.message}</p>
            </div>
          )}

          {/* Toast Message Errors */}
          {authError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <p className="text-xs text-rose-300 font-medium leading-relaxed">{authError}</p>
            </div>
          )}

          {/* Auth Method Toggle Buttons */}
          <div className="grid grid-cols-2 p-1 bg-zinc-900 rounded-2xl border border-zinc-850">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthError(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                authMode === "login" 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Вход по Email
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("register");
                setAuthError(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                authMode === "register" 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Регистрация
            </button>
          </div>

          {/* Social login buttons */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleGoogleSignInMain}
              disabled={isAuthSubmitting}
              className="w-full h-10.5 bg-white hover:bg-zinc-105 text-zinc-900 font-bold text-xs rounded-xl flex items-center justify-center gap-2.5 border border-zinc-200 shadow hover:shadow-lg transition-all cursor-pointer"
            >
              <Chrome className="w-4 h-4 text-red-500 fill-red-500" />
              Войти через Google
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openMainSocialAuthPopup("vk")}
                disabled={isAuthSubmitting}
                className="h-10.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center font-bold tracking-tighter text-[11px]">vk</span>
                ВКонтакте
              </button>
              <button
                type="button"
                onClick={() => openMainSocialAuthPopup("yandex")}
                disabled={isAuthSubmitting}
                className="h-10.5 bg-red-600 hover:bg-red-505 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span className="w-5 h-5 rounded bg-white flex items-center justify-center font-serif text-xs font-bold italic text-red-600">Я</span>
                Яндекс
              </button>
            </div>
          </div>

          <div className="flex items-center text-center py-0.5">
            <hr className="flex-1 border-zinc-900" />
            <span className="px-2.5 text-[10px] text-zinc-550 font-bold uppercase tracking-widest leading-none select-none">или войти по почте</span>
            <hr className="flex-1 border-zinc-900" />
          </div>

          {/* Standard Form Creds */}
          <form onSubmit={authMode === "register" ? handleAuthRegister : handleAuthLogin} className="space-y-3">
            {authMode === "register" && (
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1 uppercase tracking-wider select-none">Ваш никнейм</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={authNickname}
                    onChange={(e) => setAuthNickname(e.target.value)}
                    maxLength={18}
                    placeholder="Например, Кинокритик..."
                    className="w-full bg-zinc-900 border border-zinc-850 pl-10 pr-4 py-2 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-indigo-500 hover:border-zinc-800 transition-all font-medium"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1 uppercase tracking-wider select-none">Электронная почта</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="mail@example.com"
                  className="w-full bg-zinc-900 border border-zinc-850 pl-10 pr-4 py-2 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-indigo-500 hover:border-zinc-800 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1 uppercase tracking-wider select-none">Пароль аккаунта</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Минимум 6 символов..."
                  className="w-full bg-zinc-900 border border-zinc-850 pl-10 pr-4 py-2 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-indigo-500 hover:border-zinc-800 transition-all font-medium"
                />
              </div>
            </div>

            {authMode === "register" && (
              <>
                {/* Avatar Selection Grid */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1 uppercase tracking-wider select-none">Аватар аккаунта</label>
                  <div className="grid grid-cols-6 gap-1 p-1.5 bg-zinc-900 rounded-xl border border-zinc-850">
                    {AVATAR_PRESETS.map((av) => (
                      <button
                        key={av}
                        type="button"
                        onClick={() => setAuthAvatar(av)}
                        className={`h-7.5 rounded text-base flex items-center justify-center transition-all ${
                          authAvatar === av
                            ? "bg-indigo-600 scale-110 shadow-sm shadow-indigo-600/25 text-lg"
                            : "bg-zinc-950 hover:bg-zinc-800"
                        }`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>

                  {/* Custom local upload controls for register */}
                  <div className="mt-2 flex flex-col sm:flex-row gap-1.5">
                    <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 hover:border-zinc-750 rounded-lg text-zinc-400 hover:text-zinc-200 text-[10px] font-semibold transition-all cursor-pointer select-none">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleRegisterAvatarFileChange}
                        className="hidden"
                      />
                      📎 Своё фото
                    </label>
                    
                    <input
                      type="text"
                      placeholder="Или ссылка..."
                      value={authAvatar && (authAvatar.startsWith("http://") || authAvatar.startsWith("https://")) ? authAvatar : ""}
                      onChange={(e) => setAuthAvatar(e.target.value)}
                      className="flex-1 bg-zinc-950 text-[10px] text-zinc-350 px-2 flex items-center rounded-lg border border-zinc-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Color Selection Grid */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1 uppercase tracking-wider select-none font-semibold">Цвет отображения в чате</label>
                  <div className="flex flex-wrap gap-2 p-1.5 bg-zinc-900 rounded-xl border border-zinc-850">
                    {COLOR_PRESETS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setAuthColor(col)}
                        className="w-5.5 h-5.5 rounded-full flex items-center justify-center border border-zinc-950 hover:scale-110 shrink-0 transition-transform"
                        style={{ backgroundColor: col }}
                      >
                        {authColor === col && <span className="w-1.5 h-1.5 rounded-full bg-white/80" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isAuthSubmitting}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-550 disabled:bg-indigo-800 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-xl shadow-indigo-600/10 cursor-pointer mt-2"
            >
              {isAuthSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {authMode === "register" ? "Зарегистрировать профиль" : "Войти в систему"}
            </button>
          </form>

        </div>

        {/* Real-time sub popup for VK / Yandex inside Auth screen */}
        <AnimatePresence>
          {mainSocialPopup?.isOpen && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
                onClick={() => setMainSocialPopup(null)}
              />
              
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl z-51"
              >
                <div className={`p-4 flex items-center gap-2 select-none ${mainSocialPopup.provider === "vk" ? "bg-blue-600 text-white" : "bg-red-600 text-white"}`}>
                  <KeyRound className="w-4.5 h-4.5 shrink-0" />
                  <h4 className="font-display font-semibold text-[11px] tracking-wider uppercase">
                    {mainSocialPopup.provider === "vk" ? "Авторизация через ВКонтакте" : "Авторизация через Яндекс ID"}
                  </h4>
                </div>

                <div className="p-5">
                  {mainSocialPopup.step === "credentials" ? (
                    mainSocialPopup.provider === "vk" ? (
                      <form onSubmit={handleMainSocialAuthConfirm} className="space-y-4">
                        {/* Tab Headers */}
                        <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-850 select-none">
                          <button
                            type="button"
                            onClick={() => {
                              setVkLoginMethod("manual");
                              setAuthError(null);
                            }}
                            className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                              vkLoginMethod === "manual"
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            Без API (Быстрый)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVkLoginMethod("token");
                              setAuthError(null);
                            }}
                            className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                              vkLoginMethod === "token"
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            По Токену
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVkLoginMethod("oauth");
                              setAuthError(null);
                            }}
                            className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                              vkLoginMethod === "oauth"
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            OAuth API
                          </button>
                        </div>

                        {vkLoginMethod === "manual" && (
                          <div className="space-y-3">
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                              Мгновенный вход в кинотеатр без необходимости авторизоваться в самом ВКонтакте. Создаёт полноценный аккаунт.
                            </p>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 select-none">Имя или Никнейм VK</label>
                              <input
                                type="text"
                                required
                                value={mainSocialUsername}
                                onChange={(e) => setMainSocialUsername(e.target.value)}
                                placeholder="Иван Иванов (VK)..."
                                className="w-full bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-sans font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 select-none">Email адрес (опционально)</label>
                              <input
                                type="email"
                                value={mainSocialEmail}
                                onChange={(e) => setMainSocialEmail(e.target.value)}
                                placeholder="ivan@vk.com"
                                className="w-full bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 select-none">Цифровой ID VK (опционально)</label>
                              <input
                                type="text"
                                value={vkUserIdInput}
                                onChange={(e) => setVkUserIdInput(e.target.value.replace(/\D/g, ""))}
                                placeholder="123456789"
                                className="w-full bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>
                          </div>
                        )}

                        {vkLoginMethod === "token" && (
                          <div className="space-y-3">
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                              Вставьте ваш VK Access Token. Это позволит плееру разблокировать приватные видео, эфиры и обходить ограничения.
                            </p>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 select-none">VK Access Token</label>
                              <input
                                type="password"
                                required
                                value={vkAccessTokenInput}
                                onChange={(e) => setVkAccessTokenInput(e.target.value.trim())}
                                placeholder="vk1.a.xxxx..."
                                className="w-full bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 select-none">Ваш ID пользователя VK (User ID)</label>
                              <input
                                type="text"
                                required
                                value={vkUserIdInput}
                                onChange={(e) => setVkUserIdInput(e.target.value.replace(/\D/g, ""))}
                                placeholder="Например: 12345678"
                                className="w-full bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>
                          </div>
                        )}

                        {vkLoginMethod === "oauth" && (
                          <div className="space-y-3">
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                              Авторизация через официальный popup-интерфейс ВКонтакте. Требуется настроенное приложение VK.
                            </p>
                            
                            <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl space-y-2">
                              <div>
                                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 select-none">ID вашего VK приложения (Client ID)</label>
                                <input
                                  type="text"
                                  value={vkClientIdInput}
                                  onChange={(e) => {
                                    const val = e.target.value.trim();
                                    setVkClientIdInput(val);
                                    localStorage.setItem("vk_client_id", val);
                                  }}
                                  placeholder="51786574"
                                  className="w-full bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                                />
                              </div>
                              <p className="text-[8px] text-zinc-500 leading-normal">
                                Стандартное приложение может быть заблокировано. Создайте своё на <a href="https://vk.com/dev" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">vk.com/dev</a>. Укажите в настройках Redirect URI: <code className="text-indigo-400 font-mono text-[8px] break-all">{window.location.origin}/auth/vk/callback</code>
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={handleRealVkAuth}
                              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer border-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Открыть OAuth Окно VK
                            </button>
                          </div>
                        )}

                        {/* Error feedback inside popup */}
                        {authError && (
                          <div className="text-[10px] text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg font-medium">
                            ⚠️ {authError}
                          </div>
                        )}

                        <div className="flex justify-end gap-2.5 pt-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setMainSocialPopup(null);
                              setAuthError(null);
                            }}
                            className="px-4 py-2 bg-zinc-905 hover:bg-zinc-850 text-zinc-400 font-bold rounded-lg text-xs"
                          >
                            Отмена
                          </button>
                          {vkLoginMethod !== "oauth" && (
                            <button
                              type="submit"
                              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs tracking-wider uppercase flex items-center gap-1 cursor-pointer border-0"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Войти
                            </button>
                          )}
                        </div>
                      </form>
                    ) : (
                      // Yandex Form Render
                      <form onSubmit={handleMainSocialAuthConfirm} className="space-y-4.5">
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Позвольте связать виртуальный кинотеатр Sferium с вашей учётной записью Яндекса.
                        </p>

                        <div>
                          <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1 select-none">Ваш логин (или имя)</label>
                          <input
                            type="text"
                            required
                            value={mainSocialUsername}
                            onChange={(e) => setMainSocialUsername(e.target.value)}
                            placeholder="Катя Иванова (Яндекс)..."
                            className="w-full bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-medium font-sans"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1 select-none">Email адрес (опционально)</label>
                          <input
                            type="email"
                            value={mainSocialEmail}
                            onChange={(e) => setMainSocialEmail(e.target.value)}
                            placeholder="user@yandex.ru"
                            className="w-full bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        {authError && (
                          <div className="text-[10px] text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg font-medium">
                            ⚠️ {authError}
                          </div>
                        )}

                        <div className="flex justify-end gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setMainSocialPopup(null);
                              setAuthError(null);
                            }}
                            className="px-4 py-2 bg-zinc-905 hover:bg-zinc-850 text-zinc-400 font-bold rounded-lg text-xs"
                          >
                            Отмена
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2 hover:opacity-90 text-white font-bold rounded-lg text-xs tracking-wider uppercase flex items-center gap-1 cursor-pointer bg-[#DC2626] border-0"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Разрешить
                          </button>
                        </div>
                      </form>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-xs font-semibold text-zinc-200">Перенаправление OAuth и создание сессии...</p>
                      <p className="text-[10px] text-zinc-500 font-mono">auth.sferium.com/callback</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div 
      className={`min-h-screen w-full overflow-x-hidden font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200 transition-all duration-550 bg-cover bg-no-repeat relative ${
        isDayMode ? "bg-[#fcf9ff] text-zinc-900" : "bg-zinc-950 text-zinc-100"
      }`}
      style={{ backgroundImage: activeBgGradient, backgroundColor: activeBgColor }}
    >
      
      {/* Real-time incoming room invitations overlay */}
      {incomingInvites.length > 0 && (
        <div className="fixed top-20 right-4 z-[9999] w-full max-w-sm px-4">
          <div className="bg-zinc-950/95 border border-indigo-500/40 shadow-2xl shadow-indigo-500/20 rounded-2xl p-4 backdrop-blur-xl space-y-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
            {incomingInvites.slice(0, 3).map((invite) => (
              <div key={invite.id} className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-xl mt-0.5 select-none shrink-0">✉️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Приглашение в зал</p>
                    <p className="text-sm text-zinc-100 font-bold leading-tight mt-0.5">
                      {invite.fromName} <span className="font-normal text-zinc-400">приглашает вас в зал</span> <span className="font-mono text-indigo-400 font-bold">{invite.roomId}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAcceptInvite(invite)}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-2 px-2.5 rounded-xl text-xs transition duration-150 cursor-pointer text-center shadow-lg shadow-indigo-600/10"
                  >
                    Принять
                  </button>
                  <button
                    onClick={() => handleDeclineInvite(invite)}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold py-2 px-2.5 rounded-xl border border-zinc-800 text-xs transition duration-150 cursor-pointer text-center"
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Outer Glow Ambient Elements for Dark Mode Feel */}
      {!isDayMode && (
        <>
          <div className="absolute top-0 left-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Main Header / Navigation */}
      <header className={`border-b transition-colors duration-500 sticky top-0 z-50 backdrop-blur-md ${
        isDayMode 
          ? "border-zinc-200/60 bg-white/70 shadow-sm shadow-zinc-100/10" 
          : "border-zinc-900 bg-zinc-950/70"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {activeRoomId ? (
              <button
                onClick={handleExitRoom}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold cursor-pointer select-none transition-all mr-2 group shadow-sm ${
                  isDayMode
                    ? "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-zinc-900"
                    : "bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-350 hover:text-zinc-200"
                }`}
                id="header-back-button-room"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-indigo-500 group-hover:-translate-x-0.5 transition-transform" />
                <span>Выйти из комнаты</span>
              </button>
            ) : profileReady ? (
              <button
                onClick={() => setProfileReady(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold cursor-pointer select-none transition-all mr-2 group shadow-sm ${
                  isDayMode
                    ? "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-zinc-900"
                    : "bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-350 hover:text-zinc-200"
                }`}
                id="header-back-button-lobby"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-indigo-500 group-hover:-translate-x-0.5 transition-transform" />
                <span>Назад к профилю</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!nickName.trim()) {
                    setNickName(`Сферум-${Math.floor(100 + Math.random() * 900)}`);
                  }
                  setProfileReady(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold cursor-pointer select-none transition-all mr-2 group shadow-sm ${
                  isDayMode
                    ? "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-zinc-900"
                    : "bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-350 hover:text-zinc-200"
                }`}
                id="header-back-button-profile"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-indigo-500 group-hover:-translate-x-0.5 transition-transform" />
                <span>Пропустить (В Лобби)</span>
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-700 flex items-center justify-center border border-indigo-500/20 shadow-md">
              <Disc className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <h1 className="font-display font-black text-sm leading-none select-none uppercase tracking-wider">
                HOMES <span className="text-indigo-400 font-extrabold">SYNC</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Real-time personal cabinet/auth button */}
            <button
              id="open-cabinet-header-btn"
              onClick={() => setIsCabinetOpen(true)}
              className={`flex items-center gap-2 border px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer select-none ${
                isDayMode
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/20 shadow-sm"
                  : "bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400"
              }`}
            >
              <Avatar src={selectedAvatar} className="w-5 h-5 rounded-md text-xs" fallback="🍿" />
              <span className="max-w-[100px] truncate">{nickName || "Личный кабинет"}</span>
            </button>

            <div className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium select-none ${
              isDayMode
                ? "bg-zinc-100 border-zinc-200 text-zinc-605"
                : "bg-zinc-900 border-zinc-805 text-zinc-400"
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Безопасный видеосервер
            </div>

            {activeRoomId && (
              <button
                id="exit-room-nav-btn"
                onClick={handleExitRoom}
                className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                Выйти
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <AnimatePresence mode="wait">
          
          {/* LOBBY / CUSTOM PROFILE STATE (Join or Create Room screen) */}
          {!profileReady ? (
            <motion.div
              key="profile-setup"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex justify-center items-center py-6 max-w-lg mx-auto w-full min-h-[75vh]"
            >
              <div className="w-full space-y-6">
                {activeRoomId ? (
                  <button
                    onClick={handleExitRoom}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer select-none transition-all group shadow-md"
                  >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Вернуться к списку комнат</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (!nickName.trim()) {
                        setNickName(`Сферум-${Math.floor(100 + Math.random() * 900)}`);
                      }
                      setProfileReady(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer select-none transition-all group shadow-md"
                    id="lobby-profile-back-guest"
                  >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Продолжить без авторизации (в Лобби)</span>
                  </button>
                )}
                {/* Invite Link Status Bar */}
                {activeRoomId && (
                  <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <h5 className="text-xs font-bold text-indigo-300">Вы приглашены в комнату {activeRoomId}!</h5>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                        Для входа настройте ваш профиль внизу и нажмите кнопку подтверждения.
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl w-full">
                  <div className="text-center mb-8 flex flex-col items-center">
                    <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-700 flex items-center justify-center border border-indigo-500/20 shadow-2xl mb-4 animate-fade">
                      <Disc className="w-10 h-10 text-white animate-spin-slow" />
                    </div>
                    <h2 className="font-display font-black text-2xl text-zinc-100 uppercase tracking-widest leading-tight">
                      🔥 HOMES <span className="text-[#a5b4fc]">SYNC</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed">
                      Смотрите видео с YouTube, VK Видео, Rutube и Яндекс вместе с друзьями с полной синхронизацией!
                    </p>
                  </div>

                  {/* Nickname & Avatar config */}
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 select-none">
                        Ваш никнейм
                      </label>
                      <input
                        id="lobby-nickname-input"
                        type="text"
                        value={nickName}
                        onChange={(e) => setNickName(e.target.value)}
                        placeholder="Введите ваше имя..."
                        maxLength={18}
                        className="w-full bg-zinc-950/80 text-sm text-zinc-200 px-4 py-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-indigo-500 font-medium transition-colors"
                      />
                    </div>

                    {/* Preset avatar visual choosing bento item */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 select-none">
                        Выберите аватар
                      </label>
                      <div className="grid grid-cols-6 gap-2 p-3 bg-zinc-950/60 rounded-2xl border border-zinc-850">
                        {AVATAR_PRESETS.map((av) => (
                          <button
                            id={`avatar-${av}`}
                            key={av}
                            type="button"
                            onClick={() => setSelectedAvatar(av)}
                            className={`aspect-square rounded-xl text-xl flex items-center justify-center transition-all ${
                              selectedAvatar === av
                                ? "bg-indigo-600 scale-110 shadow-md shadow-indigo-500/20"
                                : "bg-zinc-900/60 hover:bg-zinc-800"
                            }`}
                          >
                            <span className="leading-none">{av}</span>
                          </button>
                        ))}
                      </div>

                      {/* Custom local upload controls for lobby */}
                      <div className="mt-2.5 flex flex-col sm:flex-row gap-2">
                        <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 hover:border-zinc-700 rounded-xl text-zinc-350 hover:text-zinc-200 text-xs font-semibold transition-all cursor-pointer select-none">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLobbyAvatarFileChange}
                            className="hidden"
                          />
                          📎 Загрузить своё фото
                        </label>
                        
                        <input
                          type="text"
                          placeholder="Или ссылка на картинку..."
                          value={selectedAvatar && (selectedAvatar.startsWith("http://") || selectedAvatar.startsWith("https://")) ? selectedAvatar : ""}
                          onChange={(e) => setSelectedAvatar(e.target.value)}
                          className="flex-1 bg-zinc-950 text-xs text-zinc-350 px-3 py-2 rounded-xl border border-zinc-850 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Color selector bubble config */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 select-none">
                        Цвет вашего имени в чате
                      </label>
                      <div className="flex flex-wrap items-center gap-3 p-3 bg-zinc-950/60 rounded-2xl border border-zinc-850">
                        {COLOR_PRESETS.map((col) => (
                          <button
                            id={`color-${col}`}
                            key={col}
                            type="button"
                            onClick={() => setSelectedColor(col)}
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-all border border-zinc-950 hover:scale-110 flex-shrink-0"
                            style={{ backgroundColor: col }}
                          >
                            {selectedColor === col ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-white/80 shadow-sm" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Error block */}
                    {joinError && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-350 font-medium">{joinError}</p>
                      </div>
                    )}

                    {/* Primary Trigger Buttons */}
                    <div className="pt-4 border-t border-zinc-850 space-y-4">
                      {activeRoomId ? (
                        <button
                          id="join-invited-btn"
                          type="button"
                          onClick={() => {
                            if (!nickName.trim()) {
                              setJoinError("Пожалуйста, сначала укажите ваше имя или никнейм");
                              return;
                            }
                            setProfileReady(true);
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-11 rounded-xl text-xs sm:text-sm tracking-wide uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer animate-pulse"
                        >
                          <LogIn className="w-4 h-4" />
                          Присоединиться к комнате {activeRoomId}
                        </button>
                      ) : (
                        <>
                          <button
                            id="create-room-btn"
                            type="button"
                            onClick={() => {
                              if (!nickName.trim()) {
                                setJoinError("Пожалуйста, сначала укажите ваше имя или никнейм");
                                return;
                              }
                              setJoinError("");
                              setProfileReady(true);
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-11 rounded-xl text-xs sm:text-sm tracking-wide uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            Создать виртуальную комнату
                          </button>

                          <div className="flex items-center text-center py-2 select-none">
                            <hr className="flex-1 border-zinc-800" />
                            <span className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">или зайти</span>
                            <hr className="flex-1 border-zinc-800" />
                          </div>

                          <form onSubmit={handleJoinByCode} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              id="room-code-input"
                              type="text"
                              value={joinCode}
                              onChange={(e) => setJoinCode(e.target.value)}
                              placeholder="Код комнаты..."
                              maxLength={8}
                              className="sm:col-span-2 h-11 bg-zinc-950 font-mono text-center tracking-wider text-xs px-4 rounded-xl border border-zinc-850 focus:outline-none focus:border-indigo-500"
                              title="Код комнаты"
                            />
                            <button
                              id="join-by-code-btn"
                              type="submit"
                              className="h-11 bg-zinc-805 hover:bg-zinc-750 border border-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all flex items-center justify-center cursor-pointer"
                            >
                              Войти по коду
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : !activeRoomId ? (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-4xl mx-auto py-6 w-full relative"
            >
              {/* All Public Rooms Box (Homes Styled) */}
              <div className="bg-gradient-to-b from-[#1c1236]/90 via-[#0e071f]/95 to-[#06030b] border border-[#3b1f5c]/45 rounded-3xl p-5 sm:p-6 shadow-[0_24px_50px_rgba(20,11,38,0.65)] backdrop-blur-2xl w-full relative min-h-[500px]">
                
                {/* Styled Header resembling top mobile panel of Homes */}
                <div className="flex items-center justify-between pb-3 border-b border-[#2b1747]/40 mb-4 select-none">
                  <button 
                    type="button"
                    onClick={() => setProfileReady(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#251842] hover:bg-[#322159] border border-[#3f2575]/20 rounded-xl transition-all cursor-pointer text-xs font-semibold text-zinc-350 hover:text-white group select-none"
                    title="Назад к настройкам профиля"
                  >
                    <ArrowLeft className="w-4 h-4 text-indigo-400 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Назад к профилю</span>
                  </button>

                  <div className="font-sans font-black text-2xl tracking-normal text-white flex items-center justify-center gap-0.5 lowercase cursor-default select-none">
                    h<span className="text-indigo-400 font-sans tracking-tighter inline-block transform -translate-y-[1px]">o</span>mes
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCabinetOpen(true)}
                    className="p-1 px-1.5 bg-[#251842] hover:bg-[#322159] border border-[#3f2575]/20 rounded-xl transition-all cursor-pointer text-zinc-350 hover:text-white"
                    title="Активные пользователи"
                  >
                    <Users className="w-5 h-5 text-indigo-400" />
                  </button>
                </div>

                {/* Active "Поиск" Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-400 font-bold" />
                  <input
                    id="homes-public-search"
                    type="text"
                    value={publicRoomsSearchQuery}
                    onChange={(e) => setPublicRoomsSearchQuery(e.target.value)}
                    placeholder="Поиск"
                    className="w-full bg-[#1b1235]/70 placeholder-zinc-400 text-xs sm:text-sm text-zinc-100 pl-11 pr-4 py-3 h-11 rounded-2xl outline-none focus:ring-1 focus:ring-indigo-500/50 border border-transparent transition-colors shadow-inner"
                  />
                </div>

                 {/* Homes-style Platform Selector Panel */}
                <PlatformSelector
                  className="mb-4"
                  activePlatform={selectedPlatform}
                  onPlatformChange={(platformId) => setSelectedPlatform(platformId)}
                  onSelectPlatform={(platformId, url) => {
                    if (!nickName.trim()) {
                      setJoinError("Пожалуйста, сначала укажите ваше имя или никнейм");
                      return;
                    }
                    setJoinError("");
                    setSelectedPlatform(platformId);
                    setPendingVideoUrl(url);
                    handleCreateRoom();
                  }}
                />

                {/* Glowing "ВКЛЮЧИТЬ УВЕДОМЛЕНИЯ" system banner */}
                <div className="bg-gradient-to-r from-rose-600/15 via-purple-600/20 to-blue-600/15 border border-[#c41cad]/25 p-4 rounded-2xl flex flex-col items-center justify-center text-center py-4.5 shadow-lg select-none relative overflow-hidden group mb-4">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <span className="text-xs sm:text-sm font-black text-[#faf8ff] tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]">
                    ВКЛЮЧИТЬ УВЕДОМЛЕНИЯ
                  </span>
                  <span className="text-[9px] text-zinc-400 font-semibold tracking-wide mt-1 select-none flex items-center gap-1">
                    🔔 Будьте в курсе совместных трансляций с друзьями!
                  </span>
                </div>

                {/* "Публичные" category header */}
                <div className="flex items-center justify-between mb-4.5 select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🌐</span>
                    <h3 className="font-display font-extrabold text-sm sm:text-base text-zinc-100 uppercase tracking-wider">
                      Публичные
                    </h3>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-ping" />
                    живой эфир
                  </span>
                </div>

                {/* Public list container */}
                <div className="space-y-3.5 pb-20 w-full">
                  {(() => {
                    const filtered = publicRooms.filter((room) => {
                      const query = publicRoomsSearchQuery.trim().toLowerCase();
                      if (!query) return true;
                      return (
                        room.name.toLowerCase().includes(query) ||
                        (room.currentVideoTitle && room.currentVideoTitle.toLowerCase().includes(query))
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-12 text-center text-zinc-500 text-xs font-semibold select-none">
                          {publicRoomsSearchQuery.trim() 
                            ? "Комнаты с таким названием не найдены." 
                            : "Пока нет открытых комнат. Создайте первую!"}
                        </div>
                      );
                    }

                    return filtered.map((room) => {
                      // Get beautiful design gradient depending on room ID
                      let thumbnailGradient = "from-indigo-600 via-purple-600 to-pink-500";
                      let emojiSymbol = "🎬";
                      
                      if (room.roomId === "GRAVITY") {
                        thumbnailGradient = "from-emerald-700 via-teal-600 to-amber-600";
                        emojiSymbol = "🌲";
                      } else if (room.roomId === "KITCHEN") {
                        thumbnailGradient = "from-red-650 via-rose-600 to-orange-500";
                        emojiSymbol = "🍳";
                      } else if (room.roomId === "PATSANY") {
                        thumbnailGradient = "from-blue-600 via-indigo-600 to-sky-500";
                        emojiSymbol = "💪";
                      } else if (room.roomId === "UPGRADE") {
                        thumbnailGradient = "from-zinc-800 via-stone-700 to-neutral-900";
                        emojiSymbol = "🤖";
                      } else if (room.roomId === "HAUNTED") {
                        thumbnailGradient = "from-[#401257] via-[#241144] to-[#601c80]";
                        emojiSymbol = "👻";
                      } else if (room.roomId === "MONSTER") {
                        thumbnailGradient = "from-pink-600 via-purple-600 to-rose-600";
                        emojiSymbol = "👹";
                      }

                      // Platform detection
                      const isVk = room.videoUrl && room.videoUrl.includes("vk.com");
                      const platformName = isVk ? "VK Видео" : "YouTube";

                      return (
                        <div 
                          key={room.roomId}
                          onClick={() => {
                            if (!nickName.trim()) {
                              setJoinError("Пожалуйста, сначала укажите ваше имя или никнейм");
                              return;
                            }
                            setJoinError("");
                            setJoinCode(room.roomId);
                            setActiveRoomId(room.roomId);
                            setProfileReady(true);
                          }}
                          className="p-3 rounded-2xl bg-[#140e2b]/55 border border-[#3b1c60]/20 hover:border-[#522985]/55 hover:bg-[#181134] transition-all flex items-center justify-between gap-3 w-full cursor-pointer relative group shadow-md"
                        >
                          <div className="flex items-center gap-3 overflow-hidden flex-1">
                            {/* Left Styled Thumbnail */}
                            <div className={`relative w-[110px] sm:w-[125px] h-[64px] sm:h-[72px] rounded-xl overflow-hidden shrink-0 bg-gradient-to-br ${thumbnailGradient} flex items-center justify-center shadow-inner`}>
                              <span className="text-2xl sm:text-3xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-300 select-none">
                                {emojiSymbol}
                              </span>

                              {/* Platform badge in the corner */}
                              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 backdrop-blur-md text-[8px] font-bold text-zinc-100 rounded-md border border-white/5 select-none transform hover:scale-105 transition-transform">
                                {platformName}
                              </span>
                            </div>

                            {/* Title & Info */}
                            <div className="flex flex-col flex-1 min-w-0 pr-1.5 justify-between py-0.5 h-[64px] sm:h-[72px]">
                              <h4 className="text-xs sm:text-sm font-bold text-zinc-100 leading-tight truncate group-hover:text-indigo-300 transition-colors">
                                {room.currentVideoTitle || "Интересное видео"}
                              </h4>
                              
                              {/* Overlapping member avatars list */}
                              {room.members && room.members.length > 0 && (
                                <div className="flex items-center -space-x-1.5 select-none py-0.5">
                                  {room.members.slice(0, 4).map((m: any) => {
                                    const customCol = m.color || "#6366f1";
                                    return (
                                      <div
                                        key={m.id}
                                        title={m.name}
                                        className="relative w-5.5 h-5.5 rounded-full flex items-center justify-center bg-zinc-950 border border-[#130d2a] text-[11px] shadow-sm shrink-0 hover:z-10 hover:-translate-y-0.5 transition-all"
                                      >
                                        <span>{m.avatar || "🍿"}</span>
                                        <span 
                                          className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full border border-zinc-950"
                                          style={{ backgroundColor: customCol }}
                                        />
                                      </div>
                                    );
                                  })}
                                  {room.membersCount > 4 && (
                                    <span className="text-[10px] font-mono text-zinc-500 pl-2 font-bold uppercase select-none">
                                      и другие
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Subtle progress/playback accent bar from Homes design */}
                              <div className="w-11/12 h-1 rounded-full bg-zinc-950 select-none relative overflow-hidden">
                                <div className="h-full bg-white/60 w-1/3 rounded-full group-hover:w-2/3 transition-all duration-700" />
                              </div>
                            </div>
                          </div>

                          {/* Red bubble extra member indicator on the right */}
                          {room.membersCount > 1 && (
                            <div className="bg-[#cc113c] text-white font-extrabold text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full shadow-[0_3px_10px_rgba(204,17,60,0.35)] shrink-0 select-none flex items-center justify-center min-w-[28px] animate-pulse mr-1">
                              +{room.membersCount - 1}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Absolute Floating Action Button (FAB) at bottom-right corner of the screen */}
                <button
                  type="button"
                  onClick={() => {
                    if (!nickName.trim()) {
                      setJoinError("Пожалуйста, сначала укажите ваше имя или никнейм");
                      return;
                    }
                    setJoinError("");
                    setIsLobbyMediaModalOpen(true);
                  }}
                  className="absolute bottom-6 right-6 w-14 h-14 bg-white hover:bg-zinc-100 text-zinc-950 rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(255,255,255,0.32)] hover:scale-105 active:scale-95 cursor-pointer transition-all z-20"
                  title="Выбрать медиаплощадку и создать комнату"
                >
                  <Plus className="w-8 h-8 stroke-[3.5] text-zinc-950" />
                </button>
              </div>
            </motion.div>
          ) : (
            
            // ACTIVE SYNCHRONIZED ROOM VIEW
            <motion.div
              key="room-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 pb-20 lg:pb-0"
            >
              
              {/* Back button inside main room view */}
              <div className="flex items-center">
                <button
                  onClick={handleExitRoom}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/25 hover:border-indigo-500/45 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer select-none transition-all group shadow-lg"
                  id="inner-room-back-button"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  <span>Назад к списку комнат</span>
                </button>
              </div>
              
              {/* Quick Status Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Комната:</span>
                    <span className="text-zinc-200 font-mono text-xs font-bold bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/20 rounded-md">
                      {activeRoomId}
                    </span>
                    <button
                      id="copy-status-invite-link-btn"
                      onClick={handleCopyInviteLink}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                        copiedLocal
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-indigo-600/10 hover:bg-indigo-600/20 border-indigo-500/20 text-indigo-400 hover:text-indigo-300"
                      }`}
                      title="Скопировать ссылку для совместного просмотра"
                    >
                      {copiedLocal ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Ссылка скопирована!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Скопировать ссылку</span>
                        </>
                      )}
                    </button>
                  </div>
                  {roomState && (
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Создатель: {(Object.values(roomState.members) as RoomMember[]).find((m) => m.isHost)?.name || "Неизвестно"}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-zinc-950 px-2.5 py-1 rounded-xl border border-zinc-850">
                    <span className="relative flex h-2 w-2">
                      {wsStatus === "connected" && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        wsStatus === "connected"
                          ? "bg-emerald-500"
                          : wsStatus === "connecting"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-rose-500"
                      }`} />
                    </span>
                    <span className="text-[10px] font-extrabold font-mono text-zinc-400 select-none tracking-wider">
                      {wsStatus === "connected"
                        ? "СЕТЬ"
                        : wsStatus === "connecting"
                        ? "ПОДКЛЮЧЕНИЕ"
                        : "СБОЙ"}
                    </span>
                  </div>
                  
                  {wsStatus !== "connected" && (
                    <button
                      id="reconnect-ws-btn"
                      onClick={() => window.location.reload()}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Переподключиться"
                    >
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    </button>
                  )}

                  {/* Leave Room Button */}
                  <button
                    id="status-leave-room-btn"
                    onClick={handleExitRoom}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 hover:text-rose-400 border border-rose-500/20 hover:border-rose-500/35 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md select-none"
                    title="Выйти из комнаты"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Выйти</span>
                  </button>
                </div>
              </div>

              {/* Grid with Player + Controls (Left, takes 75%) and Chat (Right, takes 25%) */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                
                {/* Visual Video Stream area (takes 75% on desktop/laptops - lg:col-span-3) */}
                <div className="lg:col-span-3 space-y-6">
                  {roomState ? (
                    <YoutubePlayer
                      videoId={roomState.videoId}
                      videoUrl={roomState.videoUrl}
                      provider={roomState.provider}
                      playing={roomState.playing}
                      currentTime={roomState.currentTime}
                      onPlaybackChange={handlePlaybackChange}
                      onSeek={handleSeek}
                      onHeartbeat={handleHeartbeat}
                      remoteEvent={remoteEvent}
                      isHost={(roomState.members[currentUserId]?.isHost ?? false) || (roomState.anyoneCanControl ?? true)}
                    />
                  ) : (
                    <div className="w-full aspect-video rounded-2xl bg-zinc-900 border border-zinc-805 flex flex-col items-center justify-center p-6 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500 border-zinc-800 mb-2"></div>
                      <p className="text-xs text-zinc-400 font-medium">Запрос параметров синхронизации...</p>
                    </div>
                  )}

                  {/* Room Dashboard widget: manage link, watch members */}
                  {roomState && (
                    <RoomDashboard
                      roomId={activeRoomId}
                      members={roomState.members}
                      currentUserId={currentUserId}
                      videoUrl={roomState.videoUrl}
                      onChangeVideo={handleChangeVideo}
                      isPublic={roomState.isPublic ?? true}
                      onTogglePrivacy={handleTogglePrivacy}
                      onToggleMic={handleToggleMic}
                      onRemoteToggleMic={handleRemoteToggleMic}
                      onMuteMember={handleMuteMember}
                      onKickMember={handleKickMember}
                      onMuteAllMics={handleMuteAllMics}
                      allMuted={roomState.allMuted ?? false}
                      anyoneCanControl={roomState.anyoneCanControl ?? true}
                      onToggleControlSharing={handleToggleControlSharing}
                      userProfile={lobbyUserProfile}
                      onLeaveRoom={handleExitRoom}
                    />
                  )}
                </div>

                {/* Right Area: Sidebar Interactive Chat drawer (takes 25% on desktop/laptops) */}
                <div className="hidden lg:block lg:col-span-1 h-full min-h-[450px] landscape-chat-hidden">
                  {roomState ? (
                    <Chat
                      chatHistory={roomState.chatHistory}
                      currentUserId={currentUserId}
                      onSendMessage={handleSendMessage}
                      onReactMessage={handleReactMessage}
                    />
                  ) : (
                    <div className="h-full min-h-[450px] bg-zinc-900/40 border border-zinc-800 rounded-2xl flex items-center justify-center">
                      <p className="text-xs text-zinc-500">Загрузка сообщений...</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Mobile Sliding Drawers & Sticky Nav Bar inside AnimatePresence for < lg */}
              <div className="lg:hidden">
                {/* Floating buttons for short landscape screens to toggle mobile chat/members */}
                <div className="hidden landscape:flex fixed bottom-[5vh] right-[4vw] flex-col gap-3 z-40">
                  <button
                    onClick={() => {
                      setIsMobileChatOpen(true);
                      setIsMobileMembersOpen(false);
                    }}
                    className="relative w-11 h-11 rounded-xl bg-indigo-600/95 hover:bg-indigo-550 text-white shadow-lg flex items-center justify-center cursor-pointer border border-indigo-500/30 transition-all active:scale-95"
                    title="Открыть чат"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {roomState && roomState.chatHistory.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[14px] text-center select-none scale-75">
                        {roomState.chatHistory.filter(m => m.type !== "system").length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setIsMobileMembersOpen(true);
                    }}
                    className="w-11 h-11 rounded-xl bg-zinc-900/95 hover:bg-zinc-850 text-zinc-200 shadow-lg flex items-center justify-center cursor-pointer border border-zinc-800 transition-all active:scale-95"
                    title="Участники комнаты"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                </div>

                {/* Bottom Bar Selector */}
                <div className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-900 z-40 flex items-center justify-around px-4 landscape:hidden">
                  {/* Chat Toggle */}
                  <button
                    id="mobile-chat-toggle-btn"
                    onClick={() => {
                      setIsMobileChatOpen(true);
                      setIsMobileMembersOpen(false);
                    }}
                    className="relative flex flex-col items-center justify-center text-zinc-400 hover:text-indigo-400 h-11 px-3 min-w-[44px] cursor-pointer"
                    title="Открыть чат комнаты"
                  >
                    <div className="relative">
                      <MessageSquare className="w-5 h-5" />
                      {roomState && roomState.chatHistory.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center select-none scale-90">
                          {roomState.chatHistory.filter(m => m.type !== "system").length}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold mt-1">Чат</span>
                  </button>

                  {/* Members Toggle */}
                  <button
                    id="mobile-members-toggle-btn"
                    onClick={() => {
                      setIsMobileMembersOpen(true);
                    }}
                    className="flex flex-col items-center justify-center text-zinc-400 hover:text-indigo-400 h-11 px-3 min-w-[44px] cursor-pointer"
                    title="Список участников"
                  >
                    <div className="flex items-center gap-1">
                      <Users className="w-5 h-5" />
                      {roomState && (
                        <span className="bg-zinc-805 text-zinc-350 text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono scale-90">
                          {Object.keys(roomState.members).length}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold mt-1">Участники</span>
                  </button>

                  {/* Cabinet Toggle */}
                  <button
                    id="mobile-cabinet-toggle-btn"
                    onClick={() => setIsCabinetOpen(true)}
                    className="flex flex-col items-center justify-center text-zinc-400 hover:text-indigo-400 h-11 px-3 min-w-[44px] cursor-pointer"
                    title="Профиль аккаунта"
                  >
                    <Avatar src={selectedAvatar} className="w-5 h-5 rounded-md text-xs" fallback="🍿" />
                    <span className="text-[10px] font-semibold mt-1">Профиль</span>
                  </button>

                  {/* Leave Room Toggle */}
                  <button
                    id="mobile-leave-room-btn"
                    onClick={handleExitRoom}
                    className="flex flex-col items-center justify-center text-rose-500 hover:text-rose-400 h-11 px-3 min-w-[44px] cursor-pointer"
                    title="Выйти из комнаты"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-[10px] font-semibold mt-1">Выйти</span>
                  </button>
                </div>

                {/* Mobile Chat Sliding Drawer (from right) */}
                <AnimatePresence>
                  {isMobileChatOpen && roomState && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                      {/* Dark overlay backdrop */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileChatOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                      />
                      
                      {/* Sliding drawer card */}
                      <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 220 }}
                        className="relative w-[85vw] sm:w-[380px] max-w-full h-full bg-zinc-950 border-l border-zinc-900 shadow-2xl flex flex-col z-50"
                      >
                        <div className="p-4 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4.5 h-4.5 text-indigo-400" />
                            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-zinc-100">Чат комнаты</h3>
                          </div>
                          <button
                            onClick={() => setIsMobileChatOpen(false)}
                            className="p-2 -mr-2 text-zinc-400 hover:text-zinc-200 text-xs font-semibold cursor-pointer h-10 w-10 flex items-center justify-center rounded-xl hover:bg-zinc-900"
                          >
                            ✕
                          </button>
                        </div>
                        
                        <div className="flex-1 overflow-hidden p-4">
                          <Chat
                            chatHistory={roomState.chatHistory}
                            currentUserId={currentUserId}
                            onSendMessage={handleSendMessage}
                            onReactMessage={handleReactMessage}
                          />
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                {/* Mobile Participants Sliding Drawer (from left) */}
                <AnimatePresence>
                  {isMobileMembersOpen && roomState && (
                    <div className="fixed inset-0 z-50 flex justify-start">
                      {/* Dark overlay backdrop */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileMembersOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                      />
                      
                      {/* Sliding drawer card */}
                      <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "-100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 220 }}
                        className="relative w-[85vw] sm:w-[380px] max-w-full h-full bg-zinc-950 border-r border-zinc-900 shadow-2xl flex flex-col z-50"
                      >
                        <div className="p-4 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="w-4.5 h-4.5 text-indigo-400" />
                            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-zinc-100">Участники комнаты</h3>
                          </div>
                          <button
                            onClick={() => setIsMobileMembersOpen(false)}
                            className="p-2 -mr-2 text-zinc-400 hover:text-zinc-200 text-xs font-semibold cursor-pointer h-10 w-10 flex items-center justify-center rounded-xl hover:bg-zinc-900"
                          >
                            ✕
                          </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                          <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-3">
                            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest leading-none select-none">Пользователи онлайн</span>
                            <span className="text-xs font-bold font-mono text-zinc-405 bg-zinc-900 rounded-full px-2.5 py-0.5">
                              {Object.keys(roomState.members).length}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {roomState && (Object.values(roomState.members) as RoomMember[])
                              .sort((a, b) => b.joinedAt - a.joinedAt)
                              .map((member) => {
                                const isMe = member.id === currentUserId;
                                const isMeHost = roomState.members[currentUserId]?.isHost ?? false;
                                return (
                                  <div
                                    key={member.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/40 border border-zinc-900/80"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="relative">
                                        <Avatar 
                                          src={member.avatar} 
                                          className="w-9 h-9 rounded-full text-base shadow-md border-2" 
                                          style={{ borderColor: member.color || "#4F46E5" }}
                                          fallback="🍿" 
                                        />
                                        {member.micEnabled && (
                                          <span className="absolute bottom-0 right-0 block h-2 border border-zinc-955 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        )}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-zinc-150 flex items-center gap-1.5 flex-wrap">
                                          {member.name} {isMe ? <span className="text-zinc-500 font-normal text-[10px]">(Вы)</span> : ""}
                                          
                                          {member.micEnabled ? (
                                            <Mic className="w-3 h-3 text-emerald-450 shrink-0" />
                                          ) : member.micBlockedByHost ? (
                                            <MicOff className="w-3 h-3 text-rose-500 shrink-0" />
                                          ) : null}
                                        </span>
                                        <span className="text-[9px] text-zinc-500 font-mono">
                                          Вошёл {new Date(member.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {currentUser && member.uid && member.uid !== currentUser.uid && (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleFriend(member.uid!)}
                                          title={currentUserFriends.includes(member.uid) ? "Убрать из друзей" : "Добавить в друзья"}
                                          className={`p-1 rounded-lg cursor-pointer transition-colors border ${
                                            currentUserFriends.includes(member.uid)
                                              ? "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 shadow-sm"
                                              : "bg-zinc-950 text-zinc-500 border-zinc-850 hover:text-zinc-350 hover:border-zinc-805"
                                          }`}
                                        >
                                          <Star className="w-3.5 h-3.5 fill-current" style={{ fillOpacity: currentUserFriends.includes(member.uid) ? 1 : 0 }} />
                                        </button>
                                      )}

                                      {member.isHost ? (
                                        <span className="text-[9px] font-display font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-md tracking-wider">
                                          👑 СОЗДАТЕЛЬ
                                        </span>
                                      ) : (
                                        isMeHost && (
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handleMuteMember?.(member.id, !member.micBlockedByHost)}
                                              className={`p-1 rounded-lg transition-colors cursor-pointer border ${
                                                member.micBlockedByHost
                                                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/15"
                                                  : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-405 border-rose-500/15"
                                              }`}
                                            >
                                              {member.micBlockedByHost ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                                            </button>
                                            
                                            <button
                                              type="button"
                                              onClick={() => handleKickMember?.(member.id)}
                                              className="p-1 rounded-lg bg-zinc-950 border border-zinc-850 hover:bg-rose-950 hover:text-rose-400 text-zinc-400 transition-colors cursor-pointer"
                                            >
                                              <UserMinus className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>

                          {/* Invitation & Friends section */}
                          {!currentUser ? (
                            <div className="bg-zinc-900/30 border border-zinc-900/60 rounded-xl p-4 text-center mt-6">
                              <Sparkles className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
                              <h4 className="text-xs font-bold text-zinc-350">Приглашайте недавних зрителей</h4>
                              <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                                Войдите в аккаунт, чтобы сохранять список людей, с которыми были в комнатах, и приглашать их кнопкой в один клик!
                              </p>
                            </div>
                          ) : (
                            <div className="mt-6 pt-5 border-t border-zinc-900/45 space-y-4">
                              <div className="flex items-center justify-between pb-1">
                                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest leading-none select-none">Недавние зрители</span>
                                <span className="text-xs font-bold font-mono text-indigo-401 bg-indigo-500/10 rounded-full px-2.5 py-0.5">
                                  {pastRoomPartners.length}
                                </span>
                              </div>

                              {pastRoomPartners.length === 0 ? (
                                <div className="text-center py-5 px-3 rounded-xl bg-zinc-900/20 border border-zinc-900/40">
                                  <p className="text-[10px] text-zinc-550">Вы пока не были в залах с другими вошедшими в аккаунт пользователями.</p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {pastRoomPartners.map((partner) => {
                                    const isAlreadyInRoom = Object.values(roomState.members).some(
                                      (m: any) => m.uid === partner.uid
                                    );
                                    const isFriend = currentUserFriends.includes(partner.uid);
                                    const status = invitingStatus[partner.uid] || "idle";

                                    return (
                                      <div
                                        key={partner.uid}
                                        className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-904/40 border border-zinc-900/60"
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div className="relative shrink-0">
                                            <Avatar 
                                              src={partner.avatar} 
                                              className="w-8 h-8 rounded-full text-sm shadow border" 
                                              style={{ borderColor: partner.color || "#4F46E5" }}
                                              fallback="🍿" 
                                            />
                                            {isFriend && (
                                              <span className="absolute -top-1 -right-0.5 block text-[10px] text-amber-400">★</span>
                                            )}
                                          </div>
                                          <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-semibold text-zinc-250 truncate leading-snug">
                                              {partner.displayName}
                                            </span>
                                            <span className="text-[9px] text-zinc-500">
                                              {isFriend ? "Друг • " : ""}Был {new Date(partner.sharedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          {/* Friend stars toggle */}
                                          <button
                                            type="button"
                                            onClick={() => handleToggleFriend(partner.uid)}
                                            className={`p-1 rounded-lg cursor-pointer transition-colors border ${
                                              isFriend
                                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                                                : "bg-zinc-950 text-zinc-600 border-zinc-900 hover:text-zinc-400 hover:border-zinc-800"
                                            }`}
                                            title={isFriend ? "Удалить из друзей" : "Добавить в друзья"}
                                          >
                                            <Star className="w-3 h-3 fill-current" style={{ fillOpacity: isFriend ? 1 : 0 }} />
                                          </button>

                                          {isAlreadyInRoom ? (
                                            <span className="text-[9px] font-semibold text-zinc-500 bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-lg">
                                              В зале
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              disabled={status === "loading" || status === "private"}
                                              onClick={() => sendInvitation(partner)}
                                              className={`py-1 px-2 rounded-lg text-[9px] font-bold tracking-wider cursor-pointer transition-all border ${
                                                status === "success"
                                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                                                  : status === "loading"
                                                  ? "bg-indigo-600/10 text-indigo-400 border-indigo-500/30 animate-pulse"
                                                  : status === "private"
                                                  ? "bg-rose-500/5 text-rose-400/70 border-rose-500/15 cursor-not-allowed"
                                                  : status === "error"
                                                  ? "bg-rose-600/10 text-rose-450 border-rose-500/30"
                                                  : "bg-indigo-650 border-indigo-650 hover:bg-indigo-600 text-white hover:border-indigo-600 shadow"
                                              }`}
                                            >
                                              {status === "success"
                                                ? "Отправлено"
                                                : status === "loading"
                                                ? "Отправка..."
                                                : status === "private"
                                                ? "Ограничено"
                                                : status === "error"
                                                ? "Ошибка"
                                                : "Пригласить"}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* User Cabinet sidebar drawer panel */}
      <UserCabinet
        isOpen={isCabinetOpen}
        onClose={() => setIsCabinetOpen(false)}
        onProfileSynced={handleProfileSynced}
        onNavigateToRoom={(rid) => {
          setActiveRoomId(rid);
          setProfileReady(true);
          setIsCabinetOpen(false);
        }}
        currentRoomId={activeRoomId}
        currentVideoInfo={roomState ? { 
          url: roomState.videoUrl, 
          title: (() => {
            const known = VIDEO_CATALOGUE.find(v => v.url === roomState.videoUrl);
            if (known) return known.title;
            if (roomState.videoUrl.includes("a50qT9bW_T0")) return "Иван Васильевич меняет профессию";
            if (roomState.videoUrl.includes("1stL8U6K2_0")) return "Операция «Ы» и другие приключения Шурика";
            if (roomState.videoUrl.includes("456239149")) return "VK Fest: Главное Шоу и Выступления";
            try {
              const host = new URL(roomState.videoUrl).hostname;
              return `Видео из ${host}`;
            } catch (e) {
              return "Пользовательское видео";
            }
          })(),
          membersCount: Object.keys(roomState.members).length,
          duration: (() => {
            const known = VIDEO_CATALOGUE.find(v => v.url === roomState.videoUrl);
            return known ? known.duration : "0:15:00";
          })()
        } : undefined}
        AVATAR_PRESETS={AVATAR_PRESETS}
        COLOR_PRESETS={COLOR_PRESETS}
        customServerType={customServerType}
        setCustomServerType={setCustomServerType}
        customServerAddress={customServerAddress}
        setCustomServerAddress={setCustomServerAddress}
        isDayMode={isDayMode}
        setIsDayMode={setIsDayMode}
        acidTheme={acidTheme}
        setAcidTheme={setAcidTheme}
      />

      {/* Fullscreen Homes-style Lobby MediaCenter Popup Modal */}
      <AnimatePresence>
        {isLobbyMediaModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0e071f] border border-[#3b1f5c]/50 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] p-5 scrollbar-none"
            >
              <button
                type="button"
                onClick={() => setIsLobbyMediaModalOpen(false)}
                className="absolute top-4 right-4 z-50 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 text-xs font-bold text-zinc-350 hover:text-white rounded-xl shadow transition-colors cursor-pointer select-none"
              >
                ✕ Закрыть
              </button>
              
              <div className="mt-8">
                <HomesPlatformsGrid
                  userProfile={lobbyUserProfile}
                  onSelectVideo={(url) => {
                    if (!nickName.trim()) {
                      setJoinError("Пожалуйста, сначала укажите ваше имя или никнейм");
                      setIsLobbyMediaModalOpen(false);
                      return;
                    }
                    setJoinError("");
                    setPendingVideoUrl(url);
                    setIsLobbyMediaModalOpen(false);
                    // Trigger automatic room creation
                    handleCreateRoom();
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("dev") === "true" && (
        <>
          <SyncTvDashboard
            isOpen={isSyncTvOpen}
            onClose={() => setIsSyncTvOpen(false)}
          />

          {/* Floating Developer SyncTV Console Trigger button */}
          <button
            onClick={() => setIsSyncTvOpen(true)}
            className="fixed bottom-6 left-6 z-40 bg-zinc-950/90 border border-indigo-500/30 hover:border-indigo-400 text-indigo-400 hover:text-indigo-300 font-bold text-[11px] uppercase tracking-wider rounded-2xl py-2.5 px-4 shadow-xl shadow-indigo-950/30 backdrop-blur-md flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.03] group"
          >
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse group-hover:bg-indigo-400" />
            <span>SyncTV Консоль</span>
          </button>
        </>
      )}

    </div>
  );
}
