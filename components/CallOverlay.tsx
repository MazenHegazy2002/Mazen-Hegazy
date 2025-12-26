
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { User } from '../types';
import { decode, encode, decodeAudioData, createPcmBlob } from '../services/audioHelper';

interface CallOverlayProps {
  recipient: User;
  type: 'voice' | 'video';
  onClose: () => void;
}

type CallQuality = 'Excellent' | 'Good' | 'Fair' | 'Poor';

const CallOverlay: React.FC<CallOverlayProps> = ({ recipient, type, onClose }) => {
  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [quality, setQuality] = useState<CallQuality>('Excellent');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === 'voice');
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [showStats, setShowStats] = useState(false);
  
  // Simulated stats
  const [ping, setPing] = useState(24);
  const [bitrate, setBitrate] = useState(2.4);

  const videoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const screenStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let interval: number;
    if (callState === 'connected') {
      interval = window.setInterval(() => setDuration(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Enhanced Quality Simulation
  useEffect(() => {
    if (callState !== 'connected') return;
    
    const interval = setInterval(() => {
      const rand = Math.random();
      if (rand > 0.95) {
        setQuality('Poor');
        setPing(Math.floor(Math.random() * 200) + 150);
        setBitrate(0.4);
      } else if (rand > 0.8) {
        setQuality('Fair');
        setPing(Math.floor(Math.random() * 50) + 80);
        setBitrate(1.1);
      } else if (rand > 0.4) {
        setQuality('Good');
        setPing(Math.floor(Math.random() * 20) + 40);
        setBitrate(2.1);
      } else {
        setQuality('Excellent');
        setPing(Math.floor(Math.random() * 10) + 15);
        setBitrate(3.8);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [callState]);

  const stopCall = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    sourcesRef.current.forEach(s => s.stop());
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setCallState('ended');
    setTimeout(onClose, 1000);
  }, [onClose]);

  const toggleScreenShare = async () => {
    if (isSharingScreen) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      screenStreamRef.current = null;
      setIsSharingScreen(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }
        setIsSharingScreen(true);
        stream.getTracks()[0].onended = () => {
          setIsSharingScreen(false);
          screenStreamRef.current = null;
        };
      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    }
  };

  useEffect(() => {
    const initCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: type === 'video' 
        });

        if (videoRef.current && type === 'video') {
          videoRef.current.srcObject = stream;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = inputCtx;
        outputAudioContextRef.current = outputCtx;

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: `You are simulating a friendly contact named ${recipient.name} on a messaging app. This call is SECURE and END-TO-END ENCRYPTED. Speak naturally, keep responses concise. If the user shares their screen, comment on what you see.`,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
          },
          callbacks: {
            onopen: () => {
              setCallState('connected');
              const source = inputCtx.createMediaStreamSource(stream);
              const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (e) => {
                if (isMuted) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };

              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);

              const sendFrame = () => {
                if (!canvasRef.current) return;
                let sourceEl: HTMLVideoElement | null = null;
                if (isSharingScreen && screenVideoRef.current) {
                  sourceEl = screenVideoRef.current;
                } else if (!isVideoOff && videoRef.current) {
                  sourceEl = videoRef.current;
                }
                if (!sourceEl || sourceEl.readyState < 2) return;
                const ctx = canvasRef.current.getContext('2d');
                if (!ctx) return;
                canvasRef.current.width = 320;
                canvasRef.current.height = 240;
                ctx.drawImage(sourceEl, 0, 0, 320, 240);
                canvasRef.current.toBlob(async (blob) => {
                  if (blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const base64 = (reader.result as string).split(',')[1];
                      sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } }));
                    };
                    reader.readAsDataURL(blob);
                  }
                }, 'image/jpeg', 0.6);
              };

              const frameInterval = setInterval(sendFrame, 1500);
              return () => clearInterval(frameInterval);
            },
            onmessage: async (msg: LiveServerMessage) => {
              const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (audioData) {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const buffer = await decodeAudioData(decode(audioData as string), outputCtx, 24000, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(outputCtx.destination);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
              }

              if (msg.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
              }
            },
            onerror: () => stopCall(),
            onclose: () => stopCall(),
          }
        });

        sessionRef.current = await sessionPromise;
      } catch (err) {
        console.error('Call failed:', err);
        onClose();
      }
    };

    initCall();

    return () => {
      if (audioContextRef.current) audioContextRef.current.close();
      if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    };
  }, [recipient.name, type, onClose, stopCall, isMuted, isVideoOff, isSharingScreen]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const QualityIndicator = () => {
    const colorClasses = {
      Excellent: 'text-blue-400',
      Good: 'text-green-500',
      Fair: 'text-yellow-500',
      Poor: 'text-red-500'
    };

    const barCount = {
      Excellent: 4,
      Good: 3,
      Fair: 2,
      Poor: 1
    };
    
    return (
      <div 
        onClick={() => setShowStats(!showStats)}
        className="flex flex-col items-center cursor-pointer group mt-4"
      >
        <div className={`flex items-center space-x-2 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/5 transition-all duration-500 group-hover:bg-white/5 ${colorClasses[quality]}`}>
          {/* Signal Bars */}
          <div className="flex items-end space-x-1 h-3 mb-0.5">
            {[1, 2, 3, 4].map(idx => (
              <div 
                key={idx} 
                className={`w-1 rounded-full transition-all duration-500 ${
                  idx <= barCount[quality] ? 'bg-current' : 'bg-zinc-800'
                }`} 
                style={{ height: `${25 * idx}%` }}
              />
            ))}
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.1em]">{quality}</span>
          
          <div className="w-[1px] h-4 bg-white/10 mx-1" />
          
          <div className="flex items-center space-x-1.5 text-zinc-400">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
             <span className="text-[10px] font-bold uppercase tracking-wider">Zylos Turbo</span>
          </div>
        </div>

        {/* Floating Mini Stats */}
        <div className={`mt-2 transition-all duration-300 ${showStats ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
          <div className="bg-[#1c1f26] border border-white/10 rounded-xl p-2 px-3 flex space-x-4 shadow-2xl">
             <div className="flex flex-col">
               <span className="text-[8px] text-zinc-500 font-bold uppercase">Ping</span>
               <span className={`text-[10px] font-mono font-bold ${ping > 100 ? 'text-red-400' : 'text-zinc-300'}`}>{ping}ms</span>
             </div>
             <div className="flex flex-col">
               <span className="text-[8px] text-zinc-500 font-bold uppercase">Bitrate</span>
               <span className="text-[10px] font-mono font-bold text-zinc-300">{bitrate.toFixed(1)} Mbps</span>
             </div>
             <div className="flex flex-col">
               <span className="text-[8px] text-zinc-500 font-bold uppercase">Proxy</span>
               <span className="text-[10px] font-mono font-bold text-blue-400">RU-OPT</span>
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f1115] flex flex-col items-center justify-center animate-in fade-in duration-300">
      {/* Background Animated Glow */}
      <div className={`absolute w-[150%] h-[150%] -top-1/4 -left-1/4 transition-colors duration-1000 blur-[120px] opacity-20 -z-10 ${
        quality === 'Excellent' ? 'bg-blue-600' : 
        quality === 'Good' ? 'bg-green-600' : 
        quality === 'Fair' ? 'bg-yellow-600' : 'bg-red-600'
      }`} />

      <div className="absolute inset-0 flex items-center justify-center">
        {isSharingScreen ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50">
             <video ref={screenVideoRef} autoPlay playsInline className="max-w-[90%] max-h-[80%] rounded-2xl border-2 border-blue-500 shadow-2xl" />
             <div className="mt-4 flex items-center space-x-2 bg-blue-500 px-4 py-2 rounded-full text-white font-bold animate-pulse">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
               <span>Sharing Screen...</span>
             </div>
          </div>
        ) : type === 'video' && !isVideoOff ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center space-y-6">
            <div className={`w-44 h-44 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border-4 transition-all duration-500 shadow-[0_0_60px_rgba(0,0,0,0.5)] ${
              quality === 'Excellent' ? 'border-blue-500/50' : 
              quality === 'Good' ? 'border-green-500/50' : 
              quality === 'Fair' ? 'border-yellow-500/50' : 'border-red-500/50'
            }`}>
               <img src={recipient.avatar} alt={recipient.name} className="w-full h-full object-cover" />
            </div>
            <div className="text-center flex flex-col items-center">
              <h2 className="text-4xl font-bold text-white tracking-tight">{recipient.name}</h2>
              <p className="text-zinc-400 mt-2 font-mono text-xl tracking-widest">{callState === 'connecting' ? 'CONNECTING...' : formatTime(duration)}</p>
              {callState === 'connected' && <QualityIndicator />}
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {type === 'video' && !isSharingScreen && (
        <div className="absolute top-6 right-6 w-32 h-44 bg-zinc-800 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl z-20 transition-transform hover:scale-105 active:scale-95 cursor-pointer">
           <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale brightness-75" />
        </div>
      )}

      {/* Enhanced Encryption Badge */}
      {callState === 'connected' && (
        <div className="absolute top-8 left-8 z-20">
           <div className="flex items-center bg-zinc-900/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5 shadow-2xl">
             <div className="relative mr-3 flex items-center justify-center">
               <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
               <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20" />
             </div>
             <div className="flex flex-col">
               <span className="text-[10px] font-black text-white uppercase tracking-wider leading-none">Quantum-Secure</span>
               <span className="text-[8px] font-bold text-blue-400/80 uppercase tracking-widest mt-1">E2EE Tunnel Active</span>
             </div>
           </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute bottom-16 w-full max-w-xl px-10 z-30">
        <div className="bg-[#16191e]/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white rotate-12' : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 active:scale-90'}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMuted ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z M3 3l18 18" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              )}
            </svg>
          </button>

          {type === 'video' && (
            <button 
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-zinc-700/50 text-zinc-500' : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 active:scale-90'}`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
          )}

          {type === 'video' && (
            <button 
              onClick={toggleScreenShare}
              className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all ${isSharingScreen ? 'bg-blue-600 text-white animate-pulse' : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 active:scale-90'}`}
              title="Share Screen"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
          )}

          <button 
            onClick={stopCall}
            className="w-20 h-20 rounded-[2.5rem] bg-red-600 flex items-center justify-center text-white hover:bg-red-700 transition-all shadow-xl shadow-red-900/40 active:scale-75 group"
          >
            <svg className="w-10 h-10 rotate-[135deg] transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
          </button>
          
          <button 
            onClick={() => setShowStats(!showStats)}
            className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all ${showStats ? 'bg-blue-600 text-white' : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 active:scale-90'}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;
