// 새김 서비스 워커 (캐시 없음: 항상 최신 버전을 보여주기 위함)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // 네트워크로 그대로 통과. 캐시하지 않는다.
  return;
});
