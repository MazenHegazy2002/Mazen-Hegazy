import React, { useState, useEffect } from 'react';
import { COUNTRIES, Country } from '../constants';
import { validatePhone, formatPhoneDisplay, getRegionStatus } from '../services/validation';
import { cloudSync } from '../services/supabase';
import { NotificationService } from '../services/notificationService';

interface SignInProps {
  onSignIn: (profile: { phone: string; name: string; avatar: string; id: string }) => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignIn }) => {
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES.find(c => c.name === 'United States') || COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState(false);
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(`https://picsum.photos/seed/${Math.random()}/200`);
  const [step, setStep] = useState<'phone' | 'code' | 'profile'>('phone');
  const [loading, setLoading] = useState(false);

  const fullPhone = formatPhoneDisplay(`+${selectedCountry.code}${phone}`);
  const isPhoneValid = validatePhone(fullPhone);

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid) { setPhoneError(true); setTimeout(() => setPhoneError(false), 2000); return; }
    
    setLoading(true);
    const existing = await cloudSync.getProfileByPhone(fullPhone);
    if (existing) { 
      setName(existing.name); 
      setAvatar(existing.avatar); 
    }

    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedCode(newCode);

    setTimeout(() => {
      setStep('code');
      setLoading(false);
      NotificationService.send('Zylos Security', `Your security code is ${newCode}`);
    }, 800);
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code !== generatedCode) { alert("Invalid Security PIN"); return; }
    setStep('profile');
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    
    const sessionUuid = generateUUID();
    const profile = { id: sessionUuid, phone: fullPhone, name, avatar };
    
    try {
      // Vital: Ensure the database profile exists before finishing sign in
      const synced = await cloudSync.upsertProfile(profile, sessionUuid);
      if (!synced) {
        throw new Error("Handshake failed. Ensure the 'profiles' table exists.");
      }
      onSignIn(profile);
    } catch (err) {
      console.error(err);
      alert("Internal Error: Could not synchronize with the neural cloud. Please ensure you have executed the SUPABASE_SETUP.sql script in your dashboard.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b0d10] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-blue-600/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full" />
      </div>

      <div className="w-full max-w-sm bg-[#16191e] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl text-center relative z-10">
        {step === 'phone' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-xl shadow-blue-900/30">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3v1m0 16v1m0-1a10.003 10.003 0 01-9.253-6.429l-.054-.09M12 11h.01" /></svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to Zylos</h1>
            <p className="text-zinc-500 text-sm mb-8">Secure Neural Identity</p>

            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="flex space-x-2">
                <select 
                  value={selectedCountry.name}
                  onChange={(e) => setSelectedCountry(COUNTRIES.find(c => c.name === e.target.value) || selectedCountry)}
                  className="w-24 bg-[#1c1f26] border border-white/10 rounded-xl px-2 text-white text-xs outline-none focus:border-blue-500/50"
                >
                  {COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.flag} +{c.code}</option>)}
                </select>
                <input 
                  type="tel"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className={`flex-1 bg-[#1c1f26] border rounded-xl py-3.5 px-4 text-white outline-none text-lg transition-all ${phoneError ? 'border-red-500 animate-shake' : 'border-white/5 focus:ring-2 focus:ring-blue-500/30'}`}
                  required
                />
              </div>
              <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest text-left ml-2">
                {getRegionStatus(fullPhone)}
              </p>
              <button disabled={loading || !isPhoneValid} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-500 transition-all active:scale-95 uppercase text-xs tracking-[0.2em] shadow-lg shadow-blue-900/20">
                {loading ? 'Initializing...' : 'Verify Identity'}
              </button>
            </form>
          </div>
        )}

        {step === 'code' && (
          <div className="animate-in zoom-in-95 duration-500">
            <h1 className="text-2xl font-bold text-white mb-2">Security PIN</h1>
            <p className="text-zinc-500 text-sm mb-10">Sent via Zylos Cloud to {fullPhone}</p>
            <form onSubmit={handleCodeSubmit} className="space-y-6">
              <input 
                type="text" 
                maxLength={4} 
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#1c1f26] border border-white/10 rounded-2xl py-6 text-white text-4xl text-center font-mono outline-none focus:ring-4 focus:ring-blue-500/10"
                autoFocus
              />
              <button disabled={code.length < 4} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl uppercase text-xs tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all">
                Validate PIN
              </button>
            </form>
          </div>
        )}

        {step === 'profile' && (
          <div className="animate-in zoom-in-95 duration-500">
            <h1 className="text-2xl font-bold text-white mb-8">Setup Profile</h1>
            <div className="relative mb-10 inline-block">
              <img src={avatar} className="w-28 h-28 rounded-[2rem] object-cover border-4 border-white/10 shadow-2xl" />
              <button type="button" onClick={() => setAvatar(`https://picsum.photos/seed/${Math.random()}/200`)} className="absolute -bottom-2 -right-2 bg-blue-600 p-3 rounded-xl text-white shadow-xl hover:bg-blue-500 transition-colors border-4 border-[#16191e]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
            <form onSubmit={handleProfileSubmit} className="space-y-6 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-2">Display Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Satoshi Nakamoto" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-[#1c1f26] border border-white/10 rounded-xl py-4 px-5 text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                  required
                />
              </div>
              <button disabled={loading} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-900/30 active:scale-95 transition-all">
                {loading ? 'Establishing Link...' : 'Enter Matrix'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignIn;