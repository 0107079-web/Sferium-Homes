/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { Compass, Sparkles, Tv, Users, PlusCircle, ArrowRight } from "lucide-react";
import SferiumRoomList, { PublicRoomSummary } from "./components/RoomList";

interface LobbyProps {
  onJoinRoom: (roomId: string, userProfile: { name: string; avatar: string; color: string }) => void;
  publicRooms: PublicRoomSummary[];
  onRefreshRooms?: () => void;
  isRefreshing?: boolean;
}

export default function SferiumLobby({
  onJoinRoom,
  publicRooms,
  onRefreshRooms,
  isRefreshing = false,
}: LobbyProps) {
  const [roomIdInput, setRoomIdInput] = useState("");
  const [name, setName] = useState(() => localStorage.getItem("sferium_user_name") || `Зритель_${Math.floor(Math.random() * 1000)}`);
  const [avatar, setAvatar] = useState(() => localStorage.getItem("sferium_user_avatar") || "🍿");
  const [color, setColor] = useState(() => localStorage.getItem("sferium_user_color") || "#4F46E5");

  const avatarPresets = ["🍿", "🎬", "🍕", "🎮", "🦄", "🦊", "🍔", "🎸", "🐼", "🤖"];
  const colorPresets = ["#4F46E5", "#10B981", "#EF4444", "#F59E0B", "#EC4899", "#8B5CF6"];

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    const cleanRoom = roomIdInput.trim().toUpperCase();
    if (!cleanRoom) return;

    // Cache preferences
    localStorage.setItem("sferium_user_name", name);
    localStorage.setItem("sferium_user_avatar", avatar);
    localStorage.setItem("sferium_user_color", color);

    onJoinRoom(cleanRoom, { name, avatar, color });
  };

  const handleCreate = () => {
    // Generate a random 6-character clean room ID
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Cache preferences
    localStorage.setItem("sferium_user_name", name);
    localStorage.setItem("sferium_user_avatar", avatar);
    localStorage.setItem("sferium_user_color", color);

    onJoinRoom(randomCode, { name, avatar, color });
  };

  return (
    <div id="sferium-lobby-page" className="max-w-4xl mx-auto space-y-8 py-6">
      {/* Sferium Brand Header section */}
      <div className="text-center space-y-2 select-none">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono font-bold text-indigo-400 rounded-full">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>SFERIUM HOMES CO-WATCH PLATFORM</span>
        </div>
        <h1 className="font-display font-black text-3xl sm:text-4xl text-zinc-100 tracking-tight leading-none">
          Смотрите фильмы <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">вместе</span>
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
          Субсекундная синхронизация, mesh-аудиозвонки, отсутствие региональных блокировок. Кинотеатр в реальном времени.
        </p>
      </div>

      {/* Profile customization row & Enter Room logic Card */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        
        {/* Profile Card (2 cols) */}
        <div className="md:col-span-2 bg-zinc-900/40 border border-zinc-850 p-6 rounded-3xl space-y-5">
          <div className="flex items-center gap-2 border-b border-zinc-850 pb-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <h4 className="font-display font-bold text-xs text-zinc-100 uppercase tracking-widest">Профиль зрителя</h4>
          </div>

          {/* Large Avatar preview */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-3xl bg-zinc-950 border-2 flex items-center justify-center text-3xl shadow-xl transition-all"
              style={{ borderColor: color }}
            >
              {avatar}
            </div>
            
            <div className="flex-1 space-y-1">
              <label htmlFor="lobby-name-input" className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block">Ваше имя в эфире</label>
              <input
                id="lobby-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Введите имя..."
                className="w-full bg-zinc-950 text-xs text-zinc-200 px-3.5 py-2.5 rounded-xl border border-zinc-855 outline-none focus:border-indigo-500 transition-colors font-semibold"
              />
            </div>
          </div>

          {/* Avatar selector presets */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block">Выберите иконку</span>
            <div className="flex flex-wrap gap-2">
              {avatarPresets.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setAvatar(emoji)}
                  className={`w-10 h-10 rounded-xl bg-zinc-950/60 hover:bg-zinc-950 border text-base flex items-center justify-center transition-all cursor-pointer ${avatar === emoji ? "border-indigo-500 bg-zinc-950 shadow-inner scale-105" : "border-zinc-850/40"}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color Presets */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block">Цвет рамки</span>
            <div className="flex gap-2">
              {colorPresets.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-all cursor-pointer ${color === c ? "ring-2 ring-offset-2 ring-offset-zinc-900 ring-white scale-110" : "opacity-80 hover:opacity-100"}`}
                  style={{ backgroundColor: c }}
                  title={`Выбрать цвет ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Enter Room Card (3 cols) */}
        <div className="md:col-span-3 bg-zinc-900/40 border border-zinc-850 p-6 rounded-3xl flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-2 border-b border-zinc-850 pb-2">
              <Tv className="w-4 h-4 text-indigo-400" />
              <h4 className="font-display font-bold text-xs text-zinc-100 uppercase tracking-widest">Подключение к сессии</h4>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Введите шестизначный код существующей комнаты, чтобы присоединиться к друзьям, или создайте приватный зал для персонального вещания за одну секунду.
            </p>

            {/* Join Room Form */}
            <form onSubmit={handleJoin} className="space-y-3">
              <div className="flex gap-2">
                <input
                  id="lobby-room-id-field"
                  type="text"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  placeholder="КОД КОМНАТЫ (например: ROOM_A4B)"
                  className="flex-1 bg-zinc-950 text-xs text-zinc-200 px-4 py-3 rounded-xl border border-zinc-855 outline-none focus:border-indigo-500 transition-colors font-mono font-bold tracking-widest text-center"
                  title="Код комнаты"
                />
                
                <button
                  id="lobby-join-room-btn"
                  type="submit"
                  disabled={!roomIdInput.trim()}
                  className={`px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    roomIdInput.trim()
                      ? "bg-indigo-600 hover:bg-indigo-550 text-white shadow-md shadow-indigo-600/15"
                      : "bg-zinc-800/60 text-zinc-600 cursor-not-allowed border border-zinc-850/20"
                  }`}
                  title="Войти в комнату"
                >
                  <span>Войти</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Quick Create option */}
          <div className="border-t border-zinc-850/50 pt-5 mt-5">
            <button
              id="lobby-create-room-btn"
              type="button"
              onClick={handleCreate}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 rounded-xl text-xs font-bold uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
            >
              <PlusCircle className="w-4.5 h-4.5" />
              <span>Создать новый кинозал</span>
            </button>
          </div>

        </div>
      </div>

      {/* Active Room Browsing Grid summary */}
      <div className="bg-zinc-900/25 border border-zinc-850/50 p-6 rounded-3xl">
        <SferiumRoomList
          rooms={publicRooms}
          onSelectRoom={(rid) => {
            onJoinRoom(rid, { name, avatar, color });
          }}
          onRefresh={onRefreshRooms}
          isRefreshing={isRefreshing}
        />
      </div>

    </div>
  );
}
