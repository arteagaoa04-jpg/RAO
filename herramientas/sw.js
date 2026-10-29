/* Guarda la app en el equipo para abrirla sin señal. Los datos los guarda Firestore aparte. */
const V="rao-v1";
const BASE=["./","index.html","firebase-config.js","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(BASE)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k))))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);if(r.method!=="GET")return;
  if(u.origin===location.origin){ // la app: primero la versión nueva, si no hay señal la guardada
    e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(V).then(x=>x.put(r,c));return res}).catch(()=>caches.match(r,{ignoreSearch:true}).then(x=>x||caches.match("index.html"))));
  }else if(/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(r.url)){ // librerías y letras
    e.respondWith(caches.match(r).then(x=>x||fetch(r).then(res=>{const c=res.clone();caches.open(V).then(k=>k.put(r,c));return res})));
  }
});
