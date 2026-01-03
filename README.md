# RKS Question Paper Maker - Deployment Guide

This project has been refactored to use Firebase for authentication and database, making it ready for cloud deployment.

## Prerequisites

1.  **Node.js & npm**: Ensure you have Node.js installed.
2.  **Firebase Account**: You need a Google account to create a Firebase project.

## Setup Instructions

### 1. Firebase Setup
1.  Go to [Firebase Console](https://console.firebase.google.com/).
2.  Click **Add project** and follow the steps to create a new project (e.g., `rks-question-maker`).
3.  **Enable Authentication**:
    *   Go to **Build** > **Authentication**.
    *   Click **Get Started**.
    *   Enable **Email/Password** provider.
4.  **Enable Firestore Database**:
    *   Go to **Build** > **Firestore Database**.
    *   Click **Create Database**.
    *   Choose a location (e.g., `asia-south1` for India).
    *   Start in **Test Mode** (for initial development) or **Production Mode** (you will need to set up security rules).
5.  **Get Configuration**:
    *   Go to **Project Settings** (gear icon).
    *   Scroll down to **Your apps**.
    *   Click the **Web** icon (`</>`).
    *   Register the app (e.g., `rks-web`).
    *   Copy the `firebaseConfig` object values (apiKey, authDomain, etc.).

### 2. Environment Variables
Create a `.env` file in the root directory (or set these in your deployment platform) with the following keys:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GOOGLE_API_KEY=your_gemini_api_key
```

*   Replace `your_...` with the actual values from Firebase.
*   Get `VITE_GOOGLE_API_KEY` from [Google AI Studio](https://aistudio.google.com/).

### 3. Install Dependencies
Run the following command in your terminal:

```bash
npm install
```

### 4. Run Locally
To test the application locally:

```bash
npm run dev
```

### 5. Deploy to Vercel (Free)
1.  Push this code to a GitHub repository.
2.  Go to [Vercel](https://vercel.com/) and sign up/login.
3.  Click **Add New** > **Project**.
4.  Import your GitHub repository.
5.  In the **Environment Variables** section, add all the variables from step 2.
6.  Click **Deploy**.

## Important Notes
*   **Admin Access**: The first user you register will be a "Teacher". You can manually change their role to "ADMIN" in the Firebase Console > Firestore Database > `users` collection > [user_email_document] > change `role` field to `ADMIN`.
*   **Security Rules**: Before going public, update Firestore Security Rules to protect data.
