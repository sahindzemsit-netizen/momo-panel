'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClockWidgetProps {
  isLightSidebar: boolean;
  mobile?: boolean;
}

export default function ClockWidget({ isLightSidebar, mobile = false }: ClockWidgetProps) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    // Set first read instantly on hydration completion
    setTime(new Date());
    
    const intervalId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
    }).toUpperCase();
  };

  if (mobile) {
    return (
      <div className={cn(
        "rounded-2xl p-4 flex flex-col gap-3",
        isLightSidebar ? "bg-black/10" : "bg-white/5"
      )}>
        <div className="flex justify-between items-center">
          <span className={cn(
            "text-xs font-bold uppercase",
            isLightSidebar ? "text-black/60" : "text-gray-400"
          )}>CURRENT TIME</span>
          <Clock className={cn(
            "w-3 h-3",
            isLightSidebar ? "text-black" : "text-[#FF5C35]"
          )} />
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-black tracking-tighter">
            {time ? formatTime(time) : '--:--'}
          </span>
          <span className={cn(
            "text-[10px] font-black mb-1 tracking-widest",
            isLightSidebar ? "text-black/40" : "text-white/40"
          )}>
            {time ? formatDate(time) : '--- --'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-[20px] p-3.5 flex flex-col gap-2.5 border shadow-[inset_0_2px_6_rgba(0,0,0,0.4)]",
      isLightSidebar ? "bg-black/10 border-black/5 shadow-[inset_0_2px_6_rgba(0,0,0,0.1)]" : "bg-black/20 border-white/5"
    )}>
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span className="text-2xl font-bold tracking-tighter">
            {time ? formatTime(time) : '--:--'}
          </span>
          <span className={cn(
            "text-[9px] font-bold mt-0.5 tracking-widest",
            isLightSidebar ? "text-black/60" : "text-gray-400"
            )}>
            {time ? formatDate(time) : '--- --'}
          </span>
        </div>
        <div className={cn(
          "w-7 h-7 rounded-full border flex items-center justify-center",
          isLightSidebar ? "border-black/10" : "border-white/10"
        )}>
          <Clock className={cn(
            "w-3.5 h-3.5",
            isLightSidebar ? "text-black" : "text-[#FF5C35]"
          )} />
        </div>
      </div>
    </div>
  );
}
