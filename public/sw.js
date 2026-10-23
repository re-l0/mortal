const CACHE='mortal-shell-v3';
const SHELL=['/','/index.html','/styles.css','/app.js','/engine.js','/mortal-icon.png','/favicon-32.png','/apple-touch-icon.png','/icon-192.png','/icon-512.png','/icon-maskable-512.png','/manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).pathname.startsWith('/api/'))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});
