
import React from 'react';

interface MobileAppGuideProps {
  onContinue: () => void;
}

const MobileAppGuide: React.FC<MobileAppGuideProps> = ({ onContinue }) => {
  const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 z-[300] bg-[#0f1115] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-blue-900/40">
        <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-white mb-4">Install Zylos</h1>
      <p className="text-zinc-400 mb-12 max-w-xs leading-relaxed">
        Use Zylos as a standalone app to get voice calls, video calls, and instant notifications.
      </p>

      <div className="w-full max-w-sm bg-[#1c1f26] border border-white/5 rounded-3xl p-6 space-y-6 text-left mb-12">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">How to install</h3>
        
        {isiOS ? (
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center flex-shrink-0 font-bold">1</div>
              <p className="text-sm text-zinc-200">Tap the <span className="text-blue-500 font-bold">Share</span> button in Safari (bottom center).</p>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center flex-shrink-0 font-bold">2</div>
              <p className="text-sm text-zinc-200">Scroll down and tap <span className="text-blue-500 font-bold">"Add to Home Screen"</span>.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center flex-shrink-0 font-bold">1</div>
              <p className="text-sm text-zinc-200">Tap the <span className="text-blue-500 font-bold">Menu</span> (three dots) in Chrome.</p>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center flex-shrink-0 font-bold">2</div>
              <p className="text-sm text-zinc-200">Tap <span className="text-blue-500 font-bold">"Install App"</span> or "Add to Home Screen".</p>
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={onContinue}
        className="text-zinc-500 text-sm font-bold uppercase tracking-widest hover:text-white transition-colors"
      >
        I'll do it later, continue to web
      </button>
    </div>
  );
};

export default MobileAppGuide;
