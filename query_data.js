const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (getApps().length === 0) {
  initializeApp({
    projectId: "momo-portal"
  });
}

const db = getFirestore("ai-studio-85d0332d-770c-4c04-ad43-68a8c3688e8c");

async function main() {
  const vehiclesSnap = await db.collection("vehicles").get();
  const vehicles = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const reservationsSnap = await db.collection("reservations").get();
  const reservations = reservationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  console.log("=== ALL VEHICLES ===");
  vehicles.forEach(v => {
    if (v.plate && (v.plate.includes("SK") || v.country === "Macedonia")) {
      console.log(`Vehicle ID: ${v.id}, Name: ${v.name}, Plate: ${v.plate}, Country: ${v.country}, ForcedPhysicalCountry: ${v.forcedPhysicalCountry}`);
    }
  });

  console.log("\n=== ON RENT RESERVATIONS ===");
  reservations.forEach(r => {
    if (r.status === "ON RENT") {
      const v = vehicles.find(veh => String(veh.id) === String(r.vehicleId));
      console.log(`Reservation ID: ${r.id}, Name: ${r.name}, Status: ${r.status}, From: ${r.fromLocation}, To: ${r.toLocation}, Vehicle: ${v ? `${v.name} (${v.plate})` : 'Unknown'}`);
    }
  });
  
  console.log("\n=== ALL RESERVATIONS FOR MACEDONIAN VEHICLES ===");
  reservations.forEach(r => {
    const v = vehicles.find(veh => String(veh.id) === String(r.vehicleId) && (veh.plate && (veh.plate.includes("SK") || veh.country === "Macedonia")));
    if (v) {
      console.log(`Reservation ID: ${r.id}, Name: ${r.name}, Status: ${r.status}, From: ${r.fromLocation}, To: ${r.toLocation}, Vehicle: ${v.name} (${v.plate})`);
    }
  });
}

main().catch(console.error);
