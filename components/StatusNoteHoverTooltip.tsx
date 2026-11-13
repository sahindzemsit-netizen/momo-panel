'use client';

import React, { useState, useEffect, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { getTextColorForBg } from './reservations/types';

export interface StatusNoteTooltipDetail {
  note: string;
  hasNote: boolean;
  color: string;
  carName?: string;
  plate?: string;
  x: number;
  y: number;
  isBelow?: boolean;
  isDarkMode?: boolean;
}

export const StatusNoteHoverTooltip = memo(() => {
  const [data, setData] = useState<StatusNoteTooltipDetail | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);

    const showHandler = (e: Event) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setData((e as CustomEvent<StatusNoteTooltipDetail>).detail);
      setIsVisible(true);
    };

    const hideHandler = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 40);
    };

    window.addEventListener('show-status-note-tooltip', showHandler as EventListener);
    window.addEventListener('hide-status-note-tooltip', hideHandler);

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      window.removeEventListener('show-status-note-tooltip', showHandler as EventListener);
      window.removeEventListener('hide-status-note-tooltip', hideHandler);
    };
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  const hasData = isVisible && data && data.hasNote && data.note && data.note.trim();
  if (!hasData || !data) return null;

  const isBelow = !!data.isBelow;
  const isDark = !!data.isDarkMode;
  const effectiveBg = data.color || '#FF5C35';
  const textColor = getTextColorForBg(effectiveBg);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: data.y,
        left: data.x,
        transform: isBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        opacity: hasData ? 1 : 0,
        transition: 'opacity 60ms ease-out',
        willChange: 'transform, opacity',
        pointerEvents: 'none'
      }}
      className="pointer-events-none z-[10002] flex flex-col items-center select-none"
    >
      {/* Upward pointing arrow if placed below the circle */}
      {isBelow && (
        <div
          className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent -mb-[1px] z-20"
          style={{ borderBottomColor: effectiveBg }}
        />
      )}

      <div
        className={cn(
          "px-3 py-1.5 rounded-xl text-center shadow-[0_12px_36px_rgba(0,0,0,0.3)] border max-w-[280px] whitespace-normal break-words inline-flex items-center justify-center",
          isDark ? "border-white/10" : "border-black/10"
        )}
        style={{
          backgroundColor: effectiveBg,
          color: textColor
        }}
      >
        <span className="text-[11px] font-black uppercase tracking-wide leading-tight">
          {data.note.trim()}
        </span>
      </div>

      {/* Downward pointing arrow if placed above the circle */}
      {!isBelow && (
        <div
          className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent -mt-[1px] z-20"
          style={{ borderTopColor: effectiveBg }}
        />
      )}
    </div>,
    document.body
  );
});

StatusNoteHoverTooltip.displayName = 'StatusNoteHoverTooltip';
