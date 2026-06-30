/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, FormEvent } from "react";
import { Send, Smile, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatMessage } from "../types";
import Avatar from "./Avatar";

interface ChatProps {
  chatHistory: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  onReactMessage?: (messageId: string, emoji: string) => void;
}

export default function Chat({ chatHistory, currentUserId, onSendMessage, onReactMessage }: ChatProps) {
  const [text, setText] = useState("");
  const [activeReactMsgId, setActiveReactMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text);
    setText("");
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <h3 className="font-display font-semibold text-sm text-zinc-100 tracking-wide uppercase">Чат комнаты</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs font-mono">{chatHistory.filter(m => m.type === "chat").length} сообщений</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-500 mb-2 border border-zinc-700/30">
              <Info className="w-5 h-5" />
            </div>
            <p className="text-xs text-zinc-400 font-medium">В чате пока пусто</p>
            <p className="text-[10px] text-zinc-500 mt-1">Отправьте сообщение, чтобы начать общение!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {chatHistory.map((msg, idx) => {
              const isSys = msg.type === "system";
              const isMe = msg.userId === currentUserId;

              if (isSys) {
                return (
                  <motion.div
                    key={msg.id || idx}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex justify-center"
                  >
                    <span className="inline-block px-3 py-1 rounded-full bg-zinc-800/40 text-[11px] text-zinc-400 font-medium border border-zinc-800/80">
                      {msg.text}
                    </span>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={msg.id || idx}
                  initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex gap-2 max-w-[85%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Tiny Avatar */}
                    <Avatar 
                      src={msg.avatar} 
                      className="w-7 h-7 rounded-full text-xs" 
                      fallback="🍿" 
                    />

                    <div className="flex flex-col">
                      {/* Name Header */}
                      {!isMe && (
                        <span 
                          className="text-[10px] font-semibold mb-0.5 ml-1 select-none"
                          style={{ color: msg.color || "#A1A1AA" }}
                        >
                          {msg.name}
                        </span>
                      )}

                      {/* Chat text box row with quick reaction trigger */}
                      <div className={`relative group/bubble flex items-center gap-1.5 ${
                        isMe ? "flex-row-reverse" : "flex-row"
                      }`}>
                        <div
                          className={`px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm break-all ${
                            isMe
                              ? "bg-indigo-600 text-white rounded-tr-none"
                              : "bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700/30"
                          }`}
                        >
                          {msg.text}
                        </div>

                        {/* Reaction Trigger Button (Smiley formatting) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveReactMsgId(activeReactMsgId === msg.id ? null : msg.id);
                          }}
                          className="opacity-0 group-hover/bubble:opacity-100 focus:opacity-100 transition-opacity p-0.5 text-zinc-400 hover:text-zinc-200 rounded-full hover:bg-zinc-850 cursor-pointer shrink-0"
                          title="Реагировать"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>

                        {/* Quick reaction panel */}
                        <div className={`${
                          activeReactMsgId === msg.id ? "flex" : "hidden group-hover/bubble:flex"
                        } items-center gap-1.5 px-2 py-1 bg-zinc-950 border border-zinc-750 rounded-full shadow-2xl absolute -top-8 ${
                          isMe ? "right-0 animate-in fade-in slide-in-from-right-1 duration-100" : "left-0 animate-in fade-in slide-in-from-left-1 duration-100"
                        } z-30`}
                        onMouseLeave={() => setActiveReactMsgId(null)}
                        >
                          {["❤️", "😂", "🔥", "👍", "😮"].map((emo) => {
                            const userIds = msg.reactions?.[emo] || [];
                            const hasReacted = userIds.includes(currentUserId);
                            return (
                              <button
                                key={emo}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReactMessage?.(msg.id, emo);
                                  setActiveReactMsgId(null);
                                }}
                                className={`hover:scale-130 text-[12px] transition-transform cursor-pointer p-0.5 rounded-full ${
                                  hasReacted ? "bg-indigo-500/25 animate-pulse" : "hover:bg-zinc-850"
                                }`}
                              >
                                {emo}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Active reactions badge list */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                            if (!userIds || userIds.length === 0) return null;
                            const hasReacted = userIds.includes(currentUserId);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => onReactMessage?.(msg.id, emoji)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all select-none border cursor-pointer ${
                                  hasReacted
                                    ? "bg-indigo-505/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20"
                                    : "bg-zinc-800/80 border-zinc-700/40 text-zinc-400 hover:bg-zinc-700"
                                }`}
                                title={hasReacted ? "Убрать реакцию" : "Реагировать"}
                              >
                                <span>{emoji}</span>
                                <span className={`text-[9px] font-bold ${hasReacted ? "text-indigo-400" : "text-zinc-500"}`}>
                                  {userIds.length}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Timestamp */}
                      <span className={`text-[9px] text-zinc-550 font-mono mt-0.5 ${isMe ? "text-right mr-1" : "ml-1"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input box */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-t-zinc-800 bg-zinc-900/40">
        <div className="flex gap-2">
          <input
            id="chat-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Напишите сообщение..."
            className="flex-1 bg-zinc-950 text-xs text-zinc-205 px-4 py-3 rounded-xl border border-zinc-800 outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            id="send-chat-btn"
            type="submit"
            disabled={!text.trim()}
            className="w-11 h-11 shrink-0 bg-indigo-600 hover:bg-indigo-550 disabled:opacity-30 disabled:bg-indigo-800 rounded-xl text-white flex items-center justify-center transition-all cursor-pointer"
            title="Отправить сообщение"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
