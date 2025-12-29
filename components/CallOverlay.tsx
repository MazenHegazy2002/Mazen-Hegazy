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
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

const CallOverlay: React.FC<CallOverlayProps> = ({ recipient, currentUser, type, offerData, onClose, isIncoming = false }) => {
  const [callState, setCallState] = useState<'ringing' | 'connecting' | 'connected' | 'ended'>(isIncoming ? 'ringing' : 'connecting');
  const [currentType, setCurrentType] = useState(type);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

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

  // Actual Mute Logic using the persistent stream reference
  useEffect(() => {
    if (localStreamRef.current) {
      console.log(`[CallOverlay] Toggling Mute: ${isMuted}`);
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Bind Remote Video when available
  useEffect(() => {
    if (currentType === 'video' && remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        addLog("Binding Remote Video");
        remoteVideoRef.current.srcObject = remoteStream;
      }
    }
  }, [currentType, remoteStream]);

  // Bind Remote Audio when available
  useEffect(() => {
    if (audioRef.current && remoteStream) {
      if (audioRef.current.srcObject !== remoteStream) {
        addLog("Binding Remote Audio");
        audioRef.current.srcObject = remoteStream;
        audioRef.current.play().catch(e => console.error("Audio Play Error:", e));
      }
    }
  }, [remoteStream]);


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

  const toggleVideoMode = async () => {
    const newType = currentType === 'video' ? 'voice' : 'video';
    setCurrentType(newType);

    // If switching TO video, try to get camera
    if (newType === 'video') {
      try {
        addLog("Upgrading to Video...");
        // ECHO CANCELLATION IS CRITICAL
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        // Update local ref and apply current mute state
        localStreamRef.current = stream;
        stream.getAudioTracks().forEach(track => track.enabled = !isMuted);

        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // Update senders (simple replace)
        if (peerRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];

          const senders = peerRef.current.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          const audioSender = senders.find(s => s.track?.kind === 'audio');

          // Replace or Add Video Track
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          } else {
            console.log("Adding new video track...");
            addLog("Adding Video Track");
            peerRef.current.addTrack(videoTrack, stream);
          }

          // Replace Audio Track (Keep them in sync on the same stream)
          if (audioSender && audioTrack) {
            console.log("Syncing audio track to new stream...");
            audioSender.replaceTrack(audioTrack);
          }

          // Trigger Renegotiation if needed (if we added a track)
          if (!videoSender) {
            addLog("Negotiating Video...");
            // USE ICE RESTART to ensure clean connection for new tracks
            const offer = await peerRef.current.createOffer({ iceRestart: true });
            await peerRef.current.setLocalDescription(offer);
            signaling.sendSignal(currentUser.id, recipient.id, 'offer', { type: offer.type, sdp: offer.sdp, callType: 'video' });
          }
        }
      } catch (e: any) {
        addLog("Video Upgrade Err:" + e.message);
        console.error("Could not upgrade to video:", e);
      }
    } else {
      // Downgrading to voice - stop video tracks
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
        } catch (e) {
          console.error("Candidate Error:", e);
        }
      }
      pendingCandidates.current = [];
    }
  };

  const initializePeer = async (incomingOffer?: any) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API missing! Are you on HTTPS?");
      }

      addLog("Initializing Peer...");

      // FIX ECHO: Enable AEC
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: currentType === 'video' ? { facingMode: 'user' } : false
      });

      // Store stream for Mute/Toggle operations
      localStreamRef.current = stream;
      // Ensure mute state is respected immediately
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
        track.onended = () => addLog("Local Track Ended");
      });

      if (localVideoRef.current && currentType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const peer = new RTCPeerConnection(configuration);
      peerRef.current = peer;

      // EXPLICIT TRANSCEIVERS - FORCE SENDRECV
      peer.addTransceiver('audio', { direction: 'sendrecv', streams: [stream] });
      peer.addTransceiver('video', { direction: 'sendrecv', streams: [stream] });

      // Monitor Connection State (Newer API)
      peer.onconnectionstatechange = () => {
        addLog(`Conn: ${peer.connectionState}`);
        if (peer.connectionState === 'connected') setCallState('connected');
        if (peer.connectionState === 'failed') {
          addLog("Conn Failed. Firewall?");
        }
      };

      // Monitor ICE State (Legacy but useful)
      peer.oniceconnectionstatechange = () => {
        addLog(`ICE: ${peer.iceConnectionState}`);
        if (peer.iceConnectionState === 'failed' || peer.iceConnectionState === 'disconnected') {
          addLog("ICE Retry...");
          peer.restartIce();
        }
      };

      // Handle remote stream
      peer.ontrack = (event) => {
        const rStream = event.streams[0] || new MediaStream([event.track]);
        addLog(`Got Track: ${event.track.kind}`);

        setRemoteStream(rStream);

        // AUTO-DETECT VIDEO: If this is a video track, switch UI
        if (event.track.kind === 'video') {
          console.log("Video Track Detected -> Switching UI");
          setCurrentType('video');
        }

        setCallState('connected');
      };

      // Handle ICE candidates
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          signaling.sendSignal(currentUser.id, recipient.id, 'candidate', event.candidate);
        }
      };

      // Listen for signals (candidates, end, etc.)
      signaling.subscribe(currentUser.id, async (type, data) => {
        if (!peerRef.current) return;

        if (type === 'offer') {
          // HANDLE RENEGOTIATION
          addLog("Renegotiate (Offer)");
          const desc = new RTCSessionDescription({ type: data.type, sdp: data.sdp });
          await peerRef.current.setRemoteDescription(desc);

          // Flush candidates if any arrived before this offer
          await processBufferedCandidates();

          const answer = await peerRef.current.createAnswer();
          await peerRef.current.setLocalDescription(answer);
          signaling.sendSignal(currentUser.id, recipient.id, 'answer', answer);

          if (data.callType === 'video') setCurrentType('video');

        } else if (type === 'answer') {
          addLog("Got Answer");
          const desc = new RTCSessionDescription({ type: data.type, sdp: data.sdp });
          await peerRef.current.setRemoteDescription(desc);

          // CRITICAL: Flush candidates that arrived before the answer
          await processBufferedCandidates();

        } else if (type === 'candidate') {
          if (peerRef.current.remoteDescription) {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(data));
          } else {
            // BUFFER CANDIDATES to avoid "Remote description not set" error
            pendingCandidates.current.push(data);
            // Don't log every single buffer to avoid spam, but maybe log first one
            if (pendingCandidates.current.length === 1) addLog("Buffering Candidates...");
          }
        } else if (type === 'end') {
          addLog("Call Ended");
          setCallState('ended');
          setTimeout(onClose, 800);
          stream.getTracks().forEach(t => t.stop());
        }
      });

      // SIGNALING LOGIC
      if (incomingOffer) {
        // WE ARE ANSWERING
        addLog("Sending Answer...");
        const desc = new RTCSessionDescription({ type: incomingOffer.type, sdp: incomingOffer.sdp });
        await peer.setRemoteDescription(desc);
        // Flush valid candidates immediately
        await processBufferedCandidates();

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        signaling.sendSignal(currentUser.id, recipient.id, 'answer', answer);
      } else {
        // WE ARE CALLING
        addLog("Sending Offer...");
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        const signalData = { type: offer.type, sdp: offer.sdp, callType: currentType };
        signaling.sendSignal(currentUser.id, recipient.id, 'offer', signalData);
      }

      return stream;

    } catch (err: any) {
      console.error("Call Setup Failed:", err);
      addLog("SetupFail: " + err.message);
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

      {/* Hidden Audio Element for Remote Stream */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* DEBUG LOGS RESTORED FOR DIAGNOSIS */}
      <div className="absolute top-10 left-0 right-0 z-50 pointer-events-none p-4">
        <div className="bg-black/50 text-[#00ff00] font-mono text-[10px] p-2 rounded backdrop-blur max-w-sm mx-auto">
          {logs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      </div>

      {/* Remote Video (Full Screen) */}
      {currentType === 'video' && (
        <video
          ref={remoteVideoRef}
          autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Connection Status / Avatar */}
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
              <p className={`text-[10px] font-black uppercase tracking-[0.4em] ${callState === 'connecting' ? 'text-zinc-600 animate-pulse' : 'text-blue-500'}`}>
                {callState === 'connecting' ? 'Encrypting Connection' : 'Neural Link Established'}
              </p>
            )}
            {callState === 'connected' && <span className="text-white font-mono text-sm opacity-60 tabular-nums">{formatTime(duration)}</span>}
          </div>
        </div>
      )}

      {/* Local Video (PIP) */}
      {currentType === 'video' && callState !== 'ringing' && (
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
            {/* Video Toggle */}
            <button
              onClick={toggleVideoMode}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${currentType === 'video' ? 'bg-white text-black' : 'bg-white/5 text-zinc-500 hover:text-white'}`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>

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
