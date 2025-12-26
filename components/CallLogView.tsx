
import React from 'react';
import { CallLog } from '../types';

interface CallLogViewProps {
  logs: CallLog[];
  onCallUser: (user: any, type: 'voice' | 'video') => void;
}

const CallLogView: React.FC<CallLogViewProps> = ({ logs, onCallUser }) => {
  return (
    <div className="h-full bg-[#121418] flex flex-col animate-in slide-in-from-right-4 duration-300">
      <div className="p-6 border-b border-white/5 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Calls</h1>
        <button className="text-blue-500 p-2 hover:bg-white/5 rounded-xl transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            <p className="font-medium">No recent calls</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-center p-3 rounded-2xl hover:bg-white/5 transition-all group">
              <div className="relative">
                <img src={log.user.avatar} className="w-12 h-12 rounded-2xl object-cover" alt={log.user.name} />
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#121418] ${log.direction === 'missed' ? 'bg-red-500' : 'bg-green-500'}`}>
                   {log.type === 'video' ? (
                     <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                   ) : (
                     <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                   )}
                </div>
              </div>
              <div className="ml-4 flex-1 text-left min-w-0">
                <h4 className={`font-semibold truncate ${log.direction === 'missed' ? 'text-red-400' : 'text-zinc-200'}`}>{log.user.name}</h4>
                <div className="flex items-center space-x-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${log.direction === 'missed' ? 'text-red-500/70' : 'text-zinc-500'}`}>
                    {log.direction} • {log.timestamp.toLocaleDateString()} {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => onCallUser(log.user, log.type)}
                  className="p-3 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {log.type === 'video' ? (
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    ) : (
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CallLogView;
