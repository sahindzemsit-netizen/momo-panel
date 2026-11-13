# Firestore Security Specification - Rental Momo

## Data Invariants
1. A reservation must reference a valid vehicle ID.
2. A reservation must have a start and end date, where start < end.
3. CreatedAt and UpdatedAt timestamps must be server-validated.
4. Vehicle IDs and Reservation IDs must be alphanumeric and length-restricted.

## The Dirty Dozen Payloads (Potential Attacks)
1. **Identity Spoofing**: Attempt to create a reservation with another user's ID as `processedBy`.
2. **State Shortcutting**: Attempt to update a reservation status from PENDING directly to COMPLETED without going through UPCOMING/ON RENT.
3. **Resource Poisoning**: Create a vehicle registration record with a 1MB string in the `plate` field.
4. **Invalid ID**: Attempt to create a registration with a 2KB string as the document ID.
5. **Timestamp Fraud**: Send a `createdAt` value from 1999.
6. **Negative Pricing**: Create a reservation with `totalPrice: -500`.
7. **Overlapping Identity**: Attempt to update `vehicleId` on an existing reservation.
8. **PII Leak**: Unauthorized read of all reservations to scrape client emails.
9. **Shadow Fields**: Add `isAdmin: true` to a reservation record.
10. **Zero-Day Delete**: Attempt to delete a COMPLETED reservation (should be archived/read-only).
11. **Type Confusion**: Send `days: "5"` (string instead of number).
12. **Orphaned Write**: Create a reservation for a vehicle that doesn't exist.

## The Test Runner (firestore.rules.test.ts)
```typescript
// Skeleton for testing (to be implemented if user requests full test suite)
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

// ... tests for the above payloads
```
