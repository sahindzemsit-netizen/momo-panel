const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore("ai-studio-85d0332d-770c-4c04-ad43-68a8c3688e8c");

async function main() {
  console.log("Searching for reservations with name containing 'MENGÜ'...");
  const resSnap = await db.collection("reservations").get();
  const reservations = resSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const matches = reservations.filter(r => (r.name || "").toUpperCase().includes("MENGÜ"));
  console.log(`Found ${matches.length} matching reservations:`);
  matches.forEach(r => {
    console.log("- ID:", r.id, "Name:", r.name, "Status:", r.status, "ClientId:", r.clientId, "Email:", r.email);
  });

  console.log("\nSearching for clients with name containing 'MENGÜ'...");
  const clientSnap = await db.collection("clients").get();
  const clients = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const clientMatches = clients.filter(c => (c.name || "").toUpperCase().includes("MENGÜ"));
  console.log(`Found ${clientMatches.length} matching clients:`);
  clientMatches.forEach(c => {
    console.log("- ID:", c.id, "Name:", c.name, "Email:", c.email);
  });
}

main().catch(console.error);
