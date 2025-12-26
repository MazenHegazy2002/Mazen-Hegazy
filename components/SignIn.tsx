
import React, { useState, useEffect } from 'react';
import { COUNTRIES, Country } from '../constants';

interface SignInProps {
  onSignIn: (profile: { phone: string; name: string; avatar: string }) => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignIn }) => {
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(`https://picsum.photos/seed/${Math.random()}/200`);
  const [step, setStep] = useState<'phone' | 'code' | 'profile'>('phone');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [showCodeHint, setShowCodeHint] = useState(false);

  useEffect(() => {
    let interval: number;
    if (step === 'code' && resendTimer > 0) {
      interval = window.setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 5) return;
    setLoading(true);
    
    // Simulate generating a 4-digit code locally
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedCode(newCode);

    setTimeout(() => {
      setStep('code');
      setLoading(false);
      setResendTimer(30);
      setShowCodeHint(true);
    }, 1500);
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code !== generatedCode) {
      alert("Invalid code. Please use the code shown in the notification.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setStep('profile');
      setLoading(false);
    }, 1000);
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setTimeout(() => {
      onSignIn({ 
        phone: `+${selectedCountry.code}${phone}`, 
        name, 
        avatar 
      });
      setLoading(false);
    }, 1200);
  };

  const handleRefreshAvatar = () => {
    setAvatar(`https://picsum.photos/seed/${Math.random()}/200`);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f1115] flex items-center justify-center p-6">
      {/* Simulated SMS Notification */}
      {step === 'code' && showCodeHint && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-xs bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-8 duration-500 z-[110]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Messages</p>
              <p className="text-sm text-white">Your Zylos verification code is: <span className="font-bold text-blue-400">{generatedCode}</span></p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-[#16191e] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden transition-all duration-500">
        {/* Ambient background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 blur-[100px]" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/10 blur-[100px]" />

        <div className="relative z-10">
          {step !== 'profile' && (
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-lg shadow-blue-900/40 transform transition-transform hover:scale-105">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          )}

          {step === 'phone' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-bold text-center text-white mb-2">Welcome to Zylos</h1>
              <p className="text-zinc-500 text-center mb-10 px-4">Secure communication across all borders. No VPN needed.</p>

              <form onSubmit={handlePhoneSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Country & Number</label>
                  
                  <div className="flex space-x-2">
                    {/* Country Selector */}
                    <select 
                      value={selectedCountry.name}
                      onChange={(e) => {
                        const country = COUNTRIES.find(c => c.name === e.target.value);
                        if (country) setSelectedCountry(country);
                      }}
                      className="bg-[#1c1f26] border border-white/5 rounded-2xl py-4 px-3 text-white text-sm focus:ring-2 focus:ring-blue-500/50 outline-none w-24 appearance-none text-center"
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.name} value={c.name}>{c.flag} +{c.code}</option>
                      ))}
                    </select>

                    <div className="relative flex-1">
                      <input 
                        type="tel"
                        placeholder="Phone Number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-[#1c1f26] border border-white/5 rounded-2xl py-4 px-4 text-white placeholder-zinc-600 focus:ring-2 focus:ring-blue-500/50 transition-all text-lg tracking-wide outline-none"
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#1c1f26] rounded-2xl border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white">Global Turbo Proxy</span>
                    <span className="text-[10px] text-zinc-500">Optimized for low-latency calls everywhere</span>
                  </div>
                  <div className="w-10 h-6 bg-blue-600 rounded-full flex items-center px-1">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                  </div>
                </div>

                <button 
                  disabled={loading}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center space-x-3 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Get Started</span>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 'code' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button 
                onClick={() => setStep('phone')}
                className="flex items-center text-blue-500 text-sm font-medium mb-6 hover:text-blue-400 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Change Number
              </button>
              
              <h1 className="text-3xl font-bold text-center text-white mb-2">Verify Code</h1>
              <p className="text-zinc-500 text-center mb-10 px-4">
                We've sent a 4-digit code to <span className="text-zinc-300 font-medium">+{selectedCountry.code} {phone}</span>
              </p>

              <form onSubmit={handleCodeSubmit} className="space-y-6">
                <div className="space-y-2 text-center">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Security Code</label>
                  <input 
                    type="text"
                    maxLength={4}
                    placeholder="0000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#1c1f26] border border-white/5 rounded-2xl py-5 px-4 text-white text-4xl text-center tracking-[1em] font-mono focus:ring-2 focus:ring-blue-500/50 transition-all outline-none"
                    required
                    autoFocus
                  />
                </div>

                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-xs text-zinc-500">Resend code in <span className="text-blue-500 font-bold">{resendTimer}s</span></p>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => {
                        setResendTimer(30);
                        const newCode = Math.floor(1000 + Math.random() * 9000).toString();
                        setGeneratedCode(newCode);
                        setShowCodeHint(true);
                      }}
                      className="text-xs text-blue-500 font-bold hover:underline"
                    >
                      Resend Code
                    </button>
                  )}
                </div>

                <button 
                  disabled={loading || code.length < 4}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center space-x-3 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Verify & Continue</span>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 'profile' && (
            <div className="animate-in fade-in zoom-in-95 duration-500">
              <h1 className="text-3xl font-bold text-center text-white mb-2">Almost There</h1>
              <p className="text-zinc-500 text-center mb-10 px-4">Set up your profile to start chatting.</p>

              <div className="flex flex-col items-center mb-8 relative group">
                <div className="relative">
                  <img 
                    src={avatar} 
                    alt="Profile Preview" 
                    className="w-28 h-28 rounded-[2rem] object-cover shadow-2xl border-4 border-white/5 group-hover:scale-105 transition-transform duration-300"
                  />
                  <button 
                    onClick={handleRefreshAvatar}
                    className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-blue-500 transition-all active:scale-90"
                    title="Refresh Avatar"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Your Full Name</label>
                  <input 
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#1c1f26] border border-white/5 rounded-2xl py-4 px-5 text-white placeholder-zinc-600 focus:ring-2 focus:ring-blue-500/50 transition-all text-lg outline-none"
                    required
                    autoFocus
                  />
                </div>

                <p className="text-[10px] text-zinc-500 text-center uppercase tracking-widest font-bold px-4">
                  This name will be visible to your contacts in Zylos.
                </p>

                <button 
                  disabled={loading || !name.trim()}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/40 flex items-center justify-center space-x-3 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Complete Profile</span>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          <p className="mt-8 text-center text-[10px] text-zinc-600 px-6 uppercase tracking-widest font-bold">
            End-to-End Encrypted • No Logs
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
