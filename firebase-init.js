import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut as firebaseSignOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// === Variáveis Globais (Gerenciamento de Estado Firebase) ===
// Mantidas no escopo global para fácil acesso, mas com comentários para futura modularização.
window.firebaseApp = null;
window.db = null;
window.auth = null;
window.currentUserId = null; // Armazena o ID do usuário autenticado
window.isAuthReady = false; // Flag para indicar se o estado de autenticação está definido
window.isFirebaseInitialized = false; // Flag para a inicialização do Firebase core
window.userProfile = {}; // Variável global para os dados do perfil do usuário

// === Configuração do Firebase ===
// Recomenda-se carregar essas variáveis de ambiente em um ambiente de produção
// para maior segurança, embora em aplicações puramente client-side a chave seja pública.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // Usado para GitHub Pages secrets
let firebaseConfig = {
    apiKey: "AIzaSyDa0hEZc2ClrFFdxcBlc-Vy-NsqppQ9YqY", // SUBSTITUA PELA SUA CHAVE REAL
    authDomain: "fittracker-1a6a5.firebaseapp.com", // SUBSTITUA PELO SEU DOMÍNIO REAL
    projectId: "fittracker-1a6a5", // SUBSTITUA PELO SEU PROJECT ID REAL
    storageBucket: "fittracker-1a6a5.firebaseapp.com", // SUBSTITUA PELO SEU BUCKET REAL
    messagingSenderId: "802641757026", // SUBSTITUA PELO SEU SENDER ID REAL
    appId: "1:802641757021:web:336e9d45be31128fc71eb4", // SUBSTITUA PELO SEU APP ID REAL
	measurementId: "G-7G8YL9GK5X"
};

/**
 * Inicializa o Firebase e configura os listeners de autenticação.
 */
async function initializeFirebase() {
    try {
        window.showLoading(); // Exibe o spinner de carregamento

        // Verifica se o Firebase já foi inicializado
        if (window.firebaseApp && window.isFirebaseInitialized) {
            console.log('Firebase já inicializado.');
            window.hideLoading(); // Esconde o spinner
            return;
        }

        window.firebaseApp = initializeApp(firebaseConfig);
        window.auth = getAuth(window.firebaseApp);
        window.db = getFirestore(window.firebaseApp);
        window.isFirebaseInitialized = true; // Marca como inicializado

        // === Listener de Mudança de Estado de Autenticação ===
        // Este listener é central para gerenciar o estado do usuário (logado/deslogado)
        onAuthStateChanged(window.auth, async (user) => {
            if (user) {
                window.currentUserId = user.uid;
                document.getElementById('user-display-info').textContent = `Logado como: ${user.isAnonymous ? 'Anônimo' : user.email}`;
                document.getElementById('auth-view').style.display = 'none';
                document.getElementById('logout-btn').style.display = 'inline-flex';
                document.getElementById('app-content').style.display = 'block'; // Mostra o conteúdo da aplicação
                window.showView('profile-view'); // Ou a view que você quer que o usuário veja ao logar

                try {
                    await window.loadUserProfile(); // Tenta carregar o perfil do usuário
                } catch (loadError) {
                    // Se o perfil não existir, ele será criado na primeira vez que salvar
                    console.warn("Perfil não encontrado ou erro ao carregar:", loadError.message);
                    window.showToast('Crie seu perfil para começar!', 'info');
                    window.showView('edit-profile-view'); // Leva para a tela de edição de perfil
                }
            } else {
                window.currentUserId = null;
                document.getElementById('user-display-info').textContent = 'Deslogado';
                document.getElementById('auth-view').style.display = 'block';
                document.getElementById('logout-btn').style.display = 'none';
                document.getElementById('app-content').style.display = 'none'; // Esconde o conteúdo da aplicação
                window.showView('auth-view'); // Retorna para a tela de login
                window.showToast('Você está deslogado. Faça login ou cadastre-se.', 'info');
                window.userProfile = {}; // Limpa o perfil ao deslogar
            }
            window.isAuthReady = true; // Marca que o estado de autenticação foi estabelecido
            window.hideLoading(); // Esconde o spinner após o estado de autenticação ser definido
        });

        // Configura o botão de logout
        document.getElementById('logout-btn').addEventListener('click', async () => {
            try {
                window.showLoading();
                await firebaseSignOut(window.auth);
                window.showToast('Deslogado com sucesso!', 'success');
            } catch (error) {
                console.error('Erro ao deslogar:', error);
                window.showToast('Erro ao deslogar. Tente novamente.', 'danger');
            } finally {
                window.hideLoading();
            }
        });

    } catch (error) {
        console.error("Erro ao inicializar o Firebase:", error);
        document.getElementById('user-display-info').textContent = 'Erro grave ao carregar o Firebase.';
        document.getElementById('auth-view').style.display = 'block';
        document.getElementById('app-content').style.display = 'none';
        window.showToast('Erro crítico ao carregar o Firebase. Verifique a console para detalhes.', 'danger');
        window.isFirebaseInitialized = false; // Marca como não inicializado
        window.isAuthReady = true; // Garante que o estado de autenticação seja considerado 'pronto' para evitar loops
        window.hideLoading(); // Esconde o spinner
    }
}

// Chame a função de inicialização do Firebase quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    // Adiciona listener para o toggle de Dark Mode
    const darkModeToggle = document.getElementById('darkModeToggle');
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (darkModeToggle) {
        darkModeToggle.checked = isDarkMode;
        darkModeToggle.addEventListener('change', (event) => {
            window.applyTheme(event.target.checked);
        });
    }
    window.applyTheme(isDarkMode); // Aplica o tema na carga inicial

    // Inicializa o Firebase
    await initializeFirebase();

    // Se o app não for inicializado devido a erro, não tente login automático
    if (!window.isFirebaseInitialized) {
        window.showToast('Erro inicial: Firebase não carregado. Verifique sua configuração.', 'danger');
        return;
    }

    // Lógica de login inicial (anônimo ou custom token)
    // Se onAuthStateChanged já lidou com um usuário, não fazemos nada aqui.
    // Se não houver usuário logado e o estado de autenticação já estiver pronto, tenta login anônimo.
    // A flag `isAuthReady` garante que `onAuthStateChanged` já foi executado pelo menos uma vez.
    if (window.isAuthReady && !window.auth.currentUser) {
        window.showLoading();
        try {
            await signInAnonymously(window.auth);
            // O onAuthStateChanged vai lidar com o resto da lógica de exibição
        } catch (e) {
            console.error('Falha no login anônimo:', e);
            window.showToast('Não foi possível iniciar sessão anônima. Verifique sua conexão.', 'danger');
        } finally {
            window.hideLoading();
        }
    }
});

// === Configurações de Segurança Importantes do Firebase ===
// Lembre-se de configurar as Regras de Segurança do Firestore no Console do Firebase.
// Exemplo (VÁLIDO PARA AMBIENTE DE DESENVOLVIMENTO, NUNCA DEIXE ASSIM EM PRODUÇÃO SEM AJUSTES):
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     // Permite que qualquer usuário autenticado (incluindo anônimos) leia/escreva APENAS seus próprios dados
//     match /users/{userId}/{document=**} {
//       allow read, write: if request.auth != null && request.auth.uid == userId;
//     }
//   }
// }
// Para um controle mais granular e para evitar que usuários anônimos gravem dados após o sign-out,
// você deve ajustar as regras para usuários anônimos vs. usuários com e-mail/senha.
// Mais informações: https://firebase.google.com/docs/firestore/security/overview