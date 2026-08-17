'use client';

import React, { useState, useMemo } from 'react';
import { LayoutDashboard, Calendar, Clock, Car, Moon, Sun, FileText, Menu, X, Users, Wrench, TrendingUp, Wallet, Receipt, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { UserProfile } from './Auth';
import GmailNotification from './GmailNotification';
import { useAppState } from '@/lib/context';
import ClockWidget from './ClockWidget';

const navItems = [
  { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { id: 'reservations', label: 'RESERVATIONS', icon: Calendar },
  { id: 'clients', label: 'CLIENTS', icon: Users },
  { id: 'cashflow', label: 'CASHFLOW', icon: Wallet },
  { id: 'expenses', label: 'EXPENSES', icon: Receipt },
  { id: 'violations', label: 'VIOLATIONS', icon: AlertTriangle },
  { id: 'history', label: 'HISTORY', icon: Clock },
  { id: 'registrations', label: 'REGISTRATIONS', icon: FileText },
  { id: 'service', label: 'SERVICE', icon: Wrench },
  { id: 'analytics', label: 'ANALYTICS', icon: TrendingUp },
];

const sidebarColors = [
  { name: 'Momo Vibrant', value: 'linear-gradient(180deg, #2e1065 0%, #c026d3 50%, #ea580c 100%)' },
  { name: 'Black', value: '#0E0C0B' },
  { name: 'Navy', value: '#1E3A8A' },
  { name: 'Forest', value: '#064E3B' },
  { name: 'Burgundy', value: '#7F1D1D' },
  { name: 'Graphite', value: '#374151' },
  { name: 'Purple', value: '#581C87' },
  { name: 'Deep Teal', value: '#134E4A' },
  { name: 'Cocoa', value: '#451A03' },
  { name: 'Cerulean', value: '#0C4A6E' },
  { name: 'Carbon', value: '#1F2937' },
  { name: 'Sunset', value: 'linear-gradient(180deg, #FFBD44 0%, #FF5C8A 100%)' },
  { name: 'Ocean', value: 'linear-gradient(180deg, #51E2C2 0%, #24A69A 100%)' },
  { name: 'Berry', value: 'linear-gradient(180deg, #A855F7 0%, #EC4899 100%)' },
  { name: 'Lime', value: 'linear-gradient(180deg, #84E448 0%, #D9F53B 100%)' },
];

export default function Sidebar() {
  const { 
    isDarkMode, 
    toggleDarkMode, 
    sidebarColor, 
    setSidebarColor, 
    criticalRegistrationsCount,
    unresolvedViolationsCount,
    activeTab,
    setActiveTab
  } = useAppState();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const effectiveSidebarColor = useMemo(() => {
    const defaultLight = '#0E0C0B';
    const defaultDark = '#231F1D';
    if (isDarkMode && sidebarColor === defaultLight) return defaultDark;
    if (!isDarkMode && sidebarColor === defaultDark) return defaultLight;
    return sidebarColor;
  }, [isDarkMode, sidebarColor]);

  const isLightSidebar = useMemo(() => {
    return effectiveSidebarColor.includes('linear-gradient') && 
           !effectiveSidebarColor.includes('#A855F7') && 
           !effectiveSidebarColor.includes('#2e1065');
  }, [effectiveSidebarColor]);

  const mobileNavBg = useMemo(() => {
    if (!isDarkMode && sidebarColor === '#0E0C0B') return '#FFFFFF';
    return effectiveSidebarColor;
  }, [isDarkMode, sidebarColor, effectiveSidebarColor]);

  const navigateTo = (id: string) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <AnimatePresence>
        {showColorPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowColorPicker(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[45] cursor-pointer"
          />
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside 
        style={{ background: effectiveSidebarColor, marginLeft: '-10px', width: '245px' }}
        className={cn(
          "hidden md:flex h-[calc(100vh-2rem)] p-3.5 flex-col gap-5 rounded-[28px] fixed left-4 top-4 z-50 transition-colors duration-200 shadow-2xl",
          isLightSidebar ? "text-[#0E0C0B]" : "text-white"
        )}
      >
      {/* Logo & System Controls */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-7 h-7 bg-[#FF5C35] rounded-lg flex items-center justify-center shadow-lg">
          <Car className="text-white w-4 h-4" />
        </div>
        <span className="font-bold text-sm tracking-tight">MOMO Fleet</span>
        
        <div className="relative ml-auto flex items-center gap-2">
          {/* Notification Bell next to Dark Mode toggle */}
          <GmailNotification isDarkMode={isDarkMode} />

          <button 
            onClick={toggleDarkMode}
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer",
              isLightSidebar ? "bg-black/10 text-black/70 hover:bg-black/20" : "bg-white/10 text-gray-300 hover:bg-white/20"
            )}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-yellow-400" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          <button 
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-colors cursor-pointer",
              isLightSidebar ? "bg-black/10 text-black/70 hover:bg-black/20" : "bg-white/10 text-gray-300 hover:bg-white/20"
            )}
          >
            M
          </button>
          
          <AnimatePresence>
            {showColorPicker && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 mt-2 p-3 bg-[#1A1817] rounded-2xl border border-white/10 shadow-2xl grid grid-cols-5 gap-3 z-50 min-w-[140px]"
              >
                {sidebarColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      setSidebarColor(color.value);
                      setShowColorPicker(false);
                    }}
                    className="w-4 h-4 rounded-full border border-white/20 hover:opacity-80 transition-opacity cursor-pointer shadow-sm"
                    style={{ background: color.value }}
                    title={color.name}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Clock Widget */}
      <ClockWidget isLightSidebar={isLightSidebar} />

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigateTo(item.id)}
            className={cn(
               "flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors duration-100 group relative text-left w-full",
               activeTab === item.id 
                 ? (isLightSidebar ? "bg-black/10 text-black font-black" : "bg-white/10 text-white") 
                 : (isLightSidebar ? "text-black/50 hover:text-black/80 hover:bg-black/5" : "text-white/80 hover:text-white hover:bg-white/5")
            )}
          >
            {activeTab === item.id && (
              <div className={cn(
                "absolute left-0 w-0.5 h-3 rounded-r-full",
                isLightSidebar ? "bg-black" : "bg-[#FF5C35]"
              )} />
            )}
            <item.icon className={cn(
              "w-3.5 h-3.5",
              activeTab === item.id 
                ? (isLightSidebar ? "text-black" : "text-[#FF5C35]") 
                : (isLightSidebar ? "text-black/40 group-hover:text-black/60" : "text-white/70 group-hover:text-white")
            )} />
            <span className="text-[11px] font-bold tracking-widest">{item.label}</span>
            {item.id === 'registrations' && criticalRegistrationsCount > 0 ? (
              <span className={cn(
                "ml-auto w-3.5 h-3.5 rounded-full text-[7px] font-bold flex items-center justify-center border",
                isLightSidebar ? "bg-black text-white border-black" : "bg-[#FF5C35] text-white border-[#FF5C35]"
              )}>
                {criticalRegistrationsCount}
              </span>
            ) : item.id === 'violations' && unresolvedViolationsCount > 0 ? (
              <span className={cn(
                "ml-auto w-3.5 h-3.5 rounded-full text-[7px] font-bold flex items-center justify-center border",
                isLightSidebar ? "bg-black text-white border-black" : "bg-[#FF5C35] text-white border-[#FF5C35]"
              )}>
                {unresolvedViolationsCount}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="mt-auto">
        <UserProfile isDarkMode={isDarkMode} />
      </div>

    </aside>

    {/* Mobile Top Bar */}
    <div className={cn(
      "md:hidden fixed top-0 left-0 right-0 h-16 px-4 flex items-center justify-between z-[60] border-b transition-colors duration-200",
      isDarkMode ? "bg-[#1E1B1A]/80 border-white/5" : "bg-white/80 border-black/5",
      "backdrop-blur-md"
    )}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-[#FF5C35] rounded-xl flex items-center justify-center shadow-lg">
          <Car className="text-white w-5 h-5" />
        </div>
        <span className={cn(
          "font-bold text-sm tracking-tight",
          isDarkMode ? "text-white" : "text-[#0E0C0B]"
        )}>MOMO Fleet</span>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Mobile Bell in Top Bar */}
        <GmailNotification isDarkMode={isDarkMode} />
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95",
            isDarkMode ? "bg-white/5 text-white" : "bg-gray-100 text-[#0E0C0B]"
          )}
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </div>

    {/* Mobile Menu Drawer */}
    <AnimatePresence>
      {isMobileMenuOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] md:hidden"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ background: effectiveSidebarColor }}
            className={cn(
              "fixed top-0 right-0 bottom-0 w-[280px] z-[120] p-6 flex flex-col gap-6 md:hidden shadow-2xl",
              isLightSidebar ? "text-[#0E0C0B]" : "text-white"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#FF5C35] rounded-lg flex items-center justify-center shadow-lg">
                  <Car className="text-white w-4 h-4" />
                </div>
                <span className={cn(
                  "font-bold text-sm tracking-tight",
                  isLightSidebar ? "text-[#0E0C0B]" : "text-white"
                )}>MOMO Fleet</span>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95",
                  isLightSidebar ? "bg-black/10 text-[#0E0C0B]" : "bg-white/10 text-white"
                )}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Status Widget for Mobile Menu */}
            <ClockWidget isLightSidebar={isLightSidebar} mobile />

            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  className={cn(
                    "flex items-center gap-4 px-4 py-4 rounded-2xl transition-all",
                    activeTab === item.id 
                      ? (isLightSidebar ? "bg-black/10 text-black shadow-none border border-black/10" : "bg-[#FF5C35] text-white shadow-lg shadow-[#FF5C35]/20") 
                      : (isLightSidebar ? "text-black/60 hover:bg-black/5 hover:text-black" : "text-white/80 hover:bg-white/5 hover:text-white")
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5",
                    activeTab === item.id && isLightSidebar ? "text-black" : ""
                  )} />
                  <span className="font-bold text-sm tracking-wide uppercase">{item.label}</span>
                  {item.id === 'registrations' && criticalRegistrationsCount > 0 ? (
                    <span className={cn(
                      "ml-auto w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                      isLightSidebar ? "bg-black text-white" : "bg-white text-[#FF5C35]"
                    )}>
                      {criticalRegistrationsCount}
                    </span>
                  ) : item.id === 'violations' && unresolvedViolationsCount > 0 ? (
                    <span className={cn(
                      "ml-auto w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                      isLightSidebar ? "bg-black text-white" : "bg-white text-[#FF5C35]"
                    )}>
                      {unresolvedViolationsCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>

            <div className="mt-auto space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className={cn(
                  "text-xs font-bold uppercase tracking-widest",
                  isLightSidebar ? "text-black/60" : "text-white/60"
                )}>Theme</span>
                <button 
                  onClick={toggleDarkMode}
                  className={cn(
                    "w-12 h-6 rounded-full relative p-1 flex items-center transition-all",
                    isLightSidebar ? "bg-black/10" : "bg-white/10"
                  )}
                >
                  <motion.div 
                    animate={{ x: isDarkMode ? 24 : 0 }}
                    className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center",
                      (isDarkMode || isLightSidebar) ? "bg-[#FF5C35]" : "bg-white"
                    )}
                  >
                    {isDarkMode ? <Moon className="w-2.5 h-2.5 text-white" /> : <Sun className="w-2.5 h-2.5 text-white" />}
                  </motion.div>
                </button>
              </div>
              
              <div className={cn(
                "h-px",
                isLightSidebar ? "bg-black/10" : "bg-white/10"
              )} />
              
              <UserProfile isDarkMode={isDarkMode} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>

    </>
  );
}