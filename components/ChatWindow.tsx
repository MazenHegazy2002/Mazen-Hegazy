
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Chat, Message, MessageType, Reaction, MessageStatus, PrivacySettings } from '../types';
import { STICKERS, REACTIONS } from '../constants';
import { encrypt, decrypt, generateEncryptionFingerprint } from '../services/encryptionService';

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
  const [showStickers, setShowStickers] = useState(false);
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartTimestamp = useRef<number>(0);
  
  const recipient = chat.participants[0];
  const fingerprint = useRef(generateEncryptionFingerprint('me', recipient.id));

  useEffect(() => {
    // Initial mock messages (Encrypted in storage)
    const initialMessages: Message[] = [
      { id: 'm0', senderId: 'system', content: 'Messages and calls are end-to-end encrypted. No one outside of this chat, not even Zylos, can read or listen to them.', type: MessageType.SYSTEM, timestamp: new Date(Date.now() - 3601000) },
      { id: 'm1', senderId: recipient.id, content: encrypt('Привет! Как дела?', chat.id), type: MessageType.TEXT, timestamp: new Date(Date.now() - 3600000), reactions: [{emoji: '❤️', userId: 'me'}], isEncrypted: true },
      { id: 'm2', senderId: 'me', content: encrypt("I'm good, just working on this new app design!", chat.id), type: MessageType.TEXT, timestamp: new Date(Date.now() - 3000000), status: MessageStatus.READ, isEncrypted: true },
      { id: 'm3', senderId: recipient.id, content: encrypt('Nice! Is it the WhatsApp-Telegram hybrid?', chat.id), type: MessageType.TEXT, timestamp: new Date(Date.now() - 2000000), isEncrypted: true },
    ];
    setMessages(initialMessages);
  }, [recipient.id, chat.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const updateMessageStatus = (messageId: string, status: MessageStatus) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status } : m));
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    recordingStartTimestamp.current = Date.now();
    if (window.navigator.vibrate) window.navigator.vibrate(50);
    
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (!isRecording) return;
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const finalDuration = Math.round((Date.now() - recordingStartTimestamp.current) / 1000);
    setIsRecording(false);
    
    if (finalDuration >= 1) {
      sendMessage(MessageType.VOICE, 'voice_note_placeholder', finalDuration);
    }
  };

  const handleTranslate = async (message: Message) => {
    if (translatingIds.has(message.id) || message.translation) return;

    setTranslatingIds(prev => new Set(prev).add(message.id));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const decryptedContent = decrypt(message.content, chat.id);
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate the following message to ${privacySettings.targetLanguage}. Only return the translated text, nothing else: "${decryptedContent}"`,
      });

      const translatedText = response.text;
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, translation: translatedText } : m));
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setTranslatingIds(prev => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
    }
  };

  const sendMessage = (type: MessageType = MessageType.TEXT, content?: string, duration?: number) => {
    const text = (content !== undefined ? content : inputText) as string;
    if (!text.trim() && type === MessageType.TEXT) return;

    const newMessageId = Date.now().toString();
    const encryptedText = encrypt(text, chat.id);

    const newMessage: Message = {
      id: newMessageId,
      senderId: 'me',
      content: encryptedText,
      type,
      timestamp: new Date(),
      reactions: [],
      status: MessageStatus.SENT,
      duration: duration,
      isEncrypted: true
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setShowStickers(false);

    // Read Receipt Simulation respecting Privacy Settings
    setTimeout(() => {
      updateMessageStatus(newMessageId, MessageStatus.DELIVERED);
      
      // Only transition to READ if the user has read receipts enabled
      if (privacySettings.readReceipts) {
        setTimeout(() => {
          updateMessageStatus(newMessageId, MessageStatus.READ);
        }, 2000);
      }
    }, 1200);

    // AI logic simulation
    setTimeout(() => {
      if (Math.random() > 0.4) {
        setMessages(prev => prev.map(m => m.id === newMessageId 
          ? { ...m, reactions: [...(m.reactions || []), { emoji: (REACTIONS[Math.floor(Math.random() * REACTIONS.length)] as string), userId: recipient.id }] }
          : m
        ));
      }

      const replyContent = "That looks amazing! Let's talk more about it later.";
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        senderId: recipient.id,
        content: encrypt(replyContent, chat.id),
        type: MessageType.TEXT,
        timestamp: new Date(),
        reactions: [],
        isEncrypted: true
      };
      setMessages(prev => [...prev, reply]);
    }, 4000);
  };

  const handleToggleReaction = (messageId: string, emoji: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;
      
      const reactions = msg.reactions || [];
      const myReactionIndex = reactions.findIndex(r => r.userId === 'me' && r.emoji === emoji);
      
      let newReactions: Reaction[];
      if (myReactionIndex > -1) {
        newReactions = reactions.filter((_, idx) => idx !== myReactionIndex);
      } else {
        newReactions = [...reactions, { emoji, userId: 'me' }];
      }
      
      return { ...msg, reactions: newReactions };
    }));
    setActiveReactionPicker(null);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const MessageStatusIcon = ({ status }: { status?: MessageStatus }) => {
    if (!status) return null;
    
    // Read status color is always blue if READ, otherwise zinc
    const isRead = status === MessageStatus.READ;
    const colorClass = isRead ? 'text-blue-400' : 'text-zinc-500';
    
    return (
      <div className={`flex items-center ml-1 ${colorClass}`}>
        {status === MessageStatus.SENT ? (
          // Single checkmark for Sent
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          // Double checkmarks for Delivered or Read
          <div className="relative flex items-center">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <svg className="w-3.5 h-3.5 -ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0f12] relative overflow-hidden" onClick={() => setActiveReactionPicker(null)}>
      {/* Header */}
      <div className="h-16 border-b border-white/5 bg-[#121418]/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 z-10">
        <div className="flex items-center">
          {onBack && (
            <button onClick={onBack} className="mr-3 md:hidden p-2 text-zinc-400 active:scale-90 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <div className="relative">
            <img src={recipient.avatar} alt={recipient.name} className="w-9 h-9 md:w-10 md:h-10 rounded-xl object-cover shadow-lg" />
            <div className="absolute -top-1 -right-1 bg-green-500 rounded-full border border-[#121418] p-0.5" title="End-to-End Encrypted">
              <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-bold text-white truncate max-w-[120px] md:max-w-none flex items-center">
              {recipient.name}
            </h3>
            <p className="text-[10px] md:text-[11px] text-green-500 font-medium">Verified Encrypted Session</p>
          </div>
        </div>
        <div className="flex items-center space-x-1 md:space-x-3">
          <button onClick={() => onCall('voice')} className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors active:scale-95">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          </button>
          <button onClick={() => onCall('video')} className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors active:scale-95">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
          <button className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 active:scale-95" title={`Fingerprint: ${fingerprint.current}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 custom-scrollbar bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop')] bg-repeat bg-fixed opacity-95">
        {messages.map((msg) => {
          if (msg.type === MessageType.SYSTEM) {
             return (
               <div key={msg.id} className="flex justify-center my-4 px-8">
                 <div className="bg-blue-600/10 backdrop-blur-md border border-blue-500/20 rounded-2xl p-3 px-4 max-w-sm text-center">
                    <p className="text-[11px] text-blue-400 font-bold flex items-center justify-center mb-1 uppercase tracking-widest">
                       <svg className="w-3 h-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                       Secure Channel
                    </p>
                    <p className="text-[10px] text-zinc-400 leading-normal">{msg.content}</p>
                 </div>
               </div>
             );
          }

          const isMe = msg.senderId === 'me';
          const isSelected = activeReactionPicker === msg.id;
          const isTranslating = translatingIds.has(msg.id);
          
          const displayContent = msg.isEncrypted ? decrypt(msg.content, chat.id) : msg.content;

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative`}>
              {/* Reaction Picker Popover */}
              {isSelected && (
                <div 
                  className={`absolute -top-16 z-30 bg-[#1c1f26]/90 backdrop-blur-xl border border-white/10 p-1.5 rounded-full flex items-center space-x-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 ${isMe ? 'right-0' : 'left-0'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {REACTIONS.map((emoji, index) => (
                    <button 
                      key={emoji as string}
                      onClick={() => handleToggleReaction(msg.id, (emoji as string))}
                      className="w-10 h-10 flex items-center justify-center hover:scale-125 transition-all text-2xl rounded-full hover:bg-white/10 active:bg-white/20"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {emoji}
                    </button>
                  ))}
                  <div className="w-[1px] h-6 bg-white/10 mx-1" />
                  <button className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white rounded-full hover:bg-white/10">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>
              )}

              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveReactionPicker(isSelected ? null : msg.id);
                  if (!isSelected && window.navigator.vibrate) window.navigator.vibrate(40);
                }}
                className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-3 px-4 shadow-sm relative cursor-pointer transition-all duration-300 ${
                  isSelected ? 'ring-2 ring-blue-500 ring-opacity-100 scale-[1.03] z-20 shadow-xl' : 'hover:brightness-110 active:scale-[0.98]'
                } ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#1c1f26] text-zinc-100 rounded-tl-none'}`}
              >
                {msg.type === MessageType.TEXT && (
                  <div className="space-y-1">
                    <p className="text-sm leading-relaxed">{displayContent}</p>
                    
                    {/* Translation UI */}
                    {privacySettings.translationEnabled && !isMe && (
                      <div className="mt-2 pt-2 border-t border-white/5">
                        {msg.translation ? (
                          <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                             <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-0.5">Translation ({privacySettings.targetLanguage})</p>
                             <p className="text-xs text-zinc-300 italic">"{msg.translation}"</p>
                          </div>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleTranslate(msg); }}
                            className="flex items-center space-x-1.5 text-[10px] font-bold text-blue-400/80 hover:text-blue-400 uppercase tracking-widest transition-colors"
                            disabled={isTranslating}
                          >
                            <svg className={`w-3 h-3 ${isTranslating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 0h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                            <span>{isTranslating ? 'Translating...' : 'Translate'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {msg.type === MessageType.STICKER && <span className="text-6xl block transform active:scale-125 transition-transform">{msg.content}</span>}
                {msg.type === MessageType.VOICE && (
                  <div className="flex items-center space-x-3 w-40 md:w-48">
                    <button className="p-2 bg-white/10 rounded-full active:bg-white/20 transition-colors"><svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
                    <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                       <div className="h-full bg-white w-1/3" />
                    </div>
                    <span className="text-[10px] opacity-70 font-mono">{formatDuration(msg.duration || 0)}</span>
                  </div>
                )}
                
                {/* Timestamp & Status Icon */}
                <div className="flex items-center justify-end mt-1.5 space-x-1 select-none">
                  <span className={`text-[9px] block opacity-60 font-medium ${isMe ? 'text-white' : 'text-zinc-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && <MessageStatusIcon status={msg.status} />}
                </div>

                {/* Reactions Display */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className={`absolute -bottom-4 flex flex-wrap gap-1 ${isMe ? 'right-2' : 'left-2'} z-20 animate-in fade-in zoom-in-90`}>
                    {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => {
                      const count = msg.reactions?.filter(r => r.emoji === emoji).length;
                      const hasMine = msg.reactions?.some(r => r.emoji === emoji && r.userId === 'me');
                      return (
                        <button
                          key={emoji as string}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleReaction(msg.id, (emoji as string));
                          }}
                          className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] border shadow-xl transition-all active:scale-90 ${
                            hasMine 
                              ? 'bg-blue-500/80 border-blue-400 text-white scale-110 backdrop-blur-md' 
                              : 'bg-zinc-800/80 border-white/10 text-zinc-300 hover:bg-zinc-700 backdrop-blur-md'
                          }`}
                        >
                          <span className="leading-none">{emoji}</span>
                          {count && count > 1 && <span className="font-bold">{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticker Tray */}
      {showStickers && (
        <div className="absolute bottom-20 left-4 right-4 bg-[#16191e]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-2 duration-300 z-20">
          <div className="grid grid-cols-4 md:grid-cols-6 gap-4 max-h-52 overflow-y-auto no-scrollbar">
            {STICKERS.map(s => (
              <button key={s as string} onClick={() => sendMessage(MessageType.STICKER, (s as string))} className="text-4xl hover:scale-125 active:scale-95 transition-all p-2 flex items-center justify-center">{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 px-4 md:px-6 bg-[#121418] border-t border-white/5 pb-safe">
        <div className="flex items-center space-x-2 md:space-x-3 max-w-5xl mx-auto">
          {isRecording ? (
            <div className="flex-1 flex items-center justify-between px-4 bg-red-500/10 border border-red-500/20 rounded-2xl py-2.5 animate-in slide-in-from-left-4 duration-300">
              <div className="flex items-center space-x-3">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-500 font-bold font-mono text-sm">{formatDuration(recordingDuration)}</span>
              </div>
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">Recording Voice Note...</span>
              <button onClick={() => setIsRecording(false)} className="text-red-500 text-xs font-bold uppercase tracking-widest px-2">Cancel</button>
            </div>
          ) : (
            <>
              <button 
                onClick={() => setShowStickers(!showStickers)}
                className={`p-2 transition-all active:scale-90 ${showStickers ? 'text-blue-500' : 'text-zinc-500 hover:text-white'}`}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
              
              <button className="p-2 text-zinc-500 hover:text-white transition-all active:scale-90 hidden md:block">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </button>

              <div className="flex-1 relative">
                <input 
                  type="text"
                  placeholder="Message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                  className="w-full bg-[#1c1f26] border-none rounded-2xl py-2.5 md:py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500/30 text-zinc-200 placeholder-zinc-600 outline-none"
                />
              </div>
            </>
          )}

          {inputText.trim() && !isRecording ? (
            <button onClick={() => sendMessage()} className="w-11 h-11 bg-blue-600 rounded-2xl flex items-center justify-center text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/30 active:scale-90">
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            </button>
          ) : (
            <button 
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white scale-125 shadow-xl shadow-red-900/40 z-20' : 'bg-zinc-800 text-zinc-400 hover:text-white active:scale-90'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
