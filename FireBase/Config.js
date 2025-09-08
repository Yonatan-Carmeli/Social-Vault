// ייבוא הפונקציות הנדרשות מ-Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// הגדרות התצורה של Firebase
// עבור Firebase JS SDK גרסה 7.20.0 ומעלה, measurementId הוא אופציונלי
const firebaseConfig = {
  apiKey: "AIzaSyDtahOHmldcTlF18moICNtonwzVJbQOW7k",
  authDomain: "social-vault.firebaseapp.com",
  projectId: "social-vault",
  storageBucket: "social-vault.firebasestorage.app",
  messagingSenderId: "929613087809",
  appId: "1:929613087809:web:e3604efab7634a71bc32c0",
  measurementId: "G-4MEYTEPLQJ"
};

// אתחול Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, auth };