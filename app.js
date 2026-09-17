/* LISTA DE INVITADOS AGDV · Aplicación web reutilizable.
   La conexión pública se configura en config.js. Cada evento debe usar su propia hoja. */
'use strict';

// INICIO MODELO COMPARTIDO: también incluido en Code.gs para validar en el servidor.
const Model = (() => {
  const types = ['Mesa', 'Trasnoche', 'Extra'];
  const statuses = ['Pendiente', 'Confirmado', 'No asiste'];
  const defaultAdminHash = 'c72a9b91e666c10b4b87215397b2853c5fb892fcd81d2bbe0545ecef5d591706';
  const clone = value => JSON.parse(JSON.stringify(value));
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const active = guest => guest.status !== 'No asiste';
  const count = (state, tableId) => state.guests.filter(g => active(g) && g.type === 'Mesa' && g.tableId === tableId).length;
  const capacity = state => state.tables.reduce((total, t) => total + t.capacity, 0);
  const id = () => 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  function initial() {
    // El plano queda visible, pero las mesas y los invitados comienzan vacíos.
    return {version:1,config:{title:'Nuevo matrimonio',date:'2026-01-01',venue:'Lugar por definir',restrictions:['Normal','Alérgicos','Celíacos','Embarazada','Niño','Veganos','Vegetarianos'],planImage:'',planPdf:'',adminPasswordHash:defaultAdminHash,adminPasswordNeedsChange:true},tables:[],guests:[]};
  }
  function validate(s) {
    if(s && s.version===1 && s.config){
      const defaults=initial().config;
      s={...s,config:{...defaults,...s.config,restrictions:Array.isArray(s.config.restrictions)?s.config.restrictions:defaults.restrictions}};
    }
    const fail = message => { throw new Error(message); };
    const str = (v,max=200) => typeof v === 'string' && v.length <= max;
    const finite = (v,min,max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
    if(!s || s.version!==1 || !s.config || !Array.isArray(s.tables) || !Array.isArray(s.guests)) fail('El archivo no es un respaldo compatible de esta aplicación.');
    const c=s.config;
    if(!str(c.title,100)||!c.title.trim()||!str(c.venue,150)||!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||!Number.isFinite(Date.parse(c.date+'T12:00:00Z'))||new Date(c.date+'T12:00:00Z').toISOString().slice(0,10)!==c.date) fail('Revisa el nombre, lugar y fecha del evento.');
    if(!Array.isArray(c.restrictions)||!c.restrictions.length||c.restrictions.length>30||c.restrictions.some(r=>!str(r,50)||!r.trim())||new Set(c.restrictions.map(norm)).size!==c.restrictions.length) fail('Las categorías de alimentación deben ser distintas, de hasta 50 caracteres.');
    const asset = v => v === '' || (str(v,300) && (v.startsWith('https://') || (/^[\w .()%-]+\.(png|jpe?g|webp|pdf)$/i.test(v) && !v.includes('..'))));
    if(!asset(c.planImage)||!asset(c.planPdf)||!/^[a-f0-9]{64}$/i.test(c.adminPasswordHash)||typeof c.adminPasswordNeedsChange!=='boolean') fail('Revisa el plano, el PDF y la configuración de administración.');
    if(s.tables.length>150||s.guests.length>5000) fail('Límite de esta versión: 150 mesas y 5.000 invitados.');
    const ids=new Set(), names=new Set(), guestIds=new Set();
    for(const t of s.tables){
      if(!str(t.id,100)||!t.id||ids.has(t.id)||!str(t.name,30)||!t.name.trim()||names.has(norm(t.name))) fail('Cada mesa debe tener un nombre y un identificador únicos.');
      ids.add(t.id);names.add(norm(t.name));
      if(!['round','rect','square'].includes(t.shape)||!Number.isInteger(t.capacity)||!finite(t.capacity,1,100)||!finite(t.width,3,24)||!finite(t.height,3,28)||!finite(t.x,0,100)||!finite(t.y,0,100)||!finite(t.rotation,0,359)||!finite(t.opacity,30,100)||!/^#[0-9a-f]{6}$/i.test(t.color)) fail('Revisa capacidad, posición y apariencia de las mesas.');
    }
    for(const g of s.guests){
      if(!str(g.id,100)||!g.id||guestIds.has(g.id)||!str(g.firstName,100)||!g.firstName.trim()||!str(g.lastName,100)||!types.includes(g.type)||!statuses.includes(g.status)||!str(g.role,100)||!str(g.notes,1000)||!str(g.diet,50)||!c.restrictions.includes(g.diet)||!str(g.tableId,100)||!str(g.createdAt,40)) fail('Hay un invitado con datos incompletos o inválidos.');
      if(g.tableId && (g.type!=='Mesa'||!ids.has(g.tableId))) fail('Un invitado apunta a una mesa que no existe.');
      guestIds.add(g.id);
    }
    return clone(s);
  }
  const safeCell = value => { const s=String(value??'');return /^[\s]*[=+@-]/.test(s)?"'"+s:s; };
  const csv = rows => '\ufeff'+rows.map(row=>row.map(v=>'"'+safeCell(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
  return {types,statuses,clone,norm,active,count,capacity,id,initial,validate,safeCell,csv,defaultAdminHash};
})();
// FIN MODELO COMPARTIDO

if(typeof module!=='undefined' && module.exports) module.exports=Model;
if(typeof document!=='undefined') document.addEventListener('DOMContentLoaded',()=>{
  try{startApp();}
  catch(error){
    console.error(error);
    const notice=document.createElement('div');notice.className='boot-error';notice.innerHTML='<strong>No se pudo iniciar la aplicación.</strong><span>Recarga la página. Si continúa, reemplaza index.html, styles.css y app.js juntos por la versión más reciente.</span>';
    document.body.prepend(notice);
  }
});

function startApp(){
  const $ = id => document.getElementById(id);
  const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isLocalPreview=globalThis.location?.protocol==='file:';
  const locationKey=typeof globalThis.location==='object'&&globalThis.location.pathname?globalThis.location.pathname.replace(/[^a-z0-9]+/gi,'-').slice(-80):'local';
  const KEY='agdv-matrimonios-plantilla-v1-'+locationKey, RECOVERY=KEY+'-recuperacion', CLOUD_KEY=KEY+'-google';
  const CLOUD_URL_RE=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  const publicCloud=()=>{const config=globalThis.AGDV_PUBLIC_SYNC;if(!config||!CLOUD_URL_RE.test(String(config.url||'').trim())||typeof config.clientToken!=='string'||config.clientToken.length<16)return null;return {url:config.url.trim(),token:config.clientToken,revision:0,blocked:false,access:'client',public:true};};
  let state=Model.initial(), view='invitados', filter='Todos', page=1, selectedId=state.tables[0]?.id||'', dietFilter='', zoom=1, cards=false, moving=false, moveSnapshot=null, isAdmin=false;
  let busy=false, cloud=publicCloud(), storageBroken=false, toastTimer, rawBroken='';
  let syncRunning=false, syncDirty=false, syncSnapshot=null;
  const dialog=$('editorDialog');
  try {const saved=localStorage.getItem(KEY);if(saved){const local=Model.validate(JSON.parse(saved));state=!local.tables.length&&!local.guests.length&&local.config.title==='Nuevo matrimonio'&&!local.config.planImage?Model.initial():local;}}catch(e){storageBroken=true;try{rawBroken=localStorage.getItem(KEY)||'';}catch(_){}setTimeout(()=>toast('El navegador no permite guardar localmente. Puedes trabajar en esta sesión o conectar Google Sheets.',true),300);}
  try {const savedCloud=JSON.parse(localStorage.getItem(CLOUD_KEY)||'null');if(savedCloud&&CLOUD_URL_RE.test(savedCloud.url)&&typeof savedCloud.token==='string'&&savedCloud.token.length>=16)cloud={url:savedCloud.url,token:savedCloud.token,revision:Number(savedCloud.revision)||0,blocked:false,access:'admin'};}catch(_){}
  const name = g => `${g.firstName} ${g.lastName}`.trim();
  const tableName = t => t ? (t.name==='Novios'?'Mesa de novios':`Mesa ${t.name}`) : 'Por asignar';
  const location = g => g.type==='Mesa'?tableName(state.tables.find(t=>t.id===g.tableId)):g.type==='Extra'?(g.role||'Equipo / extra'):'Trasnoche';
  function toast(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').className='toast visible'+(error?' error':'');toastTimer=setTimeout(()=>$('toast').className='toast',error?7500:3800);}
  function status(message,error=false){$('saveStatus').textContent=message;$('saveStatus').className='save-status'+(error?' error':'');}
  function rememberCloud(){if(!cloud||cloud.access!=='admin')return;try{localStorage.setItem(CLOUD_KEY,JSON.stringify({url:cloud.url,token:cloud.token,revision:cloud.revision}));}catch(_){}}
  function forgetCloud(){try{localStorage.removeItem(CLOUD_KEY);}catch(_){}}
  function formError(error){const el=$('formError');if(el){el.textContent=error.message||String(error);el.scrollIntoView({block:'nearest'});}else toast(error.message||String(error),true);}
  function requireIdle(){if(busy)throw new Error('Espera a que termine el guardado.');if(moving)throw new Error('Termina de mover la mesa antes de continuar.');}
  function requireAdmin(){if(!isAdmin)throw new Error('Esta acción requiere la contraseña de administración.');}
  async function hashText(value){
    if(!globalThis.crypto?.subtle){if(value==='AGDV-Admin-2026!')return Model.defaultAdminHash;throw new Error('Para usar una contraseña personalizada, abre la aplicación desde la URL HTTPS de Render.');}
    const bytes=new TextEncoder().encode(value), digest=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function assetHref(value){return /^https:\/\//i.test(value)?value:encodeURI(value);}
  function syncAccessUI(){
    document.body.classList.toggle('admin-mode',isAdmin);
    const btn=$('adminBtn');if(btn){btn.innerHTML=isAdmin?'<span aria-hidden="true">🔓</span> Salir administración':'<span aria-hidden="true">🔒</span> Administración';btn.setAttribute('aria-label',isAdmin?'Salir del modo administración':'Entrar al modo administración');}
    $('accessMode').textContent=isAdmin?'Modo administración':'Gestión de invitados';
    $('exportAccessTitle').textContent=isAdmin?'Exportaciones disponibles':'Las exportaciones están protegidas';
    $('exportAccessText').textContent=isAdmin?'Desde aquí puedes descargar y respaldar la información.':'Entra al modo administración para descargar listas, respaldos o conectar una Google Sheet.';
  }
  function disableForm(value){document.querySelectorAll('#dialogBody button[type="submit"]').forEach(b=>b.disabled=value);}
  async function request(connection,action,payload={}){
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),25000);
    try{
      const response=await fetch(connection.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token:connection.token,...payload}),signal:controller.signal,redirect:'follow',credentials:'omit'});
      if(!response.ok)throw new Error('Google no respondió correctamente.');
      const data=await response.json();
      if(!data.ok)throw new Error(data.error||'No se pudo completar la operación.');
      return data;
    }catch(e){if(e.name==='AbortError')throw new Error('Google tardó demasiado. Actualiza antes de volver a intentar.');if(e instanceof TypeError||/failed to fetch/i.test(e.message||''))throw new Error('No se pudo conectar con Google Sheets. Revisa la URL /exec, los permisos de la implementación y abre la aplicación desde Render.');throw e;}
    finally{clearTimeout(timer);}
  }
  function queueCloudSave(next){
    const connection=cloud;
    syncSnapshot=Model.clone(next);syncDirty=true;
    try{localStorage.setItem(RECOVERY,JSON.stringify(syncSnapshot));}catch(_){}
    status('Sincronizando…');
    if(syncRunning)return;
    syncRunning=true;
    void (async()=>{
      while(syncDirty&&cloud===connection&&!connection.blocked){
        syncDirty=false;
        const snapshot=Model.clone(syncSnapshot);
        try{
          const result=await request(connection,'save',{expectedRevision:connection.revision,state:snapshot});
          connection.revision=result.revision;rememberCloud();
          if(result.warning)toast(result.warning,true);
        }catch(e){
          connection.blocked=true;syncDirty=false;
          status('Pendiente de sincronizar',true);
          toast(e.message+' El cambio sigue visible y quedó guardado como recuperación. Pulsa Actualizar para verificarlo.',true);
        }
      }
      syncRunning=false;
      if(cloud===connection&&!connection.blocked&&!syncDirty){
        try{localStorage.removeItem(RECOVERY);}catch(_){}
        status('Sincronizado');
      }
    })();
  }
  async function commit(next,message,adminRequired=true){
    requireIdle();if(adminRequired)requireAdmin();Model.validate(next);
    if(adminRequired&&cloud?.access==='client')throw new Error('Para guardar mesas o ajustes en Google, conecta ADMIN_TOKEN desde Administración > Ajustes.');
    if(cloud?.blocked)throw new Error('Actualiza la lista desde Google antes de hacer más cambios. Hay una operación sin confirmar.');
    if(!cloud&&!storageBroken){const disk=localStorage.getItem(KEY);if(disk&&disk!==JSON.stringify(state))throw new Error('La lista cambió en otra pestaña. Pulsa Actualizar antes de guardar para conservar esos cambios.');}
    state=next;
    try{localStorage.setItem(KEY,JSON.stringify(next));storageBroken=false;}
    catch(_){storageBroken=true;rawBroken=JSON.stringify(next);}
    render();toast(message);
    if(cloud)queueCloudSave(next);
    else status(storageBroken?'Cambios temporales':'Guardado en este dispositivo',storageBroken);
    return true;
  }
  function setView(next,scroll=true){if(moving){toast('Guarda o cancela el movimiento de la mesa.',true);return;}view=['invitados','mesas','catering','respaldo'].includes(next)?next:'invitados';document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!=='view-'+view);document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});if(view==='mesas')renderMap();if(scroll&&window.innerWidth<=600)$('view-'+view).scrollIntoView({block:'start',behavior:'instant'});}
  function render(){
    $('eventTitle').textContent=state.config.title;
    const date=new Date(state.config.date+'T12:00:00');
    $('eventMeta').textContent=date.toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'})+(state.config.venue?' · '+state.config.venue:'');
    document.title=state.config.title+' · Invitados';
    document.querySelector('.page-footer span:last-child').textContent=date.toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'}).toUpperCase();
    const active=state.guests.filter(Model.active),assigned=active.filter(g=>g.type==='Mesa'&&g.tableId).length, cap=Model.capacity(state), confirmed=state.guests.filter(g=>g.status==='Confirmado').length, pending=state.guests.filter(g=>g.status==='Pendiente').length,unassigned=active.filter(g=>g.type==='Mesa'&&!g.tableId).length;
    const stats=[['Total registrados',state.guests.length,`${active.length} previstos · ${state.guests.length-active.length} no asisten`],['Confirmados',confirmed,`${pending} por confirmar`],['Con mesa asignada',assigned,`${unassigned} personas por ubicar`],['Cupos disponibles',Math.max(0,cap-assigned),`${state.tables.length} mesas · ${cap} cupos totales`]];
    $('stats').innerHTML=stats.map(s=>`<article class="stat"><p class="stat-label">${s[0]}</p><p class="stat-value">${s[1]}</p><p class="stat-note">${s[2]}</p></article>`).join('');
    const percent=cap?Math.round(assigned/cap*100):0;
    $('occupancyRing').style.setProperty('--progress',Math.min(percent,100)+'%');$('occupancyNumber').textContent=percent+'%';$('occupancyText').textContent=`${assigned} de ${cap} lugares asignados`;
    $('quickSummary').innerHTML=[['Por confirmar',pending],['Sin mesa asignada',unassigned],['Trasnoche',active.filter(g=>g.type==='Trasnoche').length],['Equipo / extras',active.filter(g=>g.type==='Extra').length]].map(([l,n])=>`<div class="summary-line"><span>${l}</span><strong>${n}</strong></div>`).join('');
    const plan=$('planImage'), placeholder=$('planPlaceholder');
    if(state.config.planImage){plan.hidden=false;plan.src=assetHref(state.config.planImage);if(placeholder)placeholder.hidden=true;}else{plan.hidden=true;plan.removeAttribute('src');if(placeholder)placeholder.hidden=false;}
    const pdfLink=document.querySelector('.map-footer a');if(pdfLink){pdfLink.hidden=!state.config.planPdf;if(state.config.planPdf){pdfLink.href=assetHref(state.config.planPdf);pdfLink.textContent='Abrir PDF del plano ↗';}}
    renderGuests();renderMap();renderCatering();syncAccessUI();
  }
  function row(g,showLocation=true){const initial=(g.firstName[0]||'')+(g.lastName[0]||'');return `<div class="guest-row"><div class="guest-avatar" aria-hidden="true">${esc(initial.toUpperCase())}</div><div class="guest-info"><div class="guest-name">${esc(name(g))}</div><div class="guest-meta">${esc(location(g))}${g.diet!=='Normal'?' · '+esc(g.diet):''}</div><div class="guest-badges"><span class="badge ${g.status==='Confirmado'?'confirmed':g.status==='No asiste'?'declined':'pending'}">${esc(g.status)}</span>${g.notes?'<span class="badge">Con observaciones</span>':''}</div></div>${showLocation?`<div class="guest-location">${esc(location(g))}</div>`:''}<button class="icon-button" data-edit-guest="${esc(g.id)}" aria-label="Editar a ${esc(name(g))}" title="Editar invitado">✎</button></div>`;}
  function renderGuests(){
    const term=Model.norm($('search').value), statusFilter=$('statusFilter').value;
    const list=state.guests.filter(g=>(filter==='Todos'||(filter==='Sin mesa'?g.type==='Mesa'&&!g.tableId&&Model.active(g):g.type===filter))&&(!statusFilter||g.status===statusFilter)&&Model.norm(name(g)+' '+location(g)+' '+g.role+' '+g.diet+' '+g.notes).includes(term)).sort((a,b)=>name(a).localeCompare(name(b),'es'));
    const totalPages=Math.max(1,Math.ceil(list.length/30));page=Math.max(1,Math.min(page,totalPages));
    $('listCount').textContent=state.guests.length;
    $('guestList').innerHTML=list.length?list.slice((page-1)*30,page*30).map(g=>row(g)).join(''):`<div class="empty-state"><div class="empty-icon" aria-hidden="true">${state.guests.length?'⌕':'Aa'}</div><h3>${state.guests.length?'No encontramos coincidencias':'La celebración comienza aquí'}</h3><p>${state.guests.length?'Prueba otro nombre o cambia los filtros.':'Agrega a tus invitados y empieza a organizar el evento.'}</p><button class="primary" ${state.guests.length?'id="clearFilters"':'data-add-guest=""'}>${state.guests.length?'Limpiar filtros':'＋ Agregar primer invitado'}</button></div>`;
    $('resultText').textContent=list.length?`${(page-1)*30+1}–${Math.min(page*30,list.length)} de ${list.length} invitados`:'Sin invitados para mostrar';$('pageText').textContent=`${page} / ${totalPages}`;$('prevPage').disabled=page===1;$('nextPage').disabled=page===totalPages;
  }
  function occupancy(t){const n=Model.count(state,t.id);return {n,cls:n===0?'available':n<t.capacity?'partial':n===t.capacity?'full':'over',label:n===0?'Libre':n<t.capacity?'Con invitados':n===t.capacity?'Completa':'Sobre cupo'};}
  function renderMap(){
    if(!state.tables.some(t=>t.id===selectedId))selectedId=state.tables[0]?.id||'';
    $('markers').innerHTML=state.tables.map(t=>{const o=occupancy(t);return `<button class="marker ${t.shape}${t.id===selectedId?' selected':''}" data-table="${esc(t.id)}" style="left:${t.x}%;top:${t.y}%;width:${t.width}%;height:${t.height}%;--rotation:${t.rotation}deg;--table-color:${t.color};--opacity:${t.opacity/100}" aria-label="${esc(tableName(t))}, ${o.n} de ${t.capacity}, ${o.label}" aria-pressed="${t.id===selectedId}"><i class="status-dot ${o.cls}"></i><span>${esc(t.name)}</span><small>${o.n}/${t.capacity}</small></button>`;}).join('');
    $('tableCards').innerHTML=state.tables.map(t=>{const o=occupancy(t);return `<button class="table-card${t.id===selectedId?' selected':''}" data-table="${esc(t.id)}" aria-pressed="${t.id===selectedId}"><span class="dot ${o.cls}"></span> <small>${o.label}</small><strong>${esc(tableName(t))}</strong><small>${o.n} / ${t.capacity} personas</small></button>`;}).join('')||'<p class="muted">Crea tu primera mesa.</p>';
    const t=state.tables.find(t=>t.id===selectedId);
    $('tableDetail').innerHTML=t?(()=>{const o=occupancy(t), guests=state.guests.filter(g=>g.type==='Mesa'&&g.tableId===t.id).sort((a,b)=>name(a).localeCompare(name(b),'es'));return `<p class="eyebrow">${{round:'REDONDA',rect:'RECTANGULAR',square:'CUADRADA'}[t.shape]}</p><h2>${esc(tableName(t))}</h2><p class="muted small">${o.n} de ${t.capacity} cupos · ${o.label}</p><div class="detail-bar"><span style="width:${Math.min(100,o.n/t.capacity*100)}%"></span></div><button class="primary" data-add-guest="${esc(t.id)}">＋ Agregar invitado</button><div class="detail-actions"><button class="secondary admin-only" id="editTableBtn">Editar datos</button><button class="secondary admin-only" id="moveTableBtn">Mover</button><button class="text-button admin-only" id="duplicateTableBtn">Duplicar</button></div><h3>Invitados de esta mesa</h3>${guests.length?guests.map(g=>row(g,false)).join(''):'<p class="small muted" style="margin-top:15px">Aún no hay invitados.</p>'}`;})():'<p class="eyebrow">EMPECEMOS</p><h2>Tu distribución</h2><p class="muted">El administrador debe crear las mesas antes de asignar invitados.</p><button class="primary admin-only" id="createFirstTableBtn" style="width:100%;margin-top:18px">＋ Crear primera mesa</button>';
    $('mapViewport').hidden=cards;$('tableCards').hidden=!cards;document.querySelector('.zoom-controls').hidden=cards;
    $('showMap').classList.toggle('active',!cards);$('showCards').classList.toggle('active',cards);$('showMap').setAttribute('aria-pressed',String(!cards));$('showCards').setAttribute('aria-pressed',String(cards));
    applyZoom();
  }
  function applyZoom(){const base=Math.max($('mapViewport').clientWidth,window.innerWidth<=600?640:420);$('board').style.width=Math.round(base*zoom)+'px';$('zoomReset').textContent=Math.round(zoom*100)+'%';$('zoomOut').disabled=zoom<=1;$('zoomIn').disabled=zoom>=3;}
  function renderCatering(){
    if(dietFilter&&!state.config.restrictions.includes(dietFilter))dietFilter='';
    const active=state.guests.filter(Model.active);
    $('cateringCards').innerHTML=state.config.restrictions.map(d=>`<button class="catering-card${dietFilter===d?' active':''}" data-diet="${esc(d)}" aria-pressed="${dietFilter===d}"><strong>${active.filter(g=>g.diet===d).length}</strong><span>${esc(d)}</span></button>`).join('');
    $('cateringTitle').textContent=dietFilter||'Todos los menús';
    const guests=active.filter(g=>!dietFilter||g.diet===dietFilter).sort((a,b)=>location(a).localeCompare(location(b),'es',{numeric:true})||name(a).localeCompare(name(b),'es'));
    $('cateringList').innerHTML=guests.length?guests.map(g=>`<div class="guest-row"><div class="guest-info"><div class="guest-name">${esc(name(g))}</div><div class="guest-meta">${esc(location(g))} · ${esc(g.diet)} · ${esc(g.status)}</div>${g.notes?`<p class="small" style="margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere">${esc(g.notes)}</p>`:''}</div><button class="icon-button" data-edit-guest="${esc(g.id)}" aria-label="Editar a ${esc(name(g))}">✎</button></div>`).join(''):'<div class="empty-state"><h3>Todo por preparar</h3><p>Las necesidades de alimentación aparecerán al registrar invitados.</p></div>';
  }
  function openDialog(title,eyebrow,body){requireIdle();$('dialogTitle').textContent=title;$('dialogEyebrow').textContent=eyebrow;$('dialogBody').innerHTML=body;if(typeof dialog.showModal==='function'){if(dialog.open)dialog.close();dialog.showModal();}else{dialog.setAttribute('open','');}document.body.classList.add('no-scroll');}
  function closeDialog(){if(busy){toast('Espera a que termine el guardado.');return;}if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
  function openAdminLogin(){
    if(isAdmin){if(moving){toast('Guarda o cancela el movimiento antes de salir.',true);return;}isAdmin=false;syncAccessUI();renderGuests();renderMap();toast('Modo consulta activado');return;}
    openDialog('Entrar a administración','ACCESO PROTEGIDO',`<form id="adminLoginForm" class="form-grid"><p class="form-note span-2">Los clientes pueden agregar, editar y eliminar invitados. La contraseña de administración habilita mesas, plano, ajustes, exportaciones y conexión con Google Sheets.</p><label class="field span-2">Contraseña<input id="adminPassword" type="password" autocomplete="current-password" required minlength="8" autofocus></label><div id="formError" class="form-error span-2" role="alert"></div><div class="form-actions span-2"><button type="button" class="secondary" data-close>Cancelar</button><button type="submit" class="primary">Entrar</button></div></form>`);
    $('adminLoginForm').onsubmit=async e=>{e.preventDefault();try{const digest=await hashText($('adminPassword').value);if(digest!==state.config.adminPasswordHash)throw new Error('Contraseña incorrecta.');isAdmin=true;syncAccessUI();renderGuests();renderMap();closeDialog();toast(state.config.adminPasswordNeedsChange?'Acceso concedido. Cambia la contraseña desde Ajustes.':'Modo administración activado');}catch(error){formError(error);}};
  }
  dialog.addEventListener('close',()=>document.body.classList.remove('no-scroll'));
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('closeDialog').onclick=closeDialog;
  const options = (values,selected) => values.map(v=>`<option value="${esc(v)}"${v===selected?' selected':''}>${esc(v)}</option>`).join('');
  const field = (label,id,value='',extra='',type='text') => `<label class="field">${label}<input id="${id}" name="${id}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  function openGuest(id='',tableId=''){
    const original=state.guests.find(g=>g.id===id), g=original||{id:Model.id(),firstName:'',lastName:'',type:'Mesa',tableId,role:'',diet:state.config.restrictions[0],notes:'',status:'Pendiente',createdAt:new Date().toISOString()};
    openDialog(original?'Editar invitado':'Un nuevo invitado','LISTA DE INVITADOS',`<form id="guestForm" class="form-grid">
      ${field('Nombre *','firstName',g.firstName,'required maxlength="100" autocomplete="given-name"')}${field('Apellido','lastName',g.lastName,'maxlength="100" autocomplete="family-name"')}
      <label class="field">Tipo de invitado<select id="guestType">${options(Model.types,g.type)}</select></label><label class="field">Confirmación<select id="guestStatus">${options(Model.statuses,g.status)}</select></label>
      <label class="field span-2" id="tableField">Mesa<select id="guestTable"><option value="">Por asignar</option>${state.tables.map(t=>`<option value="${esc(t.id)}"${t.id===g.tableId?' selected':''}>${esc(tableName(t))} · ${Model.count(state,t.id)}/${t.capacity}</option>`).join('')}</select></label>
      <label class="field span-2" id="roleField">Rol en el evento<input id="guestRole" maxlength="100" value="${esc(g.role)}" placeholder="Ej. Fotografía, DJ, coordinación"></label>
      <label class="field span-2">Alimentación / categoría<select id="guestDiet">${options(state.config.restrictions,g.diet)}</select></label>
      <label class="field span-2">Observaciones para el equipo<textarea id="guestNotes" maxlength="1000" placeholder="Ej. alergia al maní, menú especial…">${esc(g.notes)}</textarea></label>
      <label class="checkbox-field span-2" id="overField"><input type="checkbox" id="allowOver"> Permitir sobrecupo para esta asignación</label>
      <div id="formError" class="form-error span-2" role="alert"></div>
      <div class="form-actions span-2">${original?'<button type="button" id="deleteGuestBtn" class="danger-button">Eliminar</button>':'<button type="button" class="secondary" data-close>Cancelar</button>'}<button class="primary" type="submit">${original?'Guardar cambios':'Guardar invitado'}</button></div></form>`);
    const toggle=()=>{$('tableField').hidden=$('guestType').value!=='Mesa';$('overField').hidden=$('guestType').value!=='Mesa';$('roleField').hidden=$('guestType').value!=='Extra';};$('guestType').onchange=toggle;toggle();
    $('guestForm').onsubmit=async e=>{e.preventDefault();$('formError').textContent='';try{
      const updated={...g,firstName:$('firstName').value.trim(),lastName:$('lastName').value.trim(),type:$('guestType').value,status:$('guestStatus').value,tableId:$('guestType').value==='Mesa'?$('guestTable').value:'',role:$('guestType').value==='Extra'?$('guestRole').value.trim():'',diet:$('guestDiet').value,notes:$('guestNotes').value.trim()};
      const next=Model.clone(state);const index=next.guests.findIndex(x=>x.id===g.id);if(index>=0)next.guests[index]=updated;else next.guests.push(updated);
      const t=next.tables.find(t=>t.id===updated.tableId);if(t&&Model.count(next,t.id)>t.capacity&&Model.active(updated)&&!$('allowOver').checked)throw new Error(`${tableName(t)} excedería sus ${t.capacity} cupos. Elige otra mesa o autoriza el sobrecupo.`);
      const duplicate=state.guests.some(x=>x.id!==g.id&&Model.norm(name(x))===Model.norm(name(updated)));
      if(duplicate&&!confirm('Ya existe una persona con ese nombre y apellido. ¿Guardar igualmente?'))return;
      await commit(next,original?'Invitado actualizado':'Invitado agregado',false);closeDialog();
    }catch(error){formError(error);}};
    if(original)$('deleteGuestBtn').onclick=async()=>{if(!confirm(`¿Eliminar a ${name(g)} de la lista?`))return;try{const next=Model.clone(state);next.guests=next.guests.filter(x=>x.id!==id);await commit(next,'Invitado eliminado',false);closeDialog();}catch(e){formError(e);}};
  }
  function nextTableName(){let next=1;while(state.tables.some(t=>t.name===String(next)))next++;return String(next);}
  function openTable(id=''){
    requireAdmin();
    const original=state.tables.find(t=>t.id===id);
    const t=original||{id:Model.id(),name:nextTableName(),capacity:10,shape:'round',x:50,y:50,width:7,height:5.1,rotation:0,color:'#176c67',opacity:94};
    openDialog(original?'Editar mesa':'Crear mesa','DISTRIBUCIÓN',`<form id="tableForm" class="form-grid">${field('Nombre o número *','tableName',t.name,'required maxlength="30"')}${field('Capacidad *','tableCapacity',t.capacity,'required min="1" max="100" step="1"','number')}
      <label class="field">Forma<select id="tableShape"><option value="round"${t.shape==='round'?' selected':''}>Redonda</option><option value="rect"${t.shape==='rect'?' selected':''}>Rectangular</option><option value="square"${t.shape==='square'?' selected':''}>Cuadrada</option></select></label>${field('Color','tableColor',t.color,'','color')}
      <p class="form-note span-2">Guarda la mesa y luego arrástrala directamente sobre el plano.</p>
      <details class="advanced-settings span-2"><summary>Ajustes precisos de posición y tamaño</summary><div class="advanced-grid">${field('Posición horizontal (%)','tableX',t.x,'required min="0" max="100" step="0.1"','number')}${field('Posición vertical (%)','tableY',t.y,'required min="0" max="100" step="0.1"','number')}${field('Ancho (%)','tableWidth',t.width,'required min="3" max="24" step="0.1"','number')}${field('Alto (%)','tableHeight',t.height,'required min="3" max="28" step="0.1"','number')}${field('Rotación (°)','tableRotation',t.rotation,'required min="0" max="359" step="1"','number')}${field('Opacidad (%)','tableOpacity',t.opacity,'required min="30" max="100" step="1"','number')}</div></details>
      <div id="formError" class="form-error span-2" role="alert"></div><div class="form-actions span-2">${original?'<button type="button" id="deleteTableBtn" class="danger-button">Eliminar</button>':'<button type="button" class="secondary" data-close>Cancelar</button>'}<button type="submit" class="primary">${original?'Guardar cambios':'Crear y ubicar'}</button></div></form>`);
    $('tableShape').onchange=()=>{if(original)return;const rect=$('tableShape').value==='rect';$('tableWidth').value=rect?5.7:7;$('tableHeight').value=rect?15.5:5.1;};
    $('tableForm').onsubmit=async e=>{e.preventDefault();try{const updated={...t,name:$('tableName').value.trim(),capacity:Number($('tableCapacity').value),shape:$('tableShape').value,color:$('tableColor').value,x:Number($('tableX').value),y:Number($('tableY').value),width:Number($('tableWidth').value),height:Number($('tableHeight').value),rotation:Number($('tableRotation').value),opacity:Number($('tableOpacity').value)};const next=Model.clone(state);const i=next.tables.findIndex(x=>x.id===t.id);if(i<0)next.tables.push(updated);else next.tables[i]=updated;await commit(next,original?'Mesa actualizada':'Mesa creada');selectedId=t.id;closeDialog();setView('mesas',false);if(!original)setTimeout(()=>{try{startMoving();}catch(error){toast(error.message,true);}},0);}catch(error){formError(error);}};
    if(original)$('deleteTableBtn').onclick=async()=>{const assigned=state.guests.filter(g=>g.tableId===id).length;if(!confirm(`¿Eliminar ${tableName(t)}?${assigned?' Sus '+assigned+' invitados quedarán por asignar.':''}`))return;try{const next=Model.clone(state);next.tables=next.tables.filter(x=>x.id!==id);next.guests.forEach(g=>{if(g.tableId===id)g.tableId='';});await commit(next,'Mesa eliminada; invitados conservados');closeDialog();}catch(e){formError(e);}};
  }
  async function duplicateTable(id){
    requireIdle();requireAdmin();const source=state.tables.find(t=>t.id===id);if(!source)return;
    const copy={...Model.clone(source),id:Model.id(),name:nextTableName(),x:Math.min(95,source.x+3),y:Math.min(95,source.y+3)};
    const next=Model.clone(state);next.tables.push(copy);await commit(next,'Mesa duplicada');selectedId=copy.id;setView('mesas',false);startMoving();
  }
  function startMoving(){
    requireIdle();requireAdmin();if(!selectedId)return;moving=true;cards=false;moveSnapshot=Model.clone(state);renderMap();$('board').classList.add('move-active');
    const banner=document.createElement('div');banner.className='move-banner';banner.id='moveBanner';banner.innerHTML='<span>Arrastra la mesa seleccionada. También puedes usar las flechas del teclado.</span><button class="text-button" id="cancelMove">Cancelar</button><button class="primary" id="saveMove">Guardar</button>';$('mapViewport').before(banner);
    $('cancelMove').onclick=()=>{state=moveSnapshot;finishMove();renderMap();};
    $('saveMove').onclick=async()=>{const next=Model.clone(state);state=moveSnapshot;finishMove();try{await commit(next,'Posición guardada');}catch(e){renderMap();toast(e.message,true);}};
    const el=document.querySelector('.marker.selected');el?.scrollIntoView({block:'center',inline:'center'});el?.focus({preventScroll:true});
  }
  function finishMove(){moving=false;moveSnapshot=null;$('board').classList.remove('move-active');$('moveBanner')?.remove();}
  let drag=null;
  $('markers').addEventListener('pointerdown',e=>{const el=e.target.closest('[data-table]');if(!moving||!el||el.dataset.table!==selectedId)return;e.preventDefault();const t=state.tables.find(x=>x.id===selectedId);const b=$('board').getBoundingClientRect();drag={id:e.pointerId,el,x:e.clientX,y:e.clientY,tx:t.x,ty:t.y,width:b.width,height:b.height};el.setPointerCapture(e.pointerId);});
  $('markers').addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const t=state.tables.find(x=>x.id===selectedId);t.x=Math.round(Math.max(t.width/2,Math.min(100-t.width/2,drag.tx+(e.clientX-drag.x)/drag.width*100))*10)/10;t.y=Math.round(Math.max(t.height/2,Math.min(100-t.height/2,drag.ty+(e.clientY-drag.y)/drag.height*100))*10)/10;drag.el.style.left=t.x+'%';drag.el.style.top=t.y+'%';});
  const endDrag=()=>{drag=null;};$('markers').addEventListener('pointerup',endDrag);$('markers').addEventListener('pointercancel',endDrag);
  $('markers').addEventListener('keydown',e=>{if(!moving||!e.target.matches('.selected')||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const t=state.tables.find(x=>x.id===selectedId),step=e.shiftKey?2:.2;t.x=Math.max(t.width/2,Math.min(100-t.width/2,t.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0)));t.y=Math.max(t.height/2,Math.min(100-t.height/2,t.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)));t.x=Math.round(t.x*10)/10;t.y=Math.round(t.y*10)/10;e.target.style.left=t.x+'%';e.target.style.top=t.y+'%';});
  function download(content,file,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  const stamp=()=>new Date().toISOString().slice(0,10);
  function backup(){requireAdmin();download(JSON.stringify(state,null,2),`respaldo-${stamp()}.json`,'application/json');toast('Respaldo descargado');}
  function csv(catering=false){requireAdmin();const guests=state.guests.filter(g=>!catering||Model.active(g)).sort((a,b)=>location(a).localeCompare(location(b),'es',{numeric:true})||name(a).localeCompare(name(b),'es'));const rows=[['Nombre','Apellido','Tipo','Mesa / ubicación','Confirmación','Alimentación','Rol','Observaciones'],...guests.map(g=>[g.firstName,g.lastName,g.type,location(g),g.status,g.diet,g.role,g.notes])];download(Model.csv(rows),`${catering?'catering':'invitados'}-${stamp()}.csv`,'text/csv;charset=utf-8');}
  function print(){
    requireAdmin();
    const groups=new Map(state.tables.map(t=>[tableName(t),[]]));groups.set('Por asignar',[]);groups.set('Trasnoche',[]);groups.set('Equipo / extras',[]);
    state.guests.forEach(g=>{const key=g.type==='Extra'?'Equipo / extras':location(g);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(g);});
    $('printArea').innerHTML=`<h1>${esc(state.config.title)}</h1><p>${esc($('eventMeta').textContent)}</p><p>${state.guests.length} registrados · ${state.guests.filter(Model.active).length} previstos · ${Model.capacity(state)} cupos en mesas</p><p class="print-note">Los pendientes se incluyen en la planificación. Quienes no asisten no ocupan cupos.</p>`+[...groups].filter(([,g])=>g.length).map(([key,guests])=>`<h2>${esc(key)}</h2><table><thead><tr><th>Invitado</th><th>Confirmación</th><th>Alimentación</th><th>Observaciones</th></tr></thead><tbody>${guests.sort((a,b)=>name(a).localeCompare(name(b),'es')).map(g=>`<tr><td>${esc(name(g))}${g.role?' · '+esc(g.role):''}</td><td>${esc(g.status)}</td><td>${esc(g.diet)}</td><td>${esc(g.notes)}</td></tr>`).join('')}</tbody></table>`).join('')+`<h2>Resumen de catering</h2><table><thead><tr><th>Categoría</th><th>Confirmados</th><th>Pendientes</th><th>Total previsto</th></tr></thead><tbody>${state.config.restrictions.map(d=>{const a=state.guests.filter(g=>Model.active(g)&&g.diet===d);return `<tr><td>${esc(d)}</td><td>${a.filter(g=>g.status==='Confirmado').length}</td><td>${a.filter(g=>g.status==='Pendiente').length}</td><td>${a.length}</td></tr>`;}).join('')}</tbody></table><p class="print-note">Preparado el ${esc(new Date().toLocaleString('es-CL'))} · AGDV</p>`;
    window.print();
  }
  function openSettingsLegacy(){
    requireAdmin();
    openDialog('Ajustes del evento','PERSONALIZAR',`<form id="settingsForm" class="form-grid"><label class="field span-2">Nombre del evento<input id="cfgTitle" value="${esc(state.config.title)}" maxlength="100" required></label>${field('Fecha','cfgDate',state.config.date,'required','date')}${field('Lugar','cfgVenue',state.config.venue,'maxlength="150"')}<label class="field span-2">Categorías de alimentación<textarea id="cfgDiets" rows="5">${esc(state.config.restrictions.join('\n'))}</textarea><span class="field-help">Una por línea. Para retirar una categoría utilizada, cambia primero a sus invitados.</span></label><div id="formError" class="form-error span-2" role="alert"></div><button type="submit" class="primary span-2">Guardar ajustes</button></form>
      <section class="settings-section"><h3>Google Sheets</h3><p>${cloud?'Este dispositivo está conectado y se actualiza automáticamente.':'Conecta la nueva hoja siguiendo PASO A PASO. La conexión queda guardada en este dispositivo.'}</p>${cloud?'<button class="secondary" id="disconnectBtn">Desconectar este dispositivo</button>':`<form id="connectForm"><label class="field">URL de tu nueva aplicación web<input id="cloudUrl" type="url" required placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label><label class="field">Clave de acceso<input id="cloudToken" type="password" required minlength="16" autocomplete="off"></label><p>Al conectar, se carga la lista de Google. Descarga antes un respaldo si tienes datos locales. Si la hoja está vacía, podrás enviar la lista de este dispositivo.</p><button type="submit" class="secondary">Conectar Google Sheets</button></form>`}</section>
      <section class="settings-section"><h3>Respaldo y recuperación</h3><p>Guarda una copia antes de cambiar de navegador o restaurar información.</p><button class="text-button" id="settingsBackup">Descargar respaldo actual</button><button class="text-button" id="recoveryBtn">Descargar recuperación</button>${storageBroken?'<button class="danger-button" id="repairStorage">Restablecer guardado local</button>':''}</section>`);
    $('settingsForm').onsubmit=async e=>{e.preventDefault();try{const next=Model.clone(state);next.config={title:$('cfgTitle').value.trim(),date:$('cfgDate').value,venue:$('cfgVenue').value.trim(),restrictions:$('cfgDiets').value.split('\n').map(s=>s.trim()).filter(Boolean)};await commit(next,'Ajustes guardados');closeDialog();}catch(e){formError(e);}};
    $('settingsBackup').onclick=backup;$('recoveryBtn').onclick=()=>{let raw=rawBroken;try{raw=raw||localStorage.getItem(RECOVERY);}catch(_){}if(!raw){toast('No hay una recuperación pendiente.');return;}download(raw,`recuperacion-24-octubre-${stamp()}.json`,'application/json');};
    if($('repairStorage'))$('repairStorage').onclick=()=>{if(!confirm('Descarga primero la recuperación. ¿Reemplazar el guardado local por los datos que ves ahora?'))return;try{localStorage.setItem(KEY,JSON.stringify(state));storageBroken=false;rawBroken='';status('Guardado en este dispositivo');closeDialog();}catch(e){formError(new Error('El navegador sigue impidiendo guardar. Usa otro navegador o habilita el almacenamiento.'));}};
    if(cloud)$('disconnectBtn').onclick=()=>{cloud=null;forgetCloud();status('Guardado en este dispositivo');closeDialog();toast('Conexión cerrada. Los próximos cambios serán locales.');};
    else $('connectForm').onsubmit=async e=>{
      e.preventDefault();try{requireIdle();const url=$('cloudUrl').value.trim();if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url))throw new Error('Pega la URL de implementación de Google Apps Script terminada en /exec.');
        const connection={url,token:$('cloudToken').value,revision:0,blocked:false};busy=true;disableForm(true);status('Conectando…');
        const data=await request(connection,'read');
        if(data.state){const remote=Model.validate(data.state);if(!confirm(`Se cargarán ${remote.guests.length} invitados y ${remote.tables.length} mesas de Google. ¿Reemplazar la vista local?`)){status('Guardado en este dispositivo');return;}try{localStorage.setItem(RECOVERY,JSON.stringify(state));localStorage.setItem(KEY,JSON.stringify(remote));}catch(_){}state=remote;connection.revision=data.revision;}
        else{if(!confirm(`La nueva hoja está vacía. ¿Enviar ${state.guests.length} invitados y ${state.tables.length} mesas de este dispositivo?`)){status('Guardado en este dispositivo');return;}const result=await request(connection,'save',{expectedRevision:data.revision,state});connection.revision=result.revision;try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){} }
        cloud=connection;rememberCloud();status('Sincronizado');render();busy=false;closeDialog();toast('Google Sheets conectado');
      }catch(error){status('No conectado',true);formError(error);}finally{busy=false;disableForm(false);}
    };
  }
  function openSettings(){
    requireAdmin();
    const c=state.config, adminCloud=cloud?.access==='admin';
    openDialog('Ajustes del evento','PERSONALIZAR',`<form id="settingsForm" class="form-grid"><label class="field span-2">Nombre del evento<input id="cfgTitle" value="${esc(c.title)}" maxlength="100" required></label>${field('Fecha','cfgDate',c.date,'required','date')}${field('Lugar','cfgVenue',c.venue,'maxlength="150"')}${field('Imagen del plano (opcional)','cfgPlanImage',c.planImage,'maxlength="300" placeholder="ejemplo.png o URL HTTPS"')}${field('PDF del plano (opcional)','cfgPlanPdf',c.planPdf,'maxlength="300" placeholder="ejemplo.pdf o URL HTTPS"')}<p class="form-note span-2">Para usar un plano, copia el PNG y el PDF junto a <strong>index.html</strong> y escribe aquí sus nombres exactos. Puedes dejar ambos campos vacíos mientras preparas un matrimonio.</p><label class="field span-2">Categorías de alimentación<textarea id="cfgDiets" rows="5">${esc(c.restrictions.join('\n'))}</textarea><span class="field-help">Una por línea. Para retirar una categoría utilizada, cambia primero a sus invitados.</span></label><div class="settings-section span-2"><h3>Contraseña de administración</h3><p>La contraseña actual no se muestra. Escribe una nueva de al menos 12 caracteres para reemplazarla.</p>${field('Nueva contraseña','newAdminPassword','','minlength="12" autocomplete="new-password"','password')}${field('Repetir nueva contraseña','repeatAdminPassword','','minlength="12" autocomplete="new-password"','password')}</div><div id="formError" class="form-error span-2" role="alert"></div><button type="submit" class="primary span-2">Guardar ajustes</button></form>
      <section class="settings-section"><h3>Google Sheets</h3><p>${adminCloud?'Administración conectada. Los cambios de mesas y ajustes se guardan en Google.':cloud?'La lista pública ya está conectada. Ingresa ADMIN_TOKEN para poder guardar mesas y ajustes.':'Configura primero config.js y luego conecta ADMIN_TOKEN.'}</p>${adminCloud?'<button class="secondary" id="disconnectBtn">Cerrar conexión administrativa</button>':`<form id="connectForm"><label class="field">URL de tu aplicación web<input id="cloudUrl" type="url" required value="${esc(cloud?.url||'')}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label><label class="field">ADMIN_TOKEN de Google Sheets<input id="cloudToken" type="password" required minlength="16" autocomplete="off"></label><div class="connection-actions"><button type="button" class="text-button" id="testCloudUrl">Probar URL</button><button type="submit" class="secondary">Conectar administración</button></div></form>`}</section>
      <section class="settings-section"><h3>Respaldo y recuperación</h3><p>Guarda una copia antes de cambiar de navegador o restaurar información.</p><button class="text-button" id="settingsBackup">Descargar respaldo actual</button><button class="text-button" id="recoveryBtn">Descargar recuperación</button>${storageBroken?'<button class="danger-button" id="repairStorage">Restablecer guardado local</button>':''}</section>`);
    $('settingsForm').onsubmit=async e=>{e.preventDefault();try{const next=Model.clone(state),newPassword=$('newAdminPassword').value,repeat=$('repeatAdminPassword').value;if(newPassword||repeat){if(newPassword.length<12||newPassword!==repeat)throw new Error('Las dos nuevas contraseñas deben coincidir y tener al menos 12 caracteres.');next.config.adminPasswordHash=await hashText(newPassword);next.config.adminPasswordNeedsChange=false;}next.config={...next.config,title:$('cfgTitle').value.trim(),date:$('cfgDate').value,venue:$('cfgVenue').value.trim(),planImage:$('cfgPlanImage').value.trim(),planPdf:$('cfgPlanPdf').value.trim(),restrictions:$('cfgDiets').value.split('\n').map(s=>s.trim()).filter(Boolean)};await commit(next,'Ajustes guardados');closeDialog();}catch(e){formError(e);}};
    $('settingsBackup').onclick=backup;$('recoveryBtn').onclick=()=>{let raw=rawBroken;try{raw=raw||localStorage.getItem(RECOVERY);}catch(_){}if(!raw){toast('No hay una recuperación pendiente.');return;}download(raw,`recuperacion-${stamp()}.json`,'application/json');};
    if($('repairStorage'))$('repairStorage').onclick=()=>{if(!confirm('Descarga primero la recuperación. ¿Reemplazar el guardado local por los datos que ves ahora?'))return;try{localStorage.setItem(KEY,JSON.stringify(state));storageBroken=false;rawBroken='';status('Guardado en este dispositivo');closeDialog();}catch(e){formError(new Error('El navegador sigue impidiendo guardar.'));}};
    if(adminCloud)$('disconnectBtn').onclick=()=>{forgetCloud();cloud=publicCloud();status(cloud?'Sincronizado':'Guardado en este dispositivo');closeDialog();toast(cloud?'Se cerró la administración. La lista pública sigue conectada.':'Conexión cerrada.');};
    else{$('testCloudUrl').onclick=()=>{const url=$('cloudUrl').value.trim();if(!CLOUD_URL_RE.test(url)){formError(new Error('Pega primero una URL válida terminada en /exec.'));return;}window.open(url,'_blank','noopener');};$('connectForm').onsubmit=async e=>{e.preventDefault();try{requireIdle();if(syncRunning||syncDirty)throw new Error('Espera a que termine la sincronización actual.');const url=$('cloudUrl').value.trim();if(!CLOUD_URL_RE.test(url))throw new Error('Pega la URL de implementación terminada en /exec.');const connection={url,token:$('cloudToken').value,revision:0,blocked:false,access:'admin'};busy=true;disableForm(true);status('Conectando administración…');const data=await request(connection,'read');if(data.state){const remote=Model.validate(data.state);if(!confirm(`Se cargarán ${remote.guests.length} invitados y ${remote.tables.length} mesas de Google. ¿Reemplazar la vista local?`)){status('Sincronizado');return;}try{localStorage.setItem(RECOVERY,JSON.stringify(state));localStorage.setItem(KEY,JSON.stringify(remote));}catch(_){}state=remote;connection.revision=data.revision;}else{if(!confirm(`La nueva hoja está vacía. ¿Enviar ${state.guests.length} invitados y ${state.tables.length} mesas de este dispositivo?`)){status('Guardado en este dispositivo');return;}const result=await request(connection,'save',{expectedRevision:data.revision,state});connection.revision=result.revision;}cloud=connection;rememberCloud();status('Sincronizado');render();busy=false;closeDialog();toast('Conexión administrativa guardada');}catch(error){status('No conectado',true);formError(error);}finally{busy=false;disableForm(false);}};}
  }
  async function refresh(silent=false){
    if(silent&&(busy||moving||dialog.open||syncRunning||syncDirty))return;
    if(!silent&&(syncRunning||syncDirty)){toast('Espera un momento: estamos terminando la sincronización.');return;}
    try{requireIdle();if(!cloud){const raw=localStorage.getItem(KEY);if(raw)state=Model.validate(JSON.parse(raw));render();if(!silent)toast('Datos locales actualizados');return;}
      busy=true;if(!silent)status('Actualizando…');const data=await request(cloud,'read');if(!data.state)throw new Error('La hoja no tiene un estado guardado.');const remote=Model.validate(data.state);try{localStorage.setItem(KEY,JSON.stringify(remote));localStorage.removeItem(RECOVERY);}catch(_){}state=remote;cloud.revision=data.revision;cloud.blocked=false;rememberCloud();render();status('Sincronizado');if(!silent)toast('Lista actualizada');
    }catch(e){status('No se pudo sincronizar',true);if(!silent)toast(e.message,true);else console.warn(e.message);}finally{busy=false;}
  }
  $('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{requireIdle();if(file.size>6000000)throw new Error('El respaldo supera el máximo de 6 MB.');const next=Model.validate(JSON.parse(await file.text()));if(!confirm(`Se reemplazarán los datos actuales por ${next.guests.length} invitados y ${next.tables.length} mesas${cloud?' también en Google Sheets':''}. ¿Continuar?`))return;backup();await commit(next,'Respaldo restaurado');}catch(e){toast(e.message,true);}finally{$('importFile').value='';}};
  document.addEventListener('click',e=>{
    const btn=e.target.closest('button');if(!btn)return;
    try{
      if(btn.hasAttribute('data-close'))closeDialog();
      if(btn.dataset.view)setView(btn.dataset.view);
      if(btn.dataset.go)setView(btn.dataset.go);
      if(btn.hasAttribute('data-add-guest'))openGuest('',btn.dataset.addGuest);
      if(btn.dataset.editGuest)openGuest(btn.dataset.editGuest);
      if(btn.dataset.table){if(moving)return;selectedId=btn.dataset.table;renderMap();if(cards||window.innerWidth<=800)$('tableDetail').scrollIntoView({block:'start',behavior:'instant'});}
      if(btn.dataset.filter){filter=btn.dataset.filter;page=1;document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});renderGuests();}
      if(btn.hasAttribute('data-diet')){dietFilter=btn.dataset.diet;renderCatering();}
      if(btn.id==='editTableBtn')openTable(selectedId);
      if(btn.id==='moveTableBtn')startMoving();
      if(btn.id==='duplicateTableBtn')duplicateTable(selectedId).catch(error=>toast(error.message,true));
      if(btn.id==='createFirstTableBtn')openTable();
      if(btn.id==='clearFilters'){filter='Todos';$('search').value='';$('statusFilter').value='';document.querySelector('[data-filter="Todos"]').click();}
    }catch(error){toast(error.message,true);}
  });
  const handle = fn => ()=>{try{fn();}catch(e){toast(e.message,true);}};
  $('newGuestBtn').onclick=handle(()=>openGuest());$('newTableBtn').onclick=handle(()=>openTable());$('settingsBtn').onclick=handle(openSettings);$('adminBtn').onclick=handle(openAdminLogin);$('connectShortcut').onclick=handle(()=>isAdmin?openSettings():openAdminLogin());$('refreshBtn').onclick=()=>refresh(false);
  $('search').oninput=()=>{page=1;renderGuests();};$('statusFilter').onchange=()=>{page=1;renderGuests();};$('prevPage').onclick=()=>{page--;renderGuests();};$('nextPage').onclick=()=>{page++;renderGuests();};
  $('showMap').onclick=()=>{cards=false;renderMap();};$('showCards').onclick=()=>{if(moving)return;cards=true;renderMap();};
  $('zoomIn').onclick=()=>{zoom=Math.min(3,zoom+.25);applyZoom();};$('zoomOut').onclick=()=>{zoom=Math.max(1,zoom-.25);applyZoom();};$('zoomReset').onclick=()=>{zoom=1;applyZoom();};
  $('allCatering').onclick=()=>{dietFilter='';renderCatering();};$('exportCsv').onclick=()=>csv();$('cateringCsv').onclick=()=>csv(true);$('printBtn').onclick=print;$('backupBtn').onclick=backup;$('importBtn').onclick=()=>$('importFile').click();
  $('planImage').onerror=()=>{if(state.config.planImage)toast(`Falta ${state.config.planImage}. Debe estar junto a index.html o ser una URL HTTPS.`,true);};
  document.querySelector('.brand').onclick=e=>{e.preventDefault();setView('invitados');};
  window.addEventListener('storage',e=>{if(e.key===KEY&&!cloud)toast('La lista cambió en otra pestaña. Pulsa Actualizar antes de editar.',true);});
  window.addEventListener('resize',()=>{if(view==='mesas')applyZoom();});
  window.addEventListener('beforeunload',e=>{if(busy||moving||syncRunning||syncDirty){e.preventDefault();e.returnValue='';}});
  render();setView(view,false);if(storageBroken)status('Revisar guardado local',true);else if(cloud){status('Sincronizando…');setTimeout(()=>refresh(true),0);setInterval(()=>refresh(true),20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});}
  if(isLocalPreview){status('Vista local · no publicada',true);setTimeout(()=>toast('Esta es una vista local del computador. Para comprobar el celular, publica los archivos y abre la URL de Render.',true),350);}
}
