'use client';

import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAppState } from '@/lib/context';
import { Plus, Edit2, Trash2, Check, X, Bell, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface RemindersPanelProps {
  isDarkMode: boolean;
  sidebarColor: string;
}

export default function RemindersPanel({ isDarkMode, sidebarColor }: RemindersPanelProps) {
  const { user, isAdmin } = useAppState();

  const [reminders, setReminders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States for adding a new reminder
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState('');

  // States for editing an existing reminder
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  // Fetch settings/dashboard document on Firestore once on mount
  useEffect(() => {
    if (!user || !isAdmin) {
      setReminders([]);
      setIsLoading(false);
      return;
    }

    const fetchReminders = async () => {
      try {
        const docRef = doc(db, 'settings', 'dashboard');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setReminders(data.globalReminders || []);
        } else {
          setReminders([]);
        }
      } catch (error: any) {
        handleFirestoreError(error, OperationType.GET, 'settings/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReminders();
  }, [user, isAdmin]);

  // Helper to persist the current reminders array
  const saveRemindersToDb = async (updatedList: string[]) => {
    try {
      const docRef = doc(db, 'settings', 'dashboard');
      await setDoc(docRef, { globalReminders: updatedList }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/dashboard');
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || reminders.length >= 3) return;

    const updated = [...reminders, newText.trim()];
    setReminders(updated); // Update locally immediately
    setNewText('');
    setIsAdding(false);
    await saveRemindersToDb(updated);
  };

  const handleStartEdit = (index: number, text: string) => {
    setEditingIndex(index);
    setEditText(text);
  };

  const handleSaveEdit = async (index: number) => {
    if (!editText.trim()) return;

    const updated = [...reminders];
    updated[index] = editText.trim();
    setReminders(updated); // Update locally immediately
    setEditingIndex(null);
    setEditText('');
    await saveRemindersToDb(updated);
  };

  const handleClearReminder = async (index: number) => {
    const updated = reminders.filter((_, i) => i !== index);
    setReminders(updated); // Update locally immediately
    // Exit edit mode if clearing the edited item
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditText('');
    }
    await saveRemindersToDb(updated);
  };

  // Determine button theme color
  const primaryButtonStyle = {
    backgroundColor: 'rgb(210, 105, 30)',
  };

  if (!user || !isAdmin) return null;

  return (
    <div
      id="global-reminders-panel"
      style={{ 
        marginTop: '-25px', 
        height: '270px',
        background: isDarkMode 
          ? "linear-gradient(135deg, rgba(210, 105, 30, 0.18) 0%, rgba(210, 105, 30, 0.03) 100%)" 
          : "linear-gradient(135deg, rgba(210, 105, 30, 0.14) 0%, rgba(210, 105, 30, 0.02) 100%)",
        borderColor: isDarkMode 
          ? "rgba(210, 105, 30, 0.25)" 
          : "rgba(210, 105, 30, 0.35)"
      }}
      className={cn(
        "w-full rounded-[24px] border-2 border-b-4 p-5 shadow-sm transition-all duration-300 relative overflow-hidden mb-4",
        isDarkMode 
          ? "text-white shadow-black/40" 
          : "text-[#0E0C0B]"
      )}
    >
      {/* Background Decorative Gradient */}
      <div className="absolute right-0 top-0 bottom-0 w-48 bg-gradient-to-l from-[rgba(210,105,30,0.12)] to-transparent pointer-events-none" />

      {/* Header Row */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <div 
            style={{ marginTop: '-5px' }}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center border-b-2 shadow-sm",
              isDarkMode 
                ? "bg-[rgba(210,105,30,0.15)] border-[rgba(210,105,30,0.3)]" 
                : "bg-[rgba(210,105,30,0.12)] border-[rgba(210,105,30,0.25)]"
            )}
          >
            <Bell className="w-4 h-4 text-[rgb(210,105,30)]" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-xs font-black tracking-widest uppercase mb-0.5">GLOBAL REMINDERS</h3>
            <span className={cn(
              "text-[9px] font-bold tracking-wider",
              isDarkMode ? "text-gray-400" : "text-gray-500"
            )}>
              {reminders.length}/3 IN USE
            </span>
          </div>
        </div>

        {/* Add Button */}
        {reminders.length < 3 && !isAdding && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsAdding(true)}
            style={primaryButtonStyle}
            className="flex items-center gap-1.5 px-3 py-1.5 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md active:scale-95 hover:brightness-110"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD</span>
          </motion.button>
        )}

        {reminders.length >= 3 && (
          <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-gray-400 uppercase">
            <AlertCircle className="w-3.5 h-3.5 text-[rgb(210,105,30)]" />
            <span>LIMIT REACHED</span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="relative z-10 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-[rgba(210,105,30,0.2)] border-t-[rgb(210,105,30)] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {reminders.map((reminder, idx) => {
                const isEditingThis = editingIndex === idx;

                const itemStyle = idx === 0 
                  ? { marginTop: '-15px', height: '55px' }
                  : (idx === 1 || idx === 2) 
                    ? { height: '55px' } 
                    : {};

                return (
                  <motion.div
                    key={`reminder-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    style={itemStyle}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-2xl border transition-colors",
                      isDarkMode 
                        ? "bg-[#231F1D]/80 border-[rgba(210,105,30,0.15)]" 
                        : "bg-white/80 border-[rgba(210,105,30,0.15)]"
                    )}
                  >
                    {isEditingThis ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          maxLength={150}
                          className={cn(
                            "flex-1 px-3 py-1.5 rounded-xl text-xs font-bold outline-none border transition-all",
                            isDarkMode 
                              ? "bg-[#1E1B1A] border-[rgba(210,105,30,0.3)] text-white focus:border-[rgb(210,105,30)]" 
                              : "bg-white border-gray-200 text-gray-900 focus:border-[rgb(210,105,30)]"
                          )}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(idx);
                            if (e.key === 'Escape') setEditingIndex(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveEdit(idx)}
                          className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingIndex(null)}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors border",
                            isDarkMode ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-gray-200 hover:bg-gray-100"
                          )}
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-2.5 flex-1 pr-4">
                          <span className="text-sm mt-0.5 shrink-0 select-none">📌</span>
                          <p className="text-xs font-bold leading-relaxed break-all">
                            {reminder}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleStartEdit(idx, reminder)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors border text-gray-400 hover:text-[rgb(210,105,30)]",
                              isDarkMode ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-gray-200 hover:bg-gray-50"
                            )}
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleClearReminder(idx)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors border text-gray-400 hover:text-red-500 hover:bg-red-500/10",
                              isDarkMode ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-gray-200 hover:bg-gray-50"
                            )}
                            title="Clear"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Inline Add Input Form */}
            <AnimatePresence>
              {isAdding && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAddReminder}
                  className="space-y-2 mt-1"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter reminder text..."
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      maxLength={150}
                      required
                      className={cn(
                        "flex-1 px-3 py-2 rounded-xl text-xs font-bold outline-none border transition-all",
                        isDarkMode 
                          ? "bg-[#231F1D] border-[rgba(210,105,30,0.3)] text-white placeholder-gray-500 focus:border-[rgb(210,105,30)]" 
                          : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[rgb(210,105,30)]"
                      )}
                      autoFocus
                    />
                    <button
                      type="submit"
                      style={primaryButtonStyle}
                      className="p-2 text-white hover:brightness-110 rounded-xl transition-all shadow-md shrink-0"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdding(false);
                        setNewText('');
                      }}
                      className={cn(
                        "p-2 rounded-xl transition-all border shrink-0",
                        isDarkMode ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-gray-200 hover:bg-gray-100"
                      )}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Empty State */}
            {!isAdding && reminders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center opacity-40">
                <Bell className="w-8 h-8 mb-2 stroke-1 text-[rgb(210,105,30)]" />
                <p className="font-bold text-[10px] tracking-widest uppercase mb-1">NO REMINDERS SET</p>
                <p className="text-[9px] tracking-wider uppercase">Add reminders to keep the fleet updated</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
