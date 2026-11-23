/* Salud Conecta - funcionamiento de la aplicación */
(function(){
'use strict';
var KEY='saludconecta.mvp.v1', mem=null;
function fresh(){return {account:null,caregiver:null,meds:[],appts:[],log:{},demo:[],settings:{graceMin:15},
  metrics:{openedAt:Date.now(),t:{},addStart:null,firstMedMs:null,regMs:null,help:null,feedback:null,alerts:0},loggedIn:false}}
function load(){try{var s=localStorage.getItem(KEY);if(s)return JSON.parse(s)}catch(e){}return mem||fresh()}
var S=load();
function save(){mem=S;try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
var tab='hoy', addKind='med', queue=[], modalOpen=false, audioCtx=null, toastT=null, extraTimes=1, editing=null;

/* ---------- utilidades ---------- */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function p2(n){return (n<10?'0':'')+n}
function dkey(d){d=d||new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}
function fmtTime(ts){return new Date(ts).toLocaleTimeString('es-CO',{hour:'numeric',minute:'2-digit',hour12:true})}
function fmtHM(hm){var a=hm.split(':').map(Number);return fmtTime(new Date(2000,0,1,a[0],a[1]).getTime())}
function fmtDate(iso){var a=iso.split('-').map(Number);return new Date(a[0],a[1]-1,a[2]).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}
function mmss(ms){var s=Math.round(ms/1000);return Math.floor(s/60)+':'+p2(s%60)}
function uid(){return Math.random().toString(36).slice(2,9)}
function first(){return S.account?String(S.account.name).split(' ')[0]:''}
function toast(t){var el=document.getElementById('toast');el.textContent=t;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){el.hidden=true},3200)}
async function sha(p){try{var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p));return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')}catch(e){return 'x'+btoa(unescape(encodeURIComponent(p)))}}
function mark(k){if(!S.metrics.t[k]){S.metrics.t[k]=Date.now();save()}}

/* ---------- dosis del día ---------- */
function doses(){
  var now=new Date(), tk=dkey(now), out=[];
  S.meds.forEach(function(m){m.times.forEach(function(t){var a=t.split(':').map(Number);
    var due=new Date(now.getFullYear(),now.getMonth(),now.getDate(),a[0],a[1]).getTime();if(m.created&&due<m.created)return;out.push({key:tk+'|'+m.id+'|'+t,name:m.name,dose:m.dose,due:due,grace:S.settings.graceMin*60000,snooze:600000})})});
  S.demo.forEach(function(d){out.push({key:'demo|'+d.id,name:d.name,dose:d.dose,due:d.due,grace:20000,snooze:10000,demo:true})});
  out.sort(function(a,b){return a.due-b.due});return out}
function status(d,now){now=now||Date.now();var l=S.log[d.key]||{};
  if(l.taken)return 'taken'; if(l.snooze&&now<l.snooze)return 'snoozed';
  if(now<d.due)return 'pending'; if(now<d.due+d.grace)return 'due'; return 'missed'}
var LABEL={taken:'Tomado',pending:'Pendiente',snoozed:'Pospuesto',due:'Es la hora',missed:'Sin confirmar'};
var ICON={taken:'✓',pending:'◷',snoozed:'◷',due:'!',missed:'!'};

/* ---------- aviso al cuidador ---------- */
function cgMessage(d){var c=S.caregiver||{};return 'Hola'+(c.name?' '+c.name.split(' ')[0]:'')+', '+first()+' aún no confirma que tomó '+d.name+(d.dose?' ('+d.dose+')':'')+' de las '+fmtTime(d.due)+'. ¿Puedes llamarle o escribirle? (Aviso de Salud Conecta)'}
function waLink(d){var c=(S.caregiver&&S.caregiver.contact)||'',txt=encodeURIComponent(cgMessage(d));
  if(c&&c.indexOf('@')<0){var n=c.replace(/\D/g,'');if(n.length===10)n='57'+n;return 'https://wa.me/'+n+'?text='+txt}
  return 'https://wa.me/?text='+txt}

/* ---------- sonido y avisos ---------- */
function beep(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();var t=audioCtx.currentTime;
  [0,.28,.56].forEach(function(o){var s=audioCtx.createOscillator(),g=audioCtx.createGain();s.frequency.value=880;s.connect(g);g.connect(audioCtx.destination);
    g.gain.setValueAtTime(.0001,t+o);g.gain.exponentialRampToValueAtTime(.25,t+o+.03);g.gain.exponentialRampToValueAtTime(.0001,t+o+.22);s.start(t+o);s.stop(t+o+.25)})}catch(e){}
  try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}}
/* alarma del recordatorio: se repite cerca de un minuto o hasta que la persona toque un botón */
var alarmT=null, ALARM_MAX=24;
function ringOnce(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();var t=audioCtx.currentTime;
  [[880,0],[1047,.4],[1319,.8]].forEach(function(n){var s=audioCtx.createOscillator(),g=audioCtx.createGain();s.type='square';s.frequency.value=n[0];s.connect(g);g.connect(audioCtx.destination);
    g.gain.setValueAtTime(.0001,t+n[1]);g.gain.exponentialRampToValueAtTime(.2,t+n[1]+.03);g.gain.setValueAtTime(.2,t+n[1]+.3);g.gain.exponentialRampToValueAtTime(.0001,t+n[1]+.38);s.start(t+n[1]);s.stop(t+n[1]+.4)})}catch(e){}
  try{navigator.vibrate&&navigator.vibrate([400,150,400,150,400])}catch(e){}}
function startAlarm(){stopAlarm();var n=0;ringOnce();alarmT=setInterval(function(){n++;if(n>=ALARM_MAX){stopAlarm();return}ringOnce()},2500)}
function stopAlarm(){if(alarmT){clearInterval(alarmT);alarmT=null}try{navigator.vibrate&&navigator.vibrate(0)}catch(e){}}
function notify(d){try{if(window.Notification&&Notification.permission==='granted')new Notification('Es hora de su medicamento',{body:d.name+(d.dose?' · '+d.dose:'')})}catch(e){}}

/* ---------- recordatorio (ventana) ---------- */
function tick(){
  if(!S.account||!S.loggedIn){return}
  var now=Date.now();
  doses().forEach(function(d){var l=S.log[d.key]||(S.log[d.key]={});var st=status(d,now);
    if(st==='due'&&!l.reminded){l.reminded=now;save();queue.push(d.key);notify(d)}
    if(st==='missed'&&!l.missedAt){l.missedAt=now;S.metrics.alerts=(S.metrics.alerts||0)+1;save();beep()}});
  if(!modalOpen&&queue.length)showReminder(queue.shift());
  if(tab==='hoy'&&!modalOpen)render(true)}
function showReminder(key){var d=doses().filter(function(x){return x.key===key})[0];if(!d||status(d)==='taken'){modalOpen=false;return}
  modalOpen=true;startAlarm();
  document.getElementById('layer').innerHTML='<div class="scrim"><div class="modal" role="dialog" aria-modal="true" aria-label="Recordatorio de medicamento">'+
   '<h2>Es hora de su medicamento</h2><div><div class="big">'+esc(fmtTime(d.due))+'</div><div class="name" style="font-size:1.4rem;font-weight:700">'+esc(d.name)+'</div><div class="muted">'+esc(d.dose||'')+'</div></div>'+
   '<button class="btn ok" data-act="take" data-key="'+esc(key)+'" style="min-height:76px;font-size:1.5rem">YA LO TOMÉ</button>'+
   '<button class="btn ghost" data-act="snooze" data-key="'+esc(key)+'">Recordarme en '+(d.demo?'10 segundos':'10 minutos')+'</button>'+
   '<p class="small muted">Si no confirma en '+(d.demo?'20 segundos':S.settings.graceMin+' minutos')+', se prepara un aviso para su cuidador.</p></div></div>'}
function askDelete(kind,id){var it=(kind==='med'?S.meds:S.appts).filter(function(x){return x.id===id})[0];if(!it)return;
  modalOpen=true;
  document.getElementById('layer').innerHTML='<div class="scrim"><div class="modal" role="alertdialog" aria-modal="true" aria-label="Confirmar">'+
   '<h2>'+(kind==='med'?'¿Quitar este medicamento?':'¿Quitar este control?')+'</h2><div class="name" style="font-size:1.4rem;font-weight:700">'+esc(kind==='med'?it.name:it.title)+'</div>'+
   '<p class="muted">'+(kind==='med'?'Se borrará de su lista y no volverá a sonar.':'Se borrará de su lista de controles.')+'</p>'+
   '<button class="btn" data-act="closemodal" style="min-height:64px">No, dejarlo</button>'+
   '<button class="btn warn" data-act="confdel" data-k="'+kind+'" data-id="'+esc(id)+'">Sí, quitar</button></div></div>'}
function closeModal(){stopAlarm();modalOpen=false;document.getElementById('layer').innerHTML='';if(queue.length)setTimeout(function(){if(!modalOpen&&queue.length)showReminder(queue.shift())},300)}

/* ---------- vistas ---------- */
var LOGO='<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="var(--primary)"/><circle cx="20" cy="20" r="10.5" fill="none" stroke="var(--on-primary)" stroke-width="2.6"/><path d="M15 20.5l3.6 3.6L25.5 16.5" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function top(){return '<div class="top">'+LOGO+'<div class="brand">Salud Conecta</div>'+(S.account?'<div class="who">'+esc(first())+'</div>':'')+'</div>'}
function viewWelcome(){return top()+'<div class="stack">'+
 '<div class="hero"><h1>No olvide sus medicamentos ni sus controles</h1><p style="margin-top:8px">Recordatorios sencillos, un botón para confirmar y un aviso a su familiar si algo se le pasa.</p></div>'+
 '<form class="card" data-form="register" autocomplete="off"><h2 style="margin-bottom:12px">Crear mi cuenta</h2>'+
 '<div class="field"><label for="r-name">Su nombre</label><input id="r-name" name="name" required maxlength="60" autocomplete="off"></div>'+
 '<div class="field"><label for="r-mail">Correo electrónico</label><input id="r-mail" name="email" type="email" required maxlength="80" autocomplete="off"></div>'+
 '<div class="field"><label for="r-pass">Contraseña (mínimo 6 caracteres)</label><input id="r-pass" name="pass" type="password" required minlength="6" autocomplete="off"></div>'+
 '<div class="field"><label for="r-cg">Cuidador o familiar (opcional)</label><input id="r-cg" name="cgname" placeholder="Nombre, por ejemplo: Laura (hija)" maxlength="60"><input id="r-cgc" name="cgcontact" style="margin-top:8px" placeholder="WhatsApp o correo del cuidador" maxlength="80"></div>'+
 '<div class="field"><label class="chk" for="r-ok"><input id="r-ok" name="ok" type="checkbox" required><span>Autorizo guardar mis datos en este dispositivo para usar la aplicación. Salud Conecta solo recuerda lo que el médico indicó y no reemplaza la consulta médica.</span></label></div>'+
 '<button class="btn" type="submit">Crear cuenta</button></form>'+
 '<button class="btn ghost" data-act="sample">Ver la aplicación con datos de ejemplo</button>'+
 '<p class="small muted">Prototipo de prueba: los datos se guardan solo en este dispositivo.</p></div>'}
function viewLogin(){return top()+'<form class="card stack" data-form="login"><h2>Bienvenido, '+esc(first())+'</h2><div><label for="l-pass">Contraseña</label><input id="l-pass" name="pass" type="password" required autocomplete="off"></div><button class="btn" type="submit">Entrar</button><button type="button" class="link" data-act="wipe">Borrar datos y empezar de nuevo</button></form>'}
function viewHoy(){
  var ds=doses(),now=Date.now(),taken=ds.filter(function(d){return status(d,now)==='taken'}).length;
  var missed=ds.filter(function(d){return status(d,now)==='missed'&&!(S.log[d.key]||{}).taken});
  var h=top()+'<div class="stack"><div><h1>Hola, '+esc(first())+'</h1><p class="muted">'+esc(new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'}))+'</p></div>';
  if(ds.length){h+='<div class="card"><div class="row" style="justify-content:space-between"><b>Hoy ha tomado '+taken+' de '+ds.length+'</b></div><div class="bar" style="margin-top:8px"><i style="width:'+Math.round(taken/ds.length*100)+'%"></i></div></div>'}
  missed.forEach(function(d){var l=S.log[d.key]||{};
    h+='<div class="alert" role="alert"><h3>Sin confirmar: '+esc(d.name)+' de las '+esc(fmtTime(d.due))+'</h3><p>'+(S.caregiver&&S.caregiver.name?'Avise a '+esc(S.caregiver.name)+' para que le ayude.':'Agregue un cuidador en la pestaña «Cuidador» para avisarle.')+'</p>'+
    '<div class="row" style="margin-top:10px"><a class="btn warn" style="flex:1" href="'+esc(waLink(d))+'" target="_blank" rel="noopener" data-act="alerted" data-key="'+esc(d.key)+'">Avisar por WhatsApp</a>'+
    '<button class="btn ghost sm" data-act="copymsg" data-key="'+esc(d.key)+'">Copiar mensaje</button></div>'+(l.alerted?'<p class="small muted" style="margin-top:8px">Aviso preparado a las '+esc(fmtTime(l.alerted))+'.</p>':'')+
    '<button class="btn ok" style="margin-top:10px" data-act="take" data-key="'+esc(d.key)+'">Ya lo tomé</button></div>'});
  if(!ds.length){h+='<div class="card stack"><h2>Aún no tiene medicamentos</h2><p class="muted">Agregue su primer medicamento y le avisaremos a la hora indicada.</p><button class="btn" data-go="agregar">Agregar medicamento</button></div>'}
  ds.forEach(function(d){var st=status(d,now),l=S.log[d.key]||{};if(st==='missed')return;
    h+='<div class="card dose '+(st==='taken'?'is-taken':'')+'"><div class="time">'+esc(fmtTime(d.due))+'</div><div><div class="name">'+esc(d.name)+(d.demo?' <span class="small muted">(prueba)</span>':'')+'</div><div class="muted small">'+esc(d.dose||'')+'</div></div>'+
    '<div class="act"><span class="chip '+st+'"><span aria-hidden="true">'+ICON[st]+'</span> '+LABEL[st]+(st==='taken'?' '+esc(fmtTime(l.taken)):'')+'</span>'+
    (st==='taken'?'<button class="link" data-act="undo" data-key="'+esc(d.key)+'">Deshacer</button>':
     (st==='due'||st==='missed'?'<button class="btn ok" style="flex:1" data-act="take" data-key="'+esc(d.key)+'">Ya lo tomé</button>':'<button class="btn ghost sm" data-act="take" data-key="'+esc(d.key)+'">Marcar como tomado</button>'))+'</div></div>'});
  var up=S.appts.filter(function(a){return a.date>=dkey()}).sort(function(a,b){return (a.date+a.time)<(b.date+b.time)?-1:1});
  h+='<div class="card"><h2 style="margin-bottom:10px">Próximos controles</h2>'+(up.length?'<div class="list">'+up.slice(0,4).map(function(a){return '<div class="item"><div><b>'+esc(a.title)+'</b><div class="muted small">'+esc(fmtDate(a.date))+' · '+esc(fmtHM(a.time))+(a.place?' · '+esc(a.place):'')+'</div></div><div class="acts"><button class="btn ghost sm" data-act="edit" data-k="cita" data-id="'+a.id+'" aria-label="Editar control">Editar</button><button class="x" aria-label="Quitar cita" data-act="delappt" data-id="'+a.id+'">×</button></div></div>'}).join('')+'</div>':'<p class="muted">No hay controles agendados.</p>')+'</div>';
  if(S.meds.length){h+='<div class="card"><h2 style="margin-bottom:10px">Mis medicamentos</h2><div class="list">'+S.meds.map(function(m){return '<div class="item"><div><b>'+esc(m.name)+'</b><div class="muted small">'+esc(m.dose||'')+' · '+m.times.map(fmtHM).map(esc).join(', ')+'</div></div><div class="acts"><button class="btn ghost sm" data-act="edit" data-k="med" data-id="'+m.id+'" aria-label="Editar medicamento">Editar</button><button class="x" aria-label="Quitar medicamento" data-act="delmed" data-id="'+m.id+'">×</button></div></div>'}).join('')+'</div></div>'}
  return h+'</div>'}
function timeRow(v){return '<div class="trow"><input type="time" name="time" required value="'+esc(v||'08:00')+'" aria-label="Hora de toma"><button type="button" class="x" aria-label="Quitar hora" data-act="rmtime">×</button></div>'}
function viewAgregar(){
  var em=null,ea=null;
  if(editing){if(editing.kind==='med')em=S.meds.filter(function(m){return m.id===editing.id})[0]||null;else ea=S.appts.filter(function(m){return m.id===editing.id})[0]||null;if(!em&&!ea)editing=null}
  var ed=!!editing, kind=ed?editing.kind:addKind;
  var h=top()+'<div class="stack"><h1>'+(ed?(kind==='med'?'Editar medicamento':'Editar control'):'Agregar')+'</h1>';
  if(!ed)h+='<div class="seg" role="group" aria-label="Qué desea agregar"><button data-act="kind" data-k="med" aria-pressed="'+(addKind==='med')+'">Medicamento</button><button data-act="kind" data-k="cita" aria-pressed="'+(addKind==='cita')+'">Control o cita</button></div>';
  var cancel=ed?'<button type="button" class="btn ghost" data-act="canceledit">Cancelar</button>':'';
  if(kind==='med'){
    var times=em?em.times:['08:00'];
    h+='<form class="card" data-form="med" autocomplete="off"><div class="field"><label for="m-name">Nombre del medicamento</label><input id="m-name" name="name" required maxlength="60" placeholder="Ejemplo: Losartán" value="'+esc(em?em.name:'')+'"></div>'+
     '<div class="field"><label for="m-dose">Dosis</label><input id="m-dose" name="dose" maxlength="60" placeholder="Ejemplo: 1 tableta de 50 mg" value="'+esc(em?em.dose||'':'')+'"></div>'+
     '<div class="field times"><label>Horas de toma (todos los días)</label><div id="times">'+times.map(timeRow).join('')+'</div><button type="button" class="btn ghost sm" data-act="addtime">+ Otra hora</button></div>'+
     '<button class="btn" type="submit">'+(ed?'Guardar cambios':'Guardar medicamento')+'</button>'+cancel+'<p class="hint">Escriba lo que el médico formuló. Salud Conecta no sugiere dosis.</p></form>'}
  else{
    h+='<form class="card" data-form="appt" autocomplete="off"><div class="field"><label for="a-t">¿Qué control es?</label><input id="a-t" name="title" required maxlength="70" placeholder="Ejemplo: Control de medicina general" value="'+esc(ea?ea.title:'')+'"></div>'+
     '<div class="field"><label for="a-d">Fecha</label><input id="a-d" name="date" type="date" required'+(ed?'':' min="'+dkey()+'"')+' value="'+esc(ea?ea.date:'')+'"></div><div class="field"><label for="a-h">Hora</label><input id="a-h" name="time" type="time" required value="'+esc(ea?ea.time:'09:00')+'"></div>'+
     '<div class="field"><label for="a-p">Lugar (opcional)</label><input id="a-p" name="place" maxlength="70" placeholder="Ejemplo: IPS Centro" value="'+esc(ea?ea.place||'':'')+'"></div><button class="btn" type="submit">'+(ed?'Guardar cambios':'Guardar control')+'</button>'+cancel+'</form>'}
  return h+'</div>'}
function viewCuidador(){var c=S.caregiver||{};
  return top()+'<div class="stack"><h1>Cuidador y ajustes</h1>'+
  '<form class="card" data-form="cg"><h2 style="margin-bottom:10px">¿A quién avisamos?</h2><div class="field"><label for="c-n">Nombre del cuidador</label><input id="c-n" name="name" value="'+esc(c.name||'')+'" maxlength="60" placeholder="Ejemplo: Laura (hija)"></div>'+
  '<div class="field"><label for="c-c">WhatsApp o correo</label><input id="c-c" name="contact" value="'+esc(c.contact||'')+'" maxlength="80" placeholder="3001234567 o correo@ejemplo.com"><p class="hint">Con WhatsApp, el aviso se abre listo para enviar con un toque. Con correo, puede copiar el mensaje.</p></div>'+
  '<div class="field"><label for="c-g">Esperar para avisar al cuidador</label><select id="c-g" name="grace">'+[5,10,15,30].map(function(m){return '<option value="'+m+'"'+(S.settings.graceMin===m?' selected':'')+'>'+m+' minutos sin confirmar</option>'}).join('')+'</select></div>'+
  '<button class="btn" type="submit">Guardar</button></form>'+
  '<div class="card stack"><h2>Probar los recordatorios</h2><p class="muted">Crea una toma de prueba que suena en 20 segundos. Si no la confirma, aparece el aviso al cuidador 20 segundos después.</p><button class="btn warn" data-act="demo">Crear recordatorio de prueba</button><button class="btn ghost" data-act="notif">Activar avisos del navegador</button></div>'+
  '<div class="card stack"><h2>Cuenta</h2><button class="btn ghost" data-act="logout">Cerrar sesión</button><button class="btn ghost" data-act="wipe">Borrar todos mis datos</button></div></div>'}
function viewPrueba(){
  var m=S.metrics,t=m.t||{},fb=m.feedback||{};
  var taskDefs=[['Crear una cuenta','account'],['Agregar un medicamento','med'],['Agregar un control o cita','appt'],['Confirmar una toma','taken']];
  var logs=Object.keys(S.log).map(function(k){return S.log[k]});
  var rem=logs.filter(function(l){return l.reminded}).length, conf=logs.filter(function(l){return l.reminded&&l.taken}).length;
  var h=top()+'<div class="stack"><h1>Resumen de la prueba</h1><p class="muted">Pantalla para registrar la evidencia de la validación. Tome una captura de pantalla al terminar.</p>'+
  '<div class="card"><h2 style="margin-bottom:10px">Tareas</h2><div class="kv">'+taskDefs.map(function(x){return '<span>'+x[0]+'</span><b class="'+(t[x[1]]?'ok-t':'muted')+'">'+(t[x[1]]?'✓ Hecha':'Pendiente')+'</b>'}).join('')+'</div></div>'+
  '<div class="card"><h2 style="margin-bottom:10px">Medición</h2><div class="kv">'+
   '<span>Tiempo para crear la cuenta (meta: menos de 2 min)</span><b class="'+(m.regMs!=null&&m.regMs<120000?'ok-t':'')+'">'+(m.regMs!=null?mmss(m.regMs):'—')+'</b>'+
   '<span>Tiempo para agregar el primer medicamento (meta: menos de 3 min)</span><b class="'+(m.firstMedMs!=null&&m.firstMedMs<180000?'ok-t':'')+'">'+(m.firstMedMs!=null?mmss(m.firstMedMs):'—')+'</b>'+
   '<span>Recordatorios recibidos</span><b>'+rem+'</b><span>Recordatorios confirmados</span><b>'+conf+(rem?' ('+Math.round(conf/rem*100)+' %)':'')+'</b>'+
   '<span>Avisos al cuidador preparados</span><b>'+(m.alerts||0)+'</b></div></div>'+
  '<form class="card" data-form="fb"><h2 style="margin-bottom:10px">Opinión de quien probó</h2>'+
  '<div class="field"><label>¿Necesitó ayuda para usarla?</label><div class="stars" data-group="help">'+['Sí','No'].map(function(o){return '<button type="button" data-act="pick" data-g="help" data-v="'+o+'" aria-pressed="'+(fb.help===o)+'">'+o+'</button>'}).join('')+'</div></div>'+
  '<div class="field"><label>¿Qué tan fácil fue? (1 = difícil, 5 = muy fácil)</label><div class="stars">'+[1,2,3,4,5].map(function(o){return '<button type="button" data-act="pick" data-g="ease" data-v="'+o+'" aria-pressed="'+(String(fb.ease)===String(o))+'">'+o+'</button>'}).join('')+'</div></div>'+
  '<div class="field"><label>¿La seguiría usando?</label><div class="stars">'+['Sí','Tal vez','No'].map(function(o){return '<button type="button" data-act="pick" data-g="use" data-v="'+o+'" aria-pressed="'+(fb.use===o)+'">'+o+'</button>'}).join('')+'</div></div>'+
  '<div class="field"><label for="f-c">¿Qué cambiaría?</label><textarea id="f-c" name="comment" maxlength="400">'+esc(fb.comment||'')+'</textarea></div>'+
  '<button class="btn" type="submit">Guardar opinión</button></form>'+
  '<button class="btn ghost" data-act="copysum">Copiar resumen</button></div>';
  return h}
function nav(){
  var I={hoy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
   agregar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
   cuidador:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.5-3.4 2.8-5 5.5-5s5 1.6 5.5 5"/><path d="M16 11.5l1.8 1.8 3.2-3.4"/></svg>',
   prueba:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/></svg>'};
  var L={hoy:'Hoy',agregar:'Agregar',cuidador:'Cuidador',prueba:'Prueba'};
  return '<div class="nav"><div>'+Object.keys(L).map(function(k){return '<button data-go="'+k+'"'+(tab===k?' aria-current="page"':'')+'>'+I[k]+'<span>'+L[k]+'</span></button>'}).join('')+'</div></div>'}
function render(keepScroll){
  var app=document.getElementById('app'),y=window.scrollY,ae=document.activeElement,typing=ae&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName);
  if(keepScroll&&typing)return;
  var html;
  if(!S.account)html=viewWelcome();else if(!S.loggedIn)html=viewLogin();
  else html=({hoy:viewHoy,agregar:viewAgregar,cuidador:viewCuidador,prueba:viewPrueba})[tab]()+nav();
  app.innerHTML=html;if(keepScroll)window.scrollTo(0,y);}
function go(t){editing=null;tab=t;if(t==='agregar'&&!S.metrics.addStart){S.metrics.addStart=Date.now();save()}render();window.scrollTo(0,0)}

/* ---------- acciones ---------- */
function setTaken(key,on){var l=S.log[key]||(S.log[key]={});if(on){l.taken=Date.now();mark('taken')}else{delete l.taken}save()}
document.addEventListener('click',function(e){
  var g=e.target.closest('[data-go]');if(g){go(g.getAttribute('data-go'));return}
  var b=e.target.closest('[data-act]');if(!b)return;var a=b.getAttribute('data-act'),key=b.getAttribute('data-key');
  if(a==='take'){setTaken(key,true);closeModal();render();toast('Anotado. ¡Muy bien!');return}
  if(a==='undo'){setTaken(key,false);render();return}
  if(a==='snooze'){var d=doses().filter(function(x){return x.key===key})[0],l=S.log[key]||(S.log[key]={});l.snooze=Date.now()+(d?d.snooze:600000);l.reminded=null;save();closeModal();render();toast('Le recordaremos de nuevo');return}
  if(a==='alerted'){var l2=S.log[key]||(S.log[key]={});l2.alerted=Date.now();save();setTimeout(function(){render()},400);return}
  if(a==='copymsg'){var d2=doses().filter(function(x){return x.key===key})[0];if(d2){copy(cgMessage(d2),'Mensaje copiado');var l3=S.log[key]||(S.log[key]={});l3.alerted=Date.now();save();render()}return}
  if(a==='edit'){editing={kind:b.getAttribute('data-k'),id:b.getAttribute('data-id')};addKind=editing.kind;tab='agregar';render();window.scrollTo(0,0);return}
  if(a==='canceledit'){editing=null;tab='hoy';render();window.scrollTo(0,0);return}
  if(a==='kind'){addKind=b.getAttribute('data-k');render();return}
  if(a==='addtime'){document.getElementById('times').insertAdjacentHTML('beforeend',timeRow('20:00'));return}
  if(a==='rmtime'){var rows=document.querySelectorAll('#times .trow');if(rows.length>1)b.closest('.trow').remove();return}
  if(a==='delmed'){askDelete('med',b.getAttribute('data-id'));return}
  if(a==='delappt'){askDelete('cita',b.getAttribute('data-id'));return}
  if(a==='closemodal'){closeModal();return}
  if(a==='confdel'){var id=b.getAttribute('data-id');if(b.getAttribute('data-k')==='med')S.meds=S.meds.filter(function(m){return m.id!==id});else S.appts=S.appts.filter(function(m){return m.id!==id});save();closeModal();render();toast('Quitado');return}
  if(a==='demo'){S.demo.push({id:uid(),name:'Medicamento de prueba',dose:'1 tableta',due:Date.now()+20000});save();toast('Suena en 20 segundos. Vuelva a la pestaña «Hoy».');go('hoy');return}
  if(a==='notif'){try{Notification.requestPermission().then(function(r){toast(r==='granted'?'Avisos del navegador activados':'No se activaron los avisos del navegador')})}catch(err){toast('Su navegador no permite estos avisos aquí')}return}
  if(a==='logout'){S.loggedIn=false;save();render();return}
  if(a==='wipe'){if(b.getAttribute('data-sure')){S=fresh();save();tab='hoy';render();return}b.setAttribute('data-sure','1');b.textContent='Toque otra vez para borrar todo';return}
  if(a==='sample'){sample();return}
  if(a==='pick'){var f=S.metrics.feedback||(S.metrics.feedback={});f[b.getAttribute('data-g')]=b.getAttribute('data-v');save();render(false);return}
  if(a==='copysum'){copy(summary(),'Resumen copiado');return}
});
document.addEventListener('submit',async function(e){
  var f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();var n=f.getAttribute('data-form'),fd=new FormData(f);
  if(n==='register'){var pw=await sha(fd.get('pass'));S.account={name:String(fd.get('name')).trim(),email:String(fd.get('email')).trim(),hash:pw};
    var cn=String(fd.get('cgname')||'').trim(),cc=String(fd.get('cgcontact')||'').trim();S.caregiver=(cn||cc)?{name:cn,contact:cc}:null;
    S.loggedIn=true;S.metrics.regMs=Date.now()-S.metrics.openedAt;mark('account');save();tab='hoy';render();toast('Cuenta creada. Agregue su primer medicamento.');return}
  if(n==='login'){var h=await sha(fd.get('pass'));if(S.account.hash==='sample'||h===S.account.hash){S.loggedIn=true;save();render()}else toast('La contraseña no coincide');return}
  if(n==='med'){var times=fd.getAll('time').filter(Boolean);times=times.filter(function(v,i){return times.indexOf(v)===i});
    if(editing&&editing.kind==='med'){var em=S.meds.filter(function(m){return m.id===editing.id})[0];
      if(em){var nt=times.sort(),chg=nt.join()!==em.times.join();em.name=String(fd.get('name')).trim();em.dose=String(fd.get('dose')||'').trim();em.times=nt;if(chg)em.created=Date.now();
        editing=null;save();tab='hoy';render();window.scrollTo(0,0);toast('Cambios guardados');return}}
    S.meds.push({id:uid(),created:Date.now(),name:String(fd.get('name')).trim(),dose:String(fd.get('dose')||'').trim(),times:times.sort()});
    if(S.metrics.firstMedMs==null&&S.metrics.addStart){S.metrics.firstMedMs=Date.now()-S.metrics.addStart}mark('med');save();tab='hoy';render();window.scrollTo(0,0);toast('Medicamento guardado');return}
  if(n==='appt'){if(editing&&editing.kind==='cita'){var ea2=S.appts.filter(function(m){return m.id===editing.id})[0];
      if(ea2){ea2.title=String(fd.get('title')).trim();ea2.date=fd.get('date');ea2.time=fd.get('time');ea2.place=String(fd.get('place')||'').trim();editing=null;save();tab='hoy';render();window.scrollTo(0,0);toast('Cambios guardados');return}}
    S.appts.push({id:uid(),title:String(fd.get('title')).trim(),date:fd.get('date'),time:fd.get('time'),place:String(fd.get('place')||'').trim()});mark('appt');save();tab='hoy';render();window.scrollTo(0,0);toast('Control guardado');return}
  if(n==='cg'){S.caregiver={name:String(fd.get('name')||'').trim(),contact:String(fd.get('contact')||'').trim()};S.settings.graceMin=Number(fd.get('grace'))||15;save();toast('Cuidador guardado');return}
  if(n==='fb'){var fb=S.metrics.feedback||(S.metrics.feedback={});fb.comment=String(fd.get('comment')||'').trim();save();toast('Opinión guardada');render()}
});
function copy(text,msg){var ok=function(){toast(msg)};
  try{navigator.clipboard.writeText(text).then(ok,function(){fallback()})}catch(e){fallback()}
  function fallback(){var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');ok()}catch(e){toast('Seleccione y copie el texto manualmente')}ta.remove()}}
function summary(){var m=S.metrics,fb=m.feedback||{},t=m.t||{};
  return ['Resumen de prueba · Salud Conecta',
   'Tareas: cuenta '+(t.account?'sí':'no')+', medicamento '+(t.med?'sí':'no')+', cita '+(t.appt?'sí':'no')+', confirmación '+(t.taken?'sí':'no'),
   'Crear cuenta: '+(m.regMs!=null?mmss(m.regMs):'—')+' · Primer medicamento: '+(m.firstMedMs!=null?mmss(m.firstMedMs):'—'),
   'Ayuda: '+(fb.help||'—')+' · Facilidad (1-5): '+(fb.ease||'—')+' · La seguiría usando: '+(fb.use||'—'),
   'Cambiaría: '+(fb.comment||'—')].join('\n')}
function sample(){var now=new Date(),d=new Date(now.getTime()+14*864e5);
  S=fresh();S.account={name:'Carlos Ejemplo',email:'ejemplo@saludconecta.test',hash:'sample'};S.caregiver={name:'Laura (hija)',contact:''};
  var h=now.getHours();
  var d0=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),m1=uid(),m2=uid();S.meds=[{id:m1,created:d0,name:'Losartán',dose:'1 tableta de 50 mg',times:['06:00']},{id:m2,created:d0,name:'Metformina',dose:'1 tableta de 850 mg',times:['13:00','20:00']}];S.log[dkey(now)+'|'+m1+'|06:00']={taken:d0+6*36e5+4*6e4,reminded:d0+6*36e5};
  S.appts=[{id:uid(),title:'Control de medicina general',date:dkey(d),time:'09:00',place:'IPS Centro'}];
  S.loggedIn=true;S.metrics.t.account=Date.now();save();tab='hoy';render();toast('Datos de ejemplo cargados')}

render();setInterval(tick,5000);setTimeout(tick,800);
document.addEventListener('visibilitychange',function(){if(!document.hidden)tick()});
})();

/* Registro del service worker: permite instalar la app y abrirla sin conexión */
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}
