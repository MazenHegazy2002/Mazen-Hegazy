import React, { useState, useEffect } from 'react';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import StatusSection from './components/StatusSection';
import CallOverlay from './components/CallOverlay';
import ContactList from './components/ContactList';
import SettingsView from './components/SettingsView';
import SignIn from './components/SignIn';
import NotificationToast from './components/NotificationToast';
import GlobalAudioPlayer from './components/GlobalAudioPlayer';
import { Chat, User, AppView, Message, PlaybackState } from './types';
import { MOCK_CHATS, MOCK_USERS } from './constants';
import { DB } from './services/database';

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('chats');
  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentUser, setCurrentUser] = useState<User & { authId?: string }>({
    id: '00000000-0000-0000-0000-000000000000', name: '', phone: '', avatar: '', status: 'online'
  });
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{ recipient: User; type: 'voice' | 'video' } | null>(null);
  const [showContacts, setShowContacts] = useState(false);

  // Voice Playback State
  const [playback, setPlayback] = useState<PlaybackState>({
    messageId: null,
    chatId: null,
    senderName: null,
    senderAvatar: null,
    content: null,
    isPlaying: false
  });

  useEffect(() => {
    const boot = async () => {
      const savedUser = await DB.getUser();
      if (savedUser) { 
        setCurrentUser(savedUser); 
        setIsLoggedIn(true); 
      }
      const savedChats = await DB.getChats();
      setChats(savedChats.length > 0 ? savedChats : MOCK_CHATS);
      setUsers(MOCK_USERS);
      setIsBooting(false);
    };
    boot();
  }, []);

  const handlePlayVoice = (message: Message, senderName: string, senderAvatar: string) => {
    if (playback.messageId === message.id) {
      setPlayback(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    } else {
      setPlayback({
        messageId: message.id,
        chatId: selectedChatId,
        senderName,
        senderAvatar,
        content: message.content,
        isPlaying: true
      });
    }
  };

  if (isBooting) return (
    <div className="fixed inset-0 bg-[#0b0d10] flex flex-col items-center justify-center">
      <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] animate-pulse shadow-2xl shadow-blue-500/20" />
      <p className="mt-8 text-[10px] font-black uppercase text-zinc-600 tracking-[0.5em] animate-pulse">Syncing Neural Link</p>
    </div>
  );

  if (!isLoggedIn) return <SignIn onSignIn={async (p) => {
    const u = { ...p, authId: p.id, status: 'online' as const };
    setCurrentUser(u); 
    setIsLoggedIn(true); 
    await DB.saveUser(u);
  }} />;

  const selectedChat = chats.find(c => c.id === selectedChatId);

  return (
    <div className="flex h-[100dvh] w-screen bg-[#0b0d10] text-zinc-200 overflow-hidden font-['Inter'] safe-area-inset">
      <NotificationToast />
      
      {/* Sidebar - Entirely hidden on mobile when a chat is active */}
      <div className={`flex flex-col border-r border-white/5 h-full w-full md:w-[380px] lg:w-[420px] shrink-0 transition-all duration-300 ${selectedChatId ? 'hidden md:flex' : 'flex'}`}>
        <StatusSection users={users} currentUser={currentUser} />
        
        <div className="flex-1 overflow-hidden">
          {currentView === 'chats' && (
            <ChatList 
              chats={chats} 
              onSelectChat={(c) => { 
                setSelectedChatId(c.id); 
                setChats(prev => prev.map(ch => ch.id === c.id ? {...ch, unreadCount: 0} : ch)); 
              }}
              onAddChat={() => setShowContacts(true)}
              selectedChatId={selectedChatId || undefined}
              onMuteChat={() => {}} 
              onArchiveChat={() => {}}
            />
          )}
          {currentView === 'settings' && (
            <SettingsView user={currentUser} onUpdateUser={setCurrentUser} privacy={{} as any} onUpdatePrivacy={() => {}} />
          )}
        </div>

        {/* Unified Navigation Bar */}
        <div className="h-20 bg-[#121418] border-t border-white/5 flex items-center justify-around shrink-0 pb-safe px-4">
          <button onClick={() => { setCurrentView('chats'); setSelectedChatId(null); }} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'chats' ? 'text-blue-500' : 'text-zinc-600'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Chats</span>
          </button>
          <button onClick={() => { setCurrentView('settings'); setSelectedChatId(null); }} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'settings' ? 'text-blue-500' : 'text-zinc-600'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Settings</span>
          </button>
        </div>
      </div>

      {/* Main Content Area - Full screen on mobile when chat is selected */}
      <div className={`flex-1 h-full flex flex-col relative transition-transform duration-300 ${selectedChatId ? 'translate-x-0' : 'translate-x-0 md:translate-x-0'} ${selectedChatId ? 'flex' : 'hidden md:flex'}`}>
        {selectedChat ? (
          <ChatWindow 
            chat={selectedChat} 
            onBack={() => setSelectedChatId(null)}
            onCall={(t) => setActiveCall({ recipient: selectedChat.participants[0], type: t })}
            currentUser={currentUser}
            privacySettings={{} as any}
            onPlayVoice={handlePlayVoice}
            playback={playback}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#0b0d10] relative overflow-hidden">
             <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle,rgba(59,130,246,0.1)_0%,transparent_70%)]" />
             </div>
             <div className="w-24 h-24 bg-zinc-800/20 rounded-[2rem] mb-8 flex items-center justify-center border border-white/5 relative z-10 shadow-inner">
                <svg className="w-10 h-10 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
             </div>
             <h2 className="text-xl font-bold text-white relative z-10">Select a Secure Frequency</h2>
             <p className="text-zinc-500 text-sm mt-3 max-w-xs relative z-10 leading-relaxed">Neural conversations are synced across all your devices and end-to-end encrypted.</p>
          </div>
        )}
      </div>

      {/* Voice Player Overlay */}
      <GlobalAudioPlayer 
        playback={playback} 
        onToggle={() => setPlayback(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
        onClose={() => setPlayback({ messageId: null, chatId: null, senderName: null, senderAvatar: null, content: null, isPlaying: false })}
      />

      {showContacts && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4">
           <div className="w-full max-w-md h-[85vh] bg-[#121418] rounded-[3rem] border border-white/10 overflow-hidden flex flex-col shadow-2xl">
              <div className="p-7 border-b border-white/5 flex justify-between items-center bg-black/20">
                <h2 className="text-xl font-bold text-white">Neural Registry</h2>
                <button onClick={() => setShowContacts(false)} className="p-2.5 bg-white/5 rounded-2xl text-zinc-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ContactList users={users} onStartChat={(u) => { 
                  const existing = chats.find(c => c.participants[0].id === u.id);
                  if (existing) setSelectedChatId(existing.id);
                  else {
                    const newChat: Chat = { id: `c-${Date.now()}`, participants: [u], unreadCount: 0 };
                    setChats([newChat, ...chats]); 
                    setSelectedChatId(newChat.id);
                  }
                  setShowContacts(false);
                }} onAddContact={() => {}} />
              </div>
           </div>
        </div>
      )}

      {activeCall && <CallOverlay recipient={activeCall.recipient} type={activeCall.type} onClose={() => setActiveCall(null)} />}
    </div>
  );
};

export default App;