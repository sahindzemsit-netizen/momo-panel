import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDocFromServer, 
  setLogLevel,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Supress benign stream errors in the console
setLogLevel('error');

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Safe check for IndexedDB availability inside iframe sandboxes
const isIndexedDBSupported = () => {
  if (typeof window === 'undefined') return false;
  try {
    const idb = window.indexedDB;
    return !!idb;
  } catch (_e) {
    console.warn("Firestore: IndexedDB is not accessible in this context (e.g. sandboxed iframe). Falling back.");
    return false;
  }
};

// Check if running inside an iframe sandbox, where multi-tab synchronization is typically blocked and causes assertion issues
const isIframe = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch (_e) {
    return true; // CORS/sandbox restriction blocks access, so we are inside an iframe
  }
};

const getLocalCacheSettings = () => {
  // Disable local persistent cache in iframes/development contexts to avoid Unexpected State assertion crashes (e.g. ID: ca9 / ve: -1)
  return {};
};

const firestoreSettings = {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
  ...getLocalCacheSettings()
} as unknown as import('firebase/firestore').FirestoreSettings;

// Safely initialize Firestore with fallback support to prevent application loading crashes
let dbInstance;
try {
  dbInstance = initializeFirestore(app, firestoreSettings, firebaseConfig.firestoreDatabaseId);
} catch (error) {
  console.error("Firestore initialization with settings failed. Falling back to simple settings without local persistentCache.", error);
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
  } as any, firebaseConfig.firestoreDatabaseId);
}

export const db = dbInstance; 
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

// Error Handling Spec for Firestore Operations
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore
async function testConnection() {
  if (typeof window === 'undefined') return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration. The client is offline.");
    }
  }
}
if (typeof window !== 'undefined') {
  setTimeout(() => {
    testConnection().catch(() => {});
  }, 1000);
}
