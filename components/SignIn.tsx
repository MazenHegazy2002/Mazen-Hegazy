
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
  const [resendTimer, setResendTimer] = useState(30);

  const fullPhone = formatPhoneDisplay(`+${selectedCountry.code}${phone}`);
  const isPhoneValid = validatePhone(fullPhone);

  useEffect(() => {
    let interval: number;
    if (step === 'code' && resendTimer > 0) {
      interval = window.setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid) {
      setPhoneError(true);
      setTimeout(() => setPhoneError(false), 2000);
      return;
    }
    
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
      setResendTimer(30);
      NotificationService.send('Zylos PIN', `Your security code is ${newCode}`);
    }, 1200);
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code !== generatedCode) {
      alert("Invalid Code");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setStep('profile');
      setLoading(false);
    }, 800);
  };

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    
    // For local demo, generate a valid UUID format to satisfy the database constraint
    const demoId = generateUUID();
    const profile = { id: demoId, phone: fullPhone, name, avatar };
    
    // In production, this would happen after a real Supabase Auth sign-up
    await cloudSync.upsertProfile(profile, demoId);

    setTimeout(() => {
      onSignIn(profile);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f1115] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-sm bg-[#16191e] border border-white/5 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 md:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[95vh]">
        <div className="flex-1 overflow-y-auto no-scrollbar relative z-10 text-center">
          {step === 'phone' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 py-1">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-[1.25rem] sm:rounded-[1.5rem] flex items-center justify-center mb-4 sm:mb-6 mx-auto shadow-2xl shadow-blue-900/40">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3v1m0 16v1m0-1a10.003 10.003 0 01-9.253-6.429l-.054-.09M12 11h.01" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">Join Zylos</h1>
              <p className="text-zinc-500 mb-6 sm:mb-8 text-xs font-medium">Universal Neural Messenger</p>

              <form onSubmit={handlePhoneSubmit} className="space-y-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1 text-left">
                    <label className="text-[9px] sm:text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Phone Number</label>
                  </div>
                  
                  <div className="flex space-x-2 sm:space-x-2.5">
                    <div className="relative w-24 sm:w-28 flex-shrink-0">
                      <select 
                        value={selectedCountry.name}
                        onChange={(e) => {
                          const country = COUNTRIES.find(c => c.name === e.target.value);
                          if (country) setSelectedCountry(country);
                        }}
                        className="w-full bg-[#1c1f26] border border-white/10 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 px-2 sm:px-3 text-white text-[11px] sm:text-xs focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none text-center shadow-lg transition-all"
                      >
                        {COUNTRIES.map(c => (
                          <option key={c.name} value={c.name}>{c.flag} +{c.code}</option>
                        ))}
                      </select>
                    </div>

                    <input 
                      type="tel"
                      placeholder="900 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      className={`flex-1 bg-[#1c1f26] border rounded-xl sm:rounded-2xl py-2.5 sm:py-3 px-3 sm:px-4 text-white placeholder-zinc-700 focus:ring-2 transition-all text-base sm:text-lg tracking-wider outline-none shadow-lg ${phoneError ? 'border-red-500 animate-shake' : 'border-white/5 focus:ring-blue-500/50'}`}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="p-2 sm:p-2.5 bg-blue-600/5 rounded-xl sm:rounded-[1.25rem] border border-blue-600/10 flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-tight text-left pr-2">{getRegionStatus(fullPhone)}</span>
                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    <span className="text-[8px] font-black text-blue-500 uppercase">Neural Link</span>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                  </div>
                </div>

                <button 
                  disabled={loading || !isPhoneValid}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold py-3 sm:py-3.5 rounded-xl sm:rounded-[1.25rem] transition-all shadow-2xl active:scale-95 text-sm uppercase tracking-widest"
                >
                  {loading ? 'Consulting Cloud...' : 'Proceed'}
                </button>
              </form>
            </div>
          )}

          {step === 'code' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 py-1">
              <button onClick={() => setStep('phone')} className="flex items-center text-blue-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-6 sm:mb-8 hover:text-blue-400">
                <svg className="w-3.5 h-3.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg> Back
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">Enter PIN</h1>
              <p className="text-zinc-500 mb-6 text-xs font-medium">Security code sent to <span className="text-white font-mono">{fullPhone}</span></p>

              <form onSubmit={handleCodeSubmit} className="space-y-6">
                <input 
                  type="text"
                  maxLength={4}
                  placeholder="0000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#1c1f26] border border-white/10 rounded-2xl sm:rounded-[1.75rem] py-5 sm:py-6 text-white text-3xl sm:text-4xl text-center tracking-[0.5em] sm:tracking-[0.6em] font-mono focus:ring-2 focus:ring-blue-500/30 transition-all outline-none shadow-inner"
                  required
                  autoFocus
                />
                <button 
                  disabled={loading || code.length < 4}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white font-bold py-3 sm:py-3.5 rounded-xl sm:rounded-[1.25rem] shadow-2xl transition-all text-sm uppercase tracking-widest"
                >
                  Verify PIN
                </button>
              </form>
            </div>
          )}

          {step === 'profile' && (
            <div className="animate-in zoom-in-95 duration-500 text-center py-1">
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-6 sm:mb-8 tracking-tight">Confirm Identity</h1>
              <div className="flex flex-col items-center mb-6 sm:mb-8">
                  <div className="relative group/avatar">
                    <img src={avatar} className="w-20 h-20 sm:w-24 sm:h-24 rounded-[1.25rem] sm:rounded-[1.5rem] object-cover border-4 border-white/10 shadow-2xl transition-transform group-hover/avatar:scale-105" />
                    <button 
                      type="button"
                      onClick={() => setAvatar(`https://picsum.photos/seed/${Math.random()}/200`)} 
                      className="absolute -bottom-1.5 -right-1.5 bg-blue-600 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-white shadow-2xl hover:bg-blue-500 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                  </div>
              </div>
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="space-y-2.5 text-left">
                  <label className="text-[9px] sm:text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] ml-2">Display Name</label>
                  <input 
                    type="text" 
                    placeholder="Full Name or Alias"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#1c1f26] border border-white/10 rounded-xl sm:rounded-2xl py-3 sm:py-3.5 px-4 sm:px-5 text-white text-sm sm:text-base focus:ring-2 focus:ring-blue-500/30 outline-none transition-all shadow-lg"
                    required
                  />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 sm:py-3.5 rounded-xl sm:rounded-[1.25rem] shadow-2xl hover:bg-blue-500 transition-all text-sm uppercase tracking-widest">Establish Neural Link</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignIn;
