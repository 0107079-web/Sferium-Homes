/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Tv, Volume2, Users, ArrowLeft, ShieldAlert } from "lucide-react";
import SferiumChat, { ChatMessage } from "./components/Chat";
import SferiumUserList, { RoomMember } from "./components/UserList";
import SferiumVideoSelector from "./components/VideoSelector";

interface RoomProps {
  roomId: string;
  userProfile: { name: string; avatar: string; color: string };
  currentUserId: string;
  onLeave: () => void;
  // WebSocket instance or mock routing definitions
  wsStatus: "connecting" | "connected" | "disconnected" | "failed";
  roomState: {
    videoUrl: string;
    playing: boolean;
    currentTime: number;
    members: Record<string, RoomMember>;
    anyoneCanControl: boolean;
  };
  chatHistory: ChatMessage[];
  onSendMessage: (text: string) => void;
  onChangeVideo: (url: string) => void;
  onSyncPlayback: (playing: boolean, time: number) => void;
}

export default function SferiumRoom({
  roomId,
  userProfile,
  currentUserId,
  onLeave,
  wsStatus,
  roomState,
  chatHistory,
  onSendMessage,
  onChangeVideo,
  onSyncPlayback,
}: RoomProps) {
  const [micEnabled, setMicEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isUpdatingStateRef = useRef(false);

  // Sync play/pause/seek from roomState to HTML5 video element if active
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    isUpdatingStateRef.current = true;
    
    // Sync time if delta is more than 1.5 seconds
    if (Math.abs(video.currentTime - roomState.currentTime) > 1.5) {
      video.currentTime = roomState.currentTime;
    }

    // Sync playing state
    if (roomState.playing && video.paused) {
      video.play().catch(() => {});
    } else if (!roomState.playing && !video.paused) {
      video.pause();
    }

    isUpdatingStateRef.current = false;
  }, [roomState.playing, roomState.currentTime]);

  const handlePlay = () => {
    if (isUpdatingStateRef.current || !videoRef.current) return;
    onSyncPlayback(true, videoRef.current.currentTime);
  };

  const handlePause = () => {
    if (isUpdatingStateRef.current || !videoRef.current) return;
    onSyncPlayback(false, videoRef.current.currentTime);
  };

  const handleSeeked = () => {
    if (isUpdatingStateRef.current || !videoRef.current) return;
    onSyncPlayback(roomState.playing, videoRef.current.currentTime);
  };

  const toggleMic = () => {
    setMicEnabled((prev) => !prev);
    // Fire toggle microphone event inside Room
  };

  const isMeHost = roomState.members[currentUserId]?.isHost ?? false;

  return (
    <div id="sferium-cinema-room" className="space-y-6">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onLeave}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer flex items-center justify-center"
            title="Выйти из кинозала"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-400 font-mono tracking-widest uppercase bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                КИНОЗАЛ
              </span>
              <h2 className="font-display font-black text-lg text-zinc-100 uppercase tracking-tight">#{roomId}</h2>
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">Пригласите друзей по ID коду, чтобы смотреть синхронно.</p>
          </div>
        </div>

        {/* Telemetry connection widgets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Socket state tag */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/60 border border-zinc-850 rounded-xl select-none text-[10.5px]">
            <span className="text-zinc-500 font-bold uppercase tracking-wider">WebSocket:</span>
            {wsStatus === "connected" ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ПОДКЛЮЧЕН
              </span>
            ) : wsStatus === "connecting" ? (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                ПОДКЛЮЧЕНИЕ...
              </span>
            ) : (
              <span className="text-rose-455 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                ОТКЛЮЧЕН
              </span>
            )}
          </div>

          {/* Audio voice connection control */}
          <button
            onClick={toggleMic}
            className={`px-3.5 py-1.5 rounded-xl text-[10.5px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 border cursor-pointer select-none ${
              micEnabled
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title={micEnabled ? "Выключить микрофон" : "Включить микрофон голосовой связи"}
          >
            {micEnabled ? <Mic className="w-3.5 h-3.5 animate-pulse text-emerald-400" /> : <MicOff className="w-3.5 h-3.5" />}
            <span>Голос: {micEnabled ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Player on left (70%), Chat/Users on right (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Cinema Screen column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main Video Viewport Canvas */}
          <div className="relative bg-black rounded-3xl overflow-hidden border border-zinc-850 aspect-video shadow-2xl group">
            {roomState.videoUrl ? (
              <video
                ref={videoRef}
                src={roomState.videoUrl}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeeked={handleSeeked}
                controls
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-zinc-950/80">
                <Tv className="w-14 h-14 text-zinc-800 mb-3" />
                <h4 className="text-xs font-bold text-zinc-350 uppercase tracking-widest mb-1.5">Экран пуст</h4>
                <p className="text-[10px] text-zinc-550 max-w-xs leading-relaxed">Выберите видео во вкладке ниже или вставьте кастомную ссылку для запуска трансляции!</p>
              </div>
            )}
            
            {/* Visual buffering layer overlay */}
            {wsStatus !== "connected" && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-rose-950/80 border border-rose-500/20 rounded-xl text-rose-350 text-[10px] font-mono">
                <ShieldAlert className="w-3.5 h-3.5" />
                Синхронизация приостановлена (Offline)
              </div>
            )}
          </div>

          {/* Quick video selector panel */}
          {(isMeHost || roomState.anyoneCanControl) ? (
            <SferiumVideoSelector
              onSelectVideo={onChangeVideo}
              currentVideoUrl={roomState.videoUrl}
            />
          ) : (
            <div className="p-5 bg-zinc-950/45 border border-zinc-900 rounded-3xl text-center">
              <span className="text-xs font-bold uppercase text-zinc-500 tracking-wider">🔒 Смена видео ограничена хостом комнаты</span>
            </div>
          )}
        </div>

        {/* Sidebar panels column (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Chat Feed Panel */}
          <div className="h-[400px]">
            <SferiumChat
              messages={chatHistory}
              currentUserId={currentUserId}
              onSendMessage={onSendMessage}
              userAvatar={userProfile.avatar}
              userColor={userProfile.color}
            />
          </div>

          {/* Active members grid */}
          <SferiumUserList
            members={roomState.members}
            currentUserId={currentUserId}
            isMeHost={isMeHost}
          />
        </div>

      </div>

    </div>
  );
}
