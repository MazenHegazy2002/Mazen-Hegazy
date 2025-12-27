
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';

interface StatusSectionProps {
  users: User[];
}

const StatusSection: React.FC<StatusSectionProps> = ({ users }) => {
  const [activeStatusUser, setActiveStatusUser] = useState<User | null>(null);
  const [myStatuses, setMyStatuses] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timeout: number;
    if (activeStatusUser) {
      timeout = window.setTimeout(() => {
        setActiveStatusUser(null);
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [activeStatusUser]);

  const handleUploadStatus = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMyStatuses(prev => [url, ...prev]);
    }
  };

  return (
    <>
      <div className="flex items-center space-x-4 p-4 overflow-x-auto no-scrollbar bg-[#16191e] border-b border-white/5 relative z-10 scroll-smooth">
        {/* My Status */}
        <div className="flex flex-col items-center flex-shrink-0 cursor-pointer">
          <div className="relative" onClick={() => fileInputRef.current?.click()}>
            <div className={`w-14 h-14 rounded-full border-2 p-0.5 ${myStatuses.length > 0 ? 'border-blue-500' : 'border-zinc-700'}`}>
              <img 
                src={myStatuses.length > 0 ? myStatuses[0] : "https://picsum.photos/seed/me/200"} 
                alt="Me" 
                className="w-full h-full rounded-full object-cover" 
              />
            </div>
            <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full border-2 border-[#16191e] p-0.5 shadow-lg">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
          </div>
          <span className="text-[11px] mt-1 text-zinc-400 font-medium">My Status</span>
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            accept="image/*" 
            onChange={handleUploadStatus} 
          />
        </div>

        {/* Separation Line */}
        <div className="w-[1px] h-10 bg-white/5 flex-shrink-0" />

        {/* Others */}
        {users.map((user, idx) => (
          <div 
            key={user.id} 
            className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
            onClick={() => setActiveStatusUser(user)}
          >
            <div className={`w-14 h-14 rounded-full p-0.5 border-2 ${idx % 2 === 0 ? 'border-blue-500' : 'border-blue-500/50'}`}>
              <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-[11px] mt-1 text-zinc-300 truncate w-14 text-center font-medium">{user.name.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {/* Full-screen Status Viewer */}
      {activeStatusUser && (
        <div className="fixed inset-0 z-[1000] bg-black flex flex-col animate-in fade-in duration-300">
          <div className="absolute top-0 left-0 right-0 p-4 z-20 bg-gradient-to-b from-black/60 to-transparent">
            <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden mb-4">
              <div className="status-bar-inner bg-white h-full" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img src={activeStatusUser.avatar} className="w-10 h-10 rounded-full border border-white/20 shadow-xl" alt="" />
                <div>
                  <h4 className="text-white font-bold text-sm">{activeStatusUser.name}</h4>
                  <p className="text-white/60 text-[10px] uppercase font-bold tracking-widest">Just now</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveStatusUser(null)}
                className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center bg-zinc-900">
             <img 
               src={`https://images.unsplash.com/photo-${idxToImageId(users.indexOf(activeStatusUser))}?q=80&w=2070&auto=format&fit=crop`} 
               className="w-full h-full object-cover"
               alt="Status Content" 
             />
             <div className="absolute bottom-20 left-0 right-0 p-8 text-center bg-gradient-to-t from-black/80 to-transparent">
               <p className="text-white text-lg font-medium drop-shadow-md">Hybrid Messaging is the future! ⚡️</p>
             </div>
          </div>
        </div>
      )}
    </>
  );
};

// Helper for varied status images
const idxToImageId = (idx: number) => {
  const ids = [
    '1542314831-068cd1dbfeeb',
    '1534796636912-3b95b3ab5986',
    '1518770660439-4636190af475',
    '1461749280684-dccba630e2f6'
  ];
  return ids[idx % ids.length];
};

export default StatusSection;
