import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VideoPlayerProps {
  /** URL do vídeo vertical (9:16). */
  videoUrl?: string;
  /** Badge curto exibido no canto superior do player. */
  badge?: string;
}

// Player de vídeo vertical 9:16 reutilizável (a "VSL"), com controles próprios.
// Extraído da antiga tela separada para viver diretamente na home.
export default function VideoPlayer({
  videoUrl = 'https://assets.mixkit.co/videos/preview/mixkit-african-children-laughing-and-playing-41315-large.mp4',
  badge = 'Missão em Angola',
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [showPlayOverlay, setShowPlayOverlay] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setShowPlayOverlay(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    videoRef.current.muted = next;
    setIsMuted(next);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setProgress(dur ? (current / dur) * 100 : 0);
    setCurrentTime(formatTime(current));
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (dur && !isNaN(dur)) setDuration(formatTime(dur));
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setShowPlayOverlay(true);
    setProgress(0);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = ratio * (videoRef.current.duration || 0);
    setProgress(ratio * 100);
  };

  // Autoplay silencioso ao montar (respeitando políticas do navegador).
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = true;
    setIsMuted(true);
    videoRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setShowPlayOverlay(false);
      })
      .catch(() => {
        setIsPlaying(false);
        setShowPlayOverlay(true);
      });
  }, []);

  return (
    <div className="w-full max-w-[340px] md:max-w-[360px] aspect-[9/16] rounded-[36px] overflow-hidden bg-black shadow-2xl relative border-[6px] border-stone-900 group mx-auto">
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-cover"
        loop
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleVideoEnded}
        onClick={togglePlay}
      />

      {/* Overlay de play quando pausado */}
      <AnimatePresence>
        {showPlayOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={togglePlay}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center cursor-pointer z-20"
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="w-20 h-20 rounded-full bg-gradient-to-r from-terracotta-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-terracotta-600/30 border-2 border-white/50"
            >
              <Play size={36} className="fill-current ml-1" />
            </motion.div>
            <span className="mt-4 text-xs font-black tracking-widest uppercase text-white font-display text-center drop-shadow-md">
              Clique para Assistir
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge superior */}
      {badge && (
        <div className="absolute top-4 left-4 bg-terracotta-600/80 backdrop-blur-md text-white text-xs font-black tracking-widest uppercase px-3 py-1.5 rounded-full z-10 shadow-md">
          {badge}
        </div>
      )}

      {/* Barra de controle */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 pt-12 flex flex-col gap-3 transition-opacity duration-300 opacity-90 group-hover:opacity-100 z-10">
        <div
          className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer overflow-hidden relative"
          onClick={handleProgressBarClick}
        >
          <div
            className="h-full bg-gradient-to-r from-terracotta-500 to-amber-400 absolute left-0 top-0 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-white text-xs font-bold">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="hover:text-amber-400 transition-colors p-1 cursor-pointer">
              {isPlaying ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current" />}
            </button>
            <span className="font-mono text-[10px] tracking-wider text-stone-300">
              {currentTime} / {duration}
            </span>
          </div>

          <button onClick={toggleMute} className="hover:text-amber-400 transition-colors p-1 cursor-pointer">
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
