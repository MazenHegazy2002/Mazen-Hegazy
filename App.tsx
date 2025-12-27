
import React, { useState, useEffect } from 'react';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import StatusSection from './components/StatusSection';
import CallOverlay from './components/CallOverlay';
import ContactList from './components/ContactList';
import SettingsView from './components/SettingsView';
import CallLogView from './components/CallLogView';
import SecureFolderView from './components/SecureFolderView';
import SignIn from './components/SignIn';
import { Chat, User, MessageType, AppView, CallLog, PrivacySettings } from './types';
import { MOCK_CHATS, MOCK_USERS } from './constants';
import { DB } from './services/database';
import { isCloudConfigured } from './services/supabase';

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('chats');
  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudConnected, setCloudConnected] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'me',
    name: '',
    phone: '',
    avatar: '',
    status: 'online'
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
        const savedUser = await DB.getUser();
        const savedChats = await DB.getChats();
        const savedContacts = await DB.getContacts();

        if (savedUser) {
          setCurrentUser(savedUser);
          setIsLoggedIn(true);
        }

        setChats(savedChats.length > 0 ? savedChats : MOCK_CHATS);
        setUsers(savedContacts.length > 0 ? savedContacts : MOCK_USERS);
        
        // Determine Cloud Connectivity
        setCloudConnected(isCloudConfigured());

        await new Promise(r => setTimeout(r, 800));
        setIsBooting(false);
      } catch (err) {
        console.error("BOOT FAILURE:", err);
        setIsBooting(false);
      }
    };
    bootApp();
  }, []);

  // Debounced Cloud Synchronization
  useEffect(() => {
    if (isLoggedIn && !isBooting) {
      const sync = async () => {
        setIsSyncing(true);
        await DB.saveUser(currentUser);
        await DB.saveChats(chats);
        await DB.saveContacts(users);
        setTimeout(() => setIsSyncing(false), 800);
      };
      const timer = setTimeout(sync, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentUser, chats, users, isLoggedIn, isBooting]);

  const handleStartChat = (user: User) => {
    const existingChat = chats.find(c => !c.isGroup && c.participants.some(p => p.id === user.id));
    if (existingChat) {
      setSelectedChatId(existingChat.id);
    } else {
      const newChat: Chat = {
        id: `c-${Date.now()}`,
        participants: [user],
        unreadCount: 0,
        folder: 'Personal',
        lastMessage: {
          id: `m-${Date.now()}`,
          senderId: user.id,
          content: 'End-to-end encrypted channel opened.',
          type: MessageType.TEXT,
          timestamp: new Date()
        }
      };
      setChats([newChat, ...chats]);
      setSelectedChatId(newChat.id);
    }
    setShowContacts(false);
    setCurrentView('chats');
  };

  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-[#0b0d10] flex flex-col items-center justify-center p-8 z-[10000]">
        <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/20 animate-pulse mb-6">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em] animate-pulse">Initializing Data Layers</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <SignIn onSignIn={async (profile) => {
      const newUser: User = {
        id: `u-${Date.now()}`,
        name: profile.name,
        phone: profile.phone,
        avatar: profile.avatar,
        status: 'online'
      };
      setCurrentUser(newUser);
      setIsLoggedIn(true);
      await DB.saveUser(newUser); 
    }} />;
  }

  const selectedChat = chats.find(c => c.id === selectedChatId);

  return (
    <div className="flex h-screen w-screen bg-[#0b0d10] overflow-hidden safe-area-inset font-['Inter'] text-zinc-200">
      {/* Real-time Online Sync Badge */}
      <div className={`fixed top-4 right-4 z-[100] bg-zinc-900/90 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full flex items-center space-x-3 transition-all duration-500 ${isSyncing ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0'}`}>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Cloud Sync Active</span>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`flex flex-col border-r border-white/5 h-full relative w-full md:w-[380px] transition-transform duration-300 ${selectedChatId ? '-translate-x-full md:translate-x-0 hidden md:flex' : 'translate-x-0'}`}>
           <StatusSection users={users} />
           
           <div className="flex-1 overflow-hidden relative">
            {currentView === 'chats' && (
              <ChatList 
                chats={chats} 
                onSelectChat={(chat) => setSelectedChatId(chat.id)} 
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
            />
          ) : (
            <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-[#0d0f12] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
              <div className="w-20 h-20 bg-zinc-800/20 backdrop-blur rounded-[2rem] flex items-center justify-center mb-8 border border-white/5 shadow-2xl">
                <svg className="w-10 h-10 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Your Secure Portal</h2>
              <p className="text-zinc-500 max-w-sm text-sm leading-relaxed">
                Connect your Zylos account to the online cloud for cross-device message persistence and instant global delivery.
              </p>
              {!cloudConnected && (
                <div className="mt-8 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center space-x-3 max-w-xs animate-pulse">
                  <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                  <p className="text-[10px] text-orange-500 font-black uppercase text-left leading-tight">Syncing to Local-Only Engine. Configure Cloud Keys for Global Sync.</p>
                </div>
              )}
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
                  <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest mt-1">Discovering on Cloud</p>
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
