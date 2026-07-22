import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyD1tIqQHPf0dObYB86f_AqhlNDx8g2AuIw",
  authDomain: "whatsapp-clone-015.firebaseapp.com",
  databaseURL: "https://whatsapp-clone-015-default-rtdb.firebaseio.com",
  projectId: "whatsapp-clone-015",
  storageBucket: "whatsapp-clone-015.firebasestorage.app",
  messagingSenderId: "732262150241",
  appId: "1:732262150241:web:394b09ad83307098a43a20",
  measurementId: "G-9KET3MF906"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getDatabase(app);

export default db;