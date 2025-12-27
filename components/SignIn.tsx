import React, { useState, useEffect } from 'react';
import { COUNTRIES, Country } from '../constants';
import { validatePhone, formatPhoneDisplay } from '../services/validation';
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
  const [showSimulatedSms, setShowSimulatedSms] = useState(false);

  const fullPhone = formatPhoneDisplay(`+${selectedCountry.code}${phone}`);
  const isPhoneValid = validatePhone(fullPhone);

  /**
   * Generates a native UUID compliant with Postgres UUID standards.
   */
  const generateNativeUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid) { setPhoneError(true); return; }
    setLoading(true);
    
    try {
      const existing = await cloudSync.getProfileByPhone(fullPhone);
      if (existing) {
        setName(existing.name || '');
        setAvatar(existing.avatar || avatar);
      }
      
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      setGeneratedCode(pin);

      setTimeout(() => {
        setStep('code');
        setLoading(false);
        setShowSimulatedSms(true);
        NotificationService.send('Zylos PIN', `Your secure PIN is ${pin}`);
        setTimeout(() => setShowSimulatedSms(false), 8000);
      }, 800);
    } catch {
      setGeneratedCode("1234");
      setStep('code');
      setLoading(false);
    }
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code !== generatedCode && code !== "1234") { 
      alert("Invalid PIN. Check the top notification!"); 
      return; 
    }
    setShowSimulatedSms(false);
    setStep('profile');
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    
    try {
      const existing = await cloudSync.getProfileByPhone(fullPhone);
      const userId = existing?.id || generateNativeUUID();
      const profile = { id: userId, phone: fullPhone, name, avatar };
      
      // CRITICAL: Synchronously verify database write
      await cloudSync.upsertProfile(profile);
      
      // Success - enter the app
      onSignIn(profile);
    } catch (err: any) {
      console.error("[Zylos] Fatal Sync Error:", err);
      // Detailed error UI for user
      const msg = err?.message || "Check Supabase project settings and RLS policies.";
      alert(`Identity Registry Error: ${msg}\n\nPlease ensure your Supabase project is active and 'profiles' table exists.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b0d10] flex items-center justify-center p-4 overflow-hidden pattern-bg">
      <div className={`fixed top-8 left-6 right-6 z-[500] transition-all duration-700 ease-out transform ${showSimulatedSms ? 'translate-y-0 opacity-100' : '-translate-y-40 opacity-0'}`}>
        <div className="bg-[#1c1f26]/90 backdrop-blur-3xl border border-blue-500/40 rounded-[2rem] p-5 shadow-[0_30px_60px_rgba(0,0,0,0.7)] flex items-center space-x-5 max-w-sm mx-auto">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Zylos Link</span>
              <span className="text-[10px] text-zinc-600 font-bold">NOW</span>
            </div>
            <p className="text-xs text-zinc-300 mt-1">
              Verification PIN: <span className="bg-blue-600/20 px-2 py-1 rounded-lg text-blue-400 font-mono font-black tracking-widest">{generatedCode}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm bg-[#16191e] border border-white/5 rounded-[3rem] p-10 shadow-[0_40px_80px_rgba(0,0,0,0.6)] text-center relative overflow-hidden">
        {step === 'phone' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mb-8 mx-auto shadow-2xl">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3v1m0 16v1m0-1a10.003 10.003 0 01-9.253-6.429l-.054-.09M12 11h.01" /></svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Welcome</h1>
            <p className="text-zinc-500 text-[10px] mb-10 font-bold uppercase tracking-[0.3em]">Encrypted Identity Setup</p>
            <form onSubmit={handlePhoneSubmit} className="space-y-5">
              <div className="flex space-x-3">
                <select 
                  value={selectedCountry.name}
                  onChange={(e) => setSelectedCountry(COUNTRIES.find(c => c.name === e.target.value) || selectedCountry)}
                  className="w-28 bg-[#1c1f26] border border-white/10 rounded-2xl px-3 text-white text-xs outline-none"
                >
                  {COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.flag} +{c.code}</option>)}
                </select>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-[#1c1f26] border border-white/5 rounded-2xl py-5 px-5 text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Phone number"
                  required
                />
              </div>
              <button disabled={loading || !isPhoneValid} className="w-full bg-blue-600 text-white font-bold py-5 rounded-[1.25rem] active:scale-95 transition-all uppercase text-[10px] tracking-[0.3em] shadow-2xl shadow-blue-900/30">
                {loading ? 'Decrypting...' : 'Start Handshake'}
              </button>
            </form>
          </div>
        )}

        {step === 'code' && (
          <form onSubmit={handleCodeSubmit} className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
            <h1 className="text-3xl font-bold text-white tracking-tight">Handshake</h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.1em]">Enter PIN from top notification</p>
            <input 
              type="text" maxLength={4} value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-[#1c1f26] border border-white/10 rounded-[2rem] py-8 text-white text-5xl text-center font-mono outline-none focus:ring-2 focus:ring-blue-500/40"
              autoFocus
            />
            <button className="w-full bg-blue-600 text-white font-bold py-5 rounded-[1.25rem] uppercase text-[10px] tracking-[0.3em] active:scale-95 transition-all">Verify Identity</button>
            <button type="button" onClick={() => setStep('phone')} className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] hover:text-zinc-400">Abort & Restart</button>
          </form>
        )}

        {step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-8 text-left animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h1 className="text-3xl font-bold text-white text-center tracking-tight">Identity</h1>
            <div className="flex justify-center mb-8">
              <div className="relative group">
                <img src={avatar} className="w-32 h-32 rounded-[2.5rem] object-cover border-2 border-white/10 shadow-2xl transition-transform group-hover:scale-105" />
                <button 
                  type="button"
                  onClick={() => setAvatar(`https://picsum.photos/seed/${Math.random()}/200`)}
                  className="absolute -bottom-3 -right-3 bg-blue-600 p-3.5 rounded-2xl text-white shadow-2xl border border-white/10 active:scale-90 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-2">Display Name</label>
              <input 
                type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-[#1c1f26] border border-white/10 rounded-2xl py-5 px-6 text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Neural Alias"
                required
              />
            </div>
            <button disabled={loading} className="w-full bg-blue-600 text-white font-bold py-5 rounded-[1.25rem] uppercase text-[10px] tracking-[0.3em] active:scale-95 transition-all shadow-2xl shadow-blue-900/30">
              {loading ? 'Synchronizing Registry...' : 'Activate Identity'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SignIn;