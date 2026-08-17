const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const config = require("./firebase-applet-config.json");

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  const rSnap = await getDocs(collection(db, "reservations"));
  const reservations = [];
  rSnap.forEach(doc => {
    const data = doc.data();
    if (data.clientId === "client_1783763034144") {
      reservations.push({ id: doc.id, ...data });
    }
  });

  console.log(`Found ${reservations.length} reservations for client_1783763034144 (Kemal Dogan):`);
  reservations.forEach(r => {
    console.log("- Res ID:", r.id, "Name:", r.name, "Email:", r.email, "Status:", r.status, "TotalPrice:", r.totalPrice, "CreatedAt:", r.createdAt);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
