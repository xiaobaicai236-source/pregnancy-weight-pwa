const CACHE='pregnancy-weight-v1.9.1-curve-fix-1';
const SHELL=[
  './',
  './index.html',
  './style.css?v=1.9.1',
  './share-design.js?v=1.9.1',
  './share-card.css?v=1.9.1',
  './data.js?v=1.9.1',
  './calculator.js?v=1.9.1',
  './storage.js?v=1.9.1',
  './chart.js?v=1.9.1',
  './vendor/qrcode.js?v=1.9.1',
  './share-card.js?v=1.9.1',
  './app.js?v=1.9.1',
  './manifest.json?v=1.9.1',
  './assets/icon-192.png?v=1.9.1',
  './assets/icon-512.png?v=1.9.1',
  './assets/icon-maskable-512.png?v=1.9.1',
  './assets/apple-touch-icon.png?v=1.9.1',
  './assets/share-mother.png?v=1.9.1'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));}
          return response;
        })
        .catch(()=>caches.match('./index.html').then(response=>response||caches.match('./')))
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then(response=>{
        if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
        return response;
      })
      .catch(()=>caches.match(event.request))
  );
});
