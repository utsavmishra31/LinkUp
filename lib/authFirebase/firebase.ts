import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyCkOT-8GMUnjjLcocCFERt7eh6g3sWL9RM",
  authDomain: "linkup2002.firebaseapp.com",
  projectId: "linkup2002",
  storageBucket: "linkup2002.firebasestorage.app",
  messagingSenderId: "309673756634",
  appId: "1:309673756634:web:128ccb79bb4297a9f2e2e3",
  measurementId: "G-F3Y74FH8ZS",
};

// ✅ Prevent duplicate app initialization
export const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// ✅ Prevent duplicate auth initialization
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
