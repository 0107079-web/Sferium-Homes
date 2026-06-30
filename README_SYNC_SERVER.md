# Руководство по развертыванию сигнального FastAPI сервера для Sferium Homes

Данный каталог содержит высокопроизводительный, асинхронный WebSocket-сервер для синхронизации комнат совместного просмотра в стиле Homes. Сервер написан на современном Python 3.12+, использует `FastAPI`, `websockets` и `uvloop` для минимизации задержек на серверах Ubuntu в Германии.

---

## 🛠 Ключевые возможности

1. **Алгоритм Anti-Desync:** Каждые 3 секунды сверяет позиции кадров у зрителей. Если рассинхронизация у кого-то превышает **1.5 секунды**, сервер отправляет точечную команду `seek` отстающим клиентам.
2. **Firebase Auth Валидация:** Поддерживает проверку JWT Google Firebase Auth токенов. Пользователь без действительной сессии в Firebase не сможет войти в заблокированные комнаты.
3. **Управление ролями:** Поддерживает роли Создателя комнаты (Host) и обычных Зрителей, с опциями блокировки микрофонов, выгона из зала (Kick) и трансляции чата.
4. **Умный парсер источников:** Встроенная поддержка видеохостингов (YouTube, VK Видео, Rutube, Yandex/Дзен) с распознаванием прямых трансляций, хешей и встраиваемых iframe.

---

## 📂 Структура файлов

* `sferium_sync_server.py` — Основной код сервера FastAPI с WebSocket хэндлерами и Anti-Desync логикой.
* `requirements.txt` — Список зависимостей для установки через `pip`.

---

## 🚀 Инструкция по установке и настройке (Ubuntu Server)

### Шаг 1: Подготовка окружения на сервере в Германии

Обновите систему и установите Python 3.12+ с виртуальным окружением:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv python3-dev -y
```

### Шаг 2: Создание директории и клонирование файлов

```bash
mkdir -p /opt/sferium-sync
cd /opt/sferium-sync
# Перенесите файлы sferium_sync_server.py и requirements.txt в эту папку
```

### Шаг 3: Настройка виртуального окружения и зависимостей

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Шаг 4: Настройка Firebase Сервисного Аккаунта (Опционально)

Для работы валидации токенов:
1. Зайдите в Firebase Console -> Настройки проекта -> Сервисные аккаунты.
2. Нажмите **"Создать новый закрытый ключ"** и скачайте JSON-файл.
3. Переименуйте файл в `firebase-service-account.json` и поместите его в `/opt/sferium-sync/`.

> Если вы хотите отключить валидацию или запустить сервер в тестовом разработческом режиме без авторизации, установите переменную среды:
> `VERIFY_FIREBASE_TOKEN=False`

---

## ⚙️ Управление службами через Systemd (Production-grade)

Чтобы сервер работал круглосуточно в фоновом режиме и автоматически восстанавливался при перезапуске машины, создайте системную службу.

Создайте файл описания службы:

```bash
sudo nano /etc/systemd/system/sferium-sync.service
```

Вставьте следующее содержимое:

```ini
[Unit]
Description=Sferium Homes - High Performance Sync Signal Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/sferium-sync
ExecStart=/opt/sferium-sync/venv/bin/python sferium_sync_server.py
Restart=always
RestartSec=3

# Переменные конфигурации
Environment=SYNC_SERVER_PORT=8000
Environment=VERIFY_FIREBASE_TOKEN=True
Environment=FIREBASE_CREDENTIALS=/opt/sferium-sync/firebase-service-account.json

# Логирование
StandardOutput=append:/var/log/sferium_sync_info.log
StandardError=append:/var/log/sferium_sync_error.log

[Install]
WantedBy=multi-user.target
```

Сохраните файл и примените конфигурацию:

```bash
# Перезагрузка служб systemd
sudo systemctl daemon-reload

# Включение автозапуска при загрузке системы
sudo systemctl enable sferium-sync

# Запуск службы
sudo systemctl start sferium-sync

# Просмотр текущего статуса
sudo systemctl status sferium-sync
```

---

## 📡 Подключение из Клиентской Части Sferium Homes

На стороне React-клиента в Sferium Homes (настройки сопряжения WebSocket) укажите адрес вашей запущенной ноды:

* По протоколу WebSocket (без SSL): `ws://<ip-вашего-сервера>:8000/ws`
* По протоколу WebSocket Secure (через домен с SSL / NGINX): `wss://yourdomain.com/ws`

Клиент выполнит подключение, создаст виртуальную комнату и автоматически начнет обмениваться статусом времени трансляции для полной синхронизации. Логи задержек и автокоррекций будут автоматически писаться в локальный файл `/opt/sferium-sync/sferium_sync.log`.
