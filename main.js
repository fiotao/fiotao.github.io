import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, addDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


window.wakeLock = null; // Variável global para armazenar o wake lock
window.requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
        try {
            window.wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock ativo!');
            window.showToast('Tela permanecerá ativa durante o treino.', 'success');

            // Adiciona um listener para re-solicitar o wake lock se ele for liberado
            // (por exemplo, se a tela for desligada manualmente pelo usuário e ligada novamente)
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
        window.showToast('API Wake Lock não suportada.', 'info');
    }
};

/**
 * Libera o wake lock, permitindo que a tela volte a bloquear.
 */
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
// Global Helper Functions
/**
 * Exibe uma mensagem de "toast" temporária na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - Tipo de mensagem (e.g., 'success', 'danger', 'info').
 */
window.showToast = function(message, type = 'info') {
    const toast = document.getElementById('toast-message');
    toast.textContent = message;
    toast.className = `toast-message show ${type}`; // Add type class
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
 * Exibe um modal de confirmação personalizado.
 * @param {string} message - A mensagem a ser exibida no modal.
 * @param {Function} onConfirm - Callback a ser executado se o usuário confirmar.
 */
window.showConfirmModal = function(message, onConfirm) {
    const modal = document.getElementById('custom-confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');

    confirmMessage.textContent = message;
    modal.style.display = 'flex'; // Use flex to center

    const handleYes = () => {
        onConfirm();
        modal.style.display = 'none';
        confirmYes.removeEventListener('click', handleYes);
        confirmNo.removeEventListener('click', handleNo);
    };

    const handleNo = () => {
        modal.style.display = 'none';
        confirmYes.removeEventListener('click', handleYes);
        confirmNo.removeEventListener('click', handleNo);
    };

    confirmYes.addEventListener('click', handleYes);
    confirmNo.addEventListener('click', handleNo);
};

// Global variables for workout data and state
window.allWorkoutData = {}; // Stores custom and predefined workout templates
window.workoutHistory = []; // Stores completed workout sessions
window.currentWorkout = null; // The workout currently being executed
window.workoutTimerInterval = null; // Interval for the main workout timer
window.totalWorkoutSeconds = 0; // Total seconds for the main workout timer
window.currentDayId = null; // ID of the day being edited/viewed
window.currentExerciseIndex = 0; // Tracks the currently active exercise in execution view
window.currentSetIndex = 0; // Tracks the currently active set within an exercise

// Global rest timer variables
window.globalRestTimerInterval = null;
window.globalRestSeconds = 0;
window.globalRestType = null; // 'set' or 'exercise' to know what to do after rest

// Chart.js instances to destroy and re-create
window.volumeChartInstance = null;
window.prChartInstance = null;
window.frequentExercisesChartInstance = null;
window.averageWorkoutTimeChartInstance = null;

// --- Predefined Workout Templates ---
const predefinedWorkoutTemplates = [
    {
        day: 1,
        title: "Peito, ombro, tríceps e antebraço",
        image: "https://images.unsplash.com/photo-1594915447192-d62153549646?q=80&w=1770&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        exercises: [
            { name: "Supino máquina", sets: 3, reps: "6-8", rest: 60, image: "./images/supino_maquina.png", description: "Foco no peitoral e ombros, com segurança da máquina.", videoUrl: "https://musclewiki.com/exercises/female/chest", muscleGroup: "Peito, Ombro, Tríceps" },
            { name: "Supino inclinado", sets: 2, reps: "8-10", rest: 60, image: "./images/supino_inclinado.png", description: "Trabalha a parte superior do peitoral.", videoUrl: "https://musclewiki.com/barbell/male/anterior-deltoid/barbell-incline-bench-press/", muscleGroup: "Peito (Superior), Ombro, Tríceps" },
            { name: "Crucifixo com halter", sets: 2, reps: "8-12", rest: 60, image: "./images/cruxifixo_halter.png", description: "Isolamento do peitoral, alongando as fibras musculares.", videoUrl: "https://www.youtube.com/watch?v=_kpKlYexyXs", muscleGroup: "Peito" },
            { name: "Desenvolvimento com halteres", sets: 3, reps: "6-10", rest: 60, image: "./images/desenvolvimento_halteres.png", description: "Exercício composto para ombros, trabalha deltoides.", videoUrl: "https://musclewiki.com/dumbbells/male/shoulders/dumbbell-shoulder-press/", muscleGroup: "Ombro, Tríceps" },
            { name: "Elevação lateral", sets: 3, reps: "10-12", rest: 45, image: "./images/elevacao_lateral.png", description: "Isolamento deltoide lateral para maior largura.", videoUrl: "https://musclewiki.com/dumbbells/male/shoulders/dumbbell-lateral-raise/", muscleGroup: "Ombro" },
            { name: "Tríceps paralela", sets: 3, reps: "8-12", rest: 45, image: "./images/triceps_paralela.png", description: "Exercício eficaz para o tríceps, pode ser feito em máquina ou barra.", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", muscleGroup: "Tríceps" },
            { name: "Tríceps francês na polia", sets: 2, reps: "8-12", rest: 45, image: "./images/triceps_frances.png", description: "Foco na cabeça longa do tríceps.", videoUrl: "https://musclewiki.com/pt-br/cables/male/triceps/cable-rope-overhead-tricep-extension/", muscleGroup: "Tríceps" },
            { name: "Rosca punho inversa", sets: 3, reps: "12-15", rest: 30, image: "./images/rosca_punho_inversa.png", description: "Fortalecimento dos extensores do antebraço.", videoUrl: "https://www.youtube.com/watch?v=EA7u4Q_8j0I", muscleGroup: "Antebraço" },
            { name: "Rosca punho", sets: 3, reps: "12-15", rest: 30, image: "./images/rosca_punho.png", description: "Fortalecimento dos flexores do antebraço.", videoUrl: "https://www.youtube.com/watch?v=EA7u4Q_8j0I", muscleGroup: "Antebraço" }
        ]
    },
    {
        day: 2,
        title: "Costas, bíceps e ombro",
        image: "https://images.unsplash.com/photo-1549476468-382a93796d11?q=80&w=1770&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        exercises: [
            { name: "Puxada triângulo", sets: 3, reps: "6-8", rest: 60, image: "./images/puxada_triangulo.png", description: "Trabalha a largura das costas, com foco nos dorsais.", videoUrl: "https://musclewiki.com/barbell/male/biceps/barbell-bent-over-row", muscleGroup: "Costas, Bíceps" },
            { name: "Remada curvada", sets: 3, reps: "6-10", rest: 60, image: "./images/remada_curvada.png", description: "Exercício composto para espessura das costas.", videoUrl: "https://musclewiki.com/Barbell/Female/Shoulders/Barbell-Upright-Row", muscleGroup: "Costas, Bíceps" },
            { name: "Remada aberta", sets: 3, reps: "8-10", rest: 60, image: "./images/remada_aberta.png", description: "Foco na parte superior das costas e trapézio.", videoUrl: "https://musclewiki.com/barbell/male/lats/barbell-bent-over-row/", muscleGroup: "Costas" },
            { name: "Rosca scott", sets: 3, reps: "8-12", rest: 45, image: "./images/rosca_scott.png", description: "Isolamento do bíceps, com apoio para evitar roubo.", videoUrl: "https://musclewiki.com/pt-br/barbell/male/biceps/ez-bar-reverse-preacher-curl", muscleGroup: "Bíceps" },
            { name: "Rosca no banco inclinado", sets: 2, reps: "8-12", rest: 45, image: "./images/rosca_banco_inclinado.png", description: "Alongamento máximo do bíceps, ideal para pico.", videoUrl: "https://musclewiki.com/dumbbells/male/shoulders/dumbbell-seated-single-arm-arnold-press", muscleGroup: "Bíceps" },
            { name: "Elevação frontal", sets: 3, reps: "10-12", rest: 45, image: "./images/elevacao_frontal.png", description: "Foco na parte anterior do ombro.", videoUrl: "https://musclewiki.com/dumbbells/male/shoulders/dumbbell-front-raise/", muscleGroup: "Ombro" },
            { name: "Remada alta", sets: 3, reps: "8-10", rest: 60, image: "./images/remada_alta.png", description: "Trabalha os trapézios e deltoides laterais.", videoUrl: "https://musclewiki.com/barbell/male/traps/barbell-upright-row/", muscleGroup: "Ombro, Trapézio" }
        ]
    },
    {
        day: 3,
        title: "Pernas completo 1",
        image: "https://images.unsplash.com/photo-1594915447192-d62153549646?q=80&w=1770&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        exercises: [
            { name: "Agachamento livre", sets: 4, reps: "6-8", rest: 90, image: "./images/agachamento_livre.png", description: "Exercício fundamental para pernas e glúteos.", videoUrl: "https://musclewiki.com/barbell/male/quadriceps/barbell-back-squat/", muscleGroup: "Pernas, Glúteos" },
            { name: "Stiff com barra", sets: 3, reps: "6-8", rest: 60, image: "./images/stiff_barra.png", description: "Trabalha isquiotibiais e glúteos, com foco na posterior.", videoUrl: "https://musclewiki.com/barbell/male/gluteus-maximus/barbell-stiff-leg-deadlifts", muscleGroup: "Isquiotibiais, Glúteos" },
            { name: "Cadeira extensora", sets: 3, reps: "8-12", rest: 45, image: "./images/cadeira_extensora.png", description: "Isolamento do quadríceps.", videoUrl: "https://totalpass.com/br/blog/atividade-fisica/cadeira-extensora-o-que-e-e-como-fazer/", muscleGroup: "Quadríceps" },
            { name: "Cadeira flexora", sets: 3, reps: "8-12", rest: 45, image: "./images/cadeira_flexora.png", description: "Isolamento dos isquiotibiais.", videoUrl: "https://www.youtube.com/watch?v=e0_xHkXw350", muscleGroup: "Isquiotibiais" },
            { name: "Afundo com halteres", sets: 3, reps: "8-10", rest: 60, image: "./images/afundo_halteres.png", description: "Exercício unilateral para pernas e glúteos.", videoUrl: "https://musclewiki.com/dumbbells/male/quadriceps/dumbbell-lunges/", muscleGroup: "Pernas, Glúteos" },
            { name: "Panturrilha no leg press", sets: 4, reps: "15-20", rest: 30, image: "./images/panturrilha_legpress.png", description: "Amplitude maior para trabalhar a panturrilha.", videoUrl: "https://www.youtube.com/watch?v=Gf7B6Mr4fC4", muscleGroup: "Panturrilha" },
            { name: "Panturrilha sentado", sets: 4, reps: "15-20", rest: 30, image: "./images/panturrilha_sentado.png", description: "Foco no sóleo (parte inferior da panturrilha).", videoUrl: "https://www.youtube.com/watch?v=Bx6elAOgxMI", muscleGroup: "Panturrilha" },                  
            { name: "Panturrilha em pé", sets: 4, reps: "15-20", rest: 30, image: "./images/panturrilha_pe.png", description: "Foco no gastrocnêmio (parte superior da panturrilha).", videoUrl: "https://musclewiki.com/bodyweight/male/calves/standing-calf-raise/", muscleGroup: "Panturrilha" },
            { name: "Abdominal supra", sets: 3, reps: "12-15", rest: 30, image: "./images/abdominal_supra.png", description: "Trabalha a parte superior do abdômen.", videoUrl: "https://musclewiki.com/bodyweight/male/abdominals/2", muscleGroup: "Abdômen" }
        ]
    },
    {
        day: 4,
        title: "Superiores completo e antebraço",
        image: "https://images.unsplash.com/photo-1541592106381-b31649479354?q=80&w=1770&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        exercises: [
            { name: "Supino máquina", sets: 3, reps: "6-8", rest: 60, image: "./images/supino_maquina.png", description: "Foco no peitoral e ombros, com segurança da máquina.", videoUrl: "https://musclewiki.com/exercises/female/chest", muscleGroup: "Peito, Ombro, Tríceps" },
            { name: "Supino inclinado", sets: 2, reps: "8-10", rest: 60, image: "./images/supino_inclinado.png", description: "Variação para a parte superior do peito.", videoUrl: "https://musclewiki.com/barbell/male/anterior-deltoid/barbell-incline-bench-press/", muscleGroup: "Peito (Superior), Ombro, Tríceps" },
            { name: "Puxada triângulo", sets: 3, reps: "6-8", rest: 60, image: "./images/puxada_triangulo.png", description: "Trabalha a largura das costas, com foco nos dorsais.", videoUrl: "https://musclewiki.com/barbell/male/biceps/barbell-bent-over-row", muscleGroup: "Costas, Bíceps" },
            { name: "Remada aberta", sets: 2, reps: "8-10", rest: 60, image: "./images/remada_aberta.png", description: "Foco na parte superior das costas e trapézio.", videoUrl: "https://musclewiki.com/barbell/male/lats/barbell-bent-over-row/", muscleGroup: "Costas" },
            { name: "Desenvolvimento Arnold", sets: 3, reps: "8-10", rest: 60, image: "./images/desenvolvimento_arnold.png", description: "Variação completa para ombros com rotação.", videoUrl: "https://musclewiki.com/dumbbells/male/shoulders/dumbbell-arnold-press/", muscleGroup: "Ombro" },
            { name: "Elevação lateral inclinada", sets: 3, reps: "10-12", rest: 45, image: "./images/elevacao_lateral_inclinada.png", description: "Maior ênfase na parte posterior do deltoide.", videoUrl: "https://www.youtube.com/watch?v=Z2G8DBaT9U4", muscleGroup: "Ombro" },
            { name: "Tríceps na polia", sets: 2, reps: "8-12", rest: 45, image: "./images/triceps_polia.png", description: "Variação para o tríceps, com foco na contração.", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", muscleGroup: "Tríceps" },
            { name: "Rosca punho inversa", sets: 3, reps: "12-15", rest: 30, image: "./images/rosca_punho_inversa.png", description: "Fortalecimento dos extensores do antebraço.", videoUrl: "https://www.youtube.com/watch?v=EA7u4Q_8j0I", muscleGroup: "Antebraço" },
            { name: "Rosca punho", sets: 3, reps: "12-15", rest: 30, image: "./images/rosca_punho.png", description: "Fortalecimento dos flexores do antebraço.", videoUrl: "https://www.youtube.com/watch?v=EA7u4Q_8j0I", muscleGroup: "Antebraço" }
        ]
    },
    {
        day: 5,
        title: "Pernas completo 2",
        image: "https://images.unsplash.com/photo-1594915447192-d62153549646?q=80&w=1770&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        exercises: [
            { name: "Leg press 45°", sets: 4, reps: "6-8", rest: 90, image: "./images/leg_press.png", description: "Exercício composto para pernas, com foco em quadríceps e glúteos.", videoUrl: "https://gears.com.br/produto/leg-press-45-gym-line-gears/", muscleGroup: "Pernas, Glúteos" },
            { name: "Cadeira flexora", sets: 3, reps: "6-10", rest: 60, image: "./images/cadeira_flexora.png", description: "Isolamento dos isquiotibiais.", videoUrl: "https://www.youtube.com/watch?v=e0_xHkXw350", muscleGroup: "Isquiotibiais" },
            { name: "Cadeira extensora", sets: 3, reps: "8-12", rest: 45, image: "./images/cadeira_extensora.png", description: "Isolamento do quadríceps.", videoUrl: "https://totalpass.com/br/blog/atividade-fisica/cadeira-extensora-o-que-e-e-como-fazer/", muscleGroup: "Quadríceps" },
            { name: "Mesa flexora", sets: 3, reps: "8-12", rest: 45, image: "./images/mesa_flexora.png", description: "Outra opção para isolar os isquiotibiais, deitado.", videoUrl: "https://www.tuasaude.com/mesa-flexora/", muscleGroup: "Isquiotibiais" },
            { name: "Agachamento búlgaro", sets: 3, reps: "8-10", rest: 60, image: "./images/agachamento_bulgaro.png", description: "Exercício unilateral intenso para pernas e glúteos.", videoUrl: "https://musclewiki.com/dumbbells/male/quadriceps/dumbbell-bulgarian-split-squat/", muscleGroup: "Pernas, Glúteos" },
            { name: "Panturrilha unilateral", sets: 4, reps: "12-15", rest: 30, image: "./images/panturrilha_unilateral.png", description: "Trabalho individualizado para cada panturrilha.", videoUrl: "https://www.youtube.com/watch?v=9CPrrmusOu8", muscleGroup: "Panturrilha" },
            { name: "Panturrilha no burrinho", sets: 4, reps: "15-20", rest: 30, image: "./images/panturrilha_burrinho.png", description: "Exercício tradicional com foco na amplitude.", videoUrl: "https://www.youtube.com/watch?v=JbyjNymZOt0", muscleGroup: "Panturrilha" },
            { name: "Panturrilha no smith", sets: 4, reps: "15-20", rest: 30, image: "./images/panturrilha_smith.png", description: "Fortalecimento da panturrilha com estabilidade.", videoUrl: "https://musclewiki.com/exercises/male/soleus", muscleGroup: "Panturrilha" },
            { name: "Abdominal máquina", sets: 3, reps: "12-15", rest: 30, image: "./images/abdominal_maquina.png", description: "Trabalha o abdômen com assistência da máquina.", videoUrl: "https://www.youtube.com/watch?v=4SR93vi2ZKw&pp=0gcJCdgAo7VqN5tD", muscleGroup: "Abdômen" }
        ]
    }
];

// --- Persistência de Dados (Firebase Firestore) ---

/**
 * Salva allWorkoutData e workoutHistory no Firestore para o usuário atual.
 */
window.saveData = async function() {
    if (!window.currentUserId || !window.db || !window.isFirebaseInitialized) {
        window.showToast('Erro: Não logado ou Firebase não pronto. Não foi possível salvar os dados.', 'danger');
        return;
    }

    const userId = window.currentUserId;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    try {
        // Save workout templates
        const workoutDataRef = doc(window.db, `artifacts/${appId}/users/${userId}/workoutData`, 'templates');
        await setDoc(workoutDataRef, { data: JSON.stringify(window.allWorkoutData) });

        // Save workout history
        const workoutHistoryRef = doc(window.db, `artifacts/${appId}/users/${userId}/workoutHistory`, 'history');
        await setDoc(workoutHistoryRef, { data: JSON.stringify(window.workoutHistory) });

        window.showToast('Dados salvos automaticamente!', 'info');
    } catch (e) {
        window.showToast('Erro ao salvar dados!', 'danger');
    }
}

/**
 * Carrega allWorkoutData e workoutHistory do Firestore para o usuário atual.
 * Se não houver dados, inicializa com templates predefinidos.
 */
window.loadData = async function() {
    if (!window.currentUserId || !window.db || !window.isFirebaseInitialized) {
        window.allWorkoutData = {};
        window.workoutHistory = [];
        return;
    }

    const userId = window.currentUserId;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    let loadedWorkoutData = {};
    let loadedWorkoutHistory = [];

    try {
        // Load workout templates
        const workoutDataRef = doc(window.db, `artifacts/${appId}/users/${userId}/workoutData`, 'templates');
        const workoutDataSnap = await getDoc(workoutDataRef);

        if (workoutDataSnap.exists() && workoutDataSnap.data().data) {
            loadedWorkoutData = JSON.parse(workoutDataSnap.data().data);
        }

        // Load workout history
        const workoutHistoryRef = doc(window.db, `artifacts/${appId}/users/${userId}/workoutHistory`, 'history');
        const workoutHistorySnap = await getDoc(workoutHistoryRef);

        if (workoutHistorySnap.exists() && workoutHistorySnap.data().data) {
            loadedWorkoutHistory = JSON.parse(workoutHistorySnap.data().data);
        }

    } catch (e) {
        window.showToast('Erro ao carregar dados.', 'danger');
    }
    
    // Merge predefined templates with loaded data, if they don't already exist
    let updatedWorkoutData = { ...loadedWorkoutData }; // Start with loaded data
    let needsSave = false;

    predefinedWorkoutTemplates.forEach((dayData) => {
        const predefinedDayId = `predefined-${dayData.day}`;
        // Check if a day with the same 'day' number (for predefined templates) exists
        const dayExists = Object.values(updatedWorkoutData).some(
            existingDay => existingDay.isCustom === false && existingDay.day === dayData.day
        );

        if (!dayExists) {
            updatedWorkoutData[predefinedDayId] = {
                ...dayData,
                id: predefinedDayId,
                isCustom: false,
                exercises: dayData.exercises.map(exercise => ({
                    ...exercise,
                    sets: Array.from({ length: parseInt(exercise.sets) || 0 }, () => ({ reps: parseInt(String(exercise.reps).split('-')[0]) || 0, weight: 0 }))
                }))
            };
            needsSave = true; // Mark for saving if new predefined days were added
        }
    });

    window.allWorkoutData = updatedWorkoutData;
    window.workoutHistory = loadedWorkoutHistory;

    // Normalize loaded data
    for (const dayId in window.allWorkoutData) {
        if (window.allWorkoutData.hasOwnProperty(dayId)) {
            window.allWorkoutData[dayId].exercises = window.allWorkoutData[dayId].exercises.map(exercise => {
                let normalizedSets = [];
                if (Array.isArray(exercise.sets)) {
                    normalizedSets = exercise.sets.map(set => {
                        if (typeof set === 'object' && set !== null && 'reps' in set && 'weight' in set) {
                            return { reps: parseInt(set.reps) || 0, weight: parseFloat(set.weight) || 0 };
                        } else {
                            return { reps: parseInt(set) || 0, weight: 0 };
                        }
                    });
                } else if (typeof exercise.sets === 'number') {
                    normalizedSets = Array.from({ length: exercise.sets }, () => ({ reps: 0, weight: 0 }));
                } else {
                    normalizedSets = [{ reps: 0, weight: 0 }];
                }
                return { ...exercise, sets: normalizedSets };
            });
        }
    }

    // Normalize loaded history data
    window.workoutHistory = window.workoutHistory.map(workout => ({
        ...workout,
        exercises: workout.exercises.map(exercise => {
            let normalizedSets = [];
            if (Array.isArray(exercise.sets)) {
                normalizedSets = exercise.sets.map(set => {
                    if (typeof set === 'object' && set !== null && 'reps' in set && 'weight' in set) {
                        return { reps: parseInt(set.reps) || 0, weight: parseFloat(set.weight) || 0 };
                    }
                });
            } else if (typeof exercise.sets === 'number') {
                normalizedSets = Array.from({ length: exercise.sets }, () => ({ reps: 0, weight: 0 }));
            } else {
                normalizedSets = [{ reps: 0, weight: 0 }];
            }
            return { ...exercise, sets: normalizedSets };
        })
    }));

    if (needsSave) {
        await window.saveData(); // Save if new predefined days were added
        window.showToast('Novos modelos de treino adicionados e dados atualizados!', 'info');
    } else {
        window.showToast('Dados carregados com sucesso!', 'info');
    }
}

/**
 * Salva os dados do perfil do usuário no Firestore.
 */
window.saveUserProfile = async function() {
    if (!window.currentUserId || !window.db || !window.isFirebaseInitialized) {
        window.showToast('Erro: Não logado ou Firebase não pronto. Não foi possível salvar o perfil.', 'danger');
        return;
    }
    const userId = window.currentUserId;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userProfileRef = doc(window.db, `artifacts/${appId}/users/${userId}/profile`, 'data');

    try {
        await setDoc(userProfileRef, window.userProfile); // Save the entire window.userProfile object
        window.showToast('Perfil atualizado com sucesso!', 'success');
        // Update display immediately
        document.getElementById('user-display-info').textContent = `Bem-vindo(a), ${window.userProfile.name || (window.auth.currentUser ? window.auth.currentUser.email : '')}!`;
    } catch (e) {
        window.showToast('Erro ao salvar perfil!', 'danger');
    }
};


// --- Alternador de Tema ---
const darkModeToggle = document.getElementById('darkModeToggle');

/**
 * Aplica o tema (claro ou escuro) ao corpo do documento.
 * @param {boolean} isDark - true para modo escuro, false para modo claro.
 */
window.applyTheme = function(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('darkMode', isDark);
    darkModeToggle.checked = isDark;
}

darkModeToggle.addEventListener('change', () => {
    window.applyTheme(darkModeToggle.checked);
});

// --- Gerenciamento de Views ---

/**
 * Mostra a seção da aplicação correspondente ao viewId.
 * @param {string} viewId - O ID da seção a ser exibida.
 */
window.showView = function(viewId) {
    document.querySelectorAll('.app-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(viewId).style.display = 'block';

    if (viewId === 'days-view') {
        window.initWorkoutDays();
    } else if (viewId === 'history-view') {
        window.renderHistory();
    } else if (viewId === 'dashboard-view') {
        window.updateDashboard();
    } else if (viewId === 'profile-view') {
        window.renderUserProfileView();
    }
	 if (viewId !== 'exercise-execution-view' && window.wakeLock) { // Substitua 'exercise-execution-view' pelo ID da sua seção de execução de treino
        window.releaseWakeLock();
    }
}

// --- Gerenciamento de Dias de Treino (Days View) ---

/**
 * Inicializa e renderiza a lista de dias de treino.
 */
window.initWorkoutDays = function() {
    const workoutDaysList = document.getElementById('workout-days-list');
    workoutDaysList.innerHTML = '';

    const sortedWorkoutKeys = Object.keys(window.allWorkoutData).sort((a, b) => {
        const dayA = window.allWorkoutData[a].day || Infinity;
        const dayB = window.allWorkoutData[b].day || Infinity;

        const isAPredefined = window.allWorkoutData[a].isCustom === false;
        const isBPredefined = window.allWorkoutData[b].isCustom === false;

        if (isAPredefined && !isBPredefined) return -1;
        if (!isAPredefined && isBPredefined) return 1;

        if (isAPredefined && isBPredefined) {
            return dayA - dayB;
        }

        return (window.allWorkoutData[a].title || window.allWorkoutData[a].name).localeCompare(window.allWorkoutData[b].title || window.allWorkoutData[b].name);
    });

    if (sortedWorkoutKeys.length === 0) {
        workoutDaysList.innerHTML = '<p>Nenhum dia de treino criado ainda. Clique em "Adicionar Novo Dia" para começar!</p>';
        return;
    }

    sortedWorkoutKeys.forEach(dayId => {
        const dayData = window.allWorkoutData[dayId];
        const dayItem = document.createElement('div');
        dayItem.classList.add('workout-day-item', 'card');

        let displayTitle;
        if (dayData.isCustom === false) {
            displayTitle = `Dia ${dayData.day} - ${dayData.title || dayData.name}`;
        } else {
            displayTitle = dayData.title || dayData.name;
        }

        dayItem.innerHTML = `
            <div>
                <h3>${displayTitle}</h3>
                <p>${dayData.exercises.length} exercícios</p>
            </div>
            <div class="actions">
                <button class="btn btn-primary btn-sm start-workout-btn" data-id="${dayId}"><i class="fas fa-play"></i> Iniciar</button>
                <button class="btn btn-info btn-sm edit-day-btn" data-id="${dayId}"><i class="fas fa-edit"></i> Editar</button>
            </div>
        `;
        workoutDaysList.appendChild(dayItem);
    });

    document.querySelectorAll('.start-workout-btn').forEach(button => {
        button.addEventListener('click', function() {
            window.startWorkout(this.dataset.id);
        });
    });

    document.querySelectorAll('.edit-day-btn').forEach(button => {
        button.addEventListener('click', function() {
            window.editWorkoutDay(this.dataset.id);
        });
		 window.requestWakeLock(); // Solicita o wake lock
    });
}

// Event listener para adicionar um novo dia
document.getElementById('add-day-btn').addEventListener('click', () => {
    window.currentDayId = 'new-day-' + Date.now(); // Gera um ID único para um novo dia
    window.allWorkoutData[window.currentDayId] = {
        id: window.currentDayId,
        name: 'Novo Treino',
        title: 'Novo Treino Personalizado', // Usa o título para exibição na lista principal
        isCustom: true,
        exercises: []
    };
    window.editWorkoutDay(window.currentDayId);
});

// --- Gerenciamento da View de Detalhes do Dia ---

/**
 * Carrega os detalhes de um dia de treino para edição ou criação.
 * @param {string} id - O ID do dia de treino.
 */
window.editWorkoutDay = function(id) {
    window.currentDayId = id;
    const dayData = window.allWorkoutData[id];

    document.getElementById('day-details-title').textContent = dayData.title || dayData.name;
    document.getElementById('day-name-input').value = dayData.title || dayData.name;

    // Mostra o botão de exclusão para dias personalizados, oculta para predefinidos
    const deleteBtn = document.getElementById('delete-day-btn');
    if (dayData.isCustom) {
        deleteBtn.style.display = 'inline-flex';
    } else {
        deleteBtn.style.display = 'none';
    }

    window.renderExercisesForDay(dayData.exercises);
    window.showView('day-details-view');
}

/**
 * Renderiza a lista de exercícios para o dia de treino atual.
 * @param {Array<Object>} exercises - Lista de exercícios.
 */
window.renderExercisesForDay = function(exercises) {
    const exercisesList = document.getElementById('exercises-list');
    exercisesList.innerHTML = '';

    if (exercises.length === 0) {
        exercisesList.innerHTML = '<p>Nenhum exercício adicionado a este treino ainda.</p>';
    }

    exercises.forEach((exercise, exIndex) => {
        const exerciseItem = document.createElement('div');
        exerciseItem.classList.add('exercise-item', 'card');
        exerciseItem.dataset.index = exIndex;
        exerciseItem.innerHTML = `
            <div>
                <input type="text" class="form-control exercise-name-input" value="${exercise.name}" placeholder="Nome do Exercício">
                <div class="exercise-sets" data-exercise-index="${exIndex}">
                    ${exercise.sets.map((set, setIndex) => `
                        <div class="set-input">
                            <span>Set ${setIndex + 1}:</span>
                            <input type="number" class="form-control set-reps" value="${set.reps}" placeholder="Reps" min="0">
                            <input type="number" class="form-control set-weight" value="${set.weight}" placeholder="Peso (kg)" min="0" step="0.5">
                            <button class="btn btn-danger btn-sm remove-set-btn" data-exercise-index="${exIndex}" data-set-index="${setIndex}"><i class="fas fa-minus-circle"></i></button>
                        </div>
                    `).join('')}
                    <button class="btn btn-success btn-sm add-set-btn" data-exercise-index="${exIndex}"><i class="fas fa-plus-circle"></i> Adicionar Set</button>
                </div>
                <div class="form-group" style="margin-top: 10px;">
                    <label>Descanso (segundos):</label>
                    <input type="number" class="form-control exercise-rest-input" value="${exercise.rest || 0}" min="0">
                </div>
                <div class="form-group" style="margin-top: 10px;">
                    <label>URL do Vídeo (Opcional):</label>
                    <input type="text" class="form-control exercise-video-url" value="${exercise.videoUrl || ''}" placeholder="URL do vídeo do exercício">
                </div>
            </div>
            <div class="actions">
                <button class="btn btn-danger btn-sm remove-exercise-btn" data-index="${exIndex}"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        exercisesList.appendChild(exerciseItem);
    });

    // Anexa listeners de eventos a elementos dinâmicos
    window.attachExerciseDetailListeners();
}

/**
 * Anexa listeners de eventos a elementos dinâmicos na view de detalhes do dia.
 */
window.attachExerciseDetailListeners = function() {
    document.querySelectorAll('.add-set-btn').forEach(button => {
        button.onclick = (e) => {
            const exIndex = parseInt(e.target.dataset.exerciseIndex);
            window.allWorkoutData[window.currentDayId].exercises[exIndex].sets.push({ reps: 0, weight: 0 });
            window.renderExercisesForDay(window.allWorkoutData[window.currentDayId].exercises);
        };
    });

    document.querySelectorAll('.remove-set-btn').forEach(button => {
        button.onclick = (e) => {
            const exIndex = parseInt(e.target.dataset.exerciseIndex);
            const setIndex = parseInt(e.target.dataset.setIndex);
            window.allWorkoutData[window.currentDayId].exercises[exIndex].sets.splice(setIndex, 1);
            window.renderExercisesForDay(window.allWorkoutData[window.currentDayId].exercises);
        };
    });

    document.querySelectorAll('.remove-exercise-btn').forEach(button => {
        button.onclick = (e) => {
            const exIndex = parseInt(e.target.dataset.index);
            window.showConfirmModal('Tem certeza que deseja remover este exercício?', () => {
                window.allWorkoutData[window.currentDayId].exercises.splice(exIndex, 1);
                window.renderExercisesForDay(window.allWorkoutData[window.currentDayId].exercises);
                window.saveData(); // Salva as alterações após a exclusão do exercício
                window.showToast('Exercício removido!', 'success');
            });
        };
    });

    document.getElementById('day-name-input').onchange = (e) => {
        window.allWorkoutData[window.currentDayId].name = e.target.value;
        window.allWorkoutData[window.currentDayId].title = e.target.value; // Também atualiza o título para exibição
        document.getElementById('day-details-title').textContent = e.target.value;
        window.saveData();
    };

    document.querySelectorAll('.exercise-name-input').forEach(input => {
        input.onchange = (e) => {
            const exIndex = parseInt(e.target.closest('.exercise-item').dataset.index);
            window.allWorkoutData[window.currentDayId].exercises[exIndex].name = e.target.value;
            window.saveData();
        };
    });

    document.querySelectorAll('.set-reps').forEach(input => {
        input.onchange = (e) => {
            const exIndex = parseInt(e.target.closest('.exercise-sets').dataset.exerciseIndex);
            // Encontra o setIndex usando um método mais robusto, caso a ordem mude
            const setInputDivs = Array.from(e.target.closest('.exercise-sets').querySelectorAll('.set-input'));
            const setIndex = setInputDivs.indexOf(e.target.closest('.set-input'));
            if (setIndex !== -1) {
                window.allWorkoutData[window.currentDayId].exercises[exIndex].sets[setIndex].reps = parseInt(e.target.value) || 0;
                window.saveData();
            }
        };
    });

    document.querySelectorAll('.set-weight').forEach(input => {
        input.onchange = (e) => {
            const exIndex = parseInt(e.target.closest('.exercise-sets').dataset.exerciseIndex);
            // Encontra o setIndex usando um método mais robusto, caso a ordem mude
            const setInputDivs = Array.from(e.target.closest('.exercise-sets').querySelectorAll('.set-input'));
            const setIndex = setInputDivs.indexOf(e.target.closest('.set-input'));
            if (setIndex !== -1) {
                window.allWorkoutData[window.currentDayId].exercises[exIndex].sets[setIndex].weight = parseFloat(e.target.value) || 0;
                window.saveData();
            }
        };
    });

    document.querySelectorAll('.exercise-rest-input').forEach(input => {
        input.onchange = (e) => {
            const exIndex = parseInt(e.target.closest('.exercise-item').dataset.index);
            window.allWorkoutData[window.currentDayId].exercises[exIndex].rest = parseInt(e.target.value) || 0;
            window.saveData();
        };
    });

    document.querySelectorAll('.exercise-video-url').forEach(input => {
        input.onchange = (e) => {
            const exIndex = parseInt(e.target.closest('.exercise-item').dataset.index);
            window.allWorkoutData[window.currentDayId].exercises[exIndex].videoUrl = e.target.value;
            window.saveData();
        };
    });
}

// Event listener para adicionar um novo exercício
document.getElementById('add-exercise-btn').addEventListener('click', () => {
    window.allWorkoutData[window.currentDayId].exercises.push({
        name: 'Novo Exercício',
        sets: [{ reps: 0, weight: 0 }],
        rest: 60,
        videoUrl: ''
    });
    window.renderExercisesForDay(window.allWorkoutData[window.currentDayId].exercises);
    window.saveData();
});

// Event listener para salvar o dia
document.getElementById('save-day-btn').addEventListener('click', () => {
    // Já salvando na mudança, então este botão principalmente navega de volta
    window.showToast('Treino salvo com sucesso!', 'success');
    window.showView('days-view');
});

// Event listener para excluir um dia de treino
document.getElementById('delete-day-btn').addEventListener('click', () => {
    window.showConfirmModal('Tem certeza que deseja excluir este dia de treino? Esta ação é irreversível.', () => {
        if (window.allWorkoutData[window.currentDayId] && window.allWorkoutData[window.currentDayId].isCustom) {
            delete window.allWorkoutData[window.currentDayId];
            window.saveData();
            window.showToast('Dia de treino excluído!', 'success');
            window.showView('days-view');
        } else {
            window.showToast('Não é possível excluir treinos predefinidos.', 'danger');
        }
    });
});

// --- View de Execução de Treino ---

/**
 * Inicia a execução de um treino.
 * @param {string} dayId - O ID do dia de treino a ser executado.
 */
window.startWorkout = function(dayId) {
    window.currentWorkout = JSON.parse(JSON.stringify(window.allWorkoutData[dayId])); // Cópia profunda
    window.currentWorkout.originalId = dayId; // Mantém o control do ID do template original
    window.currentWorkout.executionExercises = window.currentWorkout.exercises.map(ex => ({
        ...ex,
        completedSets: Array.from({ length: ex.sets.length }, () => ({ reps: 0, weight: 0 })), // Inicializa completedSets com objetos vazios
        isCompleted: false
    }));

    document.getElementById('workout-execution-title').textContent = window.currentWorkout.title || window.currentWorkout.name;
    window.currentExerciseIndex = 0; // Começa com o primeiro exercício
    window.currentSetIndex = 0; // Começa com o primeiro set do primeiro exercício
    
    window.showView('workout-execution-view');
    window.renderWorkoutExecution();
    window.startTotalWorkoutTimer();
}

/**
 * Renderiza o exercício atual para a execução do treino.
 */
window.renderWorkoutExecution = function() {
    const executionList = document.getElementById('workout-execution-exercises');
    if (!executionList) return; 

    if (!window.currentWorkout || !Array.isArray(window.currentWorkout.executionExercises)) {
        executionList.innerHTML = '<p style="text-align: center;">Nenhum treino ativo para exibir.</p>';
        const currentExerciseDisplay = document.getElementById('current-exercise-display');
        const finishWorkoutBtn = document.getElementById('finish-workout-btn');
        const cancelWorkoutBtn = document.getElementById('cancel-workout-btn');

        if (currentExerciseDisplay) currentExerciseDisplay.style.display = 'none';
        if (finishWorkoutBtn) finishWorkoutBtn.style.display = 'none';
        if (cancelWorkoutBtn) cancelWorkoutBtn.style.display = 'none';
        
        window.stopTotalWorkoutTimer();
        window.stopGlobalRestTimer();
        return;
    }
    
    executionList.innerHTML = ''; 

    const currentExercise = window.currentWorkout.executionExercises[window.currentExerciseIndex];
    const totalExercises = window.currentWorkout.executionExercises.length; // Total de exercícios
    const currentExerciseDisplay = document.getElementById('current-exercise-display');
    const finishWorkoutBtn = document.getElementById('finish-workout-btn');
    const cancelWorkoutBtn = document.getElementById('cancel-workout-btn');

    if (!currentExercise) {
        if (currentExerciseDisplay) currentExerciseDisplay.style.display = 'none';
        executionList.innerHTML = '<p style="text-align: center;">Todos os exercícios do treino foram concluídos!</p>';
        
        if (finishWorkoutBtn) finishWorkoutBtn.style.display = 'inline-flex';
        if (cancelWorkoutBtn) cancelWorkoutBtn.style.display = 'inline-flex';
        
        window.showToast('Todos os exercícios do treino concluídos!', 'success');
        window.stopTotalWorkoutTimer();
        return; 
    }
	
    if (currentExerciseDisplay) {
        // Atualiza a exibição para incluir o contador
        currentExerciseDisplay.style.display = 'block';
        currentExerciseDisplay.textContent = `Exercício Atual: ${currentExercise.name} (${window.currentExerciseIndex + 1} de ${totalExercises})`;
    }
    
    const exerciseEl = document.createElement('div');
    exerciseEl.classList.add('exercise-execution-card', 'card');
    exerciseEl.dataset.index = window.currentExerciseIndex;

    let imageHtml = '';
    if (currentExercise.image) {
        imageHtml = `<img src="${currentExercise.image}" alt="${currentExercise.name}" class="exercise-image" onerror="this.onerror=null;this.src='https://placehold.co/400x300/cccccc/000000?text=Imagem+Nao+Disponivel';">`;
    } else {
        imageHtml = `<img src="https://placehold.co/400x300/cccccc/000000?text=Sem+Imagem" alt="Sem imagem disponível" class="exercise-image">`;
    }

    exerciseEl.innerHTML = `
        <h3>${currentExercise.name}</h3>
        ${imageHtml}
        <div class="exercise-details-execution">
            <p>Séries Planejadas: ${currentExercise.sets.length}</p>
            <p>Repetições Sugeridas: ${currentExercise.reps || 'N/A'}</p>
            <p>Descanso Sugerido: ${currentExercise.rest || 0} segundos</p>
            ${currentExercise.description ? `<p>${currentExercise.description}</p>` : ''}
            ${currentExercise.muscleGroup ? `<p>Músculos: ${currentExercise.muscleGroup}</p>` : ''}
        </div>
        <div class="exercise-execution-sets">
            ${currentExercise.sets.map((set, setIndex) => `
                <div class="set-input ${setIndex === window.currentSetIndex && !currentExercise.isCompleted ? 'current-set-highlight' : (setIndex < window.currentSetIndex || currentExercise.isCompleted ? 'completed-set-overlay' : '')}">
                    <span>Set ${setIndex + 1}:</span>
                    <input type="number" class="form-control execution-reps" data-set-index="${setIndex}" value="${currentExercise.completedSets[setIndex]?.reps || set.reps}" placeholder="Reps" min="0" ${setIndex !== window.currentSetIndex || currentExercise.isCompleted ? 'disabled' : ''}>
                    <input type="number" class="form-control execution-weight" data-set-index="${setIndex}" value="${currentExercise.completedSets[setIndex]?.weight || set.weight}" placeholder="Peso (kg)" min="0" step="0.5" ${setIndex !== window.currentSetIndex || currentExercise.isCompleted ? 'disabled' : ''}>
                    <button class="btn btn-success btn-sm complete-set-btn" data-set-index="${setIndex}" ${setIndex !== window.currentSetIndex || currentExercise.isCompleted ? 'disabled' : ''}>
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            `).join('')}
        </div>
        <div class="exercise-execution-actions">
            <button class="btn btn-info skip-rest-btn" style="display: none;"><i class="fas fa-forward"></i> Pular Descanso</button>
            ${currentExercise.videoUrl ? `<a href="${currentExercise.videoUrl}" target="_blank" class="btn btn-info btn-sm"><i class="fas fa-video"></i> Ver Vídeo</a>` : ''}
            <button class="btn btn-success complete-exercise-btn" style="display: none;"><i class="fas fa-flag-checkered"></i> Concluir Exercício</button>
        </div>
    `;
    executionList.appendChild(exerciseEl);

    const globalRestTimerActualEl = document.getElementById('global-rest-timer');
    const skipRestBtn = exerciseEl.querySelector('.skip-rest-btn');
    const currentExerciseCompleteBtn = exerciseEl.querySelector('.complete-exercise-btn');
    const completeSetButtons = exerciseEl.querySelectorAll('.complete-set-btn');

    if (globalRestTimerActualEl) {
        globalRestTimerActualEl.style.display = 'none';
        globalRestTimerActualEl.classList.remove('resting');
        globalRestTimerActualEl.querySelector('.countdown').textContent = '00:00';
    }

    if (currentExercise.isCompleted) {
        if (window.currentExerciseIndex < window.currentWorkout.executionExercises.length - 1) {
            // No action needed here, will transition to next exercise
        } else {
            if (finishWorkoutBtn) finishWorkoutBtn.style.display = 'inline-flex';
        }
    } else {
        if (window.currentSetIndex < currentExercise.sets.length) {
            if (currentExerciseCompleteBtn) currentExerciseCompleteBtn.style.display = 'none';
            completeSetButtons.forEach((btn, idx) => {
                btn.style.display = (idx === window.currentSetIndex) ? 'inline-flex' : 'none';
            });
            if (skipRestBtn) skipRestBtn.style.display = 'none';
        } else {
            if (currentExerciseCompleteBtn) currentExerciseCompleteBtn.style.display = 'inline-flex';
            completeSetButtons.forEach(btn => btn.style.display = 'none');
            if (skipRestBtn) skipRestBtn.style.display = 'none';
        }
    }

    document.querySelectorAll('.execution-reps, .execution-weight').forEach(input => {
        input.addEventListener('input', function() {
            const setIndex = parseInt(this.dataset.setIndex); // Corrected access
            const exercise = window.currentWorkout.executionExercises[window.currentExerciseIndex];
            if (!exercise.completedSets[setIndex]) {
                exercise.completedSets[setIndex] = {};
            }
            if (this.classList.contains('execution-reps')) {
                exercise.completedSets[setIndex].reps = parseInt(this.value) || 0;
            } else if (this.classList.contains('execution-weight')) {
                exercise.completedSets[setIndex].weight = parseFloat(this.value) || 0;
            }
        });
    });

    completeSetButtons.forEach(button => {
        button.addEventListener('click', function() {
            const setIndex = parseInt(this.dataset.setIndex); // Corrected access
            window.completeSet(setIndex);
        });
    });

    if (skipRestBtn) {
        skipRestBtn.addEventListener('click', () => {
            window.stopGlobalRestTimer();
        });
    }

    if (currentExerciseCompleteBtn) {
        currentExerciseCompleteBtn.addEventListener('click', () => {
            const exercise = window.currentWorkout.executionExercises[window.currentExerciseIndex];
            exercise.isCompleted = true;

            if (window.currentExerciseIndex < window.currentWorkout.executionExercises.length - 1) {
                if (exercise.rest > 0) {
                    window.startGlobalRestTimer(exercise.rest, 'exercise');
                } else {
                    window.loadNextExercise();
                }
            } else {
                window.loadNextExercise();
            }
            window.showToast(`Exercício "${exercise.name}" concluído!`, 'success');
        });
    }
}

/**
 * Completa uma série específica do exercício atual.
 * @param {number} setIndex - O índice da série a ser completada.
 */
window.completeSet = function(setIndex) {
    const exercise = window.currentWorkout.executionExercises[window.currentExerciseIndex];
    const currentSetInputDiv = document.querySelector(`.exercise-execution-sets .set-input:nth-child(${setIndex + 1})`);
    const repsInput = currentSetInputDiv.querySelector('.execution-reps');
    const weightInput = currentSetInputDiv.querySelector('.execution-weight');
    const completeSetBtn = currentSetInputDiv.querySelector('.complete-set-btn');

    if (!exercise.completedSets[setIndex]) {
        exercise.completedSets[setIndex] = {};
    }
    exercise.completedSets[setIndex].reps = parseInt(repsInput.value) || 0;
    exercise.completedSets[setIndex].weight = parseFloat(weightInput.value) || 0;

    repsInput.disabled = true;
    weightInput.disabled = true;
    completeSetBtn.disabled = true;
    completeSetBtn.style.display = 'none';
    currentSetInputDiv.classList.remove('current-set-highlight');
    currentSetInputDiv.classList.add('completed-set-overlay');

    if (setIndex < exercise.sets.length - 1) {
        window.currentSetIndex++;
        if (exercise.rest > 0) {
            window.startGlobalRestTimer(exercise.rest, 'set');
        } else {
            window.renderWorkoutExecution();
        }
        window.showToast(`Série ${setIndex + 1} de "${exercise.name}" concluída!`, 'success');
    } else {
        exercise.isCompleted = true;
        window.currentSetIndex = 0;

        window.showToast(`Exercício "${exercise.name}" concluído!`, 'success');

        if (window.currentExerciseIndex < window.currentWorkout.executionExercises.length - 1) {
            if (exercise.rest > 0) {
                window.startGlobalRestTimer(exercise.rest, 'exercise');
            } else {
                window.loadNextExercise();
            }
        } else {
            window.loadNextExercise();
        }
    }
}

/**
 * Inicia o timer de descanso global.
 * @param {number} duration - Duração do descanso em segundos.
 * @param {string} type - Tipo de descanso ('set' ou 'exercise').
 */
window.startGlobalRestTimer = function(duration, type) {
    window.stopGlobalRestTimer();

    window.globalRestSeconds = duration;
    window.globalRestType = type;
    const globalRestTimerEl = document.getElementById('global-rest-timer');
    const skipRestBtn = document.querySelector('.exercise-execution-actions .skip-rest-btn');
    const completeExerciseBtn = document.querySelector('.exercise-execution-actions .complete-exercise-btn');

    if (globalRestTimerEl) {
        globalRestTimerEl.style.display = 'flex';
        globalRestTimerEl.classList.add('resting');
        globalRestTimerEl.querySelector('.countdown').textContent = window.formatTime(window.globalRestSeconds).substring(3);
    }
    if (skipRestBtn) skipRestBtn.style.display = 'inline-flex';

    if (completeExerciseBtn) completeExerciseBtn.style.display = 'none';
    document.querySelectorAll('.complete-set-btn').forEach(btn => btn.style.display = 'none');

    window.globalRestTimerInterval = setInterval(() => {
        window.globalRestSeconds--;
        if (globalRestTimerEl) {
            globalRestTimerEl.querySelector('.countdown').textContent = window.formatTime(window.globalRestSeconds).substring(3);
        }

        if (window.globalRestSeconds <= 0) {
            window.stopGlobalRestTimer();
            window.showToast('Descanso concluído!', 'info');
        }
    }, 1000);
}

/**
 * Para o timer de descanso global.
 */
window.stopGlobalRestTimer = function() {
    if (window.globalRestTimerInterval) {
        clearInterval(window.globalRestTimerInterval);
        window.globalRestTimerInterval = null;
    }
    const globalRestTimerEl = document.getElementById('global-rest-timer');
    const skipRestBtn = document.querySelector('.exercise-execution-actions .skip-rest-btn');

    if (globalRestTimerEl) {
        globalRestTimerEl.style.display = 'none';
        globalRestTimerEl.classList.remove('resting');
    }
    if (skipRestBtn) skipRestBtn.style.display = 'none';

    if (window.globalRestType === 'set') {
        window.renderWorkoutExecution();
    } else if (window.globalRestType === 'exercise') {
        window.loadNextExercise();
    }
    window.globalRestType = null;
}

/**
 * Carrega o próximo exercício na sequência ou finaliza o treino se todos forem concluídos.
 */
window.loadNextExercise = function() {
    window.currentExerciseIndex++;
    window.currentSetIndex = 0;
    window.renderWorkoutExecution();
}

/**
 * Inicia o timer total do treino.
 */
window.startTotalWorkoutTimer = function() {
    window.totalWorkoutSeconds = 0;
    document.getElementById('workout-total-timer').textContent = window.formatTime(window.totalWorkoutSeconds);
    window.workoutTimerInterval = setInterval(() => {
        window.totalWorkoutSeconds++;
        document.getElementById('workout-total-timer').textContent = window.formatTime(window.totalWorkoutSeconds);
    }, 1000);
}

/**
 * Para o timer total do treino.
 */
window.stopTotalWorkoutTimer = function() {
    if (window.workoutTimerInterval) {
        clearInterval(window.workoutTimerInterval);
        window.workoutTimerInterval = null;
    }
}

// Event listener para finalizar o treino
document.getElementById('finish-workout-btn').addEventListener('click', () => {
    window.showConfirmModal('Tem certeza que deseja finalizar este treino e salvá-lo no histórico?', () => {
        window.stopTotalWorkoutTimer();
        window.stopGlobalRestTimer();
		window.releaseWakeLock(); // Libera o wake lock
        const completedWorkout = {
            id: 'workout-' + Date.now(),
            date: new Date().toISOString(),
            name: window.currentWorkout.title || window.currentWorkout.name,
            durationMinutes: Math.round(window.totalWorkoutSeconds / 60),
            exercises: window.currentWorkout.executionExercises.map(ex => ({
                name: ex.name,
                sets: ex.completedSets.filter(s => s && (s.reps > 0 || s.weight > 0)),
                image: ex.image || 'N/A'
            }))
        };
        window.workoutHistory.push(completedWorkout);
        window.saveData();
        window.showToast('Treino concluído e salvo no histórico!', 'success');
        window.showView('days-view');
    });
});

// Event listener para cancelar o treino
document.getElementById('cancel-workout-btn').addEventListener('click', () => {
    window.showConfirmModal('Tem certeza que deseja cancelar este treino? Ele não será salvo.', () => {
        window.stopTotalWorkoutTimer();
        window.stopGlobalRestTimer();
        window.currentWorkout = null;
        window.showToast('Treino cancelado!', 'info');
        window.showView('days-view');
    });
});

// --- View de Histórico ---

/**
 * Renderiza o histórico de treinos concluídos.
 */
window.renderHistory = function() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';

    if (window.workoutHistory.length === 0) {
        historyList.innerHTML = '<p>Nenhum treino registrado ainda.</p>';
        return;
    }

    const sortedHistory = [...window.workoutHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedHistory.forEach(workout => {
        const workoutDate = new Date(workout.date);
        const formattedDate = workoutDate.toLocaleDateString('pt-BR');
        const formattedTime = workoutDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const historyItem = document.createElement('div');
        historyItem.classList.add('history-item', 'card');
        historyItem.innerHTML = `
            <div>
                <h3>${workout.name} - ${formattedDate} às ${formattedTime}</h3>
                ${workout.durationMinutes ? `<p>Duração: ${workout.durationMinutes} minutos</p>` : ''}
                <div class="exercise-details">
                    ${workout.exercises.map(ex => `
                        <p><strong>${ex.name}:</strong> ${Array.isArray(ex.sets) ? ex.sets.map(set => `${set.reps || 0} reps @ ${set.weight || 0} kg`).join(', ') : 'N/A'}</p>
                    `).join('')}
                </div>
            </div>
            <button class="btn btn-danger btn-sm delete-history-item" data-id="${workout.id}">
                <i class="fas fa-trash-alt"></i> Excluir
            </button>
        `;
        historyList.appendChild(historyItem);
    });

    document.querySelectorAll('.delete-history-item').forEach(button => {
        button.addEventListener('click', function() {
            const workoutIdToDelete = this.dataset.id;
            window.deleteWorkoutFromHistory(workoutIdToDelete);
        });
    });
}

/**
 * Exclui um treino do histórico.
 * @param {string} id - O ID do treino a ser excluído.
 */
window.deleteWorkoutFromHistory = function(id) {
    window.showConfirmModal('Tem certeza que deseja excluir este treino do histórico? Esta ação é irreversível.', () => {
        window.workoutHistory = window.workoutHistory.filter(workout => workout.id !== id);
        window.saveData();
        window.renderHistory();
        window.updateDashboard();
        window.showToast('Treino excluído com sucesso!', 'success');
    });
}

// --- View de Dashboard ---

/**
 * Atualiza e renderiza todos os gráficos da dashboard.
 */
window.updateDashboard = function() {
    const dashboardView = document.getElementById('dashboard-view');
    const dashboardGrid = dashboardView.querySelector('.dashboard-grid');

    if (window.workoutHistory.length === 0) {
        dashboardGrid.innerHTML = '<p style="text-align: center; color: var(--dark-color);">Nenhum dado de treino para exibir na dashboard ainda. Complete alguns treinos para ver sua evolução!</p>';
        if(window.volumeChartInstance) window.volumeChartInstance.destroy();
        if(window.prChartInstance) window.prChartInstance.destroy();
        if(window.frequentExercisesChartInstance) window.frequentExercisesChartInstance.destroy();
        if(window.averageWorkoutTimeChartInstance) window.averageWorkoutTimeChartInstance.destroy();
        return;
    } else {
        dashboardGrid.innerHTML = `
            <div class="chart-card">
                <h3>Volume Total de Treino (kg)</h3>
                <canvas id="volumeChart"></canvas>
            </div>
            <div class="chart-card">
                <h3>Progressão de Peso (PRs) por Exercício</h3>
                <div id="exercise-pr-charts">
                    <p>Selecione um exercício para ver a progressão:</p>
                    <select id="exercise-select" class="form-control"></select>
                    <canvas id="prChart" style="display: none;"></canvas>
                    <p id="no-pr-data" style="display: none;"></p>
                </div>
            </div>
            <div class="chart-card">
                <h3>Exercícios Mais Frequentes</h3>
                <canvas id="frequentExercisesChart"></canvas>
            </div>
            <div class="chart-card">
                <h3>Duração do Treino (min)</h3>
                <canvas id="averageWorkoutTimeChart"></canvas>
            </div>
        `;
    }

    window.renderVolumeChart();
    window.populateExerciseSelect();
    window.renderFrequentExercisesChart();
    window.renderAverageWorkoutTimeChart();
}

/**
 * Renderiza o gráfico de Volume Total de Treino.
 */
window.renderVolumeChart = function() {
    const canvas = document.getElementById('volumeChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.volumeChartInstance) {
        window.volumeChartInstance.destroy();
    }

    const workoutVolumes = window.workoutHistory.map(workout => {
        let totalVolume = 0;
        workout.exercises.forEach(exercise => {
            if (Array.isArray(exercise.sets)) {
                exercise.sets.forEach(set => {
                    const weight = parseFloat(set.weight) || 0;
                    const reps = parseInt(set.reps) || 0;
                    totalVolume += weight * reps;
                });
            }
        });
        return { date: new Date(workout.date), volume: totalVolume };
    }).sort((a, b) => a.date - b.date);

    const labels = workoutVolumes.map(data => data.date.toLocaleDateString('pt-BR'));
    const data = workoutVolumes.map(data => data.volume);

    if (data.length === 0) {
        canvas.style.display = 'none';
        return;
    } else {
        canvas.style.display = 'block';
    }

    window.volumeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Volume Total (kg)',
                data: data,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--accent-color'),
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.3,
                pointBackgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--accent-color'),
                pointBorderColor: getComputedStyle(document.documentElement).getPropertyValue('--light-color'),
                pointRadius: 5,
                pointHoverRadius: 7,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `Data: ${context[0].label}`;
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('pt-BR', { style: 'unit', unit: 'kilogram' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--accent-color'),
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Volume (kg)',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') + '40',
                        drawBorder: false
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Data do Treino',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') + '40',
                        drawBorder: false
                    }
                }
            }
        }
    });
}

/**
 * Popula o dropdown de seleção de exercícios para o gráfico de PR.
 */
window.populateExerciseSelect = function() {
    const exerciseSelect = document.getElementById('exercise-select');
    exerciseSelect.innerHTML = '<option value="">-- Selecione um Exercício --</option>';

    const uniqueExercises = new Set();
    window.workoutHistory.forEach(workout => {
        workout.exercises.forEach(ex => {
            uniqueExercises.add(ex.name);
        });
    });

    Array.from(uniqueExercises).sort().forEach(exerciseName => {
        const option = document.createElement('option');
        option.value = exerciseName;
        option.textContent = exerciseName;
        exerciseSelect.appendChild(option);
    });

    exerciseSelect.onchange = function() {
        const selectedExercise = this.value;
        if (selectedExercise) {
            window.renderPRChart(selectedExercise);
        } else {
            document.getElementById('prChart').style.display = 'none';
            document.getElementById('no-pr-data').style.display = 'block';
            document.getElementById('no-pr-data').textContent = 'Selecione um exercício para ver a progressão.';
            if (window.prChartInstance) {
                window.prChartInstance.destroy();
                window.prChartInstance = null;
            }
        }
    };
}

/**
 * Renderiza o gráfico de Progressão de Peso (PRs) para um exercício selecionado.
 * @param {string} exerciseName - O nome do exercício.
 */
window.renderPRChart = function(exerciseName) {
    const canvas = document.getElementById('prChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.prChartInstance) {
        window.prChartInstance.destroy();
    }

    const prData = [];
    window.workoutHistory.forEach(workout => {
        const workoutDate = new Date(workout.date);
        workout.exercises.forEach(ex => {
            if (ex.name === exerciseName) {
                let maxWeight = 0;
                if (Array.isArray(ex.sets)) {
                    ex.sets.forEach(set => {
                        const weight = parseFloat(set.weight) || 0;
                        if (weight > maxWeight) {
                            maxWeight = weight;
                        }
                    });
                }
                if (maxWeight > 0) {
                    prData.push({ date: workoutDate, weight: maxWeight });
                }
            }
        });
    });

    prData.sort((a, b) => a.date - b.date);

    const labels = prData.map(data => data.date.toLocaleDateString('pt-BR'));
    const data = prData.map(data => data.weight);

    const prChartCanvas = document.getElementById('prChart');
    const noPrDataMessage = document.getElementById('no-pr-data');

    if (prData.length === 0) {
        prChartCanvas.style.display = 'none';
        noPrDataMessage.style.display = 'block';
        noPrDataMessage.textContent = 'Nenhum dado de PR para este exercício.';
        return;
    } else {
        prChartCanvas.style.display = 'block';
        noPrDataMessage.style.display = 'none';
    }

    window.prChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Peso Máximo (${exerciseName} - kg)`,
                data: data,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--secondary-color'),
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.3,
                pointBackgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--secondary-color'),
                pointBorderColor: getComputedStyle(document.documentElement).getPropertyValue('--light-color'),
                pointRadius: 5,
                pointHoverRadius: 7,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `Data: ${context[0].label}`;
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('pt-BR', { style: 'unit', unit: 'kilogram' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--secondary-color'),
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Peso (kg)',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') + '40',
                        drawBorder: false
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Data do Treino',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') + '40',
                        drawBorder: false
                    }
                }
            }
        }
    });
}

/**
 * Renderiza o gráfico de Exercícios Mais Frequentes.
 */
window.renderFrequentExercisesChart = function() {
    const canvas = document.getElementById('frequentExercisesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.frequentExercisesChartInstance) {
        window.frequentExercisesChartInstance.destroy();
    }

    const exerciseCounts = {};
    window.workoutHistory.forEach(workout => {
        workout.exercises.forEach(ex => {
            exerciseCounts[ex.name] = (exerciseCounts[ex.name] || 0) + 1;
        });
    });

    const sortedExercises = Object.entries(exerciseCounts).sort(([, a], [, b]) => b - a);
    const labels = sortedExercises.map(([name]) => name);
    const data = sortedExercises.map(([, count]) => count);

    if (data.length === 0) {
        canvas.style.display = 'none';
        return;
    } else {
        canvas.style.display = 'block';
    }

    window.frequentExercisesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequência de Treino',
                data: data,
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--success-color'),
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--success-color'),
                borderWidth: 1,
                borderRadius: 8,
                barThickness: 20,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.x !== null) {
                                label += `${context.parsed.x} vezes`;
                            }
                            return label;
                        }
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--success-color'),
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Número de Vezes Trainado',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        precision: 0,
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') + '40',
                        drawBorder: false
                    }
                },
                y: {
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') + '40',
                        drawBorder: false
                    }
                }
            }
        }
    });
}

/**
 * Renderiza o gráfico de Duração do Treino.
 */
window.renderAverageWorkoutTimeChart = function() {
    const canvas = document.getElementById('averageWorkoutTimeChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.averageWorkoutTimeChartInstance) {
        window.averageWorkoutTimeChartInstance.destroy();
    }

    const workoutDurations = window.workoutHistory.map(workout => {
        return { date: new Date(workout.date), duration: workout.durationMinutes || 0 };
    }).filter(w => w.duration > 0)
      .sort((a, b) => a.date - b.date);

    const labels = workoutDurations.map(data => data.date.toLocaleDateString('pt-BR'));
    const data = workoutDurations.map(data => data.duration);

    if (data.length === 0) {
        canvas.style.display = 'none';
        return;
    } else {
        canvas.style.display = 'block';
    }

    window.averageWorkoutTimeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Duração do Treino (min)',
                data: data,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--info-color'),
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.3,
                pointBackgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--info-color'),
                pointBorderColor: getComputedStyle(document.documentElement).getPropertyValue('--light-color'),
                pointRadius: 5,
                pointHoverRadius: 7,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `Data: ${context[0].label}`;
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += `${context.parsed.y} minutos`;
                            }
                            return label;
                        }
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--info-color'),
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Duração (minutos)',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') + '40',
                        drawBorder: false
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Data do Treino',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--dark-color'),
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color') + '40',
                        drawBorder: false
                    }
                }
            }
        }
    });
}

// --- View de Perfil do Usuário ---

/**
 * Renderiza a view de perfil do usuário com os dados atuais.
 */
window.renderUserProfileView = function() {
    document.getElementById('profile-name').value = window.userProfile.name || '';
    document.getElementById('profile-gender').value = window.userProfile.gender || '';
    document.getElementById('profile-age').value = window.userProfile.age || '';
    document.getElementById('profile-weight').value = window.userProfile.weight || '';
    document.getElementById('profile-height').value = window.userProfile.height || '';
    document.getElementById('profile-goal').value = window.userProfile.goal || '';
}

// --- Auth UI Logic ---
let isRegistering = false;
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleLink = document.getElementById('auth-toggle-link');
const registrationFields = document.getElementById('registration-fields');
const logoutBtn = document.getElementById('logout-btn');

// Function to toggle between login and register modes
function toggleAuthMode() {
    isRegistering = !isRegistering;
    if (isRegistering) {
        authSubmitBtn.textContent = 'Cadastrar';
        authToggleLink.textContent = 'Já tem uma conta? Faça login';
        registrationFields.style.display = 'block';
    } else {
        authSubmitBtn.textContent = 'Login';
        authToggleLink.textContent = 'Não tem uma conta? Cadastre-se';
        registrationFields.style.display = 'none';
    }
}

authToggleLink.addEventListener('click', toggleAuthMode);

authSubmitBtn.addEventListener('click', async () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;

    if (!email || !password) {
        window.showToast('Por favor, preencha o email e a senha.', 'danger');
        return;
    }

    if (!window.isFirebaseInitialized || !window.auth) {
        window.showToast('Erro: Firebase não está totalmente inicializado. Tente novamente mais tarde.', 'danger');
        return;
    }

    try {
        if (isRegistering) {
            const name = document.getElementById('reg-name').value;
            const gender = document.getElementById('reg-gender').value;
            const age = parseInt(document.getElementById('reg-age').value) || 0;
            const weight = parseFloat(document.getElementById('reg-weight').value) || 0;
            const height = parseInt(document.getElementById('reg-height').value) || 0;
            const goal = document.getElementById('reg-goal').value;

            if (!name || !gender || !age || !weight || !height || !goal) {
                window.showToast('Por favor, preencha todos os campos de cadastro.', 'danger');
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(window.auth, email, password);
            window.userProfile = {
                name: name,
                gender: gender,
                age: age,
                weight: weight,
                height: height,
                goal: goal,
                registeredAt: new Date().toISOString()
            };
            await window.saveUserProfile();
            window.showToast('Cadastro realizado com sucesso! Você está logado.', 'success');
        } else {
            await signInWithEmailAndPassword(window.auth, email, password);
            window.showToast('Login realizado com sucesso!', 'success');
        }
    } catch (error) {
        let errorMessage = "Ocorreu um erro de autenticação.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Este email já está em uso.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Email inválido.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Senha muito fraca (mínimo 6 caracteres).';
        } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Email ou senha inválidos.';
        }
        window.showToast(errorMessage, 'danger');
    }
});

logoutBtn.addEventListener('click', async () => {
    window.showConfirmModal('Tem certeza que deseja sair?', async () => {
        if (!window.isFirebaseInitialized || !window.auth) {
            window.showToast('Erro: Firebase não está totalmente inicializado.', 'danger');
            return;
        }
        try {
            await signOut(window.auth);
            window.showToast('Desconectado com sucesso!', 'info');
        } catch (error) {
            window.showToast('Erro ao sair. Tente novamente.', 'danger');
        }
    });
});

// Event listener for saving user profile
document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const name = document.getElementById('profile-name').value;
    const gender = document.getElementById('profile-gender').value;
    const age = parseInt(document.getElementById('profile-age').value) || 0;
    const weight = parseFloat(document.getElementById('profile-weight').value) || 0;
    const height = parseInt(document.getElementById('profile-height').value) || 0;
    const goal = document.getElementById('profile-goal').value;

    if (!name || !gender || !age || !weight || !height || !goal) {
        window.showToast('Por favor, preencha todos os campos do perfil.', 'danger');
        return;
    }

    window.userProfile = {
        name: name,
        gender: gender,
        age: age,
        weight: weight,
        height: height,
        goal: goal,
        // Preserve registeredAt if it exists
        registeredAt: window.userProfile.registeredAt || new Date().toISOString()
    };
    await window.saveUserProfile();
});


// --- Inicialização do Aplicativo ---
document.addEventListener('DOMContentLoaded', () => {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    window.applyTheme(isDarkMode);

    document.querySelectorAll('.exercise-timer').forEach(timerEl => {
        timerEl.style.display = 'none';
        timerEl.classList.remove('resting');
        timerEl.querySelector('.countdown').textContent = '00:00';
    });
	// --- PWA Service Worker Registration ---
	if ('serviceWorker' in navigator) {
		window.addEventListener('load', () => {
			navigator.serviceWorker.register('service-worker.js')
				.then(registration => {
					console.log('Service Worker registrado com sucesso:', registration.scope);
				})
				.catch(error => {
					console.error('Falha no registro do Service Worker:', error);
				});
		});
	}
});
