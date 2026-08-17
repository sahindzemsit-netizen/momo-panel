'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { FileText, Pencil, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReservationNotePopupProps {
  editingNoteId: string | null;
  noteCoords: { top: number; left: number } | null;
  initialNote?: string;
  isDarkMode: boolean;
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
}

export const ReservationNotePopup: React.FC<ReservationNotePopupProps> = React.memo(({
  editingNoteId,
  noteCoords,
  initialNote = '',
  isDarkMode,
  onClose,
  onSave,
}) => {
  const [localNote, setLocalNote] = useState(initialNote);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalNote(initialNote || '');
    setIsEditing(!initialNote);
  }, [editingNoteId, initialNote]);

  if (!editingNoteId || !noteCoords || typeof document === 'undefined') {
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(localNote);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div 
        className="absolute inset-0 pointer-events-auto bg-black/40 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none" 
        onClick={onClose} 
      />
      <div 
        style={isMobile ? {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        } : {
          position: 'fixed',
          top: noteCoords.top,
          left: noteCoords.left,
          transform: 'translate(-100%, -100%)',
        }}
        className="pointer-events-none z-[10000]"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={cn(
            "w-64 p-4 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-2 pointer-events-auto",
            isDarkMode ? "bg-[#2C2724] border-[#9C27B0]/30 text-white" : "bg-[#F3E5F5] border-[#9C27B0] text-[#4A148C]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-[#9C27B0]" />
                <span className="text-[9px] font-black tracking-widest uppercase opacity-60">Reservation Note</span>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <button 
                    type="button"
                    onClick={() => setIsEditing(true)} 
                    className="opacity-40 hover:opacity-100 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                <button 
                  type="button"
                  onClick={onClose} 
                  className="opacity-40 hover:opacity-100 cursor-pointer"
                >
                  <Plus className="w-3 h-3 rotate-45" />
                </button>
              </div>
            </div>
            {isEditing ? (
              <>
                <textarea
                  autoFocus
                  value={localNote}
                  onChange={(e) => setLocalNote(e.target.value)}
                  placeholder="Type your comment..."
                  className={cn(
                    "w-full p-3 rounded-xl border-none outline-none font-bold text-xs min-h-[80px] resize-none",
                    isDarkMode ? "bg-[#1A1614] text-white" : "bg-white/50 text-[#4A148C]"
                  )}
                />
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSave}
                  className="w-full py-2 bg-[#9C27B0] text-white rounded-xl font-black text-[9px] tracking-widest uppercase shadow-lg hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  SAVE COMMENT
                </button>
              </>
            ) : (
              <div className={cn(
                "w-full p-3 rounded-xl font-bold text-xs min-h-[80px] whitespace-pre-wrap",
                isDarkMode ? "bg-[#1A1614] text-white" : "bg-white/50 text-[#4A148C]"
              )}>
                {localNote || "No comment added."}
              </div>
            )}
          </div>
          {/* Bubble Arrow */}
          <div className={cn(
            "hidden md:block absolute top-full right-3 w-4 h-4 rotate-45 border-r-2 border-b-2 -mt-2",
            isDarkMode ? "bg-[#2C2724] border-[#9C27B0]/30" : "bg-[#F3E5F5] border-[#9C27B0]"
          )} />
        </motion.div>
      </div>
    </div>,
    document.body
  );
});

ReservationNotePopup.displayName = 'ReservationNotePopup';
