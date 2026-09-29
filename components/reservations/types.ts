import { Reservation, Vehicle } from '@/types';

export interface CalendarDay {
  day: number;
  weekday: string;
  isToday: boolean;
  isPast: boolean;
  daysFromToday: number;
  date: Date;
  midnightMs: number;
  isNextMonth?: boolean;
}

export interface DayBooking {
  id: string;
  client: string;
  startDate: Date;
  endDate: Date;
  startMs?: number;
  endMs?: number;
  status: string;
  color: string;
  totalPrice?: number | string;
  arrivalTime?: string;
  departureTime?: string;
}

export interface CarBooking {
  carId: number;
  reservations: DayBooking[];
}

export const BIRTHSTONE_COLORS: Record<number, { name: string; rgb: [number, number, number] }> = {
  0: { name: 'January', rgb: [139, 0, 0] },         // Dark Red
  1: { name: 'February', rgb: [138, 43, 226] },     // Purple / Violet
  2: { name: 'March', rgb: [127, 255, 212] },        // Aquamarine / Light Blue
  3: { name: 'April', rgb: [226, 232, 240] },        // Clear / Diamond White
  4: { name: 'May', rgb: [16, 185, 129] },          // Emerald Green
  5: { name: 'June', rgb: [244, 114, 182] },         // Light Pink / Pearl White
  6: { name: 'July', rgb: [225, 29, 72] },          // Vibrant Red
  7: { name: 'August', rgb: [163, 230, 53] },        // Pale Green / Peridot
  8: { name: 'September', rgb: [30, 58, 138] },      // Deep Sapphire Blue
  9: { name: 'October', rgb: [219, 39, 119] },       // Rose Pink / Opal
  10: { name: 'November', rgb: [217, 119, 6] },      // Golden Yellow / Topaz
  11: { name: 'December', rgb: [13, 148, 136] }      // Turquoise / Blue-Topaz
};

export const getTextColorForBg = (bgColor?: string): string => {
  if (!bgColor) return '#FFFFFF';
  const cleanHex = bgColor.replace('#', '').toUpperCase();
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const yiq = ((r * 200) + (g * 500) + (b * 100)) / 800;
    return yiq >= 150 ? '#0E0C0B' : '#FFFFFF';
  }
  if (cleanHex === 'FFF' || cleanHex === 'FFFFFF' || cleanHex === 'WHITE' || bgColor.toLowerCase() === 'white') {
    return '#0E0C0B';
  }
  return '#FFFFFF';
};

export const globalGetDestinationCountry = (toLocation: string | undefined): 'Macedonia' | 'Kosovo' | 'Bosnia' | 'Albania' | 'Montenegro' | 'Serbia' | 'Greece' | undefined => {
  if (!toLocation) return undefined;
  const loc = toLocation.trim().toUpperCase();
  if (loc.includes('SKOPJE') || loc.includes('OHRID') || loc.includes('MACEDONIA') || loc === 'MK' || loc === 'MKD') return 'Macedonia';
  if (loc.includes('PRISTINA') || loc.includes('PRIZREN') || loc.includes('KOSOVO') || loc === 'RKS' || loc === 'KS') return 'Kosovo';
  if (loc.includes('TIRANA') || loc.includes('ALBANIA') || loc === 'AL' || loc === 'ALB') return 'Albania';
  if (loc.includes('PODGORICA') || loc.includes('MONTENEGRO') || loc === 'MNE' || loc === 'ME') return 'Montenegro';
  if (loc.includes('SARAJEVO') || loc.includes('BOSNIA') || loc === 'BIH' || loc === 'BA') return 'Bosnia';
  if (loc.includes('ATHENS') || loc.includes('THESSALONIKI') || loc.includes('GREECE') || loc === 'GR' || loc === 'GRC' || loc === 'EUROPE') return 'Greece';
  
  if (loc === 'MACEDONIA') return 'Macedonia';
  if (loc === 'KOSOVO') return 'Kosovo';
  if (loc === 'ALBANIA') return 'Albania';
  if (loc === 'BOSNIA') return 'Bosnia';
  if (loc === 'MONTENEGRO') return 'Montenegro';
  if (loc === 'SERBIA') return 'Serbia';
  if (loc === 'EUROPE' || loc === 'GREECE') return 'Greece';
  return undefined;
};
