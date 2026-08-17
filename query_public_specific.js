const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");
const config = require("./firebase-applet-config.json");

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  const docRef = doc(db, "clients", "client_1783763034144");
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    console.log("CLIENT EXISTS:", docSnap.id, docSnap.data());
  } else {
    console.log("CLIENT DOES NOT EXIST");
  }

  const resRef = doc(db, "reservations", "1783763274116");
  const resSnap = await getDoc(resRef);
  if (resSnap.exists()) {
    console.log("RESERVATION EXISTS:", resSnap.id, resSnap.data());
  } else {
    console.log("RESERVATION DOES NOT EXIST");
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Error in main:", err);
  process.exit(1);
});
