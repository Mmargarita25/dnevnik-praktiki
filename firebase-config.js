import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC73pw4D_xvxP2ULygKBseSPvEOiXVXPJc",
  authDomain: "practice-6d49d.firebaseapp.com",
  projectId: "practice-6d49d",
  storageBucket: "practice-6d49d.firebasestorage.app",
  messagingSenderId: "163567780646",
  appId: "1:163567780646:web:cd46c7c5eb311dace237e7",
  measurementId: "G-RHFVLH6NBH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);