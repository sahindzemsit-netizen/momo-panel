const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const config = require("./firebase-applet-config.json");

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  console.log("Searching for ON RENT reservations...");
  const resSnap = await getDocs(collection(db, "reservations"));
  const onRentList = [];
  resSnap.forEach(docSnap => {
    const r = docSnap.data();
    if (r.status === "ON RENT") {
      onRentList.push({ id: docSnap.id, ...r });
    }
  });

  console.log(`Found ${onRentList.length} ON RENT reservations:`);
  onRentList.forEach(r => {
    console.log(`- ID: ${r.id}, VehicleId: ${r.vehicleId}, From: ${r.fromLocation}, To: ${r.toLocation}, Name: ${r.name}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
