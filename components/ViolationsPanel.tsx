'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Siren, 
  Search, 
  Car, 
  CarFront,
  Calendar, 
  ExternalLink, 
  User, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';
import Image from 'next/image';
import { doc, setDoc, updateDoc, collection, onSnapshot, query, limit, Timestamp, deleteDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAppState } from '@/lib/context';
import { Violation } from '@/types';
import { cn } from '@/lib/utils';

// Helper to parse the plate number and infraction date/time from the safe city notification text
function parseNotificationContent(subject: string, snippet: string, bodyText: string, vehicles: any[]) {
  const fullText = `${subject} ${snippet} ${bodyText}`;

  // 1. Regex to match plate format like SK-0582-BN, SK 0582 BN, SK0582BN
  // region: 2 chars, middle: 3 or 4 digits, suffix: 2 chars
  const plateRegex = /\b([A-Z]{2})[- \s*]*(\d{3,4})[- \s*]*([A-Z]{2})\b/gi;
  let match = plateRegex.exec(fullText);
  let plateFound = '';

  if (match) {
    const prefix = match[1].toUpperCase();
    const numbers = match[2].toUpperCase();
    const suffix = match[3].toUpperCase();
    plateFound = `${prefix}-${numbers}-${suffix}`;
  } else {
    // Check if there is space-less pattern SK0582BN
    const simpleRegex = /\b([A-Z]{2}\d{3,4}[A-Z]{2})\b/gi;
    let simpleMatch = simpleRegex.exec(fullText);
    if (simpleMatch) {
      const raw = simpleMatch[1].toUpperCase();
      const prefix = raw.substring(0, 2);
      const numbers = raw.substring(2, raw.length - 2);
      const suffix = raw.substring(raw.length - 2);
      plateFound = `${prefix}-${numbers}-${suffix}`;
    }
  }

  // 2. Look for matching vehicle in the database
  let matchedVehicle = null;
  if (plateFound) {
    const cleanPlateFound = plateFound.toUpperCase().replace(/[^A-Z0-9]/g, '');
    matchedVehicle = vehicles.find(v => {
      const cleanVPlate = v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      return cleanVPlate === cleanPlateFound;
    }) || null;
  }

  // Fallback direct scan of all known plates in full content if regex match wasn't precise
  if (!matchedVehicle) {
    for (const v of vehicles) {
      const cleanVPlate = v.plate.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanFullText = fullText.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanFullText.includes(cleanVPlate)) {
        matchedVehicle = v;
        plateFound = v.plate;
        break;
      }
    }
  }

  // 3. Extract infraction datetime in DD.MM.YYYY HH:mm format
  // Example: "19.06.2026 17:56"
  const datetimeRegex = /(\d{1,2})\.(\d{1,2})\.(\d{4})[^\d]*(\d{1,2}):(\d{2})/g;
  const dateMatch = datetimeRegex.exec(fullText);
  let datetimeISO = '';
  if (dateMatch) {
    try {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1; // 0-indexed month
      const year = parseInt(dateMatch[3], 10);
      const hours = parseInt(dateMatch[4], 10);
      const minutes = parseInt(dateMatch[5], 10);
      const parsedDate = new Date(year, month, day, hours, minutes);
      if (!isNaN(parsedDate.getTime())) {
        datetimeISO = parsedDate.toISOString();
      }
    } catch (e) {
      // Ignore conversion exceptions
    }
  }

  return {
    matchedVehicle,
    plate: matchedVehicle ? matchedVehicle.plate : (plateFound || 'SK-0582-BN'),
    vehicleName: matchedVehicle ? matchedVehicle.name : 'Skoda Scala',
    vehicleId: matchedVehicle ? matchedVehicle.id : 1,
    datetime: datetimeISO
  };
}

// Helper function to format any date to same minute-key (YYYY-MM-DD HH:mm)
function getMinuteKey(datetimeStr: string): string {
  try {
    const d = new Date(datetimeStr);
    if (isNaN(d.getTime())) return datetimeStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch (e) {
    return datetimeStr;
  }
}

export default function ViolationsPanel({ isDarkMode }: { isDarkMode: boolean }) {
  const { 
    vehicles = [], 
    userReservations = [], 
    isDataLoading, 
    user, 
    isAdmin,
    violations = [],
    isViolationsLoaded
  } = useAppState();

  const [copiedNumber, setCopiedNumber] = useState(false);
  const [filterDateMode, setFilterDateMode] = useState<'single' | 'all'>('single');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 40);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // States for manual price in euros and confirmation overlays
  const [finePrices, setFinePrices] = useState<Record<string, string>>({});
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [selectedRenterBooking, setSelectedRenterBooking] = useState<any>(null);

  const lastCheckedDateRef = useRef<string>(new Date().toDateString());
  const lastHealedLengthRef = useRef<number>(0);
  const lastHealedReservationsLengthRef = useRef<number>(0);

  // Auto-reset helper for midnight/00:01 AM transition
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const todayStr = new Date().toDateString();
      if (todayStr !== lastCheckedDateRef.current) {
        const now = new Date();
        const hour = now.getHours();
        const min = now.getMinutes();
        if (hour > 0 || (hour === 0 && min >= 1)) {
          lastCheckedDateRef.current = todayStr;
          setSelectedDate(now);
        }
      }
    }, 1000);
    return () => clearInterval(checkInterval);
  }, []);

  // 2. Automated background sync to parse Google Script 'notifications' and insert them as structural 'violations'
  useEffect(() => {
    if (!user || !isAdmin || isDataLoading || !isViolationsLoaded || vehicles.length === 0) return;

    setIsSyncing(true);

    // Run custom cleanup to delete old pre-existing violations prior to June 19th
    const runOldViolationsCleanup = async () => {
      try {
        const cutoffDate = new Date('2026-06-19T00:00:00');
        // Fetch all current violations and delete those before June 19
        const snap = await getDocs(collection(db, 'violations'));
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          if (data.datetime) {
            const vDate = new Date(data.datetime);
            if (!isNaN(vDate.getTime()) && vDate < cutoffDate) {
              await deleteDoc(docSnap.ref);
              console.log("Cleanup deleted old violation:", docSnap.id);
            }
          }
        }
      } catch (err) {
        console.error("Cleanup old violations error:", err);
      }
    };
    runOldViolationsCleanup();

    // Listen to notifications collection (limited to 100 for safety and performance)
    const q = query(collection(db, 'notifications'), limit(100));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map(dDoc => {
        const data = dDoc.data();
        const body = data.body || data.snippet || '';
        const dateValue = data.timestamp || data.date || data.createdAt;
        let dateStr = new Date().toISOString();

        try {
          if (dateValue instanceof Timestamp) {
            dateStr = dateValue.toDate().toISOString();
          } else if (dateValue && typeof dateValue === 'object' && 'seconds' in dateValue) {
            dateStr = new Date(dateValue.seconds * 1000).toISOString();
          } else if (typeof dateValue === 'string') {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) dateStr = d.toISOString();
          } else if (typeof dateValue === 'number') {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) dateStr = d.toISOString();
          }
        } catch (e) {
          console.error("Error setting date on notification parse:", e);
        }

        return {
          id: dDoc.id,
          subject: data.subject || '',
          date: dateStr,
          from: data.from || '',
          snippet: data.snippet || '',
          body: body
        };
      });

      // Filter for radar scan / safe city messages
      const safeCityEmails = docs.filter(email => {
        const sub = email.subject.toLowerCase();
        const fromMail = email.from.toLowerCase();
        return sub.includes('safe city') || sub.includes('radar') || sub.includes('mvr') || fromMail.includes('sc.mvr.gov.mk') || sub.includes('denizbank');
      });

      const cutoffDate = new Date('2026-06-19T00:00:00');

      // Auto-insert any violation not yet synchronized with minute-duplicate checks
      const processedKeysInCurrentSync = new Set<string>();

      for (const email of safeCityEmails) {
        // Parse actual infraction details from subject & body
        const parsedDetails = parseNotificationContent(email.subject, email.snippet, email.body, vehicles);
        const infractionDateTime = parsedDetails.datetime || email.date;

        // Skip any old violation that occurred before June 19, 2026
        const checkDate = new Date(infractionDateTime);
        if (!isNaN(checkDate.getTime()) && checkDate < cutoffDate) {
          continue;
        }

        const minKey = getMinuteKey(infractionDateTime);
        const uniqueKey = `${parsedDetails.plate.toUpperCase().replace(/[^A-Z0-9]/g, '')}_${minKey}`;

        // Skip duplicate records in the incoming batch sync
        if (processedKeysInCurrentSync.has(uniqueKey)) {
          continue;
        }
        processedKeysInCurrentSync.add(uniqueKey);

        // Parse Link
        const urlRegex = /(https?:\/\/[^\s<>(){}]+)/g;
        const urls = `${email.snippet} ${email.body}`.match(urlRegex) || [];
        let link = "https://sc.mvr.gov.mk";
        if (urls.length > 0) {
          const mvrLink = urls.find((u: string) => u.includes('mvr.gov.mk') || u.includes('sc.mvr'));
          link = mvrLink || urls[urls.length - 1];
        }

        // Find matching reservation for this infractionDateTime and parsedDetails.plate
        const getTS = (val: any) => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          if (val instanceof Date) return val.getTime();
          if (typeof val === 'string') {
            const parsed = Date.parse(val);
            return isNaN(parsed) ? 0 : parsed;
          }
          if (val && typeof val.toDate === 'function') {
            try {
              return val.toDate().getTime();
            } catch {
              return 0;
            }
          }
          return 0;
        };

        const infractionTs = new Date(infractionDateTime).getTime();
        const cleanVPlate = parsedDetails.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');

        const matchedRes = !isNaN(infractionTs) ? userReservations.find(res => {
          if (res.status === 'CANCELLED') return false;

          const veh = vehicles.find(vh => String(vh.id) === String(res.vehicleId));
          const rawPlate = veh?.plate || res.plate || '';
          if (!rawPlate) return false;

          const cleanResPlate = rawPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (cleanResPlate !== cleanVPlate) return false;

          const startTs = getTS(res.start);
          const endTs = getTS(res.end);

          return infractionTs >= startTs && infractionTs <= endTs;
        }) : null;

        const matchedClientName = matchedRes ? matchedRes.name : "";
        const matchedClientId = matchedRes ? (matchedRes.clientId || "") : "";

        const parsedViolation: Violation = {
          id: email.id,
          vehicleId: parsedDetails.vehicleId,
          vehicleName: parsedDetails.vehicleName,
          plate: parsedDetails.plate,
          datetime: infractionDateTime,
          link: link,
          status: 'waiting',
          clientName: matchedClientName,
          clientId: matchedClientId,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        // Skip saving to DB if we already loaded/saved a violation with this exact plate-minute key combo
        const alreadyInState = violations.some(v => {
          const vMinKey = getMinuteKey(v.datetime);
          const vUniqueKey = `${v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '')}_${vMinKey}`;
          return vUniqueKey === uniqueKey;
        });

        if (!alreadyInState && !violations.some(v => v.id === email.id)) {
          try {
            await setDoc(doc(db, 'violations', email.id), parsedViolation);
          } catch (err) {
            console.error("Failed to auto-store parsed violation in Firestore:", err);
          }
        }
      }
      setIsSyncing(false);
    }, (err) => {
      console.error("Auto Sync Error:", err);
      setIsSyncing(false);
    });

    return () => unsubscribe();
  }, [vehicles, isDataLoading, violations, user, isAdmin, isViolationsLoaded, userReservations]);

  // Self-heal/update stored violations with correct vehicle name/ID and client details on load
  useEffect(() => {
    if (!user || !isAdmin || vehicles.length === 0 || violations.length === 0) return;

    // Only run if violations or reservations length changed, to prevent excessive DB reads
    if (violations.length === lastHealedLengthRef.current && 
        userReservations.length === lastHealedReservationsLengthRef.current) {
      return;
    }

    const selfHealViolations = async () => {
      try {
        const snap = await getDocs(collection(db, 'violations'));
        const allDbViolations = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Violation));
        
        // Group by plate + minute key to find duplicates in the database
        const groups: { [key: string]: Violation[] } = {};
        for (const v of allDbViolations) {
          if (!v.datetime || !v.plate) continue;
          const minKey = getMinuteKey(v.datetime);
          const uniqueKey = `${v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '')}_${minKey}`;
          if (!groups[uniqueKey]) {
            groups[uniqueKey] = [];
          }
          groups[uniqueKey].push(v);
        }

        // Process each group
        for (const uniqueKey in groups) {
          const group = groups[uniqueKey];
          if (group.length > 1) {
            console.log(`Found ${group.length} duplicates for key ${uniqueKey}`);
            // We have duplicates! We need to keep only ONE document and delete the rest.
            // Let's decide which one to keep:
            // 1. Prefer 'successful' (paid) status.
            // 2. Prefer the one with clientName / clientId.
            // 3. Prefer the one with a non-zero price.
            // 4. Otherwise, prefer the oldest createdAt or ID.
            
            let bestDoc = group[0];
            for (let i = 1; i < group.length; i++) {
              const current = group[i];
              if (current.status === 'successful' && bestDoc.status !== 'successful') {
                bestDoc = current;
              } else if (current.status === bestDoc.status) {
                // If status is same, prefer the one with client details
                const currentHasClient = current.clientName && current.clientName.trim() !== "";
                const bestHasClient = bestDoc.clientName && bestDoc.clientName.trim() !== "";
                if (currentHasClient && !bestHasClient) {
                  bestDoc = current;
                } else if (currentHasClient === bestHasClient) {
                  // Prefer the one with price
                  const currentHasPrice = typeof current.price === 'number' && current.price > 0;
                  const bestHasPrice = typeof bestDoc.price === 'number' && bestDoc.price > 0;
                  if (currentHasPrice && !bestHasPrice) {
                    bestDoc = current;
                  }
                }
              }
            }

            // Delete all other documents in the group from Firestore
            for (const v of group) {
              if (v.id !== bestDoc.id) {
                console.log(`Deleting duplicate violation document ${v.id} in favor of ${bestDoc.id}`);
                await deleteDoc(doc(db, 'violations', v.id));
              }
            }
            
            // Now, make sure the bestDoc is healed and updated if needed
            const v = bestDoc;
            const cleanVPlate = v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const matchedVeh = vehicles.find(veh => {
              const cleanPlate = veh.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
              return cleanPlate === cleanVPlate;
            });

            let needsUpdate = false;
            const updatePayload: Partial<Violation> & { updatedAt: number } = {
              updatedAt: Date.now()
            };

            if (matchedVeh) {
              if (v.vehicleName !== matchedVeh.name) {
                updatePayload.vehicleName = matchedVeh.name;
                needsUpdate = true;
              }
              if (v.vehicleId !== matchedVeh.id) {
                updatePayload.vehicleId = matchedVeh.id;
                needsUpdate = true;
              }
            }

            if ((!v.clientName || v.clientName.trim() === "") && userReservations.length > 0) {
              const matchedRes = getReservationForViolation(v);
              if (matchedRes) {
                updatePayload.clientName = matchedRes.name;
                updatePayload.clientId = matchedRes.clientId || "";
                needsUpdate = true;
              }
            }

            if (needsUpdate) {
              console.log(`Self-healing kept duplicate violation ${v.id}:`, updatePayload);
              await updateDoc(doc(db, 'violations', v.id), updatePayload);
            }
          } else {
            // No duplicates, just do standard self-healing for this single document
            const v = group[0];
            const cleanVPlate = v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const matchedVeh = vehicles.find(veh => {
              const cleanPlate = veh.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
              return cleanPlate === cleanVPlate;
            });

            let needsUpdate = false;
            const updatePayload: Partial<Violation> & { updatedAt: number } = {
              updatedAt: Date.now()
            };

            if (matchedVeh) {
              if (v.vehicleName !== matchedVeh.name) {
                updatePayload.vehicleName = matchedVeh.name;
                needsUpdate = true;
              }
              if (v.vehicleId !== matchedVeh.id) {
                updatePayload.vehicleId = matchedVeh.id;
                needsUpdate = true;
              }
            }

            if ((!v.clientName || v.clientName.trim() === "") && userReservations.length > 0) {
              const matchedRes = getReservationForViolation(v);
              if (matchedRes) {
                updatePayload.clientName = matchedRes.name;
                updatePayload.clientId = matchedRes.clientId || "";
                needsUpdate = true;
              }
            }

            if (needsUpdate) {
              console.log(`Self-healing single violation ${v.id}:`, updatePayload);
              await updateDoc(doc(db, 'violations', v.id), updatePayload);
            }
          }
        }
        
        lastHealedLengthRef.current = violations.length;
        lastHealedReservationsLengthRef.current = userReservations.length;
      } catch (err) {
        console.error("Deep self-heal/deduplication failed:", err);
      }
    };

    selfHealViolations();
  }, [vehicles, violations, user, isAdmin, userReservations]);

  // 3. Mark manual status turn to 'successful' along with saved fine price
  const handlePayViolation = async (violationId: string) => {
    try {
      const typedVal = finePrices[violationId];
      const matchV = violations.find(item => item.id === violationId);
      const savedVal = matchV && matchV.price ? String(matchV.price) : '';
      const finalPriceStr = typedVal !== undefined ? typedVal : savedVal;
      const priceVal = parseFloat(finalPriceStr);

      await updateDoc(doc(db, 'violations', violationId), {
        status: 'successful',
        price: isNaN(priceVal) ? 0 : priceVal,
        updatedAt: Date.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `violations/${violationId}`);
    }
  };

  // 3b. Manually save fine price to Firestore and keep status as waiting
  const handleUpdateFinePrice = async (violationId: string, priceStr: string) => {
    try {
      const priceVal = parseFloat(priceStr);
      await updateDoc(doc(db, 'violations', violationId), {
        price: isNaN(priceVal) ? 0 : priceVal,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error("Failed to update fine price in Firestore: ", err);
      handleFirestoreError(err, OperationType.UPDATE, `violations/${violationId}`);
    }
  };

  // 4. Aggregated stats
  const stats = useMemo(() => {
    let waitingCount = 0;
    let successfulCount = 0;

    violations.forEach(v => {
      if (v.status === 'successful') {
        successfulCount += 1;
      } else {
        waitingCount += 1;
      }
    });

    return { waitingCount, successfulCount };
  }, [violations]);

  // Helper to check if two dates fall on the same calendar day
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
  };

  // Helper to dynamically match a reservation with a violation's time and plate (runs client-side, 0 Firestore reads)
  const getReservationForViolation = (v: Violation) => {
    if (!v.datetime || !v.plate) return null;
    const infractionTs = new Date(v.datetime).getTime();
    if (isNaN(infractionTs)) return null;

    const cleanVPlate = v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const getTS = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      if (val instanceof Date) return val.getTime();
      if (typeof val === 'string') {
        const parsed = Date.parse(val);
        return isNaN(parsed) ? 0 : parsed;
      }
      if (val && typeof val.toDate === 'function') {
        try {
          return val.toDate().getTime();
        } catch {
          return 0;
        }
      }
      return 0;
    };

    return userReservations.find(res => {
      if (res.status === 'CANCELLED') return false;

      // Look up vehicle plate for this reservation
      const veh = vehicles.find(vh => String(vh.id) === String(res.vehicleId));
      const rawPlate = veh?.plate || res.plate || '';
      if (!rawPlate) return false;

      const cleanResPlate = rawPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanResPlate !== cleanVPlate) return false;

      const startTs = getTS(res.start);
      let endTs = getTS(res.end);

      // Extend endTs to the end of that day (23:59:59.999) to cover the entire last rental day
      if (endTs > 0) {
        const endDate = new Date(endTs);
        endDate.setHours(23, 59, 59, 999);
        endTs = endDate.getTime();
      }

      return infractionTs >= startTs && infractionTs <= endTs;
    });
  };

  // 5. Query and filters
  const filteredViolations = useMemo(() => {
    return violations.filter(v => {
      // Filter by dynamic selected day first if in single-date mode
      if (filterDateMode === 'single' && v.datetime) {
        const violationDate = new Date(v.datetime);
        if (!isNaN(violationDate.getTime()) && !isSameDay(violationDate, selectedDate)) {
          return false;
        }
      }

      const q = debouncedSearchQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanPlate = v.plate.toLowerCase().replace(/[^a-z0-9]/g, '');
      const clientName = (v.clientName || '').toLowerCase();
      
      // Look up dynamic accurate vehicle name
      const actualVehicle = vehicles.find(veh => {
        const cleanVPlate = veh.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const cleanPlate = v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return cleanVPlate === cleanPlate;
      });
      const vehicleName = (actualVehicle ? actualVehicle.name : v.vehicleName).toLowerCase();

      return !debouncedSearchQuery || 
        cleanPlate.includes(q) || 
        clientName.includes(debouncedSearchQuery.toLowerCase()) ||
        vehicleName.includes(debouncedSearchQuery.toLowerCase());
    });
  }, [violations, debouncedSearchQuery, vehicles, selectedDate, filterDateMode]);

  // 5b. Dynamic stats calculation based on filtered violations
  const dynamicStats = useMemo(() => {
    let waitingSum = 0;
    let successfulSum = 0;
    let waitingCount = 0;
    let successfulCount = 0;

    filteredViolations.forEach(v => {
      const priceVal = typeof v.price === 'number' ? v.price : parseFloat(String(v.price || '0'));
      const finalPrice = isNaN(priceVal) ? 0 : priceVal;

      if (v.status === 'successful') {
        successfulSum += finalPrice;
        successfulCount += 1;
      } else {
        waitingSum += finalPrice;
        waitingCount += 1;
      }
    });

    return { waitingSum, successfulSum, waitingCount, successfulCount };
  }, [filteredViolations]);

  // 6. Pagination (5 items per page)
  const paginatedViolations = useMemo(() => {
    const startIndex = (currentPage - 1) * 5;
    return filteredViolations.slice(startIndex, startIndex + 5);
  }, [filteredViolations, currentPage]);

  const totalPages = Math.ceil(filteredViolations.length / 5) || 1;

  // Reset pagination if filter/query/mode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterDateMode, selectedDate]);

  return (
    <div className={cn(
      "flex-1 md:ml-[266px] h-screen transition-colors duration-500 pt-4 md:pr-4 md:pb-4 md:pl-0 flex flex-col overflow-y-auto no-scrollbar",
      isDarkMode ? "bg-[#1E1B1A]" : "bg-white"
    )}>
      <div className="p-6 space-y-6 flex flex-col">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={cn(
            "text-2xl font-black tracking-tight",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            VIOLATIONS LOG
          </h1>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest leading-relaxed mt-1">
            Automated Safe City fine tracking &amp; status enforcement
          </p>
        </div>
        
        {isSyncing && (
          <div className="flex items-center gap-2 px-3 py-1 bg-[#FF5C35]/10 border border-[#FF5C35]/25 text-[#FF5C35] rounded-full text-[10px] font-bold tracking-widest animate-pulse">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            SYNCING FROM SC PANEL...
          </div>
        )}
      </div>

      {/* Top 2 Metric Cards (Red and Blue Gradient-hues) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Waiting Panel */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-700 text-white p-6 shadow-xl flex items-center justify-between border border-red-500/10"
        >
          {/* Subtle siren background glow */}
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 scale-150">
            <Siren className="w-40 h-40 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase opacity-75">Waiting Violation Payments</span>
            <h2 className="text-4xl font-black tracking-tight mt-1">{dynamicStats.waitingCount}</h2>
            <p className="text-[10px] uppercase font-bold tracking-wider opacity-85 mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
              Action required
            </p>
          </div>

          {/* Dynamic Price Fine bubble in between */}
          <div className="flex-1 flex justify-center px-4 z-10">
            <motion.div 
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative px-4 py-2.5 rounded-2xl select-none font-black text-center shadow-lg bg-white/15 border border-white/20 text-white flex flex-col items-center justify-center min-w-[125px] backdrop-blur-xs border-b-[4px]"
            >
              {/* 3D Glass Gloss Highlight Reflection */}
              <div className="absolute inset-x-0.5 top-0.5 h-1.5 bg-white/20 rounded-t-xl" />
              <span className="text-[9px] opacity-75 font-black uppercase tracking-widest leading-none mb-1">
                {filterDateMode === 'single' ? "Day Fines" : "Total Fines"}
              </span>
              <span className="text-xl font-black tracking-tight leading-none drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.15)]">
                €{dynamicStats.waitingSum.toFixed(2)}
              </span>
            </motion.div>
          </div>

          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
            <Siren className="w-6 h-6 animate-pulse" />
          </div>
        </motion.div>

        {/* Successful Panel */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-[#1E40AF] to-blue-700 text-white p-6 shadow-xl flex items-center justify-between border border-blue-500/10"
        >
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 scale-150">
            <ShieldCheck className="w-40 h-40" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase opacity-75">Successful Payments</span>
            <h2 className="text-4xl font-black tracking-tight mt-1">{dynamicStats.successfulCount}</h2>
            <p className="text-[10px] uppercase font-bold tracking-wider opacity-85 mt-2 flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-300" />
              All cleared
            </p>
          </div>

          {/* Dynamic Price Fine bubble in between */}
          <div className="flex-1 flex justify-center px-4 z-10">
            <motion.div 
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="relative px-4 py-2.5 rounded-2xl select-none font-black text-center shadow-lg bg-white/15 border border-white/20 text-white flex flex-col items-center justify-center min-w-[125px] backdrop-blur-xs border-b-[4px]"
            >
              {/* 3D Glass Gloss Highlight Reflection */}
              <div className="absolute inset-x-0.5 top-0.5 h-1.5 bg-white/20 rounded-t-xl" />
              <span className="text-[9px] opacity-75 font-black uppercase tracking-widest leading-none mb-1">
                {filterDateMode === 'single' ? "Day Cleared" : "Total Cleared"}
              </span>
              <span className="text-xl font-black tracking-tight leading-none drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.15)]">
                €{dynamicStats.successfulSum.toFixed(2)}
              </span>
            </motion.div>
          </div>

          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </motion.div>
      </div>

      {/* Main List & Controls Container */}
      <div className={cn(
        "p-6 rounded-3xl border flex flex-col gap-6",
        isDarkMode ? "bg-[#141211] border-white/5" : "bg-white border-black/5"
      )}>
        {/* Search Bar, 3D Panel, and Calendar Pill */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="relative flex-1 md:max-w-[280px]">
            <span className="absolute inset-y-0 left-4 flex items-center justify-center">
              <Search className="w-4 h-4 text-gray-500" />
            </span>
            <input
              type="text"
              placeholder="Search by plate or vehicle model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-11 pr-5 py-3.5 rounded-2xl text-xs font-medium focus:outline-none transition-all border",
                isDarkMode 
                  ? "bg-white/5 border-white/5 text-white focus:bg-white/10 focus:border-[#FF5C35]/30" 
                  : "bg-gray-100 border-black/5 text-gray-900 focus:bg-white focus:border-[#FF5C35]/30"
              )}
            />
          </div>

          {/* 3D Clickable Copyable Panel for MVR Code 7630301 */}
          <motion.div
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              navigator.clipboard.writeText("7630301");
              setCopiedNumber(true);
              setTimeout(() => setCopiedNumber(false), 2000);
            }}
            className={cn(
              "relative px-4 py-3 rounded-2xl cursor-pointer select-none font-black text-center shadow-md transition-all shrink-0 border-b-4 flex items-center gap-2",
              isDarkMode
                ? "bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 border-blue-950 text-white shadow-blue-950/40"
                : "bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-300 text-blue-700 shadow-blue-200/50"
            )}
            title="Click to copy 7630301"
          >
            {/* 3D Glass Gloss Highlight Reflection */}
            <div className="absolute inset-x-0.5 top-0.5 h-1.5 bg-white/20 rounded-t-xl" />
            
            <span className="text-[10px] uppercase tracking-widest font-extrabold opacity-75">Code:</span>
            <span className={cn(
              "font-mono text-xs tracking-wider font-black",
              isDarkMode ? "text-white" : "text-blue-950"
            )}>
              7630301
            </span>
            {copiedNumber ? (
              <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-md font-bold uppercase animate-pulse">
                Copied!
              </span>
            ) : (
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase",
                isDarkMode ? "bg-white/15 text-white" : "bg-blue-200 text-blue-800"
              )}>
                Copy
              </span>
            )}
          </motion.div>

          {/* Calendar Day Picker Pill */}
          <div className={cn(
            "flex items-center gap-2 p-1.5 rounded-2xl border shrink-0 shadow-sm",
            isDarkMode ? "bg-white/5 border-white/5" : "bg-neutral-100 border-neutral-200"
          )}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const prev = new Date(selectedDate);
                prev.setDate(prev.getDate() - 1);
                setSelectedDate(prev);
                setFilterDateMode('single');
              }}
              className={cn(
                "p-2 rounded-xl transition-all cursor-pointer",
                isDarkMode ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-200 text-gray-700"
              )}
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4 stroke-[3]" />
            </motion.button>

            <div className="flex flex-col items-center px-4 min-w-[130px] select-none text-center">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest leading-none mb-0.5",
                isDarkMode ? "text-gray-400" : "text-gray-500"
              )}>
                {filterDateMode === 'all' ? "Filter" : selectedDate.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span className={cn(
                "text-xs font-black tracking-tight",
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                {filterDateMode === 'all' ? "ALL DATES" : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const next = new Date(selectedDate);
                next.setDate(next.getDate() + 1);
                setSelectedDate(next);
                setFilterDateMode('single');
              }}
              className={cn(
                "p-2 rounded-xl transition-all cursor-pointer",
                isDarkMode ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-200 text-gray-700"
              )}
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </motion.button>

            <div className={cn("w-px h-6 mx-1", isDarkMode ? "bg-white/10" : "bg-neutral-300")} />

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSelectedDate(new Date());
                setFilterDateMode('single');
              }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all cursor-pointer border",
                filterDateMode === 'single' && isSameDay(selectedDate, new Date())
                  ? (isDarkMode ? "bg-[#FF5C35]/15 border-[#FF5C35]/30 hover:bg-[#FF5C35]/25 text-[#FF5C35]" : "bg-[#FF5C35]/15 border-[#FF5C35]/30 text-[#FF5C35]")
                  : (isDarkMode ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10" : "bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50 shadow-sm")
              )}
              title="Jump to Today"
            >
              Today
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilterDateMode('all')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all cursor-pointer border",
                filterDateMode === 'all'
                  ? (isDarkMode ? "bg-[#FF5C35]/15 border-[#FF5C35]/30 hover:bg-[#FF5C35]/25 text-[#FF5C35]" : "bg-[#FF5C35]/15 border-[#FF5C35]/30 text-[#FF5C35]")
                  : (isDarkMode ? "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10" : "bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50 shadow-sm")
              )}
              title="Show All Violations"
            >
              All
            </motion.button>
          </div>
        </div>

        {/* Violations List */}
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {paginatedViolations.length > 0 ? (
              paginatedViolations.map((v) => {
                const isWaiting = v.status === 'waiting';

                // Dynamically look up correct vehicle from the state array
                const actualVehicle = vehicles.find(veh => {
                  const cleanVPlate = veh.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  const cleanPlate = v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  return cleanVPlate === cleanPlate;
                });
                const vehicleDisplayName = actualVehicle ? actualVehicle.name : v.vehicleName;

                return (
                  <motion.div
                    key={v.id}
                    layoutId={v.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    className={cn(
                      "p-5 rounded-2xl border flex flex-col lg:grid lg:grid-cols-12 items-stretch lg:items-center gap-6 transition-all relative overflow-hidden shadow-sm",
                      isWaiting 
                        ? (isDarkMode 
                            ? "bg-red-950/20 border-red-900/30 hover:bg-red-950/30" 
                            : "bg-red-50/70 border-red-200 hover:bg-red-100/60")
                        : (isDarkMode 
                            ? "bg-blue-950/20 border-blue-900/30 hover:bg-blue-950/30" 
                            : "bg-blue-50/70 border-blue-200 hover:bg-blue-100/60")
                    )}
                  >
                    {/* Visual bar tagging the state */}
                    <div className={cn(
                      "absolute left-0 top-0 bottom-0 w-1",
                      isWaiting ? "bg-red-500" : "bg-blue-500"
                    )} />

                    {/* Left: Info Grid - 4 columns (Plate, Matched Renter, Time, Portal) */}
                    <div className="col-span-12 lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 items-center">
                      {/* Fleet Plate Section */}
                      <div className="flex items-center gap-3.5">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm overflow-hidden relative",
                          isWaiting 
                            ? "bg-red-500/10 border-red-500/25" 
                            : "bg-blue-500/10 border-blue-500/25"
                        )}>
                          <Image 
                            src="/violation.png" 
                            alt="Violation Icon" 
                            width={36} 
                            height={36} 
                            className="object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0 flex flex-col gap-1">
                          <p className={cn(
                            "text-base font-black tracking-tight truncate leading-tight",
                            isDarkMode ? "text-white" : "text-gray-900"
                          )}>
                            {vehicleDisplayName}
                          </p>
                          <div className="flex items-center">
                            <span className={cn(
                              "text-xs px-2.5 py-0.5 rounded-md font-bold border tracking-wider font-mono shadow-sm",
                              isDarkMode ? "bg-black/20 text-gray-200 border-white/10" : "bg-neutral-100/80 text-gray-800 border-gray-300"
                            )}>
                              {v.plate}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Active Client Section */}
                      {(() => {
                        const matchedRes = getReservationForViolation(v);
                        const clientName = matchedRes ? matchedRes.name : (v.clientName || 'Unassigned Client');
                        const hasMatched = !!matchedRes;

                        return (
                          <div className="flex items-center gap-3.5">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm relative transition-all duration-200 select-none",
                              hasMatched
                                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-500 hover:scale-105 active:scale-95 cursor-pointer hover:bg-emerald-500/20" 
                                : "bg-gray-500/10 border-gray-500/25 text-gray-400 dark:text-gray-500 cursor-default"
                            )}
                            onClick={() => {
                              if (hasMatched) {
                                setSelectedRenterBooking(matchedRes);
                              }
                            }}
                            title={hasMatched ? "Click to view matched booking details" : "No active booking matched"}
                            >
                              <User className="w-6 h-6" />
                              {hasMatched && (
                                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-zinc-900 animate-pulse"></span>
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest leading-none">Renter Driver</p>
                              <p className={cn(
                                "text-sm md:text-base font-black tracking-tight leading-tight truncate mt-0.5",
                                isDarkMode ? "text-white" : "text-gray-900"
                              )}
                              title={clientName}
                              >
                                {clientName}
                              </p>
                              {hasMatched ? (
                                <button
                                  onClick={() => setSelectedRenterBooking(matchedRes)}
                                  className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 font-mono flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 outline-none hover:underline mt-0.5"
                                >
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                  Active Renter • View
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 font-mono uppercase tracking-wider mt-0.5">
                                  Static / Unlinked
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Radar Date Time Section */}
                      <div className="flex items-center gap-3.5">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm",
                          isWaiting 
                            ? "bg-red-500/10 border-red-500/25 text-red-500" 
                            : "bg-blue-500/10 border-blue-500/25 text-blue-500"
                        )}>
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest leading-none">Violation Time</p>
                          <p className={cn(
                            "text-sm md:text-base font-black tracking-tight leading-tight mt-0.5",
                            isDarkMode ? "text-white" : "text-gray-900"
                          )}>
                            {new Date(v.datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <p className="text-xs font-bold text-[#FF5C35] font-mono mt-0.5">
                            {new Date(v.datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })}
                          </p>
                        </div>
                      </div>

                      {/* Link & Source Portal Section */}
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                          isWaiting 
                            ? "bg-red-500/10 border-red-500/20 text-red-400" 
                            : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        )}>
                          <ExternalLink className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider leading-none">Source Portal</p>
                          <a 
                            href={v.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs font-black text-[#FF5C35] hover:underline flex items-center gap-1 mt-1 select-none"
                          >
                            <span className="truncate max-w-[120px] inline-block">{v.link.replace('https://', '')}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          </a>
                          <p className="text-[9px] text-gray-500 mt-1 uppercase font-bold tracking-widest opacity-80 leading-none">
                            MVR API Scan
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right: Payments action button / state indicator with price and confirmation */}
                    <div className="col-span-12 lg:col-span-3 flex items-center gap-4 justify-end shrink-0 pl-1">
                      {isWaiting ? (
                        <div className="flex items-center gap-2.5">
                          {/* Manual price input in euros with confirm check icon inside */}
                          {(!v.price || v.price <= 0) ? (
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                placeholder="0.00"
                                value={finePrices[v.id] !== undefined ? finePrices[v.id] : ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFinePrices({ ...finePrices, [v.id]: val });
                                }}
                                onBlur={(e) => {
                                  handleUpdateFinePrice(v.id, e.target.value);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = (e.target as HTMLInputElement).value;
                                    handleUpdateFinePrice(v.id, val);
                                  }
                                }}
                                className={cn(
                                  "w-28 px-2.5 pl-6 pr-8 py-2 rounded-xl text-xs font-bold border outline-none transition-all focus:ring-1",
                                  isDarkMode 
                                    ? "bg-[#1C1C1E] border-white/10 text-white focus:border-[#FF5C35] focus:ring-[#FF5C35]/30 placeholder-gray-600" 
                                    : "bg-gray-50 border-gray-300 text-gray-900 focus:border-[#FF5C35] focus:ring-[#FF5C35]/30 placeholder-gray-400"
                                )}
                              />
                              <span className="absolute left-2.5 top-[50%] -translate-y-[50%] text-[10px] font-black text-gray-500 select-none">€</span>
                              
                              <motion.button
                                whileHover={{ scale: 1.15 }}
                                whileTap={{ scale: 0.9 }}
                                onMouseDown={(e) => {
                                  // Prevent input focus loss (onBlur) from firing before the click event is completed
                                  e.preventDefault();
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const currentPriceVal = finePrices[v.id] !== undefined ? finePrices[v.id] : '';
                                  handleUpdateFinePrice(v.id, currentPriceVal);
                                  
                                  // Programmatically blur the input field so that it exits edit mode nicely
                                  if (document.activeElement instanceof HTMLElement) {
                                    document.activeElement.blur();
                                  }
                                }}
                                className={cn(
                                  "absolute right-1 text-white p-1 rounded-lg transition-all focus:outline-none flex items-center justify-center shadow-lg cursor-pointer z-10",
                                  "bg-[#FF5C35] hover:bg-[#ff6c4a]"
                                )}
                                title="Save and confirm fine price"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </motion.button>
                            </div>
                          ) : (
                            /* Show the saved price of waiting/pending fine in a nice RED bubbly badge (LOCKED - no edit) */
                            <motion.div 
                              whileHover={{ scale: 1.05 }}
                              className={cn(
                                "relative px-4 py-2.5 rounded-2xl select-none shrink-0 cursor-default font-black text-center shadow-lg transition-all border-b-[4px]",
                                isDarkMode 
                                  ? "bg-gradient-to-br from-red-500 via-[#FF5C35] to-rose-600 border-red-700 text-white shadow-red-950/40" 
                                  : "bg-gradient-to-br from-red-400 via-[#FF5C35] to-rose-500 border-red-600 text-white shadow-red-200/50"
                              )}
                              title="Confirmed fine price"
                            >
                              {/* 3D Glass Gloss Highlight Reflection */}
                              <div className="absolute inset-x-0.5 top-0.5 h-2 bg-white/20 rounded-t-xl" />
                              
                              {/* Bubbles backdrop */}
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-white/10 rounded-full blur-xs" />
                              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white/10 rounded-full blur-xs" />
                              
                              <span className="relative flex items-center justify-center gap-0.5 font-sans tracking-tighter text-base font-extrabold drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.15)]">
                                <span className="text-xs font-black select-none opacity-90">€</span>
                                {v.price}
                              </span>
                            </motion.div>
                          )}
 
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setConfirmPayId(v.id)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-[10px] font-black tracking-widest uppercase shadow-lg shadow-red-500/20 border border-red-400/20 cursor-pointer shrink-0"
                            title="Click to pay and transition state"
                          >
                            <Siren className="w-4 h-4 animate-bounce shrink-0" style={{ animationDuration: '3s' }} />
                            <span>Clear Fine</span>
                          </motion.button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          {/* Show the saved price of cleared fine if present - Custom 3D bubbly badge in BLUE */}
                          {(v.price !== undefined && v.price > 0) && (
                            <motion.div 
                              whileHover={{ scale: 1.1, rotate: -2 }}
                              whileTap={{ scale: 0.95 }}
                              className={cn(
                                "relative px-4 py-2.5 rounded-2xl select-none shrink-0 cursor-default font-black text-center shadow-lg transition-all",
                                "border-b-[4px]", // Gives it that 3D chunky bubbly depth
                                isDarkMode 
                                  ? "bg-gradient-to-br from-blue-500 via-sky-500 to-blue-600 border-blue-700 text-white shadow-blue-950/40" 
                                  : "bg-gradient-to-br from-blue-400 via-blue-500 to-sky-500 border-blue-600 text-white shadow-blue-200/50"
                              )}
                            >
                              {/* 3D Glass Gloss Highlight Reflection */}
                              <div className="absolute inset-x-0.5 top-0.5 h-2 bg-white/20 rounded-t-xl" />
                              
                              {/* Bubbles backdrop */}
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-white/10 rounded-full blur-xs" />
                              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white/10 rounded-full blur-xs" />
                              
                              <span className="relative flex items-center justify-center gap-0.5 font-sans tracking-tighter text-base font-extrabold drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.15)]">
                                <span className="text-xs font-black select-none opacity-90">€</span>
                                {v.price}
                              </span>
                            </motion.div>
                          )}
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-xl text-[10px] font-black tracking-widest uppercase select-none shrink-0">
                            <Check className="w-4 h-4 text-emerald-500" />
                            <span>CLEARED</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="py-20 text-center text-gray-500 opacity-60">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-20 text-[#FF5C35]" />
                <h3 className="font-bold text-sm">No violations found</h3>
                <p className="text-xs mt-1">Radar scans are linked to vehicles matching client calendars automatically.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Pagination Section */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/5 pt-4">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className={cn(
                  "p-2 rounded-xl transition-all border",
                  currentPage === 1 
                    ? "opacity-40 cursor-not-allowed border-transparent" 
                    : "hover:bg-[#FF5C35]/15 cursor-pointer border-white/10"
                )}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className={cn(
                  "p-2 rounded-xl transition-all border",
                  currentPage === totalPages 
                    ? "opacity-40 cursor-not-allowed border-transparent" 
                    : "hover:bg-[#FF5C35]/15 cursor-pointer border-white/10"
                )}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Confirmation Modal Pop-up */}
      <AnimatePresence>
        {confirmPayId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmPayId(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className={cn(
                "w-full max-w-md p-6 rounded-3xl border shadow-2xl relative z-10",
                isDarkMode ? "bg-[#1C1C1E] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                  <Siren className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-red-500">Confirm Action</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">MVR Infraction Clearance</p>
                </div>
              </div>
              
              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                Are you absolutely sure you want to mark this radar infraction as paid and cleared? This action is irreversible.
                {(() => {
                  const matchedViolation = violations.find(item => item.id === confirmPayId);
                  const currentPriceStr = finePrices[confirmPayId] !== undefined ? finePrices[confirmPayId] : (matchedViolation?.price ? String(matchedViolation.price) : '');
                  if (currentPriceStr) {
                    return (
                      <span className="block mt-2 font-black text-emerald-400">
                        Fine Cost: €{parseFloat(currentPriceStr).toFixed(2)}
                      </span>
                    );
                  }
                  return (
                    <span className="block mt-2 font-bold text-gray-500 italic">
                      No payment amount was entered.
                    </span>
                  );
                })()}
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setConfirmPayId(null)}
                  className={cn(
                    "px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer",
                    isDarkMode ? "hover:bg-white/5 text-gray-400" : "hover:bg-neutral-100 text-gray-600"
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handlePayViolation(confirmPayId);
                    setConfirmPayId(null);
                  }}
                  className="px-5 py-2.5 text-xs font-extrabold uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/20 cursor-pointer"
                >
                  Yes, Clear Fine
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Matched Booking Details Modal */}
      <AnimatePresence>
        {selectedRenterBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRenterBooking(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className={cn(
                "w-full max-w-md p-6 rounded-3xl border shadow-2xl relative z-10 overflow-hidden",
                isDarkMode ? "bg-[#1C1C1E] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
              )}
            >
              {/* Decorative Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500">Active Renter Details</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Matched Calendar Booking</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRenterBooking(null)}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer text-xs font-bold",
                    isDarkMode ? "border-white/10 hover:bg-white/5 text-gray-400" : "border-gray-200 hover:bg-gray-50 text-gray-600"
                  )}
                >
                  ✕
                </button>
              </div>
              
              {/* Details List */}
              <div className="space-y-4">
                <div className={cn("p-4 rounded-2xl border", isDarkMode ? "bg-zinc-900/40 border-white/5" : "bg-zinc-50 border-gray-100")}>
                  <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Renter Name</p>
                  <p className="text-base font-black tracking-tight mt-1">{selectedRenterBooking.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={cn("p-4 rounded-2xl border", isDarkMode ? "bg-zinc-900/40 border-white/5" : "bg-zinc-50 border-gray-100")}>
                    <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Phone Number</p>
                    <p className="text-xs font-black tracking-tight mt-1 break-words">{selectedRenterBooking.phone || 'N/A'}</p>
                  </div>
                  <div className={cn("p-4 rounded-2xl border", isDarkMode ? "bg-zinc-900/40 border-white/5" : "bg-zinc-50 border-gray-100")}>
                    <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Email Address</p>
                    <p className="text-xs font-black tracking-tight mt-1 break-words">{selectedRenterBooking.email || 'N/A'}</p>
                  </div>
                </div>

                <div className={cn("p-4 rounded-2xl border", isDarkMode ? "bg-zinc-900/40 border-white/5" : "bg-zinc-50 border-gray-100")}>
                  <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Rental Schedule</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-xs font-bold font-mono">
                      {new Date(selectedRenterBooking.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' - '}
                      {new Date(selectedRenterBooking.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-black mt-1 uppercase tracking-wider font-mono">
                    Total Duration: {selectedRenterBooking.days} days
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={cn("p-4 rounded-2xl border", isDarkMode ? "bg-zinc-900/40 border-white/5" : "bg-zinc-50 border-gray-100")}>
                    <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Booking Status</p>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider mt-1.5",
                      selectedRenterBooking.status === 'ON RENT' 
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-blue-500/15 text-blue-500"
                    )}>
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-ping" />
                      {selectedRenterBooking.status}
                    </span>
                  </div>
                  <div className={cn("p-4 rounded-2xl border", isDarkMode ? "bg-zinc-900/40 border-white/5" : "bg-zinc-50 border-gray-100")}>
                    <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Financials</p>
                    <p className="text-xs font-black tracking-tight mt-1.5">
                      Paid: <span className="text-emerald-500">€{selectedRenterBooking.amountPaid}</span> / €{selectedRenterBooking.totalPrice}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setSelectedRenterBooking(null)}
                  className="px-6 py-2.5 text-xs font-extrabold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  Close View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
