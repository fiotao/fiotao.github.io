import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables for Firebase access
window.firebaseApp = null;
window.db = null;
window.auth = null;
window.currentUserId = null; // Store the authenticated user's ID
window.isAuthReady = false; // Flag to indicate if auth state is settled
window.isFirebaseInitialized = false; // New flag for Firebase core initialization
window.userProfile = {}; // Global variable for user profile data

// Firebase configuration (replace with your actual config)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
let firebaseConfig = {
    apiKey: "AIzaSyDa0hEZc2ClrFFdxcBlc-Vy-NsqppQ9YqY",
    authDomain: "fittracker-1a6a5.firebaseapp.com",
    projectId: "fittracker-1a6a5",
    storageBucket: "fittracker-1a6a5.firebaseapp.com",
    messagingSenderId: "80264175702"
};

try {
    // Initialize Firebase
    window.firebaseApp = initializeApp(firebaseConfig);
    window.auth = getAuth(window.firebaseApp);
    window.db = getFirestore(window.firebaseApp);
    window.isFirebaseInitialized = true; // Mark as initialized

    // Set up real-time authentication state listener
    onAuthStateChanged(window.auth, async (user) => {
        window.isAuthReady = true; // Auth state is settled
        if (user) {
            window.currentUserId = user.uid;
            // Load user profile if user exists
            await window.loadUserProfile();
            window.showView('days-view'); // Show main app view
        } else {
            window.currentUserId = null;
            window.userProfile = {}; // Clear profile on sign out
            window.showView('auth-view'); // Show auth view if no user
            window.showToast('Você foi desconectado. Faça login para usar o FitTracker.', 'info');
        }
    });

    // Initial sign-in logic (anonymous or custom token)
    document.addEventListener('DOMContentLoaded', async () => {
        if (!window.isFirebaseInitialized) {
            window.showToast('Erro inicial: Firebase não carregado.', 'danger');
            return;
        }

        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            try {
                await signInWithCustomToken(window.auth, __initial_auth_token);
            } catch (e) {
                window.showToast('Falha no login automático. Tente novamente.', 'danger');
                // Fallback to anonymous if custom token failed and no user is logged in
                if (!window.auth.currentUser) {
                    await signInAnonymously(window.auth);
                }
            }
        } else if (!window.auth.currentUser) {
            // If no custom token and no current user, sign in anonymously
            await signInAnonymously(window.auth);
        }
    });

} catch (error) {
    // Ensure DOM elements exist before trying to manipulate them
    document.addEventListener('DOMContentLoaded', () => {
        const userDisplayInfo = document.getElementById('user-display-info');
        const authView = document.getElementById('auth-view');
        const appContent = document.getElementById('app-content');

        if (userDisplayInfo) {
            userDisplayInfo.textContent = 'Erro grave ao carregar o Firebase.';
        }
        if (authView) {
            authView.style.display = 'block';
        }
        if (appContent) {
            appContent.style.display = 'none';
        }
        window.showToast('Erro crítico ao carregar o Firebase. Verifique a console para detalhes.', 'danger');
    });

    window.isFirebaseInitialized = false; // Mark as not initialized
}