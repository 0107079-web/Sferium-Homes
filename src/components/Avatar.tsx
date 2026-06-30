import React from "react";

interface AvatarProps {
  src?: string;
  className?: string;
  fallback?: string;
  style?: React.CSSProperties;
}

export default function Avatar({ src, className = "w-8 h-8 rounded-xl text-lg", fallback = "🍿", style }: AvatarProps) {
  const isUrlOrBase64 = src && (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:"));

  if (isUrlOrBase64) {
    return (
      <img
        src={src}
        alt="User avatar"
        className={`${className} object-cover shrink-0 select-none overflow-hidden`}
        style={style}
        referrerPolicy="no-referrer"
        onError={(e) => {
          // Fallback if image fails to load
          (e.target as HTMLImageElement).outerHTML = `<div class="${className} bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 select-none" style="${style ? Object.entries(style).map(([k, v]) => `${k}:${v}`).join(';') : ''}">${fallback}</div>`;
        }}
      />
    );
  }

  return (
    <div 
      className={`${className} bg-zinc-900/60 border border-zinc-850/40 flex items-center justify-center shrink-0 select-none font-sans`}
      style={style}
    >
      <span className="leading-none">{src || fallback}</span>
    </div>
  );
}
