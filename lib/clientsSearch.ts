import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Client } from '@/types';

// In-memory cache for full clients list if fetched standalone
let fullClientsCache: { data: Client[]; timestamp: number } | null = null;

export async function fetchFullClients(): Promise<Client[]> {
  const now = Date.now();
  if (fullClientsCache && (now - fullClientsCache.timestamp < 120000) && fullClientsCache.data.length > 0) {
    return fullClientsCache.data;
  }

  try {
    const snap = await getDocs(collection(db, 'clients'));
    const list: Client[] = [];
    snap.forEach(d => {
      if (d.id !== 'undefined' && d.id !== 'null') {
        const data = d.data();
        list.push({
          id: d.id,
          ...data,
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0
        } as Client);
      }
    });

    list.sort((a, b) => {
      const timeA = typeof a.createdAt === 'number' ? a.createdAt : 0;
      const timeB = typeof b.createdAt === 'number' ? b.createdAt : 0;
      if (timeA !== timeB && timeA > 0 && timeB > 0) {
        return timeB - timeA;
      }
      return String(b.id).localeCompare(String(a.id));
    });

    fullClientsCache = { data: list, timestamp: now };
    return list;
  } catch (err) {
    console.error('Error fetching full clients for search:', err);
    return fullClientsCache?.data || [];
  }
}

export function invalidateClientsCache() {
  fullClientsCache = null;
}

/**
 * Instant, synchronous in-memory search across the background client database (< 1ms).
 * No network delays, no waiting, keystroke-by-keystroke responsiveness.
 */
export function searchClientsInMemory(
  rawTerm: string,
  sourceList: Client[]
): Client[] {
  const trimmed = rawTerm.trim().toLowerCase();
  if (!trimmed) return [];

  const cleanTerm = trimmed.replace(/[\s\-_.]+/g, '');

  return sourceList.filter(client => {
    const name = (client.name || '').toLowerCase();
    const email = (client.email || '').toLowerCase();
    const phone = (client.phone || '').toLowerCase();
    const cleanPhone = phone.replace(/[\s\-_.]+/g, '');
    const licenseId = (client.licenseId || (client as any).driverLicenseId || '').toLowerCase();
    const passportId = (client.passportId || '').toLowerCase();

    return (
      name.includes(trimmed) ||
      email.includes(trimmed) ||
      phone.includes(trimmed) ||
      (cleanTerm.length >= 2 && cleanPhone.includes(cleanTerm)) ||
      licenseId.includes(trimmed) ||
      passportId.includes(trimmed)
    );
  });
}

/**
 * Async search that uses local cache first, falling back to standalone fetch
 */
export async function runClientsSearch(
  rawTerm: string,
  liveClients: Client[] = []
): Promise<Client[]> {
  const trimmed = rawTerm.trim().toLowerCase();
  if (!trimmed) return [];

  if (liveClients && liveClients.length > 50) {
    return searchClientsInMemory(rawTerm, liveClients);
  }

  const allClients = await fetchFullClients();
  const map = new Map<string, Client>();
  allClients.forEach(c => map.set(c.id, c));
  liveClients.forEach(c => map.set(c.id, c));
  const combined = Array.from(map.values());

  return searchClientsInMemory(rawTerm, combined);
}
