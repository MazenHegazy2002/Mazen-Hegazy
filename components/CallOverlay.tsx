
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { User, SignalMessage } from '../types';
import { signaling } from '../services/signaling';

interface CallOverlayProps {
  recipient: User;
  currentUser: User;
  type: 'voice' | 'video';
  offerData?: any;
  onClose: () => void;
  isIncoming?: boolean;
}

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ],
  iceCandidatePoolSize: 10,
};

const CallOverlay: React.FC<CallOverlayProps> = ({ recipient, currentUser, type, offerData, onClose, isIncoming = false }) => {
  const [callState, setCallState] = useState<'ringing' | 'connecting' | 'connected' | 'ended'>(isIncoming ? 'ringing' : 'connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-4), msg]);
    console.log(`[CallDebug] ${msg}`);
  };

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    let interval: number;
    if (callState === 'connected') {
      interval = window.setInterval(() => setDuration(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const stopCall = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    // Notify other peer
    signaling.sendSignal(currentUser.id, recipient.id, 'end', {});
    setCallState('ended');
    setTimeout(onClose, 800);
  }, [onClose, recipient.id, currentUser.id]);

  const initializePeer = async (incomingOffer?: any) => {
    try {
      addLog("v4.5 Starting Connection (Relay Mode)...");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API missing! Are you on HTTPS?");
      }

      addLog("Getting User Media...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video' ? { facingMode: 'user' } : false
      });
      addLog("Got Local Stream");

      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      addLog("Creating Peer Connection...");
      const peer = new RTCPeerConnection(configuration);
      peerRef.current = peer;

      // Monitor Connection State
      peer.oniceconnectionstatechange = () => {
        addLog(`ICE State: ${peer.iceConnectionState}`);
        if (peer.iceConnectionState === 'failed') {
          addLog("ICE FAILED - Relay Blocked?");
        }
      };

      peer.onconnectionstatechange = () => {
        addLog(`Conn State: ${peer.connectionState}`);
      };

      // Add local tracks
      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      // Handle remote stream
      peer.ontrack = (event) => {
        addLog("Got Remote Track!");
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        // IMPORTANT: Also bind to audio element ensuring sound works
        if (audioRef.current) {
          addLog("Binding Audio...");
          audioRef.current.srcObject = event.streams[0];
          audioRef.current.play()
            .then(() => addLog("Audio Playing"))
            .catch(e => addLog("Audio Play Err: " + e.message));
        }
        setCallState('connected');
      };

      // Handle ICE candidates
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          signaling.sendSignal(currentUser.id, recipient.id, 'candidate', event.candidate);
        }
      };

      // Listen for signs (candidates, end, etc.)
      signaling.subscribe(currentUser.id, async (type, data) => {
        if (!peerRef.current) return;
        addLog(`Signal: ${type}`);

        if (type === 'offer') {
          // Re-negotiation (future proofing)
        } else if (type === 'answer') {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data));
        } else if (type === 'candidate') {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(data));
        } else if (type === 'end') {
          setCallState('ended');
          setTimeout(onClose, 800);
          stream.getTracks().forEach(t => t.stop());
        }
      });

      // SIGNALING LOGIC
      if (incomingOffer) {
        // WE ARE ANSWERING
        addLog("Accepting Offer...");
        await peer.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        signaling.sendSignal(currentUser.id, recipient.id, 'answer', answer);
      } else {
        // WE ARE CALLING
        addLog("Initiating Offer...");
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        // Clean the offer object to ensure it's serializable and include callType
        const signalData = { type: offer.type, sdp: offer.sdp, callType: type };
        signaling.sendSignal(currentUser.id, recipient.id, 'offer', signalData);
      }

      return stream;

    } catch (err: any) {
      addLog(`Error: ${err.message}`);
      console.error("Call Setup Failed:", err);
    }
  };

  // Only auto-start if outgoing
  useEffect(() => {
    if (!isIncoming) {
      initializePeer();
    }
  }, []);

  const handleAnswer = async () => {
    setCallState('connecting');
    await initializePeer(offerData);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-[#0b0d10] flex flex-col items-center justify-center animate-in fade-in duration-700">

      <audio ref={audioRef} autoPlay playsInline />

      {/* DEBUG LOGS RESTORED FOR DIAGNOSIS */}
      <div className="absolute top-10 left-0 right-0 z-50 pointer-events-none p-4">
        <div className="bg-black/50 text-[#00ff00] font-mono text-[10px] p-2 rounded backdrop-blur max-w-sm mx-auto">
          {logs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      </div>

      {/* Remote Video (Full Screen) */}
      {type === 'video' && (
        <video
          ref={remoteVideoRef}
          autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Connection Status / Avatar */}
      {!(type === 'video' && callState === 'connected') && (
        <div className="relative z-10 flex flex-col items-center text-center px-6">
          <div className={`w-36 h-36 rounded-[2.5rem] border-4 p-1 mb-8 shadow-2xl transition-all duration-700 bg-zinc-800 ${callState === 'connected' ? 'border-blue-500 scale-105' : 'border-white/5 ' + (callState === 'ringing' ? 'animate-bounce' : 'animate-pulse')}`}>
            <img src={recipient.avatar} alt="" className="w-full h-full rounded-[2rem] object-cover" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{recipient.name}</h2>

          <div className="flex flex-col items-center space-y-2">
            {callState === 'ringing' ? (
              <p className="text-sm font-bold uppercase tracking-widest text-blue-400 animate-pulse">Incoming Call...</p>
            ) : (
              <p className={`text-[10px] font-black uppercase tracking-[0.4em] ${callState === 'connecting' ? 'text-zinc-600 animate-pulse' : 'text-blue-500'}`}>
                {callState === 'connecting' ? 'Encrypting Connection' : 'Neural Link Established'}
              </p>
            )}
            {callState === 'connected' && <span className="text-white font-mono text-sm opacity-60 tabular-nums">{formatTime(duration)}</span>}
          </div>
        </div>
      )}

      {/* Local Video (PIP) */}
      {type === 'video' && callState !== 'ringing' && (
        <div className="absolute top-8 right-8 w-32 h-48 rounded-2xl border-2 border-white/10 overflow-hidden shadow-2xl z-20">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-16 w-full flex items-center justify-center space-x-12 z-20">

        {callState === 'ringing' ? (
          <>
            <button
              onClick={stopCall}
              className="w-20 h-20 bg-red-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-red-900/50 active:scale-90 transition-transform"
            >
              <svg className="w-8 h-8 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
            </button>

            <button
              onClick={handleAnswer}
              className="w-20 h-20 bg-green-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-green-900/50 active:scale-90 transition-transform animate-pulse"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

export default CallOverlay;
