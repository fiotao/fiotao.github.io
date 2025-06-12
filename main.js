import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, addDoc, getDocs, deleteDoc, collection, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =============================================================
//               GLOBAL HELPERS & UTILITIES
// =============================================================

/**
 * Controla a exibição do overlay de carregamento.
 */
window.showLoading = function() {
    document.getElementById('loading-overlay').classList.add('active');
};
window.hideLoading = function() {
    document.getElementById('loading-overlay').classList.remove('active');
};


/**
 * Exibe uma mensagem de "toast" temporária na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - Tipo de mensagem (e.g., 'success', 'danger', 'info').
 */
window.showToast = function(message, type = 'info') {
    const toast = document.getElementById('toast-message');
    toast.textContent = message;
    toast.className = `toast-message show ${type}`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
};

/**
 * Formata segundos em HH:MM:SS.
 * @param {number} seconds - Número total de segundos.
 * @returns {string} Tempo formatado.
 */
window.formatTime = function(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
};

/**
 * Altera a visibilidade das seções da aplicação.
 * @param {string} viewId - O ID da seção a ser exibida.
 */
window.showView = function(viewId) {
    document.querySelectorAll('.app-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(viewId).style.display = 'block';

    // Se estiver saindo da view de execução do exercício, libere o wake lock
    if (viewId !== 'exercise-execution-view' && window.wakeLock) {
        window.releaseWakeLock();
    }
    // Se estiver entrando na view de execução, e o timer estiver ativo, tente solicitar wake lock
    if (viewId === 'exercise-execution-view' && window.currentExerciseTimerInterval) {
        window.requestWakeLock();
    }
};

/**
 * Aplica o tema escuro/claro com base na preferência.
 * @param {boolean} isDarkMode - True para modo escuro, false para modo claro.
 */
window.applyTheme = function(isDarkMode) {
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode);
};

// =============================================================
//               CONFIRM MODAL UTILITY
// =============================================================
/**
 * Exibe um modal de confirmação personalizado.
 * @param {string} message - A mensagem a ser exibida no modal.
 * @returns {Promise<boolean>} Uma Promise que resolve para true se o usuário clicar em "Sim", false caso contrário.
 */
window.customConfirm = function(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const confirmMessage = document.getElementById('confirm-message');
        const confirmYes = document.getElementById('confirm-yes');
        const confirmNo = document.getElementById('confirm-no');

        confirmMessage.textContent = message;
        modal.style.display = 'flex'; // Use flex para centralizar

        const handleYes = () => {
            modal.style.display = 'none';
            confirmYes.removeEventListener('click', handleYes);
            confirmNo.removeEventListener('click', handleNo);
            resolve(true);
        };

        const handleNo = () => {
            modal.style.display = 'none';
            confirmYes.removeEventListener('click', handleYes);
            confirmNo.removeEventListener('click', handleNo);
            resolve(false);
        };

        confirmYes.addEventListener('click', handleYes);
        confirmNo.addEventListener('click', handleNo);
    });
};

/**
 * Fecha o modal de confirmação.
 */
window.closeCustomConfirm = function() {
    document.getElementById('custom-confirm-modal').style.display = 'none';
};


// =============================================================
//               WAKE LOCK (KEEP SCREEN ON)
// =============================================================
// ATENÇÃO: A API Screen Wake Lock NÃO é suportada pelo Safari no iOS.
// O código abaixo funcionará em navegadores que a suportam (ex: Chrome no Android).
window.wakeLock = null; // Variável global para armazenar o wake lock

window.requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
        try {
            window.wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock ativo!');
            window.showToast('Tela permanecerá ativa durante o treino.', 'success');

            window.wakeLock.addEventListener('release', () => {
                console.log('Wake Lock foi liberado.');
                window.showToast('Wake Lock liberado (tela pode escurecer).', 'info');
                window.wakeLock = null;
            });
        } catch (err) {
            console.error(`Falha ao solicitar Wake Lock: ${err.name}, ${err.message}`);
            window.showToast('Não foi possível manter a tela ativa automaticamente.', 'danger');
        }
    } else {
        console.warn('API Wake Lock não suportada neste navegador.');
        // window.showToast('API Wake Lock não suportada.', 'info'); // Remover em produção, pois spammaria no iOS
    }
};

window.releaseWakeLock = async () => {
    if (window.wakeLock) {
        try {
            await window.wakeLock.release();
            window.wakeLock = null;
            console.log('Wake Lock liberado com sucesso.');
            window.showToast('Tela voltará a bloquear normalmente.', 'info');
        } catch (err) {
            console.error(`Falha ao liberar Wake Lock: ${err.name}, ${err.message}`);
        }
    }
};


// =============================================================
//               FIREBASE DATA OPERATIONS (PROFILE)
// =============================================================
/**
 * Salva ou atualiza o perfil do usuário no Firestore.
 */
window.saveUserProfile = async function() {
    if (!window.currentUserId) {
        window.showToast('Erro: Usuário não autenticado.', 'danger');
        return;
    }
    window.showLoading();
    try {
        const userRef = doc(window.db, 'users', window.currentUserId);
        await setDoc(userRef, window.userProfile, { merge: true }); // Usar merge para não sobrescrever campos existentes
        window.showToast('Perfil salvo com sucesso!', 'success');
        window.renderProfileView(); // Atualiza a exibição do perfil
    } catch (error) {
        console.error('Erro ao salvar perfil:', error);
        window.showToast('Erro ao salvar perfil. Tente novamente.', 'danger');
    } finally {
        window.hideLoading();
    }
};

/**
 * Carrega o perfil do usuário do Firestore.
 */
window.loadUserProfile = async function() {
    if (!window.currentUserId) {
        // Não exibe toast aqui, pois é esperado que não haja usuário na primeira carga.
        return;
    }
    window.showLoading();
    try {
        const userRef = doc(window.db, 'users', window.currentUserId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            window.userProfile = { ...docSnap.data(), registeredAt: docSnap.data().registeredAt || new Date().toISOString() };
            window.showToast('Perfil carregado.', 'success');
            window.renderProfileView(); // Atualiza a exibição do perfil
        } else {
            console.log("Nenhum perfil encontrado para o usuário. Criando um novo.");
            // Definir um perfil padrão se não existir
            window.userProfile = {
                name: '',
                gender: '',
                age: 0,
                weight: 0,
                height: 0,
                goal: '',
                registeredAt: new Date().toISOString() // Data de registro inicial
            };
            window.showToast('Preencha seu perfil para começar!', 'info');
            window.showView('edit-profile-view');
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        window.showToast('Erro ao carregar perfil. Verifique sua conexão.', 'danger');
    } finally {
        window.hideLoading();
    }
};

/**
 * Deleta o perfil do usuário do Firestore.
 */
window.deleteUserProfile = async function() {
    if (!window.currentUserId) {
        window.showToast('Erro: Usuário não autenticado.', 'danger');
        return;
    }
    const confirmDelete = await window.customConfirm('Tem certeza que deseja excluir seu perfil? Todos os seus dados de treino serão perdidos!');
    if (!confirmDelete) return;

    window.showLoading();
    try {
        const userRef = doc(window.db, 'users', window.currentUserId);
        await deleteDoc(userRef);
        window.userProfile = {}; // Limpa os dados locais
        window.showToast('Perfil e dados excluídos com sucesso!', 'success');
        window.showView('auth-view'); // Volta para a tela de autenticação
    } catch (error) {
        console.error('Erro ao excluir perfil:', error);
        window.showToast('Erro ao excluir perfil. Tente novamente.', 'danger');
    } finally {
        window.hideLoading();
    }
};

// =============================================================
//               FIREBASE DATA OPERATIONS (WORKOUTS)
// =============================================================

window.loadDailyWorkouts = async function() {
    if (!window.currentUserId) {
        window.showToast('Faça login para ver seus treinos.', 'info');
        return [];
    }
    window.showLoading();
    try {
        const workoutsCol = collection(window.db, 'users', window.currentUserId, 'dailyWorkouts');
        const q = query(workoutsCol); // Pode adicionar orderBy aqui se precisar de ordenação
        const querySnapshot = await getDocs(q);
        const workouts = [];
        querySnapshot.forEach((doc) => {
            workouts.push({ id: doc.id, ...doc.data() });
        });
        workouts.sort((a, b) => new Date(b.date) - new Date(a.date)); // Ordena por data mais recente
        return workouts;
    } catch (error) {
        console.error('Erro ao carregar treinos diários:', error);
        window.showToast('Erro ao carregar treinos. Verifique sua conexão.', 'danger');
        return [];
    } finally {
        window.hideLoading();
    }
};

window.saveDailyWorkouts = async function(dailyWorkouts) {
    if (!window.currentUserId) {
        window.showToast('Erro: Usuário não autenticado. Não foi possível salvar treinos.', 'danger');
        return;
    }
    window.showLoading();
    try {
        // Percorrer e salvar cada dailyWorkout individualmente ou atualizar existentes
        for (const workout of dailyWorkouts) {
            const workoutRef = doc(window.db, 'users', window.currentUserId, 'dailyWorkouts', workout.id);
            await setDoc(workoutRef, workout, { merge: true });
        }
        window.showToast('Treinos diários salvos!', 'success');
    } catch (error) {
        console.error('Erro ao salvar treinos diários:', error);
        window.showToast('Erro ao salvar treinos. Tente novamente.', 'danger');
    } finally {
        window.hideLoading();
    }
};

window.deleteDailyWorkout = async function(dayId) {
    if (!window.currentUserId) {
        window.showToast('Erro: Usuário não autenticado.', 'danger');
        return;
    }
    const confirmDelete = await window.customConfirm('Tem certeza que deseja excluir este dia de treino?');
    if (!confirmDelete) return;

    window.showLoading();
    try {
        const dayRef = doc(window.db, 'users', window.currentUserId, 'dailyWorkouts', dayId);
        await deleteDoc(dayRef);
        window.showToast('Dia de treino excluído!', 'success');
        window.renderDaysView(); // Recarrega a lista de dias
    } catch (error) {
        console.error('Erro ao excluir dia de treino:', error);
        window.showToast('Erro ao excluir dia de treino. Tente novamente.', 'danger');
    } finally {
        window.hideLoading();
    }
};

// =============================================================
//               UI RENDERING FUNCTIONS
// =============================================================

// Função para renderizar a view do perfil
window.renderProfileView = function() {
    const profile = window.userProfile;
    document.getElementById('display-name').textContent = profile.name || 'Não definido';
    document.getElementById('display-gender').textContent = profile.gender || 'Não definido';
    document.getElementById('display-age').textContent = profile.age > 0 ? `${profile.age}` : 'Não definido';
    document.getElementById('display-weight').textContent = profile.weight > 0 ? `${profile.weight}` : 'Não definido';
    document.getElementById('display-height').textContent = profile.height > 0 ? `${profile.height}` : 'Não definido';
    document.getElementById('display-goal').textContent = profile.goal || 'Não definido';

    if (profile.registeredAt) {
        const date = new Date(profile.registeredAt);
        document.getElementById('display-registered-at').textContent = date.toLocaleDateString();
    } else {
        document.getElementById('display-registered-at').textContent = 'Não definido';
    }

    // Preenche o formulário de edição com os dados atuais
    document.getElementById('profile-name').value = profile.name || '';
    document.getElementById('profile-gender').value = profile.gender || '';
    document.getElementById('profile-age').value = profile.age || '';
    document.getElementById('profile-weight').value = profile.weight || '';
    document.getElementById('profile-height').value = profile.height || '';
    document.getElementById('profile-goal').value = profile.goal || '';

    window.showView('profile-view');
};

let currentDayId = null; // Armazena o ID do dia atualmente selecionado

window.renderDaysView = async function() {
    const dailyWorkouts = await window.loadDailyWorkouts();
    const listElement = document.getElementById('daily-workouts-list');
    listElement.innerHTML = ''; // Limpa a lista existente

    if (dailyWorkouts.length === 0) {
        listElement.innerHTML = '<p style="text-align: center; color: var(--info-color);">Nenhum dia de treino registrado ainda. Clique em "Adicionar Dia".</p>';
        window.showView('days-view');
        return;
    }

    dailyWorkouts.forEach(day => {
        const card = document.createElement('div');
        card.className = 'daily-workout-card';
        card.innerHTML = `
            <strong>Dia: ${new Date(day.date).toLocaleDateString()}</strong>
            <p>Exercícios: ${day.exercises ? day.exercises.length : 0}</p>
            <div class="actions">
                <button class="btn btn-primary view-day-btn" data-day-id="${day.id}"><i class="fas fa-eye"></i> Ver Detalhes</button>
                <button class="btn btn-danger delete-day-btn" data-day-id="${day.id}"><i class="fas fa-trash-alt"></i> Excluir</button>
            </div>
        `;
        listElement.appendChild(card);
    });
    window.showView('days-view');
};

window.renderDayView = function(dayId) {
    currentDayId = dayId; // Salva o ID do dia atual
    window.showLoading();
    window.loadDailyWorkouts().then(dailyWorkouts => {
        const day = dailyWorkouts.find(d => d.id === dayId);
        if (!day) {
            window.showToast('Dia de treino não encontrado!', 'danger');
            window.renderDaysView();
            return;
        }

        document.getElementById('day-view-title').textContent = `Treinos do Dia: ${new Date(day.date).toLocaleDateString()}`;
        const listElement = document.getElementById('day-workouts-list');
        listElement.innerHTML = ''; // Limpa a lista existente

        if (!day.exercises || day.exercises.length === 0) {
            listElement.innerHTML = '<p style="text-align: center; color: var(--info-color);">Nenhum exercício para este dia ainda. Clique em "Adicionar Exercício".</p>';
            window.showView('day-view');
            window.hideLoading();
            return;
        }

        day.exercises.forEach((exercise, index) => {
            const card = document.createElement('div');
            card.className = 'exercise-card';
            card.innerHTML = `
                <strong>${exercise.name}</strong>
                <p>Grupo Muscular: ${exercise.muscleGroup || 'N/A'}</p>
                <p>Notas: ${exercise.notes || 'N/A'}</p>
                <p>Sets Completos: ${exercise.sets ? exercise.sets.length : 0}</p>
                <div class="actions">
                    <button class="btn btn-success start-exercise-btn" data-exercise-index="${index}"><i class="fas fa-play"></i> Iniciar</button>
                    <button class="btn btn-info edit-exercise-btn" data-exercise-index="${index}"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn btn-danger delete-exercise-btn" data-exercise-index="${index}"><i class="fas fa-trash-alt"></i> Excluir</button>
                </div>
            `;
            listElement.appendChild(card);
        });
        window.showView('day-view');
    }).catch(error => {
        console.error('Erro ao renderizar dia de treino:', error);
        window.showToast('Erro ao carregar detalhes do dia.', 'danger');
    }).finally(() => {
        window.hideLoading();
    });
};

window.renderExerciseSelectionView = function() {
    document.getElementById('exercise-name-input').value = '';
    document.getElementById('exercise-muscle-group-input').value = '';
    document.getElementById('exercise-notes-input').value = '';
    window.showView('exercise-selection-view');
};

let currentExercise = null; // Armazena o exercício atualmente em execução
let currentExerciseIndex = -1; // Índice do exercício dentro do dia

window.renderExerciseExecutionView = function(exercise, index) {
    currentExercise = exercise;
    currentExerciseIndex = index;
    document.getElementById('execution-exercise-name').textContent = exercise.name;
    document.getElementById('current-exercise-display').textContent = `Executando: ${exercise.name}`;
    window.renderSetsList(); // Renderiza os sets existentes

    // Reseta e esconde o timer se não for iniciado automaticamente
    window.resetTimer();
    document.getElementById('exercise-timer-display').style.display = 'block';

    window.showView('exercise-execution-view');
    window.requestWakeLock(); // Solicita o wake lock ao iniciar o exercício
};

window.renderSetsList = function() {
    const setsListEl = document.getElementById('sets-list');
    setsListEl.innerHTML = ''; // Limpa a lista existente

    if (!currentExercise || !currentExercise.sets || currentExercise.sets.length === 0) {
        setsListEl.innerHTML = '<p style="text-align: center; color: var(--info-color);">Nenhum set registrado para este exercício ainda.</p>';
        return;
    }

    currentExercise.sets.forEach((set, index) => {
        const setItem = document.createElement('div');
        setItem.className = 'set-item';
        // Adiciona classe de destaque para o último set adicionado ou set em edição
        if (index === currentExercise.sets.length - 1) { // Pode adicionar lógica para set em edição também
            setItem.classList.add('current-set-highlight');
        }
        setItem.innerHTML = `
            <span>Set ${index + 1}: ${set.weight} kg x ${set.reps} reps</span>
            <div class="set-actions">
                <button class="btn btn-info edit-set-btn" data-set-index="${index}"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger delete-set-btn" data-set-index="${index}"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        setsListEl.appendChild(setItem);
    });
    setsListEl.scrollTop = setsListEl.scrollHeight; // Rola para o último set
};


// =============================================================
//               EXERCISE LOGIC
// =============================================================

window.addSetToCurrentExercise = async function(weight, reps, isManual = false) {
    if (!currentExercise || !currentDayId) {
        window.showToast('Erro: Nenhum exercício ou dia selecionado.', 'danger');
        return;
    }

    if (!currentExercise.sets) {
        currentExercise.sets = [];
    }

    currentExercise.sets.push({
        weight: weight,
        reps: reps,
        timestamp: new Date().toISOString(),
        manual: isManual // Marca se o set foi adicionado manualmente
    });

    await window.updateDayWorkoutInFirestore(); // Salva no Firestore
    window.renderSetsList(); // Atualiza a lista de sets na tela
    window.showToast(`Set registrado: ${weight}kg x ${reps} reps`, 'success');
};

window.updateDayWorkoutInFirestore = async function() {
    if (!window.currentUserId || !currentDayId || currentExerciseIndex === -1 || !currentExercise) {
        console.error('Erro: Dados insuficientes para atualizar o treino no Firestore.');
        window.showToast('Erro interno ao salvar o treino.', 'danger');
        return;
    }

    window.showLoading();
    try {
        const workoutsCol = collection(window.db, 'users', window.currentUserId, 'dailyWorkouts');
        const dayDocRef = doc(workoutsCol, currentDayId);
        const dayDocSnap = await getDoc(dayDocRef);

        if (dayDocSnap.exists()) {
            const dayData = dayDocSnap.data();
            // Atualiza o exercício específico dentro do array de exercícios do dia
            dayData.exercises[currentExerciseIndex] = currentExercise;
            await setDoc(dayDocRef, dayData); // Sobrescreve o documento do dia com os dados atualizados
            console.log('Treino do dia atualizado no Firestore.');
        } else {
            console.error('Documento do dia não encontrado no Firestore.');
            window.showToast('Erro: Dia de treino não encontrado para atualização.', 'danger');
        }
    } catch (error) {
        console.error('Erro ao atualizar treino do dia no Firestore:', error);
        window.showToast('Erro ao salvar o treino. Tente novamente.', 'danger');
    } finally {
        window.hideLoading();
    }
};

window.deleteWorkoutEntry = async function(dayId, exerciseIndex) {
    if (!window.currentUserId) {
        window.showToast('Erro: Usuário não autenticado.', 'danger');
        return;
    }
    const confirmDelete = await window.customConfirm('Tem certeza que deseja excluir este exercício?');
    if (!confirmDelete) return;

    window.showLoading();
    try {
        const workoutsCol = collection(window.db, 'users', window.currentUserId, 'dailyWorkouts');
        const dayDocRef = doc(workoutsCol, dayId);
        const dayDocSnap = await getDoc(dayDocRef);

        if (dayDocSnap.exists()) {
            const dayData = dayDocSnap.data();
            dayData.exercises.splice(exerciseIndex, 1); // Remove o exercício
            await setDoc(dayDocRef, dayData);
            window.showToast('Exercício excluído com sucesso!', 'success');
            window.renderDayView(dayId); // Recarrega a view do dia
        } else {
            window.showToast('Erro: Dia de treino não encontrado.', 'danger');
        }
    } catch (error) {
        console.error('Erro ao excluir exercício:', error);
        window.showToast('Erro ao excluir exercício. Tente novamente.', 'danger');
    } finally {
        window.hideLoading();
    }
};

window.deleteSetFromExercise = async function(setIndexToDelete) {
    if (!currentExercise || !currentDayId || currentExerciseIndex === -1) {
        window.showToast('Erro: Nenhum exercício selecionado para excluir o set.', 'danger');
        return;
    }
    const confirmDelete = await window.customConfirm('Tem certeza que deseja excluir este set?');
    if (!confirmDelete) return;

    window.showLoading();
    try {
        currentExercise.sets.splice(setIndexToDelete, 1); // Remove o set do array local
        await window.updateDayWorkoutInFirestore(); // Salva a mudança no Firestore
        window.renderSetsList(); // Atualiza a lista na tela
        window.showToast('Set excluído com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao excluir set:', error);
        window.showToast('Erro ao excluir set. Tente novamente.', 'danger');
    } finally {
        window.hideLoading();
    }
};

window.editSetInExercise = async function(setIndexToEdit) {
    if (!currentExercise || !currentExercise.sets || currentExercise.sets.length <= setIndexToEdit) {
        window.showToast('Erro: Set inválido para edição.', 'danger');
        return;
    }

    const set = currentExercise.sets[setIndexToEdit];
    const newWeight = prompt(`Editar peso para Set ${setIndexToEdit + 1} (atual: ${set.weight}kg):`);
    // Usar a normalização aqui também para entrada do prompt
    const normalizedNewWeight = newWeight ? newWeight.replace(',', '.') : '';
    const parsedNewWeight = parseFloat(normalizedNewWeight);

    const newReps = prompt(`Editar repetições para Set ${setIndexToEdit + 1} (atual: ${set.reps} reps):`);
    const parsedNewReps = parseInt(newReps);

    if (newWeight === null || newReps === null) { // Usuário cancelou
        window.showToast('Edição cancelada.', 'info');
        return;
    }

    if (isNaN(parsedNewWeight) || parsedNewWeight < 0) {
        window.showToast('Peso inválido. Edição cancelada.', 'danger');
        return;
    }
    if (isNaN(parsedNewReps) || parsedNewReps < 0) {
        window.showToast('Repetições inválidas. Edição cancelada.', 'danger');
        return;
    }

    currentExercise.sets[setIndexToEdit].weight = parsedNewWeight;
    currentExercise.sets[setIndexToEdit].reps = parsedNewReps;
    currentExercise.sets[setIndexToEdit].timestamp = new Date().toISOString(); // Atualiza o timestamp da edição

    window.showLoading();
    try {
        await window.updateDayWorkoutInFirestore();
        window.renderSetsList();
        window.showToast('Set atualizado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao atualizar set:', error);
        window.showToast('Erro ao atualizar set. Tente novamente.', 'danger');
    } finally {
        window.hideLoading();
    }
};


window.resetExercise = async function() {
    if (!currentExercise || !currentDayId) {
        window.showToast('Nenhum exercício selecionado para resetar.', 'info');
        return;
    }
    const confirmReset = await window.customConfirm('Tem certeza que deseja resetar este exercício? Todos os sets serão excluídos.');
    if (!confirmReset) return;

    currentExercise.sets = []; // Limpa os sets
    window.showLoading();
    try {
        await window.updateDayWorkoutInFirestore(); // Salva a mudança no Firestore
        window.renderSetsList(); // Atualiza a lista na tela
        window.showToast('Exercício resetado!', 'success');
    } catch (error) {
        console.error('Erro ao resetar exercício:', error);
        window.showToast('Erro ao resetar exercício. Tente novamente.', 'danger');
    } finally {
        window.hideLoading();
    }
};

window.completeSet = async function(setIndex) {
    // Esta função será para marcar um set como completo ou algo do tipo
    // A lógica de adicionar um set está em addSetToCurrentExercise
    window.showToast(`Set ${setIndex + 1} marcado como completo! (Funcionalidade a ser expandida)`, 'info');
    // Implemente a lógica de marcar como completo aqui, se necessário.
};

// =============================================================
//               TIMER LOGIC
// =============================================================

let timerInterval;
let timerSeconds = 0;
let isTimerRunning = false;
let currentExerciseTimerInterval = null; // Armazena o ID do setInterval do timer do exercício

window.initExerciseTimer = function() {
    document.getElementById('timer-countdown').textContent = window.formatTime(timerSeconds);
    document.getElementById('timer-start-pause').innerHTML = '<i class="fas fa-play"></i> Iniciar';
    document.getElementById('timer-start-pause').classList.remove('btn-danger');
    document.getElementById('timer-start-pause').classList.add('btn-info');
    document.getElementById('exercise-timer-display').classList.remove('resting');
};

window.resetTimer = function() {
    clearInterval(timerInterval);
    timerSeconds = 0;
    isTimerRunning = false;
    window.initExerciseTimer();
};

window.startTimer = function() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    document.getElementById('timer-start-pause').innerHTML = '<i class="fas fa-pause"></i> Pausar';
    document.getElementById('timer-start-pause').classList.remove('btn-info');
    document.getElementById('timer-start-pause').classList.add('btn-danger');

    timerInterval = setInterval(() => {
        timerSeconds++;
        window.updateTimerDisplay();
    }, 1000);

    window.requestWakeLock(); // Solicita o wake lock ao iniciar o timer
};

window.pauseTimer = function() {
    if (!isTimerRunning) return;
    isTimerRunning = false;
    clearInterval(timerInterval);
    document.getElementById('timer-start-pause').innerHTML = '<i class="fas fa-play"></i> Continuar';
    document.getElementById('timer-start-pause').classList.remove('btn-danger');
    document.getElementById('timer-start-pause').classList.add('btn-info');

    window.releaseWakeLock(); // Libera o wake lock ao pausar o timer
};

window.updateTimerDisplay = function() {
    document.getElementById('timer-countdown').textContent = window.formatTime(timerSeconds);
    if (timerSeconds % 60 === 0 && timerSeconds > 0) { // Exemplo: toast a cada minuto
        window.showToast(`Tempo de exercício: ${window.formatTime(timerSeconds)}`, 'info');
    }
};

// =============================================================
//               PROGRESS CHART LOGIC
// =============================================================
let progressChartInstance = null; // Para armazenar a instância do Chart.js

window.loadWorkoutProgress = async function() {
    if (!window.currentUserId) {
        window.showToast('Faça login para ver seu progresso.', 'info');
        return;
    }
    window.showLoading();
    try {
        const dailyWorkouts = await window.loadDailyWorkouts();
        const exerciseData = {}; // Objeto para armazenar dados por exercício

        dailyWorkouts.forEach(day => {
            if (day.exercises) {
                day.exercises.forEach(exercise => {
                    if (!exerciseData[exercise.name]) {
                        exerciseData[exercise.name] = [];
                    }
                    if (exercise.sets) {
                        exercise.sets.forEach(set => {
                            exerciseData[exercise.name].push({
                                date: day.date, // Use a data do dia do treino
                                weight: set.weight,
                                reps: set.reps
                            });
                        });
                    }
                });
            }
        });

        // Preenche o select de exercícios
        const selectEl = document.getElementById('progress-exercise-select');
        selectEl.innerHTML = '<option value="">Selecione um exercício</option>';
        Object.keys(exerciseData).sort().forEach(exerciseName => {
            const option = document.createElement('option');
            option.value = exerciseName;
            option.textContent = exerciseName;
            selectEl.appendChild(option);
        });

        // Adiciona listener para mudança no select
        selectEl.removeEventListener('change', window.handleProgressExerciseChange); // Remove para evitar duplicatas
        selectEl.addEventListener('change', window.handleProgressExerciseChange);

        window.renderProgressChart(exerciseData); // Renderiza o gráfico inicial (pode ser vazio)

    } catch (error) {
        console.error('Erro ao carregar progresso:', error);
        window.showToast('Erro ao carregar progresso. Tente novamente.', 'danger');
    } finally {
        window.hideLoading();
    }
};

window.handleProgressExerciseChange = function() {
    const selectedExerciseName = this.value; // 'this' é o selectElement
    // A 'exerciseData' é criada em loadWorkoutProgress.
    // Para acessá-la aqui, precisaríamos que loadWorkoutProgress a retorne
    // ou a armazene em uma variável global acessível (o que estamos tentando evitar).
    // Uma solução: recarregar os dados filtrados ou ter 'exerciseData' persistente em uma variável do módulo.
    // Por simplicidade agora, vou carregar novamente ou esperar que 'loadWorkoutProgress' já tenha preenchido.
    // Idealmente, a 'exerciseData' seria parte de um estado global acessível.
    window.showLoading();
    window.loadDailyWorkouts().then(dailyWorkouts => {
        const exerciseData = {};
        dailyWorkouts.forEach(day => {
            if (day.exercises) {
                day.exercises.forEach(exercise => {
                    if (!exerciseData[exercise.name]) {
                        exerciseData[exercise.name] = [];
                    }
                    if (exercise.sets) {
                        exercise.sets.forEach(set => {
                            exerciseData[exercise.name].push({
                                date: day.date,
                                weight: set.weight,
                                reps: set.reps
                            });
                        });
                    }
                });
            }
        });

        if (selectedExerciseName) {
            const dataToChart = exerciseData[selectedExerciseName] || [];
            window.renderProgressChart(dataToChart, selectedExerciseName);
        } else {
            window.renderProgressChart({}); // Limpa o gráfico
        }
    }).finally(() => {
        window.hideLoading();
    });
};


window.renderProgressChart = function(data, exerciseName = '') {
    const ctx = document.getElementById('progressChart').getContext('2d');

    if (progressChartInstance) {
        progressChartInstance.destroy(); // Destrói a instância anterior para evitar sobreposição
    }

    const labels = [];
    const weights = [];
    const reps = [];

    // 'data' pode ser um array de sets para um exercício específico
    // ou um objeto de todos os exercícios.
    // Ajuste aqui para como você quer que os dados cheguem para o gráfico.
    // Se 'data' for um array de sets (já filtrado por exercício):
    if (Array.isArray(data)) {
        data.sort((a, b) => new Date(a.date) - new Date(b.date)); // Ordena por data
        data.forEach(set => {
            labels.push(new Date(set.date).toLocaleDateString());
            weights.push(set.weight);
            reps.push(set.reps);
        });
    }
    // Se 'data' for o objeto de todos os exercícios, e exerciseName for vazio:
    // O gráfico inicial pode ser um placeholder ou mostrar todos os exercícios.
    // Por enquanto, ele mostrará um gráfico vazio se nenhum exercício for selecionado.


    progressChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Peso (kg)',
                    data: weights,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false,
                    yAxisID: 'y'
                },
                {
                    label: 'Repetições',
                    data: reps,
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    fill: false,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Peso (kg)'
                    },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false // Somente a primeira grade
                    },
                    title: {
                        display: true,
                        text: 'Repetições'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: exerciseName ? `Progresso de ${exerciseName}` : 'Selecione um Exercício para Ver o Progresso'
                }
            }
        }
    });
};


// =============================================================
//               EVENT LISTENERS
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa o timer display
    window.initExerciseTimer();

    // Event listener para o botão de salvar perfil
    document.getElementById('save-profile-btn').addEventListener('click', async () => {
        const name = document.getElementById('profile-name').value;
        const gender = document.getElementById('profile-gender').value;
        const age = parseInt(document.getElementById('profile-age').value) || 0;

        // --- Correção e validação para profile-weight ---
        const profileWeightInput = document.getElementById('profile-weight');
        const rawProfileWeightValue = profileWeightInput.value;
        const normalizedProfileWeight = rawProfileWeightValue.replace(',', '.');
        const parsedProfileWeight = parseFloat(normalizedProfileWeight);
        const weight = parsedProfileWeight || 0; // Fallback para 0 se NaN

        const height = parseInt(document.getElementById('profile-height').value) || 0;
        const goal = document.getElementById('profile-goal').value;

        // Validação mais explícita
        if (!name || !gender || isNaN(age) || age <= 0 || isNaN(weight) || weight <= 0 || isNaN(height) || height <= 0 || !goal) {
            window.showToast('Por favor, preencha todos os campos do perfil com valores válidos.', 'danger');
            return;
        }

        window.userProfile = {
            name: name,
            gender: gender,
            age: age,
            weight: weight,
            height: height,
            goal: goal,
            // Preserve registeredAt if it exists, otherwise set new
            registeredAt: window.userProfile.registeredAt || new Date().toISOString()
        };
        await window.saveUserProfile();
        window.showView('profile-view');
    });

    // Event listener para o toggle de Dark Mode (também em firebase-init.js)
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.checked = localStorage.getItem('darkMode') === 'true';
        darkModeToggle.addEventListener('change', (event) => {
            window.applyTheme(event.target.checked);
        });
    }

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js')
                .then(registration => {
                    console.log('Service Worker registrado com sucesso:', registration.scope);
                })
                .catch(error => {
                    console.error('Falha no registro do Service Worker:', error);
                    window.showToast('Não foi possível instalar recursos offline.', 'danger');
                });
        });
    } else {
        window.showToast('Seu navegador não suporta Service Workers para recursos offline.', 'info');
    }

    // --- EVENT LISTENERS GERAIS PARA DELEGAÇÃO ---
    // Usando delegação de eventos para botões gerados dinamicamente
    document.addEventListener('click', async (event) => {
        // Botões de autenticação
        if (event.target.id === 'login-btn') {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            window.showLoading();
            try {
                await signInWithEmailAndPassword(window.auth, email, password);
                window.showToast('Login bem-sucedido!', 'success');
                // onAuthStateChanged irá lidar com a renderização da view
            } catch (error) {
                console.error('Erro de login:', error.code, error.message);
                let errorMessage = 'Erro ao fazer login. Tente novamente.';
                if (error.code === 'auth/invalid-email') errorMessage = 'E-mail inválido.';
                else if (error.code === 'auth/user-not-found') errorMessage = 'Usuário não encontrado.';
                else if (error.code === 'auth/wrong-password') errorMessage = 'Senha incorreta.';
                else if (error.code === 'auth/too-many-requests') errorMessage = 'Muitas tentativas de login. Tente mais tarde.';
                window.showToast(errorMessage, 'danger');
            } finally {
                window.hideLoading();
            }
        }
        if (event.target.id === 'signup-btn') {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            window.showLoading();
            try {
                await createUserWithEmailAndPassword(window.auth, email, password);
                window.showToast('Cadastro bem-sucedido! Faça login.', 'success');
                // onAuthStateChanged irá lidar com a renderização da view
            } catch (error) {
                console.error('Erro de cadastro:', error.code, error.message);
                let errorMessage = 'Erro ao cadastrar. Tente novamente.';
                if (error.code === 'auth/email-already-in-use') errorMessage = 'E-mail já cadastrado.';
                else if (error.code === 'auth/invalid-email') errorMessage = 'E-mail inválido.';
                else if (error.code === 'auth/weak-password') errorMessage = 'Senha muito fraca (mínimo 6 caracteres).';
                window.showToast(errorMessage, 'danger');
            } finally {
                window.hideLoading();
            }
        }

        // Botões da View de Perfil
        if (event.target.id === 'edit-profile-btn') {
            window.showView('edit-profile-view');
        }
        if (event.target.id === 'delete-profile-btn') {
            await window.deleteUserProfile();
        }

        // Botões da View de Dias de Treino
        if (event.target.id === 'add-day-btn') {
            const todayId = window.getCurrentDayId(); // Define o ID como a data de hoje
            const workouts = await window.loadDailyWorkouts();
            const existingDay = workouts.find(d => d.id === todayId);

            if (existingDay) {
                window.showToast('Já existe um treino para hoje. Editando o dia atual.', 'info');
                window.renderDayView(todayId);
            } else {
                // Cria um novo dia vazio se não existir
                const newDay = {
                    id: todayId,
                    date: new Date().toISOString().split('T')[0], // Apenas a data YYYY-MM-DD
                    exercises: []
                };
                workouts.push(newDay);
                await window.saveDailyWorkouts(workouts); // Salva o novo dia
                window.renderDaysView(); // Recarrega a view dos dias
                window.renderDayView(todayId); // Abre a view do novo dia
                window.showToast('Novo dia de treino adicionado!', 'success');
            }
        }
        if (event.target.classList.contains('view-day-btn')) {
            const dayId = event.target.dataset.dayId;
            window.renderDayView(dayId);
        }
        if (event.target.classList.contains('delete-day-btn')) {
            const dayId = event.target.dataset.dayId;
            await window.deleteDailyWorkout(dayId);
        }

        // Botões da View de Dia Específico
        if (event.target.id === 'add-exercise-btn') {
            window.renderExerciseSelectionView();
        }
        if (event.target.classList.contains('start-exercise-btn')) {
            const exerciseIndex = parseInt(event.target.dataset.exerciseIndex);
            const dailyWorkouts = await window.loadDailyWorkouts();
            const day = dailyWorkouts.find(d => d.id === currentDayId);
            if (day && day.exercises[exerciseIndex]) {
                window.renderExerciseExecutionView(day.exercises[exerciseIndex], exerciseIndex);
            }
        }
        if (event.target.classList.contains('edit-exercise-btn')) {
            window.showToast('Funcionalidade de edição de exercício (nome/grupo/notas) a ser implementada.', 'info');
            // TODO: Implementar edição de nome/grupo/notas de exercício
        }
        if (event.target.classList.contains('delete-exercise-btn')) {
            const exerciseIndex = parseInt(event.target.dataset.exerciseIndex);
            await window.deleteWorkoutEntry(currentDayId, exerciseIndex);
        }

        // Botões da View de Seleção de Exercício
        if (event.target.id === 'save-exercise-btn') {
            const exerciseName = document.getElementById('exercise-name-input').value.trim();
            const exerciseMuscleGroup = document.getElementById('exercise-muscle-group-input').value.trim();
            const exerciseNotes = document.getElementById('exercise-notes-input').value.trim();

            if (!exerciseName) {
                window.showToast('O nome do exercício é obrigatório.', 'danger');
                return;
            }

            const dailyWorkouts = await window.loadDailyWorkouts();
            let day = dailyWorkouts.find(d => d.id === currentDayId);

            if (!day) {
                // Isso não deveria acontecer se o currentDayId é sempre válido, mas é um fallback
                window.showToast('Erro: Dia de treino não encontrado para adicionar exercício.', 'danger');
                return;
            }

            if (!day.exercises) {
                day.exercises = [];
            }
            day.exercises.push({
                name: exerciseName,
                muscleGroup: exerciseMuscleGroup,
                notes: exerciseNotes,
                sets: [] // Inicializa um array vazio para os sets
            });

            // Encontra e atualiza o dia no array principal
            const dayIndex = dailyWorkouts.findIndex(d => d.id === currentDayId);
            if (dayIndex !== -1) {
                dailyWorkouts[dayIndex] = day;
                await window.saveDailyWorkouts(dailyWorkouts); // Salva todos os treinos atualizados
                window.showToast('Exercício adicionado!', 'success');
                window.renderDayView(currentDayId); // Retorna e recarrega a view do dia
            } else {
                window.showToast('Erro interno ao salvar exercício.', 'danger');
            }
        }
        if (event.target.id === 'cancel-exercise-btn') {
            window.renderDayView(currentDayId); // Volta para a view do dia sem adicionar
        }

        // Botões da View de Execução de Exercício
        // Botão Completar Set
        if (event.target.id === 'complete-set-btn') {
            const repsInput = document.getElementById('execution-reps');
            const weightInput = document.getElementById('execution-weight');

            const rawRepsValue = repsInput.value;
            const rawWeightValue = weightInput.value;

            // --- DEPURACAO E CORREÇÃO PARA EXECUTION-WEIGHT NO IPHONE ---
            // A linha abaixo é crucial para lidar com vírgulas como separadores decimais
            const normalizedWeightValue = rawWeightValue.replace(',', '.');

            const parsedWeight = parseFloat(normalizedWeightValue);
            const parsedReps = parseInt(rawRepsValue);

            // Validação
            if (isNaN(parsedReps) || parsedReps <= 0) {
                window.showToast('Por favor, insira um número de repetições válido e positivo.', 'danger');
                repsInput.focus();
                return;
            }
            if (isNaN(parsedWeight) || parsedWeight < 0) { // Peso pode ser 0 para peso corporal/barra
                window.showToast('Por favor, insira um peso válido e não negativo (use ponto ou vírgula).', 'danger');
                weightInput.focus();
                return;
            }

            await window.addSetToCurrentExercise(parsedWeight, parsedReps);
            // Limpa os campos após adicionar o set para facilitar a entrada do próximo
            weightInput.value = '';
            repsInput.value = '';
            weightInput.focus(); // Coloca o foco de volta no campo de peso
        }
        // Botão Adicionar Set (Manual)
        if (event.target.id === 'add-set-manually-btn') {
            const repsInput = document.getElementById('execution-reps');
            const weightInput = document.getElementById('execution-weight');

            const rawRepsValue = repsInput.value;
            const rawWeightValue = weightInput.value;

            const normalizedWeightValue = rawWeightValue.replace(',', '.');

            const parsedWeight = parseFloat(normalizedWeightValue);
            const parsedReps = parseInt(rawRepsValue);

            if (isNaN(parsedReps) || parsedReps <= 0) {
                window.showToast('Por favor, insira um número de repetições válido e positivo.', 'danger');
                repsInput.focus();
                return;
            }
            if (isNaN(parsedWeight) || parsedWeight < 0) {
                window.showToast('Por favor, insira um peso válido e não negativo (use ponto ou vírgula).', 'danger');
                weightInput.focus();
                return;
            }

            await window.addSetToCurrentExercise(parsedWeight, parsedReps, true); // Passa true para isManual
            weightInput.value = '';
            repsInput.value = '';
            weightInput.focus();
        }

        // Botão Resetar Exercício
        if (event.target.id === 'reset-exercise-btn') {
            await window.resetExercise();
        }
        // Botão Finalizar Exercício
        if (event.target.id === 'finish-exercise-btn') {
            window.showView('day-view'); // Volta para a view do dia
            window.renderDayView(currentDayId); // Recarrega a view do dia
            window.resetTimer(); // Para e reseta o timer
            window.releaseWakeLock(); // Libera o wake lock
        }

        // Botões de edição/exclusão de set dentro da lista
        if (event.target.classList.contains('delete-set-btn')) {
            const setIndexToDelete = parseInt(event.target.dataset.setIndex);
            await window.deleteSetFromExercise(setIndexToDelete);
        }
        if (event.target.classList.contains('edit-set-btn')) {
            const setIndexToEdit = parseInt(event.target.dataset.setIndex);
            await window.editSetInExercise(setIndexToEdit);
        }

        // Botões do Timer
        if (event.target.id === 'timer-start-pause') {
            if (isTimerRunning) {
                window.pauseTimer();
            } else {
                window.startTimer();
            }
        }
        if (event.target.id === 'timer-reset') {
            window.resetTimer();
        }

        // Botão de Progresso (selecionar exercício no gráfico)
        // O listener principal para o select já é window.handleProgressExerciseChange
        if (event.target.id === 'progress-exercise-select') {
            // Este evento é manipulado pela função específica handleProgressExerciseChange
            // que é anexada diretamente ao select
            return;
        }
    });
}); // Fim DOMContentLoaded

// =============================================================
//               AUXILIAR FUNCTIONS (For DailyWorkouts/Days)
// =============================================================

// Retorna o ID do dia atual no formato YYYY-MM-DD
window.getCurrentDayId = function() {
    const today = new Date();
    return today.toISOString().split('T')[0];
};