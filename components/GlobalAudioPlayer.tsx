
import React, { useRef, useEffect, useState } from 'react';
import { PlaybackState } from '../types';

interface GlobalAudioPlayerProps {
  playback: PlaybackState;
  onToggle: () => void;
  onClose: () => void;
}

const GlobalAudioPlayer: React.FC<GlobalAudioPlayerProps> = ({ playback, onToggle, onClose }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (audioRef.current && playback.content) {
      if (playback.isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [playback.isPlaying, playback.content]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p || 0);
      if (p >= 100) onClose();
    }
  };

  const toggleSpeed = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  if (!playback.content) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[4000] animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-[#1c1f26]/90 backdrop-blur-3xl border border-white/10 rounded-[1.75rem] p-3 shadow-2xl flex items-center space-x-3">
        <audio 
          ref={audioRef} 
          src={playback.content} 
          onTimeUpdate={handleTimeUpdate}
          onEnded={onClose}
        />
        
        <div className="relative flex-shrink-0">
          <img src={playback.senderAvatar || ''} className="w-10 h-10 rounded-xl object-cover" alt="" />
          <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-0.5 border-2 border-[#1c1f26]">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/></svg>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <h4 className="text-[11px] font-bold text-white truncate">{playback.senderName}</h4>
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">Voice Note</span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex items-center space-x-1 pl-2">
          <button 
            onClick={toggleSpeed}
            className="w-8 h-8 rounded-lg bg-white/5 text-[9px] font-black text-zinc-400 hover:text-white transition-colors"
          >
            {speed}x
          </button>
          <button 
            onClick={onToggle}
            className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
          >
            {playback.isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-600 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalAudioPlayer;
