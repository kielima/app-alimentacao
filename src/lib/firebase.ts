import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _googleProvider: GoogleAuthProvider | null = null;

if (firebaseConfigured) {
  app = initializeApp(config);
  _auth = getAuth(app);
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
    // Sem isto, qualquer write com campos `undefined` (ex.: itens de refeição
    // têm recipe_id OU ingredient_id como undefined) faz o setDoc lançar
    // "Unsupported field value: undefined", abortando o salvamento e impedindo
    // os dados de chegarem ao Firestore. Ignorar undefined = grava só os campos
    // definidos.
    ignoreUndefinedProperties: true,
  });
  _googleProvider = new GoogleAuthProvider();
  _googleProvider.setCustomParameters({ prompt: 'select_account' });
} else if (import.meta.env.DEV) {
  console.info(
    '[firebase] env vars não definidas — app sem persistência. Preencha .env.local com as chaves do Firebase Web Config.',
  );
}

export const auth = _auth;
export const db = _db;
export const googleProvider = _googleProvider;

export const ADMIN_EMAIL = 'kly@sapo.pt';
