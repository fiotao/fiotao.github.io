const CACHE_NAME = 'fittracker-cache-v2'; // Incrementado para forçar a atualização
const urlsToCache = [
    'treino.html',
    'main.js',
    'style.css',
    'firebase-init.js',
    'manifest.json',
    'offline.html', // Novo arquivo para cache
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js',
    'images/192.png', // Certifique-se de que esses caminhos estão corretos
    'images/512.png' // Certifique-se de que esses caminhos estão corretos
];

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando arquivos...');
                // Usamos Promise.allSettled para que mesmo que uma URL falhe, as outras continuem.
                // Idealmente, todas as URLs essenciais devem ser cacheáveis e acessíveis.
                return Promise.allSettled(
                    urlsToCache.map(url => {
                        return cache.add(url).then(() => {
                            console.log(`[Service Worker] Cacheado: ${url}`);
                        }).catch(error => {
                            console.warn(`[Service Worker] Falha ao cachear ${url}: ${error.message}`);
                        });
                    })
                );
            })
            .then(() => self.skipWaiting()) // Força o novo SW a ativar imediatamente
            .catch(error => {
                console.error('[Service Worker] Erro durante a instalação:', error);
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        // Deleta caches antigos
                        console.log(`[Service Worker] Deletando cache antigo: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Ativado e caches antigos limpos.');
            return self.clients.claim(); // Reivindica controle imediato dos clientes
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Para requisições de API (Firebase Firestore, Auth, etc.) use Network-First
    // Isso garante que você sempre tente obter os dados mais recentes.
    // Não cacheamos responses de API, pois são dinâmicas e o Firestore já lida com offline persistence.
    if (event.request.url.includes('googleapis.com') || event.request.url.includes('firebaseapp.com')) {
        event.respondWith(
            fetch(event.request).catch(error => {
                console.warn(`[Service Worker] Falha na requisição de rede para Firebase/API: ${event.request.url}`, error);
                // Neste caso, não há fallback de cache, pois dados da API são dinâmicos.
                // O app deve lidar com a ausência de dados se a rede falhar.
                throw error; // Propaga o erro para o aplicativo lidar.
            })
        );
        return;
    }

    // Para outros assets (HTML, CSS, JS, imagens, libs externas estáticas)
    // Use uma estratégia "Stale-While-Revalidate":
    // 1. Tenta servir do cache primeiro (rápido).
    // 2. Em segundo plano, faz uma requisição de rede para atualizar o cache.
    // 3. Se não houver nada no cache, vai direto para a rede.
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Verifica se a resposta é válida antes de cachear
                if (networkResponse.ok && event.request.method === 'GET' && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Se a rede falhar e NÃO houver resposta em cache, serve a página offline
                if (event.request.mode === 'navigate') { // Apenas para navegações de página
                    return caches.match('offline.html');
                }
                console.log('Network request failed and no cache match for:', event.request.url);
                return new Response('Conteúdo não disponível offline.', { status: 503, statusText: 'Service Unavailable' });
            });

            // Retorna o cache primeiro ou a promise de fetch se não houver cache
            return cachedResponse || fetchPromise;
        })
    );
});