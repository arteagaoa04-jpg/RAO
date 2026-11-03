/* Guarda la app en el equipo para abrirla sin señal o con poca señal. Los datos los guarda Firestore aparte. */
const V="rao-v3",LIBS="rao-libs";
const BASE=["./","index.html","firebase-config.js","manifest.webmanifest","icon-192.png","icon-512.png"];
const ESPERA=3500; // con señal débil no esperamos más que esto antes de usar lo guardado
const conTiempo=(p,ms)=>Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error("lento")),ms))]);
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(BASE)).catch(()=>{}));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!==LIBS).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
async function app(r){
  // Una navegación no se puede copiar con opciones, por eso se pide de nuevo por su dirección.
  const red=fetch(new Request(r.url,{cache:"no-cache",credentials:"same-origin"})).then(res=>{if(res.ok){const c=res.clone();caches.open(V).then(x=>x.put(r,c))}return res});
  const guardada=await caches.match(r,{ignoreSearch:true})||(r.mode==="navigate"?await caches.match("index.html"):null);
  if(!guardada)return red;
  try{const res=await conTiempo(red,ESPERA);return res.ok?res:guardada}catch{return guardada}
}
async function lib(r){
  const x=await caches.match(r);if(x)return x;
  const res=await fetch(r);if(res.ok||res.type==="opaque"){const c=res.clone();caches.open(LIBS).then(k=>k.put(r,c))}return res;
}
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);if(r.method!=="GET")return;
  if(u.origin===location.origin)e.respondWith(app(r));
  else if(/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(r.url))e.respondWith(lib(r));
});
