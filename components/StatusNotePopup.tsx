'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Pencil, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusNotePopupProps {
  editingStatusId: string | null;
  statusCoords: { top: number; left: number } | null;
  initialNote?: string;
  initialColor?: string;
  isDarkMode: boolean;
  onClose: () => void;
  onSave: (note: string, color: string) => Promise<void>;
  onReset: () => Promise<void>;
}

const STATUS_COLORS = [
  '#FFFFFF', '#FF5C35', '#FF9F00', '#FACC15', 
  '#22C55E', '#10B981', '#06B6D4', '#3B82F6', 
  '#6366F1', '#8B5CF6', '#D946EF', '#EC4899'
];

export const StatusNotePopup: React.FC<StatusNotePopupProps> = React.memo(({
  editingStatusId,
  statusCoords,
  initialNote = '',
  initialColor = '#FFFFFF',
  isDarkMode,
  onClose,
  onSave,
  onReset,
}) => {
  const [localNote, setLocalNote] = useState(initialNote);
  const [localColor, setLocalColor] = useState(initialColor);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalNote(initialNote || '');
    setLocalColor(initialColor || '#FFFFFF');
  }, [editingStatusId, initialNote, initialColor]);

  if (!editingStatusId || !statusCoords || typeof document === 'undefined') {
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(localNote, localColor);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await onReset();
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div 
        className="absolute inset-0 pointer-events-auto" 
        onClick={onClose} 
      />
      <div 
        style={{
          position: 'fixed',
          top: statusCoords.top,
          left: statusCoords.left,
        }}
        className="pointer-events-none z-[10000]"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={cn(
            "w-64 p-4 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-2 pointer-events-auto",
            isDarkMode ? "bg-[#2C2724] border-white/5 text-white" : "bg-white border-black/5 text-[#0E0C0B]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Pencil className="w-3 h-3 text-[#FF5C35]" />
                <span className="text-[9px] font-black tracking-widest uppercase opacity-60">Status Note</span>
              </div>
              <button 
                type="button"
                onClick={onClose} 
                className="opacity-40 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <textarea
              autoFocus
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              placeholder="Type a quick note..."
              className={cn(
                "w-full p-3 rounded-xl border-none outline-none font-bold text-xs min-h-[80px] resize-none transition-colors",
                isDarkMode 
                  ? "bg-black/20 text-white placeholder:text-gray-600 focus:bg-black/40" 
                  : "bg-gray-100 text-[#0E0C0B] placeholder:text-gray-400 focus:bg-gray-200/50"
              )}
            />

            <div className="flex flex-wrap gap-2 py-1">
              {STATUS_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setLocalColor(color)}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer shadow-sm",
                    localColor === color ? (isDarkMode ? "border-white" : "border-[#FF5C35]") : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="flex-1 py-2 px-4 bg-[#FF5C35] text-white rounded-xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-[#FF5C35]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                Save Status
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleReset}
                className={cn(
                  "p-2 rounded-xl border transition-all group disabled:opacity-50",
                  isDarkMode ? "border-white/10 hover:bg-white/5" : "border-black/5 hover:bg-gray-100"
                )}
                title="Reset Status"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>,
    document.body
  );
});

StatusNotePopup.displayName = 'StatusNotePopup';
