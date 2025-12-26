
import React from 'react';
import { User } from '../types';

interface StatusSectionProps {
  users: User[];
}

const StatusSection: React.FC<StatusSectionProps> = ({ users }) => {
  return (
    <div className="flex items-center space-x-4 p-4 overflow-x-auto no-scrollbar bg-[#16191e] border-b border-white/5">
      {/* My Status */}
      <div className="flex flex-col items-center flex-shrink-0 cursor-pointer">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-2 border-zinc-700 p-0.5">
            <img src="https://picsum.photos/seed/me/200" alt="Me" className="w-full h-full rounded-full object-cover grayscale" />
          </div>
          <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full border-2 border-[#16191e] p-0.5">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </div>
        </div>
        <span className="text-[11px] mt-1 text-zinc-400">My Status</span>
      </div>

      {/* Others */}
      {users.map((user, idx) => (
        <div key={user.id} className="flex flex-col items-center flex-shrink-0 cursor-pointer group">
          <div className={`w-14 h-14 rounded-full p-0.5 border-2 ${idx % 2 === 0 ? 'border-blue-500' : 'border-zinc-700'}`}>
            <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover group-hover:scale-105 transition-transform" />
          </div>
          <span className="text-[11px] mt-1 text-zinc-300 truncate w-14 text-center">{user.name.split(' ')[0]}</span>
        </div>
      ))}
    </div>
  );
};

export default StatusSection;
