
import React, { useState, useEffect } from 'react';

interface ZylosNotification {
  title: string;
  body: string;
  icon?: string;
  timestamp: Date;
}

const NotificationToast: React.FC = () => {
  const [activeNotification, setActiveNotification] = useState<ZylosNotification | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleNotification = (e: any) => {
      setActiveNotification(e.detail);
      setIsVisible(true);
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setActiveNotification(null), 500);
      }, 5000);
    };

    window.addEventListener('zylos-notification', handleNotification);
    return () => window.removeEventListener('zylos-notification', handleNotification);
  }, []);

  if (!activeNotification) return null;

  return (
    <div 
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[2000] w-[calc(100%-2rem)] max-w-sm transition-all duration-500 ease-out cursor-pointer active:scale-95 ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-24 opacity-0'
      }`}
      onClick={() => setIsVisible(false)}
    >
      <div className="bg-[#1c1f26]/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center space-x-4">
        <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-2xl overflow-hidden shadow-lg border border-white/5">
          {activeNotification.icon ? (
            <img src={activeNotification.icon} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white truncate">{activeNotification.title}</h4>
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">Now</span>
          </div>
          <p className="text-xs text-zinc-400 truncate mt-0.5">{activeNotification.body}</p>
        </div>
      </div>
    </div>
  );
};

export default NotificationToast;
