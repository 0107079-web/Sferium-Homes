import React, { useEffect, useRef, useImperativeHandle } from "react";
import Hls from "hls.js";
import MediaPlayer from "dashjs";

interface UniversalPlayerProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src?: string;
}

export const UniversalPlayer = React.forwardRef<HTMLVideoElement, UniversalPlayerProps>(
  ({ src, ...props }, ref) => {
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Expose localVideoRef.current to parent components via forwardRef
    useImperativeHandle(ref, () => localVideoRef.current!);

    useEffect(() => {
      const video = localVideoRef.current;
      if (!video) return;

      // Clean up previous stream state to prevent black screen or residue
      video.innerHTML = "";
      video.src = "";

      if (!src) return;

      const isHls = src.toLowerCase().includes(".m3u8") || src.toLowerCase().includes("m3u8");
      const isDash = src.toLowerCase().includes(".mpd") || src.toLowerCase().includes("mpd");

      if (isHls) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
          });
          hls.loadSource(src);
          hls.attachMedia(video);
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
        }
        return;
      }

      if (isDash) {
        const player = MediaPlayer().create();
        player.initialize(video, src, true);
        return;
      }

      video.src = src;
    }, [src]);

    return (
      <video
        ref={localVideoRef}
        {...props}
      />
    );
  }
);

UniversalPlayer.displayName = "UniversalPlayer";
export default UniversalPlayer;
