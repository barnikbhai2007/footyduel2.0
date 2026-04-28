
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAIN_BGM = "https://res.cloudinary.com/speed-searches/video/upload/v1772188717/main_qct51w.mp3";
const RESULT_BGM = "https://res.cloudinary.com/speed-searches/video/upload/v1772188718/result_oszoqn.mp3";

export function AudioController() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(MAIN_BGM);

  const isGameRoute = pathname?.startsWith('/game/');

  useEffect(() => {
    let src = MAIN_BGM;
    
    // Silence during game, play on result
    if (isGameRoute) {
      src = ""; 
    } else if (pathname?.startsWith('/result/')) {
      src = RESULT_BGM;
    }
    
    if (src !== currentSrc) {
      setCurrentSrc(src);
      if (audioRef.current) {
        audioRef.current.src = src;
        if (src && !isMuted && isPlaying) {
          audioRef.current.play().catch(() => {});
        } else {
          audioRef.current.pause();
        }
      }
    }
  }, [pathname, currentSrc, isMuted, isPlaying, isGameRoute]);

  const toggleAudio = () => {
    if (!audioRef.current) return;

    if (!isPlaying) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setIsMuted(false);
      }).catch(err => console.error("Audio blocked:", err));
    } else {
      if (isMuted) {
        audioRef.current.muted = false;
        setIsMuted(false);
        if (currentSrc) audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.muted = true;
        setIsMuted(true);
      }
    }
  };

  // Hide the toggle button if we are in a game session
  if (isGameRoute) return null;

  return (
    <>
      <audio
        ref={audioRef}
        src={currentSrc}
        loop
        autoPlay={false}
      />
      <div className="fixed bottom-6 right-6 z-[100]">
        <Button
          onClick={toggleAudio}
          size="icon"
          className={`h-12 w-12 rounded-full shadow-2xl transition-all hover:scale-110 ${isMuted || !isPlaying ? 'bg-slate-800 text-slate-400' : 'bg-primary text-black'}`}
        >
          {isMuted || !isPlaying ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </Button>
      </div>
    </>
  );
}
