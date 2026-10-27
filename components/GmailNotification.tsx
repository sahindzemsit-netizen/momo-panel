'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Bell, Mail, X, Check, Loader2, Euro } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, limit, Timestamp } from 'firebase/firestore';
import { useAppState } from '@/lib/context';
import { cn } from '@/lib/utils';

interface Email {
  id: string;
  subject: string;
  date: string;
  from: string;
  snippet: string;
  body?: string;
  isRead?: boolean;
}

interface Car {
  id: string;
  name: string;
  plate: string;
}

export default function GmailNotification({ isDarkMode = true }: { isDarkMode?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Tab visibility checking
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  const [firestoreEmails, setFirestoreEmails] = useState<Email[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Auto-clean: All Slack dispatch states and integrations have been removed

  // Load read status from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('read_notifications');
    if (saved) {
      try {
        setReadIds(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error("Error loading read status:", e);
      }
    }
  }, []);

  const markAsRead = (id: string) => {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    localStorage.setItem('read_notifications', JSON.stringify(Array.from(next)));
  };

  const { user, isAdmin } = useAppState();

  // Firestore real-time listener
  useEffect(() => {
    if (!isTabVisible || !user || !isAdmin) return;
    // We want subjects that contain or are equal to 'safe city' or 'DenizBank'
    // Note: Firestore 'in' query works on exact matches. 
    // If the requirement is for exact match, we use 'where'. 
    // If it's a prefix, it's more complex, but usually, users want exact or close enough.
    // I'll set up two separate listeners if needed or a combined one if subjects are exact.
    
    // Using a simpler query with a limit of 50 to ensure we load recent notifications safely
    const q = query(
      collection(db, 'notifications'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map(doc => {
          const data = doc.data();
          const body = data.body || data.snippet || '';
          
          // Improved date detection - checks common fields from scripts
          const dateValue = data.timestamp || data.date || data.createdAt;
          let dateStr = new Date().toISOString();

          try {
            if (dateValue instanceof Timestamp) {
              dateStr = dateValue.toDate().toISOString();
            } else if (dateValue && typeof dateValue === 'object' && 'seconds' in dateValue) {
              dateStr = new Date(dateValue.seconds * 1000).toISOString();
            } else if (typeof dateValue === 'string') {
              // Check if it's a valid date string
              const d = new Date(dateValue);
              if (!isNaN(d.getTime())) dateStr = d.toISOString();
            } else if (typeof dateValue === 'number') {
              // Handle timestamp numbers
              const d = new Date(dateValue);
              if (!isNaN(d.getTime())) dateStr = d.toISOString();
            }
          } catch (e) {
            console.error("Error parsing date:", e);
          }
          
          return {
            id: doc.id,
            subject: data.subject || 'No Subject',
            date: dateStr,
            from: data.from || 'Automated System',
            snippet: data.snippet || (body ? body.substring(0, 150) + '...' : 'System notification received.'),
            body: body,
          } as Email;
        });
      
      // Filter for radar scan / safe city / DenizBank messages only (matching ViolationsPanel's sync logic)
      const safeCityEmails = docs.filter(email => {
        const sub = email.subject.toLowerCase();
        const fromMail = email.from.toLowerCase();
        return sub.includes('safe city') || sub.includes('radar') || sub.includes('mvr') || fromMail.includes('sc.mvr.gov.mk') || sub.includes('denizbank');
      });

      // Sort client-side by date to handle different field names safely
      const sortedDocs = safeCityEmails.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setFirestoreEmails(sortedDocs);
    }, (err) => {
      console.error("Firestore Notifications Error:", err);
      setError("Could not load notifications. Please check your connection.");
    });

    return () => unsubscribe();
  }, [isTabVisible, user, isAdmin]);

  // Combine emails for display
  const allEmails = [...firestoreEmails].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ).slice(0, 15);

  const unreadCount = allEmails.filter(e => !readIds.has(e.id)).length;

  const handleOpen = () => {
    setIsOpen(true);
    setError(null);
  };

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
    markAsRead(email.id);
  };

  const renderTextWithLinks = (text: string) => {
    if (!text) return text;
    
    // Improved regex to find URLs (including www.) while handling potential wrapping characters like < > 
    // and avoiding trailing punctuation
    const urlRegex = /((?:https?:\/\/|www\.)[^\s<>(){}]+[^\s<>(){}.!,:;?])/g;
    
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        const href = part.startsWith('http') ? part : `https://${part}`;
        return (
          <a 
            key={i} 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#FF5C35] hover:underline break-all font-bold"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 group relative",
          isDarkMode ? "bg-white/10 text-gray-300 hover:bg-white/20" : "bg-black/5 text-gray-600 hover:bg-black/10"
        )}
        title="View Team Mail"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 bg-[#FF5C35] rounded-full border border-white flex items-center justify-center text-[8px] font-black text-white shadow-sm ring-1 ring-[#FF5C35]/20 animate-in zoom-in duration-300">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border",
                isDarkMode ? "bg-[#1A1614] border-white/10" : "bg-white border-black/5"
              )}
            >
              {/* Header */}
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                    <Image src="/police.png" alt="Police Icon" width={28} height={28} className="shrink-0" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={cn("font-bold text-lg leading-tight", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>MVR API МONITOR / SAFE CITY</h3>
                    </div>
                    <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase opacity-70">Last 10</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Content */}
               <div className={cn(
                "max-h-[70vh] overflow-y-auto p-4 flex flex-col gap-4",
                isDarkMode ? "custom-scrollbar-dark" : "custom-scrollbar"
              )}>
                {allEmails.length > 0 ? (
                  allEmails.map((email) => {
                    const isRead = readIds.has(email.id);
                    return (
                      <EmailListItem
                        key={email.id}
                        email={email}
                        isDarkMode={isDarkMode}
                        isRead={isRead}
                        handleSelectEmail={handleSelectEmail}
                        renderTextWithLinks={renderTextWithLinks}
                      />
                    );
                  })
                ) : (
                  <div className="py-20 text-center opacity-50">
                    <Mail className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">No new notifications found.</p>
                  </div>
                )}
                {/* Spacer at bottom to ensure last item visibility */}
                <div className="h-2 shrink-0" />
                {error && (
                  <p className="text-xs text-red-500 text-center py-2">{error}</p>
                )}
              </div>

              {/* Email Detail Panel */}
              <AnimatePresence>
                {selectedEmail && (
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className={cn(
                      "absolute inset-0 z-50 flex flex-col",
                      isDarkMode ? "bg-[#1A1614]" : "bg-white"
                    )}
                  >
                    <div className="p-5 border-b border-white/5 flex items-center gap-4">
                      <button 
                        onClick={() => setSelectedEmail(null)}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className={cn("font-bold text-sm truncate", isDarkMode ? "text-white" : "text-black")}>
                          {selectedEmail.subject}
                        </h3>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-[#FF5C35] font-bold uppercase tracking-widest leading-none">
                            {selectedEmail.from.split('<')[0].replace(/"/g, '')}
                          </p>
                          {selectedEmail.from.toLowerCase().includes('noreply@sc.mvr.gov.mk') && (
                            <Image src="/camera.png" alt="Camera" width={30} height={30} className="shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest opacity-60">Message Detail</span>
                        <span className="text-[9px] bg-[#FF5C35] text-white px-3 py-1 rounded-full font-black shadow-sm">
                          {new Date(selectedEmail.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} / {new Date(selectedEmail.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })}
                        </span>
                      </div>
                      
                      <div className={cn(
                        "text-sm leading-relaxed whitespace-pre-wrap",
                        isDarkMode ? "text-gray-300" : "text-gray-600"
                      )}>
                        {renderTextWithLinks(selectedEmail.body || selectedEmail.snippet)}
                      </div>

                      {/* Action Tags */}
                      <div className="flex flex-wrap gap-2 pt-4 pb-2">
                        <span className="px-2 py-1 bg-[#FF5C35]/10 text-[#FF5C35] text-[9px] font-bold rounded-lg uppercase tracking-wider">
                          Internal Portal
                        </span>
                        {(selectedEmail.subject.toLowerCase().includes('safe city') || selectedEmail.subject.toLowerCase().includes('denizbank')) && (
                          <span className="px-2 py-1 bg-red-500/10 text-red-500 text-[9px] font-bold rounded-lg uppercase tracking-wider">
                            Critical Alert
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 border-t border-white/5 bg-black/5">
                      <button 
                        onClick={() => setSelectedEmail(null)}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Back to List
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

interface EmailListItemProps {
  email: Email;
  isDarkMode: boolean;
  isRead: boolean;
  handleSelectEmail: (email: Email) => void;
  renderTextWithLinks: (text: string) => React.ReactNode;
}

function EmailListItem({
  email,
  isDarkMode,
  isRead,
  handleSelectEmail,
  renderTextWithLinks,
}: EmailListItemProps) {
  return (
    <motion.div 
      whileHover={{ scale: 1.005 }}
      onClick={() => handleSelectEmail(email)}
      className={cn(
        "p-5 rounded-2xl border transition-all cursor-pointer relative",
        isDarkMode 
          ? isRead ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-[#FF5C35]/20 border-[#FF5C35]/40 hover:bg-[#FF5C35]/30"
          : isRead ? "bg-gray-50 border-black/5 hover:bg-gray-100" : "bg-[#FF5C35]/15 border-[#FF5C35]/25 hover:bg-[#FF5C35]/20"
      )}
    >
      {/* List Item Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
          <span className="text-[10px] font-bold truncate pr-2 text-[#FF5C35] uppercase tracking-wider">
            {email.from.split('<')[0].replace(/"/g, '') || email.from}
          </span>
          {email.from.toLowerCase().includes('noreply@sc.mvr.gov.mk') && (
            <Image src="/camera.png" alt="Camera" width={30} height={30} className="shrink-0" />
          )}
        </div>
        <span className="text-[9px] bg-[#FF5C35] text-white px-3 py-1 rounded-full font-black whitespace-nowrap shadow-sm">
          {new Date(email.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} / {new Date(email.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })}
        </span>
      </div>

      <h4 className={cn("font-bold text-sm mb-2 leading-tight", isDarkMode ? "text-white" : "text-black")}>
        {email.subject}
      </h4>

      <div className="text-xs text-gray-500 leading-relaxed opacity-90">
        {renderTextWithLinks(email.snippet)}
      </div>
    </motion.div>
  );
}
