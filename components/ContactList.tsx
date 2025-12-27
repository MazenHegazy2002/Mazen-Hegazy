
import React, { useState, useMemo, useEffect } from 'react';
import { User } from '../types';
import { DB } from '../services/database';
import { validatePhone, formatPhoneDisplay } from '../services/validation';

interface ContactListProps {
  users: User[];
  onStartChat: (user: User) => void;
  onAddContact: (user: User) => void;
}

const ContactList: React.FC<ContactListProps> = ({ users, onStartChat, onAddContact }) => {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [registeredPhones, setRegisteredPhones] = useState<Set<string>>(new Set());
  
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    const sync = async () => {
      setIsSyncing(true);
      const phones = users.map(u => u.phone);
      const onZylos = await DB.discoverContacts(phones);
      setRegisteredPhones(new Set(onZylos.map(u => u.phone)));
      setIsSyncing(false);
    };
    sync();
  }, [users]);

  const filteredContacts = useMemo(() => {
    const s = search.toLowerCase().trim();
    return users.filter(u => 
      u.name.toLowerCase().includes(s) || u.phone.includes(s)
    ).sort((a, b) => {
      const aOn = registeredPhones.has(a.phone) ? 0 : 1;
      const bOn = registeredPhones.has(b.phone) ? 0 : 1;
      return aOn - bOn || a.name.localeCompare(b.name);
    });
  }, [users, search, registeredPhones]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedPhone = formatPhoneDisplay(newPhone);
    if (!newName.trim() || !validatePhone(formattedPhone)) {
      alert("Please provide a valid name and phone number (e.g. +7 900 000 00 00)");
      return;
    }
    
    const newUser: User = {
      id: `u-${Date.now()}`,
      name: newName,
      phone: formattedPhone,
      avatar: `https://picsum.photos/seed/${newName}/200`,
      status: 'offline'
    };
    onAddContact(newUser);
    setShowAddModal(false);
    setNewName('');
    setNewPhone('');
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#121418] relative">
      <div className="p-4 space-y-4">
        <div className="relative group">
          <input 
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1c1f26] border border-white/5 rounded-xl py-3 pl-10 pr-10 text-sm focus:ring-2 focus:ring-blue-500/30 text-zinc-200 outline-none"
          />
          <svg className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          {isSyncing && (
            <div className="absolute right-3 top-3.5">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
        <div className="px-2 mb-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center p-3 rounded-2xl hover:bg-blue-600/10 text-blue-500 transition-all border border-dashed border-white/5"
          >
            <div className="w-11 h-11 rounded-2xl bg-blue-600/20 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <div className="ml-4 text-left">
              <h4 className="font-bold text-sm">New Contact</h4>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Add to Address Book</p>
            </div>
          </button>
        </div>

        <div className="px-4 py-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex justify-between items-center border-t border-white/5 mb-1">
          <span>Contacts on Zylos</span>
        </div>

        {filteredContacts.map((user) => {
          const isOnZylos = registeredPhones.has(user.phone);
          return (
            <div key={user.id} className="w-full flex items-center p-3 rounded-2xl mb-1 hover:bg-white/5 transition-all text-zinc-400 group relative">
              <div className="relative flex-shrink-0">
                <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-2xl object-cover shadow-md" />
                {isOnZylos && user.status === 'online' && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-[#121418] rounded-full" />
                )}
              </div>
              <div className="ml-4 flex-1 text-left min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="font-semibold text-zinc-200 truncate">{user.name}</h4>
                  {isOnZylos && (
                    <span className="bg-blue-600/10 text-blue-500 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">On Zylos</span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 truncate">{user.phone}</p>
              </div>
              <div>
                {isOnZylos ? (
                  <button onClick={() => onStartChat(user)} className="p-2 bg-blue-600/10 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></button>
                ) : (
                  <button className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 py-1.5 border border-white/5 rounded-xl hover:bg-white/5 transition-all">Invite</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="absolute inset-0 z-[110] bg-[#121418] p-6 animate-in slide-in-from-bottom duration-300">
           <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-white">Add Contact</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[10px] font-black uppercase text-zinc-500">Cancel</button>
           </div>
           <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Full Name</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-[#1c1f26] rounded-xl py-4 px-4 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Phone Number (+...)</label>
                <input 
                  type="tel" 
                  value={newPhone} 
                  placeholder="+7 999 123 4567"
                  onChange={e => setNewPhone(formatPhoneDisplay(e.target.value))}
                  className="w-full bg-[#1c1f26] rounded-xl py-4 px-4 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                  required
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/40">Check Registry</button>
           </form>
        </div>
      )}
    </div>
  );
};

export default ContactList;
