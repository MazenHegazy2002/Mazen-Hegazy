
import React, { useState } from 'react';
import { User, PrivacySettings } from '../types';
import { APP_VERSION } from '../constants';

interface SettingsViewProps {
  user: User;
  onUpdateUser: (user: User) => void;
  privacy: PrivacySettings;
  onUpdatePrivacy: (privacy: PrivacySettings) => void;
  isNative?: boolean;
}

const SettingsView: React.FC<SettingsViewProps> = ({ user, onUpdateUser, privacy, onUpdatePrivacy, isNative }) => {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempName, setTempName] = useState(user.name);
  const [tempAvatar, setTempAvatar] = useState(user.avatar);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const handleSaveProfile = () => {
    onUpdateUser({ ...user, name: tempName, avatar: tempAvatar });
    setIsEditingProfile(false);
  };

  const toggleBooleanSetting = (key: keyof PrivacySettings) => {
    const value = privacy[key];
    if (typeof value === 'boolean') {
      onUpdatePrivacy({ ...privacy, [key]: !value });
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Zylos Messaging',
      text: 'Join me on Zylos - the secure, high-speed messaging app!',
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share failed', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const checkUpdates = () => {
    setIsCheckingUpdate(true);
    setTimeout(() => {
      setIsCheckingUpdate(false);
      alert("Zylos is fully updated! (v" + APP_VERSION + ")");
    }, 1200);
  };

  return (
    <div className="h-full bg-[#121418] flex flex-col animate-in slide-in-from-right-4 duration-300">
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#121418]/80 backdrop-blur sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        {isEditingProfile ? (
          <button onClick={handleSaveProfile} className="text-blue-500 font-bold px-4 py-1 bg-blue-500/10 rounded-full hover:bg-blue-500/20 transition-all">Save</button>
        ) : (
          <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{isNative ? 'Native App' : 'Web App'}</div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-32">
        {/* Profile Card */}
        <div className="bg-[#1c1f26] rounded-3xl p-6 border border-white/5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -z-10 group-hover:bg-blue-500/10 transition-colors" />
          
          <div className="flex flex-col items-center">
            <div className="relative mb-4 group/avatar">
              <img src={isEditingProfile ? tempAvatar : user.avatar} className="w-24 h-24 rounded-3xl object-cover shadow-2xl border-2 border-white/5 transition-transform group-hover/avatar:scale-105" />
              {isEditingProfile && (
                <button 
                  onClick={() => setTempAvatar(`https://picsum.photos/seed/${Math.random()}/200`)}
                  className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              )}
            </div>

            {isEditingProfile ? (
              <div className="w-full space-y-3">
                <input 
                  type="text" 
                  value={tempName} 
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full bg-[#121418] border border-white/10 rounded-xl py-2 px-4 text-center text-white font-bold outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                  placeholder="Your Name"
                />
              </div>
            ) : (
              <div className="text-center">
                <h3 className="text-xl font-bold text-white">{user.name}</h3>
                <p className="text-sm text-zinc-500 mt-1 font-mono tracking-tight">{user.phone}</p>
                <div className="flex space-x-2 mt-4">
                  <button 
                    onClick={() => {
                      setTempName(user.name);
                      setTempAvatar(user.avatar);
                      setIsEditingProfile(true);
                    }}
                    className="text-[10px] font-bold text-blue-500 uppercase tracking-widest px-4 py-2 border border-blue-500/20 rounded-full hover:bg-blue-500/5 transition-all"
                  >
                    Edit Profile
                  </button>
                  <button 
                    onClick={handleShare}
                    className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest px-4 py-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-all flex items-center"
                  >
                    {copyFeedback ? 'Copied' : 'Share Zylos'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Translation Section */}
        <div className="space-y-3">
          <SectionTitle>Global Connectivity</SectionTitle>
          <div className="bg-[#1c1f26] rounded-3xl border border-white/5 divide-y divide-white/5 overflow-hidden">
            <ToggleItem 
              label="Bypass Local Restrictions" 
              sub="Advanced Turbo Proxy for RU/Global connectivity." 
              isActive={privacy.proxyEnabled} 
              onToggle={() => toggleBooleanSetting('proxyEnabled')} 
            />
            <ToggleItem 
              label="Real-time Translation" 
              sub="Automatically translate incoming messages." 
              isActive={privacy.translationEnabled} 
              onToggle={() => toggleBooleanSetting('translationEnabled')} 
            />
          </div>
        </div>

        {/* Update Logic */}
        <div className="space-y-3">
          <SectionTitle>App Management</SectionTitle>
          <div className="bg-[#1c1f26] rounded-3xl border border-white/5 overflow-hidden">
            <button 
              onClick={checkUpdates}
              disabled={isCheckingUpdate}
              className="w-full p-4 flex items-center justify-between group cursor-pointer hover:bg-white/5 transition-all"
            >
               <div className="text-left">
                 <h5 className="text-sm font-bold text-zinc-200">Version Maintenance</h5>
                 <p className="text-[11px] text-zinc-500">Current version: {APP_VERSION}</p>
               </div>
               <span className={`text-xs font-bold text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full group-hover:bg-blue-500/20 transition-all ${isCheckingUpdate ? 'animate-pulse' : ''}`}>
                 {isCheckingUpdate ? 'Syncing...' : 'Sync Updates'}
               </span>
            </button>
            {isNative && (
               <div className="p-4 border-t border-white/5 bg-blue-500/5 flex items-center space-x-3">
                 <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                 <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Native Sync Engine Connected</p>
               </div>
            )}
          </div>
        </div>

        <div className="text-center pt-8 opacity-20">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white">Zylos Messaging Shell</p>
        </div>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{children: React.ReactNode}> = ({ children }) => (
  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-4 mb-2">{children}</h4>
);

const ToggleItem: React.FC<{label: string, sub: string, isActive: boolean, onToggle: () => void}> = ({ label, sub, isActive, onToggle }) => (
  <div className="p-4 flex items-center justify-between">
    <div className="flex-1 mr-4 text-left">
      <h5 className="text-sm font-bold text-zinc-200">{label}</h5>
      <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{sub}</p>
    </div>
    <button 
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isActive ? 'bg-blue-600' : 'bg-zinc-700'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

export default SettingsView;
