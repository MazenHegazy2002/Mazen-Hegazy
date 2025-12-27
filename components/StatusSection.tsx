
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { cloudSync } from '../services/supabase';

interface StatusSectionProps {
  users: User[];
  // currentUser should include authId for database operations
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
    // 1. Initial Load from Cloud
    const load = async () => {
      const data = await cloudSync.fetchStatuses();
      setStatuses(data);
    };
    load();

    // 2. Real-time Subscription for new updates
    const unsubscribe = cloudSync.subscribeToStatuses((newStatus) => {
      setStatuses(prev => [newStatus, ...prev]);
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
        
        // CRITICAL FIX: Use the authId (UUID) instead of phone number
        // to match the foreign key constraint in the statuses table.
        const userId = currentUser.authId || currentUser.id;
        
        try {
          await cloudSync.pushStatus(userId, { 
            imageUrl: base64, 
            caption: "Captured on Zylos" 
          });
        } catch (err) {
          console.error("Status upload failed:", err);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      <div className="flex items-center space-x-4 p-4 overflow-x-auto no-scrollbar bg-[#16191e] border-b border-white/5 relative z-10 scroll-smooth">
        {/* My Status Post Button */}
        <div className="flex flex-col items-center flex-shrink-0 cursor-pointer">
          <div className="relative" onClick={() => !isUploading && fileInputRef.current?.click()}>
            <div className={`w-14 h-14 rounded-full border-2 p-0.5 border-zinc-700 ${isUploading ? 'animate-pulse' : ''}`}>
              <img 
                src={currentUser.avatar || "https://picsum.photos/seed/me/200"} 
                alt="Me" 
                className={`w-full h-full rounded-full object-cover ${isUploading ? 'opacity-40' : 'grayscale opacity-60'}`} 
              />
            </div>
            <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full border-2 border-[#16191e] p-0.5 shadow-lg">
              {isUploading ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              )}
            </div>
          </div>
          <span className="text-[11px] mt-1 text-zinc-400 font-medium">Add Status</span>
          <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={handleUploadStatus} />
        </div>

        {statuses.length > 0 && <div className="w-[1px] h-10 bg-white/5 flex-shrink-0" />}

        {/* Global Social Feed */}
        {statuses.map((status) => (
          <div 
            key={status.id} 
            className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
            onClick={() => setActiveStatus(status)}
          >
            <div className="w-14 h-14 rounded-full p-0.5 border-2 border-blue-500 shadow-lg shadow-blue-900/10">
              <img 
                src={status.profiles?.avatar || `https://picsum.photos/seed/${status.user_id}/200`} 
                alt="" 
                className="w-full h-full rounded-full object-cover group-hover:scale-105 transition-transform" 
              />
            </div>
            <span className="text-[11px] mt-1 text-zinc-300 truncate w-14 text-center font-medium">
              {status.profiles?.name.split(' ')[0] || 'Friend'}
            </span>
          </div>
        ))}
      </div>

      {activeStatus && (
        <div className="fixed inset-0 z-[1000] bg-black flex flex-col animate-in fade-in duration-300">
          <div className="absolute top-0 left-0 right-0 p-4 z-20 bg-gradient-to-b from-black/60 to-transparent">
            <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden mb-4">
              <div className="status-bar-inner bg-white h-full" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img src={activeStatus.profiles?.avatar || "https://picsum.photos/seed/friend/200"} className="w-10 h-10 rounded-full border border-white/20 shadow-xl" alt="" />
                <div>
                  <h4 className="text-white font-bold text-sm">{activeStatus.profiles?.name || 'Zylos User'}</h4>
                  <p className="text-white/60 text-[10px] uppercase font-bold tracking-widest">Global Feed</p>
                </div>
              </div>
              <button onClick={() => setActiveStatus(null)} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center bg-zinc-900 overflow-hidden">
             <img src={activeStatus.image_url} className="w-full h-auto max-h-full object-contain" alt="Status" />
             <div className="absolute bottom-20 left-0 right-0 p-8 text-center bg-gradient-to-t from-black/80 to-transparent">
               <p className="text-white text-lg font-medium drop-shadow-md">{activeStatus.caption || "Sharing a moment on Zylos"}</p>
             </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StatusSection;
