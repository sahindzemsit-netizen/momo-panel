'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAppState } from '@/lib/context';
import { 
  Settings, 
  Wrench, 
  Gauge, 
  Droplet, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Edit, 
  Check, 
  X, 
  ChevronLeft,
  ChevronRight,
  RefreshCw, 
  Car as CarIcon,
  ChevronsUp,
  Save,
  Fuel
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc, setDoc, query, orderBy, writeBatch } from 'firebase/firestore';
import { Vehicle, Reservation, Car } from '@/types';
import { format } from 'date-fns';
import { VEHICLE_COUNTRIES, COUNTRY_COLORS } from '@/lib/constants';

interface ServicePanelProps {
  isDarkMode: boolean;
  vehicles?: Vehicle[];
  userReservations?: Reservation[];
}

export default function ServicePanel({ 
  isDarkMode, 
  vehicles = [], 
  userReservations = [] 
}: ServicePanelProps) {
  const { user, isAdmin, isLoading: contextLoading } = useAppState();

  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatusMessage, setProcessStatusMessage] = useState<string | null>(null);

  // Filtering & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedOilStatus, setSelectedOilStatus] = useState<'FRESH' | 'GOOD' | 'DEGRADED' | null>(null);

  // Reset oil status filter when other filters change
  useEffect(() => {
    setSelectedOilStatus(null);
  }, [selectedCountry, searchQuery]);

  // Helper matching car to its corresponding country
  const getCarCountry = (car: Car) => {
    if (!vehicles) return null;
    const vehicle = vehicles.find(v => 
      String(v.id) === String(car.vehicleId) || 
      (v.plate && car.plate && v.plate.replace(/\s+/g, '').toUpperCase() === car.plate.replace(/\s+/g, '').toUpperCase())
    );
    return vehicle?.country ?? null;
  };

  // Filter out extra cars (where name is "EXTRA", starts with "extra-", or isExtra is true)
  const carsFiltered = useMemo(() => {
    return cars.filter(car => {
      // Find matching vehicle
      const vehicle = vehicles.find(v => 
        String(v.id) === String(car.vehicleId) || 
        (v.plate && car.plate && v.plate.replace(/\s+/g, '').toUpperCase() === car.plate.replace(/\s+/g, '').toUpperCase())
      );
      
      if (vehicle) {
        if (vehicle.isExtra || vehicle.name === 'EXTRA' || String(vehicle.id).startsWith('extra-')) {
          return false;
        }
      }
      
      if (car.name === 'EXTRA' || String(car.vehicleId).startsWith('extra-') || String(car.id).startsWith('extra-')) {
        return false;
      }
      
      return true;
    });
  }, [cars, vehicles]);

  // Pre-calculated vehicles counts by country using the unfiltered list (now filtered to exclude extras)
  const vehicleCountsByCountry = useMemo(() => {
    const counts: Record<string, number> = {
      Macedonia: 0,
      Kosovo: 0,
      Albania: 0,
      Bosnia: 0,
      Montenegro: 0,
    };
    carsFiltered.forEach(car => {
      const country = getCarCountry(car);
      if (country && country in counts) {
        counts[country]++;
      }
    });
    return counts;
  }, [carsFiltered, vehicles]);

  // Filtered cars before applying the oil status filter (used for stats calculation)
  const preStatusFilteredCars = useMemo(() => {
    let result = [...carsFiltered];

    if (selectedCountry) {
      result = result.filter(car => getCarCountry(car) === selectedCountry);
    }

    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase().trim();
      result = result.filter(car => 
        (car.name || '').toLowerCase().includes(queryLower) || 
        (car.plate || '').toLowerCase().includes(queryLower)
      );
    }

    return result;
  }, [carsFiltered, vehicles, selectedCountry, searchQuery]);

  // Combined filters including oil status
  const filteredCars = useMemo(() => {
    let result = [...preStatusFilteredCars];

    if (selectedOilStatus) {
      result = result.filter(car => {
        const recent = car.recentKm ?? car.odometer ?? 0;
        if (selectedOilStatus === 'FRESH') {
          return recent <= 15000;
        } else if (selectedOilStatus === 'GOOD') {
          return recent > 15000 && recent <= 19500;
        } else if (selectedOilStatus === 'DEGRADED') {
          return recent > 19500;
        }
        return true;
      });
    }

    return result;
  }, [preStatusFilteredCars, selectedOilStatus]);

  // Editing state
  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [editRecentKm, setEditRecentKm] = useState<string>('');
  const [editOilDate, setEditOilDate] = useState<string>('');
  const [isLoggingOilChange, setIsLoggingOilChange] = useState<boolean>(false);
  const [isEditingOdometer, setIsEditingOdometer] = useState<boolean>(false);
  const [editOdometer, setEditOdometer] = useState<string>('');
  const [activeHistoryCarId, setActiveHistoryCarId] = useState<string | null>(null);

  const activeHistoryCar = useMemo(() => {
    return activeHistoryCarId ? cars.find(c => c.id === activeHistoryCarId) : null;
  }, [activeHistoryCarId, cars]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = useMemo(() => {
    return Math.ceil(filteredCars.length / itemsPerPage) || 1;
  }, [filteredCars.length, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredCars.length, totalPages, currentPage]);

  const paginatedCars = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCars.slice(start, start + itemsPerPage);
  }, [filteredCars, currentPage, itemsPerPage]);

  const fetchCars = async () => {
    try {
      const q = query(collection(db, 'cars'), orderBy('plate', 'asc'));
      const snapshot = await getDocs(q);
      const carsData: Car[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Car));

      // Sort vehicles by kilometers descending so that those needing attention are on top
      const sorted = [...carsData].sort((a, b) => {
        const valueA = a.recentKm ?? a.odometer ?? 0;
        const valueB = b.recentKm ?? b.odometer ?? 0;
        return valueB - valueA;
      });

      setCars(sorted);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.LIST, 'cars');
    } finally {
      setLoading(false);
    }
  };

  // 1. Fetch cars from Firestore once on mount and sort descending by kilometers driven
  useEffect(() => {
    fetchCars();
  }, []);

  // 2. Identify active vehicles and auto-initialize them in the "cars" collection if missing
  const activeVehicles = useMemo(() => {
    return vehicles.filter(v => 
      !v.isRetired && 
      !v.isExtra && 
      v.name !== 'EXTRA' && 
      !String(v.id).startsWith('extra-')
    );
  }, [vehicles]);

  useEffect(() => {
    if (loading || activeVehicles.length === 0) return;

    const initializeMissingCars = async () => {
      const batch = writeBatch(db);
      let needsBatchCommit = false;

      for (const vehicle of activeVehicles) {
        const vehicleIdStr = String(vehicle.id);
        const existingCar = cars.find(c => String(c.vehicleId) === vehicleIdStr);

        if (!existingCar) {
          needsBatchCommit = true;
          const carDocRef = doc(db, 'cars', vehicleIdStr);
          batch.set(carDocRef, {
            vehicleId: vehicle.id,
            name: vehicle.name,
            plate: vehicle.plate,
            transmission: vehicle.transmission || 'Manual',
            odometer: 0,
            recentKm: 0,
            lastOilChangeDate: format(new Date(), 'yyyy-MM-dd')
          });
        }
      }

      if (needsBatchCommit) {
        try {
          await batch.commit();
          await fetchCars(); // Sync the state immediately with the newly added cars
        } catch (error) {
          console.error("Error auto-initializing missing cars:", error);
        }
      }
    };

    initializeMissingCars();
  }, [loading, activeVehicles, cars]);

  // 3. Automated Odometer processing from COMPLETED & unprocessed reservations (Disabled)
  const unprocessedCompletedReservations = useMemo(() => {
    return [];
  }, []);

  // Helper calculation: always multiply each rental day by 0 km (disabled)
  const calculateOdometerAddition = (days: number): number => {
    return 0;
  };

  const processOdometerLog = async () => {
    if (unprocessedCompletedReservations.length === 0 || isProcessing) return;
    setIsProcessing(true);
    setProcessStatusMessage("Processing kilometers from completed rentals...");

    try {
      let processedCount = 0;
      let totalDistanceAdded = 0;

      // Since multiple reservations can affect the same car, we accumulate distances first
      const carDistanceMap: Record<string, { distance: number, reservationIds: string[] }> = {};

      unprocessedCompletedReservations.forEach(res => {
        const vIdStr = String(res.vehicleId);
        const days = res.days || 0;
        const addDistance = calculateOdometerAddition(days);

        if (!carDistanceMap[vIdStr]) {
          carDistanceMap[vIdStr] = { distance: 0, reservationIds: [] };
        }
        carDistanceMap[vIdStr].distance += addDistance;
        carDistanceMap[vIdStr].reservationIds.push(res.id);
      });

      // Update cars and flag reservations inside transactions/batch
      const batch = writeBatch(db);

      // A: Accumulate & Update Cars Odometer and Recent Km
      for (const [vehicleIdStr, data] of Object.entries(carDistanceMap)) {
        const matchingCarInFirebase = cars.find(c => String(c.vehicleId) === vehicleIdStr);
        const currentOdometer = matchingCarInFirebase?.odometer || 0;
        const targetOdometer = currentOdometer + data.distance;

        const currentRecentKm = matchingCarInFirebase?.recentKm ?? matchingCarInFirebase?.odometer ?? 0;
        const targetRecentKm = currentRecentKm + data.distance;

        const carRef = doc(db, 'cars', vehicleIdStr);
        batch.update(carRef, {
          odometer: targetOdometer,
          recentKm: targetRecentKm
        });

        processedCount += data.reservationIds.length;
        totalDistanceAdded += data.distance;
      }

      // B: Mark processed reservations
      unprocessedCompletedReservations.forEach(res => {
        const resRef = doc(db, 'reservations', res.id);
        batch.update(resRef, {
          isKilometerProcessed: true
        });
      });

      await batch.commit();
      await fetchCars(); // Synchronize odometer calculations back to current vehicles immediately
      
      setProcessStatusMessage(`Success! Processed ${processedCount} completed reservations and logged +${totalDistanceAdded.toLocaleString()} km.`);
      setTimeout(() => setProcessStatusMessage(null), 8000);
    } catch (err) {
      console.error("Error processing service kilometers:", err);
      setProcessStatusMessage("Failed to process reservation kilometers.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Get oil state status properties based on recentKm (mileage since last oil change)
  const getOilState = (recentKm: number) => {
    if (recentKm <= 15000) {
      return {
        label: 'FRESH',
        colorClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        dotClass: 'bg-emerald-500',
        description: 'Below 15,000 km. Oil is clean and fresh.',
        glow: 'shadow-emerald-500/10'
      };
    } else if (recentKm > 15000 && recentKm <= 19500) {
      return {
        label: 'GOOD',
        colorClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
        dotClass: 'bg-amber-500',
        description: '15,000 - 19,500 km. Standard operating status.',
        glow: 'shadow-amber-500/10'
      };
    } else {
      return {
        label: 'DEGRADED',
        colorClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse-glowing',
        dotClass: 'bg-rose-500',
        description: 'Above 19,500 km. Oil change recommended immediately.',
        glow: 'shadow-rose-500/10'
      };
    }
  };

  // Inline edit handlers
  const handleStartEdit = (car: Car) => {
    setEditingCarId(car.id);
    setIsLoggingOilChange(false);
    setIsEditingOdometer(false);
    setEditRecentKm(String(car.recentKm ?? 0));
    setEditOilDate(car.lastOilChangeDate || format(new Date(), 'yyyy-MM-dd'));
  };

  const handleRecentKmClick = (car: Car) => {
    setEditingCarId(car.id);
    setIsLoggingOilChange(true);
    setIsEditingOdometer(false);
    setEditRecentKm('0');
    setEditOilDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleOdometerClick = (car: Car) => {
    setEditingCarId(car.id);
    setIsLoggingOilChange(false);
    setIsEditingOdometer(true);
    setEditOdometer(String(car.odometer ?? 0));
    setEditRecentKm(String(car.recentKm ?? 0));
    setEditOilDate(car.lastOilChangeDate || format(new Date(), 'yyyy-MM-dd'));
  };

  const handleCancelEdit = () => {
    setEditingCarId(null);
    setIsLoggingOilChange(false);
    setIsEditingOdometer(false);
  };

  const handleSaveEdit = async (carId: string) => {
    try {
      const carRef = doc(db, 'cars', carId);
      if (isLoggingOilChange) {
        // Logging an official service/oil change: resets recentKm to 0, logs the date, and records to history. Odometer is not altered because recent KM's are already added dynamically.
        const matchingCar = cars.find(c => c.id === carId);
        const currentOdo = matchingCar?.odometer || 0;
        const existingHistory = matchingCar?.oilChangeHistory || [];
        // Add the new service log to the start of the history array
        const logEntry = `${editOilDate} | At ${currentOdo.toLocaleString()} km`;
        const updatedHistory = [logEntry, ...existingHistory];

        await updateDoc(carRef, {
          recentKm: 0,
          odometer: currentOdo,
          lastOilChangeDate: editOilDate,
          oilChangeHistory: updatedHistory
        });
      } else if (isEditingOdometer) {
        // Direct odometer manual update (does NOT affect recent KM)
        const parsedOdometer = parseInt(editOdometer.replace(/[^0-9]/g, ''), 10);
        if (isNaN(parsedOdometer) || parsedOdometer < 0) {
          alert("Please enter a valid odometer value.");
          return;
        }
        await updateDoc(carRef, {
          odometer: parsedOdometer,
          lastOilChangeDate: editOilDate
        });
      } else {
        // General manual updates to recent km / date. From this, odometer will adjust accordingly!
        const parsedRecentKm = parseInt(editRecentKm.replace(/[^0-9]/g, ''), 10);
        if (isNaN(parsedRecentKm) || parsedRecentKm < 0) {
          alert("Please enter a valid recent kilometers value.");
          return;
        }
        const matchingCar = cars.find(c => c.id === carId);
        if (matchingCar) {
          const oldRecentKm = matchingCar.recentKm ?? 0;
          const currentOdometer = matchingCar.odometer ?? 0;
          const diff = parsedRecentKm - oldRecentKm;
          const updatedOdometer = currentOdometer + diff;

          await updateDoc(carRef, {
            recentKm: parsedRecentKm,
            odometer: updatedOdometer,
            lastOilChangeDate: editOilDate
          });
        }
      }
      await fetchCars(); // Synchronize manual odometer or oil changes back to current list state
      setEditingCarId(null);
      setIsLoggingOilChange(false);
      setIsEditingOdometer(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cars/${carId}`);
    }
  };

  // Stats calculation based on recentKm
  const stats = useMemo(() => {
    let fresh = 0;
    let good = 0;
    let degraded = 0;
    let totalMileage = 0;

    preStatusFilteredCars.forEach(c => {
      totalMileage += c.odometer || 0;
      const recent = c.recentKm ?? c.odometer ?? 0;
      if (recent <= 15000) fresh++;
      else if (recent > 15000 && recent <= 19500) good++;
      else degraded++;
    });

    return { fresh, good, degraded, totalMileage };
  }, [preStatusFilteredCars]);

  // Plate styling match
  const getVehicleColorByPlate = (plateStr: string) => {
    if (!plateStr || !vehicles) return null;
    const clean = plateStr.replace(/\s+/g, '').toUpperCase();
    const found = vehicles.find(v => (v.plate || '').replace(/\s+/g, '').toUpperCase() === clean);
    return found?.color || null;
  };

  if (contextLoading) {
    return (
      <div className={cn(
        "flex-1 md:ml-[262px] h-screen transition-colors duration-500 p-4 md:pl-0 flex flex-col justify-center items-center custom-scrollbar",
        isDarkMode ? "bg-[#1A1614]" : "bg-white"
      )}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#FF5C35] border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black text-gray-400 tracking-[0.3em] uppercase">Checking access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex-1 md:ml-[262px] h-screen transition-colors duration-500 p-4 md:pl-0 flex flex-col overflow-y-auto custom-scrollbar",
      isDarkMode ? "bg-[#1A1614]" : "bg-white"
    )}>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#FF5C35] border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black text-gray-400 tracking-[0.3em] uppercase">Loading Service Metrics...</p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-[1200px] lg:max-w-[1440px] xl:max-w-[1685px] mx-auto flex flex-col gap-6 select-none">
          {/* Header */}
          <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-2 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-8 ml-[5px] flex-1 w-full">
              <div>
                <h1 className={cn(
                  "text-3xl font-black tracking-tighter leading-none transition-colors",
                  isDarkMode ? "text-white" : "text-[#0E0C0B]"
                )}>SERVICE AREA</h1>
                <p className="text-[10px] font-black text-gray-400 tracking-[0.3em] uppercase mt-2">FLEET ODOMETER LOGS & OIL STATUS</p>
              </div>

              {/* Search Bar - perfectly to the right side of the service area text */}
              <div className="relative w-full sm:w-80">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 text-xs">
                  🔍
                </div>
                <input
                  type="text"
                  placeholder="SEARCH VEHICLE NAME OR PLATE..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full pl-9 pr-8 py-2.5 text-xs font-black tracking-wide uppercase rounded-2xl border transition-all placeholder:text-[9px] placeholder:font-black placeholder:tracking-widest placeholder:text-gray-400/70 focus:outline-none focus:ring-1",
                    isDarkMode 
                      ? "bg-[#25211F] border-white/10 text-white focus:border-[#FF5C35] focus:ring-[#FF5C35]" 
                      : "bg-white border-gray-200 text-[#0E0C0B] focus:border-[#FF5C35] focus:ring-[#FF5C35]"
                  )}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#FF5C35] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

          </header>

          {/* Country Tabs */}
          <div className="flex flex-wrap items-center gap-2.5 ml-[5px] mt-1 shrink-0">
            <span className={cn(
              "text-[9px] font-black tracking-widest uppercase mr-1",
              isDarkMode ? "text-gray-400" : "text-[#0E0C0B]/60"
            )}>
              FILTER BY COUNTRY:
            </span>
            {VEHICLE_COUNTRIES.map((country) => {
              const activeColor = COUNTRY_COLORS[country] || '#FF5C35';
              const isSelected = selectedCountry === country;
              const count = vehicleCountsByCountry[country] || 0;

              return (
                <button
                  key={country}
                  onClick={() => setSelectedCountry(isSelected ? null : country)}
                  className={cn(
                    "px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-2xl border transition-all flex items-center gap-2.5 cursor-pointer hover:scale-[1.03] active:scale-95 duration-200",
                    isDarkMode
                      ? isSelected
                        ? "bg-[#25211F] text-white shadow-lg"
                        : "bg-[#25211F]/40 border-white/5 text-gray-400 hover:text-white"
                      : isSelected
                        ? "bg-white text-[#0E0C0B]"
                        : "bg-gray-100 border-gray-100 text-gray-500 hover:text-gray-800"
                  )}
                  style={{
                    borderColor: isSelected ? activeColor : undefined,
                    borderWidth: isSelected ? '2px' : '1px',
                    boxShadow: isSelected ? `0 4px 12px ${activeColor}15` : undefined
                  }}
                >
                  <span 
                    className="w-2 h-2 rounded-full ring-2 ring-offset-2 ring-transparent shrink-0" 
                    style={{ 
                      backgroundColor: activeColor,
                      boxShadow: isSelected ? `0 0 8px ${activeColor}` : undefined
                    }} 
                  />
                  <span>{country}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[8px] font-mono font-bold leading-none shrink-0",
                    isDarkMode
                      ? isSelected ? "bg-white/10 text-white" : "bg-white/5 text-gray-500"
                      : isSelected ? "bg-black/5 text-[#0E0C0B]/80" : "bg-black/5 text-gray-400"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
            
            {selectedCountry && (
              <button
                onClick={() => setSelectedCountry(null)}
                className={cn(
                  "px-3 py-2 text-[10px] font-black tracking-widest uppercase rounded-2xl border transition-all hover:text-rose-500 cursor-pointer text-xs ml-1 flex items-center gap-1.5 duration-200",
                  isDarkMode ? "text-gray-500 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100"
                )}
              >
                <X className="w-3 h-3" />
                Clear Country
              </button>
            )}

            {selectedOilStatus && (
              <button
                onClick={() => setSelectedOilStatus(null)}
                className={cn(
                  "px-3 py-2 text-[10px] font-black tracking-widest uppercase rounded-2xl border transition-all hover:text-rose-500 cursor-pointer text-xs ml-1 flex items-center gap-1.5 duration-200",
                  isDarkMode ? "text-gray-500 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100"
                )}
              >
                <X className="w-3 h-3" />
                Clear {selectedOilStatus}
              </button>
            )}
          </div>

          {/* Toast/Status alert if any */}
          {processStatusMessage && (
            <div className={cn(
              "p-4 rounded-[20px] border-2 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 font-bold text-sm",
              processStatusMessage.includes("Success")
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
            )}>
              <span className="text-xl">⚙️</span>
              <p className="flex-1">{processStatusMessage}</p>
              <button onClick={() => setProcessStatusMessage(null)}>
                <X className="w-4 h-4 hover:scale-110 active:scale-90" />
              </button>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-stretch shrink-0">
            {/* 1. FLEET OVERVIEW - Silver Brushed/Glass Metallic Instrument Panel */}
            <div 
              className={cn(
                "xl:col-span-4 rounded-[32px] p-6 border transition-all duration-500 flex flex-col justify-between relative overflow-hidden",
                isDarkMode 
                  ? "bg-gradient-to-br from-[#2E2825] to-[#1E1917] border-white/5 shadow-2xl" 
                  : "bg-gradient-to-br from-[#F4F5F7] to-[#DFE2E6] border-[#D0D4DC] shadow-lg shadow-black/5"
              )}
              style={{ height: '185px' }}
            >
              {/* Gloss upper shine overlay */}
              <div className="absolute top-0 inset-x-0 h-[45%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

              <div>
                <span className={cn(
                  "text-xs font-black tracking-wider uppercase block",
                  isDarkMode ? "text-white" : "text-[#2B303A]"
                )}>
                  FLEET OVERVIEW
                </span>
                <span className="text-[9px] font-black text-gray-400 tracking-widest uppercase mt-0.5 block">
                  TOTAL FLEET KM
                </span>
              </div>

              <div 
                className="flex items-end justify-between w-full mt-auto"
                style={{ height: '80px', marginBottom: '15px' }}
              >
                {/* Left Side: Odometer */}
                <div className="flex flex-col justify-end pb-1">
                  {/* Mechanical Drum-style Odometer Counter */}
                  <div className="flex items-end gap-0.5 bg-black/5 dark:bg-black/35 px-2.5 py-1.5 rounded-2xl w-fit border border-black/5">
                    {stats.totalMileage.toLocaleString().split('').map((char, idx) => {
                      if (char === ',' || char === '.') {
                        return (
                          <span 
                            key={idx} 
                            className={cn(
                              "text-lg font-bold font-mono tracking-tight pb-0.5 mx-0.5 leading-none shrink-0 align-bottom",
                              isDarkMode ? "text-white/40" : "text-black/40"
                            )}
                          >
                            {char}
                          </span>
                        );
                      }
                      return (
                        <div 
                          key={idx} 
                          className="relative -ml-[1px] w-5.5 h-8 bg-gradient-to-b from-[#1C1C1E] via-[#09090A] to-[#1C1C1E] border border-black/90 rounded-[4px] shadow-[inset_0_1.5px_3px_rgba(255,255,255,0.08),_0_1.5px_3px_rgba(0,0,0,0.85)] overflow-hidden flex items-center justify-center shrink-0"
                        >
                          {/* Seam line */}
                          <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/10 z-10 pointer-events-none" />
                          {/* Shading/curvature overlays */}
                          <div className="absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-black/85 to-transparent pointer-events-none z-10" />
                          <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-black/85 to-transparent pointer-events-none z-10" />
                          
                          <span className="font-mono font-black text-base text-white tracking-normal relative z-0 mt-[0.5px]">
                            {char}
                          </span>
                        </div>
                      );
                    })}
                    <span className={cn(
                      "text-[10px] font-black ml-1 uppercase tracking-wide leading-none pb-0.5 shrink-0",
                      isDarkMode ? "text-white/50" : "text-[#2B303A]/60"
                    )}>
                      km
                    </span>
                  </div>
                </div>

                {/* Right Side: Speedometer */}
                <div className="relative flex flex-col items-center justify-end w-[180px] h-[100px] overflow-visible">
                  <svg 
                    viewBox="0 0 160 90" 
                    className="w-[170px] h-[95.6px] overflow-visible"
                    style={{ marginBottom: '10px' }}
                  >
                    <defs>
                      <radialGradient id="dial-metallic" cx="50%" cy="100%" r="85%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                        <stop offset="45%" stopColor="#EAEDF2" />
                        <stop offset="90%" stopColor="#CBD5E1" />
                        <stop offset="100%" stopColor="#94A3B8" />
                      </radialGradient>
                      <radialGradient id="dial-metallic-dark" cx="50%" cy="100%" r="85%">
                        <stop offset="0%" stopColor="#3E3834" />
                        <stop offset="50%" stopColor="#2F2926" />
                        <stop offset="100%" stopColor="#1E1917" />
                      </radialGradient>
                      <filter id="needle-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0.5" dy="1.5" stdDeviation="1" floodOpacity="0.3" />
                      </filter>
                    </defs>

                    {/* Silver gauge face */}
                    <path 
                      d="M 15 90 A 65 65 0 0 1 145 90" 
                      fill={isDarkMode ? "url(#dial-metallic-dark)" : "url(#dial-metallic)"} 
                      stroke={isDarkMode ? "#4A403A" : "#AEB7C4"} 
                      strokeWidth="1.5" 
                    />

                    {/* Minute Gauge Ticks */}
                    {(() => {
                      const ticks = [];
                      for (let i = 0; i <= 12; i++) {
                        const angle = 180 + i * 15;
                        const rad = (angle * Math.PI) / 180;
                        const outerR = 64;
                        const innerR = i % 2 === 0 ? 54 : 59;
                        const x1 = 80 + outerR * Math.cos(rad);
                        const y1 = 90 + outerR * Math.sin(rad);
                        const x2 = 80 + innerR * Math.cos(rad);
                        const y2 = 90 + innerR * Math.sin(rad);
                        
                        ticks.push(
                          <line 
                            key={i} 
                            x1={x1} 
                            y1={y1} 
                            x2={x2} 
                            y2={y2} 
                            stroke={isDarkMode ? "#7E6E64" : "#475569"} 
                            strokeWidth={i % 2 === 0 ? "1.5" : "0.75"} 
                          />
                        );
                      }
                      return ticks;
                    })()}

                    {/* Core Base */}
                    <circle cx="80" cy="90" r="9" fill={isDarkMode ? "#251F1C" : "#64748B"} stroke={isDarkMode ? "#4E423B" : "#475569"} strokeWidth="1" />
                    <circle cx="80" cy="90" r="4.5" fill="#0F172A" />

                    {/* Core needle pivot line */}
                    {(() => {
                      const carsLengthFactor = Math.min(filteredCars.length / 50, 1.0);
                      const angle = 180 + carsLengthFactor * 180;
                      const rad = (angle * Math.PI) / 180;
                      const xTip = 80 + 51 * Math.cos(rad);
                      const yTip = 90 + 51 * Math.sin(rad);

                      return (
                        <line 
                          x1="80" 
                          y1="90" 
                          x2={xTip} 
                          y2={yTip} 
                          stroke={isDarkMode ? "#FF6C47" : "#0F172A"} 
                          strokeWidth="3" 
                          strokeLinecap="round"
                          filter="url(#needle-shadow)"
                        />
                      );
                    })()}
                  </svg>

                  {/* Overlay Vehicle Badge - snugly aligned beneath the gauge flatline */}
                  <span 
                    className={cn(
                      "absolute bottom-[-1px] px-3.5 py-1 rounded-full border text-[8px] font-black tracking-widest uppercase shadow-md flex items-center justify-center gap-1.5 leading-none z-10 backdrop-blur-sm",
                      isDarkMode 
                        ? "bg-[#332A26]/95 border-white/15 text-gray-300" 
                        : "bg-white/95 border-[#E2E8F0] text-gray-600 shadow-slate-200/50"
                    )}
                    style={{ marginBottom: '-8px', width: '139.812px' }}
                  >
                    <span className="opacity-60 text-[7px] font-bold">TOTAL VEHICLES:</span>
                    <span className="font-sans font-black text-orange-500">{filteredCars.length}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 2. THREE DYNAMIC CONNECTED SERVICE STATS PANEL (FRESH, GOOD, DEGRADED) */}
            <div className={cn(
              "xl:col-span-8 flex flex-col md:flex-row rounded-[32px] overflow-hidden border shadow-xl items-stretch relative",
              isDarkMode ? "border-white/5 bg-[#25211F]" : "border-[#E2E8F0] bg-white"
            )}>
              {/* PANEL A: FRESH (<10K KM) */}
              <div 
                onClick={() => setSelectedOilStatus(selectedOilStatus === 'FRESH' ? null : 'FRESH')}
                className={cn(
                  "flex-1 min-h-[195px] bg-gradient-to-r from-[#CEEFCD] to-[#8BCD89] p-6 flex flex-col justify-between relative overflow-visible cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.03]",
                  selectedOilStatus && selectedOilStatus !== 'FRESH' ? "opacity-45 hover:opacity-100" : "",
                  selectedOilStatus === 'FRESH' ? "ring-4 ring-emerald-500/60 scale-[1.02] shadow-2xl z-20" : ""
                )}
              >
                {/* Overlay bevel reflection border curve on right side */}
                <div className="absolute top-0 bottom-0 -right-[17.5px] w-[35px] z-25 pointer-events-none hidden md:block overflow-visible">
                  <svg viewBox="0 0 35 100" preserveAspectRatio="none" className="w-full h-full filter drop-shadow-[5px_0_3px_rgba(0,0,0,0.14)]">
                    <path 
                      d="M 0,0 L 15,0 C 22,10 32,28 32,50 C 32,72 22,90 15,100 L 0,100 Z" 
                      fill="#8BCD89" 
                    />
                    <path 
                      d="M 15,0 C 22,10 32,28 32,50 C 32,72 22,90 15,100" 
                      fill="none" 
                      stroke="white" 
                      strokeWidth="1.2" 
                      strokeOpacity="0.45" 
                    />
                  </svg>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-sans font-black tracking-wide text-[#044314]/85 flex items-center gap-1.5">
                    FRESH (≤15K KM)
                    {selectedOilStatus === 'FRESH' && <span className="text-[9px] bg-[#044314]/15 px-1.5 py-0.5 rounded-full font-mono text-[#044314] font-black tracking-widest uppercase">ACTIVE</span>}
                  </span>
                  
                  <div className="flex items-center justify-between mt-2 pr-2">
                    <span className="text-5xl lg:text-6xl font-black font-sans leading-none tracking-tight text-[#044314]">
                      {stats.fresh}
                    </span>

                    {/* Highly stylized glowing 3D Liquid Drop */}
                    <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
                      <svg viewBox="0 0 24 24" className="w-14 h-14 drop-shadow-[0_0_10px_rgba(34,197,94,0.6)] relative z-10">
                        <defs>
                          <radialGradient id="fresh-glow" cx="50%" cy="65%" r="55%">
                            <stop offset="0%" stopColor="#DCFCE7" />
                            <stop offset="35%" stopColor="#4ADE80" />
                            <stop offset="100%" stopColor="#15803D" />
                          </radialGradient>
                        </defs>
                        <path 
                          d="M 12 3 C 12 3 5 11 5 15.5 A 7 7 0 0 0 19 15.5 C 19 11 12 3 12 3 Z" 
                          fill="url(#fresh-glow)" 
                          stroke="#15803D" 
                          strokeWidth="0.5" 
                        />
                        <path 
                          d="M 9.5 13.5 A 3 3 0 0 1 14.5 13.5" 
                          fill="none" 
                          stroke="white" 
                          strokeWidth="1" 
                          strokeLinecap="round" 
                          strokeOpacity="0.5" 
                        />
                        <ellipse cx="10.5" cy="11.5" rx="1.5" ry="2.5" transform="rotate(-25 10.5 11.5)" fill="white" fillOpacity="0.45" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Bottom slider level */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[4px] bg-[#044314]/15 rounded-full overflow-hidden relative">
                    <div 
                      className="h-full bg-[#044314] rounded-full transition-all duration-500" 
                      style={{ width: `${preStatusFilteredCars.length ? (stats.fresh / preStatusFilteredCars.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-[#044314] leading-none shrink-0 uppercase tracking-widest block pt-0.5">
                    Fresh
                  </span>
                </div>
              </div>

              {/* PANEL B: GOOD (10K-12.5K KM) */}
              <div 
                onClick={() => setSelectedOilStatus(selectedOilStatus === 'GOOD' ? null : 'GOOD')}
                className={cn(
                  "flex-1 min-h-[195px] bg-gradient-to-r from-[#FCDC8A] to-[#DFB95E] p-6 flex flex-col justify-between relative overflow-visible z-10 cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.03]",
                  selectedOilStatus && selectedOilStatus !== 'GOOD' ? "opacity-45 hover:opacity-100" : "",
                  selectedOilStatus === 'GOOD' ? "ring-4 ring-amber-500/60 scale-[1.02] shadow-2xl z-20" : ""
                )}
              >
                {/* Overlay bevel reflection border curve on right side */}
                <div className="absolute top-0 bottom-0 -right-[17.5px] w-[35px] z-25 pointer-events-none hidden md:block overflow-visible">
                  <svg viewBox="0 0 35 100" preserveAspectRatio="none" className="w-full h-full filter drop-shadow-[5px_0_3px_rgba(0,0,0,0.14)]">
                    <path 
                      d="M 0,0 L 15,0 C 22,10 32,28 32,50 C 32,72 22,90 15,100 L 0,100 Z" 
                      fill="#DFB95E" 
                    />
                    <path 
                      d="M 15,0 C 22,10 32,28 32,50 C 32,72 22,90 15,100" 
                      fill="none" 
                      stroke="white" 
                      strokeWidth="1.2" 
                      strokeOpacity="0.45" 
                    />
                  </svg>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-sans font-black tracking-wide text-[#4D2A00]/85 flex items-center gap-1.5">
                    GOOD (15K-19.5K KM)
                    {selectedOilStatus === 'GOOD' && <span className="text-[9px] bg-[#4D2A00]/15 px-1.5 py-0.5 rounded-full font-mono text-[#4D2A00] font-black tracking-widest uppercase">ACTIVE</span>}
                  </span>
                  
                  <div className="flex items-center justify-between mt-2 pr-2">
                    <span className="text-5xl lg:text-6xl font-black font-sans leading-none tracking-tight text-[#4D2A00]">
                      {stats.good}
                    </span>

                    {/* Stylized Glowing Orange/Yellow Drop */}
                    <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
                      <svg viewBox="0 0 24 24" className="w-14 h-14 drop-shadow-[0_0_10px_rgba(234,179,8,0.6)] relative z-10">
                        <defs>
                          <radialGradient id="good-glow" cx="50%" cy="65%" r="55%">
                            <stop offset="0%" stopColor="#FEF08A" />
                            <stop offset="35%" stopColor="#FACC15" />
                            <stop offset="100%" stopColor="#B45309" />
                          </radialGradient>
                        </defs>
                        <path 
                          d="M 12 3 C 12 3 5 11 5 15.5 A 7 7 0 0 0 19 15.5 C 19 11 12 3 12 3 Z" 
                          fill="url(#good-glow)" 
                          stroke="#B45309" 
                          strokeWidth="0.5" 
                        />
                        <path 
                          d="M 9.5 13.5 A 3 3 0 0 1 14.5 13.5" 
                          fill="none" 
                          stroke="white" 
                          strokeWidth="1" 
                          strokeLinecap="round" 
                          strokeOpacity="0.5" 
                        />
                        <ellipse cx="10.5" cy="11.5" rx="1.5" ry="2.5" transform="rotate(-25 10.5 11.5)" fill="white" fillOpacity="0.45" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Bottom slider level */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[4px] bg-[#4D2A00]/15 rounded-full overflow-hidden relative">
                    <div 
                      className="h-full bg-[#4D2A00] rounded-full transition-all duration-500" 
                      style={{ width: `${preStatusFilteredCars.length ? (stats.good / preStatusFilteredCars.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-[#4D2A00] leading-none shrink-0 uppercase tracking-widest block pt-0.5">
                    Good
                  </span>
                </div>
              </div>

              {/* PANEL C: DEGRADED (&gt;12.5K KM) */}
              <div 
                onClick={() => setSelectedOilStatus(selectedOilStatus === 'DEGRADED' ? null : 'DEGRADED')}
                className={cn(
                  "flex-1 min-h-[195px] bg-gradient-to-r from-[#FBAC9B] to-[#DC5E4D] p-6 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.03]",
                  selectedOilStatus && selectedOilStatus !== 'DEGRADED' ? "opacity-45 hover:opacity-100" : "",
                  selectedOilStatus === 'DEGRADED' ? "ring-4 ring-rose-500/60 scale-[1.02] shadow-2xl z-20" : ""
                )}
              >
                {/* Content */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-sans font-black tracking-wide text-[#4E0403]/85 flex items-center gap-1.5">
                    DEGRADED (&gt;19.5K KM)
                    {selectedOilStatus === 'DEGRADED' && <span className="text-[9px] bg-[#4E0403]/15 px-1.5 py-0.5 rounded-full font-mono text-[#4E0403] font-black tracking-widest uppercase">ACTIVE</span>}
                  </span>
                  
                  <div className="flex items-center justify-between mt-2 pr-2">
                    <span className="text-5xl lg:text-6xl font-black font-sans leading-none tracking-tight text-[#4E0403]">
                      {stats.degraded}
                    </span>

                    {/* Bright Glowing Warn Triangle */}
                    <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
                      <svg viewBox="0 0 24 24" className="w-13 h-13 drop-shadow-[0_0_12px_rgba(239,68,68,0.75)] animate-pulse relative z-10">
                        <defs>
                          <linearGradient id="alert-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" stopColor="#B91C1C" />
                            <stop offset="100%" stopColor="#EF4444" />
                          </linearGradient>
                        </defs>
                        <path 
                          d="M 12 3 L 2 20 A 1.2 1.2 0 0 0 3.2 21.8 L 20.8 21.8 A 1.2 1.2 0 0 0 22 20 L 12 3 Z" 
                          fill="url(#alert-gradient)" 
                          stroke="#991B1B" 
                          strokeWidth="1.2" 
                          strokeLinejoin="round" 
                        />
                        <circle cx="12" cy="17.5" r="1.2" fill="white" />
                        <path d="M 12 8.5 L 12 14" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Bottom slider level */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[4px] bg-[#4E0403]/15 rounded-full overflow-hidden relative">
                    <div 
                      className="h-full bg-[#4E0403] rounded-full transition-all duration-500" 
                      style={{ width: `${preStatusFilteredCars.length ? (stats.degraded / preStatusFilteredCars.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-[#4E0403] leading-none shrink-0 uppercase tracking-widest block pt-0.5 animate-pulse">
                    Degraded
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cars List Block */}
          <div className={cn(
            "rounded-[32px] border overflow-hidden flex flex-col transition-all duration-500 mb-10",
            isDarkMode 
              ? "bg-[#2C2724] border-white/5 shadow-2xl" 
              : "bg-[#FCFAF5] border-[#F5F1E9] shadow-md"
          )}>
            <div className="overflow-x-auto custom-scrollbar">
              <div className="min-w-[900px]">
                {/* Table Header */}
                <div className={cn(
                  "px-8 py-4.5 flex items-center",
                  isDarkMode ? "bg-[#231F1D]" : "bg-[#F2EFE9]/60"
                )}>
                  <div className="w-[18%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">VEHICLE NAME</div>
                  <div className="w-[12%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">PLATE</div>
                  <div className="w-[12%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">TRANSMISSION</div>
                  <div className="w-[14%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">RECENT KM</div>
                  <div className="w-[18%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">ODOMETER</div>
                  <div className="w-[11%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase font-sans">OIL STATUS</div>
                  <div className="w-[15%] text-[10px] font-black text-[#FF5C35] tracking-widest uppercase">TIME CHANGED</div>
                </div>

                {/* List Items */}
                <div className={cn(
                  "divide-y transition-colors",
                  isDarkMode ? "divide-white/5 bg-[#1A1614]" : "divide-gray-150 bg-white"
                )}>
                  {filteredCars.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                      <CarIcon className="w-12 h-12 mb-4" />
                      <p className="font-black text-xs tracking-widest uppercase">No matching vehicles found</p>
                    </div>
                  ) : (
                    paginatedCars.map((car, index) => {
                      const isEditing = editingCarId === car.id;
                      const oilState = getOilState(car.recentKm ?? car.odometer ?? 0);

                      return (
                        <div key={car.id} className={cn(
                          "px-8 py-5 flex items-center transition-all group",
                          activeHistoryCarId === car.id ? "relative z-30" : "",
                          isDarkMode ? "hover:bg-white/5" : "hover:bg-black/5"
                        )}>
                          {/* 1. Vehicle Name */}
                          <div className="w-[18%]">
                            <span className={cn(
                              "font-black text-sm uppercase block truncate",
                              isDarkMode ? "text-white" : "text-[#0E0C0B]"
                            )}>
                              {car.name}
                            </span>
                          </div>

                          {/* 2. Plate */}
                          <div className="w-[12%]">
                            <div className="inline-flex items-center rounded-md border-2 border-black/35 bg-white px-2.5 py-1 shadow-md hover:scale-105 transition-transform shrink-0 relative overflow-hidden text-black">
                              <div className="w-[5px] h-4 bg-blue-700 rounded-l-[2px] -ml-2.5 mr-2 shrink-0 flex flex-col justify-end pb-0.5 items-center" />
                              <span className="text-xs font-mono font-black tracking-wider uppercase leading-none select-all mr-1">
                                {car.plate}
                              </span>
                              {(() => {
                                const col = getVehicleColorByPlate(car.plate);
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

                          {/* 3. Transmission */}
                          <div className="w-[12%]">
                            <span className={cn(
                              "inline-flex px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest border border-b-2 items-center justify-center shadow-sm uppercase leading-none shrink-0",
                              isDarkMode 
                                ? "bg-white/5 border-white/10 text-gray-300"
                                : "bg-gray-100 border-gray-200 text-gray-600"
                            )}>
                              {car.transmission === 'Manual' ? 'Manual (M)' : 'Automatic (A)'}
                            </span>
                          </div>

                          {/* 4. Recent Km (Clickable resetting mileage & oil tracker) */}
                          <div className="w-[14%]">
                            {isEditing ? (
                              <div>
                                {isLoggingOilChange ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-black text-emerald-500 animate-pulse">0 km</span>
                                    <span className="text-[8px] font-bold text-emerald-400/80 tracking-wider">RESET ON SAVE</span>
                                  </div>
                                ) : isEditingOdometer ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn(
                                      "font-extrabold text-sm",
                                      isDarkMode ? "text-white" : "text-[#0E0C0B]"
                                    )}>
                                      {(car.recentKm ?? car.odometer ?? 0).toLocaleString()}
                                    </span>
                                    <span className="text-xs text-gray-400">km</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <input 
                                      type="text"
                                      value={editRecentKm}
                                      onChange={(e) => setEditRecentKm(e.target.value)}
                                      className={cn(
                                        "px-2.5 py-1.5 rounded-xl border-2 font-black text-xs w-20 outline-none select-all",
                                        isDarkMode ? "bg-[#2C2724] border-white/5 text-white" : "bg-gray-50 border-gray-200 text-[#0E0C0B]"
                                      )}
                                      placeholder="Recent km"
                                      title="Edit recent kilometers since last oil change"
                                    />
                                    <span className="text-[10px] font-bold text-gray-400">km</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button 
                                onClick={() => handleRecentKmClick(car)}
                                className={cn(
                                  "font-extrabold text-sm hover:scale-105 active:scale-95 transition-all text-left flex items-center gap-1 cursor-pointer group px-2 py-1 rounded-lg border-2 border-transparent",
                                  isDarkMode 
                                    ? "hover:bg-[#FF5C35]/15 hover:border-[#FF5C35]/30 text-white" 
                                    : "hover:bg-[#FF5C35]/5 hover:border-[#FF5C35]/20 text-[#0E0C0B]"
                                )}
                                title="Register oil change date & reset recent km"
                              >
                                <span className="text-[#FF5C35] group-hover:underline">{(car.recentKm ?? car.odometer ?? 0).toLocaleString()}</span>
                                <span className="text-xs font-normal text-gray-400">km</span>
                              </button>
                            )}
                          </div>

                          {/* 5. Odometer (Beautiful pill-shaped mechanical gauges) */}
                          <div className="w-[18%]">
                            {isEditing && !isLoggingOilChange ? (
                              isEditingOdometer ? (
                                <div className="flex items-center gap-1.5">
                                  <input 
                                    type="text"
                                    value={editOdometer}
                                    onChange={(e) => setEditOdometer(e.target.value)}
                                    className={cn(
                                      "px-2.5 py-1.5 rounded-xl border-2 font-black text-xs w-28 outline-none select-all",
                                      isDarkMode ? "bg-[#2C2724] border-white/5 text-white" : "bg-gray-50 border-gray-200 text-[#0E0C0B]"
                                    )}
                                    placeholder="Odometer"
                                    title="Edit odometer directly"
                                    autoFocus
                                  />
                                  <span className="text-[10px] font-bold text-gray-400">km</span>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-sans font-black text-[#FF5C35] text-sm animate-pulse">
                                    {(() => {
                                      const parsedInput = parseInt(editRecentKm.replace(/[^0-9]/g, ''), 10);
                                      const val = isNaN(parsedInput) ? 0 : parsedInput;
                                      const oldRecent = car.recentKm ?? 0;
                                      const currentOdo = car.odometer ?? 0;
                                      const calculatedOdo = currentOdo + (val - oldRecent);
                                      return calculatedOdo.toLocaleString();
                                    })()} km
                                  </span>
                                  <span className="text-[8px] font-bold text-[#FF5C35]/70 tracking-widest uppercase">AUTO-CALCULATED</span>
                                </div>
                              )
                            ) : (
                              <button
                                onClick={() => handleOdometerClick(car)}
                                className={cn(
                                  "inline-flex items-center bg-gradient-to-b from-[#1c1c1f] via-[#121214] to-[#0a0a0b] px-3 py-1.5 border border-neutral-700/80 rounded-full shadow-[0_3px_8px_rgba(0,0,0,0.6),inset_0_1px_4px_rgba(0,0,0,0.95)] hover:scale-105 hover:border-[#FF5C35]/50 transition-all font-mono text-xs text-white tracking-widest cursor-pointer relative overflow-hidden group/odo"
                                )}
                                title="Click to edit odometer directly"
                              >
                                {/* Glass reflection overlay */}
                                <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/15 to-transparent pointer-events-none rounded-t-full" />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 pointer-events-none rounded-full" />
                                {Math.round(car.odometer).toLocaleString().split('').map((char, i) => {
                                  if (char === ',' || char === '.') {
                                    return <span key={i} className="text-white/45 tracking-normal px-0.5 font-sans font-bold select-none">{char}</span>;
                                  }
                                  return (
                                    <span key={i} className="relative -ml-[1px] bg-gradient-to-b from-[#0e0e11] via-[#2a2a2f] to-[#0e0e11] px-1 rounded-[3px] border border-black/70 text-white font-extrabold shadow-[0_1.5px_2.5px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.12)] flex items-center justify-center min-w-[13px] h-[19px] leading-none text-center">
                                      {char}
                                      {/* Horizontal separation line for physical mechanical roller split */}
                                      <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/40 pointer-events-none" />
                                    </span>
                                  );
                                })}
                                <span className="text-[8px] font-black ml-1.5 uppercase text-orange-400 tracking-normal select-none relative z-10 transition-colors group-hover/odo:text-orange-300">km</span>
                              </button>
                            )}
                          </div>

                          {/* 6. Oil Status badge (Oil pump themed) */}
                          <div className="w-[11%]">
                            <span className={cn(
                              "px-3 py-1.5 rounded-full text-[9px] font-black tracking-widest border shadow-inner flex items-center justify-center gap-2 w-fit relative overflow-hidden",
                              oilState.colorClass,
                              oilState.glow
                            )}>
                              {/* Glowing bottom bubble */}
                              <div className={cn(
                                "w-2 h-2 rounded-full absolute -bottom-1 blur-md",
                                oilState.dotClass
                              )} />
                              {/* Real Drop Icon representing the oil state */}
                              <Droplet className="w-3 h-3 text-current fill-current relative z-10" />
                              <span className="relative z-10 leading-none">{oilState.label}</span>
                            </span>
                          </div>

                          {/* 7. Last Changed Date */}
                          <div className="w-[15%] flex items-center justify-between gap-2">
                            {isEditing ? (
                              <input 
                                type="date"
                                value={editOilDate}
                                onChange={(e) => setEditOilDate(e.target.value)}
                                className={cn(
                                  "px-2 py-1 rounded-xl border-2 font-bold text-[10px] outline-none max-w-[102px]",
                                  isDarkMode ? "bg-[#2C2724] border-white/5 text-white" : "bg-gray-50 border-gray-200 text-[#0E0C0B]"
                                )}
                              />
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <span className={cn(
                                  "text-xs font-black tracking-tight",
                                  isDarkMode ? "text-white" : "text-gray-700"
                                )}>
                                  {car.lastOilChangeDate ? format(new Date(car.lastOilChangeDate), 'dd MMM yyyy').toUpperCase() : 'NEVER'}
                                </span>
                                <span className="text-[8px] font-bold text-gray-400 tracking-wider">OIL REFRESH TAG</span>
                              </div>
                            )}

                            {/* Actions Group (Save & Cancel or Edit) */}
                            <div className="flex items-center gap-1.5 ml-auto relative">
                              {isEditing ? (
                                <>
                                  <button 
                                    onClick={() => handleSaveEdit(car.id)}
                                    className="p-1.5 bg-emerald-500 rounded-xl text-white hover:scale-115 cursor-pointer shadow-md shadow-emerald-500/10 active:scale-95 transition-all flex items-center justify-center shrink-0"
                                    title="Save change"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={handleCancelEdit}
                                    className="p-1.5 bg-rose-500 rounded-xl text-white hover:scale-115 cursor-pointer shadow-md shadow-rose-500/10 active:scale-95 transition-all flex items-center justify-center shrink-0"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                  {/* Inactive Edit button next to save */}
                                  <button 
                                    disabled
                                    className={cn(
                                      "p-1.5 rounded-xl border opacity-30 cursor-not-allowed shrink-0",
                                      isDarkMode ? "bg-white/5 border-white/5 text-gray-500" : "bg-gray-50 border-gray-200 text-gray-400"
                                    )}
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => handleStartEdit(car)}
                                    className={cn(
                                      "p-1.5 rounded-xl border hover:scale-115 text-gray-400 hover:text-white transition-all active:scale-95 cursor-pointer shrink-0",
                                      isDarkMode ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                                    )}
                                    title="Edit mileage or oil date manually"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Oil pump history button with nice tooltip */}
                                  <div className="relative">
                                    <button 
                                      onClick={() => setActiveHistoryCarId(activeHistoryCarId === car.id ? null : car.id)}
                                      className={cn(
                                        "p-1.5 rounded-xl border hover:scale-115 transition-all active:scale-95 cursor-pointer shrink-0 flex items-center justify-center relative",
                                        activeHistoryCarId === car.id
                                          ? "bg-[#FF5C35] border-[#FF5C35] text-white shadow-md shadow-[#FF5C35]/20"
                                          : isDarkMode 
                                            ? "bg-[#FF5C35]/15 border-[#FF5C35]/30 text-[#FF5C35] hover:bg-[#FF5C35]/25" 
                                            : "bg-[#FF5C35]/10 border-[#FF5C35]/20 text-[#FF5C35] hover:bg-[#FF5C35]/15"
                                      )}
                                      title="View Oil Change Log History"
                                    >
                                      <Fuel className="w-3.5 h-3.5" />
                                      {/* Tiny notification dot if history has logs */}
                                      {(car.oilChangeHistory && car.oilChangeHistory.length > 0) && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-current" />
                                      )}
                                    </button>


                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={cn(
                "px-8 py-4.5 border-t flex items-center justify-between shrink-0 transition-colors",
                isDarkMode ? "border-white/5 bg-[#231F1D]" : "border-[#F5F1E9] bg-[#F2EFE9]/30"
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
                              : (isDarkMode ? "text-gray-400 hover:bg-white/5" : "text-gray-500 hover:bg-gray-100")
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
      )}

      {/* Magnificent Centered Modal for Oil Change History */}
      {activeHistoryCar && (
        <div 
          className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[100] flex items-center justify-center p-4 select-none animate-in fade-in duration-300"
          onClick={() => setActiveHistoryCarId(null)}
        >
          <div 
            className={cn(
              "w-full max-w-md rounded-[32px] border p-6 shadow-2xl transition-all duration-300 transform scale-100 flex flex-col max-h-[90vh]",
              isDarkMode 
                ? "bg-[#231F1D] border-white/10 text-white shadow-black/80" 
                : "bg-white border-gray-200 text-[#0E0C0B] shadow-gray-200/50"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-5 border-b pb-4 border-dashed border-gray-200 dark:border-white/10">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[9px] font-black tracking-widest text-[#FF5C35] uppercase">
                  OIL SERVICE LOGGER & HISTORY
                </span>
                <h2 className={cn(
                  "text-xl font-black tracking-tight leading-tight uppercase",
                  isDarkMode ? "text-white" : "text-[#0E0C0B]"
                )}>
                  {activeHistoryCar.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {/* plate */}
                  <div className="inline-flex items-center rounded-md border-2 border-black/35 bg-white px-2.5 py-1 shadow-md text-black scale-95 origin-left">
                    <div className="w-[5px] h-4 bg-blue-700 rounded-l-[2px] -ml-2.5 mr-2 shrink-0 flex flex-col justify-end pb-0.5 items-center" />
                    <span className="text-xs font-mono font-black tracking-wider uppercase leading-none select-all mr-1">
                      {activeHistoryCar.plate}
                    </span>
                    {(() => {
                      const col = getVehicleColorByPlate(activeHistoryCar.plate);
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
              </div>
              <button 
                onClick={() => setActiveHistoryCarId(null)}
                className={cn(
                  "p-2 rounded-xl transition-all hover:scale-110 cursor-pointer flex items-center justify-center shrink-0 border",
                  isDarkMode 
                    ? "bg-white/5 border-white/5 text-gray-400 hover:text-white" 
                    : "bg-gray-50 border-gray-150 text-gray-500 hover:text-red-500 hover:bg-red-50"
                )}
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3 min-h-0 py-1">
              {(!activeHistoryCar.oilChangeHistory || activeHistoryCar.oilChangeHistory.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-gray-200 dark:border-white/10 rounded-2xl bg-gray-50 dark:bg-white/5">
                  <Fuel className="w-8 h-8 text-gray-400 mb-3 animate-pulse" />
                  <span className="text-xs font-black tracking-widest text-gray-400 dark:text-gray-500 uppercase leading-none">
                    No service logs registered
                  </span>
                </div>
              ) : (
                activeHistoryCar.oilChangeHistory.map((log, index) => {
                  const parts = log.split('|');
                  const datePart = parts[0]?.trim() || '';
                  const kmPart = parts[1]?.trim() || '';
                  let formattedDate = datePart;
                  try {
                    if (datePart && datePart !== 'NEVER') {
                      formattedDate = format(new Date(datePart), 'dd MMM yyyy').toUpperCase();
                    }
                  } catch (e) {}

                  return (
                    <div 
                      key={index}
                      className={cn(
                        "flex items-start gap-3 p-3.5 rounded-2xl text-left border transition-all",
                        index === 0 
                          ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20" 
                          : isDarkMode
                            ? "bg-white/5 border-white/5"
                            : "bg-gray-50 border-gray-150"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0 animate-pulse",
                        index === 0 ? "bg-emerald-500" : "bg-gray-400"
                      )} />
                      <div className="flex flex-col flex-1">
                        <span className={cn(
                          "text-[10px] font-black tracking-widest leading-none uppercase",
                          index === 0 ? "text-emerald-500" : "text-gray-400"
                        )}>
                          {index === 0 ? 'LATEST SERVICE' : `PREVIOUS SERVICE #${activeHistoryCar.oilChangeHistory.length - index}`}
                        </span>
                        <span className={cn(
                          "text-xs font-black mt-2 tracking-tight",
                          index === 0 
                            ? (isDarkMode ? "text-emerald-400" : "text-emerald-600") 
                            : (isDarkMode ? "text-gray-200" : "text-gray-800")
                        )}>
                          {formattedDate}
                        </span>
                        {kmPart && (
                          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-1 font-mono uppercase tracking-wide">
                            {kmPart}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 border-t border-dashed border-gray-200 dark:border-[#2C2724] pt-4 flex gap-3">
              <button
                onClick={() => setActiveHistoryCarId(null)}
                className={cn(
                  "w-full py-3 rounded-2xl text-xs font-black tracking-widest uppercase transition-all duration-200 hover:scale-[1.02] active:scale-95 cursor-pointer",
                  isDarkMode
                    ? "bg-[#FF5C35] hover:bg-[#FF5C35]/90 text-white shadow-lg shadow-[#FF5C35]/15"
                    : "bg-[#0E0C0B] hover:bg-[#0E0C0B]/90 text-white shadow-lg"
                )}
              >
                CLOSE LOG WINDOW
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
