const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");
const config = require("./firebase-applet-config.json");

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  const vId = "1779552857762";
  console.log(`Querying vehicle ID: ${vId}`);
  const snap = await getDoc(doc(db, "vehicles", vId));
  if (snap.exists()) {
    console.log("Vehicle details:", snap.data());
  } else {
    console.log("Vehicle not found!");
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
