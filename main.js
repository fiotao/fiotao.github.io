import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, addDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
 * Encontra os dados do último treino para um exercício específico
 * @param {string} exerciseName - Nome do exercício a ser buscado
 * @returns {Object|null} Retorna os dados do último treino ou null se não encontrado
 */
window.findLastWorkoutDataForExercise = function(exerciseName) {
    if (!window.workoutHistory || window.workoutHistory.length === 0) {
        return null;
    }

    // Ordena o histórico por data (do mais recente para o mais antigo)
    const sortedHistory = [...window.workoutHistory].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );

    // Procura pelo exercício no histórico
    for (const workout of sortedHistory) {
        const exercise = workout.exercises.find(ex => ex.name === exerciseName);
        if (exercise && Array.isArray(exercise.sets) && exercise.sets.length > 0) {
            return {
                sets: exercise.sets,
                date: workout.date
            };
        }
    }

    return null;
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
    "day": 1,
    "title": "Peito, Tr\u00edceps e Abd\u00f4men inferior",
    "image": "https://images.unsplash.com/photo-1605296867304-46d5465a13f1",
    "exercises": [
      {
        "name": "Supino reto com barra",
        "sets": 4,
        "reps": "6-8",
        "rest": 90,
        "image": "./images/supino_reto_barra.png",
        "description": "Exerc\u00edcio composto para peitoral maior, for\u00e7a e volume.",
        "videoUrl": "https://musclewiki.com/barbell/male/chest/barbell-bench-press/",
        "muscleGroup": "Peito"
      },
      {
        "name": "Supino inclinado com halteres",
        "sets": 3,
        "reps": "8-10",
        "rest": 60,
        "image": "./images/supino_inclinado_halteres.png",
        "description": "Foco na parte superior do peitoral com maior amplitude.",
        "videoUrl": "https://musclewiki.com/dumbbells/male/chest/dumbbell-incline-bench-press/",
        "muscleGroup": "Peito (Superior)"
      },
      {
        "name": "Crucifixo reto",
        "sets": 3,
        "reps": "10-12",
        "rest": 60,
        "image": "./images/crucifixo_reto.png",
        "description": "Isolamento do peitoral com foco na fase exc\u00eantrica.",
        "videoUrl": "https://www.youtube.com/watch?v=eozdVDA78K0",
        "muscleGroup": "Peito"
      },
      {
        "name": "Tr\u00edceps na polia com corda",
        "sets": 3,
        "reps": "10-12",
        "rest": 45,
        "image": "./images/triceps_polia_corda.png",
        "description": "Isolamento do tr\u00edceps com foco na contra\u00e7\u00e3o final.",
        "videoUrl": "https://www.youtube.com/watch?v=vB5OHsJ3EME",
        "muscleGroup": "Tr\u00edceps"
      },
      {
        "name": "Tr\u00edceps franc\u00eas unilateral",
        "sets": 2,
        "reps": "12",
        "rest": 45,
        "image": "./images/triceps_frances_unilateral.png",
        "description": "Foco na cabe\u00e7a longa do tr\u00edceps com controle unilaterial.",
        "videoUrl": "https://www.youtube.com/watch?v=6SSdFf1Abao",
        "muscleGroup": "Tr\u00edceps"
      },
	  {
	  "name": "Rosca punho com barra",
	  "sets": 3,
	  "reps": "15-20",
	  "rest": 30,
	  "image": "./images/rosca_punho_barra.png",
	  "description": "Foco nos músculos flexores do antebraço com alta repetição.",
	  "videoUrl": "https://www.youtube.com/watch?v=0G2_XV7slIg",
	  "muscleGroup": "Antebraço"
	},
	{
	  "name": "Extensão de punho com barra",
	  "sets": 3,
	  "reps": "15-20",
	  "rest": 30,
	  "image": "./images/extensao_punho_barra.png",
	  "description": "Trabalha os extensores do antebraço e melhora o equilíbrio muscular.",
	  "videoUrl": "https://www.youtube.com/watch?v=K2R3M0WjU_k",
	  "muscleGroup": "Antebraço"
	},
      {
        "name": "Eleva\u00e7\u00e3o de pernas",
        "sets": 3,
        "reps": "15",
        "rest": 30,
        "image": "./images/elevacao_pernas.png",
        "description": "Exerc\u00edcio de peso corporal para abd\u00f4men inferior.",
        "videoUrl": "https://www.youtube.com/watch?v=l4kQd9eWclE",
        "muscleGroup": "Abd\u00f4men inferior"
      },
      {
        "name": "Prancha frontal",
        "sets": 3,
        "reps": "30-40s",
        "rest": 30,
        "image": "./images/prancha_frontal.png",
        "description": "Exerc\u00edcio isom\u00e9trico para ativa\u00e7\u00e3o do core.",
        "videoUrl": "https://www.youtube.com/watch?v=pSHjTRCQxIw",
        "muscleGroup": "Core"
      }
    ]
  },{
  "day": 2,
  "title": "Costas, Bíceps e Lombar",
  "image": "https://images.unsplash.com/photo-1549476468-382a93796d11",
  "exercises": [
    {
      "name": "Puxada frente com triângulo",
      "sets": 4,
      "reps": "8",
      "rest": 90,
      "image": "./images/puxada_triangulo.png",
      "description": "Trabalha a largura das costas e ativa o latíssimo do dorso.",
      "videoUrl": "https://www.youtube.com/watch?v=CAwf7n6Luuc",
      "muscleGroup": "Costas"
    },
    {
      "name": "Remada curvada com barra",
      "sets": 3,
      "reps": "8-10",
      "rest": 60,
      "image": "./images/remada_curvada_barra.png",
      "description": "Constrói espessura nas costas e ativa a lombar.",
      "videoUrl": "https://www.youtube.com/watch?v=vT2GjY_Umpw",
      "muscleGroup": "Costas"
    },
    {
      "name": "Pulldown unilateral",
      "sets": 3,
      "reps": "10",
      "rest": 60,
      "image": "./images/pulldown_unilateral.png",
      "description": "Ativação assimétrica do grande dorsal.",
      "videoUrl": "https://www.youtube.com/watch?v=0zJ3JTfRLVQ",
      "muscleGroup": "Costas"
    },
    {
      "name": "Rosca direta com barra",
      "sets": 3,
      "reps": "8-10",
      "rest": 60,
      "image": "./images/rosca_direta.png",
      "description": "Exercício clássico para volume nos bíceps.",
      "videoUrl": "https://www.youtube.com/watch?v=kwG2ipFRgfo",
      "muscleGroup": "Bíceps"
    },
    {
      "name": "Rosca alternada",
      "sets": 2,
      "reps": "12",
      "rest": 45,
      "image": "./images/rosca_alternada.png",
      "description": "Trabalho unilateral de bíceps com halteres.",
      "videoUrl": "https://www.youtube.com/watch?v=av7-8igSXTs",
      "muscleGroup": "Bíceps"
    },
    {
	  "name": "Rosca punho com barra",
	  "sets": 3,
	  "reps": "15-20",
	  "rest": 30,
	  "image": "./images/rosca_punho_barra.png",
	  "description": "Foco nos músculos flexores do antebraço com alta repetição.",
	  "videoUrl": "https://www.youtube.com/watch?v=0G2_XV7slIg",
	  "muscleGroup": "Antebraço"
	},
	{
	  "name": "Extensão de punho com barra",
	  "sets": 3,
	  "reps": "15-20",
	  "rest": 30,
	  "image": "./images/extensao_punho_barra.png",
	  "description": "Trabalha os extensores do antebraço e melhora o equilíbrio muscular.",
	  "videoUrl": "https://www.youtube.com/watch?v=K2R3M0WjU_k",
	  "muscleGroup": "Antebraço"
	},

    {
      "name": "Hiperextensão lombar",
      "sets": 3,
      "reps": "12",
      "rest": 45,
      "image": "./images/hiperextensao.png",
      "description": "Fortalece a lombar e previne lesões.",
      "videoUrl": "https://www.youtube.com/watch?v=QSZP3FfT8b0",
      "muscleGroup": "Lombar"
    },
    {
      "name": "Prancha lateral",
      "sets": 2,
      "reps": "30-40s",
      "rest": 30,
      "image": "./images/prancha_lateral.png",
      "description": "Ativação do core lateral e estabilizadores.",
      "videoUrl": "https://www.youtube.com/watch?v=K2VljzCC16g",
      "muscleGroup": "Core"
    }
  ]
},
{
  "day": 3,
  "title": "Pernas (Quadríceps e Glúteos)",
  "image": "https://images.unsplash.com/photo-1594915447192-d62153549646",
  "exercises": [
    {
      "name": "Agachamento livre",
      "sets": 4,
      "reps": "6-8",
      "rest": 90,
      "image": "./images/agachamento_livre.png",
      "description": "Base fundamental para força e volume nos membros inferiores.",
      "videoUrl": "https://www.youtube.com/watch?v=ultWZbUMPL8",
      "muscleGroup": "Pernas, Glúteos"
    },
    {
      "name": "Cadeira extensora",
      "sets": 3,
      "reps": "12",
      "rest": 45,
      "image": "./images/cadeira_extensora.png",
      "description": "Isolamento do quadríceps com foco no controle.",
      "videoUrl": "https://www.youtube.com/watch?v=8iPEnn-ltC8",
      "muscleGroup": "Quadríceps"
    },
    {
      "name": "Avanço com halteres",
      "sets": 3,
      "reps": "10",
      "rest": 60,
      "image": "./images/avanço_halteres.png",
      "description": "Exercício unilateral para equilíbrio e glúteos.",
      "videoUrl": "https://www.youtube.com/watch?v=QF0BQS2W80k",
      "muscleGroup": "Pernas, Glúteos"
    },
    {
      "name": "Leg press 45°",
      "sets": 3,
      "reps": "8-10",
      "rest": 60,
      "image": "./images/leg_press.png",
      "description": "Grande ativação de quadríceps com suporte.",
      "videoUrl": "https://www.youtube.com/watch?v=IZxyjW7MPJQ",
      "muscleGroup": "Quadríceps, Glúteos"
    },
    {
      "name": "Panturrilha no leg press",
      "sets": 4,
      "reps": "20",
      "rest": 30,
      "image": "./images/panturrilha_legpress.png",
      "description": "Fortalecimento e amplitude da panturrilha.",
      "videoUrl": "https://www.youtube.com/watch?v=YMmgqO8Jo-k",
      "muscleGroup": "Panturrilha"
    },
    {
      "name": "Abdominal oblíquo com rotação",
      "sets": 3,
      "reps": "15",
      "rest": 30,
      "image": "./images/abdominal_obliquo.png",
      "description": "Trabalho funcional para abdômen lateral.",
      "videoUrl": "https://www.youtube.com/watch?v=twF4Vh5QjIE",
      "muscleGroup": "Abdômen oblíquo"
    }
  ]
},
{
  "day": 4,
  "title": "Ombros, Posterior e Abdômen",
  "image": "https://images.unsplash.com/photo-1541592106381-b31649479354",
  "exercises": [
    {
      "name": "Desenvolvimento com halteres",
      "sets": 4,
      "reps": "8-10",
      "rest": 60,
      "image": "./images/desenvolvimento_halteres.png",
      "description": "Trabalha os deltoides anterior e lateral com amplitude.",
      "videoUrl": "https://www.youtube.com/watch?v=B-aVuyhvLHU",
      "muscleGroup": "Ombros"
    },
    {
      "name": "Elevação lateral",
      "sets": 3,
      "reps": "10-12",
      "rest": 45,
      "image": "./images/elevacao_lateral.png",
      "description": "Foco no deltoide lateral para ampliar os ombros.",
      "videoUrl": "https://www.youtube.com/watch?v=kDqklk1ZESo",
      "muscleGroup": "Ombros"
    },
    {
      "name": "Elevação posterior (inclinada)",
      "sets": 3,
      "reps": "10-12",
      "rest": 45,
      "image": "./images/elevacao_posterior.png",
      "description": "Isolamento do deltoide posterior para postura e equilíbrio.",
      "videoUrl": "https://www.youtube.com/watch?v=pYcpY20QaE8",
      "muscleGroup": "Ombros"
    },
    {
      "name": "Stiff com halteres",
      "sets": 3,
      "reps": "8-10",
      "rest": 60,
      "image": "./images/stiff_halteres.png",
      "description": "Alongamento e fortalecimento dos isquiotibiais.",
      "videoUrl": "https://www.youtube.com/watch?v=0WOP9J7QPwI",
      "muscleGroup": "Posterior de Coxa"
    },
    {
      "name": "Good morning com barra",
      "sets": 3,
      "reps": "10",
      "rest": 60,
      "image": "./images/good_morning.png",
      "description": "Ativa a cadeia posterior e fortalece a lombar.",
      "videoUrl": "https://www.youtube.com/watch?v=vxWjLLx3fVE",
      "muscleGroup": "Lombar, Posterior"
    },
    {
      "name": "Abdominal prancha com apoio",
      "sets": 3,
      "reps": "30-45s",
      "rest": 30,
      "image": "./images/prancha_apoio.png",
      "description": "Ativação do core e estabilizadores da coluna.",
      "videoUrl": "https://www.youtube.com/watch?v=ASdvN_XEl_c",
      "muscleGroup": "Core"
    },
    {
      "name": "Abdominal infra na barra",
      "sets": 3,
      "reps": "12-15",
      "rest": 30,
      "image": "./images/infra_barra.png",
      "description": "Trabalho do abdômen inferior com peso corporal.",
      "videoUrl": "https://www.youtube.com/watch?v=tABHnWH2h34",
      "muscleGroup": "Abdômen inferior"
    }
  ]
},
{
  "day": 5,
  "title": "Posterior de Coxa, Glúteos e Panturrilha",
  "image": "https://images.unsplash.com/photo-1594915447192-d62153549646",
  "exercises": [
    {
      "name": "Mesa flexora",
      "sets": 4,
      "reps": "8-10",
      "rest": 60,
      "image": "./images/mesa_flexora.png",
      "description": "Isolamento dos isquiotibiais com boa ativação.",
      "videoUrl": "https://www.youtube.com/watch?v=PV4XkZswyHg",
      "muscleGroup": "Posterior de Coxa"
    },
    {
      "name": "Stiff com barra",
      "sets": 3,
      "reps": "8-10",
      "rest": 60,
      "image": "./images/stiff_barra.png",
      "description": "Ênfase no alongamento dos posteriores e glúteos.",
      "videoUrl": "https://www.youtube.com/watch?v=0WOP9J7QPwI",
      "muscleGroup": "Posterior de Coxa, Glúteos"
    },
    {
      "name": "Glute bridge (ponte de glúteo)",
      "sets": 3,
      "reps": "12",
      "rest": 45,
      "image": "./images/ponte_gluteo.png",
      "description": "Ativa glúteos e core de forma segura.",
      "videoUrl": "https://www.youtube.com/watch?v=1WT-Fz5ZEFg",
      "muscleGroup": "Glúteos, Lombar"
    },
    {
      "name": "Agachamento búlgaro",
      "sets": 3,
      "reps": "8-10",
      "rest": 60,
      "image": "./images/agachamento_bulgaro.png",
      "description": "Desafio unilateral para pernas e glúteos.",
      "videoUrl": "https://www.youtube.com/watch?v=2C-uNgKwPLE",
      "muscleGroup": "Pernas, Glúteos"
    },
    {
      "name": "Panturrilha em pé (barra ou máquina)",
      "sets": 4,
      "reps": "15-20",
      "rest": 30,
      "image": "./images/panturrilha_pe.png",
      "description": "Foco no gastrocnêmio com boa amplitude.",
      "videoUrl": "https://www.youtube.com/watch?v=-M4-G8p8fmc",
      "muscleGroup": "Panturrilha"
    },
    {
      "name": "Panturrilha sentado",
      "sets": 4,
      "reps": "15-20",
      "rest": 30,
      "image": "./images/panturrilha_sentado.png",
      "description": "Ênfase no sóleo, essencial para volume.",
      "videoUrl": "https://www.youtube.com/watch?v=YMmgqO8Jo-k",
      "muscleGroup": "Panturrilha"
    },
    {
      "name": "Abdominal máquina",
      "sets": 3,
      "reps": "15",
      "rest": 30,
      "image": "./images/abdominal_maquina.png",
      "description": "Trabalha o core com carga controlada.",
      "videoUrl": "https://www.youtube.com/watch?v=4SR93vi2ZKw",
      "muscleGroup": "Abdômen"
    }
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
        
        // Pré-visualização da imagem
        let imagePreviewHtml = '';
        if (exercise.image) {
            imagePreviewHtml = `
                <div class="current-image-preview">
                    <p>Imagem atual:</p>
                    <img src="${exercise.image}" alt="Imagem do exercício" style="max-width: 150px; max-height: 150px;">
                </div>
            `;
        }

        exerciseItem.innerHTML = `
            <div>
                <input type="text" class="form-control exercise-name-input" value="${exercise.name}" placeholder="Nome do Exercício">
                
                ${imagePreviewHtml}
                
                <div class="form-group">
                    <label>Imagem do Exercício:</label>
                    <input type="file" class="form-control exercise-image-input" accept="image/*">
                </div>
                
                <div class="exercise-sets" data-exercise-index="${exIndex}">
                    ${exercise.sets.map((set, setIndex) => `
                        <div class="set-input">
                            <span>Set ${setIndex + 1}:</span>
                            <input type="number" class="form-control set-reps" value="${set.reps}" placeholder="Reps" min="0">
                            <input type="number" class="form-control set-weight" value="${set.weight}" placeholder="Peso (kg)" min="0" step="0.5">
                            <button class="btn btn-danger btn-sm remove-set-btn" data-exercise-index="${exIndex}" data-set-index="${setIndex}">
                                <i class="fas fa-minus-circle"></i>
                            </button>
                        </div>
                    `).join('')}
                    <button class="btn btn-success btn-sm add-set-btn" data-exercise-index="${exIndex}">
                        <i class="fas fa-plus-circle"></i> Adicionar Set
                    </button>
                </div>
                
                <div class="form-group">
                    <label>Descanso (segundos):</label>
                    <input type="number" class="form-control exercise-rest-input" value="${exercise.rest || 0}" min="0">
                </div>
                
                <div class="form-group">
                    <label>URL do Vídeo (Opcional):</label>
                    <input type="text" class="form-control exercise-video-url" value="${exercise.videoUrl || ''}" placeholder="URL do vídeo do exercício">
                </div>
            </div>
            <div class="actions">
                <button class="btn btn-danger btn-sm remove-exercise-btn" data-index="${exIndex}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        exercisesList.appendChild(exerciseItem);

        // Adiciona o event listener para a pré-visualização da imagem
        const imageInput = exerciseItem.querySelector('.exercise-image-input');
        const previewContainer = exerciseItem.querySelector('.current-image-preview');
        
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    // Atualiza a imagem no objeto do exercício
                    window.allWorkoutData[window.currentDayId].exercises[exIndex].image = event.target.result;
                    
                    // Mostra a pré-visualização
                    if (!previewContainer) {
                        const previewHtml = `
                            <div class="current-image-preview">
                                <p>Nova imagem:</p>
                                <img src="${event.target.result}" alt="Pré-visualização" style="max-width: 150px; max-height: 150px;">
                            </div>
                        `;
                        imageInput.insertAdjacentHTML('afterend', previewHtml);
                    } else {
                        previewContainer.querySelector('img').src = event.target.result;
                    }
                    
                    window.saveData();
                };
                reader.readAsDataURL(file);
            }
        });
    });

    window.attachExerciseDetailListeners();
};
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
 document.querySelectorAll('.exercise-image-input').forEach(input => {
        input.addEventListener('change', function(e) {
            const exIndex = parseInt(e.target.closest('.exercise-item').dataset.index);
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    window.allWorkoutData[window.currentDayId].exercises[exIndex].image = event.target.result;
                    window.saveData();
                    // Você pode adicionar uma pré-visualização aqui se quiser
                };
                reader.readAsDataURL(file);
            }
        });
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
    
    window.currentWorkout.executionExercises = window.currentWorkout.exercises.map(ex => {
        // Busca os dados do último treino para este exercício
        const lastWorkoutData = window.findLastWorkoutDataForExercise(ex.name);
        // Se encontrou dados do último treino, usa-os como base
        const sets = lastWorkoutData 
            ? lastWorkoutData.sets.map(set => ({ 
                reps: set.reps || 0, 
                weight: set.weight || 0 
            }))
            : ex.sets.map(set => ({ 
                reps: typeof set === 'object' ? (set.reps || 0) : 0, 
                weight: typeof set === 'object' ? (set.weight || 0) : 0 
            }));
        
        return {
            ...ex,
            sets: sets,
            completedSets: Array.from({ length: sets.length }, () => ({ reps: 0, weight: 0 })),
            isCompleted: false,
            lastWorkoutDate: lastWorkoutData ? lastWorkoutData.date : null
        };
    });

    document.getElementById('workout-execution-title').textContent = window.currentWorkout.title || window.currentWorkout.name;
    window.currentExerciseIndex = 0;
    window.currentSetIndex = 0;
    
    window.showView('workout-execution-view');
    window.renderWorkoutExecution();
    window.startTotalWorkoutTimer();
};

/**
 * Atualiza a exibição do próximo exercício
 */
window.updateNextExerciseDisplay = function() {
    const nextExerciseDisplay = document.getElementById('next-exercise-display');
    if (!nextExerciseDisplay) return;

    if (!window.currentWorkout || !Array.isArray(window.currentWorkout.executionExercises)) {
        nextExerciseDisplay.textContent = '';
        return;
    }

    const nextExerciseIndex = window.currentExerciseIndex + 1;
    if (nextExerciseIndex < window.currentWorkout.executionExercises.length) {
        const nextExercise = window.currentWorkout.executionExercises[nextExerciseIndex];
        nextExerciseDisplay.textContent = `Próximo: ${nextExercise.name}`;
    } else {
        nextExerciseDisplay.textContent = 'Último exercício';
    }
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
        const nextExerciseDisplay = document.getElementById('next-exercise-display');
        const finishWorkoutBtn = document.getElementById('finish-workout-btn');
        const cancelWorkoutBtn = document.getElementById('cancel-workout-btn');

        if (currentExerciseDisplay) currentExerciseDisplay.style.display = 'none';
        if (nextExerciseDisplay) nextExerciseDisplay.style.display = 'none';
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
    const nextExerciseDisplay = document.getElementById('next-exercise-display');
    const finishWorkoutBtn = document.getElementById('finish-workout-btn');
    const cancelWorkoutBtn = document.getElementById('cancel-workout-btn');

    if (!currentExercise) {
        if (currentExerciseDisplay) currentExerciseDisplay.style.display = 'none';
        if (nextExerciseDisplay) nextExerciseDisplay.style.display = 'none';
        executionList.innerHTML = '<p style="text-align: center;">Todos os exercícios do treino foram concluídos!</p>';
        
        if (finishWorkoutBtn) finishWorkoutBtn.style.display = 'inline-flex';
        if (cancelWorkoutBtn) cancelWorkoutBtn.style.display = 'inline-flex';
        
        window.showToast('Todos os exercícios do treino concluídos!', 'success');
        window.stopTotalWorkoutTimer();
        return; 
    }
    
    if (currentExerciseDisplay) {
        currentExerciseDisplay.style.display = 'block';
        currentExerciseDisplay.textContent = `Exercício Atual: ${currentExercise.name} (${window.currentExerciseIndex + 1} de ${totalExercises})`;
    }

    // Atualiza a exibição do próximo exercício
    window.updateNextExerciseDisplay();

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
		 ${currentExercise.lastWorkoutDate ? 
        `<p class="last-workout-info"><i class="fas fa-history"></i> Último treino: ${new Date(currentExercise.lastWorkoutDate).toLocaleDateString('pt-BR')}</p>` : 
        ''}
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
                <input type="number" class="form-control execution-reps" data-set-index="${setIndex}" value="${set.reps || 0}" placeholder="Reps" min="0" ${setIndex !== window.currentSetIndex || currentExercise.isCompleted ? 'disabled' : ''}>
                <input type="number" class="form-control execution-weight" data-set-index="${setIndex}" value="${set.weight || 0}" placeholder="Peso (kg)" min="0" step="0.5" ${setIndex !== window.currentSetIndex || currentExercise.isCompleted ? 'disabled' : ''}>
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
});