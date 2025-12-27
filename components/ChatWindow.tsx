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
  onUpdateLastMessage: (chatId: string, lastMessage: Message) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ 
  chat, onCall, onBack, privacySettings, currentUser, onPlayVoice, playback, onUpdateLastMessage
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [translatedMsgId, setTranslatedMsgId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const recipient = chat.participants[0] || { id: 'unknown', name: 'Unknown', avatar: '', status: 'offline' };
  const currentAuthId = currentUser.authId || currentUser.id;

  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      setLoading(true);
      const history = await cloudSync.fetchMessages(chat.id);
      if (!isMounted) return;

      const mapped: Message[] = history.map(m => ({
        id: String(m.id),
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
        id: String(payload.id),
        senderId: payload.sender_id,
        content: payload.content,
        type: payload.type as MessageType,
        timestamp: new Date(payload.timestamp),
        status: MessageStatus.DELIVERED,
        isEncrypted: payload.type === MessageType.TEXT
      };
      
      setMessages(prev => {
        if (prev.some(m => m.id === newMessage.id)) return prev;
        const next = [...prev, newMessage];
        onUpdateLastMessage(chat.id, newMessage);
        return next;
      });
    });

    return () => { 
      isMounted = false;
      if (unsubscribe) unsubscribe(); 
    };
  }, [chat.id, currentAuthId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
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
    const tempId = `temp-${Date.now()}`;

    const newMessage: Message = {
      id: tempId,
      senderId: currentAuthId,
      content: encryptedContent,
      type,
      timestamp: new Date(),
      status: MessageStatus.SENT,
      duration,
      isEncrypted: type === MessageType.TEXT
    };

    setMessages(prev => [...prev, newMessage]);
    onUpdateLastMessage(chat.id, newMessage);
    if (type === MessageType.TEXT) setInputText('');

    try {
      await cloudSync.pushMessage(chat.id, currentAuthId, { content: encryptedContent, type }, recipient.id); 
    } catch (e) {
      console.error("Link unstable.");
    }
  };

  const handleTranslate = async (msg: Message) => {
    if (msg.type !== MessageType.TEXT || translatedMsgId === msg.id) return;
    setTranslatedMsgId(msg.id);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const decoded = decrypt(msg.content, chat.id);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate this message to English. If it is already English, translate it to Spanish. Return ONLY the translated text.\n\nMessage: ${decoded}`,
      });
      
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, translation: response.text } : m));
    } catch (err) {
      console.error("Neural Translation failed.");
    } finally {
      setTranslatedMsgId(null);
    }
  };

  const handleSummarize = async () => {
    if (messages.length < 5 || isSummarizing) return;
    setIsSummarizing(true);
    setSummary(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const recentText = messages
        .filter(m => m.type === MessageType.TEXT)
        .slice(-25)
        .map(m => {
          const sender = m.senderId === currentAuthId ? 'Me' : recipient.name;
          return `${sender}: ${decrypt(m.content, chat.id)}`;
        })
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Summarize this secure encrypted chat conversation into 3 bullet points. \n\nChat Content:\n${recentText}`,
      });
      setSummary(response.text || "Summary unavailable.");
    } catch (err) {
      setSummary("Neural link lag.");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0d10] relative overflow-hidden">
      <header className="h-20 border-b border-white/5 bg-[#121418]/95 backdrop-blur-2xl flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center min-w-0">
          {onBack && <button onClick={onBack} className="md:hidden mr-4 p-2.5 bg-white/5 rounded-2xl text-zinc-500 hover:text-white transition-all"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>}
          <img src={recipient.avatar} alt="" className="w-12 h-12 rounded-[1.25rem] object-cover shrink-0 shadow-2xl border border-white/5" />
          <div className="ml-4 truncate">
            <h3 className="text-base font-bold text-white truncate leading-tight">{recipient.name}</h3>
            <div className="flex items-center space-x-1.5 mt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${recipient.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`} />
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">{recipient.status === 'online' ? 'Synced' : 'Offline'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button onClick={handleSummarize} title="AI Summary" className={`p-3 rounded-2xl transition-all ${isSummarizing ? 'bg-blue-600/20 text-blue-500 animate-pulse' : 'bg-white/5 text-zinc-500 hover:text-blue-500'}`}>
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </button>
          <button onClick={() => onCall('voice')} className="p-3 bg-white/5 rounded-2xl text-zinc-500 hover:text-white transition-all"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></button>
          <button onClick={() => onCall('video')} className="p-3 bg-white/5 rounded-2xl text-zinc-500 hover:text-white transition-all"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
        </div>
      </header>

      {summary && (
        <div className="absolute top-24 left-6 right-6 z-[30] bg-[#1c1f26]/95 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-5 shadow-[0_40px_80px_rgba(0,0,0,0.8)] animate-in slide-in-from-top-8 duration-500">
           <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] flex items-center"><svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z"/></svg>Neural Brief</span>
              <button onClick={() => setSummary(null)} className="text-zinc-500 p-1.5 hover:text-white bg-white/5 rounded-xl transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
           </div>
           <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-medium">{summary}</div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30">
             <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-6" />
             <p className="text-[11px] font-black uppercase tracking-[0.4em]">Deciphering Link</p>
          </div>
        ) : messages.map((msg) => {
          const isMe = msg.senderId === currentAuthId;
          const isPlaying = playback.messageId === msg.id && playback.isPlaying;
          
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div 
                onContextMenu={(e) => { e.preventDefault(); handleTranslate(msg); }}
                className={`max-w-[85%] rounded-[1.75rem] p-4 shadow-2xl relative group ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#1c1f26] text-zinc-200 rounded-tl-none border border-white/5'}`}
              >
                {msg.type === MessageType.TEXT && (
                  <div className="space-y-2">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed font-medium">
                      {msg.isEncrypted ? decrypt(msg.content, chat.id) : msg.content}
                    </p>
                    {msg.translation && (
                      <div className="pt-2 mt-2 border-t border-white/10 text-[11px] italic opacity-80 flex items-start">
                        <svg className="w-3 h-3 mr-1.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                        {msg.translation}
                      </div>
                    )}
                  </div>
                )}
                {msg.type === MessageType.VOICE && (
                  <div className="flex items-center space-x-4 w-56 py-1">
                    <button onClick={() => onPlayVoice(msg, isMe ? 'You' : recipient.name, isMe ? (currentUser.avatar || '') : recipient.avatar)} className={`w-12 h-12 rounded-[1rem] flex items-center justify-center transition-all shadow-xl active:scale-90 ${isMe ? 'bg-white/10' : 'bg-blue-600 text-white'}`}>
                      {isPlaying ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      ) : (
                        <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      )}
                    </button>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                       <div className={`h-full bg-blue-400 transition-all duration-300 ${isPlaying ? 'animate-pulse' : ''}`} style={{ width: isPlaying ? '100%' : '0%' }} />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-end mt-2 space-x-1.5 opacity-40">
                   <span className="text-[10px] font-bold tabular-nums">{msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                   {isMe && <svg className="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="p-4 bg-[#121418] border-t border-white/5 pb-safe shrink-0">
        <div className="flex items-center space-x-3 max-w-4xl mx-auto bg-[#1c1f26] rounded-[2rem] px-3 py-2 shadow-2xl border border-white/5 transition-all focus-within:ring-2 ring-blue-500/20">
          <button className="p-3 text-zinc-600 hover:text-blue-500 transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
          <input 
            type="text" 
            placeholder="Neural Signal..." 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            className="flex-1 bg-transparent border-none py-3 px-1 text-sm text-white focus:ring-0 outline-none placeholder-zinc-700 font-medium"
          />
          {inputText.trim() ? (
            <button onClick={() => sendMessage()} className="w-12 h-12 bg-blue-600 rounded-[1.25rem] flex items-center justify-center text-white shadow-2xl active:scale-95 transition-all"><svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg></button>
          ) : (
            <button 
              onMouseDown={startRecording} onTouchStart={startRecording}
              onMouseUp={stopRecording} onTouchEnd={stopRecording}
              className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white scale-110 shadow-2xl shadow-red-900/40 animate-pulse' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default ChatWindow;