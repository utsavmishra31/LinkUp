import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDZfJRmMtYNnCjXDuJUdeHinJTzDUW5gq4",
  projectId: "linkup2002",
  storageBucket: "linkup2002.firebasestorage.app",
  messagingSenderId: "309673756634",
  appId: "1:309673756634:android:347d39df54ebb97ff2e2e3",
};

const app = initializeApp(firebaseConfig);

// ✅ SAFE fallback for Expo (no react-native import)
export const auth =
  getAuth(app) ??
  initializeAuth(app, {
    persistence: AsyncStorage as any,
  });

export { app };
