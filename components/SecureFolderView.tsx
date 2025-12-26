
import React, { useState, useEffect } from 'react';
import { Chat } from '../types';

interface SecureFolderViewProps {
  chats: Chat[];
  onOpenChat: (id: string) => void;
  passcode: string | null;
  onSetPasscode: (passcode: string | null) => void;
  userPhone: string;
}

const SecureFolderView: React.FC<SecureFolderViewProps> = ({ chats, onOpenChat, passcode, onSetPasscode, userPhone }) => {
  const [view, setView] = useState<'unlock' | 'setup' | 'confirm' | 'reset'>(passcode ? 'unlock' : 'setup');
  const [pin, setPin] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [error, setError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [resetInput, setResetInput] = useState('');

  // Auto-reset error after a short delay
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(false), 800);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);

    if (nextPin.length === 4) {
      if (view === 'unlock') {
        if (nextPin === passcode) {
          setTimeout(() => setUnlocked(true), 200);
        } else {
          setError(true);
          setTimeout(() => setPin(''), 400);
          if (navigator.vibrate) navigator.vibrate([50, 50]);
        }
      } else if (view === 'setup') {
        setSetupPin(nextPin);
        setPin('');
        setView('confirm');
      } else if (view === 'confirm') {
        if (nextPin === setupPin) {
          onSetPasscode(nextPin);
          setUnlocked(true);
        } else {
          setError(true);
          setPin('');
          setView('setup');
          if (navigator.vibrate) navigator.vibrate([100]);
        }
      }
    }
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetInput.replace(/\D/g, '') === userPhone.replace(/\D/g, '')) {
      onSetPasscode(null);
      setPin('');
      setSetupPin('');
      setView('setup');
      setResetInput('');
      alert("Passcode reset successful. Please set a new one.");
    } else {
      alert("Phone number verification failed. Please try again.");
    }
  };

  if (unlocked) {
    return (
      <div className="h-full bg-[#121418] flex flex-col animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#121418]/80 backdrop-blur sticky top-0 z-10">
          <h1 className="text-2xl font-bold text-white">Private Chats</h1>
          <button 
            onClick={() => { setUnlocked(false); setPin(''); setView('unlock'); }} 
            className="text-[10px] font-bold text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full uppercase tracking-widest hover:bg-blue-500/10 transition-colors"
          >
            Lock
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {chats.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center px-8">
              <div className="w-16 h-16 bg-zinc-800/30 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <p className="text-sm font-medium">Your Secure Folder is empty.</p>
              <p className="text-xs mt-1">Add chats here to protect them with your passcode.</p>
            </div>
          ) : (
            chats.map(chat => (
              <button
                key={chat.id}
                onClick={() => onOpenChat(chat.id)}
                className="w-full flex items-center p-4 bg-[#1c1f26] rounded-2xl mb-2 hover:bg-zinc-800 transition-all border border-white/5"
              >
                <img src={chat.participants[0].avatar} className="w-12 h-12 rounded-xl object-cover shadow-lg" />
                <div className="ml-4 text-left">
                  <h4 className="font-bold text-zinc-200">{chat.participants[0].name}</h4>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">Hidden conversation</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === 'reset') {
    return (
      <div className="h-full bg-[#0d0f12] flex flex-col p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button onClick={() => setView('unlock')} className="text-blue-500 flex items-center mb-12 self-start font-medium">
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <h2 className="text-3xl font-bold text-white mb-2">Reset Passcode</h2>
          <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
            Verify your account phone number to clear your secure folder passcode.
          </p>
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Account Phone</label>
              <input 
                type="text" 
                placeholder={userPhone.replace(/\d(?=\d{4})/g, "*")} 
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                className="w-full bg-[#1c1f26] border border-white/5 rounded-2xl py-4 px-5 text-white focus:ring-2 focus:ring-blue-500/40 outline-none transition-all"
                required
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-95">
              Verify & Reset
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0d0f12] flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-colors ${error ? 'bg-red-500 text-white shadow-lg shadow-red-900/30' : 'bg-blue-600/10 text-blue-500 shadow-inner shadow-blue-500/5'}`}>
        <svg className={`w-10 h-10 ${error ? 'animate-bounce' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>

      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-white mb-2">
          {view === 'unlock' ? 'Secure Folder' : view === 'setup' ? 'Create Passcode' : 'Confirm Passcode'}
        </h2>
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
          {view === 'unlock' ? 'Enter your security PIN' : 'Set a 4-digit PIN for private chats'}
        </p>
      </div>
      
      <div className={`flex space-x-4 mb-14 ${error ? 'animate-bounce' : ''}`}>
        {[...Array(4)].map((_, i) => (
          <div 
            key={i} 
            className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
              pin.length > i 
                ? (error ? 'bg-red-500 border-red-500' : 'bg-blue-500 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]') 
                : 'border-zinc-700'
            }`} 
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-x-8 gap-y-6">
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button 
            key={n} 
            onClick={() => handleDigit(n.toString())}
            className="w-16 h-16 rounded-full bg-zinc-800/40 hover:bg-zinc-800 text-2xl font-bold text-white transition-all active:scale-75 flex items-center justify-center"
          >
            {n}
          </button>
        ))}
        <div />
        <button 
          onClick={() => handleDigit('0')}
          className="w-16 h-16 rounded-full bg-zinc-800/40 hover:bg-zinc-800 text-2xl font-bold text-white transition-all active:scale-75 flex items-center justify-center"
        >
          0
        </button>
        <button 
          onClick={() => setPin(prev => prev.slice(0, -1))}
          className="w-16 h-16 rounded-full flex items-center justify-center text-zinc-500 hover:text-white transition-colors active:scale-75"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" /></svg>
        </button>
      </div>

      {view === 'unlock' && (
        <button 
          onClick={() => setView('reset')}
          className="mt-12 text-xs font-bold text-zinc-600 uppercase tracking-widest hover:text-blue-500 transition-colors"
        >
          Forgot Passcode?
        </button>
      )}
    </div>
  );
};

export default SecureFolderView;
