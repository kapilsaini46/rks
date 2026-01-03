
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import * as fs from 'fs';
import * as path from 'path';

// Helper to read .env.local
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (!fs.existsSync(envPath)) return {};
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const env: Record<string, string> = {};
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) env[key.trim()] = value.trim();
        });
        return env;
    } catch (e) {
        return {};
    }
}

const env = loadEnv();

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
};

// Check if config is loaded
if (!firebaseConfig.apiKey) {
    console.error("Error: Could not find VITE_FIREBASE_API_KEY in .env.local");
    console.error("Please make sure you have created .env.local with your Firebase keys.");
    process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = "admin@cbse.com";
const ADMIN_PASSWORD = "admin123"; // Change this if you want!

async function createAdmin() {
    console.log(`Creating Admin User: ${ADMIN_EMAIL}...`);

    try {
        // 1. Create Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        const user = userCredential.user;
        console.log("Auth User created:", user.uid);

        // 2. Create Firestore Profile
        await setDoc(doc(db, "users", user.email!), {
            name: "System Admin",
            email: user.email,
            role: "ADMIN", // This is the key part!
            createdAt: new Date().toISOString(),
            schoolName: "RKS HQ",
            subscriptionPlan: "PREMIUM",
            credits: 99999
        });

        console.log("Firestore Profile created successfully!");
        console.log("-----------------------------------------");
        console.log("You can now login with:");
        console.log(`Email: ${ADMIN_EMAIL}`);
        console.log(`Password: ${ADMIN_PASSWORD}`);
        console.log("-----------------------------------------");

    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            console.log("User already exists. Trying to update role to ADMIN...");
            // If user exists, just force update the role in Firestore
            await setDoc(doc(db, "users", ADMIN_EMAIL), {
                role: "ADMIN"
            }, { merge: true });
            console.log("Role updated to ADMIN successfully.");
        } else {
            console.error("Error creating admin:", error.message);
        }
    }
    process.exit(0);
}

createAdmin();
