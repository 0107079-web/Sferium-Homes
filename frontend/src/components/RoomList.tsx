/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Search, Users, Tv, Compass, RefreshCw } from "lucide-react";

export interface PublicRoomSummary {
  roomId: string;
  name: string;
  membersCount: number;
  currentVideoTitle: string;
  videoUrl: string;
  members: Array<{ id: string; name: string; avatar: string; color: string }>;
}

interface RoomListProps {
  rooms: PublicRoomSummary[];
  onSelectRoom: (roomId: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function SferiumRoomList({
  rooms,
  onSelectRoom,
  onRefresh,
  isRefreshing = false,
}: RoomListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = 
      room.roomId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.currentVideoTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div id="sferium-rooms-browser-component" className="space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-indigo-400" />
          <h3 className="font-display font-bold text-sm text-zinc-100 uppercase tracking-widest">Активные Кинозалы</h3>
        </div>
        
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer ${isRefreshing ? "animate-spin" : ""}`}
            title="Обновить список комнат"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-500" />
        <input
          id="room-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по названию, ID или фильму..."
          className="w-full bg-zinc-950 text-xs text-zinc-200 pl-10 pr-4 py-3.5 rounded-xl border border-zinc-855 outline-none focus:border-indigo-500 transition-colors"
          title="Поиск кинозалов"
        />
      </div>

      {/* Grid of Active Rooms */}
      {filteredRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-zinc-950/40 border border-zinc-900 rounded-2xl">
          <Tv className="w-10 h-10 text-zinc-750 mb-3" />
          <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Открытых залов нет</h5>
          <p className="text-[10.5px] text-zinc-500 leading-relaxed max-w-xs">
            Будьте первым! Создайте свой уникальный кинозал 🍿 и пригласите друзей по прямой ссылке.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredRooms.map((room) => (
            <div
              key={room.roomId}
              onClick={() => onSelectRoom(room.roomId)}
              className="group relative bg-zinc-900/40 hover:bg-zinc-900/85 border border-zinc-850 hover:border-indigo-500/50 p-4 rounded-2xl cursor-pointer transition-all hover:translate-y-[-2px] shadow-md hover:shadow-indigo-550/5 flex flex-col justify-between"
            >
              <div>
                {/* Header row with Title and Member Tag */}
                <div className="flex items-start justify-between mb-2.5">
                  <h4 className="font-display font-bold text-xs text-zinc-200 group-hover:text-white transition-colors truncate max-w-[70%]">
                    {room.name}
                  </h4>
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-mono font-bold text-indigo-400 shrink-0 select-none">
                    <Users className="w-3 h-3" />
                    {room.membersCount}
                  </span>
                </div>

                {/* Video Info banner */}
                <div className="flex items-center gap-2 mb-4 p-2 bg-zinc-950/65 rounded-xl border border-zinc-850/40">
                  <Tv className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="text-[10px] text-zinc-400 font-mono text-ellipsis overflow-hidden whitespace-nowrap block max-w-full">
                    {room.currentVideoTitle || "Трансляция не выбрана"}
                  </span>
                </div>
              </div>

              {/* Members Avatar previews list */}
              <div className="flex items-center justify-between border-t border-zinc-850/50 pt-3">
                <div className="flex -space-x-2 overflow-hidden">
                  {room.members.slice(0, 4).map((member) => (
                    <div
                      key={member.id}
                      className="w-6 h-6 rounded-full border-2 border-zinc-900 bg-zinc-950 flex items-center justify-center text-[10px] select-none"
                      style={{ borderColor: member.color || "#4F46E5" }}
                      title={member.name}
                    >
                      {member.avatar || "🍿"}
                    </div>
                  ))}
                  {room.members.length > 4 && (
                    <div className="w-6 h-6 rounded-full border border-zinc-800 bg-zinc-950 flex items-center justify-center text-[8px] font-bold text-zinc-500 select-none">
                      +{room.members.length - 4}
                    </div>
                  )}
                </div>
                
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-indigo-400 group-hover:text-indigo-300 transition-colors">
                  Войти →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
