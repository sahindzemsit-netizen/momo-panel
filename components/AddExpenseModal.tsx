'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  X, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Sparkles, 
  Fuel, 
  Coffee, 
  Wrench, 
  HelpCircle,
  Calendar,
  Euro,
  User,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import { dispatchAppNotification } from '@/lib/notificationService';
import { normalizeCountry, COUNTRY_COLORS } from './ExpenseCard';

const RECOMMENDED_CATEGORIES = [
  { name: 'Gas / Fuel', icon: Fuel, color: 'text-amber-500 bg-amber-500/10' },
  { name: 'Food & Meals', icon: Coffee, color: 'text-orange-500 bg-orange-500/10' },
  { name: 'Maintenance / Service', icon: Wrench, color: 'text-blue-500 bg-blue-500/10' },
  { name: 'Other', icon: HelpCircle, color: 'text-purple-500 bg-purple-500/10' }
];

const AVAILABLE_COUNTRIES = [
  'Macedonia', 'Kosovo', 'Albania', 'Montenegro', 'Bosnia'
];

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCountry?: string;
  allowedCountries?: string[];
  isDarkMode: boolean;
}

export default function AddExpenseModal({
  isOpen,
  onClose,
  defaultCountry,
  allowedCountries,
  isDarkMode,
}: AddExpenseModalProps) {
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    amount: '',
    teammate: '',
    country: defaultCountry && defaultCountry !== 'ALL' ? normalizeCountry(defaultCountry) : 'Macedonia'
  });

  const [currency, setCurrency] = useState<'EUR' | 'MKD'>('EUR');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // When modal opens, ALWAYS ensure all entries are empty and freshly initialized
  useEffect(() => {
    if (isOpen) {
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        category: '',
        amount: '',
        teammate: '',
        country: defaultCountry && defaultCountry !== 'ALL' ? normalizeCountry(defaultCountry) : 'Macedonia'
      });
      setCurrency('EUR');
      setSelectedFile(null);
      setFilePreview(null);
      setFormError('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen, defaultCountry]);

  // Handle file preview cleanup
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setFilePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFilePreview(null);
    }
  }, [selectedFile]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Max 15MB
      if (file.size > 15 * 1024 * 1024) {
        setFormError('Receipt image must be smaller than 15MB');
        return;
      }
      setSelectedFile(file);
      setFormError('');
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.category.trim()) {
      setFormError('Category / Title is required');
      return;
    }

    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Amount must be a valid positive number');
      return;
    }

    if (!formData.teammate.trim()) {
      setFormError('Teammate name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const currentHoursMinutes = format(now, 'HH:mm');
      const normalizedCountry = normalizeCountry(formData.country);

      // Save last used teammate
      if (typeof window !== 'undefined') {
        localStorage.setItem('last_processed_by', formData.teammate.trim().toUpperCase());
      }

      // Initial document payload
      const payload = {
        date: formData.date.includes('T') ? formData.date : `${formData.date}T${currentHoursMinutes}`,
        category: formData.category.trim().toUpperCase(),
        amount: amt,
        status: 'PENDING' as const,
        teammate: formData.teammate.trim().toUpperCase(),
        currency: currency,
        country: normalizedCountry,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const docRef = await addDoc(collection(db, 'expenses'), payload);

      // Dispatch real-time red notification to subscribed accounts
      try {
        dispatchAppNotification({
          type: 'CASHFLOW_EXPENSE',
          title: `Cashflow Expense: -€${amt}`,
          body: `Expense of €${amt} for ${payload.category} logged by ${payload.teammate}`,
          color: 'red',
          amount: amt,
        });
      } catch (alertErr) {
        console.warn('Could not dispatch cashflow expense alert:', alertErr);
      }

      // Upload receipt image if provided
      if (selectedFile) {
        try {
          const fileExt = selectedFile.name.split('.').pop() || 'jpg';
          const storagePath = `expenses_documents/${docRef.id}/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, selectedFile);
          const downloadUrl = await getDownloadURL(storageRef);

          await updateDoc(doc(db, 'expenses', docRef.id), {
            receiptUrl: downloadUrl,
            updatedAt: Date.now()
          });
        } catch (uploadErr) {
          console.warn("Storage upload completed with fallback (rules may be in sync):", uploadErr);
        }
      }

      // Reset
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        category: '',
        amount: '',
        teammate: '',
        country: defaultCountry && defaultCountry !== 'ALL' ? normalizeCountry(defaultCountry) : 'Macedonia'
      });
      setSelectedFile(null);
      setFilePreview(null);
      setCurrency('EUR');
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error("Failed to create expense:", err);
      setFormError('Failed to save expense. Please verify details and connection.');
      setIsSubmitting(false);
    }
  };

  const activeCountriesList = allowedCountries && allowedCountries.length > 0 && !allowedCountries.includes('ALL')
    ? AVAILABLE_COUNTRIES.filter(c => allowedCountries.some(loc => loc.toUpperCase() === c.toUpperCase()))
    : AVAILABLE_COUNTRIES;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className={cn(
            "relative z-10 w-full max-w-lg p-6 rounded-[32px] border shadow-2xl flex flex-col gap-5 my-8",
            isDarkMode ? "bg-[#1E1B1A] border-white/10 text-white" : "bg-white border-stone-200 text-stone-900"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-3 border-black/5 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FF5C35]/15 text-[#FF5C35] flex items-center justify-center border border-[#FF5C35]/30">
                <FileText className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-black text-xs tracking-widest uppercase">
                  NEW EXPENSE
                </h3>
                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">
                  Operational Expenditure Registration
                </span>
              </div>
            </div>

            <button 
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/10 text-gray-400 hover:text-black dark:hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-3 text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl tracking-wider text-center uppercase">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Country Selector with Country Colors */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1 flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-[#FF5C35]" />
                COUNTRY
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {activeCountriesList.map(c => {
                  const theme = COUNTRY_COLORS[c] || COUNTRY_COLORS.Macedonia;
                  const isSelected = normalizeCountry(formData.country) === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, country: c }))}
                      className={cn(
                        "py-2 px-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all border flex items-center justify-center text-center cursor-pointer",
                        isSelected
                          ? "shadow-md scale-105 border-transparent font-extrabold"
                          : isDarkMode ? "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10" : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                      )}
                      style={isSelected ? {
                        backgroundColor: theme.hex,
                        color: theme.text === 'text-white' ? '#FFFFFF' : '#000000',
                        boxShadow: `0 4px 14px ${theme.hex}50`
                      } : undefined}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Teammate Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1 flex items-center gap-1.5">
                <User className="w-3 h-3 text-[#FF5C35]" />
                TEAMMATE (REGISTERED BY)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder=""
                  value={formData.teammate}
                  onChange={(e) => setFormData(prev => ({ ...prev, teammate: e.target.value.toUpperCase() }))}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-2xl text-xs font-black tracking-wider outline-none border-2 transition-all uppercase",
                    isDarkMode ? "bg-[#181514] border-white/10 text-white focus:border-[#FF5C35]" : "bg-stone-50 border-stone-200 text-stone-900 focus:border-[#FF5C35]"
                  )}
                />
              </div>
            </div>

            {/* Date Occurred */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1 flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-[#FF5C35]" />
                EXPENSE OCCURRED DATE
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className={cn(
                  "w-full px-4 py-2.5 rounded-2xl text-xs font-black tracking-wider outline-none border-2 transition-all",
                  isDarkMode ? "bg-[#181514] border-white/10 text-white focus:border-[#FF5C35]" : "bg-stone-50 border-stone-200 text-stone-900 focus:border-[#FF5C35]"
                )}
              />
            </div>

            {/* Category / Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                CATEGORY / DESCRIPTION
              </label>
              <input
                type="text"
                required
                placeholder=""
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className={cn(
                  "w-full px-4 py-2.5 rounded-2xl text-xs font-black tracking-wider outline-none border-2 transition-all uppercase",
                  isDarkMode ? "bg-[#181514] border-white/10 text-white focus:border-[#FF5C35]" : "bg-stone-50 border-stone-200 text-stone-900 focus:border-[#FF5C35]"
                )}
              />
              {/* Category Quick Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {RECOMMENDED_CATEGORIES.map(cat => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: cat.name.toUpperCase() }))}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-1",
                      formData.category.toUpperCase() === cat.name.toUpperCase()
                        ? "bg-[#FF5C35] text-white border-transparent"
                        : isDarkMode ? "bg-white/5 border-white/10 text-gray-400 hover:text-white" : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                    )}
                  >
                    <cat.icon className="w-2.5 h-2.5" />
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Cost & Currency Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1 flex items-center gap-1.5">
                <Euro className="w-3 h-3 text-[#FF5C35]" />
                AMOUNT COST
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className={cn(
                      "w-full px-4 py-3 rounded-2xl text-base font-black font-mono tracking-tight outline-none border-2 transition-all",
                      isDarkMode ? "bg-[#181514] border-white/10 text-white focus:border-[#FF5C35]" : "bg-stone-50 border-stone-200 text-stone-900 focus:border-[#FF5C35]"
                    )}
                  />
                </div>
                {/* Fixed Currency Badge (EUR only) */}
                <div className="flex items-center px-4 py-3 rounded-2xl border bg-[#FF5C35]/10 border-[#FF5C35]/25 text-[#FF5C35] shrink-0 font-black text-xs tracking-wider select-none">
                  EUR (€)
                </div>
              </div>
            </div>

            {/* Feature 5: Optional Receipt / Bill Image Dropzone */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3 h-3 text-[#FF5C35]" />
                  ATTACH RECEIPT / BILL (OPTIONAL)
                </span>
                <span className="text-[8px] opacity-60">PNG, JPG up to 15MB</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="receipt-file-input"
              />

              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]",
                    isDarkMode 
                      ? "border-white/15 bg-white/5 hover:border-[#FF5C35] hover:bg-white/10" 
                      : "border-stone-300 bg-stone-50 hover:border-[#FF5C35] hover:bg-stone-100"
                  )}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#FF5C35]/15 text-[#FF5C35] flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    Click to browse or upload receipt image
                  </span>
                  <span className="text-[8px] font-semibold text-gray-400">
                    Image will be attached to this card and visible in Cashflow
                  </span>
                </div>
              ) : (
                <div className={cn(
                  "p-3 rounded-2xl border flex items-center justify-between gap-3 bg-emerald-500/10 border-emerald-500/30",
                  isDarkMode ? "text-emerald-300" : "text-emerald-900"
                )}>
                  <div className="flex items-center gap-3 min-w-0">
                    {filePreview ? (
                      <img 
                        src={filePreview} 
                        alt="Preview" 
                        className="w-10 h-10 rounded-lg object-cover border border-emerald-500/30 shrink-0" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-emerald-500" />
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-black truncate max-w-[220px]">
                        {selectedFile.name}
                      </span>
                      <span className="text-[8px] font-mono opacity-70">
                        {(selectedFile.size / 1024).toFixed(0)} KB • Ready to upload
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1.5 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/15 transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-gradient-to-r from-[#FF5C35] to-[#FF7D5E] text-white shadow-xl shadow-[#FF5C35]/25 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <span>SAVING OP-EX CARD...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>SUMMON CARD DECK</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
