'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAppState } from '@/lib/context';

const Dashboard = dynamic(() => import('@/components/Dashboard'), { ssr: false });
const Reservations = dynamic(() => import('@/components/Reservations'), { ssr: false });
const CancelledPanel = dynamic(() => import('@/components/CancelledPanel'), { ssr: false });
const Registrations = dynamic(() => import('@/components/Registrations'), { ssr: false });
const ClientsPanel = dynamic(() => import('@/components/ClientsPanel'), { ssr: false });
const ServicePanel = dynamic(() => import('@/components/ServicePanel'), { ssr: false });
const CashflowPanel = dynamic(() => import('@/components/CashflowPanel'), { ssr: false });
const ExpensesPanel = dynamic(() => import('@/components/ExpensesPanel'), { ssr: false });
const DamagesPanel = dynamic(() => import('@/components/DamagesPanel'), { ssr: false });
const ViolationsPanel = dynamic(() => import('@/components/ViolationsPanel'), { ssr: false });
const NotificationWatcher = dynamic(() => import('@/components/NotificationWatcher'), { ssr: false });

export default function Home() {
  const { 
    isDarkMode, 
    sidebarColor, 
    userReservations, 
    vehicles,
    clients,
    activeTab,
    setActiveTab,
    reservationFilter,
    setReservationFilter,
    isDataLoading
  } = useAppState();

  const [currentSystemTime, setCurrentSystemTime] = React.useState<Date>(() => new Date());

  // Only update currentSystemTime when the calendar day actually transitions at midnight (00:00 AM).
  // This completely eliminates 1,440 unnecessary full-app re-renders every 24 hours while
  // guaranteeing that the moment 00:00 AM arrives, the new day is detected and recalculates.
  useEffect(() => {
    let lastDateStr = new Date().toDateString();

    const checkMidnightTransition = () => {
      const now = new Date();
      const currentDateStr = now.toDateString();
      if (currentDateStr !== lastDateStr) {
        lastDateStr = currentDateStr;
        setCurrentSystemTime(now);
      }
    };

    const interval = setInterval(checkMidnightTransition, 15000);
    return () => clearInterval(interval);
  }, []);

  // Force always showing the base URL
  useEffect(() => {
    if (window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/');
    }
  }, [activeTab]);

  return (
    <>
      {activeTab === 'dashboard' && (
        <Dashboard 
          isDarkMode={isDarkMode} 
          sidebarColor={sidebarColor} 
          userReservations={userReservations} 
          vehicles={vehicles}
          clients={clients}
          setActiveTab={setActiveTab}
          setReservationFilter={setReservationFilter}
        />
      )}
      {activeTab === 'reservations' && (
        <Reservations 
          isDarkMode={isDarkMode} 
          sidebarColor={sidebarColor} 
          userReservations={userReservations}
          dbVehicles={vehicles}
          currentSystemTime={currentSystemTime}
          reservationFilter={reservationFilter}
          setReservationFilter={setReservationFilter}
          isDataLoading={isDataLoading}
        />
      )}
      {activeTab === 'clients' && (
        <ClientsPanel 
          isDarkMode={isDarkMode}
          clients={clients}
        />
      )}
      {activeTab === 'cashflow' && (
        <CashflowPanel isDarkMode={isDarkMode} currentSystemTime={currentSystemTime} />
      )}
      {activeTab === 'expenses' && (
        <ExpensesPanel isDarkMode={isDarkMode} />
      )}
      {activeTab === 'damages' && (
        <DamagesPanel isDarkMode={isDarkMode} />
      )}
      {activeTab === 'history' && (
        <CancelledPanel
          isDarkMode={isDarkMode}
          userReservations={userReservations}
          dbVehicles={vehicles}
        />
      )}
      {activeTab === 'registrations' && (
        <Registrations isDarkMode={isDarkMode} vehicles={vehicles} />
      )}
      {activeTab === 'service' && (
        <ServicePanel 
          isDarkMode={isDarkMode} 
          vehicles={vehicles} 
          userReservations={userReservations} 
        />
      )}
      {activeTab === 'violations' && (
        <ViolationsPanel isDarkMode={isDarkMode} />
      )}
      <NotificationWatcher isDarkMode={isDarkMode} />
    </>
  );
}
