import React, { useState, useRef, useMemo } from 'react';
import { Chat, MessageType } from '../types';
import { decrypt } from '../services/encryptionService';

interface ChatListProps {
  chats: Chat[];
  onSelectChat: (chat: Chat) => void;
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
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const timerRef = useRef<any>(null);
  const touchStartRef = useRef<number | null>(null);
  const touchYStartRef = useRef<number | null>(null);

  const folders: (typeof activeFolder)[] = ['All', 'Personal', 'Groups', 'Unread', 'Archived'];

  const filteredChats = useMemo(() => {
    return chats.filter(c => {
      const chatName = c.name || (c.participants[0]?.name || 'Unknown');
      const nameMatch = chatName.toLowerCase().includes(search.toLowerCase());
      if (!nameMatch) return false;
      
      if (activeFolder !== 'Archived' && c.isArchived) return false;
      if (activeFolder === 'Archived' && !c.isArchived) return false;

      if (activeFolder === 'All') return true;
      if (activeFolder === 'Personal') return !c.isGroup;
      if (activeFolder === 'Groups') return c.isGroup;
      if (activeFolder === 'Unread') return c.unreadCount > 0;
      return true;
    });
  }, [chats, search, activeFolder]);

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
    timerRef.current = setTimeout(() => {
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
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    touchStartRef.current = clientX;
    touchYStartRef.current = clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent, chatId: string) => {
    if (touchStartRef.current === null || touchYStartRef.current === null) return;
    
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;
    
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

  const getMessagePreview = (chat: Chat) => {
    if (!chat.lastMessage) return '';
    if (chat.lastMessage.type === MessageType.VOICE) return '🎤 Voice note';
    if (chat.lastMessage.isEncrypted) return decrypt(chat.lastMessage.content, chat.id);
    return chat.lastMessage.content;
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#121418] relative" onClick={() => !selectionMode && setSwipedChatId(null)}>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between min-h-[40px]">
          {selectionMode ? (
            <div className="flex items-center justify-between w-full animate-in slide-in-from-top-4 duration-200">
              <div className="flex items-center space-x-4">
                <button onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }} className="p-2 text-zinc-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <span className="text-lg font-bold text-white">{selectedIds.size} Selected</span>
              </div>
              <div className="flex items-center space-x-1">
                <button onClick={() => { if(onBulkMute) onBulkMute(Array.from(selectedIds)); setSelectionMode(false); }} className="p-2.5 text-orange-500 hover:bg-orange-500/10 rounded-xl">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                </button>
                <button onClick={() => { if(onBulkArchive) onBulkArchive(Array.from(selectedIds)); setSelectionMode(false); }} className="p-2.5 text-zinc-400 hover:bg-white/5 rounded-xl">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <h1 className="text-xl font-bold text-white tracking-tight">Zylos</h1>
              <button onClick={onAddChat} className="p-2 hover:bg-white/5 rounded-xl text-blue-500 transition-all hover:scale-110">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
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
        <div className="flex px-4 border-b border-white/5 space-x-6 overflow-x-auto no-scrollbar shrink-0">
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

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-24 pt-2">
        {filteredChats.map((chat) => {
          const recipient = chat.participants[0] || { name: 'Unknown', avatar: '', status: 'offline' };
          const isSelectedItem = selectedIds.has(chat.id);
          const isSelectedForChat = selectedChatId === chat.id;
          const isSwiped = swipedChatId === chat.id;
          const displayName = chat.isGroup ? (chat.name || 'Group') : recipient.name;
          const displayAvatar = chat.isGroup ? (chat.avatar || 'https://picsum.photos/seed/group/200') : recipient.avatar;
          
          return (
            <div 
              key={chat.id} 
              className="relative overflow-hidden mb-1 rounded-2xl"
              onMouseDown={(e) => { handleHoldStart(chat); handleTouchStart(e); }}
              onMouseUp={(e) => { handleHoldEnd(); handleTouchEnd(e, chat.id); }}
              onMouseLeave={handleHoldEnd}
              onTouchStart={(e) => { handleHoldStart(chat); handleTouchStart(e); }}
              onTouchEnd={(e) => { handleHoldEnd(); handleTouchEnd(e, chat.id); }}
            >
              <div className={`absolute inset-0 flex justify-end z-0 transition-opacity ${isSwiped ? 'opacity-100' : 'opacity-0'}`}>
                 <button onClick={() => onMuteChat(chat.id)} className="w-20 bg-orange-600 flex flex-col items-center justify-center text-white"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg><span className="text-[10px] font-bold uppercase mt-1">Mute</span></button>
                 <button onClick={() => onArchiveChat(chat.id)} className="w-20 bg-zinc-700 flex flex-col items-center justify-center text-white"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg><span className="text-[10px] font-bold uppercase mt-1">Archive</span></button>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); selectionMode ? toggleSelection(chat.id) : onSelectChat(chat); }}
                className={`w-full flex items-center p-3 rounded-2xl relative transition-transform duration-300 z-10 ${isSelectedItem ? 'bg-blue-600/20' : (isSelectedForChat && !selectionMode ? 'bg-blue-600/10' : 'bg-[#121418] hover:bg-white/5')}`}
                style={{ transform: isSwiped && !selectionMode ? 'translateX(-160px)' : 'translateX(0px)' }}
              >
                {selectionMode && (
                  <div className="mr-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelectedItem ? 'bg-blue-500 border-blue-500' : 'border-zinc-700'}`}>
                      {isSelectedItem && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                )}
                <div className="relative flex-shrink-0">
                  <img src={displayAvatar} alt="" className="w-12 h-12 rounded-2xl object-cover" />
                  {!chat.isGroup && recipient.status === 'online' && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#121418] rounded-full" />}
                </div>
                <div className="ml-4 flex-1 text-left min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-zinc-200 truncate mr-2">{displayName}</span>
                    <span className="text-[10px] text-zinc-500 font-medium shrink-0">
                      {chat.lastMessage?.timestamp instanceof Date ? chat.lastMessage.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <p className="text-xs text-zinc-500 truncate mr-4">{getMessagePreview(chat)}</p>
                    {chat.unreadCount > 0 && <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{chat.unreadCount}</span>}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
      
      {previewChat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm" onClick={() => setPreviewChat(null)}>
          <div className="w-full max-w-sm bg-[#1c1f26] rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
            <div className="bg-[#2a2d36] p-4 flex items-center space-x-3">
              <img src={previewChat.isGroup ? (previewChat.avatar || '') : previewChat.participants[0]?.avatar} className="w-10 h-10 rounded-xl object-cover" />
              <h3 className="text-sm font-bold text-white truncate">{previewChat.isGroup ? previewChat.name : previewChat.participants[0]?.name}</h3>
            </div>
            <div className="p-4 space-y-3 min-h-[160px] flex flex-col justify-end">
              <div className="bg-white/5 p-4 rounded-3xl rounded-bl-none text-sm text-zinc-300">
                 {previewChat.lastMessage && getMessagePreview(previewChat)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatList;