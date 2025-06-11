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
    messagingSenderId: "802641757021",
    appId: "1:802641757021:web:336e9d45be31128fc71eb4",
    measurementId: "G-7G8YL9GK5X"
};

// Check for projectId in firebaseConfig
if (!firebaseConfig.projectId) {
    window.showToast('Erro ao carregar o Firebase: projectId ausente na configuração estática.', 'danger');
    // Fallback to dummy values to prevent the app from crashing on initializeApp
    firebaseConfig = {
        apiKey: "dummy-api-key",
        authDomain: "dummy-auth-domain.firebaseapp.com",
        projectId: "dummy-project-id",
        storageBucket: "dummy-storage-bucket.appspot.com",
        messagingSenderId: "1234567890",
        appId: "1:1234567890:web:dummy",
        measurementId: "G-DUMMY"
    };
}

try {
    window.firebaseApp = initializeApp(firebaseConfig);
    window.db = getFirestore(window.firebaseApp);
    window.auth = getAuth(window.firebaseApp);
    window.isFirebaseInitialized = true;

    // Listen for auth state changes
    onAuthStateChanged(window.auth, async (user) => {
        window.isAuthReady = true; // Auth state is now determined
        const userDisplayInfo = document.getElementById('user-display-info');
        const authView = document.getElementById('auth-view');
        const appContent = document.getElementById('app-content');
        const logoutBtn = document.getElementById('logout-btn');

        if (user) {
            window.currentUserId = user.uid;
            // Fetch user profile data
            const userProfileRef = doc(window.db, `artifacts/${appId}/users/${window.currentUserId}/profile`, 'data');
            const userProfileSnap = await getDoc(userProfileRef);

            if (userProfileSnap.exists()) {
                window.userProfile = userProfileSnap.data();
                userDisplayInfo.textContent = `Bem-vindo(a), ${window.userProfile.name || user.email}!`;
            } else {
                window.userProfile = {};
                userDisplayInfo.textContent = `Usuário ID: ${window.currentUserId}`;
            }

            authView.style.display = 'none';
            appContent.style.display = 'block';
            logoutBtn.style.display = 'inline-flex';
            
            if (window.isFirebaseInitialized && window.db) {
                 await window.loadData();
                 window.initWorkoutDays();
                 window.showView('days-view');
            } else {
                window.showToast('Erro: Não foi possível carregar dados do usuário. Tente recarregar a página.', 'danger');
            }

        } else {
            window.currentUserId = null;
            window.userProfile = {}; // Clear user profile on logout
            userDisplayInfo.textContent = 'Usuário: Desconectado';
            authView.style.display = 'block';
            appContent.style.display = 'none';
            logoutBtn.style.display = 'none';
            // Clear local data if no user is logged in to prevent mix-ups
            window.allWorkoutData = {}; 
            window.workoutHistory = []; 
            window.initWorkoutDays(); // This should still work as it doesn't depend on Firestore directly
            window.showToast('Por favor, faça login ou cadastre-se para usar o FitTracker.', 'info');
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
    document.getElementById('user-display-info').textContent = 'Erro grave ao carregar o Firebase.';
    document.getElementById('auth-view').style.display = 'block';
    document.getElementById('app-content').style.display = 'none';
    window.showToast('Erro crítico ao carregar o Firebase. Verifique a console para detalhes.', 'danger');
    window.isFirebaseInitialized = false; // Mark as not initialized
}
