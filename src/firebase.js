import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBmaro6bBkmwIuBENRaYm8lZAsPRMyQZgU",
  authDomain: "educampus-cbt.firebaseapp.com",
  projectId: "educampus-cbt",
  storageBucket: "educampus-cbt.firebasestorage.app",
  messagingSenderId: "55331740637",
  appId: "1:55331740637:web:1eae7f9514c63a22c33434"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
