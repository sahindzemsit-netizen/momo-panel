'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { FileText, AlertTriangle, CheckCircle, Clock, Shield, FileCheck, Search, Filter, ChevronLeft, ChevronRight, Trash2, UploadCloud, X, Plus } from 'lucide-react';
import { Vehicle, RentalRegistration } from '@/types';
import { format, addDays, differenceInDays, addYears } from 'date-fns';
import { db, OperationType, handleFirestoreError } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp, query, orderBy } from 'firebase/firestore';
import { useAppState } from '@/lib/context';

interface RegistrationsProps {
  isDarkMode: boolean;
  vehicles?: Vehicle[];
}

// Generate mock registrations logic removed

type RegistrationStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRING_CRITICAL';

const getStatus = (expiryDate: Date, today: Date): RegistrationStatus => {
  const daysUntilExpiry = differenceInDays(expiryDate, today);
  if (daysUntilExpiry <= 10) return 'EXPIRING_CRITICAL';
  if (daysUntilExpiry <= 30) return 'EXPIRING_SOON';
  return 'VALID';
};

export default function Registrations({ isDarkMode, vehicles = [] }: RegistrationsProps) {
  const getPlateColorByPlate = (plateStr: string) => {
    if (!plateStr || !vehicles) return null;
    const clean = plateStr.replace(/\s+/g, '').toUpperCase();
    const found = vehicles.find(v => (v.plate || '').replace(/\s+/g, '').toUpperCase() === clean);
    return found?.color || null;
  };

  const { registrations: appStateRegistrations = [], isDataLoading: globalLoading = false } = useAppState();
  
  const docs = useMemo(() => {
    return appStateRegistrations.map((reg) => ({
      ...reg,
      startDate: reg.startDate instanceof Timestamp ? (reg.startDate as any).toDate() : (reg.startDate ? new Date(reg.startDate as any) : undefined),
      expiryDate: reg.expiryDate instanceof Timestamp ? (reg.expiryDate as any).toDate() : (reg.expiryDate ? new Date(reg.expiryDate as any) : undefined),
    } as RentalRegistration));
  }, [appStateRegistrations]);

  const loading = globalLoading;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); 

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 40);
    return () => clearTimeout(timer);
  }, [searchQuery]); 
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<number | string | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState<string>('');
  const [newStartDate, setNewStartDate] = useState<string>('');
  const [newPlate, setNewPlate] = useState<string>('');
  const [newVehicleName, setNewVehicleName] = useState<string>('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  // Add Vehicle States
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    name: '',
    plate: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    expiryDate: format(addDays(new Date(), 365), 'yyyy-MM-dd')
  });

  // Date Tooltip State
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  // Registration Document States
  const [localDocs, setLocalDocs] = useState<Record<string, { id: string; name: string; dataUrl: string; uploadedAt: number }[]>>({});
  const [activeDocVehicleId, setActiveDocVehicleId] = useState<number | string | null>(null);
  const [activeDocVehicleName, setActiveDocVehicleName] = useState<string>('');
  const [activeDocVehiclePlate, setActiveDocVehiclePlate] = useState<string>('');
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);

  // Load documents from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vehicle-registration-docs');
      if (saved) {
        setLocalDocs(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load local documents:", e);
    }
  }, []);

  const saveLocalDocs = (newDocs: Record<string, { id: string; name: string; dataUrl: string; uploadedAt: number }[]>) => {
    setLocalDocs(newDocs);
    try {
      localStorage.setItem('vehicle-registration-docs', JSON.stringify(newDocs));
    } catch (e) {
      console.error("Failed to save local documents:", e);
      alert("Storage limit exceeded. Please remove some existing documents before uploading more.");
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const today = useMemo(() => new Date(), []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  const allVehicleDocs = useMemo(() => {
    // We want to list all active vehicles. If a document exists, use it.
    // If not, use an empty placeholder.
    const activeVehicles = vehicles.filter(v => !v.isRetired && !v.isExtra && v.name !== 'EXTRA' && !String(v.id).startsWith('extra-'));
    
    const merged = activeVehicles.map(v => {
      // Use string comparison for safety with Firestore IDs
      const vIdStr = String(v.id);
      const existingDoc = docs.find(d => String(d.vehicleId) === vIdStr);
      if (existingDoc) {
        // ALWAYS use current vehicle's name and plate to ensure complete synchronization with calendar grid
        return {
          ...existingDoc,
          plate: v.plate,
          vehicleName: v.name
        } as RentalRegistration;
      }
      
      // Placeholder if no doc exists
      return {
        id: `placeholder-${v.id}`,
        vehicleId: v.id,
        vehicleName: v.name,
        plate: v.plate,
        expiryDate: undefined,
        startDate: undefined
      } as RentalRegistration;
    });

    // Sort by expiry date ascending (least days remaining first)
    merged.sort((a, b) => {
      // Put empty/placeholder docs at the bottom
      if (!a.expiryDate && !b.expiryDate) return a.vehicleName.localeCompare(b.vehicleName);
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      
      // Sort by actual date
      return a.expiryDate.getTime() - b.expiryDate.getTime();
    });

    return merged;
  }, [docs, vehicles]);

  const filteredDocs = useMemo(() => {
    let result = [...allVehicleDocs];

    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(d => 
        d.vehicleName.toLowerCase().includes(q) || 
        d.plate.toLowerCase().includes(q)
      );
    }

    if (filterType !== 'ALL') {
      result = result.filter(d => {
        if (!d.expiryDate) return false;
        return getStatus(d.expiryDate, today) === filterType;
      });
    }

    return result;
  }, [debouncedSearchQuery, filterType, today, allVehicleDocs]);

  const { paginatedDocs, totalPages } = useMemo(() => {
    const total = Math.ceil(filteredDocs.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    return {
      paginatedDocs: filteredDocs.slice(start, start + itemsPerPage),
      totalPages: total || 1
    };
  }, [filteredDocs, currentPage, itemsPerPage]);

  const stats = useMemo(() => {
    let critical = 0;
    let expiringSoon = 0;
    let valid = 0;
    let total = 0;

    allVehicleDocs.forEach(d => {
      total++;
      if (!d.expiryDate) return;
      const status = getStatus(d.expiryDate, today);
      if (status === 'EXPIRING_CRITICAL') {
        critical++;
      } else if (status === 'EXPIRING_SOON') {
        expiringSoon++;
      } else {
        valid++;
      }
    });

    return { critical, expiringSoon, valid, total };
  }, [allVehicleDocs, today]);

  const handleAddVehicle = async () => {
    if (!newVehicle.name || !newVehicle.plate) return;

    try {
      const [year, month, day] = newVehicle.expiryDate.split('-').map(Number);
      const expDate = new Date(year, month - 1, day);
      
      const [sYear, sMonth, sDay] = newVehicle.startDate.split('-').map(Number);
      const startDate = new Date(sYear, sMonth - 1, sDay);

      await addDoc(collection(db, 'registrations'), {
        vehicleId: Date.now(),
        vehicleName: newVehicle.name,
        plate: newVehicle.plate,
        expiryDate: Timestamp.fromDate(expDate),
        startDate: Timestamp.fromDate(startDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setIsAddVehicleOpen(false);
      setNewVehicle({
        name: '',
        plate: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        expiryDate: format(addDays(new Date(), 365), 'yyyy-MM-dd')
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'registrations');
    }
  };

  return (
    <div className={cn(
      "flex-1 md:ml-[262px] h-screen transition-colors duration-500 p-4 md:pl-0 flex flex-col overflow-y-auto custom-scrollbar",
      isDarkMode ? "bg-[#1A1614]" : "bg-white"
    )}>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#FF5C35] border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black text-gray-400 tracking-[0.3em] uppercase">Loading Registrations...</p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-[1200px] lg:max-w-[1440px] xl:max-w-[1685px] 2xl:max-w-full mx-auto flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-2 shrink-0">
          <div className="ml-[5px] mr-[-5px]">
            <h1 className={cn(
              "text-3xl font-black tracking-tighter leading-none transition-colors",
              isDarkMode ? "text-white" : "text-[#0E0C0B]"
            )}>REGISTRATIONS</h1>
            <p className="text-[10px] font-black text-gray-400 tracking-[0.3em] uppercase mt-2">AUTOMATED REGISTRATION EXPIRY ALERTS</p>
          </div>
          <button 
            onClick={() => setIsAddVehicleOpen(true)}
            className="px-6 py-3 bg-[#FF5C35] text-white rounded-2xl font-black text-xs tracking-widest uppercase hover:bg-[#E04D2A] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#FF5C35]/20 flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-5 h-5 bg-white/20 rounded-lg flex items-center justify-center group-hover:rotate-90 transition-transform">
              <FileText className="w-3 h-3" />
            </div>
            ADD VEHICLE
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={cn(
            "rounded-[24px] p-5 border transition-all duration-300 flex flex-col gap-2",
            isDarkMode 
              ? "bg-white/5 border-t-2 border-l-2 border-t-white/10 border-l-white/10 border-r border-b border-white/5 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.05)]" 
              : "bg-gray-100/50 border-t-2 border-l-2 border-t-gray-300/40 border-l-gray-300/40 border-r border-b border-gray-200 shadow-[inset_2px_4px_8px_rgba(0,0,0,0.06),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)]"
          )}>
            <div className="flex items-center text-gray-500">
              <span className="text-[10px] font-black tracking-widest uppercase">Total Registrations</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className={cn("text-3xl font-black", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>{stats.total}</div>
              <FileText className="w-9 h-9 text-gray-400" />
            </div>
          </div>

          <div className={cn(
            "rounded-[24px] p-5 border transition-all duration-300 flex flex-col gap-2 relative overflow-hidden",
            isDarkMode 
              ? "bg-[#C62828]/10 border-t-2 border-l-2 border-t-[#C62828]/40 border-l-[#C62828]/40 border-r border-b border-[#C62828]/25 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.05)]" 
              : "bg-[#FFEBEE] border-t-2 border-l-2 border-t-[#EF9A9A]/60 border-l-[#EF9A9A]/60 border-r border-b border-[#FFCDD2] shadow-[inset_2px_4px_8px_rgba(198,40,40,0.14),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)]"
          )}>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#C62828]/10 rounded-full blur-2xl" />
            <div className="flex items-center text-[#C62828]">
              <span className="text-[8px] font-black tracking-tighter uppercase leading-none">EXPIRING IMMINENT (10D)</span>
            </div>
            <div className="flex items-center justify-between mt-1 z-10 w-full">
              <div className="text-3xl font-black text-[#C62828]">{stats.critical}</div>
              <AlertTriangle className="w-9 h-9 text-[#C62828] animate-pulse" />
            </div>
          </div>

          <div className={cn(
            "rounded-[24px] p-5 border transition-all duration-300 flex flex-col gap-2 relative overflow-hidden",
            isDarkMode 
              ? "bg-[#F57F17]/10 border-t-2 border-l-2 border-t-[#F57F17]/40 border-l-[#F57F17]/40 border-r border-b border-[#F57F17]/25 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.05)]" 
              : "bg-[#FFFDE7] border-t-2 border-l-2 border-t-[#FFF176]/80 border-l-[#FFF176]/80 border-r border-b border-[#FFF59D] shadow-[inset_2px_4px_8px_rgba(245,127,23,0.14),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)]"
          )}>
            <div className="flex items-center text-[#F57F17]">
              <span className="text-[8px] font-black tracking-tighter uppercase leading-none">EXPIRING SOON (&lt;30D)</span>
            </div>
            <div className="flex items-center justify-between mt-1 w-full">
              <div className="text-3xl font-black text-[#F57F17]">{stats.expiringSoon}</div>
              <Clock className="w-9 h-9 text-[#F57F17]" />
            </div>
          </div>

          <div className={cn(
            "rounded-[24px] p-5 border transition-all duration-300 flex flex-col gap-2",
            isDarkMode 
              ? "bg-[#2E7D32]/10 border-t-2 border-l-2 border-t-[#2E7D32]/40 border-l-[#2E7D32]/40 border-r border-b border-[#2E7D32]/25 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.6),_inset_-1px_-1px_3px_rgba(255,255,255,0.05)]" 
              : "bg-[#E8F5E9] border-t-2 border-l-2 border-t-[#81C784]/60 border-l-[#81C784]/60 border-r border-b border-[#C8E6C9] shadow-[inset_2px_4px_8px_rgba(46,125,50,0.14),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)]"
          )}>
            <div className="flex items-center text-[#2E7D32]">
              <span className="text-[8px] font-black tracking-tighter uppercase leading-none">VALID (&gt;30D)</span>
            </div>
            <div className="flex items-center justify-between mt-1 w-full">
              <div className="text-3xl font-black text-[#2E7D32]">{stats.valid}</div>
              <CheckCircle className="w-9 h-9 text-[#2E7D32]" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={cn(
          "rounded-[32px] border overflow-hidden flex flex-col flex-1 min-h-[500px] transition-all duration-500 mb-10",
          isDarkMode 
            ? "bg-[#2C2724] border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]" 
            : "bg-[#FCFAF5] border-[#F5F1E9] shadow-[0_20px_50px_rgba(0,0,0,0.06)]"
        )}>
          {/* Toolbar */}
          <div className={cn(
            "min-h-[70px] px-4 md:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b transition-colors",
            isDarkMode ? "border-white/5" : "border-[#F2EFE9]"
          )}>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={cn(
                  "bg-transparent outline-none text-xs font-bold cursor-pointer uppercase",
                  isDarkMode ? "text-white" : "text-[#0E0C0B]"
                )}
              >
                <option value="ALL">All Registrations</option>
                <option value="EXPIRING_CRITICAL">Critical (&lt;10 days)</option>
                <option value="EXPIRING_SOON">Soon (&lt;30 days)</option>
                <option value="VALID">Valid</option>
              </select>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Search vehicle or plate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-9 pr-4 py-2 rounded-xl border-2 transition-all outline-none font-bold text-xs",
                  isDarkMode 
                    ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]" 
                    : "bg-white border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                )}
              />
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar md:block hidden">
            <div className="min-w-[800px]">
              {/* Table Header */}
              <div className={cn(
                "px-8 py-4 flex items-center transition-colors",
                isDarkMode ? "bg-[#231F1D]" : "bg-[#F2EFE9]/60"
              )}>
                <div className="w-[20%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">VEHICLE</div>
                <div className="w-[20%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">REGISTRATION INFO</div>
                <div className="w-[20%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">REGISTRATION DOCUMENT</div>
                <div className="w-[20%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">EXPIRY DATE</div>
                <div className="w-[20%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center">STATUS</div>
              </div>

              {/* List */}
              <div className={cn(
                "flex-1 overflow-y-auto custom-scrollbar transition-colors",
                isDarkMode ? "bg-[#1A1614]" : "bg-transparent"
              )}>
                {paginatedDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 opacity-40">
                    <FileCheck className="w-12 h-12 mb-4" />
                    <p className="font-black text-sm tracking-widest uppercase">No registrations found</p>
                  </div>
                ) : (
                  paginatedDocs.map((docItem) => {
                    const status = docItem.expiryDate ? getStatus(docItem.expiryDate, today) : null;
                    const daysLeft = docItem.expiryDate ? differenceInDays(docItem.expiryDate, today) : null;
                    const isPlaceholder = docItem.id.startsWith('placeholder-');
                    
                    return (
                      <div key={docItem.id} className={cn(
                        "px-8 py-5 flex items-center border-b transition-colors group",
                        isDarkMode ? "border-black/40 hover:bg-white/5" : "border-black/10 hover:bg-black/5",
                        isPlaceholder && "opacity-60"
                      )}>
                        <div className="w-[20%]">
                          <p className={cn("font-black text-sm uppercase leading-none", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>{docItem.vehicleName}</p>
                          <div className="inline-flex items-center rounded-md border-2 border-black/30 bg-white px-2.5 py-1 mt-2.5 shadow-md hover:scale-105 transition-transform shrink-0 relative overflow-hidden text-black">
                            <div className="w-[5px] h-4 bg-blue-700 rounded-l-[2px] -ml-2.5 mr-2 shrink-0 flex flex-col justify-end pb-0.5 items-center" />
                            <span className={cn(
                              "text-xs md:text-sm font-mono font-extrabold tracking-wider uppercase leading-none select-all",
                              getPlateColorByPlate(docItem.plate) ? "pr-[15px]" : ""
                            )}>
                              {docItem.plate}
                            </span>
                            {(() => {
                              const col = getPlateColorByPlate(docItem.plate);
                              if (!col) return null;
                              return (
                                <div 
                                  className="absolute right-0 top-0 bottom-0 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[4px]"
                                  style={{ 
                                    width: '12px',
                                    backgroundColor: col
                                  }}
                                />
                              );
                            })()}
                          </div>
                        </div>
                        <div className="w-[20%] flex items-center gap-4">
                          <div className="relative">
                            <button 
                              onMouseEnter={() => docItem.expiryDate && setActiveTooltipId(docItem.id)}
                              onMouseLeave={() => setActiveTooltipId(null)}
                              onClick={() => {
                                if (isPlaceholder) {
                                  setEditingVehicleId(docItem.vehicleId);
                                  setEditingDocId(null);
                                  // Seed with today and +1 year automatically
                                  setNewExpiryDate(format(addYears(new Date(), 1), 'yyyy-MM-dd'));
                                  setNewStartDate(format(new Date(), 'yyyy-MM-dd'));
                                } else {
                                  setEditingDocId(docItem.id);
                                  setEditingVehicleId(docItem.vehicleId);
                                  const isValidExp = docItem.expiryDate instanceof Date && !isNaN(docItem.expiryDate.getTime());
                                  const isValidStart = docItem.startDate instanceof Date && !isNaN(docItem.startDate.getTime());
                                  setNewExpiryDate(isValidExp ? format(docItem.expiryDate as Date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
                                  setNewStartDate(isValidStart ? format(docItem.startDate as Date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
                                }
                                setNewPlate(docItem.plate || '');
                                setNewVehicleName(docItem.vehicleName || '');
                              }}
                              className={cn(
                                "w-11 h-11 rounded-xl flex items-center justify-center hover:scale-110 transition-all cursor-pointer shadow-lg relative overflow-hidden group",
                                isDarkMode ? "bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-500/20" : "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30",
                                isPlaceholder && "grayscale opacity-50"
                              )}
                            >
                              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
                              <Shield className="w-5 h-5 text-white relative z-10 drop-shadow-md" />
                            </button>
                            
                            {/* Start/End Date Tooltip */}
                            {activeTooltipId === docItem.id && docItem.expiryDate && (
                              <div className={cn(
                                "absolute left-full ml-2 top-1/2 -translate-y-1/2 z-[110] w-48 rounded-xl p-3 shadow-2xl border pointer-events-none transition-all animate-in fade-in zoom-in slide-in-from-left-2",
                                isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-100"
                              )}>
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">VALID FROM</p>
                                    <p className={cn("text-xs font-bold", isDarkMode ? "text-white" : "text-black")}>
                                      {docItem.startDate ? format(docItem.startDate, 'dd MMM yyyy') : 'N/A'}
                                    </p>
                                  </div>
                                  <div className="h-px bg-gray-500/10" />
                                  <div>
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">EXPIRES ON</p>
                                    <p className={cn("text-xs font-bold", isDarkMode ? "text-white" : "text-black")}>
                                      {format(docItem.expiryDate, 'dd MMM yyyy')}
                                    </p>
                                  </div>
                                </div>
                                <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 border-[6px] border-transparent border-r-current opacity-10" />
                              </div>
                            )}
                          </div>
                        </div>
                        {/* REGISTRATION DOCUMENT */}
                        <div className="w-[20%] flex items-center">
                          <button
                            onClick={() => {
                              setActiveDocVehicleId(docItem.vehicleId);
                              setActiveDocVehicleName(docItem.vehicleName);
                              setActiveDocVehiclePlate(docItem.plate);
                            }}
                            className={cn(
                              "w-11 h-11 rounded-xl flex items-center justify-center hover:scale-110 transition-all cursor-pointer shadow-lg relative overflow-hidden group",
                              isDarkMode ? "bg-gradient-to-br from-purple-500 to-purple-700 shadow-purple-500/20" : "bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/30"
                            )}
                          >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
                            <FileText className="w-5 h-5 text-white relative z-10 drop-shadow-md" />
                            {localDocs[docItem.vehicleId]?.length > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm scale-95">
                                {localDocs[docItem.vehicleId].length}
                              </span>
                            )}
                          </button>
                        </div>
                        <div className="w-[20%] text-center">
                          {docItem.expiryDate ? (
                            <>
                              <p className={cn(
                                "text-sm font-black tracking-tight",
                                status === 'EXPIRING_CRITICAL' ? "text-[#C62828]" : 
                                (status === 'EXPIRING_SOON' ? "text-[#F57F17]" : "text-gray-400")
                              )}>
                                {format(docItem.expiryDate, 'dd/MM/yyyy')}
                              </p>
                              <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mt-0.5">
                                {daysLeft !== null && (daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `In ${daysLeft} days`)}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs font-bold text-gray-300 uppercase italic">Empty</p>
                          )}
                        </div>
                        <div className="w-[20%] flex justify-center">
                          {status ? (
                            <span className={cn(
                              "px-4 py-1.5 rounded-full text-[9px] font-black tracking-[0.1em] flex items-center gap-2 border shadow-sm transition-all duration-500",
                              status === 'EXPIRING_CRITICAL' ? "bg-[#C62828] text-white border-white/20 animate-pulse-glowing" :
                              status === 'EXPIRING_SOON' ? (isDarkMode ? "bg-[#F57F17]/20 text-[#FFB300] border-[#F57F17]/30" : "bg-[#FFFDE7] text-[#F57F17] border-[#FFF59D]") :
                              (isDarkMode ? "bg-[#2E7D32]/20 text-[#81C784] border-[#2E7D32]/30" : "bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]")
                            )}>
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.2)]",
                                status === 'EXPIRING_CRITICAL' ? "bg-white" :
                                "bg-current"
                              )} />
                              {status === 'EXPIRING_CRITICAL' ? 'EXPIRING IMMINENT' : 
                               status === 'EXPIRING_SOON' ? 'EXPIRING SOON' : 'VALID'}
                            </span>
                          ) : (
                            <span className="px-4 py-1.5 rounded-full text-[9px] font-black tracking-[0.1em] border border-gray-100 text-gray-300 uppercase">
                              Incomplete
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Mobile Card List */}
          <div className="md:hidden flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {paginatedDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-40">
                <FileCheck className="w-12 h-12 mb-4" />
                <p className="font-black text-sm tracking-widest uppercase">No registrations found</p>
              </div>
            ) : (
              paginatedDocs.map((docItem) => {
                const status = (docItem.id && !docItem.id.startsWith('placeholder-') && docItem.expiryDate) ? getStatus(docItem.expiryDate, today) : null;
                const daysLeft = (docItem.id && !docItem.id.startsWith('placeholder-') && docItem.expiryDate) ? differenceInDays(docItem.expiryDate, today) : null;
                const isPlaceholder = docItem.id.startsWith('placeholder-');
                
                return (
                  <div 
                    key={docItem.id}
                    className={cn(
                      "p-5 rounded-[24px] border-2 transition-all flex flex-col gap-4",
                      isDarkMode ? "bg-[#1E1B1A] border-white/5" : "bg-white border-gray-100 shadow-sm",
                      isPlaceholder && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <h4 className={cn("font-black text-base uppercase", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                          {docItem.vehicleName}
                        </h4>
                        <div className="inline-flex items-center rounded-md border-2 border-black/30 bg-white px-2.5 py-1 shadow-md hover:scale-105 transition-transform w-fit text-black relative overflow-hidden">
                          <div className="w-[5px] h-4 bg-blue-700 rounded-l-[1px] -ml-2.5 mr-2 shrink-0" />
                          <span className={cn(
                            "text-xs font-mono font-extrabold tracking-wider uppercase leading-none",
                            getPlateColorByPlate(docItem.plate) ? "pr-[15px]" : ""
                          )}>
                            {docItem.plate}
                          </span>
                          {(() => {
                            const col = getPlateColorByPlate(docItem.plate);
                            if (!col) return null;
                            return (
                              <div 
                                className="absolute right-0 top-0 bottom-0 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[4px]"
                                style={{ 
                                  width: '12px',
                                  backgroundColor: col
                                }}
                              />
                            );
                          })()}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (isPlaceholder) {
                            setEditingVehicleId(docItem.vehicleId);
                            setEditingDocId(null);
                            setNewExpiryDate(format(addYears(new Date(), 1), 'yyyy-MM-dd'));
                            setNewStartDate(format(new Date(), 'yyyy-MM-dd'));
                          } else {
                            setEditingDocId(docItem.id);
                            setEditingVehicleId(docItem.vehicleId);
                            const isValidExp = docItem.expiryDate instanceof Date && !isNaN(docItem.expiryDate.getTime());
                            const isValidStart = docItem.startDate instanceof Date && !isNaN(docItem.startDate.getTime());
                            setNewExpiryDate(isValidExp ? format(docItem.expiryDate as Date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
                            setNewStartDate(isValidStart ? format(docItem.startDate as Date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
                          }
                          setNewPlate(docItem.plate || '');
                          setNewVehicleName(docItem.vehicleName || '');
                        }}
                        className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 cursor-pointer",
                          isDarkMode ? "bg-blue-600 text-white" : "bg-blue-500 text-white"
                        )}
                      >
                        <Shield className="w-6 h-6" />
                      </button>
                    </div>

                    {/* REGISTRATION DOCUMENT */}
                    <div className="flex items-center justify-between py-3 border-t border-dashed border-gray-200 dark:border-white/5">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">REGISTRATION DOCUMENT</span>
                      <button
                        onClick={() => {
                          setActiveDocVehicleId(docItem.vehicleId);
                          setActiveDocVehicleName(docItem.vehicleName);
                          setActiveDocVehiclePlate(docItem.plate);
                        }}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center hover:scale-110 transition-all cursor-pointer shadow-md relative overflow-hidden group",
                          isDarkMode ? "bg-gradient-to-br from-purple-500 to-purple-700 shadow-purple-500/20" : "bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/30"
                        )}
                      >
                        <FileText className="w-4 h-4 text-white drop-shadow-md" />
                        {localDocs[docItem.vehicleId]?.length > 0 && (
                          <span className="absolute -top-1 -right-1 bg-emerald-500 text-white font-black text-[8px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm scale-90">
                            {localDocs[docItem.vehicleId].length}
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-dashed border-gray-200 dark:border-white/5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">EXPIRY DATE</span>
                        <p className={cn(
                          "text-sm font-black",
                          status === 'EXPIRING_CRITICAL' ? "text-[#C62828]" : 
                          (status === 'EXPIRING_SOON' ? "text-[#F57F17]" : (isDarkMode ? "text-white" : "text-black"))
                        )}>
                          {docItem.expiryDate ? format(docItem.expiryDate, 'dd/MM/yyyy') : 'N/A'}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">TIMELINE</span>
                        <p className="text-xs font-bold text-gray-500">
                          {daysLeft !== null ? (daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `In ${daysLeft} days`) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "px-4 py-2 rounded-full text-[10px] font-black tracking-widest flex items-center gap-2 border shadow-sm",
                        status === 'EXPIRING_CRITICAL' ? "bg-[#C62828] text-white border-white/20 animate-pulse" :
                        status === 'EXPIRING_SOON' ? "bg-amber-100 text-amber-700 border-amber-200" :
                        "bg-emerald-100 text-emerald-700 border-emerald-200",
                        !status && "bg-gray-100 text-gray-400 border-gray-200"
                      )}>
                        <div className={cn("w-2 h-2 rounded-full", status === 'EXPIRING_CRITICAL' ? "bg-white animate-pulse" : "bg-current")} />
                        {status === 'EXPIRING_CRITICAL' ? 'EXPIRING IMMINENT' : 
                         status === 'EXPIRING_SOON' ? 'EXPIRING SOON' : (status ? 'VALID REGISTRATION' : 'INCOMPLETE')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className={cn(
                  "px-8 py-4 border-t flex items-center justify-between shrink-0 transition-colors",
                  isDarkMode ? "border-white/5 bg-[#231F1D]" : "border-[#F2EFE9] bg-[#F2EFE9]/40"
                )}>
                  <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={cn(
                        "p-2 rounded-xl border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                        isDarkMode ? "border-white/5 hover:bg-white/5 text-white" : "border-gray-200 hover:bg-gray-100 text-[#0E0C0B]"
                      )}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      {(() => {
                        let startPage = 1;
                        let endPage = totalPages;
                        if (totalPages > 5) {
                          startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                          endPage = startPage + 4;
                        }
                        return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((pageNum) => (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn(
                              "w-8 h-8 rounded-xl font-black text-[10px] transition-all cursor-pointer",
                              currentPage === pageNum
                                ? "bg-[#FF5C35] text-white shadow-lg shadow-[#FF5C35]/20"
                                : (isDarkMode ? "text-gray-400 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100")
                            )}
                          >
                            {pageNum}
                          </button>
                        ));
                      })()}
                    </div>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={cn(
                        "p-2 rounded-xl border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                        isDarkMode ? "border-white/5 hover:bg-white/5 text-white" : "border-gray-200 hover:bg-gray-100 text-[#0E0C0B]"
                      )}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
      
      {/* Add Vehicle Modal */}
      {isAddVehicleOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className={cn(
            "w-full max-w-lg rounded-[40px] p-10 shadow-[0_30px_100px_rgba(0,0,0,0.5)] border transition-all",
            isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-[#FF5C35]/10 rounded-[24px] flex items-center justify-center">
                <FileText className="w-7 h-7 text-[#FF5C35]" />
              </div>
              <div>
                <h2 className={cn("text-3xl font-black tracking-tight", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>Add Vehicle</h2>
                <p className="text-xs font-bold text-gray-400 tracking-widest uppercase">REGISTRATION & FLEET ENTRY</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase ml-4">Vehicle Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. AUDI A4 S-LINE"
                  value={newVehicle.name}
                  onChange={(e) => setNewVehicle({...newVehicle, name: e.target.value})}
                  className={cn(
                    "w-full px-6 py-4 rounded-[20px] border-2 transition-all outline-none font-bold text-sm",
                    isDarkMode 
                      ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]" 
                      : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase ml-4">Plate Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. SK-1234-AD"
                  value={newVehicle.plate}
                  onChange={(e) => setNewVehicle({...newVehicle, plate: e.target.value.toUpperCase()})}
                  className={cn(
                    "w-full px-6 py-4 rounded-[20px] border-2 transition-all outline-none font-bold text-sm uppercase",
                    isDarkMode 
                      ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]" 
                      : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase ml-4">Start Date</label>
                  <input 
                    type="date" 
                    value={newVehicle.startDate}
                    onChange={(e) => setNewVehicle({...newVehicle, startDate: e.target.value})}
                    className={cn(
                      "w-full px-6 py-4 rounded-[20px] border-2 transition-all outline-none font-bold text-sm",
                      isDarkMode 
                        ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]" 
                        : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase ml-4">Expiry Date</label>
                  <input 
                    type="date" 
                    value={newVehicle.expiryDate}
                    onChange={(e) => setNewVehicle({...newVehicle, expiryDate: e.target.value})}
                    className={cn(
                      "w-full px-6 py-4 rounded-[20px] border-2 transition-all outline-none font-bold text-sm",
                      isDarkMode 
                        ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]" 
                        : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                    )}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsAddVehicleOpen(false)}
                  className={cn(
                    "flex-1 py-5 rounded-[24px] font-black text-[11px] tracking-[0.2em] uppercase transition-all cursor-pointer",
                    isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  )}
                >
                  Discard
                </button>
                <button 
                  onClick={handleAddVehicle}
                  className="flex-[2] py-5 rounded-[24px] bg-[#FF5C35] text-white font-black text-[11px] tracking-[0.2em] uppercase hover:bg-[#E04D2A] transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-[#FF5C35]/30 cursor-pointer"
                >
                  Confirm & Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expiry Date Modal */}
      {(editingDocId || editingVehicleId) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className={cn(
            "w-full max-w-sm rounded-[32px] p-8 shadow-2xl border", // Reduced width and padding
            isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-200"
          )}>
            <div className="w-12 h-12 bg-[#FF5C35]/10 rounded-2xl flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-[#FF5C35]" />
            </div>
            <h2 className={cn("text-xl font-black mb-1", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>Update Vehicle Info</h2>
            <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase mb-6">MODIFY DOCUMENT DATA</p>
            
            <div className="flex flex-col gap-4">
              <div className="space-y-1.5 opacity-60">
                <label className="text-[9px] font-black text-gray-400 tracking-widest uppercase ml-4">Vehicle Name (Fixed)</label>
                <input 
                  type="text" 
                  value={newVehicleName}
                  readOnly
                  className={cn(
                    "w-full px-5 py-3 rounded-[16px] border-2 transition-all outline-none font-bold text-sm cursor-not-allowed",
                    isDarkMode 
                      ? "bg-white/5 border-white/5 text-gray-400" 
                      : "bg-gray-100 border-gray-200 text-gray-500"
                  )}
                />
              </div>

              <div className="space-y-1.5 opacity-60">
                <label className="text-[9px] font-black text-gray-400 tracking-widest uppercase ml-4">Plate Number (Fixed)</label>
                <input 
                  type="text" 
                  value={newPlate}
                  readOnly
                  className={cn(
                    "w-full px-5 py-3 rounded-[16px] border-2 transition-all outline-none font-bold text-sm uppercase cursor-not-allowed",
                    isDarkMode 
                      ? "bg-white/5 border-white/5 text-gray-400" 
                      : "bg-gray-100 border-gray-200 text-gray-500"
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[#FF5C35] tracking-widest uppercase ml-4">Start Date</label>
                  <input 
                    type="date" 
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 rounded-[16px] border-2 transition-all outline-none font-bold text-xs",
                      isDarkMode 
                        ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]" 
                        : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[#FF5C35] tracking-widest uppercase ml-4">Expiry Date</label>
                  <input 
                    type="date" 
                    value={newExpiryDate}
                    onChange={(e) => setNewExpiryDate(e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 rounded-[16px] border-2 transition-all outline-none font-bold text-xs",
                      isDarkMode 
                        ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]" 
                        : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                    )}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {
                    setEditingDocId(null);
                    setEditingVehicleId(null);
                  }}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-colors cursor-pointer",
                    isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  )}
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (newExpiryDate && newStartDate && newPlate && newVehicleName && (editingDocId || editingVehicleId)) {
                      try {
                        const [eYear, eMonth, eDay] = newExpiryDate.split('-').map(Number);
                        const localExpDate = new Date(eYear, eMonth - 1, eDay);
                        
                        const [sYear, sMonth, sDay] = newStartDate.split('-').map(Number);
                        const localStartDate = new Date(sYear, sMonth - 1, sDay);
                        
                        if (editingDocId) {
                          await updateDoc(doc(db, 'registrations', editingDocId), {
                            expiryDate: Timestamp.fromDate(localExpDate),
                            startDate: Timestamp.fromDate(localStartDate),
                            plate: newPlate.toUpperCase(),
                            vehicleName: newVehicleName,
                            updatedAt: serverTimestamp(),
                          });
                        } else if (editingVehicleId) {
                          // Create new registration for this vehicle
                          await addDoc(collection(db, 'registrations'), {
                            vehicleId: editingVehicleId,
                            vehicleName: newVehicleName,
                            plate: newPlate.toUpperCase(),
                            expiryDate: Timestamp.fromDate(localExpDate),
                            startDate: Timestamp.fromDate(localStartDate),
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                          });
                        }
                        
                        setEditingDocId(null);
                        setEditingVehicleId(null);
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, `registrations/${editingDocId || 'new'}`);
                      }
                    }
                  }}
                  className="flex-1 py-4 rounded-2xl bg-[#FF5C35] text-white font-black text-[10px] tracking-widest uppercase hover:bg-[#E04D2A] transition-colors shadow-lg shadow-[#FF5C35]/20 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registration Document Modal */}
      {activeDocVehicleId !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className={cn(
            "w-full max-w-xl rounded-[32px] p-8 shadow-2xl border flex flex-col max-h-[85vh]",
            isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <h2 className={cn("text-xl font-black leading-tight", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>Registration Documents</h2>
                  <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase mt-0.5">
                    {activeDocVehicleName} — {activeDocVehiclePlate}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveDocVehicleId(null);
                }}
                className={cn(
                  "p-2 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer",
                  isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-black"
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Gallery or Upload Dropzone */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 mb-6 space-y-6">
              {/* Image Grid */}
              {localDocs[activeDocVehicleId]?.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {localDocs[activeDocVehicleId].map((doc) => (
                    <div 
                      key={doc.id} 
                      className={cn(
                        "group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all shadow-md hover:shadow-lg",
                        isDarkMode ? "border-white/5 bg-white/5" : "border-gray-100 bg-gray-50"
                      )}
                    >
                      {/* Image Preview */}
                      <img 
                        src={doc.dataUrl} 
                        alt={doc.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      
                      {/* Action Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              setConfirmDeleteDocId(doc.id);
                            }}
                            className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-transform active:scale-90 cursor-pointer shadow-md"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-white">
                          <p className="text-[10px] font-black truncate" title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-[8px] opacity-70 mt-0.5">
                            {format(new Date(doc.uploadedAt), 'dd MMM yyyy')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Small add card in the grid */}
                  <label className={cn(
                    "aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:border-purple-500 hover:bg-purple-500/5",
                    isDarkMode ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"
                  )}>
                    <div className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Add Photo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      className="hidden" 
                      onChange={async (e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const files = Array.from(e.target.files);
                          const currentVehicleDocs = localDocs[activeDocVehicleId!] || [];
                          const uploaded: typeof currentVehicleDocs = [];

                          for (const file of files) {
                            try {
                              const base64 = await compressImage(file);
                              uploaded.push({
                                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                name: file.name,
                                dataUrl: base64,
                                uploadedAt: Date.now()
                              });
                            } catch (err) {
                              console.error("Compression error:", err);
                            }
                          }

                          if (uploaded.length > 0) {
                            saveLocalDocs({
                              ...localDocs,
                              [activeDocVehicleId!]: [...currentVehicleDocs, ...uploaded]
                            });
                          }
                        }
                      }}
                    />
                  </label>
                </div>
              ) : (
                /* Pure Empty State with Dropzone */
                <label className={cn(
                  "border-2 border-dashed rounded-[24px] p-8 flex flex-col items-center justify-center text-center gap-4 cursor-pointer transition-all hover:border-purple-500 hover:bg-purple-500/5 group min-h-[220px]",
                  isDarkMode ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"
                )}>
                  <div className="w-16 h-16 bg-purple-500/10 text-purple-500 rounded-[20px] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className={cn("text-sm font-black uppercase tracking-wider mb-1", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                      Upload Documents
                    </h3>
                    <p className="text-xs font-medium text-gray-400 max-w-[280px]">
                      Drag and drop your files or click to choose from your device (Photos & Images only)
                    </p>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                    onChange={async (e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const files = Array.from(e.target.files);
                        const currentVehicleDocs = localDocs[activeDocVehicleId!] || [];
                        const uploaded: typeof currentVehicleDocs = [];

                        for (const file of files) {
                          try {
                            const base64 = await compressImage(file);
                            uploaded.push({
                              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                              name: file.name,
                              dataUrl: base64,
                              uploadedAt: Date.now()
                            });
                          } catch (err) {
                            console.error("Compression error:", err);
                          }
                        }

                        if (uploaded.length > 0) {
                          saveLocalDocs({
                            ...localDocs,
                            [activeDocVehicleId!]: [...currentVehicleDocs, ...uploaded]
                          });
                        }
                      }
                    }}
                  />
                </label>
              )}
            </div>

            <div className="flex gap-3 shrink-0">
              <button 
                onClick={() => {
                  setActiveDocVehicleId(null);
                }}
                className={cn(
                  "w-full py-4 rounded-xl font-black text-xs tracking-widest uppercase transition-colors cursor-pointer text-center",
                  isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                Close Gallery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Document Deletion */}
      {confirmDeleteDocId !== null && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={cn(
            "w-full max-w-sm rounded-[32px] p-8 shadow-2xl border text-center animate-in zoom-in-95 duration-200",
            isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-200"
          )}>
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className={cn("text-lg font-black mb-2", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
              Delete Document?
            </h3>
            <p className="text-xs font-bold text-gray-400 leading-relaxed mb-6 uppercase tracking-wider">
              Are you sure you want to permanently delete this registration document? This operation cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConfirmDeleteDocId(null);
                }}
                className={cn(
                  "flex-1 py-3.5 rounded-xl font-black text-[10px] tracking-widest uppercase transition-colors cursor-pointer",
                  isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (activeDocVehicleId && confirmDeleteDocId) {
                    const currentVehicleDocs = localDocs[activeDocVehicleId] || [];
                    const filtered = currentVehicleDocs.filter(d => d.id !== confirmDeleteDocId);
                    saveLocalDocs({
                      ...localDocs,
                      [activeDocVehicleId]: filtered
                    });
                  }
                  setConfirmDeleteDocId(null);
                }}
                className="flex-1 py-3.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-[10px] tracking-widest uppercase transition-colors shadow-lg shadow-red-500/20 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
