/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Users, Crown, Mic, MicOff, AlertCircle } from "lucide-react";

export interface RoomMember {
  id: string;
  name: string;
  avatar: string;
  color: string;
  micEnabled: boolean;
  micBlockedByHost: boolean;
  isHost: boolean;
  joinedAt: number;
  disconnected: boolean;
  disconnectedAt?: number | null;
}

interface UserListProps {
  members: Record<string, RoomMember>;
  currentUserId: string;
  onRemoteToggleMic?: (targetUserId: string, enabled: boolean) => void;
  onKickMember?: (targetUserId: string) => void;
  isMeHost?: boolean;
}

export default function SferiumUserList({
  members,
  currentUserId,
  onRemoteToggleMic,
  onKickMember,
  isMeHost = false,
}: UserListProps) {
  const memberList = Object.values(members).sort((a, b) => b.joinedAt - a.joinedAt);

  return (
    <div id="sferium-userlist-component" className="bg-zinc-900/40 border border-zinc-850 p-5 rounded-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <h4 className="font-display font-bold text-xs text-zinc-100 uppercase tracking-widest">В зале</h4>
        </div>
        <span className="text-[10px] bg-zinc-800 text-zinc-400 font-mono font-bold px-2 py-0.5 rounded-full">
          {memberList.length}
        </span>
      </div>

      <div className="space-y-2 max-h-[250px] overflow-y-auto scrollbar-thin">
        {memberList.map((member) => {
          const isMe = member.id === currentUserId;
          return (
            <div
              key={member.id}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                member.disconnected
                  ? "bg-rose-500/5 border-rose-500/10 opacity-60"
                  : "bg-zinc-955/60 border-zinc-850 hover:border-zinc-800"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  {/* Avatar Bubble */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-zinc-900 border"
                    style={{ borderColor: member.color || "#4F46E5" }}
                  >
                    {member.avatar || "🍿"}
                  </div>
                  
                  {/* Status Indicator Bubble */}
                  {member.disconnected ? (
                    <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-rose-500" title="Временно отключился" />
                  ) : member.micEnabled ? (
                    <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Микрофон активен" />
                  ) : null}
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-zinc-200 flex items-center gap-1 truncate">
                    {member.name}
                    {isMe && <span className="text-zinc-500 font-normal text-[9.5px]">(Вы)</span>}
                  </span>
                  
                  {member.disconnected ? (
                    <span className="text-[8.5px] text-rose-455 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" />
                      Связь потеряна
                    </span>
                  ) : (
                    <span className="text-[9px] text-zinc-500 font-mono">
                      Зашел {new Date(member.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>

              {/* Action permissions & host crowns */}
              <div className="flex items-center gap-2">
                {member.isHost ? (
                  <span className="text-[8.5px] font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 select-none">
                    <Crown className="w-2.5 h-2.5" />
                    👑 ХОСТ
                  </span>
                ) : (
                  isMeHost && (
                    <div className="flex items-center gap-1">
                      {/* Mute toggle button from host */}
                      <button
                        onClick={() => onRemoteToggleMic?.(member.id, !member.micEnabled)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          member.micEnabled
                            ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-850 hover:bg-zinc-800 text-zinc-500 border-zinc-800"
                        }`}
                        title={member.micEnabled ? "Выключить микрофон участнику" : "Включить микрофон участнику"}
                      >
                        {member.micEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                      </button>

                      {/* Kick button */}
                      {onKickMember && (
                        <button
                          onClick={() => onKickMember(member.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/30 transition-colors cursor-pointer"
                          title="Выгнать из кинозала"
                        >
                          <span className="text-[9px] font-bold">Удалить</span>
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
