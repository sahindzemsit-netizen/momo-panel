'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, X, CarFront, BookOpen, FileText, Pin, Trash2, Snowflake, Sun } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { format, addYears } from 'date-fns';
import { setDoc, doc, deleteDoc, addDoc, collection, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Vehicle, Reservation } from '@/types';
import { cn } from '@/lib/utils';
import { VEHICLE_COUNTRIES } from '@/lib/constants';

const MAIN_CAR_COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
  { name: 'Silver', value: '#C0C0C0' },
  { name: 'Gray', value: '#808080' },
  { name: 'Red', value: '#FF0000' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'Green', value: '#008000' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Brown', value: '#8B4513' },
  { name: 'Orange', value: '#FFA500' },
];

const MaskedCarIcon = ({ color, className, onClick }: { color: string, className?: string, onClick?: (e: React.MouseEvent) => void }) => (
  <div 
    className={cn(className)}
    onClick={onClick}
    style={{ 
      backgroundColor: color,
      maskImage: 'url(/car.png)',
      WebkitMaskImage: 'url(/car.png)',
      maskSize: 'contain',
      WebkitMaskSize: 'contain',
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskPosition: 'center'
    }}
  />
);

export interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  dbVehicles: Vehicle[];
  userReservations: Reservation[];
  tyreTypes: Record<string, 'summer' | 'winter'>;
  handleStatusClick: (e: React.MouseEvent, car: Vehicle) => void;
  getTextColorForBg: (bgColor?: string) => string;
}

export const AddVehicleModal = ({
  isOpen,
  onClose,
  isDarkMode,
  dbVehicles,
  userReservations,
  tyreTypes,
  handleStatusClick,
  getTextColorForBg,
}: AddVehicleModalProps) => {
  // Modal internal input states
  const [fleetModalTab, setFleetModalTab] = useState<'add' | 'remove'>('add');
  const [fleetModalError, setFleetModalError] = useState<string | null>(null);
  const [newCarName, setNewCarName] = useState('');
  const [newCarPlate, setNewCarPlate] = useState('');
  const [newCarChassis, setNewCarChassis] = useState('');
  const [newCarTransmission, setNewCarTransmission] = useState<'Automatic' | 'Manual'>('Automatic');
  const [newCarColor, setNewCarColor] = useState<string>('#FFFFFF');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [newCarCountry, setNewCarCountry] = useState<string>('Macedonia');
  const [newCarRegStart, setNewCarRegStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newCarRegEnd, setNewCarRegEnd] = useState(format(addYears(new Date(), 1), 'yyyy-MM-dd'));
  const [isAddingCar, setIsAddingCar] = useState(false);
  const [isRemovingCar, setIsRemovingCar] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showExtraCountriesDropdown, setShowExtraCountriesDropdown] = useState(false);
  const [floatingPlusOnes, setFloatingPlusOnes] = useState<{ id: number; text: string; x: number; y: number }[]>([]);

  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCarName || !newCarPlate) return;

    setIsAddingCar(true);
    const id = Date.now();
    const newCar: Vehicle = {
      id,
      name: newCarName,
      plate: newCarPlate,
      chassisNumber: newCarChassis,
      transmission: newCarTransmission,
      color: newCarColor,
      country: newCarCountry,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      await setDoc(doc(db, 'vehicles', String(id)), newCar);
      
      // Auto-populate registrations tab
      if (newCarRegStart && newCarRegEnd) {
        try {
          const [sYear, sMonth, sDay] = newCarRegStart.split('-').map(Number);
          const startDate = new Date(sYear, sMonth - 1, sDay);
          
          const [eYear, eMonth, eDay] = newCarRegEnd.split('-').map(Number);
          const expiryDate = new Date(eYear, eMonth - 1, eDay);

          await addDoc(collection(db, 'registrations'), {
            vehicleId: id,
            vehicleName: newCarName,
            plate: newCarPlate,
            startDate: Timestamp.fromDate(startDate),
            expiryDate: Timestamp.fromDate(expiryDate),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (regErr) {
          console.error("Error creating registration entry:", regErr);
          // Don't fail the whole car addition if registration fails
        }
      }

      setNewCarName('');
      setNewCarPlate('');
      setNewCarChassis('');
      setNewCarTransmission('Automatic');
      // Reset registration dates
      setNewCarRegStart(format(new Date(), 'yyyy-MM-dd'));
      setNewCarRegEnd(format(addYears(new Date(), 1), 'yyyy-MM-dd'));
      onClose();
    } catch (err: unknown) {
      const error = err as { code?: string, message?: string };
      if (error.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.CREATE, 'vehicles');
      } else {
        console.error("Error adding vehicle:", err);
        setFleetModalError("Failed to add vehicle to Firestore.");
      }
    } finally {
      setIsAddingCar(false);
    }
  };

  const handleRemoveCar = async (carId: number) => {
    setIsRemovingCar(carId);
    setFleetModalError(null);
    
    // Check for active reservations (don't allow retiring if car is currently out or booked for future)
    const hasActiveReservations = userReservations.some(res => 
      String(res.vehicleId) === String(carId) && 
      (res.status === 'UPCOMING' || res.status === 'ON RENT')
    );

    if (hasActiveReservations) {
      setFleetModalError("Cannot remove vehicle with active/upcoming rentals. Finish those first.");
      setIsRemovingCar(null);
      return;
    }

    try {
      // Check if it's a sample car (ID 1-20) or if we want a hard delete
      const isSampleCar = typeof carId === 'number' && carId >= 1 && carId <= 20;
      
      if (isSampleCar) {
        await deleteDoc(doc(db, 'vehicles', String(carId)));
      } else {
        // Soft-delete for custom cars: mark as isRetired so history is preserved
        await updateDoc(doc(db, 'vehicles', String(carId)), {
          isRetired: true
        });
      }
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      const error = err as { code?: string, message?: string };
      if (error.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, 'vehicles');
      } else {
        console.error("Error retiring vehicle:", err);
        setFleetModalError("Failed to remove vehicle.");
      }
    } finally {
      setIsRemovingCar(null);
    }
  };

  const handlePurgeSampleFleet = async () => {
    if (!confirm("This will permanently remove the 20 pre-defined sample cars. Your custom added cars will remain. Continue?")) return;
    
    setIsRemovingCar(-1); // special state for purge
    setFleetModalError(null);
    
    try {
      const sampleIds = Array.from({ length: 20 }, (_, i) => String(i + 1));
      for (const id of sampleIds) {
        // Check if there are active reservations first (safety)
        const hasRents = userReservations.some(r => String(r.vehicleId) === id && r.status !== 'CANCELLED' && r.status !== 'COMPLETED');
        if (!hasRents) {
          await deleteDoc(doc(db, 'vehicles', id));
        }
      }
      setFleetModalTab('add');
    } catch (err) {
      console.error("Error purging sample fleet:", err);
      setFleetModalError("Failed to purge some sample cars. They might have active rentals.");
    } finally {
      setIsRemovingCar(null);
    }
  };

  const handleAddExtraCar = async (country: string) => {
    const id = `extra-${country.toLowerCase()}-${Date.now()}`;
    const newCar = {
      id,
      name: 'EXTRA',
      plate: '',
      color: '#808080',
      country: country,
      transmission: 'Manual',
      isExtra: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    try {
      await setDoc(doc(db, 'vehicles', id), newCar);
    } catch (err) {
      console.error("Error adding EXTRA row car:", err);
    }
  };

  const triggerPlusOne = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setFloatingPlusOnes(prev => [
      ...prev,
      {
        id,
        text: "+1",
        x: rect.left + rect.width / 2,
        y: rect.top,
      }
    ]);
    setTimeout(() => {
      setFloatingPlusOnes(prev => prev.filter(item => item.id !== id));
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn(
          "relative w-full max-w-2xl rounded-[32px] shadow-2xl border p-6 flex flex-col overflow-hidden",
          isDarkMode ? "bg-[#2C2724] border-white/10" : "bg-white border-gray-100"
        )}
        style={{ maxHeight: 'calc(100vh - 40px)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={cn("text-2xl font-black tracking-tight flex items-center gap-2", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
              {fleetModalTab === 'add' ? (
                <span className="flex items-center gap-2">
                  ADD NEW VEHICLE
                  <button 
                    type="button"
                    onClick={() => setShowExtraCountriesDropdown(!showExtraCountriesDropdown)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-[#FF5C35] text-white hover:scale-110 active:scale-95 shadow-md shadow-[#FF5C35]/20 cursor-pointer"
                    title="Add EXTRA Rows"
                  >
                    <Plus className={cn("w-4 h-4 transition-transform duration-300", showExtraCountriesDropdown ? "rotate-45" : "rotate-0")} />
                  </button>
                </span>
              ) : (
                'REMOVE VEHICLE'
              )}
            </h2>
            <p className="text-[10px] font-bold text-[#FF5C35] tracking-[0.2em] uppercase mt-1">FLEET MANAGEMENT</p>
          </div>
          <button 
            onClick={onClose}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all hover:rotate-90",
              isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-[#0E0C0B] hover:bg-gray-200"
            )}
          >
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        {/* Extra Countries collapsible section */}
        <AnimatePresence>
          {showExtraCountriesDropdown && fleetModalTab === 'add' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={cn(
                "overflow-hidden border-b mb-4 pb-4 px-2 flex flex-col gap-2 rounded-2xl",
                isDarkMode ? "bg-black/10 border-white/5" : "bg-gray-50 border-gray-100"
              )}
            >
              <p className="text-[9px] font-black tracking-widest text-[#FF5C35] uppercase mb-1">Add EXTRA Row (Unassigned Booking Buffer)</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {['Macedonia', 'Kosovo', 'Albania', 'Bosnia', 'Montenegro'].map((country) => (
                  <div 
                    key={country}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl border flex items-center justify-between transition-all gap-1.5",
                      isDarkMode ? "bg-[#1E1B1A] border-white/5 text-white" : "bg-white border-gray-100 text-[#0E0C0B]"
                    )}
                  >
                    <span className="text-[10px] font-black uppercase truncate">{country}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        triggerPlusOne(e);
                        handleAddExtraCar(country);
                      }}
                      className="w-5 h-5 rounded-lg bg-[#FF5C35] text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className={cn(
          "flex p-1 rounded-2xl mb-2",
          isDarkMode ? "bg-black/20" : "bg-gray-100"
        )}>
          <button
            onClick={() => { setFleetModalTab('add'); setFleetModalError(null); }}
            className={cn(
              "flex-1 py-2 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all",
              fleetModalTab === 'add' 
                ? "bg-[#FF5C35] text-white shadow-lg" 
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            Add Car
          </button>
          <button
            onClick={() => { setFleetModalTab('remove'); setFleetModalError(null); }}
            className={cn(
              "flex-1 py-1.5 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all",
              fleetModalTab === 'remove' 
                ? "bg-[#FF5C35] text-white shadow-lg" 
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            Remove Car
          </button>
        </div>

        {fleetModalError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-in fade-in zoom-in">
            <p className="text-[10px] font-bold text-red-500 text-center uppercase tracking-wider">
              {fleetModalError}
            </p>
          </div>
        )}

        {fleetModalTab === 'add' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <form onSubmit={handleAddCar} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">Vehicle Name / Model</label>
                  <div className="relative">
                    <CarFront className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                    <input
                      required
                      type="text"
                      value={newCarName}
                      onChange={(e) => {
                        const val = e.target.value;
                        const capitalized = val.split(' ').map(word => 
                          word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''
                        ).join(' ');
                        setNewCarName(capitalized);
                      }}
                      placeholder="e.g. BMW X5 M"
                      className={cn(
                        "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                        isDarkMode 
                          ? "bg-[#1E1B1A] border-white/5 text-white focus:border-[#FF5C35]" 
                          : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">License Plate</label>
                  <div className="relative">
                    <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                    <input
                      required
                      type="text"
                      value={newCarPlate}
                      onChange={(e) => setNewCarPlate(e.target.value.toUpperCase())}
                      placeholder="SK-0000-AA"
                      className={cn(
                        "w-full pl-11 pr-12 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                        isDarkMode 
                          ? "bg-[#1E1B1A] border-white/5 text-white focus:border-[#FF5C35]" 
                          : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                      )}
                    />
                    <div 
                      onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-black/10 cursor-pointer shadow-sm transition-transform hover:scale-110 active:scale-95 z-20"
                      style={{ backgroundColor: newCarColor }}
                      title="Click to select color"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">Chassis Number (VIN)</label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                    <input
                      type="text"
                      value={newCarChassis}
                      onChange={(e) => setNewCarChassis(e.target.value.toUpperCase())}
                      placeholder="VIN NUMBER"
                      className={cn(
                        "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                        isDarkMode 
                          ? "bg-[#1E1B1A] border-white/5 text-white focus:border-[#FF5C35]" 
                          : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 flex flex-col">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">Transmission</label>
                    <div className={cn(
                      "flex p-1 rounded-2xl h-[46px] w-full",
                      isDarkMode ? "bg-black/20" : "bg-gray-100"
                    )}>
                      <button
                        type="button"
                        onClick={() => setNewCarTransmission('Automatic')}
                        className={cn(
                          "flex-1 py-1 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all",
                          newCarTransmission === 'Automatic' 
                            ? "bg-[#FF5C35] text-white shadow-lg font-black" 
                            : "text-gray-400 hover:text-gray-600 font-bold"
                        )}
                      >
                        Auto
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCarTransmission('Manual')}
                        className={cn(
                          "flex-1 py-1 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all",
                          newCarTransmission === 'Manual' 
                            ? "bg-[#FF5C35] text-white shadow-lg font-black" 
                            : "text-gray-400 hover:text-gray-600 font-bold"
                        )}
                      >
                        Man
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">CAR COLOR</label>
                    <button
                      type="button"
                      onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                      className={cn(
                        "w-full h-[46px] rounded-2xl border-2 flex items-center justify-center transition-all bg-gray-50 hover:bg-gray-100 active:scale-95",
                        isDarkMode 
                          ? "bg-[#1E1B1A] border-white/5" 
                          : "border-gray-100"
                      )}
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <MaskedCarIcon 
                          color={newCarColor}
                          className="w-4 h-4" 
                        />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isColorPickerOpen && (
                        <>
                          <div className="fixed inset-0 z-[160]" onClick={() => setIsColorPickerOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className={cn(
                              "absolute top-full left-0 right-0 mt-2 p-3 rounded-2xl shadow-2xl border z-[161] grid grid-cols-5 gap-2-safe",
                              "grid grid-cols-5 gap-2",
                              isDarkMode ? "bg-[#2C2724] border-white/10 opacity-100" : "bg-white border-gray-100 opacity-100"
                            )}
                          >
                            {MAIN_CAR_COLORS.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                onClick={() => {
                                  setNewCarColor(color.value);
                                  setIsColorPickerOpen(false);
                                }}
                                title={color.name}
                                className={cn(
                                  "w-full aspect-square rounded-full border-2 transition-transform hover:scale-110 cursor-pointer",
                                  newCarColor === color.value ? "border-[#FF5C35]" : "border-transparent"
                                )}
                                style={{ backgroundColor: color.value }}
                              />
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">Registration Start / End Date</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={newCarRegStart}
                      onChange={(e) => setNewCarRegStart(e.target.value)}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-xs",
                        isDarkMode 
                          ? "bg-[#1E1B1A] border-white/5 text-white focus:border-[#FF5C35]" 
                          : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                      )}
                    />
                    <input
                      type="date"
                      value={newCarRegEnd}
                      onChange={(e) => setNewCarRegEnd(e.target.value)}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-xs",
                        isDarkMode 
                          ? "bg-[#1E1B1A] border-white/5 text-white focus:border-[#FF5C35]" 
                          : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">Office / Country</label>
                  <div className="relative">
                    <Pin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF9F00]" />
                    <select
                      value={newCarCountry}
                      onChange={(e) => setNewCarCountry(e.target.value)}
                      className={cn(
                        "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm appearance-none",
                        isDarkMode 
                          ? "bg-[#1E1B1A] border-white/5 text-white focus:border-[#FF5C35]" 
                          : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]"
                      )}
                    >
                      {VEHICLE_COUNTRIES.map(country => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAddingCar}
                className={cn(
                  "w-full py-3.5 mt-4 mb-0 rounded-2xl font-black text-sm tracking-[0.2em] shadow-2xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3 text-white border-b-4 cursor-pointer disabled:opacity-50",
                  isDarkMode ? "bg-[#FF5C35] border-[#C84528]" : "bg-[#0E0C0B] border-black/50"
                )}
              >
                {isAddingCar ? 'ADDING TO FLEET...' : 'ADD VEHICLE'}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-visible">
            {dbVehicles.some(v => typeof v.id === 'number' && v.id >= 1 && v.id <= 20) && (
              <button
                onClick={handlePurgeSampleFleet}
                disabled={isRemovingCar === -1}
                className="mb-4 w-full py-3 bg-red-600 text-white rounded-full font-black text-[10px] tracking-widest uppercase shadow-lg hover:scale-[1.02] active:scale-90 transition-all border-2 border-red-800/30 disabled:opacity-50"
              >
                {isRemovingCar === -1 ? 'PURGING...' : 'PURGE ALL 20 SAMPLE CARS'}
              </button>
            )}
            <div className="flex-1 min-h-0 relative">
              <Virtuoso
                style={{ height: '100%' }}
                data={dbVehicles.filter((v: Vehicle) => !v.isRetired && !v.isExtra && v.name !== 'EXTRA' && !String(v.id).startsWith('extra-'))}
                className="custom-scrollbar pr-2"
                itemContent={(index, car) => {
                  const tyreType = tyreTypes[String(car.id)] || 'summer';
                  const isFirst = index === 0;
                  return (
                    <div className="pb-3">
                      <div 
                        className={cn(
                          "p-2.5 pl-2 rounded-[28px] border-2 flex items-center justify-between group transition-all relative hover:z-[100]",
                          isDarkMode ? "bg-black/20 border-white/5 hover:border-[#FF5C35]/30" : "bg-gray-50 border-gray-100 hover:border-[#FF5C35]/30"
                        )}
                      >
                        <div className="flex flex-col gap-0.5 relative items-start">
                          <div className="absolute right-11 top-1/2 -translate-y-1/2 z-[30] flex items-center justify-center w-[34px] h-[34px] pointer-events-auto -ml-[5px]" style={{ width: '34px', height: '34px', marginLeft: '-5px' }}>
                            <button
                              onClick={(e) => handleStatusClick(e, car)}
                              className={cn(
                                "w-[34px] h-[34px] -ml-[5px] flex items-center justify-center cursor-pointer rounded-full relative group/brand select-none transition-all",
                                car.statusNote 
                                  ? "shadow-md opacity-100" 
                                  : isDarkMode
                                    ? "opacity-85 border border-neutral-700 shadow-sm"
                                    : "opacity-85 border border-[#CCCCCC] shadow-sm"
                              )}
                              style={{
                                width: '34px',
                                height: '34px',
                                marginLeft: '-5px',
                                backgroundColor: car.statusNote ? (car.statusColor || '#FF5C35') : '#FFFFFF'
                              }}
                            >
                              {car.statusNote && (
                                <div className={cn(
                                  "absolute left-1/2 -translate-x-1/2 px-3 py-2 rounded-xl text-[10px] font-black shadow-[0_20px_50px_rgba(0,0,0,0.4)] opacity-0 group-hover/brand:opacity-100 transition-all duration-150 pointer-events-none whitespace-normal min-w-[140px] max-w-[220px] z-[99999] border text-center scale-95 group-hover/brand:scale-100 uppercase tracking-wide",
                                  isFirst ? "top-full mt-2" : "bottom-full mb-2",
                                  isDarkMode ? "border-white/10" : "border-black/5"
                                )}
                                style={{
                                  backgroundColor: car.statusColor || '#FF5C35',
                                  color: getTextColorForBg(car.statusColor || '#FF5C35')
                                }}
                                >
                                  <div className="relative">
                                    {car.statusNote}
                                    <div className={cn(
                                      "absolute left-1/2 -translate-x-1/2 border-[6px] border-transparent",
                                      isFirst ? "-top-[12px] border-b-[6px]" : "-bottom-[12px] border-t-[6px]"
                                    )} 
                                    style={isFirst ? { borderBottomColor: car.statusColor || '#FF5C35' } : { borderTopColor: car.statusColor || '#FF5C35' }}
                                    />
                                  </div>
                                </div>
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 pr-6">
                            <div
                              className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center shadow-sm shrink-0 border border-white/10",
                                tyreType === 'winter' 
                                  ? "bg-blue-500 text-white" 
                                  : "bg-[#FF9F00] text-white"
                              )}
                            >
                              {tyreType === 'winter' ? <Snowflake className="w-2.5 h-2.5 fill-current" /> : <Sun className="w-2.5 h-2.5 fill-current" />}
                            </div>
                            <h4 className={cn(
                              "font-black text-sm uppercase tracking-tight",
                              isDarkMode ? "text-white" : "text-[#0E0C0B]"
                            )}>{car.name}</h4>
                          </div>

                          <div className="flex items-center gap-1">
                            <div className="inline-flex items-center rounded-md border-2 border-black/30 bg-white px-2 py-0.5 shadow-md shrink-0 text-black relative overflow-hidden">
                              <div className="w-[3.5px] h-3 bg-blue-700 rounded-l-[1px] -ml-2 mr-1.5 shrink-0" />
                              <span className={cn(
                                "text-xs font-mono font-black tracking-wider uppercase leading-none",
                                car.color ? "pr-[14px]" : ""
                              )}>
                                {car.plate}
                              </span>
                              {car.color && (
                                <div 
                                  className="absolute right-0 top-0 bottom-0 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[4px]"
                                  style={{ 
                                    width: '12px',
                                    backgroundColor: car.color
                                  }}
                                />
                              )}
                            </div>
                            <div className="w-5 h-5 rounded-full bg-white border border-black/10 flex items-center justify-center shadow-sm shrink-0">
                              <span className="font-black text-[11px] text-black leading-none">
                                {car.transmission === 'Manual' ? 'M' : 'A'}
                              </span>
                            </div>
                          </div>

                          {car.chassisNumber && (
                            <p className="text-[8px] font-mono opacity-80 uppercase tracking-widest leading-none truncate ml-0.5">
                              VIN: {car.chassisNumber}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {confirmDeleteId === car.id ? (
                            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
                              <button
                                onClick={() => handleRemoveCar(car.id)}
                                disabled={isRemovingCar === car.id}
                                className="px-3 py-1.5 bg-red-500 text-white text-[10px] font-black rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                              >
                                {isRemovingCar === car.id ? "..." : "CONFIRM"}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className={cn(
                                  "px-3 py-1.5 text-[10px] font-black rounded-lg transition-colors cursor-pointer",
                                  isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                )}
                              >
                                CANCEL
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(car.id)}
                              className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 cursor-pointer",
                                isDarkMode ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-red-50 text-red-500 hover:bg-red-100"
                              )}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              {dbVehicles.filter(v => !v.isRetired && !v.isExtra && v.name !== 'EXTRA' && !String(v.id).startsWith('extra-')).length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400 font-bold text-sm italic">No vehicles in fleet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Floating Plus Ones Overlay for visual feedback */}
      <div className="fixed inset-0 pointer-events-none z-[99999]">
        {floatingPlusOnes.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, y: p.y, x: p.x, scale: 1 }}
            animate={{ opacity: 0, y: p.y - 120, scale: 1.5 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute font-black text-2xl text-[#FF5C35] pointer-events-none drop-shadow-md select-none"
            style={{ left: p.x, top: p.y, transform: 'translate(-50%, -50%)' }}
          >
            {p.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
};
