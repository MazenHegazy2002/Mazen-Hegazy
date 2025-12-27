
import React, { useState, useEffect } from 'react';
import { COUNTRIES, Country } from '../constants';
import { validatePhone, formatPhoneDisplay, getRussiaStatus } from '../services/validation';

interface SignInProps {
  onSignIn: (profile: { phone: string; name: string; avatar: string }) => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignIn }) => {
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES.find(c => c.name === 'Russia') || COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState(false);
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(`https://picsum.photos/seed/${Math.random()}/200`);
  const [step, setStep] = useState<'phone' | 'code' | 'profile'>('phone');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [showCodeHint, setShowCodeHint] = useState(false);

  const fullPhone = formatPhoneDisplay(`+${selectedCountry.code}${phone}`);
  const isPhoneValid = validatePhone(fullPhone);

  useEffect(() => {
    let interval: number;
    if (step === 'code' && resendTimer > 0) {
      interval = window.setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid) {
      setPhoneError(true);
      setTimeout(() => setPhoneError(false), 2000);
      return;
    }
    
    setLoading(true);
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedCode(newCode);

    setTimeout(() => {
      setStep('code');
      setLoading(false);
      setResendTimer(30);
      setShowCodeHint(true);
    }, 1200);
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code !== generatedCode) {
      alert("Verification failed. Please check the code provided in the top notification.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setStep('profile');
      setLoading(false);
    }, 800);
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setTimeout(() => {
      onSignIn({ 
        phone: fullPhone, 
        name, 
        avatar 
      });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f1115] flex items-center justify-center p-6">
      {step === 'code' && showCodeHint && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-xs bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-8 duration-500 z-[110]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Cloud Verification</p>
              <p className="text-sm text-white">Your Zylos Code: <span className="font-bold text-blue-400">{generatedCode}</span></p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-[#16191e] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 blur-[100px]" />
        
        <div className="relative z-10">
          {step === 'phone' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-lg shadow-blue-900/40">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3v1m0 16v1m0-1a10.003 10.003 0 01-9.253-6.429l-.054-.09M12 11h.01" /></svg>
              </div>
              <h1 className="text-2xl font-bold text-center text-white mb-2 tracking-tight">Enter Phone</h1>
              <p className="text-zinc-500 text-center mb-10 text-sm">Please use correct international format.</p>

              <form onSubmit={handlePhoneSubmit} className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1 px-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Mobile Number</label>
                    {phone.length > 0 && (
                      <span className={`text-[9px] font-black uppercase tracking-widest ${isPhoneValid ? 'text-green-500' : 'text-orange-500'}`}>
                        {isPhoneValid ? 'Correct Format' : 'Invalid Entry'}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <select 
                      value={selectedCountry.name}
                      onChange={(e) => {
                        const country = COUNTRIES.find(c => c.name === e.target.value);
                        if (country) setSelectedCountry(country);
                      }}
                      className="bg-[#1c1f26] border border-white/5 rounded-2xl py-4 px-3 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none w-28 appearance-none text-center transition-all"
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.name} value={c.name}>{c.flag} +{c.code}</option>
                      ))}
                    </select>

                    <input 
                      type="tel"
                      placeholder="900 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      className={`flex-1 bg-[#1c1f26] border rounded-2xl py-4 px-4 text-white placeholder-zinc-700 focus:ring-2 transition-all text-lg tracking-wider outline-none ${phoneError ? 'border-red-500 animate-shake' : (isPhoneValid ? 'border-green-500/30 ring-green-500/10' : 'border-white/5 focus:ring-blue-500/50')}`}
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-2 px-1 italic">Format example: {fullPhone}</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-600/5 rounded-2xl border border-blue-600/10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{getRussiaStatus(fullPhone)}</span>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Cloud Database: Online</span>
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
                </div>

                <button 
                  disabled={loading || !isPhoneValid}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-900/20 active:scale-95"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  ) : 'Sync & Continue'}
                </button>
              </form>
            </div>
          )}

          {step === 'code' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button onClick={() => setStep('phone')} className="flex items-center text-blue-500 text-[10px] font-black uppercase tracking-widest mb-6 hover:text-blue-400"><svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg> Back to Number</button>
              <h1 className="text-2xl font-bold text-white mb-2">Verify Identity</h1>
              <p className="text-zinc-500 mb-8 text-sm">Validating for <span className="text-zinc-300 font-mono">{fullPhone}</span></p>

              <form onSubmit={handleCodeSubmit} className="space-y-6">
                <input 
                  type="text"
                  maxLength={4}
                  placeholder="0000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#1c1f26] border border-white/5 rounded-2xl py-6 text-white text-4xl text-center tracking-[0.6em] font-mono focus:ring-2 focus:ring-blue-500/50 transition-all outline-none"
                  required
                  autoFocus
                />
                <button 
                  disabled={loading || code.length < 4}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white font-bold py-4 rounded-2xl shadow-xl transition-all"
                >
                  Confirm Code
                </button>
              </form>
            </div>
          )}

          {step === 'profile' && (
            <div className="animate-in zoom-in-95 duration-500">
              <h1 className="text-2xl font-bold text-center text-white mb-8">Set Cloud Profile</h1>
              <div className="flex flex-col items-center mb-8 relative">
                  <div className="relative group/avatar">
                    <img src={avatar} className="w-24 h-24 rounded-3xl object-cover border-4 border-white/5 shadow-2xl transition-transform group-hover/avatar:scale-105" />
                    <button 
                      type="button"
                      onClick={() => setAvatar(`https://picsum.photos/seed/${Math.random()}/200`)} 
                      className="absolute -bottom-2 -right-2 bg-blue-600 p-2.5 rounded-xl text-white shadow-xl hover:bg-blue-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                  </div>
              </div>
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Display Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Alex"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#1c1f26] border border-white/5 rounded-2xl py-4 px-5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                    required
                  />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-2xl shadow-blue-900/40 hover:bg-blue-500 transition-all">Start Encrypted Session</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignIn;
