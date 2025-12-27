import React, { useState, useMemo, useEffect } from 'react';
import { User } from '../types';
import { DB } from '../services/database';
import { cloudSync } from '../services/supabase';
import { validatePhone, formatPhoneDisplay } from '../services/validation';

interface ContactListProps {
  users: User[];
  currentUser: User;
  onStartChat: (user: User) => void;
  onAddContact: (user: User) => void;
}

const ContactList: React.FC<ContactListProps> = ({ users, currentUser, onStartChat, onAddContact }) => {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  const [registeredPhones, setRegisteredPhones] = useState<Set<string>>(new Set());
  const [globalResults, setGlobalResults] = useState<User[]>([]);
  const [recommended, setRecommended] = useState<User[]>([]);
  
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // LOAD RECOMMENDED (REAL PUBLISHED APP FEEL)
  useEffect(() => {
    const loadRecs = async () => {
      const all = await cloudSync.getAllProfiles(currentUser.id);
      // Filter out those already in contacts
      const filtered = all.filter(u => !users.some(c => c.id === u.id));
      setRecommended(filtered);
    };
    loadRecs();
  }, [currentUser.id, users]);

  // FRIEND DISCOVERY
  useEffect(() => {
    const sync = async () => {
      if (users.length === 0) return;
      setIsSyncing(true);
      try {
        const phones = users.map(u => u.phone);
        const onZylos = await DB.discoverContacts(phones);
        setRegisteredPhones(new Set(onZylos.map(u => u.phone)));
      } catch (err) {}
      setIsSyncing(false);
    };
    sync();
  }, [users]);

  // GLOBAL REGISTRY SEARCH
  useEffect(() => {
    const searchGlobal = async () => {
      if (search.length < 3) {
        setGlobalResults([]);
        return;
      }
      setIsSyncing(true);
      try {
        const formatted = formatPhoneDisplay(search);
        const results = await cloudSync.searchProfiles(search, formatted);
        const filtered = results.filter(r => r.id !== currentUser.id && !users.some(u => u.id === r.id));
        setGlobalResults(filtered);
      } catch (e) {
      } finally {
        setIsSyncing(false);
      }
    };

    const timer = setTimeout(searchGlobal, 500);
    return () => clearTimeout(timer);
  }, [search, users, currentUser.id]);

  const localFiltered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return users.filter(u => 
      u.name.toLowerCase().includes(s) || u.phone.includes(s)
    );
  }, [users, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedPhone = formatPhoneDisplay(newPhone);
    
    if (!validatePhone(formattedPhone)) {
      alert("Invalid international format. (e.g. +1 555...)");
      return;
    }

    setIsCheckingDb(true);
    try {
      const existingProfile = await cloudSync.getProfileByPhone(formattedPhone);
      let finalUser: User;
      
      if (existingProfile) {
        finalUser = {
          id: existingProfile.id,
          name: existingProfile.name || newName,
          phone: existingProfile.phone,
          avatar: existingProfile.avatar || `https://picsum.photos/seed/${existingProfile.id}/200`,
          status: 'online'
        };
      } else {
        finalUser = {
          id: generateUUID(),
          name: newName || 'New Contact',
          phone: formattedPhone,
          avatar: `https://picsum.photos/seed/${formattedPhone}/200`,
          status: 'offline'
        };
      }

      onAddContact(finalUser);
      setShowAddModal(false);
      setNewName('');
      setNewPhone('');
      
      if (existingProfile) onStartChat(finalUser);
    } catch (err) {
      alert("Neural Registry failed. Added locally.");
    } finally {
      setIsCheckingDb(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#121418] relative">
      <div className="p-6 space-y-4">
        <div className="relative group">
          <input 
            type="text"
            placeholder="Search by name or signal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1c1f26] border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-sm focus:ring-2 focus:ring-blue-500/20 text-zinc-200 outline-none transition-all"
          />
          <svg className="w-5 h-5 absolute left-4 top-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          {isSyncing && (
            <div className="absolute right-4 top-4">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-8">
        <div className="px-3 mb-6">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center p-4 rounded-3xl bg-blue-600/5 hover:bg-blue-600/10 text-blue-500 transition-all border border-dashed border-blue-500/20"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-900/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <div className="ml-4 text-left">
              <h4 className="font-bold text-sm tracking-tight">Manual Registry</h4>
              <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest mt-0.5">Add Signal ID</p>
            </div>
          </button>
        </div>

        {/* Local Registry */}
        {localFiltered.length > 0 && (
          <div className="px-4 py-3 text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em] flex justify-between items-center mb-2">
            <span>Secured Connections</span>
          </div>
        )}

        {localFiltered.map((user) => {
          const isOnZylos = registeredPhones.has(user.phone);
          return (
            <div key={user.id} className="w-full flex items-center p-4 rounded-[2rem] mb-1.5 hover:bg-white/5 transition-all text-zinc-400 group">
              <div className="relative flex-shrink-0">
                <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-[1.25rem] object-cover shadow-2xl border border-white/5" />
                {isOnZylos && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-[#121418] rounded-full" />
                )}
              </div>
              <div className="ml-4 flex-1 text-left min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="font-bold text-zinc-100 truncate">{user.name}</h4>
                  {isOnZylos && (
                    <span className="bg-blue-600/10 text-blue-500 text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-tighter border border-blue-500/20">Synced</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{user.phone}</p>
              </div>
              <button onClick={() => onStartChat(user)} className="p-3 bg-blue-600/5 text-blue-500 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-lg active:scale-90">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </button>
            </div>
          );
        })}

        {/* Recommended Registry (The "Published App" magic) */}
        {!search && recommended.length > 0 && (
          <>
            <div className="px-4 py-3 text-[10px] font-black text-blue-500/60 uppercase tracking-[0.4em] flex justify-between items-center mb-2 mt-4 border-t border-white/5 pt-6">
              <span>Recommended Signals</span>
            </div>
            {recommended.map((user) => (
              <div key={user.id} className="w-full flex items-center p-4 rounded-[2rem] mb-1.5 bg-blue-600/5 hover:bg-blue-600/10 transition-all group">
                <div className="relative flex-shrink-0">
                  <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-[1.25rem] object-cover shadow-2xl border border-white/10" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 border-2 border-[#121418] rounded-full" />
                </div>
                <div className="ml-4 flex-1 text-left min-w-0">
                  <h4 className="font-bold text-zinc-100 truncate">{user.name}</h4>
                  <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest mt-0.5">Active Member</p>
                </div>
                <button onClick={() => { onAddContact(user); onStartChat(user); }} className="px-5 py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded-2xl shadow-xl active:scale-95 transition-all">
                  Sync
                </button>
              </div>
            ))}
          </>
        )}

        {search.length > 2 && localFiltered.length === 0 && globalResults.length === 0 && !isSyncing && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 text-zinc-700">
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <p className="text-zinc-500 text-sm font-medium">Neural Signal Not Found</p>
            <p className="text-zinc-700 text-[10px] uppercase font-black tracking-widest mt-2">Try full international number</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="absolute inset-0 z-[110] bg-[#121418] p-8 animate-in slide-in-from-bottom duration-500">
           <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-bold text-white tracking-tight">Manual Signal</h2>
              <button onClick={() => setShowAddModal(false)} className="p-3 bg-white/5 rounded-2xl text-zinc-500 hover:text-white transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
           </div>
           <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-2">Display Name</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-[#1c1f26] rounded-2xl py-5 px-6 text-white border border-white/5 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  placeholder="e.g. Satoshi"
                  required
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-2">Phone Number</label>
                <input 
                  type="tel" 
                  value={newPhone} 
                  placeholder="+44 7... or +1 ..."
                  onChange={e => setNewPhone(formatPhoneDisplay(e.target.value))}
                  className="w-full bg-[#1c1f26] rounded-2xl py-5 px-6 text-white border border-white/5 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={isCheckingDb}
                className={`w-full bg-blue-600 text-white font-black py-5 rounded-[1.25rem] shadow-2xl shadow-blue-900/40 flex items-center justify-center space-x-3 active:scale-95 transition-all text-[11px] uppercase tracking-[0.3em] ${isCheckingDb ? 'opacity-50' : ''}`}
              >
                {isCheckingDb ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Intercepting signal...</span>
                  </>
                ) : (
                  <span>Register Connection</span>
                )}
              </button>
              <p className="text-[10px] text-zinc-600 text-center leading-relaxed font-bold uppercase tracking-widest opacity-60">Zylos will check the global neural registry to see if this identity already exists.</p>
           </form>
        </div>
      )}
    </div>
  );
};

export default ContactList;