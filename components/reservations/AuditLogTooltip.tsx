'use client';

import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Vehicle } from '@/types';

interface AuditLogTooltipProps {
  hoveredAuditId: string | null;
  hoveredAuditCoords: { top: number; left: number; align?: 'left' | 'right' } | null;
  auditAdjustY: number;
  auditPanelRef: React.RefObject<HTMLDivElement | null> | ((node: HTMLDivElement | null) => void);
  auditLogsMap: Record<string, { loading: boolean; error: boolean; logs: any[] }>;
  isDarkMode: boolean;
  dbVehicles: Vehicle[];
  onClose: () => void;
}

export const AuditLogTooltip = memo(({
  hoveredAuditId,
  hoveredAuditCoords,
  auditAdjustY,
  auditPanelRef,
  auditLogsMap,
  isDarkMode,
  dbVehicles,
  onClose
}: AuditLogTooltipProps) => {
  if (!hoveredAuditId || !hoveredAuditCoords || typeof document === 'undefined') {
    return null;
  }

  const state = auditLogsMap[hoveredAuditId];
  if (!state) return null;

  const visibleLogs = (state.logs || []).filter((log: any) => {
    if (log.action === 'status_changed') return false;
    if (log.changedFields) {
      const keys = Object.keys(log.changedFields).filter(k => k !== 'status' && k !== 'uploadedDocuments');
      return keys.length > 0;
    }
    return true;
  });

  const renderVal = (v: any) => {
    if (v === null || v === undefined) return 'None';
    
    // Handle Firestore Timestamp
    if (typeof v === 'object' && v !== null && 'seconds' in v) {
      try {
        const d = new Date(v.seconds * 1000);
        return format(d, 'yyyy-MM-dd');
      } catch (_) {}
    }
    
    // Handle Date objects
    if (v instanceof Date) {
      return format(v, 'yyyy-MM-dd');
    }
    
    // Handle arrays
    if (Array.isArray(v)) {
      return v.join(', ') || 'Empty';
    }
    
    // Handle insurance or custom objects
    if (typeof v === 'object' && v !== null) {
      if ('type' in v) return `Type ${v.type} (€${v.price ?? ''})`;
      return v.name || JSON.stringify(v);
    }
    
    return String(v);
  };

  const renderAuditBody = (isMobile: boolean) => {
    if (state.loading) {
      return (
        <div className={cn(
          "flex items-center gap-2 py-8 justify-center text-sm font-bold",
          isDarkMode ? "text-white" : "text-neutral-900"
        )}>
          <Loader2 className="w-5 h-5 animate-spin text-[#FF5C35]" />
          <span>Loading audit records...</span>
        </div>
      );
    }
    
    if (state.error) {
      return <p className="text-sm font-bold text-red-500 py-6 text-center">Failed to load logs</p>;
    }
    
    if (visibleLogs.length === 0) {
      return (
        <p className={cn(
          "text-sm font-bold py-6 text-center uppercase tracking-wider opacity-60",
          isDarkMode ? "text-white" : "text-neutral-900"
        )}>No changes recorded</p>
      );
    }

    return (
      <div className={cn(
        "flex flex-col gap-3 pr-1 pb-1 w-full custom-scrollbar scroll-smooth",
        isMobile ? "max-h-[62vh] overflow-y-auto" : "max-h-[350px] overflow-y-auto"
      )}>
        {visibleLogs.map((log) => {
          const actionLabels: Record<string, string> = {
            'price_updated': 'Price Updated',
            'status_changed': 'Status Changed',
            'contact_info_changed': 'Contact Changed',
            'booking_details_changed': 'Details Changed',
            'reservation_updated': 'Reservation Updated'
          };
          const actionLabel = actionLabels[log.action] || log.action;
          
          return (
            <div 
              key={log.id} 
              className={cn(
                "w-full border rounded-2xl flex flex-col justify-between shadow-sm",
                isMobile ? "p-3" : "p-4",
                isDarkMode 
                  ? "bg-white/5 border-white/10 text-white" 
                  : "bg-neutral-50 border-neutral-200 text-neutral-900"
              )}
            >
              <div>
                <div className={cn(
                  "flex items-center justify-between gap-1 mb-2 border-b pb-1.5",
                  isDarkMode ? "border-white/10" : "border-neutral-200"
                )}>
                  <span className={cn(
                    "font-black text-[#FF5C35] uppercase truncate flex-1 min-w-0 pr-1",
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    {actionLabel}
                  </span>
                  <span className={cn(
                    "font-bold font-mono flex-shrink-0",
                    isMobile ? "text-[11px]" : "text-xs",
                    isDarkMode ? "text-white/60" : "text-neutral-500"
                  )}>
                    {log.formattedTime.split(' ')[1] || log.formattedTime}
                  </span>
                </div>
                <div className={cn(
                  "flex flex-col gap-1 text-xs font-sans font-medium mb-2.5 pb-2 border-b",
                  isDarkMode ? "text-white/80 border-white/5" : "text-neutral-700 border-neutral-200/50"
                )}>
                  <div className="flex items-center gap-2">
                    <span className="text-[#FF5C35] font-bold text-[10px] uppercase tracking-wider w-11 shrink-0">BY:</span> 
                    <span className={cn(
                      "font-extrabold truncate",
                      isMobile ? "text-[11px] max-w-[210px]" : "text-[11.5px]",
                      isDarkMode ? "text-white" : "text-neutral-900"
                    )}>
                      {log.changedBy}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#FF5C35] font-bold text-[10px] uppercase tracking-wider w-11 shrink-0">DATE:</span> 
                    <span className={cn(
                      "font-extrabold",
                      isMobile ? "text-[11px]" : "text-[11.5px]",
                      isDarkMode ? "text-white" : "text-neutral-900"
                    )}>
                      {log.formattedTime.split(' ')[0]}
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2.5">
                  {log.changedFields && Object.keys(log.changedFields).filter(field => field !== 'status' && field !== 'uploadedDocuments').map((field) => {
                    const oldVal = log.changedFields[field]?.oldValue;
                    const newVal = log.changedFields[field]?.newValue;
                    
                    const getFieldLabel = (rawField: string) => {
                      const mapping: Record<string, string> = {
                        'totalPrice': 'Total Price',
                        'amountPaid': 'Amount Paid',
                        'status': 'Status',
                        'name': 'Client Name',
                        'email': 'Client Email',
                        'phone': 'Client Phone',
                        'start': 'Start Date',
                        'end': 'End Date',
                        'fromLocation': 'From Loc',
                        'toLocation': 'To Loc',
                        'vehicleId': 'Vehicle Name',
                        'vehicle': 'Vehicle Name',
                        'note': 'Notes',
                        'countries': 'Countries',
                        'insurance': 'Insurance'
                      };
                      return mapping[rawField] || rawField;
                    };

                    const isPriceField = field === 'totalPrice' || field === 'amountPaid';
                    
                    let displayOld = '';
                    let displayNew = '';
                    
                    if ((field === 'vehicleId' || field === 'vehicle') && dbVehicles) {
                      const foundOld = dbVehicles.find(veh => 
                        String(veh.id) === String(oldVal) || 
                        veh.name?.toLowerCase() === String(oldVal).toLowerCase()
                      );
                      const foundNew = dbVehicles.find(veh => 
                        String(veh.id) === String(newVal) || 
                        veh.name?.toLowerCase() === String(newVal).toLowerCase()
                      );
                      displayOld = foundOld ? `${foundOld.name} (${foundOld.plate})` : String(oldVal || 'Unknown');
                      displayNew = foundNew ? `${foundNew.name} (${foundNew.plate})` : String(newVal || 'Unknown');
                    } else {
                      displayOld = isPriceField && typeof oldVal === 'number' ? `€${oldVal}` : renderVal(oldVal);
                      displayNew = isPriceField && typeof newVal === 'number' ? `€${newVal}` : renderVal(newVal);
                    }

                    return (
                      <div key={field} className="text-xs pl-2.5 border-l-2 border-[#FF5C35] flex flex-col gap-1 py-1 leading-snug text-left">
                        <span className="font-extrabold uppercase tracking-wider text-[10.5px] text-[#FF5C35]">{getFieldLabel(field)}</span>
                        <div className="flex flex-col gap-1.5 font-mono text-xs">
                          <div className="flex items-start gap-1.5">
                            <span className={cn(
                              "text-[9.5px] font-black uppercase tracking-wider w-10 shrink-0 mt-0.5",
                              isDarkMode ? "text-white/60" : "text-neutral-500"
                            )}>FROM:</span>
                            <span className={cn(
                              "line-through font-extrabold px-2 py-0.5 rounded break-all",
                              isMobile ? "max-w-full text-[11px]" : "truncate max-w-[360px]",
                              isDarkMode ? "bg-red-500/15 text-red-500 font-bold" : "bg-red-50 text-red-700 border border-red-100/80 font-bold"
                            )} title={displayOld}>
                              {displayOld}
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <span className={cn(
                              "text-[9.5px] font-black uppercase tracking-wider w-10 shrink-0 mt-0.5",
                              isDarkMode ? "text-white/60" : "text-neutral-500"
                            )}>TO:</span>
                            <span className={cn(
                              "font-extrabold px-2 py-0.5 rounded break-all",
                              isMobile ? "max-w-full text-[11px]" : "truncate max-w-[360px]",
                              isDarkMode ? "bg-emerald-500/15 text-emerald-400 font-bold" : "bg-emerald-50 text-emerald-700 border border-emerald-100/80 font-bold"
                            )} title={displayNew}>
                              {displayNew}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return createPortal(
    <>
      {/* Mobile PWA Dialog (Centered, Compact, 100% Readable) */}
      <div 
        className="fixed inset-0 z-[99999] flex md:hidden items-center justify-center p-3 sm:p-4 bg-black/70"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div 
          className={cn(
            "audit-log-panel p-4 rounded-3xl border shadow-2xl w-full max-w-[94vw] sm:max-w-md max-h-[85vh] flex flex-col text-left pointer-events-auto relative",
            isDarkMode 
              ? "bg-[#241F1D] border-white/10 text-white" 
              : "bg-white border-neutral-200 text-neutral-900"
          )}
        >
          <div className={cn(
            "flex items-center justify-between mb-3 border-b pb-2.5 shrink-0",
            isDarkMode ? "border-white/10" : "border-neutral-200"
          )}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5C35]" />
              <p className="text-[13px] font-black tracking-widest uppercase font-sans">
                Reservation Audit Log
              </p>
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className={cn(
                "w-7 h-7 flex items-center justify-center text-lg font-bold select-none rounded-full transition-all active:scale-95 cursor-pointer",
                isDarkMode 
                  ? "bg-white/10 text-white hover:bg-white/20" 
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              ×
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {renderAuditBody(true)}
          </div>
        </div>
      </div>

      {/* Desktop PC Popover (100% Untouched Anchor & Dimensions) */}
      <div 
        className="hidden md:block fixed z-[9999] pointer-events-auto"
        style={{
          top: hoveredAuditCoords.top,
          left: hoveredAuditCoords.left,
          transform: hoveredAuditCoords.align === 'right' 
            ? `translate(12px, calc(-50% + ${auditAdjustY}px))` 
            : `translate(calc(-100% - 12px), calc(-50% + ${auditAdjustY}px))`
        }}
      >
        <div 
          ref={auditPanelRef}
          className={cn(
            "audit-log-panel p-5 rounded-3xl border shadow-2xl w-[540px] max-w-[95vw] text-left pointer-events-auto relative",
            isDarkMode 
              ? "bg-[#2C2724] border-white/10 text-white" 
              : "bg-white border-neutral-200 text-neutral-900"
          )}
        >
          <div className={cn(
            "flex items-center justify-between mb-4 border-b pb-2",
            isDarkMode ? "border-white/10" : "border-neutral-200"
          )}>
            <p className="text-[14px] font-black tracking-widest uppercase font-sans">
              Reservation Audit Log
            </p>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className={cn(
                "text-xl font-bold leading-none select-none p-1 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer",
                isDarkMode 
                  ? "text-white/60 hover:bg-white/10 hover:text-white" 
                  : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
              )}
            >
              ×
            </button>
          </div>
          
          {renderAuditBody(false)}
          
          <div 
            className={cn(
              "audit-arrow absolute top-1/2 -translate-y-1/2 border-[6px] border-transparent",
              hoveredAuditCoords.align === 'right'
                ? "left-0 -translate-x-full " + (isDarkMode ? "border-r-[#2C2724]/95" : "border-r-white/95")
                : "right-0 translate-x-full " + (isDarkMode ? "border-l-[#2C2724]/95" : "border-l-white/95")
            )} 
            style={{
              top: `calc(50% - ${auditAdjustY}px)`,
              transform: 'translateY(-50%)'
            }}
          />
        </div>
      </div>
    </>,
    document.body
  );
});

AuditLogTooltip.displayName = 'AuditLogTooltip';
