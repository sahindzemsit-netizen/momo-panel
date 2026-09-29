'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, ShieldAlert, Car, Eye, Layers, RotateCcw, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

export interface CarPartDefinition {
  id: string;
  name: string;
  view: 'top' | 'left' | 'right' | 'front' | 'rear';
  category: 'Front' | 'Rear' | 'Left Side' | 'Right Side' | 'Top/Glass';
}

export const CAR_PARTS: CarPartDefinition[] = [
  // Top View
  { id: 'top_front_bumper', name: 'Front Bumper (Top)', view: 'top', category: 'Front' },
  { id: 'top_hood', name: 'Engine Hood', view: 'top', category: 'Front' },
  { id: 'top_windshield', name: 'Front Windshield', view: 'top', category: 'Top/Glass' },
  { id: 'top_roof', name: 'Roof Panel', view: 'top', category: 'Top/Glass' },
  { id: 'top_rear_windshield', name: 'Rear Windshield', view: 'top', category: 'Top/Glass' },
  { id: 'top_trunk', name: 'Trunk / Boot', view: 'top', category: 'Rear' },
  { id: 'top_rear_bumper', name: 'Rear Bumper (Top)', view: 'top', category: 'Rear' },
  { id: 'top_mirror_left', name: 'Left Wing Mirror', view: 'top', category: 'Left Side' },
  { id: 'top_mirror_right', name: 'Right Wing Mirror', view: 'top', category: 'Right Side' },
  { id: 'top_fender_front_left', name: 'Front Left Fender', view: 'top', category: 'Left Side' },
  { id: 'top_fender_front_right', name: 'Front Right Fender', view: 'top', category: 'Right Side' },
  { id: 'top_doors_left', name: 'Left Doors Area', view: 'top', category: 'Left Side' },
  { id: 'top_doors_right', name: 'Right Doors Area', view: 'top', category: 'Right Side' },
  { id: 'top_quarter_rear_left', name: 'Rear Left Quarter', view: 'top', category: 'Left Side' },
  { id: 'top_quarter_rear_right', name: 'Rear Right Quarter', view: 'top', category: 'Right Side' },

  // Left Side View
  { id: 'side_l_front_bumper', name: 'Front Bumper (Left)', view: 'left', category: 'Front' },
  { id: 'side_l_front_fender', name: 'Front Left Fender', view: 'left', category: 'Left Side' },
  { id: 'side_l_wheel_front', name: 'Front Left Wheel / Rim', view: 'left', category: 'Left Side' },
  { id: 'side_l_mirror', name: 'Left Mirror Housing', view: 'left', category: 'Left Side' },
  { id: 'side_l_front_door', name: 'Front Left Door', view: 'left', category: 'Left Side' },
  { id: 'side_l_front_window', name: 'Front Left Window', view: 'left', category: 'Left Side' },
  { id: 'side_l_rear_door', name: 'Rear Left Door', view: 'left', category: 'Left Side' },
  { id: 'side_l_rear_window', name: 'Rear Left Window', view: 'left', category: 'Left Side' },
  { id: 'side_l_skirt', name: 'Left Rocker Panel / Skirt', view: 'left', category: 'Left Side' },
  { id: 'side_l_rear_quarter', name: 'Rear Left Quarter Panel', view: 'left', category: 'Left Side' },
  { id: 'side_l_wheel_rear', name: 'Rear Left Wheel / Rim', view: 'left', category: 'Left Side' },
  { id: 'side_l_rear_bumper', name: 'Rear Bumper (Left)', view: 'left', category: 'Rear' },

  // Right Side View
  { id: 'side_r_front_bumper', name: 'Front Bumper (Right)', view: 'right', category: 'Front' },
  { id: 'side_r_front_fender', name: 'Front Right Fender', view: 'right', category: 'Right Side' },
  { id: 'side_r_wheel_front', name: 'Front Right Wheel / Rim', view: 'right', category: 'Right Side' },
  { id: 'side_r_mirror', name: 'Right Mirror Housing', view: 'right', category: 'Right Side' },
  { id: 'side_r_front_door', name: 'Front Right Door', view: 'right', category: 'Right Side' },
  { id: 'side_r_front_window', name: 'Front Right Window', view: 'right', category: 'Right Side' },
  { id: 'side_r_rear_door', name: 'Rear Right Door', view: 'right', category: 'Right Side' },
  { id: 'side_r_rear_window', name: 'Rear Right Window', view: 'right', category: 'Right Side' },
  { id: 'side_r_skirt', name: 'Right Rocker Panel / Skirt', view: 'right', category: 'Right Side' },
  { id: 'side_r_rear_quarter', name: 'Rear Right Quarter Panel', view: 'right', category: 'Right Side' },
  { id: 'side_r_wheel_rear', name: 'Rear Right Wheel / Rim', view: 'right', category: 'Right Side' },
  { id: 'side_r_rear_bumper', name: 'Rear Bumper (Right)', view: 'right', category: 'Rear' },

  // Front View
  { id: 'front_hood_edge', name: 'Hood Front Edge', view: 'front', category: 'Front' },
  { id: 'front_windshield', name: 'Windshield (Front View)', view: 'front', category: 'Top/Glass' },
  { id: 'front_headlight_left', name: 'Left Headlight', view: 'front', category: 'Front' },
  { id: 'front_grille', name: 'Front Grille / Radiator', view: 'front', category: 'Front' },
  { id: 'front_headlight_right', name: 'Right Headlight', view: 'front', category: 'Front' },
  { id: 'front_bumper_main', name: 'Front Main Bumper', view: 'front', category: 'Front' },
  { id: 'front_lower_lip', name: 'Front Lower Lip / Spoiler', view: 'front', category: 'Front' },

  // Rear View
  { id: 'rear_windshield', name: 'Rear Glass (Rear View)', view: 'rear', category: 'Top/Glass' },
  { id: 'rear_trunk_door', name: 'Trunk Lid / Tailgate', view: 'rear', category: 'Rear' },
  { id: 'rear_taillight_left', name: 'Left Taillight', view: 'rear', category: 'Rear' },
  { id: 'rear_taillight_right', name: 'Right Taillight', view: 'rear', category: 'Rear' },
  { id: 'rear_bumper_main', name: 'Rear Main Bumper', view: 'rear', category: 'Rear' },
  { id: 'rear_diffuser', name: 'Rear Lower Diffuser / Exhaust', view: 'rear', category: 'Rear' },
];

export const getPartName = (id: string): string => {
  const found = CAR_PARTS.find(p => p.id === id);
  if (found) return found.name;
  // Format fallback
  return id
    .replace(/^(top|side_l|side_r|front|rear)_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

interface CarSkeletonPickerProps {
  selectedParts: string[];
  onChange?: (parts: string[]) => void;
  readOnly?: boolean;
  isDarkMode?: boolean;
  compact?: boolean;
  className?: string;
  isRepaired?: boolean;
}

export default function CarSkeletonPicker({
  selectedParts = [],
  onChange,
  readOnly = false,
  isDarkMode = false,
  compact = false,
  className,
  isRepaired = false
}: CarSkeletonPickerProps) {
  const [activeAngleTab, setActiveAngleTab] = useState<'all' | 'top' | 'sides' | 'front_rear'>('all');
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);

  const isSelected = (partId: string) => selectedParts.includes(partId);

  const togglePart = (partId: string) => {
    if (readOnly || !onChange) return;
    if (isSelected(partId)) {
      onChange(selectedParts.filter(p => p !== partId));
    } else {
      onChange([...selectedParts, partId]);
    }
  };

  const handleSelectGroup = (prefix: string) => {
    if (readOnly || !onChange) return;
    const groupParts = CAR_PARTS.filter(p => p.id.startsWith(prefix)).map(p => p.id);
    const allSelected = groupParts.every(id => selectedParts.includes(id));
    if (allSelected) {
      onChange(selectedParts.filter(id => !groupParts.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedParts, ...groupParts]));
      onChange(merged);
    }
  };

  const handleClearAll = () => {
    if (readOnly || !onChange) return;
    onChange([]);
  };

  const getFillColor = (partId: string) => {
    const selected = isSelected(partId);
    const hovered = hoveredPart === partId;
    if (selected) {
      return isRepaired ? '#10B981' : '#EF4444'; // Emerald green when repaired, crimson red for active damage
    }
    if (hovered && !readOnly) {
      return isRepaired
        ? (isDarkMode ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.25)')
        : (isDarkMode ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)');
    }
    return isDarkMode ? '#2A2726' : '#F1F3F5';
  };

  const getStrokeColor = (partId: string) => {
    const selected = isSelected(partId);
    const hovered = hoveredPart === partId;
    if (selected) {
      return isRepaired ? '#059669' : '#B91C1C'; // Emerald border when repaired, dark red for damage
    }
    if (hovered && !readOnly) {
      return isRepaired ? '#10B981' : '#EF4444';
    }
    return isDarkMode ? '#4A4644' : '#CBD5E1';
  };

  const getPartCursor = () => (readOnly ? 'default' : 'pointer');

  // SVG Renderers for each angle
  const renderTopView = () => (
    <div className="relative flex flex-col items-center">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1">
        <span>TOP VIEW</span>
      </div>
      <svg
        viewBox="0 0 240 400"
        className={cn("w-full max-w-[200px] h-auto drop-shadow-sm transition-all select-none", compact ? "max-w-[140px]" : "max-w-[200px]")}
      >
        {/* Car Silhouette Background Shadow */}
        <path
          d="M 60,70 C 60,35 75,10 120,10 C 165,10 180,35 180,70 L 185,150 C 190,190 190,260 185,320 L 180,360 C 175,390 155,395 120,395 C 85,395 65,390 60,360 L 55,320 C 50,260 50,190 55,150 Z"
          fill={isDarkMode ? "#1A1817" : "#E2E8F0"}
          stroke={isDarkMode ? "#333" : "#CBD5E1"}
          strokeWidth="2"
        />

        {/* Wheels (Top Outline) */}
        <rect x="38" y="65" width="14" height="42" rx="4" fill={isDarkMode ? "#111" : "#475569"} />
        <rect x="188" y="65" width="14" height="42" rx="4" fill={isDarkMode ? "#111" : "#475569"} />
        <rect x="38" y="295" width="14" height="42" rx="4" fill={isDarkMode ? "#111" : "#475569"} />
        <rect x="188" y="295" width="14" height="42" rx="4" fill={isDarkMode ? "#111" : "#475569"} />

        {/* Left Mirror */}
        <path
          id="part-top-mirror-l"
          d="M 44,120 C 35,120 30,126 30,134 C 30,142 38,146 48,142 L 56,134 Z"
          fill={getFillColor('top_mirror_left')}
          stroke={getStrokeColor('top_mirror_left')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_mirror_left')}
          onMouseEnter={() => setHoveredPart('top_mirror_left')}
          onMouseLeave={() => setHoveredPart(null)}
        />
        {/* Right Mirror */}
        <path
          id="part-top-mirror-r"
          d="M 196,120 C 205,120 210,126 210,134 C 210,142 202,146 192,142 L 184,134 Z"
          fill={getFillColor('top_mirror_right')}
          stroke={getStrokeColor('top_mirror_right')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_mirror_right')}
          onMouseEnter={() => setHoveredPart('top_mirror_right')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Front Bumper Top */}
        <path
          id="part-top-front-bumper"
          d="M 66,45 C 75,22 95,14 120,14 C 145,14 165,22 174,45 L 170,56 C 150,42 90,42 70,56 Z"
          fill={getFillColor('top_front_bumper')}
          stroke={getStrokeColor('top_front_bumper')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_front_bumper')}
          onMouseEnter={() => setHoveredPart('top_front_bumper')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Front Left Fender */}
        <path
          id="part-top-fender-fl"
          d="M 56,58 L 68,54 L 72,118 L 54,122 Z"
          fill={getFillColor('top_fender_front_left')}
          stroke={getStrokeColor('top_fender_front_left')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_fender_front_left')}
          onMouseEnter={() => setHoveredPart('top_fender_front_left')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Front Right Fender */}
        <path
          id="part-top-fender-fr"
          d="M 184,58 L 172,54 L 168,118 L 186,122 Z"
          fill={getFillColor('top_fender_front_right')}
          stroke={getStrokeColor('top_fender_front_right')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_fender_front_right')}
          onMouseEnter={() => setHoveredPart('top_fender_front_right')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Engine Hood */}
        <path
          id="part-top-hood"
          d="M 72,54 C 90,45 150,45 168,54 L 164,118 C 140,114 100,114 76,118 Z"
          fill={getFillColor('top_hood')}
          stroke={getStrokeColor('top_hood')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_hood')}
          onMouseEnter={() => setHoveredPart('top_hood')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Front Windshield */}
        <path
          id="part-top-windshield"
          d="M 74,122 C 95,118 145,118 166,122 L 160,172 C 140,168 100,168 80,172 Z"
          fill={getFillColor('top_windshield')}
          stroke={getStrokeColor('top_windshield')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_windshield')}
          onMouseEnter={() => setHoveredPart('top_windshield')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Roof */}
        <path
          id="part-top-roof"
          d="M 78,174 C 100,170 140,170 162,174 L 160,260 C 140,258 100,258 80,260 Z"
          fill={getFillColor('top_roof')}
          stroke={getStrokeColor('top_roof')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_roof')}
          onMouseEnter={() => setHoveredPart('top_roof')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Left Doors Outer Zone */}
        <path
          id="part-top-doors-l"
          d="M 54,124 L 72,124 L 76,260 L 52,260 Z"
          fill={getFillColor('top_doors_left')}
          stroke={getStrokeColor('top_doors_left')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_doors_left')}
          onMouseEnter={() => setHoveredPart('top_doors_left')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Right Doors Outer Zone */}
        <path
          id="part-top-doors-r"
          d="M 168,124 L 186,124 L 188,260 L 164,260 Z"
          fill={getFillColor('top_doors_right')}
          stroke={getStrokeColor('top_doors_right')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_doors_right')}
          onMouseEnter={() => setHoveredPart('top_doors_right')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Rear Windshield */}
        <path
          id="part-top-rear-windshield"
          d="M 80,262 C 100,260 140,260 160,262 L 166,306 C 145,308 95,308 74,306 Z"
          fill={getFillColor('top_rear_windshield')}
          stroke={getStrokeColor('top_rear_windshield')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_rear_windshield')}
          onMouseEnter={() => setHoveredPart('top_rear_windshield')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Rear Left Quarter */}
        <path
          id="part-top-quarter-rl"
          d="M 52,262 L 74,262 L 72,348 L 54,340 Z"
          fill={getFillColor('top_quarter_rear_left')}
          stroke={getStrokeColor('top_quarter_rear_left')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_quarter_rear_left')}
          onMouseEnter={() => setHoveredPart('top_quarter_rear_left')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Rear Right Quarter */}
        <path
          id="part-top-quarter-rr"
          d="M 166,262 L 188,262 L 186,340 L 168,348 Z"
          fill={getFillColor('top_quarter_rear_right')}
          stroke={getStrokeColor('top_quarter_rear_right')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_quarter_rear_right')}
          onMouseEnter={() => setHoveredPart('top_quarter_rear_right')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Trunk / Boot */}
        <path
          id="part-top-trunk"
          d="M 74,308 C 95,310 145,310 166,308 L 168,354 C 145,360 95,360 72,354 Z"
          fill={getFillColor('top_trunk')}
          stroke={getStrokeColor('top_trunk')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_trunk')}
          onMouseEnter={() => setHoveredPart('top_trunk')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Rear Bumper Top */}
        <path
          id="part-top-rear-bumper"
          d="M 68,356 C 90,364 150,364 172,356 L 176,375 C 160,388 80,388 64,375 Z"
          fill={getFillColor('top_rear_bumper')}
          stroke={getStrokeColor('top_rear_bumper')}
          strokeWidth="1.5"
          className="transition-colors duration-150"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('top_rear_bumper')}
          onMouseEnter={() => setHoveredPart('top_rear_bumper')}
          onMouseLeave={() => setHoveredPart(null)}
        />
      </svg>
    </div>
  );

  const renderSideView = (isLeft: boolean) => {
    const prefix = isLeft ? 'side_l_' : 'side_r_';
    const title = isLeft ? 'LEFT SIDE' : 'RIGHT SIDE';

    return (
      <div className="relative flex flex-col items-center">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1">
          <span>{title}</span>
        </div>
        <svg
          viewBox="0 0 460 160"
          className={cn("w-full max-w-[340px] h-auto drop-shadow-sm transition-all select-none", compact ? "max-w-[240px]" : "max-w-[340px]")}
        >
          {/* Wheels Background */}
          <g>
            <circle cx="105" cy="115" r="26" fill={getFillColor(`${prefix}wheel_front`)} stroke={getStrokeColor(`${prefix}wheel_front`)} strokeWidth="2" style={{ cursor: getPartCursor() }} onClick={() => togglePart(`${prefix}wheel_front`)} onMouseEnter={() => setHoveredPart(`${prefix}wheel_front`)} onMouseLeave={() => setHoveredPart(null)} />
            <circle cx="105" cy="115" r="14" fill={isDarkMode ? "#1A1817" : "#E2E8F0"} stroke={getStrokeColor(`${prefix}wheel_front`)} strokeWidth="1.5" />
            <circle cx="360" cy="115" r="26" fill={getFillColor(`${prefix}wheel_rear`)} stroke={getStrokeColor(`${prefix}wheel_rear`)} strokeWidth="2" style={{ cursor: getPartCursor() }} onClick={() => togglePart(`${prefix}wheel_rear`)} onMouseEnter={() => setHoveredPart(`${prefix}wheel_rear`)} onMouseLeave={() => setHoveredPart(null)} />
            <circle cx="360" cy="115" r="14" fill={isDarkMode ? "#1A1817" : "#E2E8F0"} stroke={getStrokeColor(`${prefix}wheel_rear`)} strokeWidth="1.5" />
          </g>

          {/* Front Bumper Side */}
          <path
            d="M 22,96 C 20,85 24,75 35,70 L 60,68 L 60,115 L 42,118 C 30,118 24,108 22,96 Z"
            fill={getFillColor(`${prefix}front_bumper`)}
            stroke={getStrokeColor(`${prefix}front_bumper`)}
            strokeWidth="1.5"
            style={{ cursor: getPartCursor() }}
            onClick={() => togglePart(`${prefix}front_bumper`)}
            onMouseEnter={() => setHoveredPart(`${prefix}front_bumper`)}
            onMouseLeave={() => setHoveredPart(null)}
          />

          {/* Front Fender Side */}
          <path
            d="M 60,68 L 145,64 L 140,115 L 132,115 C 132,98 80,98 80,115 L 60,115 Z"
            fill={getFillColor(`${prefix}front_fender`)}
            stroke={getStrokeColor(`${prefix}front_fender`)}
            strokeWidth="1.5"
            style={{ cursor: getPartCursor() }}
            onClick={() => togglePart(`${prefix}front_fender`)}
            onMouseEnter={() => setHoveredPart(`${prefix}front_fender`)}
            onMouseLeave={() => setHoveredPart(null)}
          />

          {/* Mirror Side */}
          <path
            d="M 148,50 C 138,50 134,56 136,62 C 138,66 145,68 152,66 L 156,58 Z"
            fill={getFillColor(`${prefix}mirror`)}
            stroke={getStrokeColor(`${prefix}mirror`)}
            strokeWidth="1.5"
            style={{ cursor: getPartCursor() }}
            onClick={() => togglePart(`${prefix}mirror`)}
            onMouseEnter={() => setHoveredPart(`${prefix}mirror`)}
            onMouseLeave={() => setHoveredPart(null)}
          />

          {/* Front Door Side */}
          <path
            d="M 147,64 L 235,64 L 235,115 L 142,115 Z"
            fill={getFillColor(`${prefix}front_door`)}
            stroke={getStrokeColor(`${prefix}front_door`)}
            strokeWidth="1.5"
            style={{ cursor: getPartCursor() }}
            onClick={() => togglePart(`${prefix}front_door`)}
            onMouseEnter={() => setHoveredPart(`${prefix}front_door`)}
            onMouseLeave={() => setHoveredPart(null)}
          />

          {/* Front Window Side */}
          <path
            d="M 152,60 L 195,28 L 235,28 L 235,60 Z"
            fill={getFillColor(`${prefix}front_window`)}
            stroke={getStrokeColor(`${prefix}front_window`)}
            strokeWidth="1.5"
            style={{ cursor: getPartCursor() }}
            onClick={() => togglePart(`${prefix}front_window`)}
            onMouseEnter={() => setHoveredPart(`${prefix}front_window`)}
            onMouseLeave={() => setHoveredPart(null)}
          />

          {/* Rear Door Side */}
          <path
            d="M 237,64 L 320,64 L 320,115 L 237,115 Z"
            fill={getFillColor(`${prefix}rear_door`)}
            stroke={getStrokeColor(`${prefix}rear_door`)}
            strokeWidth="1.5"
            style={{ cursor: getPartCursor() }}
            onClick={() => togglePart(`${prefix}rear_door`)}
            onMouseEnter={() => setHoveredPart(`${prefix}rear_door`)}
            onMouseLeave={() => setHoveredPart(null)}
          />

          {/* Rear Window Side */}
          <path
            d="M 237,28 L 285,28 L 316,60 L 237,60 Z"
            fill={getFillColor(`${prefix}rear_window`)}
            stroke={getStrokeColor(`${prefix}rear_window`)}
            strokeWidth="1.5"
            style={{ cursor: getPartCursor() }}
            onClick={() => togglePart(`${prefix}rear_window`)}
            onMouseEnter={() => setHoveredPart(`${prefix}rear_window`)}
            onMouseLeave={() => setHoveredPart(null)}
          />

          {/* Rocker Panel / Skirt */}
          <path
            d="M 134,116 L 334,116 L 334,124 L 134,124 Z"
            fill={getFillColor(`${prefix}skirt`)}
            stroke={getStrokeColor(`${prefix}skirt`)}
            strokeWidth="1.5"
            style={{ cursor: getPartCursor() }}
            onClick={() => togglePart(`${prefix}skirt`)}
            onMouseEnter={() => setHoveredPart(`${prefix}skirt`)}
            onMouseLeave={() => setHoveredPart(null)}
          />

          {/* Rear Quarter Panel */}
          <path
            d="M 322,64 L 380,64 L 415,75 L 415,115 L 388,115 C 388,98 335,98 335,115 L 322,115 Z"
            fill={getFillColor(`${prefix}rear_quarter`)}
            stroke={getStrokeColor(`${prefix}rear_quarter`)}
            strokeWidth="1.5"
            style={{ cursor: getPartCursor() }}
            onClick={() => togglePart(`${prefix}rear_quarter`)}
            onMouseEnter={() => setHoveredPart(`${prefix}rear_quarter`)}
            onMouseLeave={() => setHoveredPart(null)}
          />

          {/* Rear Bumper Side */}
          <path
            d="M 416,76 C 430,82 440,94 438,106 C 435,118 424,122 414,120 L 414,115 L 416,76 Z"
            fill={getFillColor(`${prefix}rear_bumper`)}
            stroke={getStrokeColor(`${prefix}rear_bumper`)}
            strokeWidth="1.5"
            style={{ cursor: getPartCursor() }}
            onClick={() => togglePart(`${prefix}rear_bumper`)}
            onMouseEnter={() => setHoveredPart(`${prefix}rear_bumper`)}
            onMouseLeave={() => setHoveredPart(null)}
          />
        </svg>
      </div>
    );
  };

  const renderFrontView = () => (
    <div className="relative flex flex-col items-center">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1">
        <span>FRONT VIEW</span>
      </div>
      <svg
        viewBox="0 0 240 180"
        className={cn("w-full max-w-[200px] h-auto drop-shadow-sm transition-all select-none", compact ? "max-w-[140px]" : "max-w-[200px]")}
      >
        {/* Roof & Windshield */}
        <path
          d="M 50,45 L 75,18 L 165,18 L 190,45 L 180,80 L 60,80 Z"
          fill={getFillColor('front_windshield')}
          stroke={getStrokeColor('front_windshield')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('front_windshield')}
          onMouseEnter={() => setHoveredPart('front_windshield')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Hood Edge */}
        <path
          d="M 45,82 C 80,78 160,78 195,82 L 192,100 C 160,96 80,96 48,100 Z"
          fill={getFillColor('front_hood_edge')}
          stroke={getStrokeColor('front_hood_edge')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('front_hood_edge')}
          onMouseEnter={() => setHoveredPart('front_hood_edge')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Left Headlight */}
        <path
          d="M 42,98 L 74,96 L 70,118 L 40,112 Z"
          fill={getFillColor('front_headlight_left')}
          stroke={getStrokeColor('front_headlight_left')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('front_headlight_left')}
          onMouseEnter={() => setHoveredPart('front_headlight_left')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Grille */}
        <path
          d="M 76,98 C 100,96 140,96 164,98 L 160,126 C 135,130 105,130 80,126 Z"
          fill={getFillColor('front_grille')}
          stroke={getStrokeColor('front_grille')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('front_grille')}
          onMouseEnter={() => setHoveredPart('front_grille')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Right Headlight */}
        <path
          d="M 166,96 L 198,98 L 200,112 L 170,118 Z"
          fill={getFillColor('front_headlight_right')}
          stroke={getStrokeColor('front_headlight_right')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('front_headlight_right')}
          onMouseEnter={() => setHoveredPart('front_headlight_right')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Main Bumper */}
        <path
          d="M 35,114 C 30,125 35,145 42,150 L 198,150 C 205,145 210,125 205,114 L 168,128 C 140,132 100,132 72,128 Z"
          fill={getFillColor('front_bumper_main')}
          stroke={getStrokeColor('front_bumper_main')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('front_bumper_main')}
          onMouseEnter={() => setHoveredPart('front_bumper_main')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Lower Spoiler / Lip */}
        <path
          d="M 45,152 L 195,152 L 188,165 L 52,165 Z"
          fill={getFillColor('front_lower_lip')}
          stroke={getStrokeColor('front_lower_lip')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('front_lower_lip')}
          onMouseEnter={() => setHoveredPart('front_lower_lip')}
          onMouseLeave={() => setHoveredPart(null)}
        />
      </svg>
    </div>
  );

  const renderRearView = () => (
    <div className="relative flex flex-col items-center">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1">
        <span>REAR VIEW</span>
      </div>
      <svg
        viewBox="0 0 240 180"
        className={cn("w-full max-w-[200px] h-auto drop-shadow-sm transition-all select-none", compact ? "max-w-[140px]" : "max-w-[200px]")}
      >
        {/* Rear Windshield */}
        <path
          d="M 52,45 L 75,18 L 165,18 L 188,45 L 180,82 L 60,82 Z"
          fill={getFillColor('rear_windshield')}
          stroke={getStrokeColor('rear_windshield')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('rear_windshield')}
          onMouseEnter={() => setHoveredPart('rear_windshield')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Trunk Tailgate Door */}
        <path
          d="M 64,84 L 176,84 L 170,122 L 70,122 Z"
          fill={getFillColor('rear_trunk_door')}
          stroke={getStrokeColor('rear_trunk_door')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('rear_trunk_door')}
          onMouseEnter={() => setHoveredPart('rear_trunk_door')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Left Taillight */}
        <path
          d="M 38,92 L 62,92 L 68,118 L 36,112 Z"
          fill={getFillColor('rear_taillight_left')}
          stroke={getStrokeColor('rear_taillight_left')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('rear_taillight_left')}
          onMouseEnter={() => setHoveredPart('rear_taillight_left')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Right Taillight */}
        <path
          d="M 178,92 L 202,92 L 204,112 L 172,118 Z"
          fill={getFillColor('rear_taillight_right')}
          stroke={getStrokeColor('rear_taillight_right')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('rear_taillight_right')}
          onMouseEnter={() => setHoveredPart('rear_taillight_right')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Rear Main Bumper */}
        <path
          d="M 32,114 C 28,126 32,146 40,150 L 200,150 C 208,146 212,126 208,114 L 174,124 L 66,124 Z"
          fill={getFillColor('rear_bumper_main')}
          stroke={getStrokeColor('rear_bumper_main')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('rear_bumper_main')}
          onMouseEnter={() => setHoveredPart('rear_bumper_main')}
          onMouseLeave={() => setHoveredPart(null)}
        />

        {/* Diffuser / Exhaust */}
        <path
          d="M 44,152 L 196,152 L 188,165 L 52,165 Z"
          fill={getFillColor('rear_diffuser')}
          stroke={getStrokeColor('rear_diffuser')}
          strokeWidth="1.5"
          style={{ cursor: getPartCursor() }}
          onClick={() => togglePart('rear_diffuser')}
          onMouseEnter={() => setHoveredPart('rear_diffuser')}
          onMouseLeave={() => setHoveredPart(null)}
        />
      </svg>
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* View Angle Tabs (Only in full interactive mode) */}
      {!compact && !readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setActiveAngleTab('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                activeAngleTab === 'all'
                  ? "bg-white dark:bg-[#2A2726] shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              All Angles
            </button>
            <button
              type="button"
              onClick={() => setActiveAngleTab('top')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                activeAngleTab === 'top'
                  ? "bg-white dark:bg-[#2A2726] shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Top View
            </button>
            <button
              type="button"
              onClick={() => setActiveAngleTab('sides')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                activeAngleTab === 'sides'
                  ? "bg-white dark:bg-[#2A2726] shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Sides
            </button>
            <button
              type="button"
              onClick={() => setActiveAngleTab('front_rear')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                activeAngleTab === 'front_rear'
                  ? "bg-white dark:bg-[#2A2726] shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Front & Rear
            </button>
          </div>

          {/* Quick Action Presets */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectGroup('top_front')}
              className="text-[11px] px-2.5 py-1 rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors font-medium"
            >
              + Front
            </button>
            <button
              type="button"
              onClick={() => handleSelectGroup('top_rear')}
              className="text-[11px] px-2.5 py-1 rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors font-medium"
            >
              + Rear
            </button>
            {selectedParts.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors font-bold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Skeletons Layout */}
      <div className={cn(
        "p-4 rounded-2xl border transition-colors",
        isDarkMode ? "bg-[#1E1B1A] border-white/5" : "bg-gray-50/70 border-gray-200/80"
      )}>
        {activeAngleTab === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center justify-items-center">
            {/* Top View */}
            <div className="flex justify-center w-full">
              {renderTopView()}
            </div>

            {/* Sides View */}
            <div className="flex flex-col gap-4 justify-center items-center w-full">
              {renderSideView(true)}
              {renderSideView(false)}
            </div>

            {/* Front & Rear View */}
            <div className="flex flex-col gap-4 justify-center items-center w-full">
              {renderFrontView()}
              {renderRearView()}
            </div>
          </div>
        )}

        {activeAngleTab === 'top' && (
          <div className="flex justify-center p-4">
            {renderTopView()}
          </div>
        )}

        {activeAngleTab === 'sides' && (
          <div className="flex flex-col md:flex-row gap-8 justify-center items-center p-4">
            {renderSideView(true)}
            {renderSideView(false)}
          </div>
        )}

        {activeAngleTab === 'front_rear' && (
          <div className="flex flex-col sm:flex-row gap-8 justify-center items-center p-4">
            {renderFrontView()}
            {renderRearView()}
          </div>
        )}
      </div>

      {/* Selected Parts Badges List */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-bold uppercase tracking-wider",
              isRepaired ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"
            )}>
              {isRepaired ? 'Repaired Vehicle Parts' : 'Marked Damaged Areas'} ({selectedParts.length})
            </span>
            {selectedParts.length > 0 && (
              <span className={cn(
                "w-2 h-2 rounded-full animate-ping",
                isRepaired ? "bg-emerald-500" : "bg-red-500"
              )} />
            )}
          </div>
          {!readOnly && (
            <span className="text-[11px] text-gray-400 italic">
              Click on any skeleton zone above to toggle damage
            </span>
          )}
        </div>

        {selectedParts.length === 0 ? (
          <div className={cn(
            "p-3 rounded-xl border border-dashed text-center text-xs transition-colors",
            isDarkMode ? "border-white/10 text-gray-500" : "border-gray-300 text-gray-400"
          )}>
            {isRepaired
              ? 'No repaired parts specified.'
              : 'No damaged parts marked yet. Click on the car skeleton to tag damaged zones in red.'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
            {selectedParts.map((partId) => (
              <span
                key={partId}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm transition-all",
                  isRepaired
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", isRepaired ? "bg-emerald-500" : "bg-red-500")} />
                {getPartName(partId)}
                {!readOnly && onChange && (
                  <button
                    type="button"
                    onClick={() => togglePart(partId)}
                    className={cn(
                      "ml-0.5 p-0.5 rounded-md transition-colors",
                      isRepaired ? "hover:bg-emerald-500/20 text-emerald-500" : "hover:bg-red-500/20 text-red-500"
                    )}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
