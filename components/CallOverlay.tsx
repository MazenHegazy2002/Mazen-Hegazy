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

// HYBRID CONFIG
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
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
  const [currentType, setCurrentType] = useState(type);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showAutoplayBtn, setShowAutoplayBtn] = useState(false);

  // DEBUG STATE
  const [debugInfo, setDebugInfo] = useState({
    ice: 'init',
    conn: 'init',
    tracks: 0,
    audioState: 'idle'
  });

  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const [streamKey, setStreamKey] = useState(Date.now());
  const remoteAudioHelper = useRef<HTMLAudioElement>(new Audio());

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  // Update Debug Info
  const updateDebug = (key: keyof typeof debugInfo, val: string | number) => {
    setDebugInfo(prev => ({ ...prev, [key]: val }));
    console.log(`[V4.23] ${key}: ${val}`);
  };

  useEffect(() => {
    let interval: number;
    if (callState === 'connected') {
      interval = window.setInterval(() => setDuration(prev => prev + 1), 1000);

      const monitor = setInterval(() => {
        const tracks = remoteStreamRef.current.getTracks();
        updateDebug('tracks', tracks.length);
        updateDebug('ice', peerRef.current?.iceConnectionState || 'unknown');
        updateDebug('audioState', remoteAudioHelper.current.paused ? 'paused' : 'playing');

        // Rescue Audio
        if (tracks.length > 0 && remoteAudioHelper.current.paused) {
          remoteAudioHelper.current.play().catch(() => setShowAutoplayBtn(true));
        }
      }, 2000);
      return () => clearInterval(monitor);
    }
    return () => clearInterval(interval);
  }, [callState]);

  useEffect(() => {
    remoteAudioHelper.current.autoplay = true;
    return () => {
      remoteAudioHelper.current.pause();
      remoteAudioHelper.current.srcObject = null;
    };
  }, []);

  // Video Binding
  useEffect(() => {
    if (currentType === 'video' && remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        console.log("Binding Video...");
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.muted = true; // REQUIRED FOR AUTOPLAY
        remoteVideoRef.current.play().catch(e => console.error("Video Play Err:", e));
      }
    }
  }, [currentType, streamKey]);


  const stopCall = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    signaling.sendSignal(currentUser.id, recipient.id, 'end', {});
    setCallState('ended');
    setTimeout(onClose, 800);
  }, [onClose, recipient.id, currentUser.id]);

  const toggleVideoMode = async () => {
    const newType = currentType === 'video' ? 'voice' : 'video';
    setCurrentType(newType);

    if (newType === 'video') {
      try {
        console.log("Upgrading to Video...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        localStreamRef.current = stream;
        stream.getAudioTracks().forEach(track => track.enabled = !isMuted);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        if (peerRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];
          const transceivers = peerRef.current.getTransceivers();

          const videoTransceiver = transceivers.find(t => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video');
          if (videoTransceiver && videoTransceiver.sender) {
            await videoTransceiver.sender.replaceTrack(videoTrack);
            videoTransceiver.direction = 'sendrecv';
          } else {
            peerRef.current.addTrack(videoTrack, stream);
          }

          const audioTransceiver = transceivers.find(t => t.sender.track?.kind === 'audio' || t.receiver.track?.kind === 'audio');
          if (audioTransceiver && audioTransceiver.sender) {
            audioTransceiver.sender.replaceTrack(audioTrack);
          }

          const offer = await peerRef.current.createOffer();
          await peerRef.current.setLocalDescription(offer);
          signaling.sendSignal(currentUser.id, recipient.id, 'offer', { type: offer.type, sdp: offer.sdp, callType: 'video' });
        }
      } catch (e: any) {
        console.error("Upgrade Err:", e);
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => t.stop());
      }
    }
  };

  const processBufferedCandidates = async () => {
    if (pendingCandidates.current.length > 0 && peerRef.current?.remoteDescription) {
      for (const candidate of pendingCandidates.current) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) { }
      }
      pendingCandidates.current = [];
    }
  };

  const initializePeer = async (incomingOffer?: any) => {
    try {
      console.log("Initializing v4.23 Peer...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: currentType === 'video' ? { facingMode: 'user' } : false
      });

      localStreamRef.current = stream;
      stream.getAudioTracks().forEach(t => t.enabled = !isMuted);
      if (localVideoRef.current && currentType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const peer = new RTCPeerConnection(configuration);
      peerRef.current = peer;

      // CLEANER TRANSCEIVER INIT
      // 1. Audio: Always present and sendrecv
      peer.addTransceiver('audio', { direction: 'sendrecv', streams: [stream] });

      // 2. Video: Depends on mode
      if (currentType === 'video') {
        peer.addTransceiver('video', { direction: 'sendrecv', streams: [stream] });
      } else {
        // Placeholder for upgrade
        peer.addTransceiver('video', { direction: 'recvonly' });
      }

      peer.onconnectionstatechange = () => {
        updateDebug('conn', peer.connectionState);
        if (peer.connectionState === 'connected') setCallState('connected');
      };
      peer.oniceconnectionstatechange = () => {
        updateDebug('ice', peer.iceConnectionState);
        if (peer.iceConnectionState === 'failed') peer.restartIce();
      };

      peer.ontrack = (event) => {
        const { track } = event;
        // console.log(`Got Track: ${track.kind}`);
        remoteStreamRef.current.addTrack(track);

        // Immediate Binding
        if (track.kind === 'audio') {
          remoteAudioHelper.current.srcObject = remoteStreamRef.current;
          remoteAudioHelper.current.play().catch(() => setShowAutoplayBtn(true));
        }

        setStreamKey(Date.now());
        if (track.kind === 'video') setCurrentType('video');
        setCallState('connected');
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) signaling.sendSignal(currentUser.id, recipient.id, 'candidate', event.candidate);
      };

      signaling.subscribe(currentUser.id, async (type, data) => {
        if (!peerRef.current) return;

        if (type === 'offer') {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data));
          await processBufferedCandidates();
          const answer = await peerRef.current.createAnswer();
          await peerRef.current.setLocalDescription(answer);
          signaling.sendSignal(currentUser.id, recipient.id, 'answer', answer);
          if (data.callType === 'video') setCurrentType('video');

        } else if (type === 'answer') {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data));
          await processBufferedCandidates();

        } else if (type === 'candidate') {
          if (peerRef.current.remoteDescription) {
            peerRef.current.addIceCandidate(new RTCIceCandidate(data));
          } else {
            pendingCandidates.current.push(data);
          }
        } else if (type === 'end') {
          stopCall();
        }
      });

      if (incomingOffer) {
        await peer.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        await processBufferedCandidates();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        signaling.sendSignal(currentUser.id, recipient.id, 'answer', answer);
      } else {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        signaling.sendSignal(currentUser.id, recipient.id, 'offer', { type: offer.type, sdp: offer.sdp, callType: currentType });
      }

    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!isIncoming) initializePeer();
  }, []);

  const handleAnswer = async () => {
    setCallState('connecting');
    await initializePeer(offerData);
  };

  const manualPlay = () => {
    remoteAudioHelper.current.play();
    setShowAutoplayBtn(false);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-[#0b0d10] flex flex-col items-center justify-center animate-in fade-in duration-700">

      {/* PERSISTENT DASHBOARD */}
      <div className="absolute top-4 left-4 z-[9999] bg-black/80 border border-green-500/30 text-green-400 p-4 rounded-xl font-mono text-[11px] shadow-2xl backdrop-blur-md">
        <div className="font-bold border-b border-green-500/30 mb-2 pb-1">V4.23 SYSTEM STATUS</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="opacity-50">CONNECTION:</span>  <span>{debugInfo.conn.toUpperCase()}</span>
          <span className="opacity-50">ICE STATE:</span>   <span>{debugInfo.ice.toUpperCase()}</span>
          <span className="opacity-50">TRACKS RX:</span>   <span className={debugInfo.tracks > 0 ? "text-green-300 font-bold" : "text-red-500 font-bold animate-pulse"}>{debugInfo.tracks}</span>
          <span className="opacity-50">AUDIO:</span>       <span>{debugInfo.audioState.toUpperCase()}</span>
        </div>
      </div>

      {showAutoplayBtn && (
        <button onClick={manualPlay} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[2000] bg-red-600 text-white font-bold px-8 py-4 rounded-full shadow-2xl animate-bounce">
          TAP TO ENABLE AUDIO
        </button>
      )}

      {/* Remote Video */}
      {currentType === 'video' && (
        <video
          key={streamKey}
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Status Overlay */}
      {!(currentType === 'video' && callState === 'connected') && (
        <div className="relative z-10 flex flex-col items-center text-center px-6">
          <div className={`w-36 h-36 rounded-[2.5rem] border-4 p-1 mb-8 shadow-2xl transition-all duration-700 bg-zinc-800 ${callState === 'connected' ? 'border-blue-500 scale-105' : 'border-white/5 ' + (callState === 'ringing' ? 'animate-bounce' : 'animate-pulse')}`}>
            <img src={recipient.avatar} alt="" className="w-full h-full rounded-[2rem] object-cover" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{recipient.name}</h2>
          <div className="flex flex-col items-center space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">
              {callState === 'connecting' ? 'Establishing Neural Link' : callState === 'ringing' ? 'Incoming Signal' : 'Connected'}
            </p>
            {callState === 'connected' && <span className="text-white font-mono text-sm opacity-60 tabular-nums">{formatTime(duration)}</span>}
          </div>
        </div>
      )}

      {/* Local Video */}
      {currentType === 'video' && callState !== 'ringing' && (
        <div className="absolute top-8 right-8 w-32 h-48 rounded-2xl border-2 border-white/10 overflow-hidden shadow-2xl z-20">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-16 w-full flex items-center justify-center space-x-12 z-20">
        {callState === 'ringing' ? (
          <>
            <button onClick={stopCall} className="w-20 h-20 bg-red-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-red-900/50 active:scale-90 transition-transform"><svg className="w-8 h-8 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></button>
            <button onClick={handleAnswer} className="w-20 h-20 bg-green-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-green-900/50 active:scale-90 transition-transform animate-pulse"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></button>
          </>
        ) : (
          <>
            <button onClick={toggleVideoMode} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${currentType === 'video' ? 'bg-white text-black' : 'bg-white/5 text-zinc-500 hover:text-white'}`}><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
            <button onClick={() => setIsMuted(!isMuted)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/5 text-zinc-500 hover:text-white'}`}><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></button>
            <button onClick={stopCall} className="w-16 h-16 bg-red-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-red-900/50 active:scale-90 transition-transform"><svg className="w-8 h-8 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></button>
          </>
        )}
      </div>
    </div>
  );
};

export default CallOverlay;
