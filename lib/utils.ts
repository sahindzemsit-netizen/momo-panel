import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseDateSafe(dateVal: any): Date {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date || (typeof dateVal === 'object' && typeof dateVal.getTime === 'function')) {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal.getTime());
    if (isNaN(d.getTime())) return new Date();
    return d;
  }
  // Check if it's a Firestore Timestamp or has toDate()
  if (typeof dateVal?.toDate === 'function') {
    return dateVal.toDate();
  }
  // Check if it's a raw Firestore Timestamp representation with seconds
  if (typeof dateVal?.seconds === 'number') {
    return new Date(dateVal.seconds * 1000);
  }
  // If it's a number (timestamp)
  if (typeof dateVal === 'number') {
    return new Date(dateVal);
  }
  // If it's a string
  if (typeof dateVal === 'string') {
    const cleanVal = dateVal.trim();
    // If format is like "DD/MM/YYYY" which JS new Date() doesn't parse correctly, convert it
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanVal)) {
      const [day, month, year] = cleanVal.split('/');
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
    const parsed = new Date(cleanVal);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

const COUNTRY_CODES: Record<string, string> = {
  'Macedonia': '389',
  'Kosovo': '383',
  'Bosnia': '387',
  'Albania': '355',
  'Montenegro': '382',
  'Turkey': '90',
};

export const cleanPhoneNumber = (phone: string, country?: string) => {
  // First, handle numbers starting with '+' by preserving everything after it
  // and removing non-digits. Most international numbers are entered this way.
  let cleaned = phone.trim();
  
  // If it starts with 00, it's usually an international prefix, replace with '+'
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  
  // Now remove everything except digits
  const digitsOnly = cleaned.replace(/\D/g, '');
  
  // If the original (potentially trimmed) string started with '0' (but not '00')
  // we assume it's a local number and prepend the country code
  if (cleaned.startsWith('0') && !cleaned.startsWith('00')) {
    const code = (country && COUNTRY_CODES[country]) || '389'; // Default to Macedonia
    return code + digitsOnly.substring(1);
  }
  
  return digitsOnly;
};

export const formatWhatsAppLink = (phone: string, country?: string) => {
  const cleaned = cleanPhoneNumber(phone, country);
  // Using api.whatsapp.com instead of wa.me as it often handles the transition to Web more explicitly
  // or web.whatsapp.com if the user specifically wants the web version.
  return `https://web.whatsapp.com/send?phone=${cleaned}`;
};

export function guessGenderFromName(name: string): 'male' | 'female' {
  const cleanName = (name || '').toLowerCase().trim();
  
  // Create a version of the name without Turkish characters for accent-insensitive matching
  const normalizedName = cleanName
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o');
  
  // Female keywords that can appear anywhere in the name (main or secondary name)
  const femaleKeywords = [
    // Turkish explicit female
    'emine', 'fatma', 'ayse', 'zehra', 'hatice', 'zeynep', 'meryem', 'selin', 'gizem', 
    'elif', 'canan', 'esra', 'merve', 'hacer', 'yasemin', 'gamze', 'asli', 'ipek', 
    'sevgi', 'melek', 'busra', 'kubra', 'rabia', 'havva', 'sultan', 'filiz', 'demet', 
    'ozlem', 'ebru', 'didem', 'sinem', 'ceren', 'pinar', 'tugba', 'tuba', 'seda', 
    'nihal', 'bahar', 'selma', 'leyla', 'gul', 'gulay', 'gulsen', 'neriman', 
    'fatime', 'sibel', 'hande', 'aslihan', 'melis', 'melisa', 'damla', 'banu', 
    'basak', 'bengu', 'berna', 'burcu', 'cemre', 'deniz', 'derya', 'dilara', 
    'duygu', 'ece', 'eda', 'elvan', 'fidan', 'gaye', 'gonca', 'gozde', 'guler', 
    'gulnur', 'hale', 'harika', 'hulya', 'ilknur', 'irem', 'jale', 'kader', 
    'mine', 'mualla', 'mujde', 'nesrin', 'nigar', 'nihan', 'nilgun', 'nur', 
    'nuran', 'nuray', 'nurgul', 'perihan', 'reyhan', 'ruya', 'saniye', 'secil', 
    'sema', 'semra', 'senay', 'serpil', 'sevap', 'sevda', 'sevil', 'sevinc', 
    'seval', 'songul', 'suzan', 'tulin', 'umran', 'vildan', 'yaprak', 'yeliz', 
    'yesim', 'yonca', 'yurdanur', 'zahide', 'zelha', 'zuhal', 'zumrut',
    // Albanian explicit female
    'teuta', 'nera', 'fjolla', 'dafina', 'shpresa', 'luljeta', 'arta', 'besa', 
    'valbona', 'gentiana', 'blerta', 'donika', 'mimoza', 'shqipe', 'linda', 
    'sarah', 'elira', 'bora'
  ];
  
  // Specific Turkish/Albanian male names that might trigger other rules
  // For instance, "Bora" ends in 'a' but is male.
  const maleKeywords = [
    'mustafa', 'ahmet', 'mehmet', 'burak', 'adnan', 'selim', 'driton', 'bekim', 
    'agim', 'enver', 'faton', 'valon', 'atilla', 'taha', 'talha', 'bugra', 
    'emir', 'can', 'cem', 'emre', 'efe', 'mete', 'arda', 'bora', 'hakan', 
    'osman', 'ali', 'hasan', 'huseyin', 'omer', 'bekir', 'suleyman', 'ibrahim', 
    'halil', 'yusuf', 'murat', 'gokhan', 'fatih', 'serkan', 'kemal', 'sinan', 
    'yasin', 'ramazan', 'saban', 'recep', 'oguz', 'onur', 'volkan', 'erkan', 
    'ayhan', 'orhan', 'kenan', 'selcuk', 'bulent', 'tarik', 'umut', 'baris', 
    'caner', 'berk', 'karem', 'kerem', 'mert', 'yigit', 'tolga', 'ufuk', 
    'taner', 'cengiz', 'zafer', 'levent', 'kemal', 'koray', 'kadir', 'goksel', 
    'cetın', 'cetin', 'yavuz', 'nihat', 'numan', 'cihat', 'musa', 'isa', 'yahya'
  ];

  // 1. Check highly strong explicit male names first (e.g. Bora, Arda ending in a)
  if (maleKeywords.some(keyword => normalizedName.includes(keyword))) {
    return 'male';
  }

  // 2. Then check high confidence female keywords
  if (femaleKeywords.some(keyword => {
    return normalizedName.includes(keyword) || cleanName.includes(keyword);
  })) {
    return 'female';
  }

  // 3. Heuristics for first name endings
  const firstName = normalizedName.split(' ')[0];

  // Ending in 'a' is traditionally female (highly common in Albanian and generic names)
  if (firstName.endsWith('a') || firstName.endsWith('ia')) {
    return 'female';
  }
  
  // Turkish/Albanian names ending in 'e' are often female (Ayşe, Emine, Luljeta, Hatice, etc.)
  if (firstName.endsWith('e')) {
    return 'female';
  }

  return 'male'; // Default heuristic fallback
}

export function isValidMatchValue(val: string | null | undefined): boolean {
  if (!val) return false;
  const s = String(val).trim();
  const lower = s.toLowerCase();
  
  // Clean alphanumeric
  const clean = s.replace(/[^a-zA-Z0-9]/g, '').trim();
  if (clean.length < 2) return false;
  
  // Basic placeholders list
  const placeholders = [
    'none', 'null', 'undefined', 'not available', 'n/a', 'na', 
    'no', 'yes', 'unknown', 'placeholder', 'test', 'temp', 'dummy', 
    '/', '//', '///', '-', '--', '---'
  ];
  if (placeholders.includes(lower)) return false;

  // Pattern matches for common placeholders or generic defaults
  if (
    lower.includes('nomail') ||
    lower.includes('noemail') ||
    lower.includes('no-email') ||
    lower.includes('no_email') ||
    lower.includes('momo.mk') ||
    lower.includes('example.com') ||
    lower.includes('test@') ||
    lower.includes('dummy@') ||
    lower.includes('temp@') ||
    lower.includes('placeholder') ||
    lower.includes('unknown')
  ) {
    return false;
  }

  // Handle phone placeholders like all zeros, all ones, consecutive digits
  if (/^[0-9]+$/.test(clean)) {
    // If it's a phone-like number, filter out obviously fake ones
    // Check if it's all same digits (e.g. 000000, 9999999)
    const allSameDigits = clean.split('').every(char => char === clean[0]);
    if (allSameDigits && clean.length > 2) return false;
    
    // Simple sequence like 123456
    if (clean === '123456' || clean === '1234567' || clean === '12345678' || clean === '123456789') {
      return false;
    }
  }
  
  return true;
}
