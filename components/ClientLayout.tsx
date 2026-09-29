'use client';

import React, { useState } from 'react';
import { useAppState } from '@/lib/context';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from './ErrorBoundary';
import { ShieldAlert, LogOut, KeyRound } from 'lucide-react';
import { LoginButton } from './Auth';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { 
    user, 
    isAdmin,
    isDarkMode, 
    isLoading, 
    isDataLoading, 
    vehicles
  } = useAppState();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1614]">
        <div className="w-12 h-12 border-4 border-[#FF5C35] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4 transition-colors duration-500",
        isDarkMode ? "bg-[#1E1B1A]" : "bg-gray-50"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-3xl border shadow-xl flex flex-col items-center text-center gap-6",
          isDarkMode ? "bg-[#231F1D] border-white/10" : "bg-white border-gray-100"
        )}>
          <div className="w-16 h-16 bg-[#FF5C35]/10 rounded-2xl flex items-center justify-center text-[#FF5C35]">
            <KeyRound className="w-8 h-8 animate-pulse" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className={cn("text-2xl font-bold tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>
              MOMO PORTAL
            </h1>
            <p className="text-gray-500 text-sm">
              Please sign in with your authorized Google account to access the fleet dashboard.
            </p>
          </div>
          <LoginButton className="w-full justify-center py-4 text-lg" />
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            FLEET MANAGEMENT SYSTEM
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4 transition-colors duration-500",
        isDarkMode ? "bg-[#1E1B1A]" : "bg-gray-50"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-3xl border shadow-xl flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in duration-300",
          isDarkMode ? "bg-[#231F1D] border-white/10" : "bg-white border-gray-100"
        )}>
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className={cn("text-2xl font-bold tracking-tight", isDarkMode ? "text-white" : "text-gray-900")}>
              ACCESS PENDING
            </h1>
            <p className={cn("text-sm leading-relaxed", isDarkMode ? "text-gray-400" : "text-gray-500")}>
              Your email (<strong className="font-semibold">{user.email}</strong>) has been authenticated, but your admin role has not been confirmed in our database yet.
            </p>
            <p className={cn("text-xs leading-relaxed mt-2 p-3 rounded-xl border", isDarkMode ? "text-[#FF7D5E] border-orange-500/10 bg-orange-500/5" : "text-[#FF5C35] border-orange-200 bg-orange-50")}>
              Please request an administrator to activate your user account in the system using your email address.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={() => {
                window.location.href = `mailto:admin@momo.com?subject=MOMO%20Portal%20Access%20Request&body=Hello,%20please%20grant%20me%20admin%20access.%20My%20registered%20email%20is:%20${user.email}`;
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#FF5C35] hover:bg-[#FF7D5E] text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-[#FF5C35]/20 text-sm"
            >
              CONTACT ADMIN
            </button>
            <button
              onClick={() => signOut(auth)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-xl font-bold transition-all active:scale-95 text-sm",
                isDarkMode 
                  ? "border-white/10 text-white hover:bg-white/5" 
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              )}
            >
              <LogOut className="w-4 h-4" />
              <span>SIGN OUT</span>
            </button>
          </div>
          
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            FLEET MANAGEMENT SYSTEM
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col md:flex-row min-h-screen transition-colors duration-500",
      isDarkMode ? "bg-[#1E1B1A]" : "bg-white"
    )}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  );
}
