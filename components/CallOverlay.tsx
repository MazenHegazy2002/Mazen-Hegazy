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

// FINAL STABLE CONFIGURATION - RELAY + GOOGLE
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
  iceTransportPolicy: 'all' as RTCIceTransportPolicy
};

const CallOverlay: React.FC<CallOverlayProps> = ({ recipient, currentUser, type, offerData, onClose, isIncoming = false }) => {
  const [callState, setCallState] = useState<'ringing' | 'connecting' | 'connected' | 'ended'>(isIncoming ? 'ringing' : 'connecting');
  const [currentType, setCurrentType] = useState(type);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // UNIFIED STREAM STATE
  // We use a ref to hold the tracks stably, but state to trigger re-renders if needed
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const [forceUpdate, setForceUpdate] = useState(0); // Hack to force re-render

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-4), msg]);
    console.log(`[CallDebug] ${msg}`);
  };

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    let interval: number;
    if (callState === 'connected') {
      interval = window.setInterval(() => setDuration(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Sync Mute State
  useEffect(() => {
    if (localStreamRef.current) {
      console.log(`[CallOverlay] Toggling Mute: ${isMuted}`);
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Bind Remote Stream to Elements
  const bindRemoteMedia = () => {
    // We bind the SAME stream to both.
    // The browser handles playing audio from a stream even if attached to a video element.
    // But specific <audio> element ensures audio plays if video element is hidden.
    if (audioRef.current && remoteStreamRef.current) {
      if (audioRef.current.srcObject !== remoteStreamRef.current) {
        addLog("Binding Audio Element");
        audioRef.current.srcObject = remoteStreamRef.current;
        audioRef.current.play().catch(e => console.error("Audio Play Err", e));
      }
    }

    if (currentType === 'video' && remoteVideoRef.current && remoteStreamRef.current) {
      addLog("Binding Video Element");
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play().catch(e => console.error("Video Play Err", e));
    }
  };

  // Re-bind whenever the stream changes or type changes
  useEffect(() => {
    bindRemoteMedia();
  }, [currentType, forceUpdate]);


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
        addLog("Upgrading to Video...");
        // 1. Get new stream with Video
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        // 2. Update Local Refs
        localStreamRef.current = stream;
        stream.getAudioTracks().forEach(track => track.enabled = !isMuted);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // 3. Update Peer Connection Tracks
        if (peerRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];
          const senders = peerRef.current.getSenders();

          const videoSender = senders.find(s => s.track && s.track.kind === 'video') || senders.find(s => s.track === null && s.dtmf); // Fallback logic difficult
          // Better: Find transceiver
          const transceivers = peerRef.current.getTransceivers();
          const videoTransceiver = transceivers.find(t => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video');

          if (videoTransceiver && videoTransceiver.sender) {
            addLog("Replacing Video Track");
            await videoTransceiver.sender.replaceTrack(videoTrack);
            // Ensure it's sending
            videoTransceiver.direction = 'sendrecv';
          } else {
            // Fallback for missing transceiver (shouldn't happen with our init)
            addLog("Adding new Video Track");
            peerRef.current.addTrack(videoTrack, stream);
          }

          // Update Audio Track
          const audioSender = senders.find(s => s.track?.kind === 'audio');
          if (audioSender && audioTrack) {
            audioSender.replaceTrack(audioTrack);
          }

          // Renegotiate to ensure the other side knows we are sending video now
          // (Only needed if we changed direction or added track)
          addLog("Negotiating Video Upgrade...");
          const offer = await peerRef.current.createOffer();
          await peerRef.current.setLocalDescription(offer);
          signaling.sendSignal(currentUser.id, recipient.id, 'offer', { type: offer.type, sdp: offer.sdp, callType: 'video' });
        }
      } catch (e: any) {
        addLog("Video Upgrade Err: " + e.message);
      }
    } else {
      // Downgrade logic... stop video tracks
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => t.stop());
      }
    }
  };

  const processBufferedCandidates = async () => {
    if (pendingCandidates.current.length > 0 && peerRef.current?.remoteDescription) {
      addLog(`Flushing ${pendingCandidates.current.length} candidates`);
      for (const candidate of pendingCandidates.current) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) { console.error(e); }
      }
      pendingCandidates.current = [];
    }
  };

  const initializePeer = async (incomingOffer?: any) => {
    try {
      addLog("Initializing Peer...");

      // 1. Get Local Media (Always get Audio, Video depends on intent)
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

      // 2. Add Transceivers (Explicit Control)
      // ALWAYS add both transceivers, even if we don't have video yet.
      // This creates the 'm=' lines in SDP so we can upgrade later without magic.

      // Audio: Always sendrecv
      peer.addTransceiver('audio', { direction: 'sendrecv', streams: [stream] });

      // Video: If we have it, sendrecv. If not, recvonly (listening) or inactive?
      // Best to do 'sendrecv' but with no track if we want to be ready?
      // Actually, passing `streams: [stream]` when no video track exists in stream results in a sender with no track.
      // That's perfect.
      peer.addTransceiver('video', { direction: 'sendrecv', streams: [stream] });


      // 3. Monitor Connectivity
      peer.onconnectionstatechange = () => {
        addLog(`Conn: ${peer.connectionState}`);
        if (peer.connectionState === 'connected') setCallState('connected');
      };
      peer.oniceconnectionstatechange = () => {
        addLog(`ICE: ${peer.iceConnectionState}`);
        if (peer.iceConnectionState === 'failed') peer.restartIce();
      };

      // 4. Handle Remote Tracks (THE FIX)
      peer.ontrack = (event) => {
        const { track } = event;
        addLog(`Got Track: ${track.kind}`);

        // Add to our UNIFIED stream
        remoteStreamRef.current.addTrack(track);

        // If track ends, remove it? usually automatic.
        track.onended = () => { addLog(`Remote ${track.kind} ended`); };

        // Force UI update
        setForceUpdate(prev => prev + 1);

        if (track.kind === 'video') setCurrentType('video');
        setCallState('connected');
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) signaling.sendSignal(currentUser.id, recipient.id, 'candidate', event.candidate);
      };

      signaling.subscribe(currentUser.id, async (type, data) => {
        if (!peerRef.current) return;

        if (type === 'offer') {
          addLog("Got Offer (Renegotiate)");
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data));
          await processBufferedCandidates();

          const answer = await peerRef.current.createAnswer();
          await peerRef.current.setLocalDescription(answer);
          signaling.sendSignal(currentUser.id, recipient.id, 'answer', answer);

          if (data.callType === 'video') setCurrentType('video');

        } else if (type === 'answer') {
          addLog("Got Answer");
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
        addLog("Sending Answer...");
        await peer.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        await processBufferedCandidates();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        signaling.sendSignal(currentUser.id, recipient.id, 'answer', answer);
      } else {
        addLog("Sending Offer...");
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        signaling.sendSignal(currentUser.id, recipient.id, 'offer', { type: offer.type, sdp: offer.sdp, callType: currentType });
      }

    } catch (err: any) {
      addLog("Setup Err: " + err.message);
    }
  };

  useEffect(() => {
    if (!isIncoming) initializePeer();
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

      {/* Persistent Audio Element - bound to unified stream */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* DEBUG LOGS */}
      <div className="absolute top-10 left-0 right-0 z-50 pointer-events-none p-4">
        <div className="bg-black/50 text-[#00ff00] font-mono text-[10px] p-2 rounded backdrop-blur max-w-sm mx-auto">
          {logs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      </div>

      {/* Remote Video */}
      {currentType === 'video' && (
        <video
          ref={remoteVideoRef}
          autoPlay playsInline
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
            {callState === 'ringing' ? (
              <p className="text-sm font-bold uppercase tracking-widest text-blue-400 animate-pulse">Incoming Call...</p>
            ) : (
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">
                {callState === 'connecting' ? 'Establishing Neural Link' : 'Connected'}
              </p>
            )}
            {callState === 'connected' && <span className="text-white font-mono text-sm opacity-60 tabular-nums">{formatTime(duration)}</span>}
          </div>
        </div>
      )}

      {/* Local Video PIP */}
      {currentType === 'video' && callState !== 'ringing' && (
        <div className="absolute top-8 right-8 w-32 h-48 rounded-2xl border-2 border-white/10 overflow-hidden shadow-2xl z-20">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-16 w-full flex items-center justify-center space-x-12 z-20">
        {callState === 'ringing' ? (
          <>
            <button onClick={stopCall} className="w-20 h-20 bg-red-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-red-900/50 active:scale-90 transition-transform">
              <svg className="w-8 h-8 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
            </button>
            <button onClick={handleAnswer} className="w-20 h-20 bg-green-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-green-900/50 active:scale-90 transition-transform animate-pulse">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
            </button>
          </>
        ) : (
          <>
            <button onClick={toggleVideoMode} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${currentType === 'video' ? 'bg-white text-black' : 'bg-white/5 text-zinc-500 hover:text-white'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
            <button onClick={() => setIsMuted(!isMuted)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/5 text-zinc-500 hover:text-white'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
            <button onClick={stopCall} className="w-16 h-16 bg-red-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-red-900/50 active:scale-90 transition-transform">
              <svg className="w-8 h-8 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CallOverlay;
