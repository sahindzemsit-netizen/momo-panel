'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  X, 
  Bell, 
  Volume2, 
  Check, 
  AlertTriangle, 
  Car, 
  Euro, 
  FileText, 
  XCircle, 
  Plus, 
  UserPlus, 
  Sparkles,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { useAppState } from '@/lib/context';
import { 
  NotificationPreferences, 
  DEFAULT_PREFERENCES, 
  playNotificationRingtone, 
  requestNotificationPermission,
  updateTeammateNotificationPreferences 
} from '@/lib/notificationService';
import { cn } from '@/lib/utils';

interface AdminAccount {
  id: string;
  email?: string;
  displayName?: string;
  role?: string;
  notificationPreferences?: NotificationPreferences;
}

export default function AdminNotificationMatrix({
  isOpen,
  onClose,
  isDarkMode = false
}: {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}) {
  const { user } = useAppState();
  const [adminsList, setAdminsList] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isOwner = user?.email === 'sahindzemsit@gmail.com';

  // Listen to the admins collection in real-time
  useEffect(() => {
    if (!isOpen || !isOwner) return;

    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'admins'), (snapshot) => {
      const accounts: AdminAccount[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        accounts.push({
          id: docSnap.id,
          email: data.email || docSnap.id,
          displayName: data.displayName || data.name || (data.email ? data.email.split('@')[0] : 'Team Member'),
          role: data.role || 'MEMBER',
          notificationPreferences: {
            ...DEFAULT_PREFERENCES,
            ...(data.notificationPreferences || {})
          }
        });
      });

      // Ensure sahindzemsit@gmail.com is present in the list even before first write
      if (!accounts.some(a => a.email === 'sahindzemsit@gmail.com')) {
        accounts.unshift({
          id: user?.uid || 'sahindzemsit',
          email: 'sahindzemsit@gmail.com',
          displayName: 'ŞAHIN DZEMSIT (OWNER)',
          role: 'ADMIN',
          notificationPreferences: { ...DEFAULT_PREFERENCES }
        });
      }

      setAdminsList(accounts);
      setLoading(false);
    }, (err) => {
      console.error('Failed to load admin accounts:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, isOwner, user]);

  const handleToggle = async (
    account: AdminAccount, 
    key: keyof NotificationPreferences
  ) => {
    if (!isOwner) return;

    const currentPrefs = account.notificationPreferences || { ...DEFAULT_PREFERENCES };
    const updatedPrefs: NotificationPreferences = {
      ...currentPrefs,
      [key]: !currentPrefs[key]
    };

    setSavingId(account.id);
    const success = await updateTeammateNotificationPreferences(
      account.id, 
      updatedPrefs, 
      account.email, 
      account.displayName
    );

    if (success) {
      setStatusMessage(`Saved settings for ${account.displayName || account.email}`);
      setTimeout(() => setStatusMessage(null), 2500);
    }
    setSavingId(null);
  };

  const handleAddNewTeammate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !isOwner) return;

    const cleanEmail = newEmail.trim().toLowerCase();
    const docId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');

    setSavingId(docId);
    const success = await updateTeammateNotificationPreferences(
      docId,
      { ...DEFAULT_PREFERENCES }, // Starts all as OFF
      cleanEmail,
      newName.trim() || cleanEmail.split('@')[0]
    );

    if (success) {
      setNewEmail('');
      setNewName('');
      setIsAddingUser(false);
      setStatusMessage(`Added ${cleanEmail} (All alerts start OFF)`);
      setTimeout(() => setStatusMessage(null), 3000);
    }
    setSavingId(null);
  };

  if (!isOpen) return null;

  if (!isOwner) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70">
        <div className="bg-white dark:bg-[#231F1D] p-6 rounded-3xl max-w-md w-full text-center border border-red-500/20">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-black dark:text-white">Access Restricted</h3>
          <p className="text-xs text-gray-500 mt-1">This notification matrix is restricted exclusively to sahindzemsit@gmail.com.</p>
          <button 
            onClick={onClose}
            className="mt-5 px-6 py-2.5 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-black/80 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={cn(
            "w-full max-w-4xl max-h-[92vh] rounded-[32px] border-2 shadow-2xl flex flex-col overflow-hidden my-auto transition-colors",
            isDarkMode 
              ? "bg-[#1E1B1A] border-white/10 text-white" 
              : "bg-white border-neutral-200 text-neutral-900"
          )}
        >
          {/* Header */}
          <div className={cn(
            "p-5 sm:p-6 border-b flex items-center justify-between shrink-0",
            isDarkMode ? "border-white/10 bg-[#25211F]" : "border-neutral-100 bg-neutral-50/70"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FF5C35] flex items-center justify-center text-white shadow-lg shadow-[#FF5C35]/20 shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight uppercase">
                    Admin Notification Matrix
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    sahindzemsit@gmail.com
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-medium">
                  Assign phone ringtone alerts to specific accounts. All start as OFF by default.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Test Sound Button */}
              <button
                type="button"
                onClick={() => playNotificationRingtone('CASHFLOW_INCOME')}
                className={cn(
                  "px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-black uppercase tracking-wider transition-transform active:scale-95 cursor-pointer",
                  isDarkMode 
                    ? "bg-white/5 border-white/10 text-white hover:bg-white/10" 
                    : "bg-white border-neutral-200 text-neutral-800 hover:bg-neutral-50"
                )}
                title="Preview phone chime"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#FF5C35]" />
                <span className="hidden sm:inline">Test Ringtone</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer",
                  isDarkMode ? "bg-white/5 text-white/60 hover:text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Notice Banner */}
          <div className="px-5 py-2.5 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent border-b border-orange-500/10 flex items-center justify-between text-[11px] font-bold text-orange-600 dark:text-orange-400">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Notifications route by Google Account / Gmail login. No phone numbers are needed.</span>
            </div>
            {statusMessage && (
              <span className="text-emerald-500 font-black">{statusMessage}</span>
            )}
          </div>

          {/* Accounts & Matrix Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
            {/* Add Teammate bar */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-neutral-400">
                Team Accounts ({adminsList.length})
              </span>
              <button
                type="button"
                onClick={() => setIsAddingUser(!isAddingUser)}
                className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#FF5C35] hover:underline cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isAddingUser ? 'Cancel' : 'Add Teammate Account'}</span>
              </button>
            </div>

            {/* Add Account Inline Form */}
            {isAddingUser && (
              <form onSubmit={handleAddNewTeammate} className={cn(
                "p-4 rounded-2xl border flex flex-col sm:flex-row gap-3 items-center mb-4 transition-colors",
                isDarkMode ? "bg-white/5 border-white/10" : "bg-neutral-50 border-neutral-200"
              )}>
                <input 
                  type="email"
                  required
                  placeholder="teammate@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="flex-1 w-full px-3.5 py-2 rounded-xl text-xs font-medium border bg-white dark:bg-black/30 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF5C35]"
                />
                <input 
                  type="text"
                  placeholder="Name (e.g. Manager)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full sm:w-48 px-3.5 py-2 rounded-xl text-xs font-medium border bg-white dark:bg-black/30 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF5C35]"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 bg-[#FF5C35] hover:bg-[#e04f2c] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 shrink-0"
                >
                  Save Account
                </button>
              </form>
            )}

            {/* Matrix Cards for Each Account */}
            {loading ? (
              <div className="py-16 text-center text-xs font-black uppercase tracking-widest text-neutral-400">
                Loading team accounts...
              </div>
            ) : adminsList.map((account) => {
              const prefs = account.notificationPreferences || DEFAULT_PREFERENCES;
              const isUserSelf = account.email === 'sahindzemsit@gmail.com';

              return (
                <div 
                  key={account.id}
                  className={cn(
                    "p-4 sm:p-5 rounded-3xl border-2 transition-all space-y-4",
                    isDarkMode 
                      ? "bg-[#25211F] border-white/5 hover:border-white/10" 
                      : "bg-white border-neutral-200/90 shadow-sm"
                  )}
                >
                  {/* Account Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-dashed border-neutral-200 dark:border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FF5C35] to-orange-400 flex items-center justify-center text-white font-black text-xs shadow-md shrink-0">
                        {account.displayName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black tracking-tight uppercase">
                            {account.displayName}
                          </span>
                          {isUserSelf && (
                            <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Owner
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-400 font-mono font-medium block lowercase">
                          {account.email}
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      {savingId === account.id ? (
                        <span className="text-[#FF5C35]">Saving changes...</span>
                      ) : (
                        <span>Configure 5 Alert Categories</span>
                      )}
                    </div>
                  </div>

                  {/* 5 Notification Categories */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {/* 1. Cancelled Reservations */}
                    <div className={cn(
                      "p-3 rounded-2xl border flex items-center justify-between transition-colors",
                      prefs.cancelledReservations 
                        ? (isDarkMode ? "bg-red-950/20 border-red-500/30" : "bg-red-50/60 border-red-200") 
                        : (isDarkMode ? "bg-white/5 border-white/5 opacity-60" : "bg-neutral-50/60 border-neutral-200/60 opacity-60")
                    )}>
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                          <XCircle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-tight truncate">Cancelled Bookings</p>
                          <p className="text-[9px] text-neutral-400">Ringtone on reservation cancel</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle(account, 'cancelledReservations')}
                        className={cn(
                          "w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer shrink-0",
                          prefs.cancelledReservations ? "bg-red-500" : "bg-neutral-300 dark:bg-white/20"
                        )}
                      >
                        <motion.div
                          animate={{ x: prefs.cancelledReservations ? 20 : 0 }}
                          className="w-5 h-5 rounded-full bg-white shadow-md"
                        />
                      </button>
                    </div>

                    {/* 2a. New Cashflow Entry: Income (Green) */}
                    <div className={cn(
                      "p-3 rounded-2xl border flex items-center justify-between transition-colors",
                      prefs.newCashflowIncome 
                        ? (isDarkMode ? "bg-emerald-950/20 border-emerald-500/30" : "bg-emerald-50/60 border-emerald-200") 
                        : (isDarkMode ? "bg-white/5 border-white/5 opacity-60" : "bg-neutral-50/60 border-neutral-200/60 opacity-60")
                    )}>
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                          <Euro className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-black uppercase tracking-tight truncate">Cashflow Income</p>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          </div>
                          <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">Green alert + chime</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle(account, 'newCashflowIncome')}
                        className={cn(
                          "w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer shrink-0",
                          prefs.newCashflowIncome ? "bg-emerald-500" : "bg-neutral-300 dark:bg-white/20"
                        )}
                      >
                        <motion.div
                          animate={{ x: prefs.newCashflowIncome ? 20 : 0 }}
                          className="w-5 h-5 rounded-full bg-white shadow-md"
                        />
                      </button>
                    </div>

                    {/* 2b. New Cashflow Entry: Expense (Red) */}
                    <div className={cn(
                      "p-3 rounded-2xl border flex items-center justify-between transition-colors",
                      prefs.newCashflowExpense 
                        ? (isDarkMode ? "bg-red-950/20 border-red-500/30" : "bg-red-50/60 border-red-200") 
                        : (isDarkMode ? "bg-white/5 border-white/5 opacity-60" : "bg-neutral-50/60 border-neutral-200/60 opacity-60")
                    )}>
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                          <Euro className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-black uppercase tracking-tight truncate">Cashflow Expense</p>
                            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          </div>
                          <p className="text-[9px] text-red-600 dark:text-red-400 font-bold">Red alert + tone</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle(account, 'newCashflowExpense')}
                        className={cn(
                          "w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer shrink-0",
                          prefs.newCashflowExpense ? "bg-red-500" : "bg-neutral-300 dark:bg-white/20"
                        )}
                      >
                        <motion.div
                          animate={{ x: prefs.newCashflowExpense ? 20 : 0 }}
                          className="w-5 h-5 rounded-full bg-white shadow-md"
                        />
                      </button>
                    </div>

                    {/* 3. New Damage Reported */}
                    <div className={cn(
                      "p-3 rounded-2xl border flex items-center justify-between transition-colors",
                      prefs.newDamage 
                        ? (isDarkMode ? "bg-orange-950/20 border-orange-500/30" : "bg-orange-50/60 border-orange-200") 
                        : (isDarkMode ? "bg-white/5 border-white/5 opacity-60" : "bg-neutral-50/60 border-neutral-200/60 opacity-60")
                    )}>
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                          <Car className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-tight truncate">Damage Reported</p>
                          <p className="text-[9px] text-neutral-400">New vehicle damage entry</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle(account, 'newDamage')}
                        className={cn(
                          "w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer shrink-0",
                          prefs.newDamage ? "bg-orange-500" : "bg-neutral-300 dark:bg-white/20"
                        )}
                      >
                        <motion.div
                          animate={{ x: prefs.newDamage ? 20 : 0 }}
                          className="w-5 h-5 rounded-full bg-white shadow-md"
                        />
                      </button>
                    </div>

                    {/* 4. New Traffic Violation */}
                    <div className={cn(
                      "p-3 rounded-2xl border flex items-center justify-between transition-colors",
                      prefs.newViolation 
                        ? (isDarkMode ? "bg-purple-950/20 border-purple-500/30" : "bg-purple-50/60 border-purple-200") 
                        : (isDarkMode ? "bg-white/5 border-white/5 opacity-60" : "bg-neutral-50/60 border-neutral-200/60 opacity-60")
                    )}>
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-tight truncate">Traffic Violation</p>
                          <p className="text-[9px] text-neutral-400">Police / radar fine added</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle(account, 'newViolation')}
                        className={cn(
                          "w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer shrink-0",
                          prefs.newViolation ? "bg-purple-500" : "bg-neutral-300 dark:bg-white/20"
                        )}
                      >
                        <motion.div
                          animate={{ x: prefs.newViolation ? 20 : 0 }}
                          className="w-5 h-5 rounded-full bg-white shadow-md"
                        />
                      </button>
                    </div>

                    {/* 5. Document Expiry Alerts */}
                    <div className={cn(
                      "p-3 rounded-2xl border flex items-center justify-between transition-colors",
                      prefs.documentExpiry 
                        ? (isDarkMode ? "bg-blue-950/20 border-blue-500/30" : "bg-blue-50/60 border-blue-200") 
                        : (isDarkMode ? "bg-white/5 border-white/5 opacity-60" : "bg-neutral-50/60 border-neutral-200/60 opacity-60")
                    )}>
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-tight truncate">Document Expiry</p>
                          <p className="text-[9px] text-neutral-400">Registration & Insurance alert</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle(account, 'documentExpiry')}
                        className={cn(
                          "w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer shrink-0",
                          prefs.documentExpiry ? "bg-blue-500" : "bg-neutral-300 dark:bg-white/20"
                        )}
                      >
                        <motion.div
                          animate={{ x: prefs.documentExpiry ? 20 : 0 }}
                          className="w-5 h-5 rounded-full bg-white shadow-md"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className={cn(
            "p-4 sm:p-5 border-t flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0",
            isDarkMode ? "border-white/10 bg-[#25211F]" : "border-neutral-100 bg-neutral-50/70"
          )}>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Changes take effect immediately on all mobile PWAs and browsers.</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#FF5C35] hover:bg-[#e04f2c] text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-[#FF5C35]/20 active:scale-95 cursor-pointer"
            >
              Done & Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
