'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, Timestamp, getDocs, setDoc, doc, deleteDoc, where, deleteField, updateDoc, getDoc } from 'firebase/firestore';
import { Vehicle, Reservation, RentalRegistration, Client, Expense, Violation } from '@/types';
import { differenceInDays } from 'date-fns';
import { VEHICLE_COUNTRIES } from './constants';
import { syncStats } from './stats';
import { parseDateSafe } from '@/lib/utils';

// Helper function to format any date to same minute-key (YYYY-MM-DD HH:mm) for deduplication
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

interface AppStateContextType {
  user: FirebaseUser | null;
  isAdmin: boolean;
  adminData: any | null;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  toggleDarkMode: () => void;
  sidebarColor: string;
  setSidebarColor: (val: string) => void;
  vehicles: Vehicle[];
  userReservations: Reservation[];
  clients: Client[];
  expenses: Expense[];
  registrations: RentalRegistration[];
  violations: Violation[];
  isViolationsLoaded: boolean;
  criticalRegistrationsCount: number;
  unresolvedViolationsCount: number;
  activeTab: string;
  setActiveTab: (val: string) => void;
  reservationFilter: 'TODAY' | 'TODAY_ON_RENT' | 'LAST_DAY' | null;
  setReservationFilter: (val: 'TODAY' | 'TODAY_ON_RENT' | 'LAST_DAY' | null) => void;
  isLoading: boolean;
  isDataLoading: boolean;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminData, setAdminData] = useState<any | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const statsSyncedRef = React.useRef(false);

  // Tab visibility checking
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sidebarColor, setSidebarColor] = useState('linear-gradient(180deg, #2e1065 0%, #c026d3 50%, #ea580c 100%)');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeReservations, setActiveReservations] = useState<Reservation[]>([]);
  const [finishedReservations, setFinishedReservations] = useState<Reservation[]>([]);

  const userReservations = useMemo(() => {
    const combined = [...activeReservations, ...finishedReservations];
    return combined.sort((a, b) => {
      const timeA = a.start instanceof Date ? a.start.getTime() : 0;
      const timeB = b.start instanceof Date ? b.start.getTime() : 0;
      return timeB - timeA;
    });
  }, [activeReservations, finishedReservations]);
  const [clients, setClients] = useState<Client[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [registrations, setRegistrations] = useState<RentalRegistration[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [isViolationsLoaded, setIsViolationsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reservationFilter, setReservationFilter] = useState<'TODAY' | 'TODAY_ON_RENT' | 'LAST_DAY' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Persistence
  useEffect(() => {
    const savedColor = localStorage.getItem('momo_sidebar_color');
    const savedDarkMode = localStorage.getItem('momo_is_dark_mode');
    const savedTab = localStorage.getItem('momo_active_tab');
    if (savedColor) setSidebarColor(savedColor);
    if (savedDarkMode !== null) setIsDarkMode(savedDarkMode === 'true');
    if (savedTab) setActiveTab(savedTab);
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('momo_sidebar_color', sidebarColor);
    localStorage.setItem('momo_is_dark_mode', isDarkMode.toString());
    localStorage.setItem('momo_active_tab', activeTab);
  }, [sidebarColor, isDarkMode, activeTab, isInitialized]);

  // Auth
  useEffect(() => {
    let unsubscribeAdmin: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // Force immediate loading state to prevent 'blank page' transition before database lookup resolves
      setIsLoading(true);
      
      if (unsubscribeAdmin) {
        unsubscribeAdmin();
        unsubscribeAdmin = null;
      }

      if (currentUser) {
        const initUserSession = async () => {
          try {
            // Retrieve current token without forcing a live network refresh unless active token is expired
            await currentUser.getIdToken();
          } catch (tokenErr) {
            console.warn("Auth token retrieval warning, proceeding with existing session:", tokenErr);
          }

          setUser(currentUser);
          setIsDataLoading(true);

          const bootstrapAdmin = async () => {
            if (currentUser.email === 'sahindzemsit@gmail.com') {
              try {
                await setDoc(doc(db, 'admins', currentUser.uid), {
                  email: currentUser.email,
                  role: 'ADMIN',
                  name: deleteField(),
                  updatedAt: deleteField()
                }, { merge: true });
              } catch (bootstrapErr) {
                console.warn("Failed to bootstrap admin: ", bootstrapErr);
              }
            }
          };
          bootstrapAdmin();

          // Subscribe directly to user's UID document inside /admins collection matching prompt requirements
          const uidRef = doc(db, 'admins', currentUser.uid);
          unsubscribeAdmin = onSnapshot(uidRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              setAdminData(data);
              if (data && (data.role === 'ADMIN' || data.role === 'admin' || data.password)) {
                setIsAdmin(true);
              } else if (currentUser.email === 'sahindzemsit@gmail.com') {
                setIsAdmin(true);
              } else {
                setIsAdmin(false);
              }
            } else {
              if (currentUser.email === 'sahindzemsit@gmail.com') {
                setIsAdmin(true);
                setAdminData({ role: 'ADMIN', email: currentUser.email });
              } else {
                setAdminData(null);
                setIsAdmin(false);
              }
            }
            setIsLoading(false);
          }, (error) => {
            console.error("Admin check failed:", error);
            if (currentUser.email === 'sahindzemsit@gmail.com') {
              setIsAdmin(true);
              setAdminData({ role: 'ADMIN', email: currentUser.email });
            } else {
              setAdminData(null);
              setIsAdmin(false);
            }
            setIsLoading(false);
          });
        };

        initUserSession();
      } else {
        setUser(null);
        setAdminData(null);
        setIsAdmin(false);
        setIsDataLoading(false);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeAdmin) {
        (unsubscribeAdmin as () => void)();
      }
    };
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user || !isAdmin) {
      setVehicles([]);
      setActiveReservations([]);
      setFinishedReservations([]);
      setRegistrations([]);
      setClients([]);
      setIsDataLoading(false);
      return;
    }

    if (!isTabVisible) {
      // Unsubscribe and wait, keeping historical data in local state to prevent visual flickering
      return;
    }

    // Auto sync stats to stay perfectly aligned with any manual modifications (e.g. manual deletions in firebase)
    if (!statsSyncedRef.current) {
      syncStats();
      statsSyncedRef.current = true;
    }

    // Track completeness of initial loads to prevent layout shifting
    const loadedRefs = {
      registrations: false,
      reservations: false,
      vehicles: false,
      clients: false,
      expenses: false,
      violations: false,
    };

    const checkIfAllLoaded = () => {
      if (
        loadedRefs.registrations &&
        loadedRefs.reservations &&
        loadedRefs.vehicles &&
        loadedRefs.clients &&
        loadedRefs.expenses &&
        loadedRefs.violations
      ) {
        setIsDataLoading(false);
      }
    };

    const sanitizeReservationData = (data: any, id: string): Reservation => {
      // Strip heavy embedded base64 data strings from in-memory arrays to prevent memory bloat
      const uploadedDocs = Array.isArray(data.uploadedDocuments)
        ? data.uploadedDocuments.map((docItem: any) => ({
            name: docItem?.name || 'Document',
            uploadedAt: docItem?.uploadedAt || 0,
            type: docItem?.type || 'image/jpeg',
            url: (typeof docItem?.url === 'string' && (docItem.url.startsWith('data:') || docItem.url.length > 2000))
              ? 'blob_lazy'
              : (docItem?.url || '')
          }))
        : [];

      return {
        ...data,
        id,
        uploadedDocuments: uploadedDocs,
        cashflowNotificationSent: data.cashflowNotificationSent === true || String(data.cashflowNotificationSent) === 'true',
        start: parseDateSafe(data.start),
        end: parseDateSafe(data.end),
      } as Reservation;
    };

    // Registrations
    const registrationsQuery = query(collection(db, 'registrations'));
    const unsubscribeRegistrations = onSnapshot(registrationsQuery, (snapshot) => {
      const regs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          expiryDate: data.expiryDate instanceof Timestamp ? data.expiryDate.toDate() : (data.expiryDate ? new Date(data.expiryDate) : undefined),
        };
      });
      setRegistrations(regs);
      loadedRefs.registrations = true;
      checkIfAllLoaded();
    }, (error) => {
      console.error(error);
      loadedRefs.registrations = true;
      checkIfAllLoaded();
    });

    // Active Reservations (Real-time Stream)
    // Querying with status filter but client-side sorting to avoid requiring composite indexes in Firestore
    const activeReservationsQuery = query(
      collection(db, 'reservations'),
      where('status', 'in', ['PENDING', 'UPCOMING', 'ON RENT'])
    );

    // Initial and live active sync
    const unsubscribeReservations = onSnapshot(activeReservationsQuery, (snapshot) => {
      const activeRes = snapshot.docs
        .filter(doc => doc.id !== 'undefined' && doc.id !== 'null')
        .map(doc => {
          const data = doc.data();

          // Old boolean cleanup and migration
          const hasSlack = 'slackNotificationSent' in data;
          
          if (hasSlack) {
            const isSlackSent = data.slackNotificationSent === true || String(data.slackNotificationSent) === 'true';
            const hasCashflow = data.cashflowNotificationSent === true || String(data.cashflowNotificationSent) === 'true';
            
            const updatePayload: any = {
              slackNotificationSent: deleteField()
            };
            if (isSlackSent && !hasCashflow) {
              updatePayload.cashflowNotificationSent = true;
            }
            
            updateDoc(doc.ref, updatePayload).catch(err => {
              console.error(`Failed to migrate slackNotificationSent for doc ${doc.id}:`, err);
            });
          }

          return sanitizeReservationData(data, doc.id);
        });
      setActiveReservations(activeRes);

      // Listen for transition changes of active reservations that have been completed or cancelled
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          // Since the document was removed from the active query snapshot, change.doc.data()
          // contains the older snapshot state where status was still ON RENT or PENDING.
          // We fetch the document's live state to see its updated status.
          getDoc(change.doc.ref).then((liveSnap) => {
            if (liveSnap.exists()) {
              const liveData = liveSnap.data();
              const liveStatus = liveData.status;
              if (liveStatus === 'COMPLETED' || liveStatus === 'CANCELLED') {
                const finishedDoc = sanitizeReservationData(liveData, liveSnap.id);

                setFinishedReservations(prev => {
                  if (prev.some(r => r.id === finishedDoc.id)) {
                    return prev.map(r => r.id === finishedDoc.id ? finishedDoc : r);
                  }
                  return [finishedDoc, ...prev];
                });
              }
            }
          }).catch(err => {
            console.error("Failed to fetch transitioned reservation data:", err);
          });
        }
      });

      loadedRefs.reservations = true;
      checkIfAllLoaded();
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'reservations');
      }
      loadedRefs.reservations = true;
      checkIfAllLoaded();
    });

    // Finished Reservations (Real-time Stream)
    const finishedReservationsQuery = query(
      collection(db, 'reservations'),
      where('status', 'in', ['COMPLETED', 'CANCELLED'])
    );
    const unsubscribeFinishedReservations = onSnapshot(finishedReservationsQuery, (snapshot) => {
      const finishedRes = snapshot.docs
        .filter(doc => doc.id !== 'undefined' && doc.id !== 'null')
        .map(doc => {
          const data = doc.data();

          // Old boolean cleanup and migration
          const hasSlack = 'slackNotificationSent' in data;
          
          if (hasSlack) {
            const isSlackSent = data.slackNotificationSent === true || String(data.slackNotificationSent) === 'true';
            const hasCashflow = data.cashflowNotificationSent === true || String(data.cashflowNotificationSent) === 'true';
            
            const updatePayload: any = {
              slackNotificationSent: deleteField()
            };
            if (isSlackSent && !hasCashflow) {
              updatePayload.cashflowNotificationSent = true;
            }
            
            updateDoc(doc.ref, updatePayload).catch(err => {
              console.error(`Failed to migrate slackNotificationSent for doc ${doc.id}:`, err);
            });
          }

          return sanitizeReservationData(data, doc.id);
        });
      setFinishedReservations(finishedRes);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'reservations');
      }
    });

    // Vehicles
    const vehiclesQuery = query(collection(db, 'vehicles'), orderBy('id', 'asc'));
    const unsubscribeVehicles = onSnapshot(vehiclesQuery, (snapshot) => {
      const vehiclesData = snapshot.docs.map(doc => {
        const data = doc.data();
        const id = isNaN(Number(doc.id)) ? doc.id : Number(doc.id);
        const v = { ...data, id } as Vehicle;
        // Global filter for requested countries
        if (!VEHICLE_COUNTRIES.includes(v.country || 'Macedonia')) return null;
        return v;
      }).filter((v): v is Vehicle => v !== null);

      const sortedData = vehiclesData.sort((a, b) => {
        const orderA = a.displayOrder ?? (typeof a.id === 'number' ? a.id : 0);
        const orderB = b.displayOrder ?? (typeof b.id === 'number' ? b.id : 0);
        if (orderA !== orderB) return orderA - orderB;
        return String(a.id).localeCompare(String(b.id));
      });
      setVehicles(sortedData);
      loadedRefs.vehicles = true;
      checkIfAllLoaded();
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'vehicles');
      }
      loadedRefs.vehicles = true;
      checkIfAllLoaded();
    });

    // Clients
    const clientsQuery = query(collection(db, 'clients'));
    const unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt || 0
        } as Client;
      });

      // Sort client-side stably based on the permanent, static createdAt timestamp and fallback on String ID
      const sortedClients = clientsData.sort((a, b) => {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : 0;
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : 0;
        if (timeA !== timeB && timeA > 0 && timeB > 0) {
          return timeB - timeA;
        }
        return String(b.id).localeCompare(String(a.id));
      });

      setClients(sortedClients);
      loadedRefs.clients = true;
      checkIfAllLoaded();
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'clients');
      }
      loadedRefs.clients = true;
      checkIfAllLoaded();
    });

    // Expenses real-time sync
    const expensesQuery = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        } as Expense;
      });
      setExpenses(expensesData);
      loadedRefs.expenses = true;
      checkIfAllLoaded();
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'expenses');
      }
      loadedRefs.expenses = true;
      checkIfAllLoaded();
    });

    // Violations real-time sync
    const violationsQuery = query(collection(db, 'violations'));
    const unsubscribeViolations = onSnapshot(violationsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        } as Violation;
      });

      // Sort newest violations first
      const sorted = list.sort((a, b) => {
        const timeA = new Date(a.datetime).getTime();
        const timeB = new Date(b.datetime).getTime();
        return timeB - timeA;
      });

      // Filter out duplicate minute records under MVR scans (impossible to have 2 violations in the same minute)
      const seen = new Set<string>();
      const deduplicated: Violation[] = [];
      for (const v of sorted) {
        if (!v.datetime || !v.plate) {
          deduplicated.push(v);
          continue;
        }
        const minKey = getMinuteKey(v.datetime);
        const uniqueKey = `${v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '')}_${minKey}`;
        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          deduplicated.push(v);
        }
      }

      setViolations(deduplicated);
      setIsViolationsLoaded(true);
      loadedRefs.violations = true;
      checkIfAllLoaded();
    }, (error) => {
      console.error("Firestore violations loading error: ", error);
      loadedRefs.violations = true;
      checkIfAllLoaded();
    });

    return () => {
      unsubscribeRegistrations();
      unsubscribeReservations();
      unsubscribeFinishedReservations();
      unsubscribeVehicles();
      unsubscribeClients();
      unsubscribeExpenses();
      unsubscribeViolations();
    };
  }, [user, isAdmin, isTabVisible]);

  const unresolvedViolationsCount = useMemo(() => {
    return violations.filter(v => v.status === 'waiting').length;
  }, [violations]);

  const criticalRegistrationsCount = useMemo(() => {
    const today = new Date();
    return registrations.filter(reg => {
      if (!reg.expiryDate) return false;
      const vehicle = vehicles.find(v => String(v.id) === String(reg.vehicleId));
      if (!vehicle) return false;
      const isExtra = vehicle.isExtra || vehicle.name === 'EXTRA' || String(vehicle.id).startsWith('extra-');
      if (vehicle.isRetired === true || vehicle.status === 'RETIRED' || isExtra) {
        return false;
      }
      const expiryDate = reg.expiryDate instanceof Date ? reg.expiryDate : new Date(reg.expiryDate);
      return differenceInDays(expiryDate, today) <= 3;
    }).length;
  }, [registrations, vehicles]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const value = {
    user,
    isAdmin,
    adminData,
    isDarkMode,
    setIsDarkMode,
    toggleDarkMode,
    sidebarColor,
    setSidebarColor,
    vehicles,
    userReservations,
    clients,
    expenses,
    registrations,
    violations,
    isViolationsLoaded,
    criticalRegistrationsCount,
    unresolvedViolationsCount,
    activeTab,
    setActiveTab,
    reservationFilter,
    setReservationFilter,
    isLoading,
    isDataLoading
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
