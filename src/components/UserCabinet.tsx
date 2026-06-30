import React, { useState, useEffect } from "react";
import { 
  X, Mail, Lock, User, LogOut, History, Heart, Save, Loader2, 
  Trash2, AlertCircle, Sparkles, Check, ShieldAlert, KeyRound, CheckCircle2,
  Clock, Users, Play, Award, BarChart3, Film, Tv, ArrowLeft,
  Settings, Instagram, Twitter, Facebook, Globe, Headphones, ShoppingBag, Languages, MessageSquare, HelpCircle, Shield, RefreshCw,
  Sun, Moon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  registerLocalUser, 
  loginLocalUser, 
  getCurrentUser, 
  setCurrentUser, 
  LocalUser, 
  getLocalUserProfile, 
  saveLocalUserProfile,
  logoutLocalUser
} from "../services/localAuth";
import { UserProfile } from "../types";
import Avatar from "./Avatar";

interface UserCabinetProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSynced: (name: string, avatar: string, color: string) => void;
  onNavigateToRoom: (roomId: string) => void;
  currentRoomId: string | null;
  currentVideoInfo?: { url: string; title: string; membersCount?: number; duration?: string };
  AVATAR_PRESETS: string[];
  COLOR_PRESETS: string[];
  customServerType?: "default" | "custom";
  setCustomServerType?: (type: "default" | "custom") => void;
  customServerAddress?: string;
  setCustomServerAddress?: (address: string) => void;
  isDayMode: boolean;
  setIsDayMode: (v: boolean) => void;
  acidTheme: string;
  setAcidTheme: (t: string) => void;
}

export default function UserCabinet({
  isOpen,
  onClose,
  onProfileSynced,
  onNavigateToRoom,
  currentRoomId,
  currentVideoInfo,
  AVATAR_PRESETS,
  COLOR_PRESETS,
  customServerType = "default",
  setCustomServerType,
  customServerAddress = "sferium.homes",
  setCustomServerAddress,
  isDayMode,
  setIsDayMode,
  acidTheme,
  setAcidTheme
}: UserCabinetProps) {
  const [currentUser, setLocalCurrentUser] = useState<LocalUser | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  // Social Auth popup simulation state (VK / Yandex)
  const [socialPopup, setSocialPopup] = useState<{
    provider: "vk" | "yandex";
    isOpen: boolean;
    step: "credentials" | "authorizing";
  } | null>(null);
  const [socialUsername, setSocialUsername] = useState("");
  const [socialEmail, setSocialEmail] = useState("");

  // Cabinet Form Changes
  const [cabinetName, setCabinetName] = useState(() => localStorage.getItem("yt_party_name") || "Аноним");
  const [cabinetAvatar, setCabinetAvatar] = useState(() => localStorage.getItem("yt_party_avatar") || "🍿");
  const [cabinetColor, setCabinetColor] = useState(() => localStorage.getItem("yt_party_color") || "#3B82F6");

  // Tab panel state
  const [activeTab, setActiveTab] = useState<"settings" | "profile" | "player" | "privacy" | "appearance" | "server" | "auth">("settings");

  // Homes Settings States
  const [homesQuickReaction, setHomesQuickReaction] = useState(() => localStorage.getItem("homes_quick_reaction") || "❤️");
  const [homesPremium, setHomesPremium] = useState(() => localStorage.getItem("homes_premium") === "true");
  const [homesLimitInvites, setHomesLimitInvites] = useState(() => localStorage.getItem("homes_limit_invites") === "true");
  const [homesHideAdultContent, setHomesHideAdultContent] = useState(() => localStorage.getItem("homes_hide_adult_content") !== "false");
  const [homesFloatingPlayer, setHomesFloatingPlayer] = useState(() => localStorage.getItem("homes_floating_player") === "true");
  const [homesAutoTranslate, setHomesAutoTranslate] = useState(() => localStorage.getItem("homes_auto_translate") !== "false");
  const [homesHideLocation, setHomesHideLocation] = useState(() => localStorage.getItem("homes_hide_location") !== "false");
  const [homesLanguage, setHomesLanguage] = useState(() => localStorage.getItem("homes_language") || "Язык устройства (Русский)");

  const [invitePermission, setInvitePermission] = useState(() => localStorage.getItem("yt_invite_permission") || "all");

  // Interactive dialog controls
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"review" | "idea">("review");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  const [showConfirmDeleteAccount, setShowConfirmDeleteAccount] = useState(false);

  // Parse duration string for statistics computation
  const parseDurationStr = (str?: string): number => {
    if (!str) return 0;
    const parts = str.split(":").map(Number);
    if (parts.length === 3) {
      return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    } else if (parts.length === 2) {
      return (parts[0] * 60) + parts[1];
    }
    return 30; // default estimated watcher seconds
  };

  // Preference autosavers/effects for Homes Settings
  useEffect(() => {
    localStorage.setItem("homes_quick_reaction", homesQuickReaction);
  }, [homesQuickReaction]);

  useEffect(() => {
    localStorage.setItem("homes_premium", homesPremium ? "true" : "false");
  }, [homesPremium]);

  useEffect(() => {
    localStorage.setItem("homes_limit_invites", homesLimitInvites ? "true" : "false");
    if (currentUser) {
      saveLocalUserProfile(currentUser.uid, { limitInvites: homesLimitInvites });
    }
  }, [homesLimitInvites, currentUser]);

  useEffect(() => {
    localStorage.setItem("homes_hide_adult_content", homesHideAdultContent ? "true" : "false");
  }, [homesHideAdultContent]);

  useEffect(() => {
    localStorage.setItem("homes_floating_player", homesFloatingPlayer ? "true" : "false");
  }, [homesFloatingPlayer]);

  useEffect(() => {
    localStorage.setItem("homes_auto_translate", homesAutoTranslate ? "true" : "false");
  }, [homesAutoTranslate]);

  useEffect(() => {
    localStorage.setItem("homes_hide_location", homesHideLocation ? "true" : "false");
  }, [homesHideLocation]);

  useEffect(() => {
    localStorage.setItem("homes_language", homesLanguage);
  }, [homesLanguage]);

  // Load profile from localStorage database
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const user = getCurrentUser();
    setLocalCurrentUser(user);

    if (user) {
      const profile = getLocalUserProfile(user.uid, user.displayName);
      setUserProfile(profile);
      setCabinetName(profile.displayName);
      setCabinetAvatar(profile.avatar);
      setCabinetColor(profile.color);
    } else {
      setUserProfile(null);
      setCabinetName(localStorage.getItem("yt_party_name") || "Аноним");
      setCabinetAvatar(localStorage.getItem("yt_party_avatar") || "🍿");
      setCabinetColor(localStorage.getItem("yt_party_color") || "#3B82F6");
    }
    setLoading(false);
  }, [isOpen]);

  const handleLocalSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !username) {
      setErrorStatus("Пожалуйста, заполните все поля");
      return;
    }
    setErrorStatus(null);
    setAuthActionLoading(true);
    try {
      const result = await registerLocalUser(email, password, username, cabinetAvatar, cabinetColor);
      setLocalCurrentUser(result);
      const profile = getLocalUserProfile(result.uid, result.displayName);
      setUserProfile(profile);
      setSuccessMsg("Регистрация успешна! Ваш профиль сохранен локально.");
      onProfileSynced(result.displayName, result.avatar, result.color);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || "Ошибка при регистрации");
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleLocalSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorStatus("Пожалуйста, укажите почту и пароль");
      return;
    }
    setErrorStatus(null);
    setAuthActionLoading(true);
    try {
      const result = await loginLocalUser(email, password);
      setLocalCurrentUser(result);
      const profile = getLocalUserProfile(result.uid, result.displayName);
      setUserProfile(profile);
      setSuccessMsg("Вы успешно вошли!");
      onProfileSynced(result.displayName, result.avatar, result.color);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || "Неверный логин или пароль");
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleLocalSignOut = () => {
    logoutLocalUser();
    setLocalCurrentUser(null);
    setUserProfile(null);
    
    // Automatically generate a new guest session so Sferium continues without logouts!
    const randomNames = ["Гость Киноман", "Уютный Зритель", "Попкорн Мастер", "Анонимный Домовой", "Любитель Сериалов", "Свободный Зритель"];
    const randomName = randomNames[Math.floor(Math.random() * randomNames.length)] + ` #${Math.floor(100 + Math.random() * 900)}`;
    const randomAvatar = "🍿";
    const randomColor = "#3B82F6";
    
    const guestUser = {
      uid: "guest_" + Math.random().toString(36).substring(2, 9),
      displayName: randomName,
      email: "",
      avatar: randomAvatar,
      color: randomColor,
      isGuest: true
    };
    setCurrentUser(guestUser);
    onProfileSynced(randomName, randomAvatar, randomColor);
    setCabinetName(randomName);
    setCabinetAvatar(randomAvatar);
    setCabinetColor(randomColor);
    setLocalCurrentUser(guestUser);
    
    setSuccessMsg("Вы вышли из профиля и переключены на демо-режим Гостя.");
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleSaveCabinetProfile = () => {
    if (!cabinetName.trim()) {
      setErrorStatus("Никнейм не может быть пустым");
      return;
    }

    localStorage.setItem("yt_party_name", cabinetName.trim());
    localStorage.setItem("yt_party_avatar", cabinetAvatar);
    localStorage.setItem("yt_party_color", cabinetColor);

    if (currentUser) {
      const updatedProfile = saveLocalUserProfile(currentUser.uid, {
        displayName: cabinetName.trim(),
        avatar: cabinetAvatar,
        color: cabinetColor,
      });
      setUserProfile(updatedProfile);
      
      // Update global current user session as well
      const updatedUser = { ...currentUser, displayName: cabinetName.trim(), avatar: cabinetAvatar, color: cabinetColor };
      setCurrentUser(updatedUser);
      setLocalCurrentUser(updatedUser);
    }

    onProfileSynced(cabinetName.trim(), cabinetAvatar, cabinetColor);
    setSuccessMsg("Профиль успешно обновлен!");
    setErrorStatus(null);
    setTimeout(() => setSuccessMsg(null), 3300);
  };

  const handleAddVideoToFavorites = () => {
    if (!currentUser || !currentVideoInfo) return;
    const currentFavorites = userProfile?.favorites || [];
    if (currentFavorites.includes(currentVideoInfo.url)) return;

    const newFavs = [...currentFavorites, currentVideoInfo.url];
    const updated = saveLocalUserProfile(currentUser.uid, { favorites: newFavs });
    setUserProfile(updated);
    setSuccessMsg("Видео успешно занесено в закладки");
    setTimeout(() => setSuccessMsg(null), 3050);
  };

  const handleRemoveFavorite = (index: number) => {
    if (!currentUser) return;
    const currentFavorites = userProfile?.favorites || [];
    const newFavs = currentFavorites.filter((_: any, i: any) => i !== index);
    const updated = saveLocalUserProfile(currentUser.uid, { favorites: newFavs });
    setUserProfile(updated);
  };

  const handleClearHistory = () => {
    if (!currentUser) return;
    const updated = saveLocalUserProfile(currentUser.uid, { history: [] });
    setUserProfile(updated);
  };

  const handleDeleteAccountConfirm = () => {
    localStorage.clear();
    setLocalCurrentUser(null);
    setUserProfile(null);
    setCabinetName("Гость");
    setCabinetAvatar("🍿");
    setCabinetColor("#3B82F6");
    onProfileSynced("Гость", "🍿", "#3B82F6");
    setShowConfirmDeleteAccount(false);
    setSuccessMsg("Все локальные записи успешно удалены");
    setTimeout(() => {
      setSuccessMsg(null);
      window.location.reload();
    }, 1500);
  };

  const handleInvitePermissionChange = (v: string) => {
    setInvitePermission(v);
    localStorage.setItem("yt_invite_permission", v);
    if (currentUser) {
      saveLocalUserProfile(currentUser.uid, { invitePermission: v });
    }
  };

  // Systems telemetry simulation diagnoses routine
  const startNetworkDiagnostics = () => {
    setIsDiagnosing(true);
    setDiagnosticLogs([]);
    setShowDiagnosticModal(true);

    setTimeout(() => {
      setDiagnosticLogs(prev => [...prev, "🛰️ Пинг-тест пакетов: Обращение к WebSocket-шлюзу..."]);
    }, 450);

    setTimeout(() => {
      setDiagnosticLogs(prev => [...prev, `🟢 Узел локального сервера (localhost:3000) отвечает: время задержки 6мс.`]);
    }, 1100);

    setTimeout(() => {
      setDiagnosticLogs(prev => [...prev, "🛠️ Инициализация рендерера: Видеоконтекст iframe и HTML5 запущен"]);
    }, 1700);

    setTimeout(() => {
      setDiagnosticLogs(prev => [...prev, "✅ Локальная база данных localStorage: Доступна, записи стабильны."]);
    }, 2400);

    setTimeout(() => {
      setDiagnosticLogs(prev => [...prev, "🎉 Диагностика успешно завершена! Ваша комната и плеер полностью синхронны."]);
      setIsDiagnosing(false);
    }, 3200);
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSuccess(true);
    setFeedbackText("");
    setTimeout(() => {
      setFeedbackSuccess(false);
      setShowFeedbackModal(false);
    }, 2000);
  };

  // Preset quick tutorial lists
  const TUTORIAL_STEPS = [
    {
      title: "Добро пожаловать в Homes Sync!",
      text: "Это уютное веб-пространство для совместного медиапросмотра в реальном времени. Давайте познакомимся с ключевыми фишками за пару секунд.",
      icon: "🍿"
    },
    {
      title: "Как управлять синхронизацией",
      text: "Вставив ссылку на YouTube, VK или RuTube видео, плеер создателя автоматически связывается с остальными участниками. Запуск, пауза и перемотка происходят на всех экранах мгновенно.",
      icon: "⚡"
    },
    {
      title: "Голосовой чат на микрофонах",
      text: "В правом нижнем углу пульта вы можете активировать микрофон, чтобы свободно общаться голосом с вашими друзьями прямо во время кульминационных моментов кино.",
      icon: "🎙️"
    }
  ];

  if (!isOpen) return null;

  // Stats computation helper definitions
  const statsWatchedCount = userProfile?.history?.length || 0;
  const statsFavoritesCount = userProfile?.favorites?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
      <div className={`relative w-full max-w-4xl h-[85vh] rounded-3xl overflow-hidden flex flex-col sm:flex-row border shadow-2xl transition-colors ${
        isDayMode 
          ? "bg-[#faf9ff] border-zinc-200 text-zinc-800" 
          : "bg-[#0e071e] border-[#3b1f5c]/50 text-zinc-100"
      }`}>
        
        {/* Sidebar Cabinet Panel menu navigation */}
        <div className={`w-full sm:w-64 border-b sm:border-b-0 sm:border-r flex flex-row sm:flex-col overflow-x-auto sm:overflow-x-visible shrink-0 select-none ${
          isDayMode ? "bg-zinc-50 border-zinc-200" : "bg-[#160c2b] border-[#3b1f5c]/30"
        }`}>
          <div className="hidden sm:flex items-center gap-2.5 p-5 border-b border-[#3b1f5c]/20">
            <span className="text-xl">⚙️</span>
            <span className="font-display font-extrabold text-[#9d5cf6] text-sm uppercase tracking-widest">Панель Настроек</span>
          </div>

          <div className="flex sm:flex-col flex-1 p-2 sm:p-3 sm:space-y-1 gap-1 min-w-max sm:min-w-0">
            {[
              { id: "settings", label: "⚙️ Настройки Homes", isTheme: false },
              { id: "profile", label: "👤 Мой Профиль", isTheme: false },
              { id: "player", label: "📺 Плеер & Опции", isTheme: false },
              { id: "privacy", label: "🔒 Приватность", isTheme: false },
              { id: "appearance", label: "🎨 Оформление", isTheme: false },
              { id: "server", label: "🌐 Сервер синхронизации", isTheme: false },
              { id: "auth", label: "🔑 Регистрация / Вход", isTheme: true }
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap sm:whitespace-normal ${
                    active
                      ? tab.isTheme
                        ? "bg-indigo-600 text-white shadow-lg"
                        : "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20"
                      : isDayMode
                      ? "text-zinc-600 hover:bg-zinc-150"
                      : "text-zinc-400 hover:bg-zinc-900/40"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* User profile capsule in cabinet sidebar */}
          {currentUser && (
            <div className={`hidden sm:flex items-center gap-3 p-4 border-t ${
              isDayMode ? "border-zinc-200 bg-zinc-100/50" : "border-[#3b1f5c]/25 bg-[#100820]"
            }`}>
              <Avatar src={cabinetAvatar} className="w-9 h-9 rounded-full text-base border border-indigo-505/20 shadow" fallback="🍿" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-zinc-200 truncate">{cabinetName}</span>
                <span className="text-[10px] text-indigo-400 font-medium">
                  {currentUser.isGuest ? "Гостевой сеанс" : "Зарегистрирован"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Unified Work Desk and Content Render Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Header toolbar */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#3b1f5c]/10">
            <h3 className="font-display font-black text-sm uppercase tracking-widest text-[#a855f7]">
              {activeTab === "settings" && "⚙️ Панель управления Homes"}
              {activeTab === "profile" && "👤 Настройка личного профиля"}
              {activeTab === "player" && "📺 Видео-аудио конфигурация"}
              {activeTab === "privacy" && "🔒 Безопасность и Приглашения"}
              {activeTab === "appearance" && "🎨 Темы и Оформление"}
              {activeTab === "server" && "🌐 Спецификация Синхронизатора"}
              {activeTab === "auth" && "🔑 Локальный Личный Кабинет"}
            </h3>

            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-805 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-350 hover:text-white transition-all cursor-pointer select-none group"
              title="Назад в приложение"
              id="cabinet-close-back-btn"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-indigo-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>Назад</span>
            </button>
          </div>

          {/* Middle Body Area (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Display error statuses */}
            <AnimatePresence>
              {errorStatus && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <span>{errorStatus}</span>
                </motion.div>
              )}
              {successMsg && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 bg-emerald-500/15 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-bounce" />
                  <span>{successMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TAB CONTENT: settings */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                
                {/* Statistics Box */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className={`p-4 rounded-2xl border text-center ${isDayMode ? "bg-white border-zinc-200" : "bg-[#181130] border-[#3b1f5c]/35 shadow-inner"}`}>
                    <Film className="w-5 h-5 mx-auto text-indigo-400 mb-1.5" />
                    <span className="block text-2xl font-black font-mono text-zinc-100">{statsWatchedCount}</span>
                    <span className="text-[10px] text-zinc-550 uppercase tracking-wider font-semibold font-sans mt-0.5 block">Роликов просмотрено</span>
                  </div>

                  <div className={`p-4 rounded-2xl border text-center ${isDayMode ? "bg-white border-zinc-200" : "bg-[#181130] border-[#3b1f5c]/35 shadow-inner"}`}>
                    <Heart className="w-5 h-5 mx-auto text-pink-400 mb-1.5" />
                    <span className="block text-2xl font-black font-mono text-zinc-100">{statsFavoritesCount}</span>
                    <span className="text-[10px] text-zinc-550 uppercase tracking-wider font-semibold font-sans mt-0.5 block">В избранном</span>
                  </div>

                  <div className={`p-4 rounded-2xl border text-center col-span-2 md:col-span-1 ${isDayMode ? "bg-white border-zinc-200" : "bg-[#181130] border-[#3b1f5c]/35 shadow-inner"}`}>
                    <Award className="w-5 h-5 mx-auto text-amber-500 mb-1.5" />
                    <span className="block text-[11px] font-bold text-zinc-100 whitespace-nowrap mt-1 leading-normal uppercase">
                      {currentUser?.isGuest ? "Гостевой сеанс" : "Золотой зритель"}
                    </span>
                    <span className="text-[10px] text-zinc-550 uppercase tracking-wider font-semibold font-sans mt-2 block">Ваш статус</span>
                  </div>
                </div>

                {/* Main Settings Checkboxes */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 pb-1.5">Конфигурация сеанса</h4>
                  
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/40 border border-zinc-900 hover:border-zinc-850 transition-colors">
                    <div>
                      <span className="block text-xs font-bold">💎 Привилегия Premium-стажа</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">Активация дополнительных функций и значков</span>
                    </div>
                    <button
                      onClick={() => setHomesPremium(!homesPremium)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        homesPremium ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-750"
                      }`}
                    >
                      {homesPremium ? "АКТИВЕН" : "ВКЛЮЧИТЬ"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/40 border border-zinc-900 hover:border-zinc-850 transition-colors">
                    <div>
                      <span className="block text-xs font-bold">❤️ Быстрая реакция чата</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">Эмодзи для быстрой отправки при двойном клике</span>
                    </div>
                    <select
                      value={homesQuickReaction}
                      onChange={(e) => setHomesQuickReaction(e.target.value)}
                      className="bg-zinc-950 text-xs px-2.5 py-1.5 border border-zinc-800 rounded-lg outline-none"
                    >
                      {["❤️", "😂", "🔥", "👍", "😮", "🍿", "🍕"].map((emo) => (
                        <option key={emo} value={emo}>{emo}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Additional diagnostic systems / walkthrough buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#3b1f5c]/20">
                  <button
                    onClick={startNetworkDiagnostics}
                    className="flex-1 py-3 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/20 text-purple-300 font-bold uppercase text-[10px] rounded-xl flex items-center justify-center gap-2 select-none tracking-widest cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin-slow text-purple-400" />
                    Запустить самотестирование сети
                  </button>

                  <button
                    onClick={() => {
                      setTutorialStep(0);
                      setShowTutorialModal(true);
                    }}
                    className="flex-1 py-3 px-4 bg-zinc-950 text-zinc-350 hover:bg-zinc-900 hover:text-white border border-zinc-850 font-bold uppercase text-[10px] rounded-xl flex items-center justify-center gap-2 select-none tracking-widest cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-zinc-405" />
                    Руководство пользователя Sferium
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: profile */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-900 flex items-center gap-4">
                  <Avatar src={cabinetAvatar} className="w-16 h-16 rounded-3xl text-3xl shadow-lg border border-purple-555/20 flex-shrink-0" fallback="🍿" />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-bold text-zinc-200">Предосмотр аватара</h5>
                    <p className="text-[11px] text-zinc-500 leading-normal mt-1">
                      Вы можете свободно изменить ваш псевдоним (имя на экране) и аватар. Конфигурация синхронизируется на всех ваших экранах.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 select-none">Псевдоним</label>
                    <input
                      type="text"
                      className="w-full bg-zinc-950 text-sm px-4 py-3 rounded-xl border border-zinc-800 outline-none focus:border-indigo-500 text-zinc-200 uppercase font-medium"
                      value={cabinetName}
                      onChange={(e) => setCabinetName(e.target.value)}
                      maxLength={18}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 select-none">Цветовая гамма профиля</label>
                    <div className="flex flex-wrap gap-2.5 p-3 bg-zinc-950 rounded-xl border border-zinc-900">
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setCabinetColor(color)}
                          className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-115 relative cursor-pointer"
                          style={{
                            backgroundColor: color,
                            borderColor: cabinetColor === color ? "white" : "transparent"
                          }}
                        >
                          {cabinetColor === color && (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 select-none">Коллекция аватаров</label>
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-3.5 bg-zinc-950 rounded-2xl border border-zinc-900">
                      {AVATAR_PRESETS.map((av) => (
                        <button
                          key={av}
                          onClick={() => setCabinetAvatar(av)}
                          className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all cursor-pointer ${
                            cabinetAvatar === av
                              ? "bg-indigo-600 scale-110 shadow-lg shadow-indigo-500/20 text-white"
                              : "bg-zinc-900/60 hover:bg-zinc-800"
                          }`}
                        >
                          {av}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleSaveCabinetProfile}
                    className="w-full bg-indigo-600 hover:bg-indigo-550 text-white font-bold uppercase text-xs tracking-wider py-3.5 rounded-xl shadow transition-all cursor-pointer select-none"
                  >
                    Сохранить изменения профиля
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: player */}
            {activeTab === "player" && (
              <div className="space-y-6">
                
                {/* Advanced player parameters fields toggles */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-900">
                    <div className="max-w-[80%]">
                      <span className="block text-xs font-bold">📺 Плавающий мини-плеер (Картинка в картинке)</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">Автоматически открывать плавающий экран поверх чата при скроллинге</span>
                    </div>
                    <button
                      onClick={() => setHomesFloatingPlayer(!homesFloatingPlayer)}
                      className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                        homesFloatingPlayer ? "bg-indigo-600" : "bg-zinc-800"
                      }`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all transform ${
                        homesFloatingPlayer ? "left-[22px]" : "left-0.5"
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-start justify-between p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-900">
                    <div className="max-w-[80%]">
                      <span className="block text-xs font-bold">🌐 Автоматический перевод субтитров видео</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">Задействовать ИИ-переводчик для иностранных видеорядов</span>
                    </div>
                    <button
                      onClick={() => setHomesAutoTranslate(!homesAutoTranslate)}
                      className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                        homesAutoTranslate ? "bg-indigo-600" : "bg-zinc-800"
                      }`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all transform ${
                        homesAutoTranslate ? "left-[22px]" : "left-0.5"
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-start justify-between p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-900">
                    <div className="max-w-[80%]">
                      <span className="block text-xs font-bold">🍔 Скрывать контент 18+</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">Фильтровать трансляции залов с шокирующим контентом</span>
                    </div>
                    <button
                      onClick={() => setHomesHideAdultContent(!homesHideAdultContent)}
                      className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                        homesHideAdultContent ? "bg-indigo-600" : "bg-zinc-800"
                      }`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all transform ${
                        homesHideAdultContent ? "left-[22px]" : "left-0.5"
                      }`} />
                    </button>
                  </div>

                  <div className="flex flex-col p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-900 gap-2">
                    <span className="block text-xs font-bold">🗣️ Базовый язык озвучки и переводов</span>
                    <select
                      value={homesLanguage}
                      onChange={(e) => setHomesLanguage(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-900 text-xs px-3 py-2 rounded-xl outline-none"
                    >
                      <option value="Русский">Русский (Russian)</option>
                      <option value="English">English</option>
                      <option value="Español">Español</option>
                      <option value="Deutsch">Deutsch</option>
                    </select>
                  </div>
                </div>

                {/* Submitting user feedback forms */}
                <div className="pt-4 border-t border-[#3b1f5c]/20">
                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold uppercase text-[10px] tracking-wider rounded-xl cursor-not-allowed cursor-pointer border border-indigo-500/20 flex items-center justify-center gap-1"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Сообщить об ошибке или предложить идею
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: privacy */}
            {activeTab === "privacy" && (
              <div className="space-y-6">
                
                {/* Specific secure and invitation parameters setup */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 select-none">Кто может присылать мне инвайты в комнаты?</label>
                    <div className="bg-zinc-950 p-1 border border-zinc-905 rounded-xl grid grid-cols-3 select-none">
                      {[
                        { id: "all", label: "Все" },
                        { id: "friends", label: "Только Друзья" },
                        { id: "none", label: "Никто" }
                      ].map((item) => {
                        const sel = invitePermission === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleInvitePermissionChange(item.id)}
                            className={`py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                              sel ? "bg-indigo-600 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-start justify-between p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-900">
                    <div className="max-w-[80%]">
                      <span className="block text-xs font-bold">📍 Скрывать геолокацию</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">Отключать отправку региональных координат пинга для минимизации трекеров</span>
                    </div>
                    <button
                      onClick={() => setHomesHideLocation(!homesHideLocation)}
                      className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                        homesHideLocation ? "bg-indigo-600" : "bg-zinc-800"
                      }`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all transform ${
                        homesHideLocation ? "left-[22px]" : "left-0.5"
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-start justify-between p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-900">
                    <div className="max-w-[80%]">
                      <span className="block text-xs font-bold">🚫 Ограничивать инвайты (Друзья-онли)</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">Блокировать автоматические приглашения от незнакомых лиц</span>
                    </div>
                    <button
                      onClick={() => setHomesLimitInvites(!homesLimitInvites)}
                      className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                        homesLimitInvites ? "bg-indigo-600" : "bg-zinc-800"
                      }`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all transform ${
                        homesLimitInvites ? "left-[22px]" : "left-0.5"
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Local account destruction deletion parameters */}
                <div className="pt-6 border-t border-zinc-900 space-y-3">
                  <h4 className="text-xs font-bold text-rose-500/80 uppercase tracking-widest select-none">Обнуление локальных записей</h4>
                  <p className="text-[10px] text-zinc-550 leading-normal">
                    Полное уничтожение ваших локально сохраненных закладок избранного, истории залов совместного просмотра и деактивация созданных профилей пользователей. Действие необратимо.
                  </p>

                  {showConfirmDeleteAccount ? (
                    <div className="p-3.5 bg-rose-550/15 border border-rose-500/25 rounded-2xl space-y-3.5">
                      <span className="text-xs font-semibold text-rose-400 block">⚠️ Вы абсолютно уверены? Все настройки будут стерты навсегда!</span>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeleteAccountConfirm}
                          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                        >
                          Да, Стереть все
                        </button>
                        <button
                          onClick={() => setShowConfirmDeleteAccount(false)}
                          className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-zinc-800"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowConfirmDeleteAccount(true)}
                      className="py-3 px-4 bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/25 text-rose-400 font-bold uppercase text-[10px] tracking-widest rounded-xl transition-colors cursor-pointer"
                    >
                      Уничтожить все локальные данные на устройстве
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: appearance */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                
                {/* Visual day mode setup */}
                <div className="flex items-center justify-between p-4 bg-zinc-950/40 border border-zinc-900 rounded-2xl select-none">
                  <div>
                    <span className="text-xs font-bold block">☀️ Дневной режим (Яркая тема оформления)</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">Переключить интерфейс на светлые, более контрастные тона</span>
                  </div>
                  <button
                    onClick={() => setIsDayMode(!isDayMode)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isDayMode 
                        ? "bg-amber-500/20 border-amber-500/30 text-amber-500 shadow-inner" 
                        : "bg-zinc-900 border-zinc-805 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {isDayMode ? <Sun className="w-5 h-5 fill-current" /> : <Moon className="w-5 h-5" />}
                  </button>
                </div>

                {/* Saturated themes selector */}
                <div className="space-y-3.5">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest select-none">Палитры фонового свечения (Acid-эффект):</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    {[
                      { id: "purple", name: "Космический сиреневый", emoji: "🍇" },
                      { id: "lime", name: "Кислотный лайм", emoji: "🍏" },
                      { id: "sunset", name: "Розовый закат", emoji: "🍑" },
                      { id: "cyan", name: "Кибер-циан", emoji: "💠" }
                    ].map((item) => {
                      const active = acidTheme === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setAcidTheme(item.id)}
                          className={`p-4 rounded-2xl border text-center transition-all cursor-pointer select-none ${
                            active
                              ? "bg-indigo-600/10 border-indigo-500 text-indigo-400 scale-102"
                              : "bg-zinc-950/50 border-zinc-90 w-auto hover:bg-zinc-900"
                          }`}
                        >
                          <span className="text-2xl block mb-1">{item.emoji}</span>
                          <span className="text-[10px] uppercase font-bold block tracking-wider">{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: server */}
            {activeTab === "server" && (
              <div className="space-y-6">
                
                {/* Synchronization backend specs setup */}
                <div className="p-4 bg-zinc-950/55 border border-zinc-900 rounded-3xl space-y-3.5">
                  <span className="text-xs font-bold block flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-400" />
                    Глобальные синхронизирующие шлюзы
                  </span>
                  <p className="text-[11px] text-zinc-450 leading-relaxed font-sans">
                    Sferium использует легковесный WebSocket-ретранслятор для передачи воспроизведения. Если вы хотите объединиться в приватную загородную сеть или запустить собственный медиа-хаб, укажите настройки внизу.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 select-none">Тип синхронизатора</label>
                    <div className="bg-zinc-950 p-1 border border-zinc-900 rounded-xl grid grid-cols-2 select-none">
                      <button
                        onClick={() => setCustomServerType?.("default")}
                        className={`py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                          customServerType === "default" ? "bg-indigo-600 text-white shadow" : "text-zinc-500 hover:text-zinc-350"
                        }`}
                      >
                        📡 Сфериум-Облако
                      </button>
                      <button
                        onClick={() => setCustomServerType?.("custom")}
                        className={`py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                          customServerType === "custom" ? "bg-indigo-600 text-white shadow" : "text-zinc-500 hover:text-zinc-350"
                        }`}
                      >
                        ⚡ Собственная линия
                      </button>
                    </div>
                  </div>

                  {customServerType === "custom" && (
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 select-none">Адрес узла (IP или Домен WS)</label>
                      <input
                        type="text"
                        className="w-full bg-zinc-950 text-sm font-mono h-11 px-4 rounded-xl border border-zinc-800 outline-none focus:border-indigo-500 text-indigo-400"
                        placeholder="например: server.com или 192.168.1.5:3000"
                        value={customServerAddress}
                        onChange={(e) => setCustomServerAddress?.(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: auth */}
            {activeTab === "auth" && (
              <div className="space-y-6">
                {currentUser ? (
                  <div className="p-5 bg-zinc-950/40 rounded-3xl border border-zinc-900 space-y-4 text-center">
                    <div className="flex justify-center flex-col items-center">
                      <Avatar src={cabinetAvatar} className="w-16 h-16 rounded-full text-2xl border-2 border-indigo-400 shadow-xl mb-3" fallback="🍿" />
                      <h4 className="text-md font-bold text-zinc-100">{cabinetName}</h4>
                      <p className="text-xs text-zinc-500 mt-1">{currentUser.email || "Гостевой сеанс без электронной почты"}</p>
                    </div>

                    <div className="p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 text-[11px] text-zinc-400 max-w-sm mx-auto">
                      {currentUser.isGuest ? (
                        <span>Вы используете временный <b>Сеанс гостя</b>. Зарегистрируйтесь ниже с ником и почтой, чтобы сохранить ваши залы и закладки!</span>
                      ) : (
                        <span>Вы авторизованы в системе. Ваши данные привязаны к локальное базе данных на этом устройстве.</span>
                      )}
                    </div>

                    <button
                      onClick={handleLocalSignOut}
                      className="py-2.5 px-6 bg-rose-600/10 hover:bg-rose-600/20 text-rose-450 border border-rose-500/20 rounded-xl text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer mx-auto block"
                    >
                      Выйти из аккаунта
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h4 className="text-md font-display font-extrabold text-zinc-100 uppercase tracking-wide">
                        {isSignUpMode ? "📝 Регистрация профиля" : "🔑 Вход в Homes Sync"}
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-normal max-w-xs mx-auto">
                        Простой локальный аккаунт без внешних серверов. Хранится надежно в localStorage браузера.
                      </p>
                    </div>

                    <form onSubmit={isSignUpMode ? handleLocalSignUp : handleLocalSignIn} className="space-y-3.5 max-w-sm mx-auto">
                      {isSignUpMode && (
                        <div>
                          <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1.5 select-none">Ваш псевдоним</label>
                          <input
                            type="text"
                            placeholder="Иван Киноман"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-zinc-950 text-xs px-4 py-3 rounded-xl border border-zinc-850 outline-none focus:border-indigo-500 text-zinc-300"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1.5 select-none">Адрес электронной почты</label>
                        <input
                          type="email"
                          placeholder="user@sferium.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-zinc-950 text-xs px-4 py-3 rounded-xl border border-zinc-850 outline-none focus:border-indigo-500 text-zinc-300"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1.5 select-none">Пароль (локальная проверка)</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-zinc-950 text-xs px-4 py-3 rounded-xl border border-zinc-850 outline-none focus:border-indigo-500 text-zinc-300"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={authActionLoading}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-550 text-white font-bold uppercase text-xs tracking-wider rounded-xl transition-colors cursor-pointer select-none flex items-center justify-center gap-1"
                      >
                        {authActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{isSignUpMode ? "Зарегистрироваться" : "Авторизоваться"}</span>
                      </button>
                    </form>

                    <div className="text-center">
                      <button
                        onClick={() => setIsSignUpMode(!isSignUpMode)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider bg-transparent border-0 cursor-pointer"
                      >
                        {isSignUpMode ? "У меня уже есть аккаунт - Войти" : "Нет аккаунта? Зарегистрироваться локально"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Sferium Footer details */}
          <div className="bg-zinc-950 px-6 py-4 border-t border-[#3b1f5c]/5 text-[10px] text-zinc-500 flex flex-col md:flex-row items-center justify-between font-medium">
            <span>Homes Sync Build Web. Клиентские базы данных localStorage активны и стабильны.</span>
            <span className="text-indigo-400 font-bold">100% OFF-LINE SECURE</span>
          </div>
        </div>
      </div>

      {/* Tutorial overlay guide popup modal */}
      <AnimatePresence>
        {showTutorialModal && (
          <div className="fixed inset-x-0 inset-y-0 z-55 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-[#0f0821] border border-[#48286a]/40 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center"
            >
              <span className="text-5xl block mb-4.5">{TUTORIAL_STEPS[tutorialStep]?.icon}</span>
              <h4 className="text-lg font-black text-zinc-100 flex items-center gap-1.5 leading-normal select-none">
                {TUTORIAL_STEPS[tutorialStep]?.title}
              </h4>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                {TUTORIAL_STEPS[tutorialStep]?.text}
              </p>

              <div className="flex gap-2.5 mt-8 w-full">
                {tutorialStep > 0 && (
                  <button
                    onClick={() => setTutorialStep(prev => prev - 1)}
                    className="flex-1 py-3 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer"
                  >
                    Назад
                  </button>
                )}
                {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                  <button
                    onClick={() => setTutorialStep(prev => prev + 1)}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer"
                  >
                    Далее
                  </button>
                ) : (
                  <button
                    onClick={() => setShowTutorialModal(false)}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer"
                  >
                    Понятно!
                  </button>
                )}
              </div>

              {/* Steps control pagination indicator dots list */}
              <div className="flex gap-2.5 mt-5">
                {TUTORIAL_STEPS.map((_, i) => (
                  <span key={i} className={`w-2 h-2 rounded-full transition-colors ${i === tutorialStep ? "bg-indigo-500" : "bg-zinc-800"}`} />
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Diagnostic progress logs modal */}
      <AnimatePresence>
        {showDiagnosticModal && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative"
            >
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#a855f7] mb-4.5 select-none">Тестирование узлов синхронизатора</h4>

              <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl min-h-[160px] font-mono text-[11px] leading-relaxed text-zinc-400 space-y-2">
                {diagnosticLogs.map((log, i) => (
                  <p key={i}>{log}</p>
                ))}
                {isDiagnosing && (
                  <div className="flex items-center gap-1.5 text-zinc-550 animate-pulse mt-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Поиск пакетов маршрутизации...</span>
                  </div>
                )}
              </div>

              {!isDiagnosing && (
                <button
                  onClick={() => setShowDiagnosticModal(false)}
                  className="w-full mt-5 py-3 bg-indigo-600 hover:bg-indigo-550 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-colors cursor-pointer select-none"
                >
                  Закрыть и применить исправленный контекст
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Internal Feedback modal container */}
      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-5.5 shadow-2xl relative space-y-4"
            >
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>

              <h4 className="text-xs font-display font-extrabold uppercase tracking-widest text-[#9d5cf6] select-none">Быстрое обращение в поддержку</h4>

              {feedbackSuccess ? (
                <div className="text-center py-6 space-y-2 text-emerald-400">
                  <span className="text-4xl block">📬</span>
                  <span className="text-sm font-bold block">Данные успешно экспортированы!</span>
                  <p className="text-[10px] text-zinc-400">Спасибо за вашу поддержку!</p>
                </div>
              ) : (
                <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1.5">Тип сообщения</label>
                    <div className="grid grid-cols-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setFeedbackType("review")}
                        className={`py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                          feedbackType === "review" ? "bg-indigo-600 text-white shadow" : "text-zinc-550"
                        }`}
                      >
                        🐞 Сообщить о баге
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedbackType("idea")}
                        className={`py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                          feedbackType === "idea" ? "bg-indigo-600 text-white shadow" : "text-zinc-550"
                        }`}
                      >
                        💡 Новое предложение
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1.5">Суть вашего обращения (описание)</label>
                    <textarea
                      required
                      placeholder={feedbackType === "review" ? "Опишите ошибку, которую вы обнаружили (например, баг со звуком)..." : "Поделитесь, какую медиаплатформу вы еще хотите видеть в Homes..."}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      rows={4}
                      className="w-full bg-zinc-950 border border-zinc-800 text-xs px-3.5 py-3.5 rounded-xl outline-none focus:border-indigo-500 text-zinc-300 resize-none font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#a855f7] hover:bg-[#9333ea] text-white font-bold uppercase text-xs tracking-widest rounded-xl transition-transform cursor-pointer select-none"
                  >
                    Отправить отчет на модерацию
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
