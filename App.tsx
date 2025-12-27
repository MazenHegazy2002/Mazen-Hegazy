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
import MobileAppGuide from './components/MobileAppGuide';
import { Chat, User, AppView, Message, PlaybackState } from './types';
import { MOCK_USERS } from './constants';
import { DB } from './services/database';
import { cloudSync } from './services/supabase';

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
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>({
    messageId: null, chatId: null, senderName: null, senderAvatar: null, content: null, isPlaying: false
  });

  useEffect(() => {
    const boot = async () => {
      try {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const hasSeenGuide = localStorage.getItem('zylos_guide_seen');

        if (!isStandalone && isMobile && !hasSeenGuide) {
          setShowInstallGuide(true);
        }

        const savedUser = await DB.getUser();
        if (savedUser) { 
          setCurrentUser(savedUser); 
          setIsLoggedIn(true); 
          
          // Re-sync chats from history instead of just relying on Mock Data
          const savedChats = await DB.getChats();
          setChats(savedChats);
          
          // Fetch contacts that were locally saved
          const savedContacts = await DB.getContacts();
          setUsers(savedContacts.length > 0 ? savedContacts : []);
        }
      } catch (err) {
        console.error("Boot error:", err);
      } finally {
        setTimeout(() => setIsBooting(false), 1500);
      }
    };
    boot();
  }, []);

  // Persist chats whenever they change
  useEffect(() => {
    if (isLoggedIn && chats.length > 0) {
      DB.saveChats(chats);
    }
  }, [chats, isLoggedIn]);

  const handlePlayVoice = (message: Message, senderName: string, senderAvatar: string) => {
    if (playback.messageId === message.id) {
      setPlayback(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    } else {
      setPlayback({
        messageId: message.id, chatId: selectedChatId, senderName, senderAvatar, content: message.content, isPlaying: true
      });
    }
  };

  const closeGuide = () => {
    localStorage.setItem('zylos_guide_seen', 'true');
    setShowInstallGuide(false);
  };

  if (isBooting) return (
    <div className="fixed inset-0 bg-[#0b0d10] flex flex-col items-center justify-center z-[5000]">
      <div className="relative">
        <div className="w-20 h-20 bg-blue-600 rounded-[2rem] animate-pulse-slow shadow-[0_0_50px_rgba(37,99,235,0.4)] flex items-center justify-center">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3v1m0 16v1m0-1a10.003 10.003 0 01-9.253-6.429l-.054-.09M12 11h.01" />
          </svg>
        </div>
      </div>
      <div className="mt-12 flex flex-col items-center space-y-2 text-center">
        <p className="text-[10px] font-black uppercase text-white tracking-[0.6em]">Zylos Neural Link</p>
        <p className="text-[8px] font-bold uppercase text-zinc-700 tracking-[0.2em]">Synchronizing Identity...</p>
      </div>
    </div>
  );

  if (showInstallGuide) return <MobileAppGuide onContinue={closeGuide} />;

  if (!isLoggedIn) return <SignIn onSignIn={async (p) => {
    const u = { ...p, authId: p.id, status: 'online' as const };
    setCurrentUser(u); 
    setIsLoggedIn(true); 
    await DB.saveUser(u);
  }} />;

  const selectedChat = chats.find(c => c.id === selectedChatId);

  return (
    <div className="flex h-[100dvh] w-screen bg-[#0b0d10] text-zinc-200 overflow-hidden safe-area-inset">
      <NotificationToast />
      
      <div className={`flex flex-col border-r border-white/5 h-full w-full md:w-[380px] shrink-0 transition-all ${selectedChatId ? 'hidden md:flex' : 'flex'}`}>
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
              onMuteChat={(id) => setChats(prev => prev.map(c => c.id === id ? {...c, isMuted: !c.isMuted} : c))}
              onArchiveChat={(id) => setChats(prev => prev.map(c => c.id === id ? {...c, isArchived: !c.isArchived} : c))}
            />
          )}
          {currentView === 'settings' && (
            <SettingsView user={currentUser} onUpdateUser={setCurrentUser} privacy={{} as any} onUpdatePrivacy={() => {}} />
          )}
        </div>

        <div className="h-20 bg-[#121418] border-t border-white/5 flex items-center justify-around shrink-0 pb-safe">
          <button onClick={() => { setCurrentView('chats'); setSelectedChatId(null); }} className={`flex flex-col items-center gap-1 ${currentView === 'chats' ? 'text-blue-500' : 'text-zinc-600'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <span className="text-[9px] font-black uppercase tracking-widest">Chats</span>
          </button>
          <button onClick={() => { setCurrentView('settings'); setSelectedChatId(null); }} className={`flex flex-col items-center gap-1 ${currentView === 'settings' ? 'text-blue-500' : 'text-zinc-600'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
            <span className="text-[9px] font-black uppercase tracking-widest">Settings</span>
          </button>
        </div>
      </div>

      <div className={`flex-1 h-full flex flex-col relative ${selectedChatId ? 'flex' : 'hidden md:flex'}`}>
        {selectedChat ? (
          <ChatWindow 
            chat={selectedChat} onBack={() => setSelectedChatId(null)}
            onCall={(type) => setActiveCall({ recipient: selectedChat.participants[0], type })}
            currentUser={currentUser} privacySettings={{} as any} onPlayVoice={handlePlayVoice} playback={playback}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#0b0d10]">
             <div className="w-20 h-20 bg-zinc-800/20 rounded-3xl mb-8 flex items-center justify-center border border-white/5 animate-in zoom-in duration-500">
                <svg className="w-8 h-8 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
             </div>
             <h2 className="text-lg font-bold text-white">Neural Frequency</h2>
             <p className="text-zinc-600 text-xs mt-2 max-w-xs">Start a secure conversation from your registry to begin encrypted syncing.</p>
          </div>
        )}
      </div>

      <GlobalAudioPlayer playback={playback} onToggle={() => setPlayback(prev => ({ ...prev, isPlaying: !prev.isPlaying }))} onClose={() => setPlayback({ messageId: null, chatId: null, senderName: null, senderAvatar: null, content: null, isPlaying: false })} />

      {showContacts && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4">
           <div className="w-full max-w-md h-[80vh] bg-[#121418] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-lg font-bold text-white">Neural Registry</h2>
                <button onClick={() => setShowContacts(false)} className="p-2 text-zinc-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <ContactList 
                users={users} 
                onStartChat={(u) => { 
                  const existing = chats.find(c => c.participants[0]?.id === u.id);
                  if (existing) {
                    setSelectedChatId(existing.id);
                  } else {
                    const newChat: Chat = { id: `c-${Date.now()}`, participants: [u], unreadCount: 0 };
                    setChats(prev => [newChat, ...prev]); 
                    setSelectedChatId(newChat.id);
                  }
                  setShowContacts(false);
                }} 
                onAddContact={(u) => {
                  setUsers(prev => {
                    const updated = [...prev, u];
                    DB.saveContacts(updated);
                    return updated;
                  });
                }} 
              />
           </div>
        </div>
      )}

      {activeCall && <CallOverlay recipient={activeCall.recipient} type={activeCall.type} onClose={() => setActiveCall(null)} />}
    </div>
  );
};

export default App;