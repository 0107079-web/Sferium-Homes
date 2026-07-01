/**
 * Sferium Homes - Clean Client-side Local Authentication Service
 * Fully independent of external servers and Firebase
 */

import { getApiUrl } from "../apiConfig";

export interface LocalUser {
  uid: string;
  email: string;
  displayName: string;
  avatar: string;
  color: string;
  isGuest?: boolean;
}

const USERS_KEY = "sferium_local_registered_users";
const CURRENT_USER_KEY = "homes_current_user";

/**
 * Fetch all registered users from localStorage
 */
export function getRegisteredUsers(): LocalUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to parse local users database:", e);
    return [];
  }
}

/**
 * Save users list to localStorage
 */
function saveRegisteredUsers(users: any[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/**
 * Register a simple custom user profile client-side via backend server
 */
export async function registerLocalUser(
  email: string,
  pass: string,
  nickname: string,
  avatar: string = "🍿",
  color: string = "#3B82F6"
): Promise<LocalUser> {
  // Simple validation
  const cleanEmail = email.trim().toLowerCase();
  const cleanNickname = nickname.trim();
  
  if (!cleanEmail || !pass || !cleanNickname) {
    throw new Error("Пожалуйста, заполните все обязательные поля");
  }

  const response = await fetch(getApiUrl("/api/auth/register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: cleanEmail,
      password: pass,
      nickname: cleanNickname,
      avatar,
      color
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Ошибка при регистрации");
  }

  const data = await response.json();
  const newUser = data.user;

  // Auto sign-in the registered user
  setCurrentUser(newUser);
  return newUser;
}

/**
 * Login a simple custom user profile client-side via backend server
 */
export async function loginLocalUser(email: string, pass: string): Promise<LocalUser> {
  const cleanEmail = email.trim().toLowerCase();
  
  if (!cleanEmail || !pass) {
    throw new Error("Пожалуйста, заполните все поля");
  }

  const response = await fetch(getApiUrl("/api/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: cleanEmail,
      password: pass
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Неверная почта или пароль!");
  }

  const data = await response.json();
  const loggedInUser = data.user;

  setCurrentUser(loggedInUser);
  return loggedInUser;
}

/**
 * Get current logged in user (or retrieve/generate a stable guest session)
 */
export function getCurrentUser(): LocalUser | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to parse current user session:", e);
  }
  return null;
}

/**
 * Save current user profile to localStorage
 */
export function setCurrentUser(user: LocalUser | null) {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

/**
 * Generate a new random guest user (without local memory footprint unless written)
 */
export function createGuestSession(): LocalUser {
  const guestId = "guest_" + Math.random().toString(36).substring(2, 9);
  const randomNames = [
    "Уютный Зритель", "Попкорн Мастер", "Анонимный Домовой", 
    "Любитель Сериалов", "Свободный Зритель", "Киноман Про", 
    "Вечерний Зритель", "Ночной Чаттер", "Искатель Видео"
  ];
  const randomName = randomNames[Math.floor(Math.random() * randomNames.length)] + ` #${Math.floor(100 + Math.random() * 900)}`;
  const randomAvatars = ["🍿", "🍕", "🎬", "📺", "🐾", "🌟", "⚡", "🍭", "👾"];
  const randomAvatar = randomAvatars[Math.floor(Math.random() * randomAvatars.length)];
  const randomColors = ["#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#EF4444", "#06B6D4"];
  const randomColor = randomColors[Math.floor(Math.random() * randomColors.length)];

  const guestUser: LocalUser = {
    uid: guestId,
    email: "",
    displayName: randomName,
    avatar: randomAvatar,
    color: randomColor,
    isGuest: true
  };

  setCurrentUser(guestUser);
  return guestUser;
}

/**
 * Clear the current user session
 */
export function logoutLocalUser() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

/**
 * Get or initialize user profile local DB representation
 */
export function getLocalUserProfile(uid: string, defaultName = "Зритель"): any {
  const key = `homes_profile_${uid}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {}
  }
  const defaultProfile = {
    uid,
    displayName: defaultName,
    avatar: "🍿",
    color: "#3B82F6",
    favorites: [],
    history: [],
    provider: uid.startsWith("guest_") ? "guest" : "email",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  localStorage.setItem(key, JSON.stringify(defaultProfile));
  return defaultProfile;
}

/**
 * Save user profile updates back to localStorage
 */
export function saveLocalUserProfile(uid: string, data: any): any {
  const key = `homes_profile_${uid}`;
  const existing = getLocalUserProfile(uid);
  const updated = { ...existing, ...data, updatedAt: Date.now() };
  localStorage.setItem(key, JSON.stringify(updated));
  return updated;
}
