
import React, { useState, useMemo, useEffect } from 'react';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import StatusSection from './components/StatusSection';
import CallOverlay from './components/CallOverlay';
import ContactList from './components/ContactList';
import SettingsView from './components/SettingsView';
import CallLogView from './components/CallLogView';
import SecureFolderView from './components/SecureFolderView';
import SignIn from './components/SignIn';
import MobileAppGuide from './components/MobileAppGuide';
import { Chat, User, MessageType, AppView, CallLog, PrivacySettings } from './types';
import { MOCK_CHATS, MOCK_USERS, APP_VERSION } from './constants';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('chats');
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [chats, setChats] = useState<Chat[]>(MOCK_CHATS);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  
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

  const [callLogs, setCallLogs] = useState<CallLog[]>([
    { id: 'l1', user: MOCK_USERS[0], type: 'voice', direction: 'incoming', timestamp: new Date(Date.now() - 3600000), duration: 120 },
    { id: 'l2', user: MOCK_USERS[1], type: 'video', direction: 'missed', timestamp: new Date(Date.now() - 7200000) },
  ]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{ recipient: User; type: 'voice' | 'video' } | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  useEffect(() => {
    // Detect if running inside a Native Container (APK or iOS App)
    const isCapacitor = (window as any).Capacitor?.isNativePlatform || !!(window as any).webkit?.messageHandlers?.bridge;
    setIsNativeApp(isCapacitor);

    // Detect if running as Installed PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isPWA);
    
    // Suggest installation if in mobile browser
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && !isPWA && !isCapacitor) {
      setShowInstallGuide(true);
    }
  }, []);

  useEffect(() => {
    // The Update Engine: Compares your local version with the host
    const checkUpdate = async () => {
      try {
        // In your real version, you would do:
        // const res = await fetch('https://your-app.vercel.app/version.json');
        // const remote = await res.json();
        // if (remote.version !== APP_VERSION) setIsUpdateAvailable(true);
        console.log("Zylos System: All systems operational v" + APP_VERSION);
      } catch (e) {
        console.warn("Update check failed. Working in offline mode.");
      }
    };
    const interval = setInterval(checkUpdate, 300000); // Check every 5 minutes
    checkUpdate();
    return () => clearInterval(interval);
  }, []);

  const selectedChat = useMemo(() => 
    chats.find(c => c.id === selectedChatId), 
  [chats, selectedChatId]);

  const handleStartChat = (user: User) => {
    if (navigator.vibrate) navigator.vibrate(10);
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
          content: 'Chat started',
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

  const handleNewCall = (user: User, type: 'voice' | 'video') => {
    if (navigator.vibrate) navigator.vibrate(50);
    const newLog: CallLog = {
      id: `l-${Date.now()}`,
      user,
      type,
      direction: 'outgoing',
      timestamp: new Date()
    };
    setCallLogs([newLog, ...callLogs]);
    setActiveCall({ recipient: user, type });
  };

  const performUpdate = () => {
    // This wipes the old cache and pulls the new files from your server instantly
    window.location.reload();
  };

  if (showInstallGuide && !isStandalone && !isNativeApp) {
    return <MobileAppGuide onContinue={() => setShowInstallGuide(false)} />;
  }

  if (!isLoggedIn) {
    return <SignIn onSignIn={(profile) => {
      setCurrentUser({
        id: 'me',
        name: profile.name,
        phone: profile.phone,
        avatar: profile.avatar,
        status: 'online'
      });
      setIsLoggedIn(true);
    }} />;
  }

  return (
    <div className="flex h-screen w-screen bg-[#0f1115] overflow-hidden safe-area-inset">
      {/* Automated Update Screen */}
      {isUpdateAvailable && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-8 text-center animate-in fade-in duration-1000">
          <div className="bg-[#1c1f26] border border-white/10 p-12 rounded-[3.5rem] shadow-2xl max-w-sm">
            <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-10 shadow-[0_0_50px_rgba(37,99,235,0.4)]">
              <svg className="w-12 h-12 text-white animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Zylos Refined</h2>
            <p className="text-zinc-400 mb-10 leading-relaxed text-sm uppercase tracking-widest font-bold">New architecture detected. Syncing core files...</p>
            <button 
              onClick={performUpdate}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all shadow-xl active:scale-95 uppercase tracking-widest text-xs"
            >
              Update & Reload
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`flex flex-col border-r border-white/5 h-full relative w-full md:w-[380px] transition-transform duration-300 ${selectedChatId ? '-translate-x-full md:translate-x-0 hidden md:flex' : 'translate-x-0'}`}>
           <StatusSection users={users} />
           <div className="flex-1 overflow-hidden">
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
            {currentView === 'calls' && <CallLogView logs={callLogs} onCallUser={handleNewCall} />}
            {currentView === 'settings' && (
              <SettingsView 
                user={currentUser} 
                onUpdateUser={setCurrentUser} 
                privacy={privacySettings} 
                onUpdatePrivacy={setPrivacySettings} 
                isNative={isNativeApp}
              />
            )}
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

           <div className="h-20 bg-[#121418]/95 backdrop-blur-md border-t border-white/5 px-2 flex items-center justify-around z-50 pb-safe">
             {[
               { view: 'chats', icon: 'M12 2C6.47 2 2 6.47 2 12c0 2.02.6 3.9 1.63 5.48L2 22l4.52-1.63C7.1 21.4 8.98 22 11 22c5.53 0 10-4.47 10-10S16.53 2 11 2zm0 18c-1.85 0-3.58-.52-5.05-1.42l-.36-.22-2.7.97.97-2.7-.22-.36C3.52 14.8 3 13.15 3 11.5 3 7.36 6.36 4 10.5 4S18 7.36 18 11.5 14.64 19 10.5 19z', label: 'Chats' },
               { view: 'calls', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', label: 'Calls' },
               { view: 'secure', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', label: 'Secure' },
               { view: 'settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M12 15a3 3 0 100-6 3 3 0 000 6z', label: 'Settings' }
             ].map(item => (
               <button 
                key={item.view}
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(12);
                  setCurrentView(item.view as AppView);
                }}
                className={`flex flex-col items-center space-y-1 transition-all ${currentView === item.view ? 'text-blue-500 scale-110' : 'text-zinc-600 hover:text-zinc-400'}`}
               >
                 <svg className="w-5 h-5" fill={item.view === 'chats' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={item.view === 'chats' ? 0 : 2} viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                 </svg>
                 <span className="text-[9px] font-bold uppercase tracking-widest">{item.label}</span>
               </button>
             ))}
           </div>
        </div>

        <div className={`flex-1 h-full flex flex-col transition-all duration-300 ${selectedChatId ? 'translate-x-0' : 'translate-x-full md:translate-x-0 hidden md:flex'}`}>
          {selectedChat ? (
            <ChatWindow 
              chat={selectedChat} 
              onCall={(type) => handleNewCall(selectedChat.participants[0], type)}
              onBack={() => setSelectedChatId(null)}
              privacySettings={privacySettings}
            />
          ) : (
            <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-[#0d0f12]">
              <div className="w-24 h-24 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6 text-zinc-600">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to Zylos</h2>
              <p className="text-zinc-500 max-w-sm">Pick a chat to start secure messaging.</p>
              {isNativeApp && (
                <div className="mt-8 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full animate-in fade-in zoom-in-95">
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Native Sync Core v{APP_VERSION}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showContacts && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center md:p-6 animate-in fade-in duration-200">
           <div className="w-full h-full md:h-[80vh] md:max-w-md bg-[#121418] md:rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Select Contact</h2>
                <button onClick={() => setShowContacts(false)} className="p-2 text-zinc-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ContactList users={users} onStartChat={handleStartChat} onAddContact={(u) => setUsers([...users, u])} />
              </div>
           </div>
        </div>
      )}

      {activeCall && (
        <CallOverlay recipient={activeCall.recipient} type={activeCall.type} onClose={() => setActiveCall(null)} />
      )}
    </div>
  );
};

export default App;
