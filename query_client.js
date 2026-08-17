const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const config = require("./firebase-applet-config.json");

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  const vSnap = await getDocs(collection(db, "vehicles"));
  vSnap.forEach(doc => {
    const data = doc.data();
    if (data.plate && (data.plate.includes("2167") || data.country === "Macedonia")) {
      console.log("VEHICLE:", doc.id, JSON.stringify(data));
    }
  });

  const rSnap = await getDocs(collection(db, "reservations"));
  rSnap.forEach(doc => {
    const data = doc.data();
    if (String(data.vehicleId).includes("2167") || String(data.carId).includes("2167") || String(doc.id).includes("2167") || (data.name && data.name.includes("PINAR"))) {
      console.log("RESERVATION:", doc.id, JSON.stringify(data));
    }
  });
}

main().catch(console.error);
