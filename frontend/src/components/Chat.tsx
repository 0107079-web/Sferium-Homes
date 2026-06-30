/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect, useRef } from "react";
import { Send, Smile, Info } from "lucide-react";

export interface ChatMessage {
  roomId: string;
  userId: string;
  username: string;
  avatar: string;
  color: string;
  text: string;
  timestamp: number;
}

interface ChatProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  userAvatar?: string;
  userColor?: string;
}

export default function SferiumChat({
  messages,
  currentUserId,
  onSendMessage,
  userAvatar = "🍿",
  userColor = "#3B82F6",
}: ChatProps) {
  const [inputText, setInputText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText) return;
    onSendMessage(cleanText);
    setInputText("");
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div id="sferium-chat-component" className="flex flex-col h-full bg-zinc-950/40 border border-zinc-850 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* Chat Title bar */}
      <div className="px-4 py-3 bg-zinc-900/60 border-b border-zinc-850/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="font-display font-bold text-xs text-zinc-100 uppercase tracking-widest">Чат Комнаты</span>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase">{messages.length} сообщений</span>
      </div>

      {/* Message Feed list */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 scrollbar-thin max-h-[450px]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-zinc-500">
            <Info className="w-8 h-8 text-zinc-600 mb-2.5" />
            <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Эфир пуст</h5>
            <p className="text-[10px] leading-relaxed max-w-[200px]">Отправьте первое приветствие, чтобы начать общение!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.userId === currentUserId;
            return (
              <div
                key={index}
                className={`flex gap-3 max-w-[85%] ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* User Bubble Avatar */}
                <div
                  className="w-8.5 h-8.5 shrink-0 rounded-full flex items-center justify-center text-sm bg-zinc-900 border"
                  style={{ borderColor: msg.color || "#4F46E5" }}
                >
                  {msg.avatar || "🍿"}
                </div>

                {/* Message Payload bubble */}
                <div className="flex flex-col space-y-0.5">
                  <span
                    className={`text-[9.5px] font-bold tracking-wide flex items-center gap-1.5 ${isMe ? "justify-end text-right" : "text-left"}`}
                    style={{ color: msg.color || "#A5B4FC" }}
                  >
                    {msg.username}
                    <span className="text-[8px] font-mono text-zinc-500 font-normal">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  
                  <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words ${
                    isMe 
                      ? "bg-indigo-600/90 text-white rounded-tr-none shadow-md shadow-indigo-600/10" 
                      : "bg-zinc-900/90 text-zinc-150 rounded-tl-none border border-zinc-800"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input panel Form */}
      <form onSubmit={handleSubmit} className="p-3 bg-zinc-900/40 border-t border-zinc-850/60 flex items-center gap-2">
        <button
          type="button"
          className="p-2.5 text-zinc-500 hover:text-zinc-350 bg-zinc-950/40 hover:bg-zinc-950 border border-zinc-850/40 hover:border-zinc-850 rounded-xl transition-all"
          title="Выбрать эмодзи"
        >
          <Smile className="w-4 h-4" />
        </button>

        <input
          id="chat-input-field"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Напишите сообщение..."
          maxLength={1000}
          className="flex-1 bg-zinc-950 text-xs text-zinc-200 px-4 py-3 rounded-xl border border-zinc-855 outline-none focus:border-indigo-500 transition-colors"
          title="Поле ввода сообщения"
        />

        <button
          id="chat-send-msg-btn"
          type="submit"
          disabled={!inputText.trim()}
          className={`p-3 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            inputText.trim() 
              ? "bg-indigo-600 hover:bg-indigo-550 text-white shadow-md shadow-indigo-600/10" 
              : "bg-zinc-800/40 text-zinc-650 cursor-not-allowed border border-zinc-850/20"
          }`}
          title="Отправить сообщение"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
