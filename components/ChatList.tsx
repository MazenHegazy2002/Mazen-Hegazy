
import React, { useState, useRef, useEffect } from 'react';
import { Chat, MessageType } from '../types';
import { decrypt } from '../services/encryptionService';

interface ChatListProps {
  chats: Chat[];
  onSelectChat: (chat) => void;
  onAddChat: () => void;
  selectedChatId?: string;
  onMuteChat: (id: string) => void;
  onArchiveChat: (id: string) => void;
  onBulkMute?: (ids: string[]) => void;
  onBulkArchive?: (ids: string[]) => void;
}

const ChatList: React.FC<ChatListProps> = ({ 
  chats, 
  onSelectChat, 
  onAddChat, 
  selectedChatId, 
  onMuteChat, 
  onArchiveChat,
  onBulkMute,
  onBulkArchive
}) => {
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState<'All' | 'Personal' | 'Groups' | 'Unread' | 'Archived'>('All');
  const [previewChat, setPreviewChat] = useState<Chat | null>(null);
  const [swipedChatId, setSwipedChatId] = useState<string | null>(null);
  
  // Selection State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const timerRef = useRef<number | null>(null);
  const touchStartRef = useRef<number | null>(null);
  const touchYStartRef = useRef<number | null>(null);

  const folders: (typeof activeFolder)[] = ['All', 'Personal', 'Groups', 'Unread', 'Archived'];

  const filteredChats = chats.filter(c => {
    const nameMatch = (c.name || c.participants[0].name).toLowerCase().includes(search.toLowerCase());
    if (!nameMatch) return false;
    
    if (activeFolder !== 'Archived' && c.isArchived) return false;
    if (activeFolder === 'Archived' && !c.isArchived) return false;

    if (activeFolder === 'All') return true;
    if (activeFolder === 'Personal') return !c.isGroup;
    if (activeFolder === 'Groups') return c.isGroup;
    if (activeFolder === 'Unread') return c.unreadCount > 0;
    return true;
  });

  const toggleSelection = (chatId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(chatId)) {
      newSelected.delete(chatId);
      if (newSelected.size === 0) setSelectionMode(false);
    } else {
      newSelected.add(chatId);
    }
    setSelectedIds(newSelected);
  };

  const handleHoldStart = (chat: Chat) => {
    timerRef.current = window.setTimeout(() => {
      if (!selectionMode) {
        setSelectionMode(true);
        setSelectedIds(new Set([chat.id]));
        setSwipedChatId(null);
        if (navigator.vibrate) navigator.vibrate(50);
      } else {
        setPreviewChat(chat);
      }
    }, 600);
  };

  const handleHoldEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent, chatId: string) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchStartRef.current = clientX;
    touchYStartRef.current = clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent, chatId: string) => {
    if (touchStartRef.current === null || touchYStartRef.current === null) return;
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
    
    const diffX = touchStartRef.current - clientX;
    const diffY = Math.abs(touchYStartRef.current - clientY);

    if (diffX > 80 && diffY < 50) {
      setSwipedChatId(chatId);
    } else if (diffX < -80 && diffY < 50) {
      setSwipedChatId(null);
    }
    
    touchStartRef.current = null;
    touchYStartRef.current = null;
  };

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const performBulkAction = (action: 'mute' | 'archive') => {
    const ids = Array.from(selectedIds);
    if (action === 'mute' && onBulkMute) onBulkMute(ids);
    if (action === 'archive' && onBulkArchive) onBulkArchive(ids);
    clearSelection();
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#121418] relative" onClick={() => !selectionMode && setSwipedChatId(null)}>
      {/* Header */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between min-h-[40px]">
          {selectionMode ? (
            <div className="flex items-center justify-between w-full animate-in slide-in-from-top-4 duration-200">
              <div className="flex items-center space-x-4">
                <button onClick={clearSelection} className="p-2 text-zinc-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></button>
                <span className="text-lg font-bold text-white">{selectedIds.size} Selected</span>
              </div>
              <div className="flex items-center space-x-1">
                <button onClick={() => performBulkAction('mute')} className="p-2.5 text-orange-500 hover:bg-orange-500/10 rounded-xl" title="Mute Selected">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                </button>
                <button onClick={() => performBulkAction('archive')} className="p-2.5 text-zinc-400 hover:bg-white/5 rounded-xl" title="Archive Selected">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white tracking-tight">Zylos</h1>
              <div className="flex space-x-2">
                <button 
                  onClick={onAddChat}
                  className="p-2 hover:bg-white/5 rounded-xl text-blue-500 transition-all hover:scale-110 active:scale-95"
                  title="New Message"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="relative group">
          <input 
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1c1f26] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-blue-500/50 text-zinc-200 placeholder-zinc-500 outline-none transition-all"
          />
          <svg className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      {!selectionMode && (
        <div className="flex px-4 border-b border-white/5 space-x-6 overflow-x-auto no-scrollbar">
          {folders.map(folder => (
            <button 
              key={folder}
              onClick={() => { setActiveFolder(folder); setSwipedChatId(null); }}
              className={`pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative whitespace-nowrap ${activeFolder === folder ? 'text-blue-500' : 'text-zinc-500'}`}
            >
              {folder}
              {activeFolder === folder && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
            </button>
          ))}
        </div>
      )}

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-24 pt-2">
        {filteredChats.map((chat) => {
          const recipient = chat.participants[0];
          const isSelectedItem = selectedIds.has(chat.id);
          const isSelectedForChat = selectedChatId === chat.id;
          const isSwiped = swipedChatId === chat.id;
          const displayName = chat.isGroup ? chat.name : recipient.name;
          const displayAvatar = chat.isGroup ? chat.avatar : recipient.avatar;
          
          const lastMsgContent = chat.lastMessage ? (
            chat.lastMessage.type === MessageType.VOICE 
              ? '🎤 Voice note' 
              : (chat.lastMessage.isEncrypted 
                  ? decrypt(chat.lastMessage.content, chat.id) 
                  : chat.lastMessage.content)
          ) : '';

          return (
            <div 
              key={chat.id} 
              className="relative overflow-hidden mb-1 rounded-2xl group/item"
              onMouseDown={(e) => { handleHoldStart(chat); handleTouchStart(e, chat.id); }}
              onMouseUp={(e) => { handleHoldEnd(); handleTouchEnd(e, chat.id); }}
              onMouseLeave={handleHoldEnd}
              onTouchStart={(e) => { handleHoldStart(chat); handleTouchStart(e, chat.id); }}
              onTouchEnd={(e) => { handleHoldEnd(); handleTouchEnd(e, chat.id); }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`absolute inset-0 flex justify-end transition-opacity duration-200 ${isSwiped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                 <button 
                  onClick={(e) => { e.stopPropagation(); onMuteChat(chat.id); setSwipedChatId(null); }}
                  className="w-20 bg-orange-600 flex flex-col items-center justify-center text-white space-y-1 transition-colors hover:bg-orange-700"
                 >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                    <span className="text-[10px] font-bold uppercase">{chat.isMuted ? 'Unmute' : 'Mute'}</span>
                 </button>
                 <button 
                  onClick={(e) => { e.stopPropagation(); onArchiveChat(chat.id); setSwipedChatId(null); }}
                  className="w-20 bg-zinc-700 flex flex-col items-center justify-center text-white space-y-1 transition-colors hover:bg-zinc-600"
                 >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                    <span className="text-[10px] font-bold uppercase">{chat.isArchived ? 'Unarchive' : 'Archive'}</span>
                 </button>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); selectionMode ? toggleSelection(chat.id) : onSelectChat(chat); }}
                className={`w-full flex items-center p-3 rounded-2xl relative transition-all duration-300 z-10 ${isSelectedItem ? 'bg-blue-600/20 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]' : (isSelectedForChat && !selectionMode ? 'bg-blue-600/10 text-white shadow-inner shadow-blue-500/5' : 'bg-[#121418] hover:bg-white/5 text-zinc-400')}`}
                style={{ transform: isSwiped && !selectionMode ? 'translateX(-160px)' : 'translateX(0px)' }}
              >
                {selectionMode && (
                  <div className="mr-3 animate-in zoom-in duration-200">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelectedItem ? 'bg-blue-500 border-blue-500' : 'border-zinc-700'}`}>
                      {isSelectedItem && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                )}

                <div className="relative flex-shrink-0">
                  <img src={displayAvatar} alt={displayName} className="w-12 h-12 rounded-2xl object-cover shadow-lg" />
                  {!chat.isGroup && recipient.status === 'online' && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-[#121418] rounded-full" />
                  )}
                  {chat.isGroup && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[#121418] shadow-md">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                  )}
                </div>
                <div className="ml-4 flex-1 text-left min-w-0">
                  <div className="flex justify-between items-baseline">
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className={`font-semibold truncate ${isSelectedForChat && !selectionMode ? 'text-white' : 'text-zinc-200'}`}>{displayName}</span>
                      {/* Fixed SVG title error by using a span wrapper with title attribute instead of placing it on the SVG itself */}
                      <span title="End-to-End Encrypted" className="flex items-center">
                        <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </span>
                      {chat.isMuted && (
                        <svg className="w-3 h-3 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-medium ml-2 flex-shrink-0">{chat.lastMessage?.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <p className="text-xs truncate max-w-[180px] opacity-70">
                      {lastMsgContent}
                    </p>
                    {chat.unreadCount > 0 && (
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-lg animate-in zoom-in-0 ${chat.isMuted ? 'bg-zinc-700 text-zinc-400' : 'bg-blue-600 text-white shadow-blue-900/40'}`}>
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Preview Portal */}
      {previewChat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPreviewChat(null)}>
          <div className="w-full max-w-sm bg-[#1c1f26] rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
            <div className="bg-[#2a2d36] p-4 flex items-center space-x-3">
              <img src={previewChat.isGroup ? previewChat.avatar : previewChat.participants[0].avatar} className="w-10 h-10 rounded-xl object-cover" />
              <div>
                <h3 className="text-sm font-bold text-white">{previewChat.isGroup ? previewChat.name : previewChat.participants[0].name}</h3>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Quick Preview</p>
              </div>
            </div>
            <div className="p-4 space-y-3 min-h-[200px] flex flex-col justify-end">
              <div className="bg-white/5 p-4 rounded-3xl rounded-bl-none max-w-[85%] text-sm text-zinc-300 shadow-xl">
                 <div className="flex items-center space-x-1.5 mb-1 text-[10px] font-bold text-green-500 uppercase tracking-widest">
                   <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                   <span>Encrypted Preview</span>
                 </div>
                 {previewChat.lastMessage && decrypt(previewChat.lastMessage.content, previewChat.id)}
              </div>
              <p className="text-center text-[10px] text-zinc-600 uppercase font-bold tracking-widest py-4">Release to close</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatList;
