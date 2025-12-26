
import React from 'react';
import { User, Chat, MessageType } from './types';

export const APP_VERSION = '1.0.0';

export interface Country {
  name: string;
  code: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { name: 'Afghanistan', code: '93', flag: '🇦🇫' },
  { name: 'Albania', code: '355', flag: '🇦🇱' },
  { name: 'Algeria', code: '213', flag: '🇩🇿' },
  { name: 'Andorra', code: '376', flag: '🇦🇩' },
  { name: 'Angola', code: '244', flag: '🇦🇴' },
  { name: 'Argentina', code: '54', flag: '🇦🇷' },
  { name: 'Armenia', code: '374', flag: '🇦🇲' },
  { name: 'Australia', code: '61', flag: '🇦🇺' },
  { name: 'Austria', code: '43', flag: '🇦🇹' },
  { name: 'Azerbaijan', code: '994', flag: '🇦🇿' },
  { name: 'Bahamas', code: '1-242', flag: '🇧🇸' },
  { name: 'Bahrain', code: '973', flag: '🇧🇭' },
  { name: 'Bangladesh', code: '880', flag: '🇧🇩' },
  { name: 'Belarus', code: '375', flag: '🇧🇾' },
  { name: 'Belgium', code: '32', flag: '🇧🇪' },
  { name: 'Bolivia', code: '591', flag: '🇧🇴' },
  { name: 'Bosnia and Herzegovina', code: '387', flag: '🇧🇦' },
  { name: 'Brazil', code: '55', flag: '🇧🇷' },
  { name: 'Bulgaria', code: '359', flag: '🇧🇬' },
  { name: 'Cambodia', code: '855', flag: '🇰🇭' },
  { name: 'Cameroon', code: '237', flag: '🇨🇲' },
  { name: 'Canada', code: '1', flag: '🇨🇦' },
  { name: 'Chile', code: '56', flag: '🇨🇱' },
  { name: 'China', code: '86', flag: '🇨🇳' },
  { name: 'Colombia', code: '57', flag: '🇨🇴' },
  { name: 'Costa Rica', code: '506', flag: '🇨🇷' },
  { name: 'Croatia', code: '385', flag: '🇭🇷' },
  { name: 'Cuba', code: '53', flag: '🇨🇺' },
  { name: 'Cyprus', code: '357', flag: '🇨🇾' },
  { name: 'Czech Republic', code: '420', flag: '🇨🇿' },
  { name: 'Denmark', code: '45', flag: '🇩🇰' },
  { name: 'Dominican Republic', code: '1-809', flag: '🇩🇴' },
  { name: 'Ecuador', code: '593', flag: '🇪🇨' },
  { name: 'Egypt', code: '20', flag: '🇪🇬' },
  { name: 'El Salvador', code: '503', flag: '🇸🇻' },
  { name: 'Estonia', code: '372', flag: '🇪🇪' },
  { name: 'Ethiopia', code: '251', flag: '🇪🇹' },
  { name: 'Finland', code: '358', flag: '🇫🇮' },
  { name: 'France', code: '33', flag: '🇫🇷' },
  { name: 'Georgia', code: '995', flag: '🇬🇪' },
  { name: 'Germany', code: '49', flag: '🇩🇪' },
  { name: 'Ghana', code: '233', flag: '🇬🇭' },
  { name: 'Greece', code: '30', flag: '🇬🇷' },
  { name: 'Guatemala', code: '502', flag: '🇬🇹' },
  { name: 'Honduras', code: '504', flag: '🇭🇳' },
  { name: 'Hong Kong', code: '852', flag: '🇭🇰' },
  { name: 'Hungary', code: '36', flag: '🇭🇺' },
  { name: 'Iceland', code: '354', flag: '🇮🇸' },
  { name: 'India', code: '91', flag: '🇮🇳' },
  { name: 'Indonesia', code: '62', flag: '🇮🇩' },
  { name: 'Iran', code: '98', flag: '🇮🇷' },
  { name: 'Iraq', code: '964', flag: '🇮🇶' },
  { name: 'Ireland', code: '353', flag: '🇮🇪' },
  { name: 'Israel', code: '972', flag: '🇮🇱' },
  { name: 'Italy', code: '39', flag: '🇮🇹' },
  { name: 'Jamaica', code: '1-876', flag: '🇯🇲' },
  { name: 'Japan', code: '81', flag: '🇯🇵' },
  { name: 'Jordan', code: '962', flag: '🇯🇴' },
  { name: 'Kazakhstan', code: '7', flag: '🇰🇿' },
  { name: 'Kenya', code: '254', flag: '🇰🇪' },
  { name: 'Kuwait', code: '965', flag: '🇰🇼' },
  { name: 'Kyrgyzstan', code: '996', flag: '🇰🇬' },
  { name: 'Latvia', code: '371', flag: '🇱🇻' },
  { name: 'Lebanon', code: '961', flag: '🇱🇧' },
  { name: 'Libya', code: '218', flag: '🇱🇾' },
  { name: 'Lithuania', code: '370', flag: '🇱🇹' },
  { name: 'Luxembourg', code: '352', flag: '🇱🇺' },
  { name: 'Malaysia', code: '60', flag: '🇲🇾' },
  { name: 'Malta', code: '356', flag: '🇲🇹' },
  { name: 'Mexico', code: '52', flag: '🇲🇽' },
  { name: 'Moldova', code: '373', flag: '🇲🇩' },
  { name: 'Monaco', code: '377', flag: '🇲🇨' },
  { name: 'Mongolia', code: '976', flag: '🇲🇳' },
  { name: 'Montenegro', code: '382', flag: '🇲🇪' },
  { name: 'Morocco', code: '212', flag: '🇲🇦' },
  { name: 'Myanmar', code: '95', flag: '🇲🇲' },
  { name: 'Nepal', code: '977', flag: '🇳🇵' },
  { name: 'Netherlands', code: '31', flag: '🇳🇱' },
  { name: 'New Zealand', code: '64', flag: '🇳🇿' },
  { name: 'Nigeria', code: '234', flag: '🇳🇬' },
  { name: 'Norway', code: '47', flag: '🇳🇴' },
  { name: 'Oman', code: '968', flag: '🇴🇲' },
  { name: 'Pakistan', code: '92', flag: '🇵🇰' },
  { name: 'Panama', code: '507', flag: '🇵🇦' },
  { name: 'Paraguay', code: '595', flag: '🇵🇾' },
  { name: 'Peru', code: '51', flag: '🇵🇪' },
  { name: 'Philippines', code: '63', flag: '🇵🇭' },
  { name: 'Poland', code: '48', flag: '🇵🇱' },
  { name: 'Portugal', code: '351', flag: '🇵🇹' },
  { name: 'Qatar', code: '974', flag: '🇶🇦' },
  { name: 'Romania', code: '40', flag: '🇷🇴' },
  { name: 'Russia', code: '7', flag: '🇷🇺' },
  { name: 'Saudi Arabia', code: '966', flag: '🇸🇦' },
  { name: 'Serbia', code: '381', flag: '🇷🇸' },
  { name: 'Singapore', code: '65', flag: '🇸🇬' },
  { name: 'Slovakia', code: '421', flag: '🇸🇰' },
  { name: 'Slovenia', code: '386', flag: '🇸🇮' },
  { name: 'South Africa', code: '27', flag: '🇿🇦' },
  { name: 'South Korea', code: '82', flag: '🇰🇷' },
  { name: 'Spain', code: '34', flag: '🇪🇸' },
  { name: 'Sri Lanka', code: '94', flag: '🇱🇰' },
  { name: 'Sweden', code: '46', flag: '🇸🇪' },
  { name: 'Switzerland', code: '41', flag: '🇨🇭' },
  { name: 'Taiwan', code: '886', flag: '🇹🇼' },
  { name: 'Thailand', code: '66', flag: '🇹🇭' },
  { name: 'Tunisia', code: '216', flag: '🇹🇳' },
  { name: 'Turkey', code: '90', flag: '🇹🇷' },
  { name: 'Ukraine', code: '380', flag: '🇺🇦' },
  { name: 'United Arab Emirates', code: '971', flag: '🇦🇪' },
  { name: 'United Kingdom', code: '44', flag: '🇬🇧' },
  { name: 'United States', code: '1', flag: '🇺🇸' },
  { name: 'Uruguay', code: '598', flag: '🇺🇾' },
  { name: 'Uzbekistan', code: '998', flag: '🇺🇿' },
  { name: 'Venezuela', code: '58', flag: '🇻🇪' },
  { name: 'Vietnam', code: '84', flag: '🇻🇳' },
];

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Alex Volkov', phone: '+7 900 123 4567', avatar: 'https://picsum.photos/seed/alex/200', status: 'online' },
  { id: '2', name: 'Maria Ivanova', phone: '+7 900 765 4321', avatar: 'https://picsum.photos/seed/maria/200', status: 'last seen recently' },
  { id: '3', name: 'Elena Petrova', phone: '+7 911 555 0101', avatar: 'https://picsum.photos/seed/elena/200', status: 'online' },
  { id: '4', name: 'Dmitry Sokolov', phone: '+7 905 888 2211', avatar: 'https://picsum.photos/seed/dmitry/200', status: 'offline' },
];

export const MOCK_CHATS: Chat[] = [
  {
    id: 'c1',
    participants: [MOCK_USERS[0]],
    unreadCount: 2,
    lastMessage: {
      id: 'm1',
      senderId: '1',
      content: 'Can you check the latest report?',
      type: MessageType.TEXT,
      timestamp: new Date()
    }
  },
  {
    id: 'c2',
    participants: [MOCK_USERS[1]],
    unreadCount: 0,
    lastMessage: {
      id: 'm2',
      senderId: '2',
      content: 'voice_note_placeholder',
      type: MessageType.VOICE,
      timestamp: new Date(Date.now() - 3600000),
      duration: 15
    }
  }
];

export const STICKERS = [
  '🚀', '🔥', '✨', '💎', '🎉', '🎸', '🕹️', '🎨', '🍕', '🐱', '🦄', '🌈'
];

export const REACTIONS = ['❤️', '👍', '🔥', '😂', '😮', '😢', '🙏'];
