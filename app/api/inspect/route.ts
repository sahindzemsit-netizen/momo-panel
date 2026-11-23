import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({
    projectId: "momo-portal"
  });
}

const db = getFirestore("ai-studio-85d0332d-770c-4c04-ad43-68a8c3688e8c");

export async function GET(req: NextRequest) {
  try {
    const reservationsSnap = await db.collection("reservations").get();
    const reservations = reservationsSnap.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || "",
      status: doc.data().status || "",
      processedBy: doc.data().processedBy || "",
      cashflowHandledBy: doc.data().cashflowHandledBy || "",
      cashflowNotificationSent: doc.data().cashflowNotificationSent ?? null,
      totalPrice: doc.data().totalPrice ?? null,
      vehicleId: doc.data().vehicleId ?? null,
    }));

    const cashflowSnap = await db.collection("cashflow").get();
    const cashflow = cashflowSnap.docs.map(doc => ({
      id: doc.id,
      reservationId: doc.data().reservationId || "",
      name: doc.data().name || "",
      isPaid: doc.data().isPaid ?? null,
      totalPrice: doc.data().totalPrice ?? null,
    }));

    // Find any reservation ID where vehicle plate contains 2163
    const vehiclesSnap = await db.collection("vehicles").get();
    const vehicles = vehiclesSnap.docs.map(doc => ({
      id: doc.id,
      plate: doc.data().plate || "",
      name: doc.data().name || "",
    }));

    const missing = [];
    for (const r of reservations) {
      const isCashflowDocExists = cashflow.some(cf => String(cf.id) === String(r.id) || String(cf.reservationId) === String(r.id));
      const vehicle = vehicles.find(v => String(v.id) === String(r.vehicleId));
      if (!isCashflowDocExists) {
        missing.push({
          id: r.id,
          name: r.name,
          status: r.status,
          cashflowNotificationSent: r.cashflowNotificationSent,
          vehiclePlate: vehicle?.plate || "N/A",
          vehicleName: vehicle?.name || "N/A"
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalReservations: reservations.length,
      totalCashflow: cashflow.length,
      missing,
      cashflowSample: cashflow.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
