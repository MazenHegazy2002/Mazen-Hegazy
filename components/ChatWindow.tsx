
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Chat, Message, MessageType, MessageStatus, PrivacySettings } from '../types';
import { REACTIONS } from '../constants';
import { encrypt, decrypt } from '../services/encryptionService';

interface ChatWindowProps {
  chat: Chat;
  onCall: (type: 'voice' | 'video') => void;
  onBack?: () => void;
  privacySettings: PrivacySettings;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chat, onCall, onBack, privacySettings }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  
  const recipient = chat.participants[0];

  useEffect(() => {
    const initialMessages: Message[] = [
      { id: 'm0', senderId: 'system', content: 'Messages are protected by end-to-end encryption.', type: MessageType.SYSTEM, timestamp: new Date(Date.now() - 3600000) },
      { id: 'm1', senderId: recipient.id, content: encrypt('Welcome to Zylos! You can translate any message I send.', chat.id), type: MessageType.TEXT, timestamp: new Date(Date.now() - 3500000), reactions: [{emoji: '✨', userId: 'me'}], isEncrypted: true },
    ];
    setMessages(initialMessages);
  }, [recipient.id, chat.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        sendMessage(MessageType.VOICE, URL.createObjectURL(audioBlob), recordingDuration);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = window.setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } catch (err) { alert("Microphone needed for voice notes."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
  };

  const sendMessage = (type: MessageType = MessageType.TEXT, content?: string, duration?: number) => {
    const text = content || inputText;
    if (!text.trim() && type === MessageType.TEXT) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: 'me',
      content: type === MessageType.TEXT ? encrypt(text, chat.id) : text,
      type,
      timestamp: new Date(),
      status: MessageStatus.SENT,
      duration,
      isEncrypted: type === MessageType.TEXT
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setTimeout(() => setMessages(curr => curr.map(m => m.id === newMessage.id ? {...m, status: MessageStatus.READ} : m)), 2000);
  };

  const handleTranslate = async (message: Message) => {
    if (translatingIds.has(message.id)) return;
    setTranslatingIds(prev => new Set(prev).add(message.id));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const decrypted = decrypt(message.content, chat.id);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate the following text to ${privacySettings.targetLanguage}: "${decrypted}". Only return the translation.`,
      });
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, translation: response.text } : m));
    } catch (err) {
      console.error("Translation API failed", err);
    } finally {
      setTranslatingIds(prev => {
        const n = new Set(prev); n.delete(message.id); return n;
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0d10] relative overflow-hidden">
      <audio ref={audioPlaybackRef} className="hidden" />
      <header className="h-16 border-b border-white/5 bg-[#121418]/90 backdrop-blur-xl flex items-center justify-between px-4 z-20">
        <div className="flex items-center">
          {onBack && <button onClick={onBack} className="md:hidden mr-3 p-2 text-zinc-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg></button>}
          <img src={recipient.avatar} alt={recipient.name} className="w-10 h-10 rounded-2xl object-cover" />
          <div className="ml-3">
            <h3 className="text-sm font-bold text-white">{recipient.name}</h3>
            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Online</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button onClick={() => onCall('voice')} className="p-2.5 text-zinc-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></button>
          <button onClick={() => onCall('video')} className="p-2.5 text-zinc-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        {messages.map((msg) => {
          const isMe = msg.senderId === 'me';
          if (msg.type === MessageType.SYSTEM) return <div key={msg.id} className="text-center py-2"><span className="text-[10px] text-zinc-600 bg-white/5 px-3 py-1 rounded-full uppercase tracking-widest">{msg.content}</span></div>;
          
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-[1.5rem] p-3 shadow-xl relative ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#1c1f26] text-zinc-200 rounded-tl-none border border-white/5'}`}>
                {msg.type === MessageType.TEXT && <p className="text-sm leading-relaxed">{decrypt(msg.content, chat.id)}</p>}
                {msg.type === MessageType.VOICE && (
                  <div className="flex items-center space-x-3 w-52 py-1">
                    <button onClick={() => audioPlaybackRef.current && (audioPlaybackRef.current.src = msg.content, audioPlaybackRef.current.play())} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
                    <div className="flex-1 h-1 bg-white/10 rounded-full"><div className="w-1/3 h-full bg-white/40" /></div>
                    <span className="text-[9px] font-mono opacity-50">{msg.duration}s</span>
                  </div>
                )}
                {msg.translation && <div className="mt-2 pt-2 border-t border-white/5"><p className="text-[11px] text-blue-300 font-medium italic">"{msg.translation}"</p></div>}
                <div className="flex items-center justify-end mt-1 space-x-1 opacity-50">
                   <span className="text-[8px]">{msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                   {isMe && <svg className={`w-3 h-3 ${msg.status === MessageStatus.READ ? 'text-blue-300' : 'text-zinc-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>}
                </div>
                {!isMe && !msg.translation && (
                  <button 
                    onClick={() => handleTranslate(msg)}
                    className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mt-2 block hover:text-blue-400 transition-colors"
                  >
                    {translatingIds.has(msg.id) ? 'Translating...' : 'Translate'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <footer className="p-3 bg-[#121418] border-t border-white/5 pb-safe">
        <div className="flex items-center space-x-2 max-w-4xl mx-auto bg-[#1c1f26] rounded-[1.75rem] px-2 py-1.5 shadow-2xl">
          <button className="p-2.5 text-zinc-500 hover:text-blue-500 transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
          <input 
            type="text" 
            placeholder="Secure message..." 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            className="flex-1 bg-transparent border-none py-2 px-1 text-sm text-white focus:ring-0 outline-none placeholder-zinc-600"
          />
          {inputText ? (
            <button onClick={() => sendMessage()} className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-900/40 active:scale-95 transition-all"><svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg></button>
          ) : (
            <button 
              onMouseDown={startRecording} onTouchStart={startRecording}
              onMouseUp={stopRecording} onTouchEnd={stopRecording}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white scale-125' : 'bg-zinc-800 text-zinc-500 active:bg-blue-600'}`}
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
