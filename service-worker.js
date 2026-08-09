const CACHE='pregnancy-weight-v1.8.0-mobile-crosshair-2';
const SHELL=[
  './',
  './index.html',
  './style.css?v=1.8.0',
  './data.js?v=1.8.0',
  './calculator.js?v=1.8.0',
  './storage.js?v=1.8.0',
  './chart.js?v=1.8.0',
  './app.js?v=1.8.0',
  './manifest.json?v=1.8.0',
  './assets/icon-192.png?v=1.8.0',
  './assets/icon-512.png?v=1.8.0',
  './assets/icon-maskable-512.png?v=1.8.0',
  './assets/apple-touch-icon.png?v=1.8.0'
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
