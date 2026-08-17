'use client';

import React from 'react';
import Image from 'next/image';
import { CheckCircle2, Key, Pin, Settings, ChevronRight, Clock, Car, Users, Activity, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Reservation, Vehicle, Client } from '@/types';
import RemindersPanel from '@/components/RemindersPanel';

interface DashboardProps {
  isDarkMode: boolean;
  sidebarColor: string;
  userReservations?: Reservation[];
  vehicles?: Vehicle[];
  clients?: Client[];
  setActiveTab: (val: string) => void;
  setReservationFilter: (val: 'TODAY' | 'TODAY_ON_RENT' | 'LAST_DAY' | null) => void;
}

export default function Dashboard({ 
  isDarkMode, 
  sidebarColor, 
  userReservations = [], 
  vehicles = [],
  clients = [],
  setActiveTab,
  setReservationFilter
}: DashboardProps) {
  const [gradientIndex, setGradientIndex] = React.useState(0);
  
  const handleFilterClick = (filter: 'TODAY' | 'LAST_DAY') => {
    setReservationFilter(filter);
    setActiveTab('reservations');
  };


  const fleetCountGradients = React.useMemo(() => [
    { bg: "from-emerald-50 to-white", border: "border-emerald-500", glow: "from-emerald-400" },
    { bg: "from-red-50 to-white", border: "border-red-500", glow: "from-red-400" },
    { bg: "from-blue-50 to-white", border: "border-blue-500", glow: "from-blue-400" },
    { bg: "from-amber-50 to-white", border: "border-amber-500", glow: "from-amber-400" },
    { bg: "from-purple-50 to-white", border: "border-purple-500", glow: "from-purple-400" },
  ], []);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setGradientIndex((prev) => (prev + 1) % fleetCountGradients.length);
    }, 15000);
    return () => clearInterval(interval);
  }, [fleetCountGradients.length]);

  const activeVehicles = vehicles.filter(v => !v.isRetired && !v.isExtra && v.name !== 'EXTRA' && !String(v.id).startsWith('extra-'));
  
  // Calculate dynamic stats
  const onRentCount = userReservations.filter(r => r.status === 'ON RENT').length;
  const reservedCount = userReservations.filter(r => (r.status as string === 'PENDING' || r.status === 'UPCOMING')).length;
  const utilizationRate = activeVehicles.length > 0 ? Math.round((onRentCount / activeVehicles.length) * 100) : 0;
  const clientsCount = clients.length;

  // Calculate top performing vehicle
  const topVehicle = React.useMemo(() => {
    if (vehicles.length === 0 || userReservations.length === 0) return null;
    
    const performanceMap = userReservations
      .filter(r => r.status === 'COMPLETED')
      .reduce((acc, res) => {
        const vId = String(res.vehicleId);
        if (!acc[vId]) acc[vId] = { count: 0, revenue: 0 };
        acc[vId].count += 1;
        
        const price = typeof res.totalPrice === 'number' ? res.totalPrice : (Number(res.totalPrice) || 0);
        acc[vId].revenue += price;
        
        return acc;
      }, {} as Record<string, { count: number, revenue: number }>);

    const sortedIds = Object.keys(performanceMap).sort((a, b) => {
      // Primary: Revenue, Secondary: Count
      if (performanceMap[b].revenue !== performanceMap[a].revenue) {
        return performanceMap[b].revenue - performanceMap[a].revenue;
      }
      return performanceMap[b].count - performanceMap[a].count;
    });

    const topId = sortedIds[0];
    if (!topId) return null;

    const vehicle = vehicles.find(v => String(v.id) === topId && !v.isExtra && v.name !== 'EXTRA' && !String(v.id).startsWith('extra-'));
    if (!vehicle) return null;

    return {
      ...vehicle,
      performance: performanceMap[topId]
    };
  }, [vehicles, userReservations]);

  const dynamicStats = [
    {
      label: 'UTILIZATION',
      value: `${utilizationRate}%`,
      badge: 'ACTIVE',
      color: 'blue',
      icon: Activity,
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      iconBg: 'bg-blue-600',
      iconBorder: 'border-blue-800',
      badgeBg: 'bg-blue-100 text-black',
      glow: 'from-blue-400',
    },
    {
      label: 'ON RENT',
      value: onRentCount,
      badge: 'ACTIVE',
      color: 'red',
      icon: Key,
      bg: 'bg-red-50',
      border: 'border-red-500',
      iconBg: 'bg-red-600',
      iconBorder: 'border-red-800',
      badgeBg: 'bg-red-100 text-black',
      glow: 'from-red-400',
    },
    {
      label: 'RESERVED',
      value: reservedCount,
      badge: 'UPCOMING',
      color: 'teal',
      icon: Pin,
      bg: 'bg-[#2EA96C]/15',
      border: 'border-[#2EA96C]',
      iconBg: 'bg-[#2EA96C]',
      iconBorder: 'border-[#2EA96C]',
      badgeBg: 'bg-[#2EA96C]/30 text-black dark:text-[#2EA96C]',
      glow: 'from-[#2EA96C]',
    },
    {
      label: 'MAINTENANCE',
      value: 0,
      badge: 'EST.',
      color: 'amber',
      icon: Settings,
      bg: 'bg-amber-50',
      border: 'border-amber-500',
      iconBg: 'bg-amber-600',
      iconBorder: 'border-amber-800',
      badgeBg: 'bg-amber-100 text-black',
      glow: 'from-amber-400',
    },
    {
      label: 'CLIENTS',
      value: clientsCount,
      badge: 'TOTAL',
      color: 'purple',
      icon: Users,
      bg: 'bg-purple-50',
      border: 'border-purple-500',
      iconBg: 'bg-purple-600',
      iconBorder: 'border-purple-800',
      badgeBg: 'bg-purple-100 text-black',
      glow: 'from-purple-400',
    },
  ];

  // Derive recent activity from real reservations
  const dynamicActivities = [...userReservations]
    .sort((a, b) => {
      const getTS = (v: unknown) => {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        const pt = v as { toDate?: () => { getTime: () => number } };
        if (pt && typeof pt.toDate === 'function') return pt.toDate().getTime();
        return 0;
      };
      const getVal = (r: Reservation) => {
        const createTS = getTS(r.createdAt);
        if (createTS > 0) return createTS;
        if (typeof r.id === 'string' && !isNaN(Number(r.id))) {
          return Number(r.id);
        }
        const updateTS = getTS(r.updatedAt);
        if (updateTS > 0) return updateTS;
        return 0;
      };
      return getVal(b) - getVal(a);
    })
    .slice(0, 4)
    .map(res => {
      let relativeTime = 'RECENT';
      try {
        const getTS = (v: unknown) => {
          if (!v) return null;
          if (typeof v === 'number') return v;
          const pt = v as { toDate?: () => { getTime: () => number } };
          if (pt && typeof pt.toDate === 'function') return pt.toDate().getTime();
          return null;
        };
        const timestamp = getTS(res.createdAt) || (typeof res.id === 'string' && !isNaN(Number(res.id)) ? Number(res.id) : null) || getTS(res.updatedAt);
        if (timestamp) {
          relativeTime = formatDistanceToNow(new Date(timestamp), { addSuffix: true }).toUpperCase();
        }
      } catch (e) {
        console.error("Error calculating relative time:", e);
      }

      return {
        id: res.id,
        user: res.name.toUpperCase(),
        car: vehicles.find(v => String(v.id) === String(res.vehicleId))?.name || 'Unknown Car',
        status: res.status || 'UPCOMING',
        statusColor: res.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 
                     res.status === 'ON RENT' ? 'bg-red-100 text-red-600' : 
                     res.status === 'CANCELLED' ? 'bg-gray-100 text-gray-500' : 'bg-[#00FF00]/10 text-[#00FF00] border border-[#00FF00]/20 font-black',
        time: relativeTime,
        icon: res.status === 'ON RENT' ? Key : 
              res.status === 'COMPLETED' ? CheckCircle2 : 
              res.status === 'CANCELLED' ? XCircle : Pin,
        iconBg: res.status === 'ON RENT' ? 'bg-red-600' : 
                res.status === 'COMPLETED' ? 'bg-emerald-600' : 
                res.status === 'CANCELLED' ? 'bg-gray-400' : 'bg-[#00FF00]',
        iconBorder: res.status === 'ON RENT' ? 'border-red-800' : 
                    res.status === 'COMPLETED' ? 'border-emerald-800' : 
                    res.status === 'CANCELLED' ? 'border-gray-600' : 'border-[#00D000]',
      };
    });

  const effectiveColor = React.useMemo(() => {
    const defaultLight = '#0E0C0B';
    const defaultDark = '#231F1D';
    if (isDarkMode && sidebarColor === defaultLight) return defaultDark;
    if (!isDarkMode && sidebarColor === defaultDark) return defaultLight;
    return sidebarColor;
  }, [isDarkMode, sidebarColor]);

  const isLightSidebar = React.useMemo(() => {
    return effectiveColor.includes('linear-gradient') && 
           !effectiveColor.includes('#A855F7') && 
           !effectiveColor.includes('#2e1065');
  }, [effectiveColor]);

  return (
    <div className={cn(
      "flex-1 md:ml-[266px] h-screen transition-colors duration-200 pt-4 md:pr-4 md:pb-4 md:pl-0 flex flex-col overflow-hidden",
      isDarkMode ? "bg-[#1E1B1A]" : "bg-white"
    )}>
      <div className="w-full flex-1 flex flex-col gap-3 min-h-0">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-2 shrink-0">
          <div className={cn(
            "w-fit flex items-center gap-2 px-4 py-1.5 rounded-full border shadow-sm transition-colors duration-200",
            isDarkMode ? "border-white/5" : "border-white"
          )} style={{ background: effectiveColor }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏎️</span>
              <h1 className={cn(
                "text-lg font-black tracking-tight transition-colors",
                isLightSidebar ? "text-[#0E0C0B]" : "text-white"
              )}>Fleet Overview</h1>
            </div>
          </div>

          {/* New Component: Total Fleet Count */}
          <div className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-[20px] border-2 border-b-4 transition-colors duration-200 bg-gradient-to-br relative overflow-hidden",
            isDarkMode 
              ? cn("bg-[#2C2724] border-white/5", fleetCountGradients[gradientIndex].bg.replace('-50', '-900/20')) 
              : cn(fleetCountGradients[gradientIndex].bg, fleetCountGradients[gradientIndex].border, "shadow-sm")
          )}>
            <div className={cn(
              "absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l to-transparent opacity-20 pointer-events-none transition-colors duration-200",
              fleetCountGradients[gradientIndex].glow
            )} />
            
              <div className={cn(
                "flex-shrink-0 relative z-10 transition-transform duration-500 hover:scale-110",
                "w-8 h-8"
              )}>
                <Image 
                  src="/total-fleet-count.png" 
                  alt="Total Fleet Count Icon"
                  width={32}
                  height={32}
                  priority
                  className="w-8 h-8 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            <div className="flex flex-col justify-center relative z-10">
              <span className={cn(
                "text-[9px] font-black tracking-[0.1em] uppercase leading-none mb-1 transition-colors duration-1000",
                isDarkMode ? "text-gray-400" : "text-gray-500"
              )}>TOTAL FLEET COUNT</span>
              <span className={cn(
                "text-xl font-black leading-none transition-colors duration-1000",
                isDarkMode ? "text-white" : "text-[#0E0C0B]"
              )}>{activeVehicles.length}</span>
            </div>
          </div>
        </header>

        {/* Global Reminders Panel */}
        <div className="mt-2.5 mb-1 shrink-0">
          <RemindersPanel isDarkMode={isDarkMode} sidebarColor={sidebarColor} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-2.5 overflow-y-auto md:overflow-visible pr-1">
          {dynamicStats.map((stat) => (
            <motion.div
              key={stat.label}
              whileHover={{ y: -6 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className={cn(
                "relative overflow-hidden p-2.5 rounded-[20px] border-2 border-b-4 shadow-sm group transition-colors duration-150 h-[90px] mb-0 mt-[-10px]",
                stat.border,
                isDarkMode 
                  ? "bg-[#2C2724] shadow-[0_10px_30px_rgba(0,0,0,0.3)]" 
                  : cn(stat.bg, "shadow-[0_10px_30px_rgba(0,0,0,0.05),0_0_20px_rgba(245,241,233,0.8)]")
              )}
            >
              <div className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l ${stat.glow} to-transparent opacity-20 pointer-events-none`} />
              <div className="flex items-center gap-3.5 relative z-10">
                <div className="relative group/icon">
                  {/* External Glow - Bottom only */}
                  <div className={`absolute -bottom-2 left-1 right-1 h-4 ${stat.iconBg} opacity-40 blur-lg rounded-full pointer-events-none`} />
                  
                  <div className={`w-8 h-8 ${stat.iconBg} ${stat.iconBorder} rounded-lg flex items-center justify-center shadow-lg border-b-2 relative overflow-hidden`}>
                    {/* Internal Hue */}
                    <div className={`absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t ${stat.glow} to-transparent opacity-60`} />
                    <stat.icon className="w-4 h-4 text-white relative z-10 drop-shadow-md" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-[7px] font-black text-gray-400 tracking-widest uppercase",
                    "mb-0.5"
                  )}>{stat.label}</span>
                  <span className={cn(
                    "text-xl font-black leading-none mb-1 transition-colors",
                    isDarkMode ? "text-white" : "text-[#0E0C0B]"
                  )}>{stat.value}</span>
                  <span className={cn(
                    "inline-flex px-1.5 py-0.5 rounded-full text-[8px] font-black tracking-widest w-fit transition-colors",
                    isDarkMode ? "bg-white/5 text-gray-300" : cn(stat.badgeBg, "!text-black")
                  )}>
                    {stat.badge}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}

        </div>

        {/* Main Content Area */}
        <div className="flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Recent Activity */}
          <div className={cn(
            "flex-[1.6] h-[380px] rounded-[32px] p-1.5 border-2 transition-colors duration-200 min-h-0",
            isDarkMode 
              ? "bg-[#2C2724] border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]" 
              : "bg-[#F5F1E9] border-[#F5F1E9] shadow-[0_20px_50px_rgba(0,0,0,0.06),0_0_30px_rgba(245,241,233,1)]"
          )}>
            <div className={cn(
              "w-full h-full rounded-[28px] p-4 border flex flex-col transition-colors duration-200 min-h-0",
              isDarkMode 
                ? "bg-[#231F1D] border-white/5 shadow-black/20" 
                : "bg-white border-[#F5F1E9] shadow-inner"
            )}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                  isDarkMode ? "bg-white/5" : "bg-blue-50"
                )}>
                  <Clock className={cn(
                    "w-3.5 h-3.5 transition-colors",
                    isDarkMode ? "text-[#FF5C35]" : "text-blue-500"
                  )} />
                </div>
                <div>
                  <h3 className={cn(
                    "text-sm font-black tracking-tight transition-colors",
                    isDarkMode ? "text-white" : "text-[#0E0C0B]"
                  )}>RECENT ACTIVITY</h3>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-4 pb-1 overflow-y-auto custom-scrollbar pr-2">
                {dynamicActivities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-30">
                    <p className="font-black text-[10px] tracking-widest text-gray-400 uppercase">No recent activity</p>
                  </div>
                ) : dynamicActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-9 h-9 ${activity.iconBg} ${activity.iconBorder} rounded-lg flex items-center justify-center shadow-lg border-b-3 relative overflow-hidden`}>
                        <activity.icon className="w-3.5 h-3.5 text-white relative z-10 drop-shadow-md" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn(
                            "font-black text-xs transition-colors",
                            isDarkMode ? "text-white" : "text-[#0E0C0B]"
                          )}>{activity.user}</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-full text-[6px] font-black tracking-widest transition-colors",
                            isDarkMode ? "bg-white/5 text-gray-300" : activity.statusColor
                          )}>
                            {activity.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Car className="w-2.5 h-2.5" />
                          <span className="text-[9px] font-bold">{activity.car}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[7px] font-black text-gray-400 tracking-widest">{activity.time}</span>
                      <motion.div 
                        whileHover={{ x: 2 }}
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-all",
                          isDarkMode ? "bg-white/5" : "bg-gray-50"
                        )}
                      >
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                      </motion.div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Vehicle Showcase */}
          <div className={cn(
            "flex-1 h-[380px] rounded-[32px] p-1.5 border-2 transition-colors duration-200",
            isDarkMode 
              ? "bg-[#2C2724] border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]" 
              : "bg-[#F5F1E9] border-[#F5F1E9] shadow-[0_20px_50px_rgba(0,0,0,0.06)]"
          )}>
            <div className={cn(
              "w-full h-full rounded-[28px] p-4 border flex flex-col relative overflow-hidden transition-colors duration-200",
              isDarkMode 
                ? "bg-[#231F1D] border-white/5" 
                : "bg-white border-[#F5F1E9]"
            )}>
              <div className="flex items-center gap-2.5 mb-3 relative z-10">
                <div className={cn(
                  "w-7 h-7 rounded-lg bg-orange-600 border-b-3 border-orange-800 flex items-center justify-center"
                )}>
                  <Activity className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className={cn(
                  "text-sm font-black tracking-tight transition-colors",
                  isDarkMode ? "text-white" : "text-[#0E0C0B]"
                )}>TOP PERFORMER</h3>
              </div>

              {topVehicle ? (
                <div className="flex-1 flex flex-col justify-between relative z-10">
                  <div className="flex flex-col gap-2">
                    <div className={cn(
                      "w-fit px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-orange-100 text-orange-600"
                    )}>
                      MOST VALUABLE ASSET
                    </div>
                    <div className="flex flex-col gap-1.5 pt-1">
                      {/* Row 1: Car Name */}
                      <span className={cn(
                        "text-lg font-black tracking-tight",
                        isDarkMode ? "text-white" : "text-[#0E0C0B]"
                      )}>{topVehicle.name}</span>

                      {/* Row 2: Plate + Transmission Icon */}
                      <div className="flex items-center gap-1.5">
                        <div className="inline-flex items-center rounded-md border-2 border-black/30 bg-white px-2.5 py-1 shadow-md hover:scale-105 transition-transform shrink-0 w-fit text-black relative overflow-hidden">
                          <div className="w-[4px] h-4 bg-blue-700 rounded-l-[2px] -ml-2.5 mr-2 shrink-0" />
                          <span className={cn(
                            "text-xs md:text-sm font-mono font-extrabold tracking-wider uppercase leading-none select-all",
                            topVehicle.color ? "pr-[14px]" : ""
                          )}>
                            {topVehicle.plate}
                          </span>
                          {topVehicle.color && (
                            <div 
                              className="absolute right-0 top-0 bottom-0 border-l border-black/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] shrink-0 rounded-r-[4px]"
                              style={{ 
                                width: '12px',
                                backgroundColor: topVehicle.color
                              }}
                            />
                          )}
                        </div>
                        <div className="w-5 h-5 rounded-full bg-white border border-black/10 flex items-center justify-center shadow-sm shrink-0">
                          <span className="font-black text-[11px] text-black leading-none pb-[0.5px]">
                            {topVehicle.transmission === 'Manual' ? 'M' : 'A'}
                          </span>
                        </div>
                      </div>

                      {/* Row 3: Chassis Number */}
                      {topVehicle.chassisNumber && (
                        <p className="text-[9px] font-mono opacity-80 uppercase tracking-widest leading-none truncate ml-0.5 pt-1">
                          CHASSIS: {topVehicle.chassisNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className={cn(
                      "p-3 rounded-2xl border transition-colors",
                      isDarkMode ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100"
                    )}>
                      <span className="text-[8px] font-black text-gray-400 tracking-widest block mb-1 uppercase">TOTAL REVENUE</span>
                      <span className={cn(
                        "text-xl font-black",
                        isDarkMode ? "text-white" : "text-[#0E0C0B]"
                      )}>€{topVehicle.performance?.revenue}</span>
                    </div>
                    <div className={cn(
                      "p-3 rounded-2xl border transition-colors",
                      isDarkMode ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100"
                    )}>
                      <span className="text-[8px] font-black text-gray-400 tracking-widest block mb-1 uppercase">RESERVATIONS</span>
                      <span className={cn(
                        "text-xl font-black",
                        isDarkMode ? "text-white" : "text-[#0E0C0B]"
                      )}>{topVehicle.performance?.count}</span>
                    </div>
                  </div>

                  {/* Visual Glow */}
                  <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-[#FF5C35] opacity-10 blur-[80px] rounded-full pointer-events-none" />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
                  <div className="opacity-30 flex flex-col items-center">
                    <Car className="w-12 h-12 mb-3 text-[#FF5C35]" />
                    <p className="font-black text-[12px] tracking-widest text-[#FF5C35] uppercase mb-1">Top Performer</p>
                    <p className="text-gray-400 text-[10px] tracking-widest uppercase">No data available yet</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${isDarkMode ? '#231F1D' : '#f1f1f1'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? '#3D3632' : '#ddd'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? '#4D443F' : '#ccc'};
        }
      `}</style>
    </div>
  );
}
