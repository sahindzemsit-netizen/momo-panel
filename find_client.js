const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const config = require("./firebase-applet-config.json");

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  const cSnap = await getDocs(collection(db, "clients"));
  let found = false;
  cSnap.forEach(doc => {
    const d = doc.data();
    if (d.name && d.name.toLowerCase().includes("mengü")) {
      console.log(`FOUND CLIENT: ID: ${doc.id}, Name: "${d.name}", Email: "${d.email}", Passport: "${d.passportId}"`);
      found = true;
    }
  });
  if (!found) {
    console.log("No client found with 'mengü' in their name.");
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
