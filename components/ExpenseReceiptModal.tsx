'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Download, FileText } from 'lucide-react';
import Image from 'next/image';

interface ExpenseReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl: string | null;
  category?: string;
  isDarkMode: boolean;
}

export default function ExpenseReceiptModal({
  isOpen,
  onClose,
  receiptUrl,
  category = 'Expense Receipt',
  isDarkMode,
}: ExpenseReceiptModalProps) {
  if (!isOpen || !receiptUrl) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="relative z-10 max-w-2xl w-full max-h-[90vh] bg-[#1A1614] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <FileText className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-white tracking-widest leading-none">
                  {category}
                </h3>
                <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                  Attached Receipt / Bill
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-white transition-all text-xs flex items-center gap-1 cursor-pointer"
                title="Open in new window"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Image Container */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60 min-h-[300px]">
            {/* Standard img tag for external firebase storage download URLs */}
            <img
              src={receiptUrl}
              alt="Receipt Preview"
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-white/5"
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
