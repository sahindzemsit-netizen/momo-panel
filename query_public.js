const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const config = require("./firebase-applet-config.json");

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  let reservations = [];
  try {
    console.log("Fetching all reservations...");
    const rSnap = await getDocs(collection(db, "reservations"));
    rSnap.forEach(doc => {
      reservations.push({ id: doc.id, ...doc.data() });
    });
    console.log(`Successfully fetched ${reservations.length} reservations.`);
  } catch (err) {
    console.error("Error fetching reservations:", err.message);
  }

  let clients = [];
  try {
    console.log("Fetching all clients...");
    const cSnap = await getDocs(collection(db, "clients"));
    cSnap.forEach(doc => {
      clients.push({ id: doc.id, ...doc.data() });
    });
    console.log(`Successfully fetched ${clients.length} clients.`);
  } catch (err) {
    console.error("Error fetching clients:", err.message);
  }

  console.log("\n=== RESERVATIONS WITH 'MENGÜ' OR 'KÖKÇÜ' ===");
  const matchingRes = reservations.filter(r => {
    const name = (r.name || "").toUpperCase();
    const email = (r.email || "").toUpperCase();
    return name.includes("MENGÜ") || name.includes("MENGU") || name.includes("KÖKÇÜ") || name.includes("KOKCU") || name.includes("BORAN") || email.includes("BORAN") || email.includes("BUSER");
  });
  
  if (matchingRes.length === 0) {
    console.log("None found in reservations.");
  } else {
    matchingRes.forEach(r => {
      console.log("- Res ID:", r.id);
      console.log("  Name:", r.name);
      console.log("  Email:", r.email);
      console.log("  ClientId:", r.clientId);
      console.log("  Status:", r.status);
      console.log("  VehicleId:", r.vehicleId);
      console.log("  Days:", r.days);
      console.log("  TotalPrice:", r.totalPrice);
    });
  }

  console.log("\n=== CLIENTS WITH 'MENGÜ' OR 'KÖKÇÜ' ===");
  const matchingClients = clients.filter(c => {
    const name = (c.name || "").toUpperCase();
    return name.includes("MENGÜ") || name.includes("MENGU") || name.includes("KÖKÇÜ") || name.includes("KOKCU") || name.includes("BORAN");
  });

  if (matchingClients.length === 0) {
    console.log("None found in clients.");
  } else {
    matchingClients.forEach(c => {
      console.log("- Client ID:", c.id);
      console.log("  Name:", c.name);
      console.log("  Email:", c.email);
      console.log("  Phone:", c.phone);
      console.log("  RentalCount:", c.rentalCount);
      console.log("  TotalDaysRented:", c.totalDaysRented);
      console.log("  TotalSpent:", c.totalSpent);
    });
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Error in main:", err);
  process.exit(1);
});
