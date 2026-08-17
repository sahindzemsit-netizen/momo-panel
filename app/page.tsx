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
const AnalyticsPanel = dynamic(() => import('@/components/AnalyticsPanel'), { ssr: false });
const CashflowPanel = dynamic(() => import('@/components/CashflowPanel'), { ssr: false });
const ExpensesPanel = dynamic(() => import('@/components/ExpensesPanel'), { ssr: false });
const ViolationsPanel = dynamic(() => import('@/components/ViolationsPanel'), { ssr: false });

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

  const [currentSystemTime, setCurrentSystemTime] = React.useState<Date>(new Date());

  // Keep clock in sync at 1-minute intervals to avoid per-second re-render cascades
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSystemTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
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
      {activeTab === 'analytics' && (
        <AnalyticsPanel isDarkMode={isDarkMode} />
      )}
      {activeTab === 'violations' && (
        <ViolationsPanel isDarkMode={isDarkMode} />
      )}
    </>
  );
}
