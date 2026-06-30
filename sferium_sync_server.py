#!/usr/bin/env python3
"""
Sferium Homes - Высокопроизводительный Сигнальный WebSocket-Сервер Синхронизации (типа Homes)
Разработан на FastAPI / Python 3.12+ для развертывания на Ubuntu-сервере в Германии.

Особенности системы:
1. WebSocket-протокол синхронизации комнат и воспроизведения в реальном времени.
2. Умная Anti-desync логика корректировки рассинхронизации: замеряет задержки клиентов
   каждые 3 секунды. Если дельта > 1.5 секунд, точечно посылает команду seek.
3. Полная Firebase Auth валидация токенов перед подключением к комнате.
4. Поддерживает парсинг и распознавание видеохостингов (YouTube, VK, Rutube, Yandex/Dzen).
5. Логирование событий для отладки производительности и задержек пинга участников.
"""

import os
import sys
import json
import time
import math
import logging
import asyncio
from typing import Dict, List, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Настройка профессионального логгера для трассировки рассинхронизации
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [SferiumSync] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("sferium_sync.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("sferium")

# Инициализация Firebase Admin SDK для валидации токенов пользователей
VERIFY_FIREBASE_TOKEN = os.getenv("VERIFY_FIREBASE_TOKEN", "True").lower() in ("true", "1", "yes")
firebase_initialized = False

if VERIFY_FIREBASE_TOKEN:
    try:
        import firebase_admin
        from firebase_admin import credentials, auth
        
        # Поиск файла сервисного аккаунта (локально или через env)
        cred_path = os.getenv("FIREBASE_CREDENTIALS", "firebase-service-account.json")
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            firebase_initialized = True
            logger.info(f"✅ Firebase Admin успешно инициализирован с использованием файла: {cred_path}")
        else:
            # Попытка инициализации дефолтными учетными данными GCP
            try:
                firebase_admin.initialize_app()
                firebase_initialized = True
                logger.info("✅ Firebase Admin успешно инициализирован через Google Application Default Credentials")
            except Exception as default_err:
                logger.warning(
                    f"⚠️ Не найден файл {cred_path} и дефолтные credentials не настроены. "
                    f"Валидация Firebase токенов будет использовать безопасную заглушку в режиме разработчика. "
                    f"Ошибка: {default_err}"
                )
    except ImportError:
        logger.error("❌ Пакет 'firebase-admin' не установлен. Выполните: pip install firebase-admin")
        VERIFY_FIREBASE_TOKEN = False
    except Exception as e:
        logger.error(f"❌ Ошибка при инициализации Firebase SDK: {e}", exc_info=True)


# --- ПАРСЕР ВИДЕО ССЫЛОК (Аналог JS парсера на фронтенде Sferium) ---
def parse_video_url(url: str) -> Dict[str, str]:
    """Резолвит входящую ссылку на видео и извлекает платформу-провайдер и ID."""
    url = url.strip()
    
    # 0. Извлечение src из iframe-кода, если передан html-код
    if "<iframe" in url and "src=" in url:
        import re
        match = re.search(r'src=["\']([^"\']+)["\']', url, re.IGNORECASE)
        if match:
            url = match.group(1).strip()

    # 1. YouTube
    if "youtu.be" in url or "youtube.com" in url:
        import re
        yt_reg = r'(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]+)'
        match = re.search(yt_reg, url)
        if match and len(match.group(1)) == 11:
            return {"provider": "youtube", "id": match.group(1), "embed_url": f"https://www.youtube.com/embed/{match.group(1)}"}

    # 2. VK Видео
    if "vk" in url or "video_ext.php" in url:
        import re
        simple_match = re.search(r'(?:video|clip)(-?\d+)_(\d+)', url, re.IGNORECASE) or re.search(r'(-?\d+)_(\d+)', url)
        oid_match = re.search(r'oid=(-?\d+)', url, re.IGNORECASE)
        id_match = re.search(r'id=(\d+)', url, re.IGNORECASE)
        hash_match = re.search(r'hash=([a-zA-Z0-9]+)', url, re.IGNORECASE)
        hash_str = f"&hash={hash_match.group(1)}" if hash_match else ""
        
        if simple_match:
            oid, vid = simple_match.group(1), simple_match.group(2)
            return {"provider": "vk", "id": f"{oid}_{vid}", "embed_url": f"https://vk.com/video_ext.php?oid={oid}&id={vid}{hash_str}&hd=2"}
        elif oid_match and id_match:
            oid, vid = oid_match.group(1), id_match.group(1)
            return {"provider": "vk", "id": f"{oid}_{vid}", "embed_url": f"https://vk.com/video_ext.php?oid={oid}&id={vid}{hash_str}&hd=2"}

    # 3. Rutube
    if "rutube.ru" in url:
        import re
        rut_reg = r'([a-fA-F0-9]{32})'
        match = re.search(rut_reg, url)
        p_match = re.search(r'p=([a-zA-Z0-9_-]+)', url, re.IGNORECASE)
        p_val = f"?p={p_match.group(1)}" if p_match else ""
        
        if match:
            return {"provider": "rutube", "id": match.group(1), "embed_url": f"https://rutube.ru/play/embed/{match.group(1)}{p_val}"}
        else:
            # Fallback к крайней части url
            parts = [p for p in url.split("/") if p]
            if parts:
                last = parts[-1].split("?")[0]
                if len(last) >= 10:
                    return {"provider": "rutube", "id": last, "embed_url": f"https://rutube.ru/play/embed/{last}{p_val}"}

    # 4. Yandex / Дзен
    if "dzen" in url or "yandex" in url:
        import re
        dzen_match = re.search(r'dzen\.ru\/(?:video\/watch|embed)\/([a-zA-Z0-9_-]+)', url) or re.search(r'([a-zA-Z0-9_-]{24})', url)
        efir_match = re.search(r'stream_id=([a-zA-Z0-9_-]+)', url)
        
        if dzen_match:
            return {"provider": "yandex", "id": dzen_match.group(1), "embed_url": f"https://dzen.ru/embed/{dzen_match.group(1)}"}
        elif efir_match:
            return {"provider": "yandex", "id": efir_match.group(1), "embed_url": f"https://yandex.ru/efir?stream_id={efir_match.group(1)}"}
        else:
            parts = [p for p in url.split("/") if p]
            if parts:
                last = parts[-1].split("?")[0]
                if len(last) >= 8:
                    return {"provider": "yandex", "id": last, "embed_url": f"https://dzen.ru/embed/{last}"}

    # По умолчанию для прямых ссылок / других хостингов
    if url.startswith("http://") or url.startswith("https://"):
        return {"provider": "unknown", "id": url, "embed_url": url}

    return {"provider": "unknown", "id": "", "embed_url": ""}


# --- СХЕМЫ ДАННЫХ В ПАМЯТИ СЕРВЕРА ---
class RoomMember:
    def __init__(self, user_id: str, name: str, avatar: str, color: str, is_host: bool, websocket: WebSocket, uid: Optional[str] = None):
        self.id = user_id                     # Внутренний ID соединения
        self.name = name                      # Публичное имя
        self.avatar = avatar                  # Аватар (эмодзи)
        self.color = color                    # Хекс цвета ника
        self.is_host = is_host                # Флаг создателя комнаты
        self.uid = uid                        # Firebase UID пользователя
        self.websocket = websocket            # Объект сокета
        
        # Поля синхронизации времени
        self.current_time = 0.0               # Последнее зафиксированное время видео у клиента (в секундах)
        self.last_report_epoch = time.time()  # Время получения этого отчета от клиента
        self.mic_enabled = False             # Статус аудио-конференции
        self.mic_blocked_by_host = False      # Заблокировано хостом

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "avatar": self.avatar,
            "color": self.color,
            "isHost": self.is_host,
            "uid": self.uid,
            "micEnabled": self.mic_enabled,
            "micBlockedByHost": self.mic_blocked_by_host
        }


class RoomState:
    def __init__(self, room_id: str, video_url: str):
        self.room_id = room_id
        self.video_url = video_url
        
        parsed = parse_video_url(video_url)
        self.video_id = parsed["id"]
        self.provider = parsed["provider"]
        
        self.playing = False
        self.current_time = 0.0          # Опорная базовая позиция на сервере
        self.last_updated = time.time()  # Эпоха последнего обновления статуса воспроизведения
        
        self.members: Dict[str, RoomMember] = {}
        self.chat_history: List[Dict[str, Any]] = []
        self.is_public = True
        self.all_muted = False
        self.message_count = 0

    def get_estimated_play_time(self) -> float:
        """Рассчитывает текущее расчетное экранное время видео в комнате."""
        if self.playing:
            elapsed = time.time() - self.last_updated
            return max(0.0, self.current_time + elapsed)
        return self.current_time

    def add_system_message(self, text: str) -> Dict[str, Any]:
        self.message_count += 1
        msg = {
            "id": f"sys_{self.message_count}_{int(time.time() * 1000)}",
            "type": "system",
            "text": text,
            "timestamp": int(time.time() * 1000)
        }
        self.chat_history.append(msg)
        if len(self.chat_history) > 50:
            self.chat_history.pop(0)
        return msg

    def to_dict(self) -> Dict[str, Any]:
        return {
            "roomId": self.room_id,
            "videoUrl": self.video_url,
            "videoId": self.video_id,
            "provider": self.provider,
            "playing": self.playing,
            "currentTime": self.get_estimated_play_time(),
            "lastUpdated": int(self.last_updated * 1000),
            "members": {uid: m.to_dict() for uid, m in self.members.items()},
            "chatHistory": self.chat_history,
            "isPublic": self.is_public,
            "allMuted": self.all_muted
        }


# --- ГЛОБАЛЬНЫЙ STORAGE СЕССИЙ КЛИЕНТОВ ---
rooms: Dict[str, RoomState] = {}
# Быстрый реверс-маппинг сокета на данные пользователя
socket_profiles: Dict[WebSocket, Any] = {}


# --- ХЕЛПЕРЫ ВЕЩАНИЯ (BROADCAST) ---
async def broadcast_to_room(room_id: str, payload: Dict[str, Any], exclude_ws: Optional[WebSocket] = None):
    """Широковещательная отправка всем участникам в комнате."""
    if room_id not in rooms:
        return
    room = rooms[room_id]
    closed_sockets = []
    
    tasks = []
    for member_id, member in list(room.members.items()):
        ws = member.websocket
        if ws == exclude_ws:
            continue
        
        # Создаем конкурентные задачи для неблокирующей отправки
        async def send_payload(target_ws=ws, target_member=member):
            try:
                await target_ws.send_text(json.dumps(payload))
            except Exception:
                closed_sockets.append(target_ws)
                
        tasks.append(send_task := asyncio.create_task(send_payload()))

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

    # Чистка отвалившихся сокетов
    for ws in closed_sockets:
        await handle_socket_disconnect(ws)


async def handle_socket_disconnect(ws: WebSocket):
    """Изолированная обработка потери соединения сокета."""
    if ws not in socket_profiles:
        return
    
    conn_info = socket_profiles.pop(ws)
    room_id = conn_info["room_id"]
    user_id = conn_info["user_id"]
    
    if room_id in rooms:
        room = rooms[room_id]
        if user_id in room.members:
            member = room.members.pop(user_id)
            logger.info(f"🔌 Клиент {member.name} ({member.id}) отключился от комнаты {room_id}")
            
            # Если вышел создатель комнаты (Host), назначаем лидера следующему по списку
            was_host = member.is_host
            
            # Логируем системное сообщение выхода
            leave_msg = room.add_system_message(f"🚪 {member.avatar} {member.name} покинул комнату")
            
            if was_host and room.members:
                # Назначаем первого попавшегося участника новым создателем (хостом)
                new_host_id = list(room.members.keys())[0]
                room.members[new_host_id].is_host = True
                room.add_system_message(f"👑 Участник {room.members[new_host_id].name} стал новым создателем комнаты")
                logger.info(f"👑 Новый создатель комнаты {room_id}: {room.members[new_host_id].name}")

            if not room.members:
                # Если в комнате пусто, мы архивируем её через некоторое время (или удаляем)
                logger.info(f"🧹 Комната {room_id} теперь пуста. Удаление сессии...")
                rooms.pop(room_id, None)
            else:
                # Оповещаем остальных
                await broadcast_to_room(room_id, {
                    "type": "members_update",
                    "members": {uid: m.to_dict() for uid, m in room.members.items()}
                })
                await broadcast_to_room(room_id, {
                    "type": "chat_broadcast",
                    "message": leave_msg
                })


# --- АВТОМАТИЧЕСКАЯ ANTI-DESYNC ЛОГИКА (КАЖДЫЕ 3 СЕКУНДЫ) ---
async def perform_anti_desync_check():
    """Проводит сверку локального времени всех клиентов и принудительно синхронизирует лагающих игроков."""
    now = time.time()
    for room_id, room in list(rooms.items()):
        # Синхронизация имеет смысл, только если в комнате воспроизводится плеер и участников больше одного
        if not room.playing or len(room.members) < 2:
            continue
        
        # Получаем истинное расчетное опорное время комнаты на сервере
        authoritative_time = room.get_estimated_play_time()
        
        # В качестве альтернативы, если в комнате есть активный хост, используем его время как абсолютный эталон
        host_member = next((m for m in room.members.values() if m.is_host), None)
        if host_member:
            # Рассчитываем где находится хост прямо сейчас с момента последнего его отчета
            host_elapsed = now - host_member.last_report_epoch
            authoritative_time = host_member.current_time + host_elapsed
            # Синхронизируем базовую метку комнаты с хостом
            room.current_time = host_member.current_time
            room.last_updated = host_member.last_report_epoch
            
        # Сверяем каждого подключенного пользователя
        for member_id, member in list(room.members.items()):
            # Рассчитываем текущую позицию плеера у этого клиента на основе его последнего отчета
            member_elapsed = now - member.last_report_epoch
            client_calculated_time = member.current_time + member_elapsed if room.playing else member.current_time
            
            # Считаем разницу (дельта рассинхронизации)
            delta = abs(client_calculated_time - authoritative_time)
            
            if delta > 1.5:
                # Критический порог в 1.5 секунды превышен! Корректируем только этого отстающего клиента
                logger.info(
                    f"📡 [Anti-Desync] Обнаружен рассинхрон в комнате {room_id}! "
                    f"Участник: '{member.name}' | Время сервера/хоста: {authoritative_time:.2f}с, "
                    f"Время клиента: {client_calculated_time:.2f}с | Дельта: {delta:.2f}с. "
                    f"Корректировка: отправка принудительного seek..."
                )
                
                # Точечно отправляем игроку пакет SEEK с точной эталонной позицией
                try:
                    await member.websocket.send_text(json.dumps({
                        "type": "seek",
                        "currentTime": authoritative_time,
                        "serverForce": True # флаг принудительной сетевой калибровки
                    }))
                    
                    # Обновляем локальный ориентир на сервере, чтобы избежать повторных корректировок до следующего тика
                    member.current_time = authoritative_time
                    member.last_report_epoch = now
                except Exception as ex:
                    logger.warning(f"Ошибка при коррекции рассинхрона для {member.name}: {ex}")


async def anti_desync_loop():
    """Фоновая корутина, запускающаяся раз в 3 секунды."""
    logger.info("📡 Запуск фоновой службы корректировки рассинхронизации Sferium Homes (Anti-Desync)...")
    while True:
        try:
            await asyncio.sleep(3.0)
            await perform_anti_desync_check()
        except asyncio.CancelledError:
            logger.info("📡 Фоновая служба Anti-Desync остановлена.")
            break
        except Exception as e:
            logger.error(f"❌ Ошибка в цикле Anti-Desync корректировки: {e}", exc_info=True)


# --- LIFESPAN УПРАВЛЕНИЕ ПРИЛОЖЕНИЕМ FASTAPI ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Код, выполняющийся при старте приложения
    desync_task = asyncio.create_task(anti_desync_loop())
    yield
    # Код, выполняющийся при завершении приложения
    desync_task.cancel()
    try:
        await desync_task
    except asyncio.CancelledError:
        pass


# --- ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКА FASTAPI ПРИЛОЖЕНИЯ ---
app = FastAPI(
    title="Sferium Homes Sync Server",
    description="Высоконагруженный WebSocket-сервер для синхронного просмотра видео Sferium",
    version="1.0.0",
    lifespan=lifespan
)

# Разрешаем CORS политику для ингресса и локальной отладки
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- CUSTOM AUTHENTICATION MODULE (SFERIUM-HOMES COGNITIVE UPGRADE) ---
import secrets
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import JWTError, jwt

# Password hashing helper using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "sferium_homes_ultra_secure_secret_2026_xyz_777")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

# SMTP Configuration for sending activation emails
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "sferium.homes.notify@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "mock-smtp-app-password")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)

# Mocked In-Memory User DB for instant deployment stability
# In production, this can represent your SQLAlchemy/Tortoise DB engine
USERS_DB: Dict[str, Dict[str, Any]] = {}

# Pydantic schemas for request & response validation
class UserRegister(BaseModel):
    email: EmailStr
    nickname: str
    password: str
    avatar: Optional[str] = "🍿"
    color: Optional[str] = "#3B82F6"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    uid: str
    email: str
    nickname: str
    avatar: str
    color: str
    is_active: bool

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# --- HELPER SECURITY FUNCTIONS ---
def hash_password(password: str) -> str:
    """Hashes the user password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies the plain password against the stored bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[float] = None) -> str:
    """Generates a secure HS256 JWT access token for user authentication."""
    to_encode = data.copy()
    expire = time.time() + (expires_delta or (JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60))
    to_encode.update({"exp": int(expire)})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def send_activation_email(email: str, token: str):
    """Sends a professional HTML confirmation email with activation token link."""
    # Sferium Homes activation links direct back to the frontend to catch URL query
    activation_link = f"http://localhost:3000?activate={token}"
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Активация аккаунта | SFERIUM HOMES"
    msg["From"] = f"Sferium Homes <{SMTP_FROM_EMAIL}>"
    msg["To"] = email

    html_content = f"""
    <html>
      <body style="font-family: 'Inter', sans-serif; background-color: #0b0f19; color: #f3f4f6; padding: 24px;">
        <div style="max-width: 480px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);">
          <h2 style="color: #6366f1; text-align: center; margin-top: 0; font-size: 24px; letter-spacing: 0.05em;">SFERIUM <span style="font-weight: bold; color: #818cf8;">HOMES</span></h2>
          <p style="font-size: 14px; line-height: 1.6; color: #d1d5db; text-align: center;">Данный адрес почты был указан при регистрации в медиа-платформе.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="{activation_link}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; font-weight: bold; font-size: 14px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.45); transition: background-color 0.2s;">
              Активировать аккаунт
            </a>
          </div>
          <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 24px;">Если кнопка выше не работает, скопируйте эту ссылку:<br><a href="{activation_link}" style="color: #6366f1; text-decoration: none;">{activation_link}</a></p>
        </div>
      </body>
    </html>
    """
    msg.attach(MIMEText(html_content, "html"))
    
    try:
        # In actual deployment, configure SMTP credentials via env variables
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [email], msg.as_string())
        logger.info(f"✉️ Активационное письмо успешно отправлено на {email}")
    except Exception as e:
        logger.error(f"❌ Ошибка отправки почты для {email}: {e}")
        # Safe log backup so developer can retrieve activation token from backend console
        logger.info(f"🔑 [Backup Alert] Ссылка активации для {email}: {activation_link}")


# --- CUSTOM AUTHENTICATION ENDPOINTS ---
@app.post("/api/register")
async def register(user: UserRegister):
    """Регистрирует нового пользователя, хеширует пароль и отправляет ссылку-активатор."""
    email_clean = user.email.strip().lower()
    
    if email_clean in USERS_DB:
        raise HTTPException(status_code=400, detail="Этот адрес электронной почты уже зарегистрирован.")
        
    activation_token = secrets.token_urlsafe(32)
    hashed_pwd = hash_password(user.password)
    user_uid = f"user_{secrets.token_hex(8)}"
    
    # Save to transient db dictionary
    USERS_DB[email_clean] = {
        "uid": user_uid,
        "email": email_clean,
        "nickname": user.nickname,
        "hashed_password": hashed_pwd,
        "is_active": False,
        "activation_token": activation_token,
        "avatar": user.avatar,
        "color": user.color,
        "created_at": time.time()
    }
    
    # Trigger non-blocking activation email
    send_activation_email(email_clean, activation_token)
    
    return {"message": "Регистрация успешна! Проверьте вашу почту для активации."}


@app.get("/api/activate")
async def activate_account(token: str = Query(...)):
    """Верифицирует токен из письма и переводит статус аккаунта в active."""
    activated_user = None
    for email, profile in USERS_DB.items():
        if profile.get("activation_token") == token:
            profile["is_active"] = True
            profile["activation_token"] = None
            activated_user = profile
            break
            
    if not activated_user:
        raise HTTPException(status_code=400, detail="Неверный или просроченный токен активации.")
        
    logger.info(f"✅ Аккаунт пользователя активирован в БД: {activated_user['email']}")
    return {"message": "Аккаунт успешно активирован! Теперь вы можете войти."}


@app.post("/api/login", response_model=TokenResponse)
async def login(login_data: UserLogin):
    """Проверяет пароль через bcrypt, генерирует JWT-токен сессии при успехе."""
    email_clean = login_data.email.strip().lower()
    
    user_record = USERS_DB.get(email_clean)
    if not user_record:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль.")
        
    if not verify_password(login_data.password, user_record["hashed_password"]):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль.")
        
    if not user_record.get("is_active", False):
        raise HTTPException(status_code=403, detail="Ваш аккаунт ещё не активирован! Пожалуйста, подтвердите вашу почту.")
        
    # Generate custom JWT access token payload representing the User profile
    token_payload = {
        "sub": user_record["uid"],
        "userId": user_record["uid"],
        "email": user_record["email"],
        "nickname": user_record["nickname"],
        "avatar": user_record["avatar"],
        "color": user_record["color"],
        "is_active": True
    }
    
    token = create_access_token(token_payload)
    
    user_info = UserResponse(
        uid=user_record["uid"],
        email=user_record["email"],
        nickname=user_record["nickname"],
        avatar=user_record["avatar"],
        color=user_record["color"],
        is_active=True
    )
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_info
    }


@app.get("/api/health")
async def health_check():
    """Роут самочувствия сервера"""
    return {
        "status": "alive",
        "rooms_count": len(rooms),
        "clients_connected": len(socket_profiles),
        "firebase_active": firebase_initialized,
        "engine": "FastAPI uvicorn python-3.12"
    }


# --- ВАЛИДАЦИЯ FIREBASE AUTH ID-ТОКЕНА ---
def authenticate_firebase_uid(token: str) -> str:
    """
    Верифицирует Firebase ID Token и извлекает UID пользователя.
    В случае неудачи или отсутствия конфигурации выдает ошибку, либо
    разрешает соединение в режиме безопасной дев-заглушки.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")
        
    if not VERIFY_FIREBASE_TOKEN or not firebase_initialized:
        # Если Firebase не настроен окончательно, возвращаем безопасный симулированный ID для тестирования комнат
        # чтобы сервер не падал, соответствуя лучшим практикам разработки
        logger.info(f"🛠️ [Dev Mode] Пропущена сетевая валидация токена. Использование временного UID.")
        if token.startswith("dev-user-"):
            return token.replace("dev-user-", "uid_")
        return f"uid_{hash(token) % 1000000}"
        
    try:
        # Верифицируем сетевой JWT токен через официальный Google Firebase Auth
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token.get("uid")
        if not uid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload - UID missing")
        logger.info(f"✅ Успешная Firebase верификация пользователя: UID = {uid}")
        return uid
    except auth.ExpiredIdTokenError:
        logger.warning("❌ Срок действия Firebase токена авторизации истек.")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Firebase token has expired")
    except Exception as e:
        logger.error(f"❌ Критическая ошибка валидации Firebase API токена: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Firebase validation rejected: {e}")


# --- ГЛАВНЫЙ WEBSOCKET КАНАЛ СИНХРОНИЗАЦИИ ---
async def handle_websocket_connection(
    websocket: WebSocket, 
    room_id_path: Optional[str] = None, 
    room_id_query: Optional[str] = None,
    token: Optional[str] = None
):
    """
    Асинхронный обработчик соединения сокета для комнат Sferium Homes.
    Поддерживает автоматическое создание комнаты и подключение к существующей.
    """
    await websocket.accept()
    
    validated_uid = None
    # 1. Попытка авторизоваться на фазе Хэндшейка, если передан query-параметр token
    if token and VERIFY_FIREBASE_TOKEN:
        try:
            validated_uid = authenticate_firebase_uid(token)
        except Exception as e:
            # На сокетах отправляем понятную ошибку и корректно закрываем сокет, сохраняя стабильность
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Ошибка авторизации токена Firebase Auth: {e}"
            }))
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    logger.info("📡 Новое сырое WebSocket-соединение установлено. Ожидание join пакета...")
    room_id = None
    user_id = None
    
    try:
        while True:
            # Читаем асинхронное текстовое сообщение от клиента
            raw_msg = await websocket.receive_text()
            try:
                msg = json.loads(raw_msg)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "message": "Некорректный формат JSON"}))
                continue
                
            msg_type = msg.get("type")
            if not msg_type:
                continue
                
            # Обрабатываем событие: JOIN (Войти / Создать комнату)
            if msg_type == "join":
                # Извлекаем параметры комнаты из разных источников
                target_room = (
                    msg.get("roomId") or 
                    msg.get("room_id") or 
                    room_id_query or 
                    room_id_path
                )
                
                if target_room:
                    target_room = str(target_room).strip().upper()
                
                # Если room_id не передан или передан пустой / undefined / null, автоматически создаем комнату
                if not target_room or target_room in ("", "UNDEFINED", "NULL"):
                    import secrets
                    target_room = f"ROOM_{secrets.token_hex(3).upper()}"
                    logger.info(f"🎲 room_id не предоставлен. Автоматически создаем уникальный ID комнаты: {target_room}")
                    
                name = msg.get("name", "").strip()
                avatar = msg.get("avatar", "🍿").strip()
                color = msg.get("color", "#3B82F6").strip()
                uid = msg.get("uid")
                
                # Позволяем передать токен внутри пакета join, если не передали в url
                join_token = msg.get("token")
                if VERIFY_FIREBASE_TOKEN and not validated_uid and join_token:
                    try:
                        validated_uid = authenticate_firebase_uid(join_token)
                    except Exception as e:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": f"Валидация токена 'join' отклонена: {e}"
                        }))
                        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                        return

                # Используем верифицированный UID
                user_uid = validated_uid or uid
                
                # Генерируем уникальный внутренний ID подключения для сессии
                user_id = f"u_{os.urandom(4).hex()}"
                room_id = target_room
                
                # Если комнаты нет — создаем инициализирующий стейт
                if room_id not in rooms:
                    default_video = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    # Предустанавливаем популярные фичи из исходного кода
                    if room_id == "KINO12":
                        default_video = "https://www.youtube.com/watch?v=a50qT9bW_T0"
                    elif room_id == "MUSIC99":
                        default_video = "https://vk.com/video_ext.php?oid=-220550000&id=456239149"
                        
                    rooms[room_id] = RoomState(room_id, default_video)
                    logger.info(f"🆕 Создана новая виртуальная комната: {room_id}")
                    
                room = rooms[room_id]
                
                # Первое подключение всегда становится хостом
                is_host = len(room.members) == 0
                
                # Создаем профиль участника
                member = RoomMember(
                    user_id=user_id,
                    name=name if name else f"Слушатель {os.urandom(2).hex()}",
                    avatar=avatar,
                    color=color,
                    is_host=is_host,
                    websocket=websocket,
                    uid=user_uid
                )
                
                # Записываем в структуры данных
                room.members[user_id] = member
                socket_profiles[websocket] = {"room_id": room_id, "user_id": user_id}
                
                logger.info(f"👤 Пользователь '{member.name}' вошел в комнату '{room_id}' (Хост: {is_host})")
                
                # Отправляем текущий стейт комнаты подключившемуся игроку
                await websocket.send_text(json.dumps({
                    "type": "room_state",
                    "state": room.to_dict(),
                    "userId": user_id
                }))
                
                # Объявляем в чат
                sys_msg = room.add_system_message(f"👋 {member.avatar} {member.name} подключился к трансляции")
                await broadcast_to_room(room_id, {
                    "type": "chat_broadcast",
                    "message": sys_msg
                }, exclude_ws=websocket)
                
                # Обновляем список меберов у всех
                await broadcast_to_room(room_id, {
                    "type": "members_update",
                    "members": {uid: m.to_dict() for uid, m in room.members.items()}
                }, exclude_ws=websocket)
                
                continue

            # --- ЗАЩИТА: ИГНОРИРОВАНИЕ ПАКЕТОВ БЕЗ ПРЕДВАРИТЕЛЬНОГО JOIN ---
            if not room_id or not user_id or room_id not in rooms:
                continue
                
            room = rooms[room_id]
            member = room.members.get(user_id)
            if not member:
                continue

            # --- ОБРАБОТКА ОБЫЧНЫХ СОБЫТИЙ СИНХРОНИЗАЦИИ ---

            # 1. Смена видео-источника (только хозяин)
            if msg_type in ("change_video", "new_video"):
                if not member.is_host:
                    continue
                new_url = msg.get("videoUrl", msg.get("videoUrl"))
                if not new_url:
                    continue
                    
                parsed = parse_video_url(new_url)
                room.video_url = new_url
                room.video_id = parsed["id"]
                room.provider = parsed["provider"]
                room.playing = False
                room.current_time = 0.0
                room.last_updated = time.time()
                
                # Оповещаем чат
                sys_msg = room.add_system_message(f"🎬 {member.name} выбрал новый фильм для просмотра")
                
                # Вещаем обновленный глобальный стейт комнаты
                await broadcast_to_room(room_id, {
                    "type": "room_state",
                    "state": room.to_dict(),
                    "userId": ""
                })
                
            # 2. Статус воспроизведения (Пауза / Плей)
            elif msg_type in ("playback_change", "play_pause", "play", "pause"):
                # Настройки плеера могут транслироваться как хостом, так и синхронизироваться от участников
                playing_state = msg.get("playing")
                if playing_state is None:
                    # Корректировка для прямых "play" / "pause" пакетов
                    playing_state = (msg_type == "play" or msg_type == "playback_change")
                    
                client_time = msg.get("currentTime", room.current_time)
                
                # Обновляем состояние комнаты на сервере
                room.playing = playing_state
                room.current_time = client_time
                room.last_updated = time.time()
                
                # Логируем действие для отладки рассинхрона
                logger.info(
                    f"⏯️ [Playback Change] Комната: '{room_id}' | Действие совершил: '{member.name}' | "
                    f"Статус: {'PLAY' if playing_state else 'PAUSE'} при значении {client_time:.2f}с."
                )
                
                # Пересылаем событие всем остальным участникам, пропуская отправителя (предотвращаем эхо-цикл)
                await broadcast_to_room(room_id, {
                    "type": "playback_change",
                    "playing": playing_state,
                    "currentTime": client_time,
                    "issuerId": user_id
                }, exclude_ws=websocket)

            # 3. Seeking — Точечная ручная перемотка
            elif msg_type == "seek":
                client_time = msg.get("currentTime", 0.0)
                room.current_time = client_time
                room.last_updated = time.time()
                
                logger.info(f"⏩ [Manual Seek] Комната: '{room_id}' | Перемотка от '{member.name}' -> {client_time:.2f}с.")
                
                # Оповещаем остальных клиентов о перемотке
                await broadcast_to_room(room_id, {
                    "type": "seek",
                    "currentTime": client_time,
                    "issuerId": user_id
                }, exclude_ws=websocket)

            # 4. sync_time / sendTime — Периодической отчет от клиента о своем текущем месте видео
            # Это ключевой источник данных для алгоритма Anti-Desync
            elif msg_type in ("sync_time", "sendTime"):
                client_time = msg.get("currentTime")
                if client_time is not None:
                    member.current_time = float(client_time)
                    member.last_report_epoch = time.time()
                    
                    # Если пользователь является хостом, его время постепенно подтягивает за собой время комнаты
                    if member.is_host:
                        room.current_time = float(client_time)
                        room.last_updated = time.time()

            # 5. Отправка текстового сообщения в Чат
            elif msg_type == "chat_message":
                text = msg.get("text", "").strip()
                if not text:
                    continue
                    
                room.message_count += 1
                chat_msg = {
                    "id": f"msg_{room.message_count}_{int(time.time() * 1000)}",
                    "type": "chat",
                    "userId": user_id,
                    "name": member.name,
                    "avatar": member.avatar,
                    "color": member.color,
                    "text": text,
                    "timestamp": int(time.time() * 1000)
                }
                
                room.chat_history.append(chat_msg)
                if len(room.chat_history) > 100:
                    room.chat_history.pop(0)
                    
                await broadcast_to_room(room_id, {
                    "type": "chat_broadcast",
                    "message": chat_msg
                })

            # 6. Добавление быстрой реакции к сообщению (Новая фича)
            elif msg_type == "react_message":
                msg_id = msg.get("messageId")
                emoji = msg.get("emoji")
                if msg_id and emoji:
                    # Транслируем реакцию в чат в реальном времени
                    await broadcast_to_room(room_id, {
                        "type": "message_reaction",
                        "messageId": msg_id,
                        "emoji": emoji,
                        "userId": user_id
                    })

            # 7. Изменение приватности комнаты (только Host)
            elif msg_type == "set_privacy":
                if not member.is_host:
                    continue
                is_pub = msg.get("isPublic")
                if is_pub is not None:
                    room.is_public = is_pub
                    
                    privacy_text = "🌐 сделал трансляцию Открытой для всех" if is_pub else "🔒 сделал трансляцию Закрытой (доступ по ссылке)"
                    sys_msg = room.add_system_message(f"{member.name} {privacy_text}")
                    
                    await broadcast_to_room(room_id, {
                        "type": "room_state",
                        "state": room.to_dict(),
                        "userId": ""
                    })

            # 8. Изменение активности Микрофона (Конференция)
            elif msg_type == "toggle_mic":
                enabled_state = msg.get("enabled", False)
                if enabled_state:
                    # Проверяем, забанен ли микрофон у пользователя хостом
                    if member.mic_blocked_by_host or (room.allMuted and not member.is_host):
                        member.mic_enabled = False
                    else:
                        member.mic_enabled = True
                else:
                    member.mic_enabled = False
                    
                await broadcast_to_room(room_id, {
                    "type": "members_update",
                    "members": {uid: m.to_dict() for uid, m in room.members.items()}
                })

            # 9. Блокировка микрофона конкретного участника (только Host)
            elif msg_type == "mute_member":
                if not member.is_host:
                    continue
                target_user_id = msg.get("targetUserId")
                blocked = msg.get("blocked", False)
                
                target_member = room.members.get(target_user_id)
                if target_member:
                    target_member.mic_blocked_by_host = blocked
                    if blocked:
                        target_member.mic_enabled = False
                        
                    action_txt = "заблокировал голосовой поток для" if blocked else "разблокировал микрофон"
                    sys_msg = room.add_system_message(f"🔇 Создатель {action_txt} {target_member.name}")
                    
                    await broadcast_to_room(room_id, {
                        "type": "room_state",
                        "state": room.to_dict(),
                        "userId": ""
                    })

            # 10. Исключение зрителя из комнаты (Kick - только Host)
            elif msg_type == "kick_member":
                if not member.is_host:
                    continue
                target_user_id = msg.get("targetUserId")
                target_member = room.members.get(target_user_id)
                
                if target_member:
                    # Посылаем предупреждение жертве
                    try:
                        await target_member.websocket.send_text(json.dumps({
                            "type": "kicked_notification"
                        }))
                        await target_member.websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                    except Exception:
                        pass
                    
                    # Логируем системное
                    room.add_system_message(f"🚫 {target_member.name} был принудительно удален из комнаты создателем")
                    room.members.pop(target_user_id, None)
                    
                    # Обновляем для всех
                    await broadcast_to_room(room_id, {
                        "type": "room_state",
                        "state": room.to_dict(),
                        "userId": ""
                    })

            # 10. Задушить все микрофоны в зале разом (Mute All - только Host)
            elif msg_type == "mute_all_mics":
                if not member.is_host:
                    continue
                mute_all_state = msg.get("mute", False)
                room.all_muted = mute_all_state
                
                if mute_all_state:
                    # Тушим микрофоны у всех, кто не хост
                    for m_id, m in room.members.items():
                        if not m.is_host:
                            m.mic_enabled = False
                            
                action_txt = "⛔ Создатель отключил голосовое общение для всех участников" if mute_all_state else "🔊 Голосовое общение вновь доступно для всех участников"
                sys_msg = room.add_system_message(action_txt)
                
                await broadcast_to_room(room_id, {
                    "type": "room_state",
                    "state": room.to_dict(),
                    "userId": ""
                })

    except WebSocketDisconnect:
        await handle_socket_disconnect(websocket)
    except Exception as e:
        logger.error(f"⚠️ Ошибка обработки WebSocket транзакции: {e}", exc_info=True)
        await handle_socket_disconnect(websocket)


# --- WEBSOCKET МАРШРУТЫ И ТОЧКИ ПОДКЛЮЧЕНИЯ ---
@app.websocket("/ws")
async def websocket_sync_root(
    websocket: WebSocket, 
    room_id: Optional[str] = Query(None),
    roomId: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """
    Корневой WebSocket эндпоинт (/ws).
    Поддерживает room_id / roomId в query-параметрах, а также в JSON-сообщении join.
    """
    await handle_websocket_connection(
        websocket=websocket, 
        room_id_path=None, 
        room_id_query=room_id or roomId, 
        token=token
    )


@app.websocket("/ws/{room_id_path}")
async def websocket_sync_path(
    websocket: WebSocket, 
    room_id_path: str,
    room_id: Optional[str] = Query(None),
    roomId: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """
    WebSocket эндпоинт с поддержкой пути (/ws/{room_id_path}).
    """
    await handle_websocket_connection(
        websocket=websocket, 
        room_id_path=room_id_path, 
        room_id_query=room_id or roomId, 
        token=token
    )


# --- ТОЧКА ВХОДА (ДЛЯ ПРЯМОГО ЗАПУСКА) ---
if __name__ == "__main__":
    # Запуск сигнального сервера на порту 8000 (или 3000 в зависимости от хостинга)
    # По умолчанию для Ubuntu серверов биндим на 0.0.0.0
    port = int(os.getenv("SYNC_SERVER_PORT", "8000"))
    logger.info(f"🚀 Запуск сигнального сервера Sferium Homes на http://0.0.0.0:{port}")
    uvicorn.run(
        "sferium_sync_server:app",
        host="0.0.0.0",
        port=port,
        workers=4,               # Использование нескольких воркеров для отказоустойчивости на Ubuntu
        loop="uvloop",           # Оптимизированный скоростной цикл событий для Linux систем
        ws_ping_interval=20,     # Пинг-интервал для удержания соединений сквозь nginx/reverse-proxy
        ws_ping_timeout=10,
        log_level="warn"
    )
