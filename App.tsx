
import React, { useState, useEffect, useCallback } from 'react';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import StatusSection from './components/StatusSection';
import CallOverlay from './components/CallOverlay';
import ContactList from './components/ContactList';
import SettingsView from './components/SettingsView';
import CallLogView from './components/CallLogView';
import SecureFolderView from './components/SecureFolderView';
import GlobalAudioPlayer from './components/GlobalAudioPlayer';
import SignIn from './components/SignIn';
import NotificationToast from './components/NotificationToast';
import { Chat, User, MessageType, AppView, CallLog, PrivacySettings, PlaybackState, Message } from './types';
import { MOCK_CHATS, MOCK_USERS } from './constants';
import { DB } from './services/database';
import { supabase, cloudSync } from './services/supabase';
import { NotificationService } from './services/notificationService';
import { decrypt } from './services/encryptionService';

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('chats');
  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [queryStatus, setQueryStatus] = useState<{ id: string; label: string }[]>([]);
  
  const [currentUser, setCurrentUser] = useState<User & { authId?: string }>({
    id: 'me',
    name: '',
    phone: '',
    avatar: '',
    status: 'online'
  });

  const [playback, setPlayback] = useState<PlaybackState>({
    messageId: null,
    chatId: null,
    senderName: null,
    senderAvatar: null,
    content: null,
    isPlaying: false
  });

  const [securePasscode, setSecurePasscode] = useState<string | null>(null);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    lastSeen: 'Everyone',
    profilePhoto: 'Everyone',
    readReceipts: true,
    activeStatus: true,
    proxyEnabled: true,
    translationEnabled: true,
    targetLanguage: 'English',
    translateAll: true,
    specificSourceLanguages: ['Russian', 'Arabic', 'Spanish']
  });

  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{ recipient: User; type: 'voice' | 'video' } | null>(null);
  const [showContacts, setShowContacts] = useState(false);

  useEffect(() => {
    const bootApp = async () => {
      try {
        NotificationService.requestPermission();
        const session = await cloudSync.getSession();
        const savedUser = await DB.getUser();
        
        if (session?.user && savedUser) {
          setCurrentUser({ ...savedUser, authId: session.user.id });
          setIsLoggedIn(true);
        }

        const savedChats = await DB.getChats();
        const savedContacts = await DB.getContacts();

        setChats(savedChats.length > 0 ? savedChats : MOCK_CHATS);
        setUsers(savedContacts.length > 0 ? savedContacts : MOCK_USERS);
        
        const health = await cloudSync.checkHealth();
        setCloudConnected(health.ok);
        setIsBooting(false);
      } catch (err) {
        setIsBooting(false);
      }
    };
    bootApp();
  }, []);

  useEffect(() => {
    const currentAuthId = String(currentUser.authId || currentUser.id);
    if (!isLoggedIn || !currentAuthId || currentAuthId === 'me') return;

    const channel = supabase.channel('global-traffic')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, (payload) => {
        setQueryStatus(prev => [{ id: Math.random().toString(), label: 'Syncing Incoming Message' }, ...prev].slice(0, 3));
        
        if (String(payload.new.sender_id) !== currentAuthId) {
          const sender = users.find(u => String(u.id) === String(payload.new.sender_id)) || { name: 'Stranger', avatar: '' };
          
          let content = "New message";
          if (payload.new.type === MessageType.TEXT) {
            content = decrypt(payload.new.content, payload.new.chat_id);
          }

          NotificationService.send(sender.name, content, sender.avatar);

          setChats(prev => prev.map(c => {
            if (c.id === payload.new.chat_id) {
              return {
                ...c,
                unreadCount: c.id === selectedChatId ? 0 : c.unreadCount + 1,
                lastMessage: {
                  id: payload.new.id.toString(),
                  senderId: payload.new.sender_id,
                  content: payload.new.content,
                  type: payload.new.type as MessageType,
                  timestamp: new Date(payload.new.timestamp)
                }
              };
            }
            return c;
          }));
        }
        setTimeout(() => setQueryStatus(prev => prev.slice(0, -1)), 3000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isLoggedIn, users, selectedChatId, currentUser.authId, currentUser.id]);

  const handlePlayVoice = (msg: Message, senderName: string, senderAvatar: string) => {
    if (playback.messageId === msg.id) {
      setPlayback(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    } else {
      setPlayback({
        messageId: msg.id,
        chatId: selectedChatId,
        senderName,
        senderAvatar,
        content: msg.content,
        isPlaying: true
      });
    }
  };

  const handleStartChat = useCallback((user: User) => {
    const existingChat = chats.find(c => !c.isGroup && c.participants.some(p => String(p.id) === String(user.id)));
    if (existingChat) {
      setSelectedChatId(existingChat.id);
    } else {
      const newChat: Chat = {
        id: `c-${Date.now()}`,
        participants: [user],
        unreadCount: 0,
        isGroup: false,
        isArchived: false,
        isMuted: false
      };
      setChats(prev => [newChat, ...prev]);
      setSelectedChatId(newChat.id);
    }
    setShowContacts(false);
    setCurrentView('chats');
  }, [chats]);

  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-[#0b0d10] flex flex-col items-center justify-center p-8 z-[10000]">
        <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/20 animate-pulse mb-6">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em] animate-pulse">Neural Handshake</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <SignIn onSignIn={async (profile) => {
      const newUser = {
        id: profile.id,
        authId: profile.id,
        name: profile.name,
        phone: profile.phone,
        avatar: profile.avatar,
        status: 'online' as const
      };
      setCurrentUser(newUser);
      setIsLoggedIn(true);
      await DB.saveUser(newUser); 
    }} />;
  }

  const selectedChat = chats.find(c => c.id === selectedChatId);

  return (
    <div className="flex h-screen w-screen bg-[#0b0d10] overflow-hidden safe-area-inset font-['Inter'] text-zinc-200">
      <NotificationToast />
      <GlobalAudioPlayer 
        playback={playback} 
        onToggle={() => setPlayback(p => ({ ...p, isPlaying: !p.isPlaying }))} 
        onClose={() => setPlayback({ ...playback, content: null, isPlaying: false, messageId: null })}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        <div className={`flex flex-col border-r border-white/5 h-full relative w-full md:w-[380px] transition-transform duration-300 ${selectedChatId ? '-translate-x-full md:translate-x-0 hidden md:flex' : 'translate-x-0'}`}>
           <StatusSection users={users} currentUser={currentUser} />
           
           <div className="flex-1 overflow-hidden relative">
            {currentView === 'chats' && (
              <ChatList 
                chats={chats} 
                onSelectChat={(chat) => {
                  setSelectedChatId(chat.id);
                  setChats(prev => prev.map(c => c.id === chat.id ? {...c, unreadCount: 0} : c));
                }} 
                onAddChat={() => setShowContacts(true)} 
                selectedChatId={selectedChatId || undefined} 
                onMuteChat={(id) => setChats(prev => prev.map(c => c.id === id ? {...c, isMuted: !c.isMuted} : c))}
                onArchiveChat={(id) => setChats(prev => prev.map(c => c.id === id ? {...c, isArchived: !c.isArchived} : c))}
              />
            )}
            {currentView === 'calls' && <CallLogView logs={callLogs} onCallUser={(u, t) => setActiveCall({ recipient: u, type: t })} />}
            {currentView === 'settings' && <SettingsView user={currentUser} onUpdateUser={setCurrentUser} privacy={privacySettings} onUpdatePrivacy={setPrivacySettings} />}
            {currentView === 'secure' && (
              <SecureFolderView 
                chats={chats.filter(c => c.folder === 'Secure')} 
                onOpenChat={(id) => { setSelectedChatId(id); setCurrentView('chats'); }}
                passcode={securePasscode}
                onSetPasscode={setSecurePasscode}
                userPhone={currentUser.phone}
              />
            )}
           </div>

           {queryStatus.length > 0 && (
             <div className="absolute top-24 right-4 z-[450] flex flex-col space-y-2">
               {queryStatus.map(q => (
                 <div key={q.id} className="bg-blue-600/20 backdrop-blur-xl border border-blue-500/20 px-3 py-1.5 rounded-full flex items-center space-x-2 animate-in slide-in-from-right duration-300">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{q.label}</span>
                 </div>
               ))}
             </div>
           )}

           <div className="h-20 bg-[#121418] border-t border-white/5 px-4 flex items-center justify-around z-50 pb-safe">
             {[
               { view: 'chats', icon: 'M12 2C6.47 2 2 6.47 2 12c0 2.02.6 3.9 1.63 5.48L2 22l4.52-1.63C7.1 21.4 8.98 22 11 22c5.53 0 10-4.47 10-10S16.53 2 11 2z', label: 'Chats' },
               { view: 'calls', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', label: 'Calls' },
               { view: 'secure', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', label: 'Vault' },
               { view: 'settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', label: 'Settings' }
             ].map(item => (
               <button 
                key={item.view}
                onClick={() => setCurrentView(item.view as AppView)}
                className={`flex flex-col items-center space-y-1 transition-all ${currentView === item.view ? 'text-blue-500 scale-110' : 'text-zinc-600'}`}
               >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                 </svg>
                 <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{item.label}</span>
               </button>
             ))}
           </div>
        </div>

        <div className={`flex-1 h-full flex flex-col transition-all duration-300 ${selectedChatId ? 'translate-x-0' : 'translate-x-full md:translate-x-0 hidden md:flex'}`}>
          {selectedChat ? (
            <ChatWindow 
              chat={selectedChat} 
              onCall={(type) => setActiveCall({ recipient: selectedChat.participants[0], type })}
              onBack={() => setSelectedChatId(null)}
              privacySettings={privacySettings}
              currentUser={currentUser}
              onPlayVoice={handlePlayVoice}
              playback={playback}
            />
          ) : (
            <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-[#0d0f12]">
              <div className="w-20 h-20 bg-zinc-800/20 backdrop-blur rounded-[2rem] flex items-center justify-center mb-8 border border-white/5 shadow-2xl">
                <svg className="w-10 h-10 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Zylos</h2>
              <p className="text-zinc-500 max-w-sm text-sm leading-relaxed">
                Experience global messaging with AI-powered features. Your sessions are encrypted and synced to the Zylos Cloud.
              </p>
            </div>
          )}
        </div>
      </div>

      {showContacts && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300">
           <div className="w-full h-full md:h-[85vh] md:max-w-md bg-[#121418] md:rounded-[3rem] border border-white/10 overflow-hidden relative flex flex-col shadow-2xl">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Contacts</h2>
                </div>
                <button onClick={() => setShowContacts(false)} className="p-3 bg-white/5 rounded-2xl text-zinc-400 hover:text-white transition-all">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ContactList users={users} onStartChat={handleStartChat} onAddContact={(u) => setUsers([...users, u])} />
              </div>
           </div>
        </div>
      )}

      {activeCall && <CallOverlay recipient={activeCall.recipient} type={activeCall.type} onClose={() => setActiveCall(null)} />}
    </div>
  );
};

export default App;
