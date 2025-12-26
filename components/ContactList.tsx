
import React, { useState, useMemo } from 'react';
import { User } from '../types';

interface ContactListProps {
  users: User[];
  onStartChat: (user: User) => void;
  onAddContact: (user: User) => void;
}

const ContactList: React.FC<ContactListProps> = ({ users, onStartChat, onAddContact }) => {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const filteredContacts = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    if (!normalizedSearch) return users;

    const searchDigits = normalizedSearch.replace(/\D/g, '');

    return users.filter(u => {
      const nameMatch = u.name.toLowerCase().includes(normalizedSearch);
      const phoneDigits = u.phone.replace(/\D/g, '');
      const phoneMatch = searchDigits 
        ? phoneDigits.includes(searchDigits) 
        : u.phone.toLowerCase().includes(normalizedSearch);

      return nameMatch || phoneMatch;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const newUser: User = {
      id: `u-${Date.now()}`,
      name: newName,
      phone: newPhone,
      avatar: `https://picsum.photos/seed/${newName}/200`,
      status: 'offline'
    };

    onAddContact(newUser);
    setNewName('');
    setNewPhone('');
    setShowAddModal(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#121418] relative">
      <div className="p-4 space-y-4">
        <div className="relative group">
          <input 
            type="text"
            placeholder="Search by name or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1c1f26] border border-white/5 rounded-xl py-3 pl-10 pr-10 text-sm focus:ring-2 focus:ring-blue-500/30 text-zinc-200 placeholder-zinc-500 outline-none transition-all"
          />
          <svg className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
        {!search && (
          <div className="px-2 mb-4">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full flex items-center p-3 rounded-2xl hover:bg-blue-600/10 text-blue-500 transition-all group border border-dashed border-white/5 hover:border-blue-500/30"
            >
              <div className="w-11 h-11 rounded-2xl bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg shadow-blue-900/10">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
              <div className="ml-4 text-left">
                <h4 className="font-bold text-sm">New Contact</h4>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Invite your friends</p>
              </div>
            </button>
          </div>
        )}

        <div className="px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex justify-between items-center border-t border-white/5 mt-2 mb-1">
          <span>Contacts List</span>
        </div>

        {filteredContacts.length > 0 ? (
          filteredContacts.map((user) => (
            <button
              key={user.id}
              onClick={() => onStartChat(user)}
              className="w-full flex items-center p-3 rounded-2xl mb-1 hover:bg-white/5 transition-all text-zinc-400 group relative"
            >
              <div className="relative flex-shrink-0">
                <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-2xl object-cover group-hover:scale-105 transition-transform shadow-md" />
                {user.status === 'online' && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-[#121418] rounded-full" />
                )}
              </div>
              <div className="ml-4 flex-1 text-left min-w-0">
                <h4 className="font-semibold text-zinc-200 group-hover:text-blue-400 transition-colors truncate">{user.name}</h4>
                <p className="text-[11px] text-zinc-500 truncate">{user.phone}</p>
              </div>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <h3 className="text-zinc-400 text-sm">No results found</h3>
          </div>
        )}
      </div>

      {/* Internal Add Modal */}
      {showAddModal && (
        <div className="absolute inset-0 z-[110] bg-[#121418] p-6 animate-in slide-in-from-bottom duration-300">
           <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-white">New Contact</h2>
              <button onClick={() => setShowAddModal(false)} className="text-blue-500 font-bold">Cancel</button>
           </div>
           <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Name</label>
                <input 
                  type="text"
                  placeholder="John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#1c1f26] rounded-xl py-4 px-4 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Phone</label>
                <input 
                  type="tel"
                  placeholder="+7 ..."
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-[#1c1f26] rounded-xl py-4 px-4 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                  required
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg">Create Contact</button>
           </form>
        </div>
      )}
    </div>
  );
};

export default ContactList;
