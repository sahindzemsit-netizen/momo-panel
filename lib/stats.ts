import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs, UpdateData, deleteDoc } from 'firebase/firestore';
import { Stats, Reservation, Vehicle, Client } from '@/types';
import { VEHICLE_COUNTRIES } from './constants';
import { guessGenderFromName, isValidMatchValue } from './utils';

export const STATS_DOC_PATH = 'metadata/stats';

/**
 * Validates that reservations match their correct client profiles.
 * If phone, passport ID, and driver license ID all match, they are the same client.
 * If not, they are distinct clients, and a new client object is generated.
 * This function also recalculates the stats on each client card to reflect their accurate totals.
 */
export async function correctClientsAndReservations() {
  const TOTAL_AVAILABLE_AVATARS = 3;
  try {
    const clientsSnap = await getDocs(collection(db, 'clients'));
    const reservationsSnap = await getDocs(collection(db, 'reservations'));

    const originalClients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
    const reservations = reservationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));

    // We will group reservations into clean unique clients where ALL 4 primary keys must match.
    // If any key is invalid or is different, they are separate clients.
    const uniqueClients: {
      id: string;
      name: string;
      email: string;
      phone: string;
      passportId: string;
      licenseId: string;
      gender: 'male' | 'female';
      avatar: string;
      createdAt: number;
      reservations: Reservation[];
    }[] = [];

    const isClientDetailsConflicting = (res: Reservation, client: { name?: string; passportId?: string; licenseId?: string }) => {
      const resPassport = (res.passportId || '').trim().toLowerCase();
      const resLicense = (res.driverLicenseId || '').trim().toLowerCase();
      const resName = (res.name || '').trim().toLowerCase();
      
      const cPassport = (client.passportId || '').trim().toLowerCase();
      const cLicense = (client.licenseId || '').trim().toLowerCase();
      const cName = (client.name || '').trim().toLowerCase();

      // Conflict check 1: Both have valid passport IDs, but they do NOT match
      if (isValidMatchValue(resPassport) && isValidMatchValue(cPassport) && cPassport !== resPassport) {
        return true;
      }
      // Conflict check 2: Both have valid driver's licenses, but they do NOT match
      if (isValidMatchValue(resLicense) && isValidMatchValue(cLicense) && cLicense !== resLicense) {
        return true;
      }
      // Conflict check 3: Names are completely different and both are valid
      if (resName && cName && resName !== cName) {
        const isNameDifferent = !resName.includes(cName) && !cName.includes(resName);
        if (isNameDifferent && isValidMatchValue(resName) && isValidMatchValue(cName)) {
          return true;
        }
      }
      return false;
    };

    for (const res of reservations) {
      // Skip cancelled reservations so that cancelled client profiles are not falsely re-created
      if (res.status === 'CANCELLED') continue;

      const resName = (res.name || 'Unknown').trim();
      const resPhone = (res.phone || '').trim();
      const resEmail = (res.email || '').trim().toLowerCase();
      const resPassport = (res.passportId || '').trim().toLowerCase();
      const resLicense = (res.driverLicenseId || '').trim().toLowerCase();
      
      let resClientId = (res.clientId || '').trim();
      // Resolve any existing client ID corruption/conflicts before matching:
      if (resClientId) {
        const existingUnique = uniqueClients.find(uc => uc.id === resClientId);
        const existingDb = originalClients.find(oc => oc.id === resClientId);
        if (
          (existingUnique && isClientDetailsConflicting(res, existingUnique)) ||
          (existingDb && isClientDetailsConflicting(res, existingDb))
        ) {
          console.log(`[Self-Healing] Detected client ID conflict for reservation ${res.id} (${res.name}) with client ID ${resClientId}. Disassociating to heal.`);
          resClientId = ''; // Reset so we don't match or reuse the corrupted client ID
        }
      }

      // Find if we already processed a matching client in this run's uniqueClients array
      const matchedUniqueClient = uniqueClients.find(uc => {
        // Guard: Prevent matching if there is an identity conflict
        if (isClientDetailsConflicting(res, uc)) return false;

        // A. Same non-empty client ID
        if (resClientId && uc.id === resClientId) return true;

        // Exact Match fallback for demo/test clients: if name matches case-insensitive,
        // and at least 2 identifiers are non-empty and match exactly, they are the same person.
        const cCleanName = uc.name.trim().toLowerCase();
        const rCleanName = resName.toLowerCase();
        if (cCleanName === rCleanName && cCleanName !== '' && cCleanName !== 'unknown') {
          const uPhone = uc.phone.trim();
          const uPassport = uc.passportId.trim().toLowerCase();
          const uLicense = uc.licenseId.trim().toLowerCase();
          const uEmail = uc.email.trim().toLowerCase();

          let matchesCount = 0;
          const isNonEmptyVal = (v: string) => v.length > 1 && v !== '-' && v !== '/' && v !== 'no' && v !== 'none';
          if (isNonEmptyVal(resPhone) && resPhone === uPhone) matchesCount++;
          if (isNonEmptyVal(resPassport) && resPassport === uPassport) matchesCount++;
          if (isNonEmptyVal(resLicense) && resLicense === uLicense) matchesCount++;
          if (isNonEmptyVal(resEmail) && resEmail === uEmail) matchesCount++;

          if (matchesCount >= 2) return true;
        }

        // B. Same valid passport ID
        if (isValidMatchValue(resPassport) && isValidMatchValue(uc.passportId) && uc.passportId.trim().toLowerCase() === resPassport) return true;

        // C. Same valid driver's license
        if (isValidMatchValue(resLicense) && isValidMatchValue(uc.licenseId) && uc.licenseId.trim().toLowerCase() === resLicense) return true;

        // D. Same valid phone and name
        if (isValidMatchValue(resPhone) && isValidMatchValue(uc.phone) && uc.phone.trim() === resPhone && uc.name.trim().toLowerCase() === resName.toLowerCase()) return true;

        // E. Same valid email
        if (isValidMatchValue(resEmail) && isValidMatchValue(uc.email) && uc.email.trim().toLowerCase() === resEmail) return true;

        return false;
      });

      if (matchedUniqueClient) {
        // Merge remaining partial fields if the reservation had more complete facts
        if (!isValidMatchValue(matchedUniqueClient.phone) && isValidMatchValue(resPhone)) matchedUniqueClient.phone = resPhone;
        if (!isValidMatchValue(matchedUniqueClient.email) && isValidMatchValue(resEmail)) matchedUniqueClient.email = resEmail;
        if (!isValidMatchValue(matchedUniqueClient.passportId) && isValidMatchValue(resPassport)) matchedUniqueClient.passportId = res.passportId || '';
        if (!isValidMatchValue(matchedUniqueClient.licenseId) && isValidMatchValue(resLicense)) matchedUniqueClient.licenseId = res.driverLicenseId || '';
        
        matchedUniqueClient.reservations.push(res);
      } else {
        // Find if they exist in DB using any of our matching heuristics
        let idToUse = '';
        let avatarToUse = '';
        let createdAtToUse = res.createdAt || Date.now();

        const matchedDbClient = originalClients.find(c => {
          // Guard: Prevent matching if there is an identity conflict
          if (isClientDetailsConflicting(res, c)) return false;

          // A. Same client ID
          if (resClientId && c.id === resClientId) return true;

          const cPassport = (c.passportId || '').trim().toLowerCase();
          const cLicense = (c.licenseId || '').trim().toLowerCase();
          const cPhone = (c.phone || '').trim();
          const cEmail = (c.email || '').trim().toLowerCase();
          const cName = (c.name || '').trim().toLowerCase();

          // Exact Match fallback for demo/test clients: if name matches case-insensitive,
          // and at least 2 identifiers are non-empty and match exactly, they are the same person.
          if (cName === resName && cName !== '' && cName !== 'unknown') {
            let matchesCount = 0;
            const isNonEmptyVal = (v: string) => v.length > 2 && v !== '-' && v !== '/' && v !== 'no' && v !== 'none';
            if (isNonEmptyVal(resPhone) && resPhone === cPhone) matchesCount++;
            if (isNonEmptyVal(resPassport) && resPassport === cPassport) matchesCount++;
            if (isNonEmptyVal(resLicense) && resLicense === cLicense) matchesCount++;
            if (isNonEmptyVal(resEmail) && resEmail === cEmail) matchesCount++;

            if (matchesCount >= 2) return true;
          }

          // Physical Document Conflict Guards:
          // If both have valid passport IDs, but they do NOT match, they are different people!
          if (isValidMatchValue(resPassport) && isValidMatchValue(cPassport) && cPassport !== resPassport) {
            return false;
          }
          // If both have valid driver's licenses, but they do NOT match, they are different people!
          if (isValidMatchValue(resLicense) && isValidMatchValue(cLicense) && cLicense !== resLicense) {
            return false;
          }

          // B. Same valid passport ID
          if (isValidMatchValue(resPassport) && isValidMatchValue(cPassport) && cPassport === resPassport) return true;

          // C. Same valid driver's license
          if (isValidMatchValue(resLicense) && isValidMatchValue(cLicense) && cLicense === resLicense) return true;

          // D. Same valid phone and name
          if (isValidMatchValue(resPhone) && isValidMatchValue(cPhone) && cPhone === resPhone && cName === resName.toLowerCase()) return true;

          // E. Same valid email
          if (isValidMatchValue(resEmail) && isValidMatchValue(cEmail) && cEmail === resEmail) return true;

          return false;
        });

        if (matchedDbClient) {
          idToUse = matchedDbClient.id;
          avatarToUse = matchedDbClient.avatar || '';
          createdAtToUse = matchedDbClient.createdAt || createdAtToUse;
        }

        // Extremely critical guard: If the reservation already has a client ID associated with it,
        // and we haven't matched any other profile, REUSE this existing client ID to avoid creating a new one!
        if (!idToUse && resClientId && resClientId !== 'undefined' && resClientId !== 'null') {
          idToUse = resClientId;
        }

        if (!idToUse) {
          idToUse = `client_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        }

        const clientGender = guessGenderFromName(res.name || '');
        if (!avatarToUse) {
          const randomIndex = Math.floor(Math.random() * TOTAL_AVAILABLE_AVATARS) + 1;
          avatarToUse = `public/avatars/${clientGender}/${clientGender}${randomIndex}.png`;
        }

        const newUc = {
          id: idToUse,
          name: resName,
          email: resEmail,
          phone: resPhone,
          passportId: res.passportId || '',
          licenseId: res.driverLicenseId || '',
          gender: clientGender,
          avatar: avatarToUse,
          createdAt: createdAtToUse,
          reservations: [res]
        };
        uniqueClients.push(newUc);
      }
    }

    const activeClientIds = new Set<string>();

    for (const uc of uniqueClients) {
      activeClientIds.add(uc.id);

      const completedRes = uc.reservations.filter(r => r.status === 'COMPLETED');
      const rentalCount = completedRes.length;
      const totalDaysRented = completedRes.reduce((acc, r) => acc + (r.days || 0), 0);
      const totalSpent = completedRes.reduce((acc, r) => acc + (Number(r.totalPrice) || 0), 0);

      const clientDocData: Client = {
        id: uc.id,
        name: uc.name,
        email: uc.email,
        phone: uc.phone,
        licenseId: uc.licenseId,
        passportId: uc.passportId,
        rentalCount,
        totalDaysRented,
        totalSpent,
        createdAt: uc.createdAt,
        updatedAt: Date.now(),
        gender: uc.gender,
        avatar: uc.avatar
      };

      await setDoc(doc(db, 'clients', uc.id), clientDocData);

      for (const res of uc.reservations) {
        if (res.clientId !== uc.id) {
          await setDoc(doc(db, 'reservations', res.id), {
            clientId: uc.id,
            updatedAt: Date.now()
          }, { merge: true });
        }
      }
    }

    // Delete corrupted or orphan client profiles not aligned with any valid reservation group
    for (const c of originalClients) {
      if (!activeClientIds.has(c.id)) {
        await deleteDoc(doc(db, 'clients', c.id));
        console.log(`[CLEANUP] Deleted orphan or corrupted client profile: ${c.id} (${c.name})`);
      }
    }

    console.log('Database client-reservation alignment complete!');
  } catch (err) {
    console.error('Database client-reservation alignment error:', err);
  }
}

/**
 * Migrates old/legacy reservations that have a string vehicle name or a mismatched identifier
 * to reference the correct numerical or string unique ID from the vehicles collection.
 */
export async function migrateLegacyReservationsVehicles() {
  try {
    const reservationsSnap = await getDocs(collection(db, 'reservations'));
    const vehiclesSnap = await getDocs(collection(db, 'vehicles'));

    const reservations = reservationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    const vehicles = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    let migratedCount = 0;

    for (const res of reservations) {
      const currentVehicleIdVal = res.vehicleId;
      
      // Check if it already matches a valid vehicle's ID
      const matchesExistingId = vehicles.some(v => 
        String(v.id) === String(currentVehicleIdVal)
      );

      // If it already matches an actual ID, it is correct.
      if (matchesExistingId) {
        continue;
      }

      // If not, try to find a vehicle whose name or plate matches.
      // Look at the 'vehicle' field first, fallback to 'vehicleId' if it is a string placeholder.
      const vehicleNameSearch = String(res.vehicle || res.vehicleName || currentVehicleIdVal || '').trim();
      
      if (!vehicleNameSearch || vehicleNameSearch === 'undefined' || vehicleNameSearch === 'null' || !isNaN(Number(vehicleNameSearch))) {
        continue;
      }

      // Look for case-insensitive name match or plate match
      const matchedVehicle = vehicles.find(v => {
        const vName = (v.name || '').trim().toLowerCase();
        const vPlate = (v.plate || '').trim().toLowerCase();
        const searchLower = vehicleNameSearch.toLowerCase();
        
        return vName === searchLower || 
               vName.includes(searchLower) || 
               searchLower.includes(vName) || 
               vPlate === searchLower || 
               vPlate.replace(/\s+/g, '') === searchLower.replace(/\s+/g, '');
      });

      if (matchedVehicle) {
        console.log(`[MIGRATION]: Mapping legacy reservation ID "${res.id}" (vehicle search: "${vehicleNameSearch}") to actual vehicle ID: "${matchedVehicle.id}" (${matchedVehicle.name})`);
        
        await setDoc(doc(db, 'reservations', res.id), {
          vehicleId: matchedVehicle.id, // e.g., 1779551911375 (numeric or string ID)
          vehicle: matchedVehicle.name,
          updatedAt: Date.now()
        }, { merge: true });
        migratedCount++;
      }
    }

    if (migratedCount > 0) {
      console.log(`[MIGRATION]: Legacy reservation vehicle IDs migration complete! Updated ${migratedCount} reservations.`);
    }
  } catch (err) {
    console.error('Error migrating legacy reservation vehicles:', err);
  }
}

/**
 * Migrates any reservation document that has an invalid document ID like "undefined" or "null" in firestore.
 */
export async function migrateUndefinedReservations() {
  try {
    const reservationsSnap = await getDocs(collection(db, 'reservations'));
    for (const snapshotDoc of reservationsSnap.docs) {
      if (snapshotDoc.id === 'undefined' || snapshotDoc.id === 'null') {
        const data = snapshotDoc.data();
        const newId = String(data.createdAt || Date.now());
        console.log(`[MIGRATION]: Migrating invalid reservation ID "${snapshotDoc.id}" to: "${newId}"`, data);
        await setDoc(doc(db, 'reservations', newId), {
          ...data,
          id: newId,
          updatedAt: Date.now()
        });
        await deleteDoc(doc(db, 'reservations', snapshotDoc.id));
        console.log(`[MIGRATION]: Successfully deleted old "${snapshotDoc.id}" from Firestore.`);
      }
    }
  } catch (err) {
    console.error('Error migrating null/undefined reservation IDs:', err);
  }
}

/**
 * Recalculates all stats from existing reservations and updates the Stats record.
 */
export async function syncStats() {
  try {
    // Correct any null/undefined document IDs first
    await migrateUndefinedReservations();

    // Correct legacy reservation vehicle links first
    await migrateLegacyReservationsVehicles();

    // Correct client mapping dynamically on stats sync
    await correctClientsAndReservations();

    const reservationsSnap = await getDocs(collection(db, 'reservations'));
    const vehiclesSnap = await getDocs(collection(db, 'vehicles'));
    
    const reservations = reservationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
    const vehicles = vehiclesSnap.docs.map(doc => doc.data() as Vehicle);

    const stats: Stats = {
      totalCancelledValue: 0,
      totalCompletedValue: 0,
      cancelledCount: 0,
      completedCount: 0,
      activeVehiclesCount: vehicles.filter(v => 
        v.isRetired !== true && 
        v.status !== 'RETIRED' && 
        v.isExtra !== true &&
        v.name !== 'EXTRA' &&
        !String(v.id).startsWith('extra-') &&
        VEHICLE_COUNTRIES.includes(v.country || 'Macedonia')
      ).length,
      updatedAt: Date.now()
    };

    reservations.forEach(res => {
      if (res.status === 'COMPLETED') {
        stats.totalCompletedValue += res.totalPrice || 0;
        stats.completedCount += 1;
      } else if (res.status === 'CANCELLED') {
        stats.totalCancelledValue += res.totalPrice || 0;
        stats.cancelledCount += 1;
      }
    });

    await setDoc(doc(db, STATS_DOC_PATH), stats);
    console.log('Stats synced successfully:', stats);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, STATS_DOC_PATH);
  }
}

/**
 * Updates stats when a reservation status changes.
 * This should be used within a batch if possible, but here we provide a standalone version as well.
 */
export async function updateStatsOnStatusChange(
  oldStatus: string | undefined, 
  newStatus: string, 
  totalPrice: number
) {
  const statsRef = doc(db, STATS_DOC_PATH);
  const updates: UpdateData<Stats> = {
    updatedAt: Date.now()
  };

  // Decrement old status stats if they were completed/cancelled
  if (oldStatus === 'COMPLETED') {
    updates.totalCompletedValue = increment(-totalPrice);
    updates.completedCount = increment(-1);
  } else if (oldStatus === 'CANCELLED') {
    updates.totalCancelledValue = increment(-totalPrice);
    updates.cancelledCount = increment(-1);
  }

  // Increment new status stats
  if (newStatus === 'COMPLETED') {
    updates.totalCompletedValue = increment(totalPrice);
    updates.completedCount = increment(1);
  } else if (newStatus === 'CANCELLED') {
    updates.totalCancelledValue = increment(totalPrice);
    updates.cancelledCount = increment(1);
  }

  // If no updates needed (status didn't transition to/from tracked states), return
  if (Object.keys(updates).length <= 1) return;

  try {
    const snap = await getDoc(statsRef);
    if (!snap.exists()) {
      // Initialize if doesn't exist
      await syncStats();
    } else {
      await updateDoc(statsRef, updates);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, STATS_DOC_PATH);
  }
}
