import React, { useEffect, useRef, useImperativeHandle } from "react";

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

