'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Phone, Mail, CreditCard, User as UserIcon } from 'lucide-react';
import Image from 'next/image';
import WhatsAppButton from './WhatsAppButton';
import { cn, guessGenderFromName, isValidMatchValue } from '@/lib/utils';
import { Client } from '@/types';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAppState } from '@/lib/context';

export const THEME_COLORS = [
  { name: 'Soft Orange', bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-500', accent: 'bg-orange-500', avatarBg: '#f97316', infoBg: 'bg-[#fdf0e1]', infoBorder: 'border-orange-100' },
  { name: 'Pink', bg: 'bg-pink-50', border: 'border-pink-500', text: 'text-pink-500', accent: 'bg-pink-500', avatarBg: '#ec4899', infoBg: 'bg-[#fdf0f4]', infoBorder: 'border-pink-100' },
  { name: 'Turquoise', bg: 'bg-cyan-50', border: 'border-cyan-500', text: 'text-cyan-500', accent: 'bg-cyan-500', avatarBg: '#06b6d4', infoBg: 'bg-[#eefcfc]', infoBorder: 'border-cyan-100' },
  { name: 'Purple', bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-500', accent: 'bg-purple-500', avatarBg: '#a855f7', infoBg: 'bg-[#f7f0fd]', infoBorder: 'border-purple-100' },
  { name: 'Green', bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-500', accent: 'bg-emerald-500', avatarBg: '#10b981', infoBg: 'bg-[#effdf5]', infoBorder: 'border-emerald-100' },
  { name: 'Blue', bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-500', accent: 'bg-blue-500', avatarBg: '#3b82f6', infoBg: 'bg-[#f0f4ff]', infoBorder: 'border-blue-100' },
  { name: 'Cyan', bg: 'bg-sky-50', border: 'border-sky-500', text: 'text-sky-500', accent: 'bg-sky-500', avatarBg: '#0ea5e9', infoBg: 'bg-[#f0f9ff]', infoBorder: 'border-sky-100' },
  { name: 'Deep Red', bg: 'bg-red-50', border: 'border-red-600', text: 'text-red-600', accent: 'bg-red-600', avatarBg: '#dc2626', infoBg: 'bg-[#fef2f2]', infoBorder: 'border-red-100' },
  { name: 'Warm Brown', bg: 'bg-orange-50', border: 'border-amber-800', text: 'text-amber-800', accent: 'bg-amber-800', avatarBg: '#92400e', infoBg: 'bg-[#fffbeb]', infoBorder: 'border-amber-200' },
  { name: 'Mustard Yellow', bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-600', accent: 'bg-yellow-500', avatarBg: '#eab308', infoBg: 'bg-[#fefce8]', infoBorder: 'border-yellow-200' },
  { name: 'Magenta', bg: 'bg-fuchsia-50', border: 'border-fuchsia-600', text: 'text-fuchsia-600', accent: 'bg-fuchsia-600', avatarBg: '#c026d3', infoBg: 'bg-[#fdf4ff]', infoBorder: 'border-fuchsia-100' },
  { name: 'Slate Gray', bg: 'bg-slate-50', border: 'border-slate-600', text: 'text-slate-600', accent: 'bg-slate-600', avatarBg: '#475569', infoBg: 'bg-[#f1f5f9]', infoBorder: 'border-slate-200' },
  { name: 'Indigo', bg: 'bg-indigo-50', border: 'border-indigo-600', text: 'text-indigo-600', accent: 'bg-indigo-600', avatarBg: '#4f46e5', infoBg: 'bg-[#eef2ff]', infoBorder: 'border-indigo-100' },
  { name: 'Lime', bg: 'bg-lime-50', border: 'border-lime-600', text: 'text-lime-600', accent: 'bg-lime-600', avatarBg: '#65a30d', infoBg: 'bg-[#f7fee7]', infoBorder: 'border-lime-100' },
  { name: 'Rose', bg: 'bg-rose-50', border: 'border-rose-500', text: 'text-rose-500', accent: 'bg-rose-500', avatarBg: '#f43f5e', infoBg: 'bg-[#fff1f2]', infoBorder: 'border-rose-100' },
  { name: 'Violet', bg: 'bg-violet-50', border: 'border-violet-600', text: 'text-violet-600', accent: 'bg-violet-600', avatarBg: '#7c3aed', infoBg: 'bg-[#f5f3ff]', infoBorder: 'border-violet-100' },
  { name: 'Teal', bg: 'bg-teal-50', border: 'border-teal-600', text: 'text-teal-600', accent: 'bg-teal-600', avatarBg: '#0d9488', infoBg: 'bg-[#f0fdfa]', infoBorder: 'border-teal-100' },
  { name: 'Amber', bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-500', accent: 'bg-amber-500', avatarBg: '#f59e0b', infoBg: 'bg-[#fffbeb]', infoBorder: 'border-amber-100' },
  { name: 'Stone', bg: 'bg-stone-50', border: 'border-stone-600', text: 'text-stone-600', accent: 'bg-stone-600', avatarBg: '#57534e', infoBg: 'bg-[#f5f5f4]', infoBorder: 'border-stone-200' }
];

interface ClientCardProps {
  client: Client;
  isDarkMode: boolean;
  index: number;
}

export default function ClientCard({ client, isDarkMode, index }: ClientCardProps) {
  const themeIndex = client.id 
    ? client.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) 
    : index;
    
  const theme = THEME_COLORS[themeIndex % THEME_COLORS.length];
  const gender = client.gender || guessGenderFromName(client.name);
  
  // FIXED: Constrain to number of files you actually have (4)
  const initialIndex = React.useMemo(() => {
    const seed = client.id || client.name || '';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const MAX_AVAILABLE_FILES = 4; 
    return (Math.abs(hash) % MAX_AVAILABLE_FILES) + 1;
  }, [client.id, client.name]);

  const [imgSrc, setImgSrc] = useState<string>('');
  
  // Initialize image source
  useEffect(() => {
    if (client.avatar) {
      let path = client.avatar;
      if (path.startsWith('public/')) path = path.replace('public/', '/');
      else if (!path.startsWith('/')) path = '/' + path;
      setImgSrc(path);
    } else {
      setImgSrc(`/avatars/${gender}/${gender}${initialIndex}.png`);
    }
  }, [client.avatar, gender, initialIndex]);

  // FIXED: Simplified error fallback
  const handleAvatarError = () => {
    setImgSrc(`https://ui-avatars.com/api/?name=${encodeURIComponent(client.name)}&background=transparent&color=${isDarkMode ? 'fff' : '000'}&size=128`);
  };

  const { userReservations } = useAppState();
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);

  const clientReservations = React.useMemo(() => {
    return userReservations.filter(res => {
      if (res.clientId === client.id) return true;
      const resPassport = (res.passportId || '').trim().toLowerCase();
      const resLicense = (res.driverLicenseId || '').trim().toLowerCase();
      const cPassport = (client.passportId || '').trim().toLowerCase();
      const cLicense = (client.licenseId || '').trim().toLowerCase();
      return resPassport && resLicense && resPassport === cPassport && resLicense === cLicense && isValidMatchValue(resPassport) && isValidMatchValue(resLicense);
    });
  }, [userReservations, client.id, client.passportId, client.licenseId]);

  const proposedPhone = React.useMemo(() => {
    const currentPhone = (client.phone || '').trim();
    const resWithDiffPhone = clientReservations.find(res => {
      const resPhone = (res.phone || '').trim();
      return resPhone && resPhone !== currentPhone;
    });
    return resWithDiffPhone ? (resWithDiffPhone.phone || '').trim() : null;
  }, [clientReservations, client.phone]);

  const handleUpdatePhone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!proposedPhone) return;
    setIsUpdatingPhone(true);
    try {
      const clientRef = doc(db, 'clients', client.id);
      await updateDoc(clientRef, { phone: proposedPhone, updatedAt: Date.now() });
    } catch (err) {
      console.error("Error updating client phone in firebase:", err);
      alert("Failed to update phone number in Firebase");
    } finally {
      setIsUpdatingPhone(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        "rounded-[32px] border-2 overflow-hidden flex flex-col transition-all hover:shadow-xl group relative",
        isDarkMode ? "bg-[#1A1614] border-white/5" : "bg-white",
        theme.border
      )}
    >
      {/* Header with Dynamic Avatar */}
      <div className={cn(
        "p-5 flex items-center gap-4 relative",
        !isDarkMode ? theme.bg : "bg-white/5"
      )}>
        <div 
          className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 border-2 border-black shadow-lg overflow-hidden relative transition-transform group-hover:scale-105"
          style={{ backgroundColor: theme.avatarBg }}
        >
          <Image 
            src={imgSrc || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name)}&background=transparent&color=${isDarkMode ? 'fff' : '000'}&size=128`} 
            alt={client.name}
            fill
            className="object-cover"
            style={imgSrc && imgSrc.includes('ui-avatars') ? {} : { marginTop: '3px', marginLeft: '0px' }}
            onError={handleAvatarError}
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "text-lg font-black uppercase underline tracking-tight truncate leading-tight",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            {client.name}
          </h3>
        </div>
      </div>

      {/* Unified Info Panel */}
      <div className="px-5 pb-3 mt-[10px]">
        <div className={cn(
          "rounded-2xl p-4 grid grid-cols-2 gap-4",
          isDarkMode ? "bg-white/5" : cn(theme.infoBg, "border", theme.infoBorder)
        )}>
          {/* Left Side: Contact */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm", theme.accent)}>
                <Phone className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[8px] font-black uppercase text-gray-400 tracking-wider leading-none mb-0.5">Phone</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <WhatsAppButton 
                    phone={client.phone} 
                    className="!text-[11px] !font-black !mt-0 !p-0 h-auto truncate"
                  />
                  {proposedPhone && (
                    <button
                      type="button"
                      onClick={handleUpdatePhone}
                      disabled={isUpdatingPhone}
                      title={`Update profile phone from reservation to: ${proposedPhone}`}
                      className="w-4 h-4 rounded-full bg-[#FF5C35] text-white hover:bg-[#FF5C35]/80 active:scale-95 flex items-center justify-center transition-all cursor-pointer shrink-0"
                    >
                      {isUpdatingPhone ? (
                        <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="text-[10px] font-black leading-none">+</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm", theme.accent)}>
                <Mail className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] font-black uppercase text-gray-400 tracking-wider leading-none mb-0.5">Email</span>
                <span className={cn("text-[11px] font-black truncate", isDarkMode ? "text-gray-300" : "text-gray-900")}>
                  {client.email}
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: IDs */}
          <div className="space-y-3 border-l border-black/5 dark:border-white/5 pl-4">
            <div className="flex items-center gap-2">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm", theme.accent)}>
                <CreditCard className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] font-black uppercase text-gray-400 tracking-wider leading-none mb-0.5">License</span>
                <span 
                  className={cn("text-[11px] font-bold truncate", isDarkMode ? "text-gray-300" : "text-gray-900")}
                  style={{ fontFamily: 'Verdana, sans-serif' }}
                >
                  {client.licenseId}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm", theme.accent)}>
                <UserIcon className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] font-black uppercase text-gray-400 tracking-wider leading-none mb-0.5">Passport</span>
                <span className={cn("text-[11px] font-bold truncate", isDarkMode ? "text-gray-300" : "text-gray-900")}>
                  {client.passportId}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section - Moved Up & Compacted */}
      <div className="px-5 pb-5 grid grid-cols-3 gap-3">
        <div className={cn(
          "rounded-xl p-3 text-center border-2",
          isDarkMode ? "bg-white/5 border-white/10" : cn(theme.bg, "border-black/5")
        )}>
          <p className="text-[12px] font-black uppercase tracking-widest leading-none mb-1 text-black dark:text-[#E27D60]/90">Rentals</p>
          <p className={cn("text-sm font-black", isDarkMode ? "text-white" : "text-gray-900")}>{client.rentalCount}</p>
        </div>
        
        <div className={cn(
          "rounded-xl p-3 text-center border-2",
          isDarkMode ? "bg-white/5 border-white/10" : cn(theme.bg, "border-black/5")
        )}>
          <p className="text-[12px] font-black uppercase tracking-widest leading-none mb-1 text-black dark:text-[#E27D60]/90">Days</p>
          <p className={cn("text-sm font-black", isDarkMode ? "text-white" : "text-gray-900")}>{client.totalDaysRented}</p>
        </div>
        
        <div className={cn(
          "rounded-xl p-3 text-center border-2",
          isDarkMode ? "bg-[#251E1C] border-none" : cn(theme.bg, "border-black/5")
        )}>
          <p className="text-[12px] font-black uppercase tracking-widest leading-none mb-1 text-black dark:text-[#E27D60]">Spent</p>
          <p className={cn("text-sm font-black text-black dark:text-[#E27D60]")}>€{client.totalSpent.toLocaleString()}</p>
        </div>
      </div>

      {/* Status Bar */}
      <div className={cn("h-2 w-full mt-auto", theme.accent)} />
    </motion.div>
  );
}