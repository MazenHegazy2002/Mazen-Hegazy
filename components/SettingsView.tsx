
import React, { useState, useEffect } from 'react';
import { User, PrivacySettings } from '../types';
import { APP_VERSION } from '../constants';
import { cloudSync } from '../services/supabase';

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
  const [dbStatus, setDbStatus] = useState<{ ok: boolean, message: string }>({ ok: false, message: 'Syncing...' });

  useEffect(() => {
    const check = async () => {
      const status = await cloudSync.checkHealth();
      setDbStatus(status);
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveProfile = () => {
    onUpdateUser({ ...user, name: tempName, avatar: tempAvatar });
    setIsEditingProfile(false);
    cloudSync.upsertProfile({ ...user, name: tempName, avatar: tempAvatar });
  };

  return (
    <div className="h-full bg-[#121418] flex flex-col animate-in slide-in-from-right-4 duration-300">
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#121418]/80 backdrop-blur sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <div className="flex items-center space-x-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
          <div className={`w-1.5 h-1.5 rounded-full ${dbStatus.ok ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-orange-500 animate-pulse'}`} />
          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-tighter">{dbStatus.message}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar pb-32">
        <div className="bg-gradient-to-br from-[#1c1f26] to-[#121418] rounded-[2.5rem] p-8 border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="flex flex-col items-center">
            <div className="relative mb-6 group/img">
              <img src={isEditingProfile ? tempAvatar : user.avatar} className="w-28 h-28 rounded-[2rem] object-cover shadow-2xl border-2 border-white/10 transition-transform group-hover/img:scale-105" />
              {isEditingProfile && (
                <button
                  onClick={() => setTempAvatar(`https://picsum.photos/seed/${Math.random()}/200`)}
                  className="absolute -bottom-2 -right-2 bg-blue-600 p-2.5 rounded-xl text-white shadow-xl hover:bg-blue-500 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              )}
            </div>
            {isEditingProfile ? (
              <div className="w-full space-y-4">
                <input
                  type="text"
                  value={tempName}
                  onChange={e => setTempName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-white text-center outline-none focus:ring-2 ring-blue-500/30"
                />
                <div className="flex space-x-3">
                  <button onClick={handleSaveProfile} className="flex-1 bg-blue-600 text-white text-[11px] font-black uppercase py-3 rounded-xl shadow-lg shadow-blue-900/40">Sync Profile</button>
                  <button onClick={() => setIsEditingProfile(false)} className="flex-1 bg-white/5 text-zinc-400 text-[11px] font-black uppercase py-3 rounded-xl">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white tracking-tight">{user.name}</h3>
                <p className="text-sm text-zinc-500 mt-1 font-mono tracking-wider">{user.phone}</p>
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="mt-6 text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] px-6 py-2.5 border border-blue-500/20 rounded-full hover:bg-blue-500/10 transition-all"
                >
                  Edit Neural Identity
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <SectionTitle>Global Connectivity</SectionTitle>
          <div className="bg-[#1c1f26] rounded-[2rem] border border-white/5 divide-y divide-white/5 overflow-hidden shadow-xl">
            <ToggleItem
              label="Global Cloud Sync"
              sub="Securely mirror messages across all your global sessions"
              isActive={true}
              onToggle={() => { }}
            />
            <ToggleItem
              label="Neural Edge Proxy"
              sub="Automatically optimize routes for your current region"
              isActive={privacy.proxyEnabled}
              onToggle={() => onUpdatePrivacy({ ...privacy, proxyEnabled: !privacy.proxyEnabled })}
            />
            <ToggleItem
              label="Universal E2EE"
              sub="End-to-End Encryption active for all cross-border calls"
              isActive={true}
              onToggle={() => { }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <SectionTitle>AI Interaction Engine</SectionTitle>
          <div className="bg-[#1c1f26] rounded-[2rem] border border-white/5 overflow-hidden shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h5 className="text-sm font-bold text-zinc-200">Gemini Neural Processing</h5>
              <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded uppercase">Active Global</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed mb-4">
              Your voice notes and calls use Gemini AI for crystal-clear noise cancellation and real-time translation between languages.
            </p>
            <button className="w-full bg-zinc-800 text-zinc-400 font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest cursor-default">
              Neural Link Status: Optimal
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <SectionTitle>Diagnostics</SectionTitle>
          <div className="bg-[#1c1f26] rounded-[2rem] border border-white/5 overflow-hidden shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h5 className="text-sm font-bold text-zinc-200">Connection Debugger</h5>
              <span className="text-[9px] font-black text-orange-500 bg-orange-500/10 px-2 py-1 rounded uppercase">Dev Tools</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed mb-4">
              If your profile or contacts are not updating, use this tool to force a cloud synchronization and view any errors.
            </p>
            <button
              onClick={async () => {
                try {
                  alert(`Starting Manual Sync...\nUUID: ${user.id}`);
                  await cloudSync.upsertProfile(user);
                  alert("✅ SUCCESS: Profile Synced!\nDatabase connection is working.");
                  setDbStatus({ ok: true, message: 'Synced Manually' });
                } catch (e: any) {
                  alert(`❌ ERROR: Failed to Sync\n${e.message || JSON.stringify(e)}`);
                }
              }}
              className="w-full bg-orange-600/10 text-orange-500 border border-orange-500/20 font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-all"
            >
              Force Sync Profile
            </button>
          </div>
        </div>

        <div className="text-center py-8">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">Zylos Global Messenger • v{APP_VERSION}</p>
          </div>
          <p className="text-[8px] text-zinc-800 font-bold uppercase">Decentralized Neural Network Active</p>
        </div>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-[11px] font-black text-zinc-600 uppercase tracking-[0.3em] ml-4 mb-2">{children}</h4>
);

const ToggleItem: React.FC<{ label: string, sub: string, isActive: boolean, onToggle: () => void }> = ({ label, sub, isActive, onToggle }) => (
  <div className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
    <div className="flex-1 mr-4 text-left">
      <h5 className="text-sm font-bold text-zinc-200">{label}</h5>
      <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">{sub}</p>
    </div>
    <div
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${isActive ? 'bg-blue-600' : 'bg-zinc-700'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  </div>
);

export default SettingsView;
