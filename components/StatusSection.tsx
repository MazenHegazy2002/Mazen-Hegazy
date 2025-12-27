import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { cloudSync } from '../services/supabase';

interface StatusSectionProps {
  users: User[];
  currentUser: User & { authId?: string };
}

interface SharedStatus {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  timestamp: string;
  profiles?: { name: string; avatar: string };
}

const StatusSection: React.FC<StatusSectionProps> = ({ users, currentUser }) => {
  const [activeStatus, setActiveStatus] = useState<SharedStatus | null>(null);
  const [statuses, setStatuses] = useState<SharedStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const data = await cloudSync.fetchStatuses();
      setStatuses(data);
    };
    load();

    const unsubscribe = cloudSync.subscribeToStatuses((newStatus) => {
      setStatuses(prev => [newStatus, ...prev.filter(s => s.id !== newStatus.id)]);
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => {
    let timeout: number;
    if (activeStatus) {
      timeout = window.setTimeout(() => setActiveStatus(null), 5000);
    }
    return () => clearTimeout(timeout);
  }, [activeStatus]);

  const handleUploadStatus = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const userId = currentUser.authId || currentUser.id;
        
        try {
          await cloudSync.pushStatus(userId, { 
            imageUrl: base64, 
            caption: "Neural Capture" 
          });
          // Refresh list locally for speed
          const updated = await cloudSync.fetchStatuses();
          setStatuses(updated);
        } catch (err) {
          console.error("Status upload failed:", err);
          alert("Could not post status. Ensure your profile is synchronized.");
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      <div className="flex items-center space-x-5 p-5 overflow-x-auto no-scrollbar bg-[#16191e] border-b border-white/5 relative z-10 shrink-0">
        {/* Add Status Button */}
        <div className="flex flex-col items-center flex-shrink-0 cursor-pointer group">
          <div className="relative" onClick={() => !isUploading && fileInputRef.current?.click()}>
            <div className={`w-14 h-14 rounded-full border-2 p-0.5 transition-all duration-300 ${isUploading ? 'border-blue-500 animate-pulse' : 'border-zinc-800 group-hover:border-zinc-700'}`}>
              <img 
                src={currentUser.avatar || "https://picsum.photos/seed/me/200"} 
                alt="Me" 
                className={`w-full h-full rounded-full object-cover transition-opacity ${isUploading ? 'opacity-40' : 'opacity-40 grayscale group-hover:opacity-60'}`} 
              />
            </div>
            <div className="absolute bottom-0 right-0 bg-blue-600 rounded-full border-2 border-[#16191e] p-1 shadow-lg group-hover:scale-110 transition-transform">
              {isUploading ? (
                <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              )}
            </div>
          </div>
          <span className="text-[10px] mt-2 text-zinc-500 font-black uppercase tracking-widest">My Story</span>
          <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={handleUploadStatus} />
        </div>

        {statuses.length > 0 && <div className="w-[1px] h-10 bg-white/5 flex-shrink-0" />}

        {/* Global Status Feed */}
        {statuses.map((status) => (
          <div 
            key={status.id} 
            className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
            onClick={() => setActiveStatus(status)}
          >
            <div className="w-14 h-14 rounded-full p-0.5 border-2 border-blue-600 shadow-xl shadow-blue-900/10 active:scale-95 transition-all">
              <img 
                src={status.profiles?.avatar || `https://picsum.photos/seed/${status.user_id}/200`} 
                alt="" 
                className="w-full h-full rounded-full object-cover group-hover:scale-105 transition-transform" 
              />
            </div>
            <span className="text-[10px] mt-2 text-zinc-300 truncate w-16 text-center font-bold uppercase tracking-tighter">
              {status.profiles?.name.split(' ')[0] || 'User'}
            </span>
          </div>
        ))}
      </div>

      {activeStatus && (
        <div className="fixed inset-0 z-[1000] bg-black flex flex-col animate-in fade-in duration-300">
          <div className="absolute top-0 left-0 right-0 p-6 z-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden mb-5">
              <div className="status-bar-inner bg-blue-500 h-full" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* FIX: Changed 'status' to 'activeStatus' to correctly access the active status user profile */}
                <img src={activeStatus.profiles?.avatar || "https://picsum.photos/seed/friend/200"} className="w-10 h-10 rounded-full border border-white/20" alt="" />
                <div>
                  <h4 className="text-white font-bold text-sm tracking-tight">{activeStatus.profiles?.name || 'Zylos Member'}</h4>
                  <p className="text-blue-500 text-[9px] uppercase font-black tracking-[0.2em]">Neural Feed</p>
                </div>
              </div>
              <button onClick={() => setActiveStatus(null)} className="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center bg-zinc-950 overflow-hidden px-2">
             <img src={activeStatus.image_url} className="w-full h-auto max-h-full object-contain rounded-2xl shadow-2xl" alt="Status" />
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-10 text-center bg-gradient-to-t from-black/90 via-black/40 to-transparent">
             <p className="text-white text-lg font-medium drop-shadow-xl">{activeStatus.caption || "Sharing via Zylos"}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default StatusSection;