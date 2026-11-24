import type { FirebaseOptions } from "firebase/app";

/**
 * Configuração pública do Firebase (lida de variáveis NEXT_PUBLIC_*).
 * Esses valores identificam o projeto e podem ir para o cliente;
 * a segurança fica a cargo das Security Rules do Firestore/Storage.
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.RONEE_NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.RONEE_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.RONEE_NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.RONEE_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.RONEE_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.RONEE_NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.RONEE_NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);
