
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { User } from '../types';
import { decode, decodeAudioData, createPcmBlob } from '../services/audioHelper';

interface CallOverlayProps {
  recipient: User;
  type: 'voice' | 'video';
  onClose: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ recipient, type, onClose }) => {
  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const frameIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    let interval: number;
    if (callState === 'connected') {
      interval = window.setInterval(() => setDuration(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const stopCall = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
    }
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    setCallState('ended');
    setTimeout(onClose, 800);
  }, [onClose]);

  useEffect(() => {
    const initCall = async () => {
      try {
        const constraints = { 
          audio: true, 
          video: type === 'video' ? { width: 640, height: 480, facingMode: 'user' } : false 
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
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
            systemInstruction: `You are on a phone call with ${recipient.name} on Zylos. Keep it snappy and natural. If video is on, you can see them.`,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
          },
          callbacks: {
            onopen: () => {
              setCallState('connected');
              const source = inputCtx.createMediaStreamSource(stream);
              const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                sessionPromise.then(session => {
                  if (isMuted) return;
                  const inputData = e.inputBuffer.getChannelData(0);
                  const pcmBlob = createPcmBlob(inputData);
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);

              if (type === 'video' && canvasRef.current && videoRef.current) {
                frameIntervalRef.current = window.setInterval(() => {
                  const canvas = canvasRef.current;
                  const video = videoRef.current;
                  if (canvas && video && video.videoWidth > 0) {
                    const ctx = canvas.getContext('2d');
                    canvas.width = 320;
                    canvas.height = 240;
                    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                    sessionPromise.then(session => session.sendRealtimeInput({ 
                      media: { data: base64Data, mimeType: 'image/jpeg' } 
                    }));
                  }
                }, 1000);
              }
            },
            onmessage: async (msg: LiveServerMessage) => {
              const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
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
                sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
              }
            },
            onerror: (e) => { console.error('Call Link Lost:', e); stopCall(); },
            onclose: () => stopCall(),
          }
        });

        sessionRef.current = await sessionPromise;
      } catch (err) {
        console.error('Handshake failed:', err);
        onClose();
      }
    };

    initCall();
    return () => stopCall();
  }, [type, recipient.name, isMuted, stopCall]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-[#0b0d10] flex flex-col items-center justify-center animate-in fade-in duration-700">
      {type === 'video' && (
        <video 
          ref={videoRef} 
          autoPlay muted playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale blur-2xl"
        />
      )}
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <div className={`w-36 h-36 rounded-[2.5rem] border-4 p-1 mb-8 shadow-2xl transition-all duration-700 bg-zinc-800 ${callState === 'connected' ? 'border-blue-500 scale-105' : 'border-white/5 animate-pulse'}`}>
           {type === 'video' ? (
             <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover rounded-[2rem]" />
           ) : (
             <img src={recipient.avatar} alt="" className="w-full h-full rounded-[2rem] object-cover" />
           )}
        </div>
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{recipient.name}</h2>
        <div className="flex flex-col items-center space-y-2">
          <p className={`text-[10px] font-black uppercase tracking-[0.4em] ${callState === 'connecting' ? 'text-zinc-600 animate-pulse' : 'text-blue-500'}`}>
            {callState === 'connecting' ? 'Encrypting Connection' : 'Neural Link Established'}
          </p>
          {callState === 'connected' && <span className="text-white font-mono text-sm opacity-60 tabular-nums">{formatTime(duration)}</span>}
        </div>
      </div>

      <div className="absolute bottom-16 flex items-center space-x-8 z-20">
        <button 
          onClick={() => setIsMuted(!isMuted)} 
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/5 text-zinc-500 hover:text-white'}`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
        </button>
        
        <button 
          onClick={stopCall} 
          className="w-16 h-16 bg-red-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-red-900/50 active:scale-90 transition-transform"
        >
          <svg className="w-8 h-8 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
        </button>

        <button className="w-14 h-14 bg-white/5 text-zinc-500 hover:text-white rounded-2xl flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
        </button>
      </div>
    </div>
  );
};

export default CallOverlay;
