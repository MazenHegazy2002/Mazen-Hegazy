import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Chat, Message, MessageType, MessageStatus, PrivacySettings, User, PlaybackState } from '../types';
import { encrypt, decrypt } from '../services/encryptionService';
import { cloudSync } from '../services/supabase';

interface ChatWindowProps {
  chat: Chat;
  onCall: (type: 'voice' | 'video') => void;
  onBack?: () => void;
  privacySettings: PrivacySettings;
  currentUser: User & { authId?: string };
  onPlayVoice: (message: Message, senderName: string, senderAvatar: string) => void;
  playback: PlaybackState;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ 
  chat, onCall, onBack, privacySettings, currentUser, onPlayVoice, playback 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const recipient = chat.participants[0] || { id: 'unknown', name: 'Unknown', avatar: '', status: 'offline' };
  const currentAuthId = currentUser.authId || currentUser.id;

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      const history = await cloudSync.fetchMessages(chat.id);
      const mapped: Message[] = history.map(m => ({
        id: m.id.toString(),
        senderId: m.sender_id,
        content: m.content,
        type: m.type as MessageType,
        timestamp: new Date(m.timestamp),
        isEncrypted: m.type === MessageType.TEXT
      }));
      setMessages(mapped);
      setLoading(false);
    };

    loadHistory();

    const unsubscribe = cloudSync.subscribeToChat(chat.id, currentAuthId, (payload) => {
      const newMessage: Message = {
        id: payload.id.toString(),
        senderId: payload.sender_id,
        content: payload.content,
        type: payload.type as MessageType,
        timestamp: new Date(payload.timestamp),
        status: MessageStatus.DELIVERED,
        isEncrypted: payload.type === MessageType.TEXT
      };
      
      setMessages(prev => {
        if (prev.find(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [chat.id, currentAuthId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          sendMessage(MessageType.VOICE, reader.result as string, recordingDuration);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } catch (err) { alert("Microphone access denied."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  };

  const sendMessage = async (type: MessageType = MessageType.TEXT, content?: string, duration?: number) => {
    const text = content || inputText;
    if (!text.trim() && type === MessageType.TEXT) return;

    const encryptedContent = type === MessageType.TEXT ? encrypt(text, chat.id) : text;

    const newMessage: Message = {
      id: `temp-${Date.now()}`,
      senderId: currentAuthId,
      content: encryptedContent,
      type,
      timestamp: new Date(),
      status: MessageStatus.SENT,
      duration,
      isEncrypted: type === MessageType.TEXT
    };

    setMessages(prev => [...prev, newMessage]);
    if (type === MessageType.TEXT) setInputText('');

    await cloudSync.pushMessage(chat.id, currentAuthId, { content: encryptedContent, type }, recipient.id); 
  };

  const handleSummarize = async () => {
    if (messages.length < 5 || isSummarizing) return;
    setIsSummarizing(true);
    setSummary(null);

    try {
      const apiKey = (window as any).process?.env?.API_KEY || "";
      const ai = new GoogleGenAI({ apiKey });
      const recentText = messages
        .filter(m => m.type === MessageType.TEXT)
        .slice(-20)
        .map(m => `${m.senderId === currentAuthId ? 'Me' : recipient.name}: ${decrypt(m.content, chat.id)}`)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Provide a bulleted summary of this conversation. \n\nConversation:\n${recentText}`,
      });
      setSummary(response.text || "Summary unavailable.");
    } catch (err) {
      setSummary("Neural link lag. Try again later.");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0d10] relative overflow-hidden">
      <header className="h-16 border-b border-white/5 bg-[#121418]/90 backdrop-blur-xl flex items-center justify-between px-4 z-20">
        <div className="flex items-center">
          {onBack && <button onClick={onBack} className="md:hidden mr-3 p-2 text-zinc-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg></button>}
          <img src={recipient.avatar} alt="" className="w-10 h-10 rounded-2xl object-cover" />
          <div className="ml-3">
            <h3 className="text-sm font-bold text-white">{recipient.name}</h3>
            <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Neural Link Established</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button onClick={handleSummarize} className={`p-2.5 transition-colors ${isSummarizing ? 'text-blue-500 animate-pulse' : 'text-zinc-500'}`}>
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </button>
          <button onClick={() => onCall('voice')} className="p-2.5 text-zinc-500"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></button>
          <button onClick={() => onCall('video')} className="p-2.5 text-zinc-500"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
        </div>
      </header>

      {summary && (
        <div className="absolute top-20 left-4 right-4 z-[30] bg-[#1c1f26] border border-white/10 rounded-2xl p-4 shadow-2xl">
           <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">AI Summary</span>
              <button onClick={() => setSummary(null)} className="text-zinc-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
           </div>
           <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{summary}</div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full opacity-40">
             <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
             <p className="text-[10px] font-black uppercase">Syncing</p>
          </div>
        ) : messages.map((msg) => {
          const isMe = msg.senderId === currentAuthId;
          const isPlaying = playback.messageId === msg.id && playback.isPlaying;
          
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-[1.5rem] p-3 ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#1c1f26] text-zinc-200 rounded-tl-none border border-white/5'}`}>
                {msg.type === MessageType.TEXT && <p className="text-sm whitespace-pre-wrap">{decrypt(msg.content, chat.id)}</p>}
                {msg.type === MessageType.VOICE && (
                  <div className="flex items-center space-x-3 w-48">
                    <button onClick={() => onPlayVoice(msg, isMe ? 'You' : recipient.name, isMe ? (currentUser.avatar || '') : recipient.avatar)} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                      {isPlaying ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      ) : (
                        <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      )}
                    </button>
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                       <div className={`h-full bg-white/40 ${isPlaying ? 'animate-pulse' : ''}`} style={{ width: isPlaying ? '100%' : '0%' }} />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-end mt-1 space-x-1 opacity-50">
                   <span className="text-[8px]">{msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="p-3 bg-[#121418] border-t border-white/5 pb-safe">
        <div className="flex items-center space-x-2 max-w-4xl mx-auto bg-[#1c1f26] rounded-[1.75rem] px-2 py-1.5">
          <button className="p-2 text-zinc-500 hover:text-blue-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
          <input 
            type="text" 
            placeholder="Secure message..." 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            className="flex-1 bg-transparent border-none py-2 px-1 text-sm text-white focus:ring-0 outline-none placeholder-zinc-700"
          />
          {inputText ? (
            <button onClick={() => sendMessage()} className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white"><svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg></button>
          ) : (
            <button 
              onMouseDown={startRecording} onTouchStart={startRecording}
              onMouseUp={stopRecording} onTouchEnd={stopRecording}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white scale-110' : 'bg-zinc-800 text-zinc-500'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default ChatWindow;