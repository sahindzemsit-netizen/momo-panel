"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Calendar as CalendarIcon,
  Car,
  User,
  Phone,
  CreditCard,
  Contact,
  DollarSign,
  FileText,
  MapPin,
  Search,
  Flag,
  Check,
  Clock,
  Scan,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn, parseDateSafe } from "@/lib/utils";
import {
  format,
  differenceInCalendarDays,
  addDays,
  startOfDay,
  isSameDay,
} from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { Vehicle, Reservation } from "@/types";
import { AVAILABLE_COUNTRIES, COUNTRY_COLORS, VEHICLE_COUNTRIES, INSURANCE_OPTIONS } from "@/lib/constants";
import { doc, getDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { storage, db } from "@/lib/firebase";
import DocumentPanel from "./DocumentPanel";

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  sidebarColor: string;
  vehicles: Vehicle[];
  allReservations: Reservation[];
  onSaveReservation: (reservation: Partial<Reservation>) => Promise<void> | void;
  initialData?: Partial<Reservation> & { rawStart?: Date; rawEnd?: Date; client?: string; price?: string };
  mode?: "full" | "dates";
}

export default function ReservationModal({
  isOpen,
  onClose,
  isDarkMode,
  sidebarColor,
  vehicles,
  allReservations,
  onSaveReservation,
  initialData,
  mode = "full",
}: ReservationModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<string | number | "">(
    "",
  );
  const [phone, setPhone] = useState("");
  const [passportId, setPassportId] = useState("");
  const [driverLicenseId, setDriverLicenseId] = useState("");
  const [range, setRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [tempRange, setTempRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarCoords, setCalendarCoords] = useState<DOMRect | null>(null);
  const [vehicleDropdownCoords, setVehicleDropdownCoords] = useState<DOMRect | null>(null);
  const [modalCoords, setModalCoords] = useState<DOMRect | null>(null);
  const [basePrice, setBasePrice] = useState("45");
  const [totalPrice, setTotalPrice] = useState("45");
  const [note, setNote] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [processedBy, setProcessedBy] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccessCheck, setShowSuccessCheck] = useState(false);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [countrySelectorCoords, setCountrySelectorCoords] = useState<DOMRect | null>(null);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [localVehicleSearch, setLocalVehicleSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setVehicleSearch(localVehicleSearch);
    }, 150);
    return () => clearTimeout(handler);
  }, [localVehicleSearch]);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [activeVehicleTab, setActiveVehicleTab] = useState<string>("All");
  const [selectedInsurance, setSelectedInsurance] = useState<typeof INSURANCE_OPTIONS[number] | null>(null);
  const [showInsurancePopup, setShowInsurancePopup] = useState(false);
  const [insurancePopupCoords, setInsurancePopupCoords] = useState<DOMRect | null>(null);
  const [processedByError, setProcessedByError] = useState(false);
  const [vehicleError, setVehicleError] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerDropdownCoords, setCustomerDropdownCoords] = useState<DOMRect | null>(null);

  const CUSTOMERS_PER_PAGE = 5;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<NonNullable<Reservation["uploadedDocuments"]>>([]);
  const [tempId, setTempId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScanDocument = async () => {
    if (!uploadedDocuments || uploadedDocuments.length === 0) {
      alert("Please upload an ID Card, Driver's License or Passport first in the documents panel!");
      return;
    }

    // Sort documents by uploadedAt descending (top to bottom as listed in the stored documents UI)
    // and grab up to 3 different documents to scan and combine.
    const sortedDocs = [...uploadedDocuments].sort((a, b) => b.uploadedAt - a.uploadedAt);
    const docsToScan = sortedDocs.slice(0, 3).map(doc => ({
      url: doc.url,
      type: doc.type || "image/jpeg",
    }));

    setIsScanning(true);
    setScanError(null);
    try {
      const response = await fetch("/api/gemini/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documents: docsToScan,
        }),
      });

      let resData: any = null;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        resData = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      if (!response.ok || !resData.success) {
        throw new Error(resData?.error || "Failed to scan document");
      }

      if (resData.data) {
        const { fullName, passportId: passId, licenseId: licId, email: extractedEmail, phone: extractedPhone } = resData.data;

        if (fullName) {
          setName(fullName.toUpperCase());
        }
        if (passId) {
          setPassportId(passId.trim());
        } else {
          setPassportId("");
        }
        if (licId) {
          setDriverLicenseId(licId.trim());
        } else {
          setDriverLicenseId("");
        }
        if (extractedEmail) {
          setEmail(extractedEmail.trim());
        } else {
          setEmail("");
        }
        if (extractedPhone) {
          setPhone(extractedPhone.trim());
        } else {
          setPhone("");
        }
      }
    } catch (err: any) {
      console.error("Scan error:", err);
      const errMsg = err.message || "Unable to scan document";
      setScanError(errMsg);
      alert(errMsg + ". Please make sure the document is a clearly readable image, scan, or PDF.");
    } finally {
      setIsScanning(false);
    }
  };

  // Memoized unique customers list extracted from all history
  const uniqueCustomers = React.useMemo(() => {
    const customersMap = new Map<string, {
      name: string;
      email: string;
      phone: string;
      passportId: string;
      driverLicenseId: string;
    }>();

    allReservations.forEach(res => {
      if (!res.name) return;
      // Key by passport and driver license to distinguish customers
      const passportVal = (res.passportId || '').trim().toLowerCase();
      const licenseVal = (res.driverLicenseId || '').trim().toLowerCase();
      if (!passportVal || !licenseVal) return;

      const key = `${passportVal}|${licenseVal}`;
      const existing = customersMap.get(key);
      if (!existing) {
        customersMap.set(key, {
          name: res.name,
          email: res.email || "",
          phone: res.phone || "",
          passportId: res.passportId || "",
          driverLicenseId: res.driverLicenseId || "",
        });
      } else {
        // Accumulate fields from other reservations of the same customer
        if (!existing.email && res.email) existing.email = res.email;
        if (res.phone) existing.phone = res.phone;
      }
    });

    return Array.from(customersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allReservations]);

  const filteredCustomers = uniqueCustomers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase())) ||
    (c.passportId && c.passportId.toLowerCase().includes(customerSearch.toLowerCase())) ||
    (c.driverLicenseId && c.driverLicenseId.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  // Pagination logic
  const totalCustomerPages = Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE);
  const paginatedCustomers = filteredCustomers.slice(
    (customerPage - 1) * CUSTOMERS_PER_PAGE,
    customerPage * CUSTOMERS_PER_PAGE
  );

  // Reset page when search changes
  useEffect(() => {
    setCustomerPage(1);
  }, [customerSearch]);

  // Helper to title case names
  const formatName = (value: string) => {
    return value
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Populate form if initialData is provided
  useEffect(() => {
    const isValidDate = (d: unknown) => d instanceof Date && !isNaN(d.getTime());

    if (initialData && isOpen) {
      if (initialData.id) {
        setTempId(String(initialData.id));
        // Lazy-fetch complete documents on-demand if documents exist
        if (initialData.uploadedDocuments && initialData.uploadedDocuments.length > 0) {
          getDoc(doc(db, 'reservations', String(initialData.id)))
            .then(snap => {
              if (snap.exists()) {
                const fullDocs = snap.data()?.uploadedDocuments;
                if (fullDocs && Array.isArray(fullDocs)) {
                  setUploadedDocuments(fullDocs);
                }
              }
            })
            .catch(err => console.warn("Failed to lazy load docs in modal:", err));
        }
      } else {
        setTempId(String(Date.now()));
      }
      setUploadedDocuments(initialData.uploadedDocuments || []);
      setName((initialData.name || initialData.client || "").toUpperCase());
      setEmail(initialData.email || "");
      setSelectedVehicle(initialData.vehicleId ?? "");
      setPhone(initialData.phone || "");
      setPassportId(initialData.passportId || "");
      setDriverLicenseId(initialData.driverLicenseId || "");

      const startDate =
        initialData.rawStart ||
        (initialData.start instanceof Date
          ? initialData.start
          : initialData.start
            ? new Date(initialData.start)
            : new Date());
      const endDate =
        initialData.rawEnd ||
        (initialData.end instanceof Date
          ? initialData.end
          : initialData.end
            ? new Date(initialData.end)
            : new Date());

      setRange({
        from: isValidDate(startDate)
          ? startOfDay(startDate)
          : startOfDay(new Date()),
        to: isValidDate(endDate)
          ? startOfDay(endDate)
          : startOfDay(addDays(new Date(), 1)),
      });
      const initialInsur = (initialData.insurance as typeof INSURANCE_OPTIONS[number]) || null;
      setSelectedInsurance(initialInsur);
      
      const rawPrice = Number(initialData.totalPrice || initialData.price?.replace("€", "") || "45");
      setTotalPrice(String(rawPrice));
      setArrivalTime(initialData.arrivalTime || "");
      setDepartureTime(initialData.departureTime || "");
      const lastSavedProcessedBy = typeof window !== 'undefined' ? localStorage.getItem("last_processed_by") || "" : "";
      setProcessedBy(initialData.processedBy || "");
      setFromLocation(initialData.fromLocation || "");
      setToLocation(initialData.toLocation || "");
      setSelectedCountries(initialData.countries || []);
      setAmountPaid(initialData.amountPaid || 0);
      setNote(initialData.note || "");
      setProcessedByError(false);
      setVehicleError(false);
      
      // Calculate base price by subtracting insurance if it exists
      if (initialInsur) {
        setBasePrice(String(rawPrice - initialInsur.price));
      } else {
        setBasePrice(String(rawPrice));
      }
    } else if (!initialData && isOpen) {
      setTempId(String(Date.now()));
      setUploadedDocuments([]);
      const lastSavedProcessedBy = typeof window !== 'undefined' ? localStorage.getItem("last_processed_by") || "" : "";
      // Reset form for new reservation
      setName("");
      setEmail("");
      setSelectedVehicle("");
      setPhone("");
      setPassportId("");
      setDriverLicenseId("");
      setRange({
        from: undefined,
        to: undefined,
      });
      setBasePrice("45");
      setTotalPrice("45");
      setNote("");
      setArrivalTime("");
      setDepartureTime("");
      setProcessedBy("");
      setFromLocation("");
      setToLocation("");
      setSelectedCountries([]);
      setAmountPaid(0);
      setSelectedInsurance(null);
      setProcessedByError(false);
      setVehicleError(false);
    }
  }, [initialData, isOpen]);

  const handleClose = () => {
    if (isSubmitting) return;

    // Clean up draft uploaded documents if this was a NEW unsaved reservation
    if ((!initialData || !initialData.id) && uploadedDocuments && uploadedDocuments.length > 0) {
      console.log(`Cleaning up ${uploadedDocuments.length} draft documents from Firebase Storage because reservation was discarded.`);
      const docsToDelete = [...uploadedDocuments];
      docsToDelete.forEach(async (docItem) => {
        try {
          const storageRef = ref(storage, docItem.url);
          await deleteObject(storageRef);
          console.log(`Deleted draft document: ${docItem.name}`);
        } catch (err) {
          console.error(`Failed to delete draft document ${docItem.name}:`, err);
        }
      });
      setUploadedDocuments([]);
    }

    setShowCalendar(false);
    setShowConfirm(false);
    setShowVehicleDropdown(false);
    setShowCustomerDropdown(false);
    onClose();
  };

  // Update total price whenever base price or insurance changes
  useEffect(() => {
    const base = Number(basePrice) || 0;
    const insurance = selectedInsurance?.price || 0;
    setTotalPrice(String(base + insurance));
  }, [basePrice, selectedInsurance]);

  const days =
    range.from && range.to ? differenceInCalendarDays(range.to, range.from) : 0;

  const effectiveColor = React.useMemo(() => {
    const defaultLight = "#0E0C0B";
    const defaultDark = "#231F1D";
    if (isDarkMode && sidebarColor === defaultLight) return defaultDark;
    if (!isDarkMode && sidebarColor === defaultDark) return defaultLight;
    return sidebarColor;
  }, [isDarkMode, sidebarColor]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("ReservationModal handleSubmit triggered", {
      name,
      selectedVehicle,
      range,
    });
    if (clashError) {
      console.warn("Cannot submit: Date clash error", clashError);
      return;
    }
    if (!processedBy || !processedBy.trim()) {
      setProcessedByError(true);
      console.warn("Validation failed in ReservationModal: Processed By is required");
      return;
    }
    if (mode !== "dates" && (selectedVehicle === "" || selectedVehicle === undefined || selectedVehicle === null)) {
      setVehicleError(true);
      console.warn("Validation failed in ReservationModal: Vehicle is required");
      return;
    }
    if (
      !name ||
      (mode !== "dates" && (selectedVehicle === "" || selectedVehicle === undefined || selectedVehicle === null)) ||
      !range.from ||
      !range.to
    ) {
      console.warn("Validation failed in ReservationModal", {
        name,
        selectedVehicle,
        range,
      });
      return;
    }
    setShowConfirm(true);
  };

  const confirmReservation = async () => {
    console.log("ReservationModal confirmReservation triggered", {
      id: initialData?.id,
      range,
    });
    setIsSubmitting(true);
    setShowConfirm(false);
    setShowSuccessCheck(true);

    const savePromise = (async () => {
      await onSaveReservation({
        id: initialData?.id || tempId,
        name,
        email,
        vehicleId: isNaN(Number(selectedVehicle)) ? selectedVehicle : Number(selectedVehicle),
        phone,
        passportId: passportId.trim(),
        driverLicenseId: driverLicenseId.trim(),
        start: range.from,
        end: range.to,
        days,
        totalPrice: Number(totalPrice),
        amountPaid: amountPaid,
        status: initialData?.status || 'UPCOMING',
        note,
        arrivalTime,
        departureTime,
        processedBy,
        fromLocation,
        toLocation,
        countries: selectedCountries,
        insurance: selectedInsurance,
        uploadedDocuments: uploadedDocuments,
        ...(initialData?.clientId ? { clientId: initialData.clientId } : {}),
      } as Parameters<typeof onSaveReservation>[0]);
    })();

    try {
      // Run both in parallel: wait at least 0.2 seconds for the animation to look perfect,
      // and ensure the Firestore save is fully completed before closing!
      await Promise.all([
        savePromise,
        new Promise((resolve) => setTimeout(resolve, 200)),
      ]);

      setIsSubmitting(false);
      setShowSuccessCheck(false);
      onClose(); // Parent handles closing
    } catch (error) {
      console.error("Failed to save reservation:", error);
      setIsSubmitting(false);
      setShowSuccessCheck(false);
    }
  };

  const isVehicleReserved = (vehicleId: number | string) => {
    if (!range.from || !range.to) return false;
    
    return allReservations.some(res => {
      if (String(res.id) === String(initialData?.id)) return false;
      if (String(res.vehicleId) !== String(vehicleId)) return false;
      if (res.status === 'CANCELLED' || res.status === 'COMPLETED') return false;
      
      const resStart = new Date(res.start);
      const resEnd = new Date(res.end);
      
      return (
        (range.from! >= resStart && range.from! < resEnd) ||
        (range.to! > resStart && range.to! <= resEnd) ||
        (range.from! <= resStart && range.to! >= resEnd)
      );
    });
  };

  const getClashErrorMessage = (vehicleId: number | string, fromDate: Date | undefined, toDate: Date | undefined, currentId?: string | number) => {
    if (!fromDate || !toDate || !vehicleId || vehicleId === "") return null;
    
    const start = new Date(fromDate); start.setHours(0,0,0,0);
    const end = new Date(toDate); end.setHours(0,0,0,0);

    for (const res of allReservations) {
      if (currentId && String(res.id) === String(currentId)) continue;
      if (String(res.vehicleId) !== String(vehicleId)) continue;
      if (res.status === 'CANCELLED' || res.status === 'COMPLETED') continue;

      const resStart = new Date(res.start); resStart.setHours(0,0,0,0);
      const resEnd = new Date(res.end); resEnd.setHours(0,0,0,0);

      // Intersection
      const overlapStart = start > resStart ? start : resStart;
      const overlapEnd = end < resEnd ? end : resEnd;

      if (overlapStart <= overlapEnd) {
        // They overlap. Check if overlap is exactly one day and is a valid checkout/checkin handover:
        const isOverlapExactlyOneDay = isSameDay(overlapStart, overlapEnd);
        if (isOverlapExactlyOneDay) {
          const overlapDay = overlapStart;
          const isValidCase1 = isSameDay(resEnd, overlapDay) && isSameDay(start, overlapDay);
          const isValidCase2 = isSameDay(resStart, overlapDay) && isSameDay(end, overlapDay);
          if (isValidCase1 || isValidCase2) {
            continue; // Allowed handovers
          }
        }
        
        // Format dates in readable DD/MM/YYYY style
        const formatD = (d: Date) => format(d, 'dd/MM/yyyy');
        return `Selected dates clash with an existing booking for ${res.name || 'DEMO USER'} (${formatD(resStart)} - ${formatD(resEnd)}). Only handover day overlaps are allowed.`;
      }
    }
    return null;
  };

  const clashError = React.useMemo(() => {
    return getClashErrorMessage(selectedVehicle, range.from, range.to, initialData?.id);
  }, [selectedVehicle, range.from, range.to, allReservations, initialData?.id]);

  const getDestinationCountry = (toLocation: string | undefined): 'Macedonia' | 'Kosovo' | 'Bosnia' | 'Albania' | 'Montenegro' | 'Serbia' | 'Greece' | undefined => {
    if (!toLocation) return undefined;
    const loc = toLocation.trim().toUpperCase();
    if (loc.includes('SKOPJE') || loc.includes('OHRID') || loc.includes('MACEDONIA') || loc === 'MK' || loc === 'MKD') return 'Macedonia';
    if (loc.includes('PRISTINA') || loc.includes('PRIZREN') || loc.includes('KOSOVO') || loc === 'RKS' || loc === 'KS') return 'Kosovo';
    if (loc.includes('TIRANA') || loc.includes('ALBANIA') || loc === 'AL' || loc === 'ALB') return 'Albania';
    if (loc.includes('PODGORICA') || loc.includes('MONTENEGRO') || loc === 'MNE' || loc === 'ME') return 'Montenegro';
    if (loc.includes('SARAJEVO') || loc.includes('BOSNIA') || loc === 'BIH' || loc === 'BA') return 'Bosnia';
    if (loc.includes('ATHENS') || loc.includes('THESSALONIKI') || loc.includes('GREECE') || loc === 'GR' || loc === 'GRC' || loc === 'EUROPE') return 'Greece';
    
    if (loc === 'MACEDONIA') return 'Macedonia';
    if (loc === 'KOSOVO') return 'Kosovo';
    if (loc === 'ALBANIA') return 'Albania';
    if (loc === 'BOSNIA') return 'Bosnia';
    if (loc === 'MONTENEGRO') return 'Montenegro';
    if (loc === 'SERBIA') return 'Serbia';
    if (loc === 'EUROPE' || loc === 'GREECE') return 'Greece';
    return undefined;
  };

  const vehicleStatesMap = useMemo(() => {
    const map: Record<string, { physicalCountry: 'Macedonia' | 'Kosovo' | 'Bosnia' | 'Albania' | 'Montenegro' | 'Serbia' | 'Greece'; isAwayAndNotReturned: boolean }> = {};
    vehicles.forEach(v => {
      const homeCountry = (v.country || "Macedonia") as 'Macedonia' | 'Kosovo' | 'Bosnia' | 'Albania' | 'Montenegro' | 'Serbia' | 'Greece';
      
      const onRentRes = (allReservations || []).find(r => 
        String(r.vehicleId) === String(v.id) && r.status === 'ON RENT'
      );
      
      if (onRentRes) {
        const onRentDest = onRentRes.toLocation
          ? getDestinationCountry(onRentRes.toLocation)
          : undefined;
        
        if (onRentDest && onRentDest !== homeCountry) {
          map[v.id] = { 
            physicalCountry: onRentDest as 'Macedonia' | 'Kosovo' | 'Bosnia' | 'Albania' | 'Montenegro' | 'Serbia' | 'Greece', 
            isAwayAndNotReturned: true 
          };
          return;
        }
      }

      const completedRes = (allReservations || [])
        .filter(r => String(r.vehicleId) === String(v.id) && r.status === 'COMPLETED')
        .sort((a, b) => {
          const endA = parseDateSafe(a.end).getTime();
          const endB = parseDateSafe(b.end).getTime();
          if (endA !== endB) return endA - endB;
          
          const startA = parseDateSafe(a.start).getTime();
          const startB = parseDateSafe(b.start).getTime();
          if (startA !== startB) return startA - startB;
          
          const updatedA = a.updatedAt instanceof Date ? a.updatedAt.getTime() : (typeof a.updatedAt === 'number' ? a.updatedAt : 0);
          const updatedB = b.updatedAt instanceof Date ? b.updatedAt.getTime() : (typeof b.updatedAt === 'number' ? b.updatedAt : 0);
          if (updatedA !== updatedB) return updatedA - updatedB;
          
          return String(a.id).localeCompare(String(b.id));
        });
      
      const lastCompleted = completedRes[completedRes.length - 1];
      if (!lastCompleted) {
        map[v.id] = { physicalCountry: homeCountry, isAwayAndNotReturned: false };
        return;
      }
      
      const lastCompletedDest = lastCompleted.toLocation
        ? getDestinationCountry(lastCompleted.toLocation)
        : undefined;
        
      if (!lastCompletedDest || lastCompletedDest === homeCountry) {
        map[v.id] = { physicalCountry: homeCountry, isAwayAndNotReturned: false };
        return;
      }
      
      map[v.id] = { 
        physicalCountry: lastCompletedDest as 'Macedonia' | 'Kosovo' | 'Bosnia' | 'Albania' | 'Montenegro' | 'Serbia' | 'Greece', 
        isAwayAndNotReturned: true 
      };
    });
    return map;
  }, [vehicles, allReservations]);

  const getVehiclePhysicalCountryAndAwayState = useCallback((v: Vehicle) => {
    return vehicleStatesMap[v.id] || { physicalCountry: (v.country || "Macedonia") as 'Macedonia' | 'Kosovo' | 'Bosnia' | 'Albania' | 'Montenegro' | 'Serbia' | 'Greece', isAwayAndNotReturned: false };
  }, [vehicleStatesMap]);

  const filteredVehicles = vehicles
    .filter((v) => !v.isRetired && !v.isExtra && v.name !== 'EXTRA' && !String(v.id).startsWith('extra-'))
    .filter((v) => {
      const search = vehicleSearch.toLowerCase().trim();
      const { physicalCountry } = getVehiclePhysicalCountryAndAwayState(v);
      const matchesSearch = !search ||
        v.name.toLowerCase().includes(search) ||
        v.plate.toLowerCase().includes(search);
      
      const matchesTab = activeVehicleTab === "All" || physicalCountry === activeVehicleTab;
      
      return matchesSearch && matchesTab;
    });

  const groupedVehicles = VEHICLE_COUNTRIES.reduce((acc, country) => {
    // A vehicle belongs to this country if its physical location matches
    const list = filteredVehicles.filter(v => {
      const { physicalCountry } = getVehiclePhysicalCountryAndAwayState(v);
      return physicalCountry === country;
    });
    if (list.length > 0) acc[country] = list;
    return acc;
  }, {} as Record<string, Vehicle[]>);

  // If there are vehicles that didn't match any of the AVAILABLE_COUNTRIES, 
  // we add them to Macedonia by default to ensure they are never lost
  const groupedIds = new Set(Object.values(groupedVehicles).flat().map(v => v.id));
  const missingVehicles = filteredVehicles.filter(v => !groupedIds.has(v.id));
  if (missingVehicles.length > 0) {
    groupedVehicles["Macedonia"] = [...(groupedVehicles["Macedonia"] || []), ...missingVehicles];
  }

  const selectedVehicleData = vehicles.find((v) => String(v.id) === String(selectedVehicle));

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          key="reservation-form-modal"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            id="reservation-modal-root"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={() => {
              setShowCalendar(false);
              setShowVehicleDropdown(false);
              setShowCustomerDropdown(false);
            }}
            className={cn(
              "relative rounded-[32px] shadow-2xl border w-full max-h-[95vh] overflow-hidden flex flex-col pointer-events-auto",
              mode === "dates" ? "max-w-md" : "md:max-w-[95%] lg:max-w-[1180px] xl:max-w-[1365px]",
              "md:-translate-x-6 lg:-translate-x-10 xl:-translate-x-14", // Shift left on desktop
              isDarkMode
                ? "bg-[#2C2724] border-white/10"
                : "bg-white border-gray-150",
            )}
          >
            {/* Header */}
            <div
              className="py-3 px-8 flex items-center justify-between text-white rounded-t-[32px] sticky top-0 z-20 shrink-0"
              style={{ background: effectiveColor }}
            >
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-lg font-black tracking-tight">
                    {mode === "dates"
                      ? "ADJUST DATES"
                      : (initialData && initialData.id)
                        ? "EDIT RESERVATION"
                        : "NEW RESERVATION"}
                  </h2>
                  <p className="text-[9px] font-bold text-white/60 tracking-widest uppercase">
                    {mode === "dates"
                      ? "CALENDAR ADJUSTMENT"
                      : (initialData && initialData.id)
                        ? "UPDATE BOOKING"
                        : "BOOKING DETAILS"}
                  </p>
                </div>

                {mode !== "dates" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDocumentPanelOpen(true);
                      }}
                      className={cn(
                        "w-7 h-7 rounded-md border flex items-center justify-center transition-all hover:scale-110 shadow-md group cursor-pointer",
                        uploadedDocuments && uploadedDocuments.length > 0
                          ? "bg-[#06B6D4] border-[#22D3EE] text-white shadow-[0_0_10px_rgba(6,182,212,0.4)] animate-pulse"
                          : "bg-white/10 border-white/20 text-white hover:border-[#06B6D4]/50 hover:text-[#22D3EE]"
                      )}
                      title="Documents"
                    >
                      <FileText className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleScanDocument();
                      }}
                      disabled={isScanning || !uploadedDocuments || uploadedDocuments.length === 0}
                      className={cn(
                        "w-7 h-7 rounded-md border flex items-center justify-center transition-all hover:scale-110 shadow-md group cursor-pointer disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed",
                        isScanning
                          ? "bg-[#F59E0B] border-[#FBBF24] text-white cursor-wait animate-pulse"
                          : uploadedDocuments && uploadedDocuments.length > 0
                            ? "bg-[#10B981] border-[#34D399] text-white hover:bg-[#059669]"
                            : "bg-white/5 border-white/10 text-white/40"
                      )}
                      title={uploadedDocuments && uploadedDocuments.length > 0 ? "Scan last uploaded document with AI" : "Upload a document to scan with AI"}
                    >
                      {isScanning ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <Scan className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:rotate-90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 md:p-6 flex flex-col gap-4 md:gap-5 overflow-y-auto custom-scrollbar">
              <div
                className={cn(
                  "grid gap-4 md:gap-6",
                  mode === "dates"
                    ? "grid-cols-1"
                    : "grid-cols-1 md:grid-cols-2",
                )}
              >
                <div className="space-y-4">
                  {mode !== "dates" &&
                    <div className="space-y-3">
                      <div className="pb-1 border-b border-gray-100 dark:border-white/5 mb-1">
                        <p className="text-[10px] font-black text-[#FF5C35] tracking-[0.2em] uppercase">
                          CLIENT INFORMATION
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                            Full Name
                          </label>
                          <div className="relative group/name">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                            <input
                              required
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value.toUpperCase())}
                              placeholder=""
                              className={cn(
                                "w-full pl-11 pr-12 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                                isDarkMode
                                  ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]"
                                  : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]",
                              )}
                            />
                            <button
                              type="button"
                              title="Search old customers"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setCustomerDropdownCoords(rect);
                                const modalRoot = document.getElementById("reservation-modal-root");
                                if (modalRoot) setModalCoords(modalRoot.getBoundingClientRect());
                                setShowCustomerDropdown(!showCustomerDropdown);
                                setShowVehicleDropdown(false);
                                setShowCalendar(false);
                              }}
                              className={cn(
                                "absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95",
                                isDarkMode ? "bg-white/5 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-[#FF5C35]",
                                showCustomerDropdown && (isDarkMode ? "text-white bg-white/10" : "text-[#FF5C35] bg-gray-200")
                              )}
                            >
                              <Search className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                            Email Address
                          </label>
                          <div className="relative">
                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                            <input
                              required
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder=""
                              className={cn(
                                "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                                isDarkMode
                                  ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]"
                                  : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]",
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  }

                  <div className="space-y-3">
                    {mode === "dates" && (
                      <div className="pb-1 border-b border-gray-100 dark:border-white/5 mb-1">
                        <p className="text-[10px] font-black text-[#FF5C35] tracking-[0.2em] uppercase">
                          CAR SELECTION
                        </p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className={cn(
                        "text-[10px] font-black tracking-widest uppercase ml-1 transition-colors",
                        vehicleError ? "text-red-500 font-extrabold" : "text-gray-400"
                      )}>
                        Vehicle {vehicleError && <span className="text-red-500 font-extrabold">* Please pick a car</span>}
                      </label>
                      <div className="relative">
                        <Car className={cn(
                          "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors z-10",
                          vehicleError ? "text-red-500" : "text-[#FF5C35]"
                        )} />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!range.from || !range.to) return;
                            
                            const rect = e.currentTarget.getBoundingClientRect();
                            setVehicleDropdownCoords(rect);
                            const modalRoot = document.getElementById("reservation-modal-root");
                            if (modalRoot) setModalCoords(modalRoot.getBoundingClientRect());
                            setShowVehicleDropdown(!showVehicleDropdown);
                            setShowCalendar(false);
                          }}
                          className={cn(
                            "w-full pl-11 pr-10 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm text-left flex items-center justify-between relative",
                            vehicleError
                              ? "border-red-500 bg-red-500/5 text-red-600 focus:border-red-500"
                              : isDarkMode
                                ? "bg-[#1A1614] border-white/5 text-white"
                                : "bg-gray-50 border-gray-100 text-[#0E0C0B]",
                            showVehicleDropdown && "border-[#FF5C35]"
                          )}
                          style={{
                            borderColor: !vehicleError && selectedVehicleData && selectedVehicleData.country ? COUNTRY_COLORS[selectedVehicleData.country] : undefined
                          }}
                        >
                          <span className={cn(
                            "flex items-center gap-2",
                            !selectedVehicleData && "text-gray-400",
                            (!range.from || !range.to) && "text-red-500"
                          )}>
                            {!range.from || !range.to 
                              ? "Please choose dates first"
                              : selectedVehicleData 
                                ? (
                                  <>
                                    <span className="font-extrabold">{selectedVehicleData.name}</span>
                                    <div className="flex items-center gap-1">
                                      <div className={cn(
                                        "w-5 h-5 rounded-full flex items-center justify-center shadow-sm text-[10px] font-black shrink-0 select-none",
                                        isDarkMode
                                          ? "bg-white/5 border-white/10 text-white"
                                          : "bg-black/5 border-black/10 text-black"
                                      )}>
                                        {selectedVehicleData.transmission === "Manual" ? "M" : "A"}
                                      </div>
                                      <div className="inline-flex items-center rounded border border-black/25 bg-white px-1.5 py-0.5 shadow-sm text-black shrink-0 relative z-10 scale-95 overflow-hidden">
                                        <div className="w-[2px] h-3 bg-blue-700 rounded-l-[0.5px] -ml-1.5 mr-1 shrink-0" />
                                        <span className={cn(
                                          "text-[10px] font-mono font-black tracking-wider uppercase leading-none select-all",
                                          selectedVehicleData.color ? "pr-[10px]" : ""
                                        )}>
                                          {selectedVehicleData.plate}
                                        </span>
                                        {selectedVehicleData.color && (
                                          <div 
                                            className="absolute right-0 top-0 bottom-0 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[3px]"
                                            style={{ 
                                              width: '8px',
                                              backgroundColor: selectedVehicleData.color
                                            }}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )
                                : "Select a vehicle"}
                          </span>
                          <div className={cn(
                            "transition-transform",
                            showVehicleDropdown ? "rotate-180" : "rotate-0"
                          )}>
                            <X className="w-3 h-3 text-gray-400 rotate-45" />
                          </div>
                        </button>

                        {showVehicleDropdown && vehicleDropdownCoords && typeof document !== 'undefined' && createPortal(
                          <div className="fixed inset-0 z-[10000] pointer-events-none">
                            <div 
                              className="absolute inset-0 pointer-events-auto" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowVehicleDropdown(false);
                              }} 
                            />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, x: 20 }}
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.95, x: 20 }}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: modalCoords ? modalCoords.top : (vehicleDropdownCoords ? vehicleDropdownCoords.bottom + 8 : 100),
                                left: modalCoords ? Math.min(typeof window !== 'undefined' ? window.innerWidth - 335 : 9999, modalCoords.right + 12) : 100,
                                width: 320,
                                height: modalCoords ? modalCoords.height : 'auto',
                              }}
                              className={cn(
                                "rounded-[32px] border border-white/10 shadow-2xl z-[150] overflow-hidden flex flex-col pointer-events-auto",
                                isDarkMode ? "bg-[#1A1614]" : "bg-white"
                              )}
                            >
                              <div className="p-4 border-b border-gray-100 dark:border-white/5 shrink-0 space-y-4">
                                <div className="flex flex-col gap-2">
                                  <p className="text-[10px] font-black text-[#FF5C35] tracking-[0.2em] uppercase ml-1">FILTER BY COUNTRY</p>
                                  <div className="flex gap-1.5 overflow-x-auto custom-scrollbar-mini pb-1">
                                    <button
                                      type="button"
                                      onClick={() => setActiveVehicleTab("All")}
                                      className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap border-2",
                                        activeVehicleTab === "All"
                                          ? "bg-[#FF5C35] border-[#FF5C35] text-white"
                                          : isDarkMode 
                                            ? "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                                            : "bg-gray-100 border-gray-100 text-gray-500 hover:text-black"
                                      )}
                                    >
                                      All
                                    </button>
                                    {VEHICLE_COUNTRIES.map(country => (
                                      <button
                                        key={country}
                                        type="button"
                                        onClick={() => setActiveVehicleTab(country)}
                                        className={cn(
                                          "px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap border-2",
                                          activeVehicleTab === country
                                            ? "text-white"
                                            : isDarkMode 
                                              ? "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                                              : "bg-gray-100 border-gray-100 text-gray-500 hover:text-black"
                                        )}
                                        style={{
                                          backgroundColor: activeVehicleTab === country ? COUNTRY_COLORS[country] : undefined,
                                          borderColor: activeVehicleTab === country ? COUNTRY_COLORS[country] : undefined
                                        }}
                                      >
                                        {country}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search by name or plate..."
                                    value={localVehicleSearch}
                                    onChange={(e) => setLocalVehicleSearch(e.target.value)}
                                    className={cn(
                                      "w-full pl-9 pr-4 py-2.5 rounded-xl text-xs font-bold outline-none border-2 transition-all",
                                      isDarkMode
                                        ? "bg-[#2C2724] border-white/5 text-white focus:border-[#FF5C35]"
                                        : "bg-gray-100 border-gray-200 text-black focus:border-[#FF5C35]"
                                    )}
                                  />
                                </div>
                              </div>
                              <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                                {Object.keys(groupedVehicles).length === 0 ? (
                                  <div className="p-8 text-center text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                                    No vehicles found
                                  </div>
                                ) : (
                                  <>
                                    {VEHICLE_COUNTRIES.map((country) => {
                                      const list = groupedVehicles[country];
                                      if (!list) return null;
                                      return (
                                        <div key={country} className="mb-4 last:mb-2">
                                          <div 
                                            className="flex items-center gap-2 px-3 mb-2"
                                          >
                                            <div 
                                              className="w-1.5 h-1.5 rounded-full"
                                              style={{ backgroundColor: COUNTRY_COLORS[country] }}
                                            />
                                            <span className="text-[9px] font-black tracking-widest uppercase text-gray-400">
                                              {country}
                                            </span>
                                          </div>
                                          <div className="space-y-1">
                                            {list.map((v) => {
                                              const reserved = isVehicleReserved(v.id);
                                              const homeCountry = v.country || "Macedonia";
                                              const { physicalCountry, isAwayAndNotReturned } = getVehiclePhysicalCountryAndAwayState(v);
                                              return (
                                                <button
                                                  key={v.id}
                                                  type="button"
                                                  onClick={() => {
                                                    if (reserved) return;
                                                    setSelectedVehicle(v.id);
                                                    setVehicleError(false);
                                                    setShowVehicleDropdown(false);
                                                    setVehicleSearch("");
                                                  }}
                                                  className={cn(
                                                    "w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between group",
                                                    String(selectedVehicle) === String(v.id)
                                                      ? "text-white"
                                                      : reserved
                                                        ? "bg-red-600 text-white cursor-not-allowed"
                                                        : isDarkMode 
                                                          ? "text-white/70 hover:text-white"
                                                          : "text-[#0E0C0B]/70 hover:text-[#0E0C0B]"
                                                  )}
                                                  style={{
                                                    backgroundColor: String(selectedVehicle) === String(v.id) 
                                                      ? COUNTRY_COLORS[country] 
                                                      : undefined
                                                  }}
                                                  onMouseEnter={(e) => {
                                                    if (String(selectedVehicle) !== String(v.id) && !reserved) {
                                                      e.currentTarget.style.backgroundColor = isDarkMode 
                                                        ? `${COUNTRY_COLORS[country]}20` 
                                                        : `${COUNTRY_COLORS[country]}10`;
                                                    }
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    if (String(selectedVehicle) !== String(v.id) && !reserved) {
                                                      e.currentTarget.style.backgroundColor = 'transparent';
                                                    }
                                                  }}
                                                >
                                                  <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                      <span>{v.name}</span>
                                                      {isAwayAndNotReturned && (
                                                        <span 
                                                          className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider scale-[0.9] origin-left border whitespace-nowrap shrink-0"
                                                          style={{ 
                                                            backgroundColor: `${COUNTRY_COLORS[homeCountry]}20`, 
                                                            color: COUNTRY_COLORS[homeCountry],
                                                            borderColor: `${COUNTRY_COLORS[homeCountry]}40`
                                                          }}
                                                          title={`This car belongs to ${homeCountry} but is physically in ${physicalCountry}`}
                                                        >
                                                          From {homeCountry}
                                                        </span>
                                                      )}
                                                    </div>
                                                    {reserved && (
                                                      <span className="text-[8px] font-black uppercase tracking-tighter text-white/90">Already Reserved</span>
                                                    )}
                                                  </div>
                                                   <div className="flex items-center gap-1.5 shrink-0">
                                                     <div className={cn(
                                                       "w-5 h-5 rounded-full flex items-center justify-center shadow-sm text-[10px] font-black shrink-0 select-none transition-colors",
                                                       String(selectedVehicle) === String(v.id) || reserved
                                                         ? "bg-white/90 text-black border-transparent"
                                                         : isDarkMode
                                                           ? "bg-white/5 border-white/10 text-white"
                                                           : "bg-black/5 border-black/10 text-black"
                                                     )}>
                                                       <span className={cn(
                                                          "w-full h-full rounded-full flex items-center justify-center",
                                                          v.transmission === "Manual"
                                                            ? "bg-yellow-400 text-black"
                                                            : "bg-emerald-500 text-white"
                                                        )}>{v.transmission === "Manual" ? "M" : "A"}</span>
                                                     </div>
                                                     <div className="inline-flex items-center rounded border border-black/15 px-1.5 py-0.5 shadow-sm scale-95 origin-left text-black bg-white shrink-0 relative z-10 overflow-hidden">
                                                       <div className="w-[2px] h-3 bg-blue-700 rounded-l-[0.5px] -ml-1.5 mr-1 shrink-0" />
                                                       <span className={cn(
                                                         "text-[10px] font-mono font-black tracking-wider uppercase leading-none select-all",
                                                         v.color ? "pr-[10px]" : ""
                                                       )}>
                                                         {v.plate}
                                                       </span>
                                                       {v.color && (
                                                         <div 
                                                           className="absolute right-0 top-0 bottom-0 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[3px]"
                                                           style={{ 
                                                             width: '8px',
                                                             backgroundColor: v.color
                                                           }}
                                                         />
                                                       )}
                                                     </div>
                                                   </div>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </>
                                )}
                              </div>
                            </motion.div>
                          </div>,
                          document.body
                        )}

                        {showCustomerDropdown && customerDropdownCoords && typeof document !== 'undefined' && createPortal(
                          <div className="fixed inset-0 z-[10000] pointer-events-none">
                            <div 
                              className="absolute inset-0 pointer-events-auto" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowCustomerDropdown(false);
                              }} 
                            />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, x: 20 }}
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.95, x: 20 }}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: modalCoords ? modalCoords.top : (customerDropdownCoords ? customerDropdownCoords.bottom + 8 : 100),
                                left: modalCoords ? Math.min(typeof window !== 'undefined' ? window.innerWidth - 335 : 9999, modalCoords.right + 12) : 100,
                                width: 320,
                                height: modalCoords ? modalCoords.height : 'auto',
                              }}
                              className={cn(
                                "rounded-[32px] border border-white/10 shadow-2xl z-[150] overflow-hidden flex flex-col pointer-events-auto",
                                isDarkMode ? "bg-[#1A1614]" : "bg-white"
                              )}
                            >
                              <div className="p-4 border-b border-gray-100 dark:border-white/5 shrink-0 space-y-4">
                                <p className="text-[10px] font-black text-[#FF5C35] tracking-[0.2em] uppercase ml-1">SEARCH OLD CUSTOMERS</p>
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder="Type name, phone or email..."
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    className={cn(
                                      "w-full pl-9 pr-4 py-2.5 rounded-xl text-xs font-bold outline-none border-2 transition-all",
                                      isDarkMode
                                        ? "bg-[#2C2724] border-white/5 text-white focus:border-[#FF5C35]"
                                        : "bg-gray-100 border-gray-200 text-black focus:border-[#FF5C35]"
                                    )}
                                  />
                                </div>
                              </div>
                              <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                                {paginatedCustomers.length === 0 ? (
                                  <div className="p-8 text-center text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                                    No customers found
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {paginatedCustomers.map((c, idx) => (
                                      <button
                                        key={`${c.passportId}-${idx}`}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          setName((c.name || "").toUpperCase());
                                          setEmail(c.email);
                                          setPhone(c.phone);
                                          setPassportId(c.passportId);
                                          setDriverLicenseId(c.driverLicenseId);
                                          setShowCustomerDropdown(false);
                                          setCustomerSearch("");
                                        }}
                                        className={cn(
                                          "w-full px-3 py-3 rounded-2xl text-left transition-all flex flex-col gap-0.5 group",
                                          isDarkMode ? "hover:bg-white/5" : "hover:bg-[#fdf0e1]"
                                        )}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className={cn(
                                            "text-xs font-black",
                                            isDarkMode ? "text-white" : "text-[#0E0C0B]"
                                          )}>{c.name}</span>
                                          <User className="w-3 h-3 text-[#FF5C35] opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                          {c.phone && (
                                            <span className="text-[10px] font-bold text-gray-400">{c.phone}</span>
                                          )}
                                          <div className="flex items-center gap-2">
                                            {c.passportId && (
                                              <span className="text-[9px] font-black text-[#FF5C35]/70 tracking-tight uppercase">ID: {c.passportId}</span>
                                            )}
                                            {c.passportId && c.driverLicenseId && (
                                              <div className="w-1 h-1 rounded-full bg-gray-300" />
                                            )}
                                            {c.driverLicenseId && (
                                              <span 
                                                className="text-[9px] font-black text-[#FF5C35]/70 tracking-tight uppercase"
                                                style={{ fontFamily: 'Verdana, sans-serif' }}
                                              >
                                                LIC: {c.driverLicenseId}
                                              </span>
                                            )}
                                          </div>
                                          {c.email && (
                                            <span className="text-[9px] font-bold text-gray-400 truncate max-w-[200px] mt-0.5 italic">{c.email}</span>
                                          )}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              {/* Pagination Controls */}
                              {totalCustomerPages > 1 && (
                                <div className="p-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between shrink-0">
                                  <button
                                    type="button"
                                    disabled={customerPage === 1}
                                    onClick={() => setCustomerPage(p => Math.max(1, p - 1))}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                      customerPage === 1 
                                        ? "opacity-30 cursor-not-allowed" 
                                        : isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-black hover:bg-gray-200"
                                    )}
                                  >
                                    Prev
                                  </button>
                                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    Page {customerPage} / {totalCustomerPages}
                                  </div>
                                  <button
                                    type="button"
                                    disabled={customerPage === totalCustomerPages}
                                    onClick={() => setCustomerPage(p => Math.min(totalCustomerPages, p + 1))}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                      customerPage === totalCustomerPages 
                                        ? "opacity-30 cursor-not-allowed" 
                                        : isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-black hover:bg-gray-200"
                                    )}
                                  >
                                    Next
                                  </button>
                                </div>
                              )}
                            </motion.div>
                          </div>,
                          document.body
                        )}

                        {/* Insurance Popup Portal removed from here */}
                      </div>
                    </div>
                  </div>

                  {mode !== "dates" &&
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                              Phone Number
                            </label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                              <input
                                required
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder=""
                                className={cn(
                                  "w-full pl-11 pr-4 py-2 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                                  isDarkMode
                                    ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]"
                                    : "bg-[#ffffff] border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]",
                                )}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                              Note / Special Request
                            </label>
                            <div className="relative">
                              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                              <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add any special requests..."
                                className={cn(
                                  "w-full pl-11 pr-4 py-2 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                                  isDarkMode
                                    ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]"
                                    : "bg-[#ffffff] border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]",
                                )}
                              />
                            </div>
                          </div>
                        </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                          Arrival Time
                        </label>
                        <div className="relative">
                          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                          <input
                            type="time"
                            value={arrivalTime}
                            onChange={(e) => setArrivalTime(e.target.value)}
                            className={cn(
                              "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                              isDarkMode
                                ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]"
                                : "bg-[#ffffff] border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]",
                            )}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                          Departure Time
                        </label>
                        <div className="relative">
                          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                          <input
                            type="time"
                            value={departureTime}
                            onChange={(e) => setDepartureTime(e.target.value)}
                            className={cn(
                              "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                              isDarkMode
                                ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]"
                                : "bg-[#ffffff] border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]",
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Processed By (Teammate) */}
                    <div className="space-y-1">
                      <label className={cn(
                        "text-[10px] font-black tracking-widest uppercase ml-1 transition-colors",
                        processedByError ? "text-red-500 font-extrabold" : "text-gray-400"
                      )}>
                        Processed By (Teammate) <span className="text-red-500 font-extrabold">* Required</span>
                      </label>
                      <div className="relative">
                        <User className={cn(
                          "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
                          processedByError ? "text-red-500" : "text-[#FF5C35]"
                        )} />
                        <input
                          type="text"
                          value={processedBy}
                          onChange={(e) => {
                            const val = formatName(e.target.value);
                            setProcessedBy(val);
                            if (val.trim()) {
                              setProcessedByError(false);
                            }
                            if (typeof window !== "undefined") {
                              localStorage.setItem("last_processed_by", val);
                            }
                          }}
                          placeholder="Teammate name..."
                          className={cn(
                            "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm h-12",
                            processedByError
                              ? "border-red-500 bg-red-500/5 text-red-600 placeholder-red-300 focus:border-red-500"
                              : isDarkMode
                                ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]"
                                : "bg-gray-50 border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]",
                          )}
                        />
                      </div>
                    </div>
                  </div>
                }
              </div>

                {/* Right Column - Booking Details */}
                <div className="space-y-3">
                  <div className="pb-1 border-b border-gray-100 dark:border-white/5 mb-1">
                    <p className="text-[10px] font-black text-[#FF5C35] tracking-[0.2em] uppercase">
                      BOOKING DETAILS
                    </p>
                  </div>
                  {mode !== "dates" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                          PASSPORT ID
                        </label>
                        <div className="relative">
                          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                          <input
                            required
                            type="text"
                            value={passportId}
                            onChange={(e) => setPassportId(e.target.value)}
                            placeholder="AXXXXXXX"
                            className={cn(
                              "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                              isDarkMode
                                ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]"
                                : "bg-[#ffffff] border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]",
                            )}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                          LICENSE ID
                        </label>
                        <div className="relative">
                          <Contact className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                          <input
                            type="text"
                            value={driverLicenseId}
                            onChange={(e) => setDriverLicenseId(e.target.value)}
                            placeholder="BXXXXXXX"
                            className={cn(
                              "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                              isDarkMode
                                ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]"
                                : "bg-[#ffffff] border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]",
                            )}
                            style={{ fontFamily: 'Verdana, sans-serif' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                      Reservation Period
                    </label>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setCalendarCoords(rect);
                        const modalRoot = document.getElementById("reservation-modal-root");
                        if (modalRoot) setModalCoords(modalRoot.getBoundingClientRect());
                        setTempRange({ ...range }); // Initialize tempRange when opening
                        setShowCalendar(!showCalendar);
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm flex items-center justify-between cursor-pointer",
                        isDarkMode
                          ? "bg-[#1A1614] border-white/5 text-white hover:border-[#FF5C35]"
                          : "bg-[#fefefe] border-gray-100 text-[#0E0C0B] hover:border-[#FF5C35]",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="w-4 h-4 text-[#FF5C35]" />
                        <span>
                          {range.from && !isNaN(range.from.getTime())
                            ? format(range.from, "dd MMM")
                            : "Start"}{" "}
                          -{" "}
                          {range.to && !isNaN(range.to.getTime())
                            ? format(range.to, "dd MMM")
                            : "End"}
                        </span>
                      </div>
                    </button>

                    {showCalendar && calendarCoords && typeof document !== 'undefined' && createPortal(
                      <div className="fixed inset-0 z-[10000] pointer-events-none">
                        <div 
                          className="absolute inset-0 pointer-events-auto" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCalendar(false);
                          }} 
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, x: -10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95, x: -10 }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: modalCoords 
                              ? Math.max(10, modalCoords.top + (modalCoords.height / 2) - 250) // Align to center of modal (approx 500px calendar height)
                              : Math.max(10, calendarCoords.top - 120),
                            left: modalCoords 
                              ? Math.min(typeof window !== 'undefined' ? window.innerWidth - 340 : 9999, modalCoords.right + (typeof window !== 'undefined' && window.innerWidth < 1024 ? 16 : 4)) 
                              : (typeof window !== 'undefined' ? Math.min(window.innerWidth - 340, calendarCoords.right + 16) : calendarCoords.right + 16),
                          }}
                          className={cn(
                            "w-[330px] z-10 py-6 px-1 rounded-[40px] border shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col items-center pointer-events-auto",
                            isDarkMode
                              ? "bg-[#2C2724] border-white/10"
                              : "bg-white border-gray-100",
                          )}
                        >
                          <div
                            className={cn(
                              "space-y-1 flex flex-col items-center",
                              isDarkMode &&
                                "[&_.rdp-caption_label]:!text-white [&_.rdp-chevron]:!fill-white",
                            )}
                          >
                            <p className="text-[10px] font-black text-[#FF5C35] tracking-widest uppercase text-center mb-4 px-1">
                              Reservation Period
                            </p>
                            <DayPicker
                              mode="range"
                              selected={tempRange}
                              disabled={{ before: startOfDay(new Date()) }}
                              className={cn(
                                isDarkMode ? "rdp-dark" : "",
                                "m-0"
                              )}
                              onSelect={(r) => {
                                if (r) {
                                  setTempRange({ from: r.from, to: r.to });
                                } else {
                                  setTempRange({ from: undefined, to: undefined });
                                }
                              }}
                              styles={{
                                caption: {
                                  color: isDarkMode ? "white" : "black",
                                  fontWeight: "bold",
                                  fontSize: "14px",
                                },
                                caption_label: {
                                  color: isDarkMode ? "white" : "black",
                                },
                                head_cell: {
                                  color: "#94a3b8",
                                  fontSize: "10px",
                                  fontWeight: "bold",
                                },
                                day: {
                                  color: isDarkMode ? "white" : "#0E0C0B",
                                  fontWeight: "bold",
                                  fontSize: "12px",
                                  width: "36px",
                                  height: "36px",
                                },
                                day_selected: {
                                  backgroundColor: "#FF5C35",
                                  color: "white",
                                },
                                day_today: {
                                  color: "#FF5C35",
                                  fontWeight: "900",
                                },
                                day_disabled: {
                                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                                  color: "rgba(239, 68, 68, 0.5)",
                                  textDecoration: "line-through",
                                  cursor: "not-allowed",
                                  borderRadius: "4px",
                                },
                                disabled: {
                                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                                  color: "rgba(239, 68, 68, 0.5)",
                                  textDecoration: "line-through",
                                  cursor: "not-allowed",
                                  borderRadius: "4px",
                                },
                              }}
                            />
                            <div className="mt-6 w-full px-5">
                               <button
                                 type="button"
                                 onClick={() => {
                                   setRange(tempRange);
                                   setShowCalendar(false);
                                 }}
                                 className={cn(
                                   "w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95",
                                   isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-gray-100 text-black hover:bg-gray-200"
                                 )}
                               >
                                 Apply Period
                               </button>
                            </div>
                          </div>
                        </motion.div>
                      </div>,
                      document.body
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                        Days
                      </label>
                      <div
                        className={cn(
                          "w-full px-4 py-2.5 rounded-2xl border-2 font-black text-lg flex items-center justify-center h-12",
                          isDarkMode
                            ? "bg-[#1A1614] border-white/5 text-white"
                            : "bg-[#ece0e0] border-gray-100 text-[#0E0C0B]",
                        )}
                      >
                        {days}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                        BASE PRICE
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                        <input
                          required
                          type="number"
                          value={basePrice}
                          onChange={(e) => setBasePrice(e.target.value)}
                          className={cn(
                            "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-black text-lg text-[#FF5C35] h-12",
                            isDarkMode
                              ? "bg-[#1A1614] border-white/5 focus:border-[#FF5C35]"
                              : "bg-[#fdf0e1] border-gray-150 focus:border-[#FF5C35]",
                          )}
                        />
                      </div>
                    </div>

                    {/* Total Price Display */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                        Computed Total Price
                      </label>
                      <div 
                        className={cn(
                          "px-4 py-1 rounded-2xl border-2 flex items-center justify-between font-black text-lg shadow-inner w-full h-12",
                          isDarkMode ? "bg-white/5 border-white/5 text-emerald-400" : "bg-emerald-50 border-emerald-100 text-emerald-600"
                        )}
                      >
                        <span className="font-extrabold">€{totalPrice}</span>
                        <div className="flex flex-col items-end leading-none text-right">
                           <span className="text-[8px] opacity-70 uppercase tracking-wider font-extrabold">Final Amount</span>
                           {selectedInsurance && (
                             <span className="text-[7px] font-bold opacity-60 mt-0.5">+€{selectedInsurance.price} Ins.</span>
                           )}
                        </div>
                      </div>
                    </div>

                    {/* Insurance selection element */}
                    {mode !== "dates" && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1 block">
                          Insurance
                        </label>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setInsurancePopupCoords(rect);
                            setShowInsurancePopup(!showInsurancePopup);
                          }}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-2xl border-2 flex items-center justify-between font-black transition-all hover:border-[#FF5C35] h-12 text-xs cursor-pointer",
                            isDarkMode
                              ? "bg-[#1A1614] border-white/5 text-white"
                              : "bg-white border-gray-100 text-[#0E0C0B]",
                          )}
                        >
                          <span className={cn(
                            "text-xs font-bold tracking-wider uppercase transition-colors shrink-0 max-w-[120px] truncate",
                            selectedInsurance ? "text-[#FF5C35]" : "text-gray-400"
                          )}>
                            {selectedInsurance 
                              ? selectedInsurance.type 
                              : "None"}
                          </span>
                          <div
                            className={cn(
                              "w-5 h-5 rounded-[4px] border-2 flex items-center justify-center transition-all shrink-0 ml-2",
                              selectedInsurance 
                                ? "bg-emerald-500 border-emerald-500 text-white" 
                                : (isDarkMode ? "border-white/10" : "border-gray-200")
                            )}
                          >
                            {selectedInsurance && (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {showInsurancePopup && insurancePopupCoords && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[10001] pointer-events-none">
                      <div 
                        className="absolute inset-0 pointer-events-auto" 
                        onClick={() => setShowInsurancePopup(false)} 
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, x: 10 }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: insurancePopupCoords.top,
                          left: modalCoords ? modalCoords.right + 12 : insurancePopupCoords.right + 12,
                          width: 220,
                        }}
                        className={cn(
                          "rounded-[24px] border shadow-[0_20px_60px_rgba(0,0,0,0.3)] pointer-events-auto overflow-hidden",
                          isDarkMode
                            ? "bg-[#2C2724] border-white/10"
                            : "bg-white border-gray-100",
                        )}
                      >
                        <div className="p-3 border-b border-gray-100 dark:border-white/5 shrink-0">
                          <p className="text-[10px] font-black text-[#FF5C35] tracking-[0.2em] uppercase ml-1">INSURANCE LEVEL</p>
                        </div>
                        <div className="p-3 space-y-1.5">
                          {INSURANCE_OPTIONS.map((option) => {
                            const isSelected = selectedInsurance?.type === option.type;
                            return (
                              <button
                                key={option.type}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedInsurance(null);
                                  } else {
                                    setSelectedInsurance(option);
                                  }
                                  setShowInsurancePopup(false);
                                }}
                                className={cn(
                                  "w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer",
                                  isSelected
                                    ? (isDarkMode ? "bg-white/10 border-[#FF5C35]" : "bg-[#FF5C35]/5 border-[#FF5C35]")
                                    : (isDarkMode ? "bg-white/5 border-transparent" : "bg-[#fdf0e1] border-transparent")
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-0.5">
                                    {Array.from({ length: option.squares }).map((_, i) => (
                                      <div 
                                        key={i} 
                                        className="w-2.5 h-2.5 rounded-[1px]" 
                                        style={{ backgroundColor: option.color }} 
                                      />
                                    ))}
                                  </div>
                                  <span className={cn(
                                    "text-[12px] font-black tracking-tight",
                                    isDarkMode ? "text-white" : "text-[#0E0C0B]"
                                  )}>
                                    € {option.price.toLocaleString('de-DE')}
                                  </span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-[#FF5C35]" />}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    </div>,
                    document.body
                  )}

                  {mode !== "dates" && (
                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                          From Location
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                          <select
                            required
                            value={fromLocation}
                            onChange={(e) => setFromLocation(e.target.value)}
                            className={cn(
                              "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm appearance-none",
                              isDarkMode
                                ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]"
                                : "bg-[#ffffff] border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]",
                            )}
                          >
                            <option value="">FROM</option>
                            {AVAILABLE_COUNTRIES.map((loc) => (
                              <option key={loc} value={loc}>{loc}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase ml-1">
                          Drop-off
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF5C35]" />
                          <select
                            required
                            value={toLocation}
                            onChange={(e) => setToLocation(e.target.value)}
                            className={cn(
                              "w-full pl-11 pr-4 py-2.5 rounded-2xl border-2 transition-all outline-none font-bold text-sm appearance-none",
                              isDarkMode
                                ? "bg-[#1A1614] border-white/5 text-white focus:border-[#FF5C35]"
                                : "bg-[#fdfdfd] border-gray-100 text-[#0E0C0B] focus:border-[#FF5C35]",
                            )}
                          >
                            <option value="">TO</option>
                            {AVAILABLE_COUNTRIES.map((loc) => (
                              <option key={loc} value={loc}>{loc}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-transparent select-none uppercase ml-1 block">
                          Flag
                        </label>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setCountrySelectorCoords(rect);
                            const modalRoot = document.getElementById("reservation-modal-root");
                            if (modalRoot) setModalCoords(modalRoot.getBoundingClientRect());
                            setShowCountrySelector(!showCountrySelector);
                          }}
                          className={cn(
                            "w-[50px] h-[46px] rounded-2xl border-2 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer",
                            selectedCountries.length > 0
                              ? (isDarkMode ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-emerald-50 border-emerald-500/30 text-emerald-600")
                              : (isDarkMode ? "bg-[#1A1614] border-white/5 text-gray-400 hover:border-[#FF5C35]" : "bg-[#fdf0e1] border-gray-100 text-gray-400 hover:border-[#FF5C35]"),
                            showCountrySelector && "border-[#FF5C35]"
                          )}
                        >
                          <Flag className={cn(
                            "w-5 h-5 transition-colors",
                            selectedCountries.length > 0 ? "fill-current" : "text-gray-400"
                          )} />
                        </button>
                      </div>

                      {showCountrySelector && countrySelectorCoords && typeof document !== 'undefined' && createPortal(
                        <div className="fixed inset-0 z-[10000] pointer-events-none">
                          <div 
                            className="absolute inset-0 pointer-events-auto" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowCountrySelector(false);
                            }} 
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              top: modalCoords ? modalCoords.top : Math.max(10, countrySelectorCoords.top - 120),
                              left: modalCoords ? Math.min(typeof window !== 'undefined' ? window.innerWidth - 220 : 9999, modalCoords.right + 16) : (typeof window !== 'undefined' ? Math.min(window.innerWidth - 220, countrySelectorCoords.right + 16) : countrySelectorCoords.right + 16),
                              width: 200,
                            }}
                            className={cn(
                              "rounded-[24px] border shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-4 pointer-events-auto",
                              isDarkMode
                                ? "bg-[#2C2724] border-white/10"
                                : "bg-white border-gray-100",
                            )}
                          >
                            <p className="text-[10px] font-black text-[#FF5C35] tracking-[0.2em] uppercase mb-4 px-1">
                              Pick Countries
                            </p>
                            <div className="space-y-1">
                              {AVAILABLE_COUNTRIES.map((country) => {
                                const isSelected = selectedCountries.includes(country);
                                return (
                                  <button
                                    key={country}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCountries(prev => 
                                        prev.includes(country) 
                                          ? prev.filter(c => c !== country)
                                          : [...prev, country]
                                      );
                                    }}
                                    className={cn(
                                      "w-full px-3 py-2 rounded-xl text-[11px] font-black tracking-widest uppercase flex items-center justify-between transition-all",
                                      isSelected
                                        ? isDarkMode ? "bg-white/10 text-white" : "bg-gray-100 text-black"
                                        : "hover:bg-[#fdf0e1] dark:hover:bg-white/5 text-gray-400"
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: COUNTRY_COLORS[country] }}
                                      />
                                      {country}
                                    </div>
                                    <div className={cn(
                                      "w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all",
                                      isSelected 
                                        ? "bg-[#FF5C35] border-[#FF5C35]" 
                                        : "border-gray-200 dark:border-white/10"
                                    )}>
                                      {isSelected && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        </div>,
                        document.body
                      )}
                    </div>
                  )}


                </div>
              </div>

              {clashError && (
                <div className="p-4 mt-2 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-300 text-xs font-semibold leading-normal flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <p>{clashError}</p>
                </div>
              )}

              {vehicleError && (
                <div className="p-4 mt-2 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-300 text-xs font-semibold leading-normal flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <p>Please choose / pick a car to complete the reservation.</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !!clashError}
                className="w-full mt-2 py-4 rounded-full font-black text-sm tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 text-white border-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: effectiveColor,
                  borderColor: "rgba(0,0,0,0.1)",
                }}
              >
                {isSubmitting
                  ? "PROCESSING..."
                  : initialData
                    ? mode === "dates"
                      ? "SAVE ADJUSTMENTS"
                      : "UPDATE RESERVATION"
                    : "CONFIRM RESERVATION"}
              </button>
            </form>

            {/* Success Overlay with gorgeous Green Tick Animation */}
            <AnimatePresence>
              {showSuccessCheck && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md",
                    isDarkMode ? "bg-[#1A1614]/90" : "bg-white/90"
                  )}
                >
                  <div className="flex flex-col items-center text-center p-8 max-w-sm">
                    {/* Tick Animation Container */}
                    <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
                      {/* Outer radiating rings */}
                      <motion.div
                        className="absolute inset-0 rounded-full bg-emerald-500/10"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: [0.8, 1.4, 0.8], opacity: [0, 0.3, 0] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                      />
                      
                      <motion.div
                        className="absolute inset-2 rounded-full bg-emerald-500/20"
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1.1, opacity: 1 }}
                        transition={{ type: "spring", damping: 15, delay: 0.1 }}
                      />

                      {/* Main green circle that springs up */}
                      <motion.div
                        className="absolute inset-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_12px_36px_rgba(16,185,129,0.4)]"
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      >
                        {/* Animated SVG Path checkmark */}
                        <svg
                          className="w-12 h-12 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={4.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <motion.path
                            d="M5 13l4 4L19 7"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
                          />
                        </svg>
                      </motion.div>

                      {/* Sparkles radiating from the center */}
                      {[...Array(8)].map((_, i) => {
                        const angle = (i * 45 * Math.PI) / 180;
                        const x = Math.cos(angle) * 54;
                        const y = Math.sin(angle) * 54;
                        return (
                          <motion.div
                            key={i}
                            className="absolute w-2 h-2 rounded-full bg-emerald-400"
                            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                            animate={{ x, y, scale: [0, 1.3, 0], opacity: [1, 1, 0] }}
                            transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
                          />
                        );
                      })}
                    </div>

                    {/* Success message texts */}
                    <motion.h3
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.4 }}
                      className={cn(
                        "text-2xl font-black tracking-tight mb-2 uppercase",
                        isDarkMode ? "text-white" : "text-[#0E0C0B]"
                      )}
                    >
                      RESERVATION SAVED
                    </motion.h3>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.65, duration: 0.4 }}
                      className={cn(
                        "text-xs font-bold tracking-wider uppercase mb-1",
                        isDarkMode ? "text-emerald-400" : "text-emerald-600"
                      )}
                    >
                      ✨ Your job is done! ✨
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      transition={{ delay: 0.8 }}
                      className="text-[10px] uppercase tracking-widest text-gray-500 font-extrabold mt-3 animate-pulse"
                    >
                      Closing panel...
                    </motion.p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {showConfirm && (
        <div
          key="reservation-confirm-modal"
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
            onClick={() => setShowConfirm(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "relative w-full max-w-md rounded-[32px] p-6 shadow-2xl border flex flex-col gap-6",
              isDarkMode
                ? "bg-[#1A1614] border-white/10"
                : "bg-white border-gray-100",
            )}
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-16 h-16 rounded-full bg-[#FF5C35]/10 flex items-center justify-center mb-2">
                <Car className="w-8 h-8 text-[#FF5C35]" />
              </div>
              <h3
                className={cn(
                  "text-xl font-black tracking-tight",
                  isDarkMode ? "text-white" : "text-[#0E0C0B]",
                )}
              >
                Confirm Reservation
              </h3>
              <p className="text-sm font-bold text-gray-400">
                Are you sure you want to book this vehicle?
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className={cn(
                  "flex-1 py-3 rounded-2xl font-black text-xs tracking-widest uppercase transition-all hover:scale-105 cursor-pointer",
                  isDarkMode
                    ? "bg-white/5 text-white hover:bg-white/10"
                    : "bg-gray-100 text-[#0E0C0B] hover:bg-gray-200",
                )}
              >
                Cancel
              </button>
              <button
                onClick={confirmReservation}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-2xl font-black text-xs tracking-widest uppercase transition-all hover:scale-105 bg-[#FF5C35] text-white shadow-lg shadow-[#FF5C35]/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "SAVING..." : "Confirm"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <DocumentPanel
        isOpen={isDocumentPanelOpen}
        onClose={() => setIsDocumentPanelOpen(false)}
        reservationId={tempId}
        reservation={
          {
            id: tempId,
            uploadedDocuments: uploadedDocuments,
          } as Reservation
        }
        isDarkMode={isDarkMode}
        isLocalOnly={!initialData || !initialData.id}
        onDocumentsChange={(docs) => {
          setUploadedDocuments(docs);
        }}
      />
    </AnimatePresence>
  );
}
