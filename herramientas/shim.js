/* RAO fuera de Claude: da a la app la misma interfaz window.claude.use("db"|"assets"|"downloads")
   pero guardando en Firestore (cuenta de Google de Aranza). Así el código de la app no cambia. */
(function(){
  const cfg=window.RAO_FIREBASE;
  const COLS=["config","conteos","lotes","animales","movimientos","eventos","partos","palpaciones","pesos","compras","articulos","comprasMov","leche","insumos","insumosMov","formulas","preparaciones","entregas"];
  const q=s=>document.querySelector(s);
  const avisar=m=>{if(typeof toast==="function")toast(m);else alert(m)};

  if(!cfg||!cfg.apiKey||/PEGAR/.test(cfg.apiKey)){
    window.claude={use:()=>Promise.reject(new Error("Falta la configuración de Firebase"))};
    document.addEventListener("DOMContentLoaded",()=>{const n=q("#sin-db");if(n){n.textContent="Falta la configuración de Firebase (firebase-config.js).";n.classList.remove("hidden")}});
    return;
  }
  firebase.initializeApp(cfg);
  const auth=firebase.auth(),fs=firebase.firestore();
  fs.settings({ignoreUndefinedProperties:true,merge:true});
  fs.enablePersistence({synchronizeTabs:true}).catch(e=>console.warn("Sin guardado local",e.code));

  /* Escrituras: no esperamos al servidor, así se puede capturar sin señal y se sube al volver. */
  const fallo=e=>{console.error(e);avisar(e?.code==="permission-denied"?"No se guardó: esta cuenta no tiene permiso":"No se guardó un cambio. Revisa la conexión.")};
  const suelta=p=>{p.catch(fallo);return Promise.resolve()};
  const docW=ref=>({id:ref.id,set:(d,o)=>suelta(ref.set(d,o||{})),update:d=>suelta(ref.update(d)),delete:()=>suelta(ref.delete()),get:()=>ref.get(),onSnapshot:(n,e)=>ref.onSnapshot(n,e)});
  const colW=name=>{const c=fs.collection(name);return{
    doc:id=>docW(id?c.doc(String(id)):c.doc()),
    add:d=>{const r=c.doc();suelta(r.set(d));return Promise.resolve({id:r.id})},
    get:()=>c.get(),
    onSnapshot:(n,e)=>c.onSnapshot(n,e)}};
  const dbW={collection:colW};

  /* Fotos: se guardan comprimidas dentro de Firestore (colección "fotos"), sin plan de pago. */
  const fotos={},pend={};
  const GIF="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  async function achicar(blob){
    const b=await createImageBitmap(blob);let lado=1100,cal=.72,url="";
    for(let i=0;i<5;i++){const s=Math.min(1,lado/Math.max(b.width,b.height)),c=document.createElement("canvas");c.width=Math.round(b.width*s);c.height=Math.round(b.height*s);c.getContext("2d").drawImage(b,0,0,c.width,c.height);url=c.toDataURL("image/jpeg",cal);if(url.length<700000)return url;lado*=.75;cal-=.08}
    const e=new Error("too_large");e.code="too_large";throw e;
  }
  window.fotoSrc=id=>{if(!id)return GIF;if(fotos[id])return fotos[id];
    if(!pend[id])pend[id]=fs.collection("fotos").doc(String(id)).get().then(s=>{const d=s.data()?.data;if(!d)return;fotos[id]=d;document.querySelectorAll("img[data-foto]").forEach(im=>{if(im.dataset.foto===id)im.src=d})}).catch(()=>{delete pend[id]});
    return GIF};
  const assetsW={upload:async blob=>{if(!/^image\//.test(blob.type||"image/")){const e=new Error("unsupported_type");e.code="unsupported_type";throw e}
    const data=await achicar(blob),id="f"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    fotos[id]=data;suelta(fs.collection("fotos").doc(id).set({data,creado:Date.now()}));return{id}}};

  const downloadsW={save:async({filename,data})=>{const u=URL.createObjectURL(data instanceof Blob?data:new Blob([data]));const a=Object.assign(document.createElement("a"),{href:u,download:filename});document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}};

  /* Entrada con Google */
  let listo;const ready=new Promise(r=>listo=r);
  const css=`#rao-login{position:fixed;inset:0;z-index:999;background:var(--bg,#000);color:var(--fg,#f2f0ea);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;text-align:center}
#rao-login svg{width:84px;height:88px;fill:none;stroke:var(--accent,#f2c230);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
#rao-login h1{font-size:40px}#rao-login p{color:var(--muted,#9b978c);max-width:320px;margin:0}
#rao-off{display:none}#rao-off.on{display:inline}
#rao-cta .dlg-body>*+*{margin-top:12px}`;
  function pantalla(msg,boton=true){let el=q("#rao-login");
    if(!el){el=document.createElement("div");el.id="rao-login";document.body.appendChild(el)}
    el.innerHTML=`<svg viewBox="60 26 160 168" aria-hidden="true"><path d="M68 145 L103 34 L153 145 M79 101 H107"/><circle cx="155" cy="134" r="55"/></svg><h1>RAO</h1><p>${msg}</p>${boton?'<button type="button" id="rao-entrar">Entrar con Google</button>':""}${auth.currentUser?'<button type="button" class="ghost sm" id="rao-salir2">Usar otra cuenta</button>':""}`;
    el.hidden=false;
    q("#rao-entrar")?.addEventListener("click",entrar);
    q("#rao-salir2")?.addEventListener("click",()=>auth.signOut());
  }
  async function entrar(){const p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:"select_account"});
    try{await auth.signInWithPopup(p)}catch(e){if(/popup/.test(e.code||""))await auth.signInWithRedirect(p);else pantalla("No se pudo entrar: "+(e.message||e.code))}}
  let decidido=false;
  auth.onAuthStateChanged(async u=>{decidido=true;
    if(!u){pantalla("Entra con tu cuenta de Google para ver y guardar tus datos.");return}
    try{await fs.collection("config").limit(1).get()}catch(e){
      if(e.code==="permission-denied"){pantalla(`La cuenta ${u.email} no tiene acceso a RAO.`,false);return}}
    q("#rao-login")?.setAttribute("hidden","");
    const em=q("#rao-email");if(em)em.textContent=u.email;
    listo();
  });

  window.claude={use:async n=>{await ready;if(n==="db")return dbW;if(n==="assets")return assetsW;if(n==="downloads")return downloadsW;throw new Error("No disponible: "+n)}};

  /* Menú de cuenta: respaldo, importar, instalar, salir */
  let instalar=null;
  addEventListener("beforeinstallprompt",e=>{e.preventDefault();instalar=e;const b=q("#rao-inst");if(b)b.hidden=false});
  async function exportarJSON(btn){btn.disabled=true;btn.textContent="Preparando…";
    try{const out={app:"RAO",version:1,fecha:new Date().toISOString(),colecciones:{},fotos:{}};
      for(const c of COLS){const s=await fs.collection(c).get();out.colecciones[c]=s.docs.map(d=>({id:d.id,...d.data()}))}
      const f=await fs.collection("fotos").get();f.docs.forEach(d=>out.fotos[d.id]=d.data().data);
      await downloadsW.save({filename:`RAO respaldo ${new Date().toISOString().slice(0,10)}.json`,data:new Blob([JSON.stringify(out)],{type:"application/json"})});
    }catch(e){fallo(e)}finally{btn.disabled=false;btn.textContent="Descargar respaldo completo"}}
  async function importarJSON(file,info){
    const j=JSON.parse(await file.text());if(!j||!j.colecciones)throw new Error("Ese archivo no es un respaldo de RAO");
    const ops=[];for(const [c,docs] of Object.entries(j.colecciones)){if(!COLS.includes(c))continue;for(const d of docs){const {id,...x}=d;ops.push([fs.collection(c).doc(String(id)),x])}}
    for(const [id,data] of Object.entries(j.fotos||{}))if(data&&data.length<1000000)ops.push([fs.collection("fotos").doc(id),{data,creado:Date.now()}]);
    for(let i=0;i<ops.length;i+=200){const b=fs.batch();ops.slice(i,i+200).forEach(([r,x])=>b.set(r,x));await b.commit();info.textContent=`Subiendo… ${Math.min(i+200,ops.length)} de ${ops.length}`}
    return ops.length}
  document.addEventListener("DOMContentLoaded",()=>{
    document.head.appendChild(Object.assign(document.createElement("style"),{textContent:css}));
    if(!decidido)pantalla("Conectando…",false);
    const row=q("#estado-con")?.parentElement;if(!row)return;
    row.insertAdjacentHTML("afterbegin",`<span class="pill warn small" id="rao-off">Sin señal: se sube al volver</span>`);
    row.insertAdjacentHTML("beforeend",`<button type="button" class="sm ghost" id="rao-cta-btn">Cuenta</button>`);
    document.body.insertAdjacentHTML("beforeend",`<dialog id="rao-cta"><div class="dlg-body">
      <div class="row between"><h2>Cuenta</h2><button type="button" class="sm ghost" id="rao-cerrar">Cerrar</button></div>
      <div class="muted small">Entraste como <b id="rao-email">${auth.currentUser?.email||""}</b></div>
      <button type="button" id="rao-inst" hidden>Instalar en este equipo</button>
      <button type="button" id="rao-exp">Descargar respaldo completo</button>
      <div><label class="f" for="rao-imp">Importar respaldo (.json)</label><input type="file" id="rao-imp" accept=".json,application/json"><div class="muted small" id="rao-imp-info">Agrega o reemplaza registros con el mismo identificador. No borra nada.</div></div>
      <button type="button" class="ghost" id="rao-salir">Cerrar sesión</button></div></dialog>`);
    const dlg=q("#rao-cta");
    q("#rao-cta-btn").onclick=()=>dlg.showModal();q("#rao-cerrar").onclick=()=>dlg.close();
    q("#rao-inst").hidden=!instalar;
    q("#rao-inst").onclick=async()=>{if(!instalar)return;instalar.prompt();await instalar.userChoice;instalar=null;q("#rao-inst").hidden=true};
    q("#rao-exp").onclick=e=>exportarJSON(e.currentTarget);
    q("#rao-imp").onchange=async e=>{const f=e.target.files[0],info=q("#rao-imp-info");if(!f)return;
      try{const n=await importarJSON(f,info);info.textContent=`Listo: ${n} registros importados.`;avisar("Respaldo importado")}catch(err){info.textContent="No se pudo importar: "+(err.message||err)}e.target.value=""};
    q("#rao-salir").onclick=()=>{dlg.close();auth.signOut().then(()=>location.reload())};
    const red=()=>q("#rao-off").classList.toggle("on",!navigator.onLine);addEventListener("online",red);addEventListener("offline",red);red();
  });

  if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
})();
