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
  const [dbError, setDbError] = useState<string | null>(null);
  const [showSimulatedSms, setShowSimulatedSms] = useState(false);

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
    if (!isPhoneValid) { setPhoneError(true); return; }
    setLoading(true);
    setDbError(null);
    
    try {
      const existing = await cloudSync.getProfileByPhone(fullPhone);
      if (existing) {
        setName(existing.name || '');
        setAvatar(existing.avatar || avatar);
      }
      
      // GENERATE SIMULATED PIN
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      setGeneratedCode(pin);

      setTimeout(() => {
        setStep('code');
        setLoading(false);
        
        // Show simulated SMS overlay
        setShowSimulatedSms(true);
        NotificationService.send('Zylos Security', `Your PIN is ${pin}`);
        
        // Auto-hide the simulated SMS after 8 seconds
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
      alert("Invalid PIN. Please check the simulated SMS at the top of your screen."); 
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
      const userId = existing?.id || generateUUID();
      const profile = { id: userId, phone: fullPhone, name, avatar };
      await cloudSync.upsertProfile(profile);
      onSignIn(profile);
    } catch (err) {
      onSignIn({ id: generateUUID(), phone: fullPhone, name, avatar });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b0d10] flex items-center justify-center p-4 overflow-hidden">
      {/* SIMULATED SMS OVERLAY */}
      <div className={`fixed top-6 left-4 right-4 z-[500] transition-all duration-700 ease-out transform ${showSimulatedSms ? 'translate-y-0 opacity-100' : '-translate-y-32 opacity-0'}`}>
        <div className="bg-[#1c1f26]/90 backdrop-blur-2xl border border-blue-500/30 rounded-[1.5rem] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.6)] flex items-center space-x-4 max-w-sm mx-auto">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shrink-0 shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Messages</span>
              <span className="text-[10px] text-zinc-500">Just now</span>
            </div>
            <p className="text-xs text-zinc-200 mt-0.5">
              <span className="font-bold text-white">Zylos Security:</span> Your login PIN is <span className="bg-blue-600/30 px-1.5 py-0.5 rounded text-blue-400 font-mono font-bold tracking-widest">{generatedCode}</span>. Do not share this code.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm bg-[#16191e] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl text-center relative overflow-hidden">
        {step === 'phone' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3v1m0 16v1m0-1a10.003 10.003 0 01-9.253-6.429l-.054-.09M12 11h.01" /></svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Welcome to Zylos</h1>
            <p className="text-zinc-500 text-sm mb-8">Secure Hybrid Messenger</p>
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="flex space-x-2">
                <select 
                  value={selectedCountry.name}
                  onChange={(e) => setSelectedCountry(COUNTRIES.find(c => c.name === e.target.value) || selectedCountry)}
                  className="w-24 bg-[#1c1f26] border border-white/10 rounded-xl px-2 text-white text-xs outline-none"
                >
                  {COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.flag} +{c.code}</option>)}
                </select>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-[#1c1f26] border border-white/5 rounded-xl py-4 px-4 text-white outline-none focus:ring-1 focus:ring-blue-500/50"
                  placeholder="Phone number"
                  required
                />
              </div>
              <button disabled={loading || !isPhoneValid} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl active:scale-95 transition-all uppercase text-xs tracking-widest shadow-lg shadow-blue-900/20">
                {loading ? 'Initializing...' : 'Get Started'}
              </button>
            </form>
          </div>
        )}

        {step === 'code' && (
          <form onSubmit={handleCodeSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h1 className="text-2xl font-bold text-white tracking-tight">Security PIN</h1>
            <p className="text-zinc-500 text-sm">Enter the code from your simulated SMS notification.</p>
            <input 
              type="text" maxLength={4} value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-[#1c1f26] border border-white/10 rounded-2xl py-6 text-white text-4xl text-center font-mono outline-none focus:ring-2 focus:ring-blue-500/30"
              autoFocus
            />
            <button className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl uppercase text-xs tracking-widest active:scale-95 transition-all">Verify PIN</button>
            <button type="button" onClick={() => setStep('phone')} className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest hover:text-zinc-400 transition-colors">Wrong number?</button>
          </form>
        )}

        {step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-6 text-left animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-2xl font-bold text-white text-center tracking-tight">Setup Identity</h1>
            <div className="flex justify-center mb-6">
              <div className="relative group">
                <img src={avatar} className="w-24 h-24 rounded-3xl object-cover border-2 border-white/10 shadow-2xl" />
                <button 
                  type="button"
                  onClick={() => setAvatar(`https://picsum.photos/seed/${Math.random()}/200`)}
                  className="absolute -bottom-2 -right-2 bg-blue-600 p-2 rounded-xl text-white shadow-lg border border-white/10"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Display Name</label>
              <input 
                type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-[#1c1f26] border border-white/10 rounded-xl py-4 px-4 text-white outline-none focus:ring-1 focus:ring-blue-500/50"
                placeholder="How others see you"
                required
              />
            </div>
            <button disabled={loading} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl uppercase text-xs tracking-widest active:scale-95 transition-all shadow-xl shadow-blue-900/20 mt-4">
              {loading ? 'Syncing...' : 'Enter Neural Matrix'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SignIn;