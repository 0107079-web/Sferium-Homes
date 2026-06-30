/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { RoomState, WSMessage, RoomMember, ChatMessage } from "./src/types";
import ytdl from "@distube/ytdl-core";
import axios from "axios";
import fs from "fs";
import pg from "pg";
const { Pool } = pg;

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Middlewares for parsing request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express CORS and Options preflight middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Authorization, Referer, User-Agent");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE, HEAD");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// In-Memory store for Watch Party Rooms
const rooms: Record<string, RoomState> = {};

interface ClientConnection {
  ws: WebSocket;
  roomId: string;
  userId: string;
}

const clientConnections = new Map<WebSocket, ClientConnection>();

// Helper index counters
let messageCount = 0;

// Helper to extract video information for Youtube, VK, Rutube, and Yandex
interface ParsedVideo {
  provider: "youtube" | "vk" | "rutube" | "yandex" | "unknown";
  id: string;
  embedUrl: string;
}

function parseVideoUrl(url: string): ParsedVideo {
  let cleanUrl = url.trim();
  
  // 0. Auto-extract src if it is an iframe code
  if (cleanUrl.includes("<iframe") && cleanUrl.includes("src=")) {
    const srcMatch = cleanUrl.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      cleanUrl = srcMatch[1].trim();
    }
  }

  // 1. YouTube check
  const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const ytMatch = cleanUrl.match(ytRegExp);
  if (ytMatch && ytMatch[2].length === 11) {
    const id = ytMatch[2];
    return {
      provider: "youtube",
      id,
      embedUrl: `https://www.youtube.com/embed/${id}`
    };
  }
  if (cleanUrl.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
    return {
      provider: "youtube",
      id: cleanUrl,
      embedUrl: `https://www.youtube.com/embed/${cleanUrl}`
    };
  }

  // 2. VK Video check
  const isVkHost = /vk/i.test(cleanUrl) || cleanUrl.includes("oid=") || cleanUrl.includes("video_ext.php");
  const vkSimpleMatch = cleanUrl.match(/(?:video|clip)(-?\d+)_(\d+)/i) || cleanUrl.match(/(-?\d+)_(\d+)/);
  const oidMatch = cleanUrl.match(/[\?&]oid=(-?\d+)/i);
  const idMatch = cleanUrl.match(/[\?&]id=(\d+)/i);
  
  if (isVkHost) {
    const hashMatch = cleanUrl.match(/[\?&]hash=([a-zA-Z0-9]+)/i);
    const hashId = hashMatch ? `_${hashMatch[1]}` : "";
    
    if (vkSimpleMatch) {
      const oid = vkSimpleMatch[1];
      const id = vkSimpleMatch[2];
      return {
        provider: "vk",
        id: `${oid}_${id}${hashId}`,
        embedUrl: `https://vk.com/video_ext.php?oid=${oid}&id=${id}${hashMatch ? `&hash=${hashMatch[1]}` : ""}&hd=2`
      };
    } else if (oidMatch && idMatch) {
      const oid = oidMatch[1];
      const id = idMatch[1];
      return {
        provider: "vk",
        id: `${oid}_${id}${hashId}`,
        embedUrl: `https://vk.com/video_ext.php?oid=${oid}&id=${id}${hashMatch ? `&hash=${hashMatch[1]}` : ""}&hd=2`
      };
    }
  }

  // 3. Rutube check
  const isRutubeHost = /rutube/i.test(cleanUrl);
  const rutubeMatch = cleanUrl.match(/([a-fA-F0-9]{32})/);
  if (isRutubeHost) {
    const pMatch = cleanUrl.match(/[\?&]p=([a-zA-Z0-9_-]+)/i);
    const pValue = pMatch ? pMatch[1] : "";
    const pId = pValue ? `_${pValue}` : "";
    
    if (rutubeMatch) {
      const id = rutubeMatch[1];
      return {
        provider: "rutube",
        id: `${id}${pId}`,
        embedUrl: `https://rutube.ru/play/embed/${id}${pValue ? `?p=${pValue}` : ""}`
      };
    } else {
      // Fallback for play embeds or general links
      const lastPart = cleanUrl.split("/").filter(Boolean).pop()?.split("?")[0] || "";
      if (lastPart.length >= 10) {
        return {
          provider: "rutube",
          id: `${lastPart}${pId}`,
          embedUrl: `https://rutube.ru/play/embed/${lastPart}${pValue ? `?p=${pValue}` : ""}`
        };
      }
    }
  }

  // 4. Yandex / Dzen check
  const isDzen = /dzen/i.test(cleanUrl);
  const isYandex = /yandex/i.test(cleanUrl);
  if (isDzen || isYandex) {
    const dzenMatch = cleanUrl.match(/dzen\.ru\/(?:video\/watch|embed)\/([a-zA-Z0-9_-]+)/) || cleanUrl.match(/([a-zA-Z0-9_-]{24})/);
    const yandexEfirMatch = cleanUrl.match(/yandex\.ru\/efir\?stream_id=([a-zA-Z0-9_-]+)/);
    
    if (dzenMatch) {
      const id = dzenMatch[1];
      return {
        provider: "yandex",
        id,
        embedUrl: `https://dzen.ru/embed/${id}`
      };
    } else if (yandexEfirMatch) {
      const id = yandexEfirMatch[1];
      return {
        provider: "yandex",
        id,
        embedUrl: `https://yandex.ru/efir?stream_id=${id}`
      };
    } else {
      const lastPart = cleanUrl.split("/").filter(Boolean).pop()?.split("?")[0] || "";
      if (lastPart.length >= 8) {
        return {
          provider: "yandex",
          id: lastPart,
          embedUrl: `https://dzen.ru/embed/${lastPart}`
        };
      }
    }
  }

  // Fallback for generic https iframes
  if (cleanUrl.startsWith("https://") || cleanUrl.startsWith("http://")) {
    return {
      provider: "unknown",
      id: cleanUrl,
      embedUrl: cleanUrl
    };
  }

  return {
    provider: "unknown",
    id: "",
    embedUrl: ""
  };
}

// Broadcast helper
function broadcastToRoom(roomId: string, msg: WSMessage, skipWs?: WebSocket) {
  console.log(`[WS Server BROADCAST] Room: ${roomId}, Type: ${msg.type}`, JSON.stringify(msg));
  const payload = JSON.stringify(msg);
  for (const [ws, conn] of clientConnections.entries()) {
    if (conn.roomId === roomId && ws !== skipWs && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Handle HTTP requests (API routes must be declared FIRST)

// Initialize Postgres Pool if DATABASE_URL is set
let pool: any = null;
if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
    });
    console.log("PostgreSQL Database URL detected. Initializing database pool...");
  } catch (err) {
    console.error("Failed to initialize PostgreSQL Pool:", err);
  }
}

// User Profile representation on server
interface ServerUser {
  uid: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatar: string;
  color: string;
  createdAt: number;
}

// Fallback JSON file path
const USERS_FILE = path.join(process.cwd(), "users.json");

// Local users cache
let localUsers: ServerUser[] = [];

// Load users from file
function loadUsersFromFile() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      localUsers = JSON.parse(data);
      console.log(`Loaded ${localUsers.length} users from local users.json`);
    } else {
      localUsers = [];
      fs.writeFileSync(USERS_FILE, JSON.stringify([]), "utf-8");
    }
  } catch (err) {
    console.error("Failed to load users from file:", err);
    localUsers = [];
  }
}

// Save users to file
function saveUsersToFile() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(localUsers, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save users to file:", err);
  }
}

// Initialize Database Table / File
async function initDatabase() {
  if (pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sferium_users (
          uid TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL,
          avatar TEXT,
          color TEXT,
          created_at BIGINT NOT NULL
        )
      `);
      console.log("PostgreSQL sferium_users table checked/created successfully.");
    } catch (err) {
      console.error("Error creating PostgreSQL table, falling back to JSON file storage:", err);
      pool = null; // Fallback
      loadUsersFromFile();
    }
  } else {
    loadUsersFromFile();
  }
}

// Run DB Initialization immediately
initDatabase();

// Helper to find user by email
async function findUserByEmail(email: string): Promise<ServerUser | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (pool) {
    try {
      const res = await pool.query("SELECT * FROM sferium_users WHERE LOWER(email) = $1", [cleanEmail]);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          uid: row.uid,
          email: row.email,
          passwordHash: row.password_hash,
          displayName: row.display_name,
          avatar: row.avatar || "🍿",
          color: row.color || "#3B82F6",
          createdAt: Number(row.created_at)
        };
      }
      return null;
    } catch (err) {
      console.error("Postgres error findUserByEmail, checking fallback file:", err);
    }
  }
  const matched = localUsers.find(u => u.email.toLowerCase() === cleanEmail);
  return matched || null;
}

// Helper to create/register a user
async function createUser(user: ServerUser): Promise<ServerUser> {
  if (pool) {
    try {
      await pool.query(
        "INSERT INTO sferium_users (uid, email, password_hash, display_name, avatar, color, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [user.uid, user.email, user.passwordHash, user.displayName, user.avatar, user.color, user.createdAt]
      );
      return user;
    } catch (err) {
      console.error("Postgres error inserting user, using local file backup:", err);
    }
  }
  localUsers.push(user);
  saveUsersToFile();
  return user;
}

// Helper to update user
async function updateUserProfile(uid: string, displayName: string, avatar: string, color: string): Promise<ServerUser | null> {
  if (pool) {
    try {
      const res = await pool.query(
        "UPDATE sferium_users SET display_name = $1, avatar = $2, color = $3 WHERE uid = $4 RETURNING *",
        [displayName, avatar, color, uid]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          uid: row.uid,
          email: row.email,
          passwordHash: row.password_hash,
          displayName: row.display_name,
          avatar: row.avatar,
          color: row.color,
          createdAt: Number(row.created_at)
        };
      }
    } catch (err) {
      console.error("Postgres error updating user, updating fallback file:", err);
    }
  }
  const idx = localUsers.findIndex(u => u.uid === uid);
  if (idx !== -1) {
    localUsers[idx].displayName = displayName;
    localUsers[idx].avatar = avatar;
    localUsers[idx].color = color;
    saveUsersToFile();
    return localUsers[idx];
  }
  return null;
}

// Auth POST Endpoints
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, nickname, avatar, color } = req.body;
    if (!email || !password || !nickname) {
      return res.status(400).json({ error: "Пожалуйста, заполните все обязательные поля" });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Пользователь с такой электронной почтой уже существует!" });
    }

    const uid = "user_" + Math.random().toString(36).substring(2, 11);
    const newUser: ServerUser = {
      uid,
      email: email.trim().toLowerCase(),
      passwordHash: password,
      displayName: nickname.trim(),
      avatar: avatar || "🍿",
      color: color || "#3B82F6",
      createdAt: Date.now()
    };

    await createUser(newUser);

    res.status(200).json({
      user: {
        uid: newUser.uid,
        email: newUser.email,
        displayName: newUser.displayName,
        avatar: newUser.avatar,
        color: newUser.color
      }
    });
  } catch (err: any) {
    console.error("Register endpoint error:", err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Пожалуйста, укажите почту и пароль" });
    }

    const user = await findUserByEmail(email);
    if (!user || user.passwordHash !== password) {
      return res.status(400).json({ error: "Неверная почта или пароль!" });
    }

    res.status(200).json({
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        color: user.color
      }
    });
  } catch (err: any) {
    console.error("Login endpoint error:", err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

app.post("/api/auth/vk-login", async (req, res) => {
  try {
    const { accessToken, userId, isManual, manualName, manualEmail, manualAvatar } = req.body;
    
    let displayName = "Пользователь VK";
    let avatar = "👾";
    let vkEmail = "";
    let uid = "";

    if (isManual) {
      if (!manualName) {
        return res.status(400).json({ error: "Пожалуйста, укажите имя пользователя VK" });
      }
      displayName = manualName.trim();
      avatar = manualAvatar || "👾";
      const uIdStr = userId ? userId.toString().trim() : Math.random().toString(36).substring(2, 11);
      vkEmail = manualEmail ? manualEmail.trim().toLowerCase() : `vk_manual_${uIdStr}@sferium.homes`;
      uid = `vk_manual_${uIdStr}`;
    } else {
      if (!accessToken || !userId) {
        return res.status(400).json({ error: "Отсутствуют параметры авторизации VK" });
      }

      try {
        const vkRes = await axios.get(`https://api.vk.com/method/users.get`, {
          params: {
            user_ids: userId,
            fields: "photo_100",
            access_token: accessToken,
            v: "5.131"
          }
        });

        if (vkRes.data && vkRes.data.response && vkRes.data.response[0]) {
          const vkUser = vkRes.data.response[0];
          displayName = `${vkUser.first_name || ""} ${vkUser.last_name || ""}`.trim() || `VK Пользователь #${userId}`;
          if (vkUser.photo_100) {
            avatar = vkUser.photo_100;
          }
        } else {
          displayName = `VK Пользователь #${userId}`;
        }
      } catch (vkErr) {
        console.error("Error fetching VK profile info:", vkErr);
        displayName = `VK Пользователь #${userId}`;
      }
      vkEmail = `vk_${userId}@sferium.homes`;
      uid = `vk_user_${userId}`;
    }

    let existing = await findUserByEmail(vkEmail);
    if (!existing) {
      existing = {
        uid,
        email: vkEmail,
        passwordHash: `vk_oauth_secret_${uid}`,
        displayName,
        avatar,
        color: "#3B82F6",
        createdAt: Date.now()
      };
      await createUser(existing);
    } else {
      await updateUserProfile(existing.uid, displayName, avatar, existing.color);
      existing.displayName = displayName;
      existing.avatar = avatar;
    }

    res.status(200).json({
      user: {
        uid: existing.uid,
        email: existing.email,
        displayName: existing.displayName,
        avatar: existing.avatar,
        color: existing.color
      }
    });
  } catch (err: any) {
    console.error("VK login endpoint error:", err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "alive", roomsCount: Object.keys(rooms).length });
});

// VK OAuth Callback Web Page Handler for Client-side Implicit Flow (Tokens)
app.get(["/auth/vk/callback", "/auth/vk/callback/"], (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>VK Auth Callback | Sferium</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #090414;
            color: #f4f4f5;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            overflow: hidden;
          }
          .card {
            background: #140d24;
            padding: 2.5rem;
            border-radius: 1.25rem;
            text-align: center;
            border: 1px solid rgba(139, 92, 246, 0.15);
            box-shadow: 0 20px 50px rgba(0,0,0,0.6);
            max-width: 400px;
            width: 85%;
          }
          .spinner {
            border: 4px solid rgba(255,255,255,0.06);
            width: 42px;
            height: 42px;
            border-radius: 50%;
            border-left-color: #3b82f6;
            animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            margin: 1.5rem auto;
          }
          h2 {
            font-size: 1.25rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            color: #ffffff;
          }
          p {
            color: #a1a1aa;
            font-size: 0.875rem;
            line-height: 1.5;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="card" id="status-card">
          <div class="spinner"></div>
          <h2>Связывание аккаунта VK...</h2>
          <p>Передаем токен авторизации в плеер Sferium. Пожалуйста, не закрывайте это окно.</p>
        </div>
        <script>
          // Since VK implicit flow passes tokens inside window.location.hash,
          // we parse it on the client side.
          var hashString = window.location.hash || "";
          var searchString = window.location.search || "";
          
          // Match any parameter string formats
          var targetPart = hashString.indexOf("#") === 0 ? hashString.substring(1) : (searchString.indexOf("?") === 0 ? searchString.substring(1) : hashString);
          
          if (targetPart) {
            var params = new URLSearchParams(targetPart);
            var accessToken = params.get("access_token") || params.get("token");
            var userId = params.get("user_id") || params.get("uid");
            var expiresIn = params.get("expires_in");
            
            if (accessToken) {
              // Store locally as backup plan
              try {
                localStorage.setItem("vk_video_access_token", accessToken);
                if (userId) {
                  localStorage.setItem("vk_video_user_id", userId);
                }
              } catch (e) {
                console.warn("Storage restricted", e);
              }

              // Post message back to opener window if running in popup frame
              if (window.opener) {
                window.opener.postMessage({
                  type: "VK_OAUTH_SUCCESS",
                  accessToken: accessToken,
                  userId: userId,
                  expiresIn: expiresIn
                }, "*");
                
                // Let the user know and auto-close
                document.getElementById("status-card").innerHTML = '<div style="font-size: 3rem; margin-bottom: 1rem;">✅</div><h2>Успешно авторизовано!</h2><p>Окно закроется автоматически через мгновение.</p>';
                setTimeout(function() {
                  window.close();
                }, 1000);
              } else {
                // If loaded without popup context, redirect back home
                document.getElementById("status-card").innerHTML = '<div style="font-size: 3rem; margin-bottom: 1rem;">✅</div><h2>Успешно авторизовано!</h2><p>Перенаправляем в виртуальный кинотеатр...</p>';
                setTimeout(function() {
                  window.location.href = "/";
                }, 1200);
              }
            } else {
              // In case the user denied access or there was an error
              var errMsg = params.get("error_description") || "Не удалось извлечь токен доступа VK.";
              document.getElementById("status-card").innerHTML = '<div style="font-size: 3rem; margin-bottom: 1rem;">❌</div><h2 style="color: #ef4444;">Ошибка авторизации</h2><p>' + errMsg + '</p>';
            }
          } else {
            document.getElementById("status-card").innerHTML = '<div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div><h2>Ожидание ответа VK</h2><p>Не обнаружены параметры авторизации. Попробуйте войти заново из плеера.</p>';
          }
        </script>
      </body>
    </html>
  `);
});

// Room verification helper
app.get("/api/room-check/:roomId", (req, res) => {
  const { roomId } = req.params;
  const exists = !!rooms[roomId];
  res.json({ exists });
});

// All public rooms list endpoint
app.get("/api/rooms-public", (req, res) => {
  const activeList = Object.values(rooms)
    .filter(r => r.isPublic !== false)
    .map(r => {
    // Determine video title or placeholder
    let titleMsg = "Интересное видео";
    if (r.videoUrl.includes("a50qT9bW_T0")) titleMsg = "Иван Васильевич меняет профессию";
    else if (r.videoUrl.includes("dQw4w9WgXcQ")) titleMsg = "Аниме-трейлеры и Клипы (Sferium)";
    else if (r.videoUrl.includes("2K4Vb68MskE")) titleMsg = "Путешествие на Камчатку: Гейзеры";
    else if (r.videoUrl.includes("bc04f35e")) titleMsg = "Научное шоу: Тайна времени";
    else if (r.videoUrl.includes("video_ext.php")) titleMsg = "Музыкальный фестиваль VK LIVE";
    else {
      titleMsg = r.videoUrl.length > 40 ? `${r.videoUrl.substring(0, 37)}...` : r.videoUrl;
    }

    // Filter out disconnected members for active list display
    const activeMembers = Object.values(r.members).filter(m => !m.disconnected);

    return {
      roomId: r.roomId,
      name: `🔥 Открытая Комната #${r.roomId}`,
      membersCount: activeMembers.length,
      currentVideoTitle: titleMsg,
      videoUrl: r.videoUrl,
      isMock: false,
      members: activeMembers.map(m => ({
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        color: m.color,
        isHost: m.isHost
      }))
    };
  });

  const mockPublicRooms = [
    {
      roomId: "GRAVITY",
      name: "🔥 Гравити Фолз (1 Сезон)",
      membersCount: 15,
      currentVideoTitle: "Гравити Фолз",
      videoUrl: "https://vk.com/video_ext.php?oid=-220550000&id=456239149",
      isMock: true,
      members: [
        { id: "g1", name: "Диппер", avatar: "🧢", color: "#3b82f6", isHost: true },
        { id: "g2", name: "Мэйбл", avatar: "🐷", color: "#ec4899", isHost: false },
        { id: "g3", name: "Зус", avatar: "🦎", color: "#10b981", isHost: false },
        { id: "g4", name: "Стэн", avatar: "👓", color: "#f59e0b", isHost: false },
        { id: "g5", name: "Венди", avatar: "🦊", color: "#ef4444", isHost: false }
      ]
    },
    {
      roomId: "KITCHEN",
      name: "🍳 Кухня — Claude Monet Сериал",
      membersCount: 11,
      currentVideoTitle: "🔴 Кухня 6 сезонов 120 серий",
      videoUrl: "https://www.youtube.com/watch?v=a50qT9bW_T0",
      isMock: true,
      members: [
        { id: "k1", name: "Баринов", avatar: "👨‍🍳", color: "#ef4444", isHost: true },
        { id: "k2", name: "Макс", avatar: "🍿", color: "#3b82f6", isHost: false },
        { id: "k3", name: "Вика", avatar: "👜", color: "#ec4899", isHost: false },
        { id: "k4", name: "Сеня", avatar: "🐟", color: "#10b981", isHost: false },
        { id: "k5", name: "Федя", avatar: "⚓", color: "#06b6d4", isHost: false }
      ]
    },
    {
      roomId: "PATSANY",
      name: "💪 Реальные пацаны LIVE",
      membersCount: 5,
      currentVideoTitle: "РЕАЛЬНЫЕ ПАЦАНЫ ( 5 - 6 сезон )",
      videoUrl: "https://vk.com/video_ext.php?oid=-220550000&id=456239149",
      isMock: true,
      members: [
        { id: "p1", name: "Колян", avatar: "🧢", color: "#6366f1", isHost: true },
        { id: "p2", name: "Антоха", avatar: "👨", color: "#f59e0b", isHost: false },
        { id: "p3", name: "Вован", avatar: "🤠", color: "#10b981", isHost: false },
        { id: "p4", name: "Лера", avatar: "💅", color: "#ec4899", isHost: false },
        { id: "p5", name: "Эдик", avatar: "👓", color: "#06b6d4", isHost: false }
      ]
    },
    {
      roomId: "UPGRADE",
      name: "🤖 Техно-триллер Upgrade",
      membersCount: 2,
      currentVideoTitle: "Апгрейд (2018)",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      isMock: true,
      members: [
        { id: "u1", name: "Грей", avatar: "🦾", color: "#ef4444", isHost: true },
        { id: "u2", name: "Стем", avatar: "🧠", color: "#a855f7", isHost: false }
      ]
    },
    {
      roomId: "HAUNTED",
      name: "👻 Комедия: Дом с паранормальными явлениями 2",
      membersCount: 2,
      currentVideoTitle: "Дом с паранормальными явлениями 2 | A Haunted House 2",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      isMock: true,
      members: [
        { id: "h1", name: "Малкольм", avatar: "🕶️", color: "#eab308", isHost: true },
        { id: "h2", name: "Призрак", avatar: "👻", color: "#94a3b8", isHost: false }
      ]
    },
    {
      roomId: "MONSTER",
      name: "💍 Моя свекровь — монстр LIVE",
      membersCount: 2,
      currentVideoTitle: "Моя свекровь — монстр | 10 сезон 12 серия",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      isMock: true,
      members: [
        { id: "ms1", name: "Сноха", avatar: "👰", color: "#ec4899", isHost: true },
        { id: "ms2", name: "Свекровь", avatar: "👹", color: "#ef4444", isHost: false }
      ]
    }
  ];

  // Merge them (fill matching ids first, keep active, top up to 12)
  const merged = [...activeList];
  for (const m of mockPublicRooms) {
    if (merged.length >= 12) break;
    if (!merged.some(r => r.roomId === m.roomId)) {
      merged.push(m);
    }
  }

  res.json({ rooms: merged });
});

// === HIGH PERFORMANCE DIRECT STREAM EXTRACTOR FOR BROWSER AGENT MODE ===
async function extractDirectStreamUrl(inputUrl: string): Promise<{ streamUrl: string; contentType: string }> {
  const cleanUrl = inputUrl.trim();
  const parsed = parseVideoUrl(cleanUrl);

  if (parsed.provider === "youtube") {
    try {
      console.log(`[Stream Extractor] Querying ytdl-core for YouTube: ${cleanUrl}`);
      const info = await ytdl.getInfo(cleanUrl);
      
      // For YouTube live streams, search for .m3u8 manifest links
      if (info.videoDetails.isLiveContent) {
         const liveFormat = info.formats.find(f => f.url && (f.url.includes("manifest/hls_playlist") || f.url.includes(".m3u8")));
         if (liveFormat) {
           return { streamUrl: liveFormat.url, contentType: "application/x-mpegURL" };
         }
      }
      
      // Attempt premium filter (both audio and video available)
      let format;
      try {
        format = ytdl.chooseFormat(info.formats, { 
          filter: "audioandvideo", 
          quality: "highestvideo" 
        });
      } catch (e) {
        format = info.formats.find(f => f.hasVideo && f.hasAudio && f.url);
      }
      
      if (format && format.url) {
        return { 
          streamUrl: format.url, 
          contentType: "video/mp4" 
        };
      }
      
      // Ultimate fallback
      const ultimateFallback = info.formats.find(f => f.url);
      if (ultimateFallback) {
        return { 
          streamUrl: ultimateFallback.url, 
          contentType: "video/mp4" 
        };
      }
      throw new Error("No video formats available on YouTube for this media link");
    } catch (err: any) {
      console.error("[Stream Extractor] YouTube extraction failed:", err.message);
      throw err;
    }
  }

  if (parsed.provider === "vk") {
    try {
      // Parse oid and id manually
      const simpleMatch = cleanUrl.match(/(?:video|clip)(-?\d+)_(\d+)/i) || cleanUrl.match(/(-?\d+)_(\d+)/);
      const oidMatch = cleanUrl.match(/[\?&]oid=(-?\d+)/i);
      const idMatch = cleanUrl.match(/[\?&]id=(\d+)/i);
      const hashMatch = cleanUrl.match(/[\?&]hash=([a-zA-Z0-9]+)/i);
      
      let oid = simpleMatch ? simpleMatch[1] : (oidMatch ? oidMatch[1] : "");
      let id = simpleMatch ? simpleMatch[2] : (idMatch ? idMatch[1] : "");
      let hash = hashMatch ? hashMatch[1] : "";

      if (!oid || !id) {
        throw new Error("Cannot extract oid/id from VK URL");
      }

      const embedUrl = `https://vk.com/video_ext.php?oid=${oid}&id=${id}${hash ? `&hash=${hash}` : ""}&hd=2`;
      console.log(`[Stream Extractor] Querying VK Video page: ${embedUrl}`);

      const response = await axios.get(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://vk.com/",
        },
      });

      const html = response.data;
      if (typeof html !== "string") {
        throw new Error("VK HTML response is not a string");
      }

      // Try multiple regex patterns to extract direct resolutions (highest quality first)
      const resolutions = ["1080", "720", "480", "360", "240"];
      for (const res of resolutions) {
        // Try pattern: "url720":"https:\/\/..."
        let regex = new RegExp(`"url${res}"\\s*:\\s*"([^"]+)"`);
        let match = html.match(regex);
        if (match && match[1]) {
          const streamUrl = match[1].replace(/\\/g, "");
          return { streamUrl, contentType: "video/mp4" };
        }
        
        // Try pattern: url720: 'https:\/...'
        regex = new RegExp(`url${res}\\s*:\\s*'([^']+)'`);
        match = html.match(regex);
        if (match && match[1]) {
          const streamUrl = match[1].replace(/\\/g, "");
          return { streamUrl, contentType: "video/mp4" };
        }
      }

      // Try raw URL
      const rawMatch = html.match(/"url_raw"\s*:\s*"([^"]+)"/);
      if (rawMatch && rawMatch[1]) {
        return { streamUrl: rawMatch[1].replace(/\\/g, ""), contentType: "video/mp4" };
      }

      // Try Live HLS stream
      const hlsMatch = html.match(/"url_hls"\s*:\s*"([^"]+)"/);
      if (hlsMatch && hlsMatch[1]) {
        return { streamUrl: hlsMatch[1].replace(/\\/g, ""), contentType: "application/x-mpegURL" };
      }

      // Final regex fallback for any direct mp4 links
      const mp4Matches = html.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]+/gi);
      if (mp4Matches && mp4Matches.length > 0) {
        return { streamUrl: mp4Matches[0], contentType: "video/mp4" };
      }

      throw new Error("Direct mp4/m3u8 stream links not found in VK Video configuration");
    } catch (err: any) {
      console.error("[Stream Extractor] VK extraction failed:", err.message);
      throw err;
    }
  }

  if (parsed.provider === "rutube") {
    try {
      const rutubeMatch = cleanUrl.match(/([a-fA-F0-9]{32})/);
      let videoId = "";
      if (rutubeMatch) {
         videoId = rutubeMatch[1];
      } else {
         const parts = cleanUrl.split("/").filter(Boolean);
         const last = parts[parts.length - 1]?.split("?")[0];
         if (last && last.length >= 10) {
            videoId = last;
         }
      }

      if (!videoId) {
        throw new Error("Could not parse Rutube video ID pattern");
      }

      const apiUrl = `https://rutube.ru/api/play/options/${videoId}/?format=json`;
      console.log(`[Stream Extractor] Fetching Rutube API: ${apiUrl}`);

      const response = await axios.get(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      const options = response.data;
      if (options && options.video_balancer) {
        let m3u8Url = options.video_balancer.m3u8 || options.video_balancer.default || Object.values(options.video_balancer)[0];
        if (typeof m3u8Url === "string") {
           return { streamUrl: m3u8Url, contentType: "application/x-mpegURL" };
        }
      }

      // Scrape for .m3u8 in full body format in case JSON nested fields differ
      const rawJson = JSON.stringify(options);
      const m3u8Match = rawJson.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
      if (m3u8Match) {
         return { streamUrl: m3u8Match[0], contentType: "application/x-mpegURL" };
      }
      
      throw new Error("No M3U8 video streams inside Rutube play response");
    } catch (err: any) {
       console.error("[Stream Extractor] Rutube extraction failed:", err.message);
       throw err;
    }
  }

  // Pure fallback: treat it as a direct video link
  return { streamUrl: cleanUrl, contentType: "video/mp4" };
}

// Byte-Range Aware Stream Proxying Endpoint
app.get("/api/stream", async (req, res) => {
  const videoUrl = req.query.url as string;
  if (!videoUrl) {
    return res.status(400).json({ error: "Missing 'url' parameter in query" });
  }

  console.log(`[Stream Route] Request to stream URL: ${videoUrl}`);

  try {
    const { streamUrl, contentType } = await extractDirectStreamUrl(videoUrl);
    console.log(`[Stream Route] Extracting completed: streaming ${streamUrl} as ${contentType}`);

    const parsedUrl = new URL(streamUrl);
    const useHttps = parsedUrl.protocol === "https:";
    const lib = useHttps ? await import("https") : await import("http");

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    if (streamUrl.includes("vk.com") || streamUrl.includes("vkvideo") || streamUrl.includes("vkuser")) {
      headers["Referer"] = "https://vk.com/";
    } else if (streamUrl.includes("rutube")) {
      headers["Referer"] = "https://rutube.ru/";
    } else if (streamUrl.includes("googlevideo.com") || streamUrl.includes("youtube.com")) {
      headers["Referer"] = "https://www.youtube.com/";
    }

    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const proxyReq = lib.request(
      streamUrl,
      {
        method: "GET",
        headers,
        rejectUnauthorized: false,
      },
      (proxyRes) => {
        const statusCode = proxyRes.statusCode || 200;
        res.status(statusCode);

        const headersToForward = [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
          "content-disposition",
          "cache-control",
        ];

        headersToForward.forEach((h) => {
          if (proxyRes.headers[h]) {
            res.setHeader(h, proxyRes.headers[h] as string);
          }
        });

        // Ensure safe audio/video media content-types
        if (!res.getHeader("content-type") || res.getHeader("content-type") === "application/octet-stream") {
          res.setHeader("content-type", contentType);
        }

        res.setHeader("Access-Control-Allow-Origin", "*");
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", (err) => {
      console.error(`[Stream Route Error] Proxy pipe failed: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({ error: "Failed to pipe remote video source", details: err.message });
      }
    });

    req.pipe(proxyReq);

  } catch (err: any) {
    console.error(`[Stream Route Error] Failed to resolve stream URL: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({ error: "Failed to extract and stream live source", details: err.message });
    }
  }
});

// Proxy endpoint: handles GET/POST for /proxy and /api/proxy to bypass platform CORS / iframe blocks
app.all(["/proxy", "/api/proxy"], async (req, res) => {
  const method = req.method;
  const videoUrl = (req.query.url || req.query.input || req.body.url) as string;

  console.log(`[Proxy Request] [${new Date().toISOString()}] ${method} - Target URL: ${videoUrl || "none"}`);

  if (!videoUrl) {
    console.warn("[Proxy Request] Error: Missing 'url' parameter");
    return res.status(400).json({ error: "Missing 'url' parameter in query or body" });
  }

  try {
    const parsedUrl = new URL(videoUrl);
    const useHttps = parsedUrl.protocol === "https:";
    const lib = useHttps ? await import("https") : await import("http");

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    // Standard video referrers to bypass restrictions
    if (videoUrl.includes("vk.com") || videoUrl.includes("vkvideo") || videoUrl.includes("vkuser")) {
      headers["Referer"] = "https://vk.com/";
    } else if (videoUrl.includes("rutube")) {
      headers["Referer"] = "https://rutube.ru/";
    } else if (videoUrl.includes("yandex") || videoUrl.includes("dzen")) {
      headers["Referer"] = "https://yandex.ru/";
    }

    // Forward Range header if requested by client (extremely useful for scrolling / seeking html5 video)
    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const proxyReq = lib.request(
      videoUrl,
      {
        method: req.method,
        headers,
        rejectUnauthorized: false, // Avoid SSL verification failure on some private CDNs
      },
      (proxyRes) => {
        const statusCode = proxyRes.statusCode || 200;
        console.log(`[Proxy Response] [${new Date().toISOString()}] Status: ${statusCode} for ${videoUrl}`);

        res.status(statusCode);

        const headersToForward = [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
          "content-disposition",
          "cache-control",
        ];

        headersToForward.forEach((h) => {
          if (proxyRes.headers[h]) {
            res.setHeader(h, proxyRes.headers[h] as string);
          }
        });

        // Ensure CORS is set on proxy responses
        res.setHeader("Access-Control-Allow-Origin", "*");

        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", (err) => {
      console.error(`[Proxy Connection Error] [${new Date().toISOString()}] Target: ${videoUrl} - Msg: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Ошибка подключения к удаленному серверу (Bad Gateway)",
          details: err.message,
        });
      }
    });

    req.pipe(proxyReq);

  } catch (err: any) {
    console.error(`[Proxy Request Error] [${new Date().toISOString()}] Target: ${videoUrl} - Msg: ${err.message}`);
    if (!res.headersSent) {
      res.status(400).json({
        error: "Некорректный формат ссылки (Invalid URL format)",
        details: err.message,
      });
    }
  }
});

// Resolve endpoint: parses URLs/iframes, detects platform, outputs clean embed URL or stream mapping
app.all(["/resolve", "/api/resolve"], (req, res) => {
  const method = req.method;
  const input = req.body.input || req.body.url || req.query.input || req.query.url;

  console.log(`[Resolve Request] [${new Date().toISOString()}] ${method} - Input: ${input || "none"}`);

  if (!input || typeof input !== "string") {
    console.warn("[Resolve Request] Error: Missing 'input' parameter");
    return res.status(400).json({ error: "Missing 'input' parameter in request body or query" });
  }

  try {
    const parsed = parseVideoUrl(input);

    let targetUrl = input.trim();
    if (targetUrl.includes("<iframe") && targetUrl.includes("src=")) {
      const srcMatch = targetUrl.match(/src=["']([^"']+)["']/i);
      if (srcMatch && srcMatch[1]) {
        targetUrl = srcMatch[1].trim();
      }
    }

    let type: "iframe" | "direct" = "iframe";
    let resolvedUrl = parsed.embedUrl || targetUrl;

    const lowercaseMatch = targetUrl.toLowerCase();
    const isDirectVideo = lowercaseMatch.includes(".mp4") || 
                          lowercaseMatch.includes(".m3u8") || 
                          lowercaseMatch.includes(".webm") || 
                          lowercaseMatch.includes(".mov") ||
                          lowercaseMatch.includes(".mpd") ||
                          lowercaseMatch.includes("video/mp4") ||
                          lowercaseMatch.includes("video/m3u8") ||
                          req.query.direct === "true";

    if (isDirectVideo) {
      type = "direct";
      resolvedUrl = targetUrl;
    } else if (parsed.provider === "unknown" && (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))) {
      type = "direct";
      resolvedUrl = targetUrl;
    }

    console.log(`[Resolve Result] [${new Date().toISOString()}] Service: ${parsed.provider}, Type: ${type}, Resolved URL: ${resolvedUrl}`);

    res.json({
      type,
      url: resolvedUrl,
      service: parsed.provider,
    });
  } catch (err: any) {
    console.error(`[Resolve Request Error] [${new Date().toISOString()}] Msg: ${err.message}`);
    res.status(502).json({
      error: "Не удалось расшифровать ссылку или код вставки",
      details: err.message,
    });
  }
});

// Check embed API: uses oEmbed to verify if a video supports embedding or is restricted
app.all(["/check-embed", "/api/check-embed"], async (req, res) => {
  const url = (req.query.url || req.body.url) as string;
  if (!url) {
    return res.status(400).json({ error: "Missing 'url' parameter" });
  }

  try {
    const cleanUrl = url.trim();
    if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
      const response = await axios.get(oembedUrl, { timeout: 4000 });
      return res.json({
        embeddable: true,
        provider: "youtube",
        title: response.data?.title || "YouTube Video",
        author: response.data?.author_name || "",
        thumbnail: response.data?.thumbnail_url || ""
      });
    } else if (cleanUrl.includes("vk.com") || cleanUrl.includes("vkvideo")) {
      const oembedUrl = `https://vk.com/services/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
      const response = await axios.get(oembedUrl, { timeout: 4000 });
      return res.json({
        embeddable: true,
        provider: "vk",
        title: response.data?.title || "VK Video",
        thumbnail: response.data?.photo_320 || ""
      });
    } else {
      return res.json({
        embeddable: true,
        provider: "unknown",
        message: "No specific oEmbed validation needed for this provider, standard streaming fallback applies"
      });
    }
  } catch (err: any) {
    console.error(`[Embed Checker Error] Url: ${url} Msg: ${err.message}`);
    return res.status(200).json({
      embeddable: false,
      error: "Видео недоступно для встраивания или является приватным",
      details: err.message
    });
  }
});

/**
 * Sends the initial state of the room to a specific client (unicast)
 * to prevent the cold start synchronization issue.
 */
function sendInitialState(client: WebSocket, room: RoomState) {
  let currentSyncTime = room.currentTime;
  if (room.playing && room.lastUpdated > 0) {
    const elapsed = (Date.now() - room.lastUpdated) / 1000;
    currentSyncTime = Math.max(0, room.currentTime + elapsed);
  }

  client.send(
    JSON.stringify({
      type: "SYNC_STATE",
      videoUrl: room.videoUrl,
      currentTime: currentSyncTime,
      isPlaying: room.playing,
    })
  );
}

// WebSocket connection lifecycle
wss.on("connection", (ws: WebSocket) => {
  console.log("WebSocket connection established");

  ws.on("message", (rawMsg: any) => {
    try {
      const msgStr = typeof rawMsg === "string" ? rawMsg : rawMsg.toString();
      const msg: WSMessage = JSON.parse(msgStr);
      
      const conn = clientConnections.get(ws);
      console.log(`[WS Server INCOMING] Room: ${conn ? conn.roomId : "none"}, User: ${conn ? conn.userId : "anonymous"}, Type: ${msg.type}`, msgStr);

      switch (msg.type) {
        case "join": {
          const { roomId, name, avatar, color, uid } = msg;
          const cleanRoomId = roomId.trim().toUpperCase();
          const userId = `u_${Math.random().toString(36).substring(2, 9)}`;

          // Create room if it doesn't exist
          if (!rooms[cleanRoomId]) {
            let defaultVideoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
            if (cleanRoomId === "KINO12") defaultVideoUrl = "https://www.youtube.com/watch?v=a50qT9bW_T0";
            else if (cleanRoomId === "MUSIC99") defaultVideoUrl = "https://vk.com/video_ext.php?oid=-220550000&id=456239149";
            else if (cleanRoomId === "RUTUBE5") defaultVideoUrl = "https://rutube.ru/video/bc04f35e9f85c479e497f1fbc71db441/";
            else if (cleanRoomId === "DZEN33") defaultVideoUrl = "https://www.youtube.com/watch?v=2K4Vb68MskE";
            else if (cleanRoomId === "ANIME44") defaultVideoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

            const parsed = parseVideoUrl(defaultVideoUrl);

            rooms[cleanRoomId] = {
              roomId: cleanRoomId,
              videoUrl: defaultVideoUrl,
              videoId: parsed.id || "dQw4w9WgXcQ",
              provider: parsed.provider || "youtube",
              playing: false,
              currentTime: 0,
              lastUpdated: Date.now(),
              members: {},
              chatHistory: [],
              isPublic: true,
              anyoneCanControl: true,
            };
          }

          const room = rooms[cleanRoomId];

          // Check if there is an existing member with the same uid (reconnecting user)
          let activeUserId = userId;
          let existingMember = uid ? Object.values(room.members).find(m => m.uid === uid) : null;
          let isHost = Object.keys(room.members).length === 0;

          if (existingMember) {
            activeUserId = existingMember.id;
            existingMember.disconnected = false;
            if (name) existingMember.name = name;
            if (avatar) existingMember.avatar = avatar;
            if (color) existingMember.color = color;
            console.log(`[WS Server JOIN] Reconnecting existing user: ${existingMember.name} (ID: ${activeUserId}) to room ${cleanRoomId}`);
          } else {
            const member: RoomMember = {
              id: activeUserId,
              name: name || `Зритель ${Math.floor(Math.random() * 900) + 100}`,
              avatar: avatar || "🍿",
              color: color || "#3B82F6",
              isHost,
              joinedAt: Date.now(),
              uid: uid || undefined,
              disconnected: false,
            };
            room.members[activeUserId] = member;
            console.log(`[WS Server JOIN] Registered new user: ${member.name} (ID: ${activeUserId}) to room ${cleanRoomId}`);
          }

          const currentMember = room.members[activeUserId];

          // Store user details in memory mapping
          clientConnections.set(ws, { ws, roomId: cleanRoomId, userId: activeUserId });

          // Send initial state via SYNC_STATE event (unicast)
          sendInitialState(ws, room);

          // Send initial state to the user
          // Calculate expected video time if room playing is true
          let currentSyncTime = room.currentTime;
          if (room.playing && room.lastUpdated > 0) {
            const elapsed = (Date.now() - room.lastUpdated) / 1000;
            currentSyncTime = Math.max(0, room.currentTime + elapsed);
          }

          const responseState: RoomState = {
            ...room,
            currentTime: currentSyncTime,
          };

          ws.send(
            JSON.stringify({
              type: "room_state",
              state: responseState,
              userId: activeUserId,
            })
          );

          // Announce to other members
          const systemMsg: ChatMessage = {
            id: `sys_${messageCount++}_${Date.now()}`,
            type: "system",
            text: `👋 ${currentMember.avatar} ${currentMember.name} присоединился к комнате`,
            timestamp: Date.now(),
          };
          room.chatHistory.push(systemMsg);
          if (room.chatHistory.length > 50) room.chatHistory.shift();

          broadcastToRoom(cleanRoomId, {
            type: "members_update",
            members: room.members,
          }, ws);

          broadcastToRoom(cleanRoomId, {
            type: "chat_broadcast",
            message: systemMsg,
          }, ws);

          break;
        }

        case "change_video": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || (!member.isHost && !room.anyoneCanControl)) return; // Only host can change video unless sharing is enabled

          const parsed = parseVideoUrl(msg.videoUrl);
          if (parsed.id) {
            room.videoUrl = msg.videoUrl;
            room.videoId = parsed.id;
            room.provider = parsed.provider;
            room.playing = false;
            room.currentTime = 0;
            room.lastUpdated = Date.now();

            const systemMsg: ChatMessage = {
              id: `sys_${messageCount++}_${Date.now()}`,
              type: "system",
              text: `🎬 ${member.name} сменил видео`,
              timestamp: Date.now(),
            };
            room.chatHistory.push(systemMsg);
            if (room.chatHistory.length > 50) room.chatHistory.shift();

            // Broadcast state update to everyone in the room
            broadcastToRoom(conn.roomId, {
              type: "room_state",
              state: room,
              userId: "",
            });
          }
          break;
        }

        case "playback_change": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || (!member.isHost && !room.anyoneCanControl)) {
            // Unicast the correct room state back to unauthorized client
            sendInitialState(ws, room);
            return;
          }

          // Update room reference point
          room.playing = msg.playing;
          room.currentTime = msg.currentTime;
          room.lastUpdated = Date.now();

          // Broadcast playback change
          broadcastToRoom(
            conn.roomId,
            {
              type: "playback_change",
              playing: msg.playing,
              currentTime: msg.currentTime,
              issuerId: conn.userId,
              timestamp: Date.now(),
            },
            ws // Skip source client to prevent echo feedback loop
          );
          break;
        }

        case "seek": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || (!member.isHost && !room.anyoneCanControl)) {
            // Unicast the correct room state back to unauthorized client
            sendInitialState(ws, room);
            return;
          }

          room.currentTime = msg.currentTime;
          room.lastUpdated = Date.now();

          // Broadcast seek event
          broadcastToRoom(
            conn.roomId,
            {
              type: "seek",
              currentTime: msg.currentTime,
              issuerId: conn.userId,
              timestamp: Date.now(),
            },
            ws // Skip source client
          );
          break;
        }

        case "heartbeat_sync": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || !member.isHost) return; // Only host can send heartbeats

          // Update room reference point
          room.currentTime = msg.currentTime;
          room.lastUpdated = Date.now();

          // Broadcast heartbeat to other clients
          broadcastToRoom(
            conn.roomId,
            {
              type: "heartbeat_sync",
              currentTime: msg.currentTime,
              playing: room.playing,
              timestamp: Date.now(),
            },
            ws // Skip source client
          );
          break;
        }

        case "chat_message": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member) return;

          const chatMsg: ChatMessage = {
            id: `msg_${messageCount++}_${Date.now()}`,
            type: "chat",
            userId: conn.userId,
            name: member.name,
            avatar: member.avatar,
            color: member.color,
            text: msg.text,
            timestamp: Date.now(),
          };

          room.chatHistory.push(chatMsg);
          if (room.chatHistory.length > 100) room.chatHistory.shift();

          broadcastToRoom(conn.roomId, {
            type: "chat_broadcast",
            message: chatMsg,
          });

          break;
        }

        case "set_privacy": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || !member.isHost) return; // Only host has access to change privacy

          if (typeof msg.isPublic === "boolean") {
            room.isPublic = msg.isPublic;

            const systemMsg: ChatMessage = {
              id: `sys_${messageCount++}_${Date.now()}`,
              type: "system",
              text: room.isPublic 
                ? `🌐 ${member.name} сделал комнату публичной` 
                : `🔒 ${member.name} сделал комнату приватной (доступ только по ссылке)`,
              timestamp: Date.now(),
            };
            room.chatHistory.push(systemMsg);
            if (room.chatHistory.length > 50) room.chatHistory.shift();

            // Broadcast room state update to everyone in the room
            broadcastToRoom(conn.roomId, {
              type: "room_state",
              state: room,
              userId: "",
            });
          }
          break;
        }

        case "play": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || (!member.isHost && !room.anyoneCanControl)) return;

          room.playing = true;
          if (msg.currentTime !== undefined) {
            room.currentTime = msg.currentTime;
          }
          room.lastUpdated = Date.now();

          // Broadcast state change as playback_change
          broadcastToRoom(conn.roomId, {
            type: "playback_change",
            playing: true,
            currentTime: room.currentTime,
            issuerId: conn.userId,
          }, ws);
          break;
        }

        case "pause": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || (!member.isHost && !room.anyoneCanControl)) return;

          room.playing = false;
          if (msg.currentTime !== undefined) {
            room.currentTime = msg.currentTime;
          }
          room.lastUpdated = Date.now();

          // Broadcast state change as playback_change
          broadcastToRoom(conn.roomId, {
            type: "playback_change",
            playing: false,
            currentTime: room.currentTime,
            issuerId: conn.userId,
          }, ws);
          break;
        }

        case "sendTime": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || (!member.isHost && !room.anyoneCanControl)) return;

          if (msg.currentTime !== undefined) {
            room.currentTime = msg.currentTime;
            room.lastUpdated = Date.now();

            // Broadcast state change as seek
            broadcastToRoom(conn.roomId, {
              type: "seek",
              currentTime: msg.currentTime,
              issuerId: conn.userId,
            }, ws);
          }
          break;
        }

        case "toggle_mic": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member) return;

          if (msg.enabled) {
            if (member.micBlockedByHost || (room.allMuted && !member.isHost)) {
              member.micEnabled = false;
            } else {
              member.micEnabled = true;
            }
          } else {
            member.micEnabled = false;
          }

          broadcastToRoom(conn.roomId, {
            type: "members_update",
            members: room.members,
          });
          break;
        }

        case "mute_member": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || !member.isHost) return;

          const { targetUserId, blocked } = msg;
          const targetMember = room.members[targetUserId];
          if (targetMember) {
            targetMember.micBlockedByHost = blocked;
            if (blocked) {
              targetMember.micEnabled = false;
            }

            const systemMsg: ChatMessage = {
              id: `sys_${messageCount++}_${Date.now()}`,
              type: "system",
              text: blocked 
                ? `🔇 Создатель заблокировал микрофон участнику ${targetMember.name}` 
                : `🔊 Создатель разблокировал микрофон участнику ${targetMember.name}`,
              timestamp: Date.now(),
            };
            room.chatHistory.push(systemMsg);
            if (room.chatHistory.length > 50) room.chatHistory.shift();

            broadcastToRoom(conn.roomId, {
              type: "room_state",
              state: room,
              userId: "",
            });
          }
          break;
        }

        case "kick_member": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || !member.isHost) return;

          const { targetUserId } = msg;
          const targetMember = room.members[targetUserId];
          if (targetMember) {
            let targetSocket: WebSocket | null = null;
            for (const [socket, info] of clientConnections.entries()) {
              if (info.roomId === conn.roomId && info.userId === targetUserId) {
                targetSocket = socket;
                break;
              }
            }

            const systemMsg: ChatMessage = {
              id: `sys_${messageCount++}_${Date.now()}`,
              type: "system",
              text: `🚫 ${targetMember.name} был исключен создателем комнаты`,
              timestamp: Date.now(),
            };
            room.chatHistory.push(systemMsg);
            if (room.chatHistory.length > 50) room.chatHistory.shift();

            if (targetSocket) {
              try {
                targetSocket.send(JSON.stringify({ type: "kicked_notification" }));
                targetSocket.close();
              } catch (e) {
                console.error("Error closing target socket", e);
              }
            }

            delete room.members[targetUserId];

            broadcastToRoom(conn.roomId, {
              type: "room_state",
              state: room,
              userId: "",
            });
          }
          break;
        }

        case "mute_all_mics": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || !member.isHost) return;

          const { mute } = msg;
          room.allMuted = mute;

          if (mute) {
            for (const uid in room.members) {
              if (!room.members[uid].isHost) {
                room.members[uid].micEnabled = false;
              }
            }
          }

          const systemMsg: ChatMessage = {
            id: `sys_${messageCount++}_${Date.now()}`,
            type: "system",
            text: mute 
              ? `🔇 Создатель отключил микрофоны всем участникам!` 
              : `🔊 Создатель разрешил участникам использовать микрофоны`,
            timestamp: Date.now(),
          };
          room.chatHistory.push(systemMsg);
          if (room.chatHistory.length > 50) room.chatHistory.shift();

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: room,
            userId: "",
          });
          break;
        }

        case "remote_toggle_mic": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || !member.isHost) return;

          const { targetUserId, enabled } = msg;
          const targetMember = room.members[targetUserId];
          if (targetMember) {
            // Update state
            if (!enabled) {
              targetMember.micEnabled = false;
            } else {
              // If enabling, make sure they are not blocked
              targetMember.micBlockedByHost = false;
            }

            // Find target socket to send direct control command
            for (const [socket, info] of clientConnections.entries()) {
              if (info.roomId === conn.roomId && info.userId === targetUserId) {
                try {
                  socket.send(
                    JSON.stringify({
                      type: "remote_toggle_mic_request",
                      enabled,
                    })
                  );
                } catch (e) {
                  console.error("Error sending remote mic request", e);
                }
                break;
              }
            }

            const systemMsg: ChatMessage = {
              id: `sys_${messageCount++}_${Date.now()}`,
              type: "system",
              text: enabled 
                ? `🎙️ Создатель включил микрофон участнику ${targetMember.name}` 
                : `🔇 Создатель выключил микрофон участнику ${targetMember.name}`,
              timestamp: Date.now(),
            };
            room.chatHistory.push(systemMsg);
            if (room.chatHistory.length > 50) room.chatHistory.shift();

            broadcastToRoom(conn.roomId, {
              type: "room_state",
              state: room,
              userId: "",
            });
          }
          break;
        }

        case "toggle_control_sharing": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const member = room.members[conn.userId];
          if (!member || !member.isHost) return;

          const { anyoneCanControl } = msg;
          room.anyoneCanControl = anyoneCanControl;

          const systemMsg: ChatMessage = {
            id: `sys_${messageCount++}_${Date.now()}`,
            type: "system",
            text: anyoneCanControl 
              ? `🎮 Создатель передал пульт управления всем участникам комнаты!` 
              : `👑 Создатель забрал пульт управления (управление только для хоста)`,
            timestamp: Date.now(),
          };
          room.chatHistory.push(systemMsg);
          if (room.chatHistory.length > 50) room.chatHistory.shift();

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: room,
            userId: "",
          });
          break;
        }

        case "react_message": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (!room) return;

          const { messageId, emoji } = msg;
          const chatMsg = room.chatHistory.find((m) => m.id === messageId);
          if (!chatMsg) return;

          chatMsg.reactions = chatMsg.reactions || {};
          const list = chatMsg.reactions[emoji] || [];

          if (list.includes(conn.userId)) {
            chatMsg.reactions[emoji] = list.filter((id) => id !== conn.userId);
          } else {
            chatMsg.reactions[emoji] = [...list, conn.userId];
          }

          if (chatMsg.reactions[emoji].length === 0) {
            delete chatMsg.reactions[emoji];
          }

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: room,
            userId: "",
          });
          break;
        }

        case "exit_room": {
          const conn = clientConnections.get(ws);
          if (!conn) return;

          const room = rooms[conn.roomId];
          if (room) {
            const leavingMember = room.members[conn.userId];
            if (leavingMember) {
              if (leavingMember.isHost) {
                // Delete the room immediately if the host/creator explicitly exits
                console.log(`Room ${conn.roomId} explicitly deleted by host ${leavingMember.name}`);
                broadcastToRoom(conn.roomId, {
                  type: "room_closed_notification",
                });
                delete rooms[conn.roomId];
              } else {
                // Regular member exits
                delete room.members[conn.userId];
                console.log(`User ${leavingMember.name} (ID: ${conn.userId}) explicitly exited room ${conn.roomId}`);
                
                const goodbyeMsg: ChatMessage = {
                  id: `sys_${messageCount++}_${Date.now()}`,
                  type: "system",
                  text: `🚪 ${leavingMember.avatar} ${leavingMember.name} покинул комнату`,
                  timestamp: Date.now(),
                };
                room.chatHistory.push(goodbyeMsg);

                broadcastToRoom(conn.roomId, {
                  type: "members_update",
                  members: room.members,
                });

                broadcastToRoom(conn.roomId, {
                  type: "chat_broadcast",
                  message: goodbyeMsg,
                });
              }
            }
          }
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.error("Error processing websocket message", e);
    }
  });

  ws.on("close", () => {
    const conn = clientConnections.get(ws);
    if (!conn) return;

    const { roomId, userId } = conn;
    clientConnections.delete(ws);

    const room = rooms[roomId];
    if (room) {
      const leavingMember = room.members[userId];
      if (leavingMember) {
        // Temporarily mark the member as disconnected instead of deleting immediately.
        // This handles browser reloads and network dropouts perfectly.
        leavingMember.disconnected = true;
        leavingMember.disconnectedAt = Date.now();
        console.log(`[WS Server CLOSE] User ${leavingMember.name} (ID: ${userId}) disconnected from room ${roomId}. Starting grace period.`);
      }

      // Check if there are any actively connected members left
      const remainingConnected = Object.values(room.members).filter(m => !m.disconnected);

      if (remainingConnected.length === 0) {
        // Clean up empty rooms immediately
        console.log(`Room ${roomId} has been deleted because all members disconnected`);
        delete rooms[roomId];
      } else {
        // If the host disconnected, give a 15-second grace period to reconnect before deleting the room
        if (leavingMember?.isHost) {
          setTimeout(() => {
            const currentRoom = rooms[roomId];
            const checkMember = currentRoom?.members[userId];
            if (currentRoom && checkMember && checkMember.disconnected) {
              console.log(`Grace period expired for room ${roomId}. Host ${checkMember.name} did not reconnect. Deleting room.`);
              broadcastToRoom(roomId, {
                type: "room_closed_notification",
              });
              delete rooms[roomId];
            }
          }, 15000); // 15 seconds grace period
        }

        // Notify remaining members of the state update
        broadcastToRoom(roomId, {
          type: "members_update",
          members: room.members,
        });
      }
    }
  });
});

// Listen to standard upgrade request
server.on("upgrade", (req, socket, head) => {
  try {
    const pathname = (req.url || "").split("?")[0];
    // Upgrade if path is root ws
    if (pathname === "/ws" || pathname === "/") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  } catch (err) {
    console.error("Error during WebSocket upgrade:", err);
    socket.destroy();
  }
});

// Capture any wss error
wss.on("error", (err) => {
  console.error("WebSocket server (wss) encountered an error:", err);
});

// Vite & Static file handler
async function startFullStackServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

// Periodic cleanup for stale rooms and disconnected members
setInterval(() => {
  const now = Date.now();
  for (const roomId of Object.keys(rooms)) {
    const room = rooms[roomId];
    if (!room) continue;

    const activeMembers = Object.values(room.members).filter(m => !m.disconnected);
    
    // If there are no active members at all
    if (activeMembers.length === 0) {
      // Check if all members have been disconnected for more than 15 seconds
      const longestDisconnectTime = Object.values(room.members).length > 0 
        ? Math.max(...Object.values(room.members).map(m => m.disconnectedAt || 0))
        : 0;
      
      const timeSinceDisconnect = now - longestDisconnectTime;
      if (timeSinceDisconnect > 15000 || Object.keys(room.members).length === 0) {
        console.log(`[Stale Cleanup] Room ${roomId} has been empty for more than 15s (or has no members). Deleting.`);
        delete rooms[roomId];
      }
    } else {
      // Clean up individual disconnected non-host members who have been gone for more than 15 seconds
      let updated = false;
      for (const memberId of Object.keys(room.members)) {
        const member = room.members[memberId];
        if (member.disconnected && !member.isHost) {
          const disconnectAge = now - (member.disconnectedAt || 0);
          if (disconnectAge > 15000) {
            console.log(`[Stale Cleanup] Removing disconnected user ${member.name} from room ${roomId}`);
            delete room.members[memberId];
            updated = true;
          }
        }
      }
      
      if (updated) {
        // Broadcast members update
        broadcastToRoom(roomId, {
          type: "members_update",
          members: room.members,
        });
      }
    }
  }
}, 5000); // Check every 5 seconds

startFullStackServer();
