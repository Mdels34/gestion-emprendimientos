(function(root){
  'use strict';
  const RESERVED=['Pendiente','En preparación','Listo para repartir'];
  const TRANSIT=['En reparto','No entregado'];
  const FLOW={'Pendiente':['En preparación','Cancelado'],'En preparación':['Listo para repartir','Cancelado'],'Listo para repartir':['En reparto','Cancelado'],'En reparto':['Entregado','No entregado','Devuelto'],'No entregado':['En reparto','Devuelto'],'Entregado':[],'Cancelado':[],'Devuelto':[]};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const money=x=>Math.round((Number(x)+Number.EPSILON)*100)/100;
  const need=(v,msg)=>{if(!v)throw new Error(msg);};
  const txt=(v,max=200)=>String(v==null?'':v).trim().slice(0,max);
  const number=(v,label,min=0,integer=false)=>{const n=Number(v);need(v!==''&&v!==null&&v!==undefined&&Number.isFinite(n)&&n>=min&&(!integer||Number.isInteger(n)),label+' no válido.');return n;};
  function date(v){need(/^\d{4}-\d{2}-\d{2}$/.test(v),'Fecha no válida.');const d=new Date(v+'T12:00:00Z');need(!isNaN(d)&&d.toISOString().slice(0,10)===v,'Fecha no válida.');return v;}
  function reserved(s,id){return s.orders.filter(o=>RESERVED.includes(o.status)).reduce((n,o)=>n+o.items.filter(i=>i.productId===id).reduce((q,i)=>q+i.qty,0),0);}
  function transit(s,id){return s.orders.filter(o=>TRANSIT.includes(o.status)).reduce((n,o)=>n+o.items.filter(i=>i.productId===id).reduce((q,i)=>q+i.qty,0),0);}
  function available(s,id){const p=s.products.find(p=>p.id===id);return p?p.stock-reserved(s,id):0;}
  function total(o){return money(o.items.reduce((sum,i)=>sum+i.qty*i.price,0));}
  function due(o){return ['Cancelado','Devuelto'].includes(o.status)?0:money(Math.max(0,total(o)-o.paid));}
  function audit(s,when,title,detail){s.history.unshift({id:'h'+s.nextId++,when,title:txt(title),detail:txt(detail,1000)});}
  function stockMove(s,p,qty,kind,ref,when,note){p.stock+=qty;s.movements.unshift({id:'m'+s.nextId++,when,productId:p.id,qty,kind,ref:txt(ref),note:txt(note,500)});}
  function transportFor(o){
    const t=o.transport||{};
    return {company:txt(t.company,120),vehiclePlate:txt(t.vehiclePlate,24).toUpperCase(),driverName:txt(t.driverName==null?o.driver:t.driverName,120),documentType:txt(t.documentType,20)||'CI',documentNumber:txt(t.documentNumber,40)};
  }
  function transportFrom(o,input,driver){
    const t=Object.assign(transportFor(o),input||{});
    if(driver!==undefined&&!(input&&Object.prototype.hasOwnProperty.call(input,'driverName')))t.driverName=driver;
    const clean=transportFor({transport:t});need(['CI','Pasaporte','Otro'].includes(clean.documentType),'Tipo de documento del conductor no válido.');return clean;
  }
  function recordTransport(o,t,when,reason){
    o.transport=clone(t);o.driver=t.driverName;
    o.transportHistory=o.transportHistory||[];o.transportHistory.push({when,reason,transport:clone(t)});
  }
  function addCustomer(s,a,when){
    const name=txt(a.name,100),phone=txt(a.phone,40),address=txt(a.address,200);need(name&&phone&&address,'Completá nombre, teléfono y dirección.');
    const digits=phone.replace(/\D/g,'');need(digits.length>=7,'Revisá el teléfono del cliente.');need(!s.customers.some(x=>x.phone.replace(/\D/g,'')===digits),'Ya existe un cliente con ese teléfono. Elegilo de la lista de clientes registrados.');
    const c={id:'c'+s.nextId++,name,phone,address,area:txt(a.area,80)||'Sin zona',note:txt(a.note,500)};s.customers.push(c);audit(s,when,'Cliente registrado',c.name);return c;
  }
  function validate(s){
    need(s&&s.schema===1&&Array.isArray(s.products)&&Array.isArray(s.orders),'Datos incompatibles.');
    need(new Set(s.products.map(p=>p.id)).size===s.products.length,'Productos duplicados.');
    need(new Set(s.products.map(p=>p.sku)).size===s.products.length,'Códigos duplicados.');
    need(new Set(s.customers.map(c=>c.id)).size===s.customers.length,'Clientes duplicados.');
    need(new Set(s.orders.map(o=>o.id)).size===s.orders.length,'Pedidos duplicados.');
    s.products.forEach(p=>{number(p.stock,'Stock',0,true);number(p.price,'Precio');need(available(s,p.id)>=0,'Stock insuficiente para las reservas de '+p.name+'.');});
    s.orders.forEach(o=>{need(FLOW[o.status]&&s.customers.some(c=>c.id===o.customerId),'Pedido inconsistente.');need(o.items.length>0,'Pedido vacío.');o.items.forEach(i=>{need(s.products.some(p=>p.id===i.productId),'Producto inexistente.');number(i.qty,'Cantidad',1,true);number(i.price,'Precio');});number(o.paid,'Cobro');need(o.paid<=total(o),'El cobro supera el importe del pedido.');if(o.transport){need(['CI','Pasaporte','Otro'].includes(o.transport.documentType),'Tipo de documento no válido.');need(typeof o.transport.documentNumber==='string','El número de documento debe conservarse como texto.');}});
    return true;
  }
  function apply(input,action){
    need(action&&typeof action==='object','Operación no válida.');
    need(/^[a-zA-Z0-9_-]{6,100}$/.test(action.requestId||''),'Falta identificador de operación.');
    if((input.requests||[]).includes(action.requestId))return clone(input);
    const s=clone(input),a=action.data||{},when=action.when||new Date().toISOString();
    need(!isNaN(Date.parse(when)),'Fecha de operación no válida.');
    let p,o,c;
    switch(action.type){
      case 'addProduct':{
        const sku=txt(a.sku,40).toUpperCase(),name=txt(a.name,100);
        need(sku&&name,'Completá código y nombre del producto.');need(!s.products.some(x=>x.sku===sku),'Ya existe un producto con ese código.');
        p={id:'p'+s.nextId++,sku,name,category:txt(a.category,60)||'General',price:money(number(a.price,'Precio')),stock:0,min:number(a.min,'Stock mínimo',0,true)};
        s.products.push(p);const opening=number(a.stock,'Stock inicial',0,true);if(opening)stockMove(s,p,opening,'Ingreso inicial','Alta',when,'Stock al crear el producto');
        audit(s,when,'Producto creado',p.name+' · '+p.sku);break;
      }
      case 'movement':{
        p=s.products.find(x=>x.id===a.productId);need(p,'Producto inexistente.');const qty=number(a.qty,'Cantidad',1,true);need(['Ingreso','Ajuste positivo','Ajuste negativo'].includes(a.kind),'Tipo de movimiento no válido.');
        const note=txt(a.note,500);need(note,'Indicá el motivo del movimiento.');const signed=a.kind==='Ajuste negativo'?-qty:qty;need(p.stock+signed>=reserved(s,p.id),'El ajuste afectaría unidades reservadas.');
        stockMove(s,p,signed,a.kind,'Manual',when,note);audit(s,when,'Movimiento de stock',p.name+' · '+(signed>0?'+':'')+signed+' unidades');break;
      }
      case 'addCustomer':{
        addCustomer(s,a,when);break;
      }
      case 'createOrder':{
        if(a.newCustomer){need(!a.customerId,'Elegí un cliente registrado o ingresá uno nuevo.');c=addCustomer(s,a.newCustomer,when);}
        else c=s.customers.find(x=>x.id===a.customerId);
        need(c,'Elegí un cliente o registrá uno nuevo.');need(Array.isArray(a.items)&&a.items.length>0&&a.items.length<=50,'Agregá al menos un producto.');
        const merged={};a.items.forEach(i=>{p=s.products.find(x=>x.id===i.productId);need(p,'Producto inexistente.');const qty=number(i.qty,'Cantidad',1,true);merged[p.id]=(merged[p.id]||0)+qty;});
        const items=Object.keys(merged).map(id=>{p=s.products.find(x=>x.id===id);need(merged[id]<=available(s,id),'Stock disponible insuficiente de '+p.name+'.');return {productId:id,qty:merged[id],price:p.price};});
        o={id:'PED-'+String(s.nextOrder++).padStart(4,'0'),customerId:c.id,items,status:'Pendiente',paid:money(number(a.paid==null?0:a.paid,'Cobro')),createdAt:when,deliveryDate:date(a.deliveryDate),driver:txt(a.driver,80),note:txt(a.note,500),events:[{when,status:'Pendiente',note:'Pedido registrado; stock reservado.'}]};
        const transport=transportFrom(o,a.transport,a.driver);o.transport=transport;o.driver=transport.driverName;
        if(transport.company||transport.vehiclePlate||transport.driverName||transport.documentNumber)recordTransport(o,transport,when,'Al registrar el pedido');
        need(o.paid<=total(o),'El cobro supera el importe del pedido.');s.orders.unshift(o);audit(s,when,'Pedido registrado',o.id+' · '+c.name);break;
      }
      case 'status':{
        o=s.orders.find(x=>x.id===a.orderId);need(o,'Pedido inexistente.');need(FLOW[o.status].includes(a.status),'Ese cambio de estado no está permitido.');
        const note=txt(a.note,500),old=o.status;need(!['No entregado','Devuelto'].includes(a.status)||note,'Registrá el motivo de la incidencia o devolución.');
        need(a.status!=='Cancelado'||o.paid===0,'El pedido tiene cobros; requiere revisión antes de cancelar.');
        if(a.status==='En reparto'){
          const transport=transportFrom(o,a.transport,a.driver);need(transport.driverName,'Indicá el nombre del conductor antes de despachar.');recordTransport(o,transport,when,old==='No entregado'?'Al reintentar el reparto':'Al despachar');
        }
        if(old==='Listo para repartir'&&a.status==='En reparto')o.items.forEach(i=>{p=s.products.find(x=>x.id===i.productId);need(p.stock>=i.qty,'Stock físico insuficiente.');stockMove(s,p,-i.qty,'Salida a reparto',o.id,when,'Mercadería despachada');});
        if(a.status==='Devuelto')o.items.forEach(i=>{p=s.products.find(x=>x.id===i.productId);stockMove(s,p,i.qty,'Retorno de reparto',o.id,when,note);});
        o.status=a.status;if(a.driver&&a.status!=='En reparto')recordTransport(o,transportFrom(o,a.transport,a.driver),when,'Al actualizar el pedido');if(a.status==='Entregado')o.deliveredAt=when;o.events.push({when,status:a.status,note:note||'Estado actualizado.',...(a.status==='En reparto'?{transport:clone(o.transport)}:{})});
        audit(s,when,a.status==='Entregado'?'Entrega confirmada':a.status==='Devuelto'?'Devolución recibida':'Pedido actualizado',o.id+' · '+a.status);break;
      }
      case 'assign':{
        o=s.orders.find(x=>x.id===a.orderId);need(o&&[...RESERVED,...TRANSIT].includes(o.status),'El pedido ya está cerrado.');const transport=transportFrom(o,a.transport,a.driver);need(transport.driverName,'Indicá el nombre del conductor.');recordTransport(o,transport,when,'Asignación actualizada');audit(s,when,'Transporte asignado',o.id+' · '+transport.driverName+(transport.company?' · '+transport.company:'')+(transport.vehiclePlate?' · '+transport.vehiclePlate:''));break;
      }
      case 'collect':{
        o=s.orders.find(x=>x.id===a.orderId);need(o&&!['Cancelado','Devuelto'].includes(o.status),'Pedido no disponible para cobros.');const amount=money(number(a.amount,'Importe',0.01));need(amount<=due(o),'El importe supera el saldo pendiente.');o.paid=money(o.paid+amount);audit(s,when,'Cobro registrado',o.id+' · UYU '+amount.toFixed(2));break;
      }
      default:throw new Error('Operación desconocida.');
    }
    s.revision++;s.requests.push(action.requestId);validate(s);return s;
  }
  function seed(){
    const s={schema:1,revision:0,nextId:100,nextOrder:1015,business:'Mi emprendimiento',referenceDate:'2026-11-20',requests:[],products:[
      {id:'p1',sku:'TER-001',name:'Termo de acero · 1 litro',category:'Bazar',price:890,stock:24,min:8},
      {id:'p2',sku:'MAT-002',name:'Mate de cerámica',category:'Bazar',price:420,stock:36,min:10},
      {id:'p3',sku:'SET-003',name:'Set matero completo',category:'Regalos',price:1350,stock:11,min:4},
      {id:'p4',sku:'VEL-004',name:'Vela aromática',category:'Hogar',price:290,stock:8,min:8},
      {id:'p5',sku:'BOT-005',name:'Botella térmica · 750 ml',category:'Bazar',price:650,stock:18,min:6},
      {id:'p6',sku:'BOL-006',name:'Bolsa de tela estampada',category:'Accesorios',price:350,stock:42,min:10},
      {id:'p7',sku:'CUA-007',name:'Cuaderno artesanal A5',category:'Papelería',price:240,stock:5,min:6},
      {id:'p8',sku:'ORG-008',name:'Organizador de escritorio',category:'Hogar',price:490,stock:16,min:5}
    ],customers:[
      {id:'c1',name:'Ana Pereira',phone:'099 000 101',address:'Dirección de ejemplo 101',area:'Cordón',note:'Prefiere recibir por la tarde.'},
      {id:'c2',name:'Bruno Silva',phone:'099 000 102',address:'Dirección de ejemplo 202',area:'Centro',note:''},
      {id:'c3',name:'Carolina Méndez',phone:'099 000 103',address:'Dirección de ejemplo 303',area:'Pocitos',note:'Pedido para regalo.'},
      {id:'c4',name:'Diego Acosta',phone:'099 000 104',address:'Dirección de ejemplo 404',area:'Parque Batlle',note:'Coordinar antes de llegar.'},
      {id:'c5',name:'Elena Rodríguez',phone:'099 000 105',address:'Dirección de ejemplo 505',area:'La Blanqueada',note:''},
      {id:'c6',name:'Fernando Costa',phone:'099 000 106',address:'Dirección de ejemplo 606',area:'Buceo',note:''},
      {id:'c7',name:'Gabriela Torres',phone:'099 000 107',address:'Dirección de ejemplo 707',area:'Centro',note:''},
      {id:'c8',name:'Helena Suárez',phone:'099 000 108',address:'Dirección de ejemplo 808',area:'Cordón',note:'Nueva coordinación pendiente.'}
    ],orders:[],movements:[],history:[]};
    const rows=[
      [1001,'c1',[[1,1],[2,1]],'Entregado',1310,'19','Lucía'],[1002,'c2',[[5,2]],'Entregado',1300,'19','Nicolás'],
      [1003,'c3',[[3,1],[6,2]],'Listo para repartir',0,'20','Lucía'],[1004,'c4',[[1,2]],'En reparto',500,'20','Lucía'],
      [1005,'c5',[[4,3],[7,1]],'En preparación',1110,'20',''],[1006,'c1',[[2,2],[8,1]],'Pendiente',0,'21',''],
      [1007,'c6',[[5,1],[6,3]],'Listo para repartir',1700,'20','Nicolás'],[1008,'c7',[[7,1]],'Cancelado',0,'19',''],
      [1009,'c8',[[8,1]],'No entregado',0,'20','Nicolás'],[1010,'c3',[[4,2],[6,1]],'Entregado',930,'14','Lucía'],
      [1011,'c2',[[1,1]],'Entregado',890,'16','Nicolás'],[1012,'c7',[[3,1],[2,1]],'Entregado',1770,'17','Lucía'],
      [1013,'c6',[[8,2],[7,1]],'Entregado',1220,'18','Nicolás'],[1014,'c1',[[5,1]],'Entregado',650,'20','Lucía']
    ];
    rows.forEach(r=>{const [n,customerId,lines,status,paid,day,driver]=r;const when='2026-11-'+String(Math.min(20,Number(day))).padStart(2,'0')+'T13:00:00.000Z';const o={id:'PED-'+n,customerId,items:lines.map(i=>({productId:'p'+i[0],qty:i[1],price:s.products.find(p=>p.id==='p'+i[0]).price})),status,paid,createdAt:when,deliveryDate:'2026-11-'+day,driver,note:'Ejemplo ficticio',events:[{when,status:'Pendiente',note:'Pedido de ejemplo registrado.'}]};
      if(status!=='Pendiente')o.events.push({when,status,note:status==='No entregado'?'Cliente ausente. La mercadería continúa con el repartidor.':'Estado de ejemplo.'});if(status==='Entregado')o.deliveredAt=when;s.orders.push(o);
    });
    s.products.forEach(p=>{const shipped=s.orders.filter(o=>[...TRANSIT,'Entregado'].includes(o.status)).reduce((n,o)=>n+o.items.filter(i=>i.productId===p.id).reduce((q,i)=>q+i.qty,0),0);s.movements.push({id:'m'+s.nextId++,when:'2026-11-13T12:00:00.000Z',productId:p.id,qty:p.stock+shipped,kind:'Ingreso inicial',ref:'Demo',note:'Saldo inicial de ejemplo'});});
    s.orders.filter(o=>[...TRANSIT,'Entregado'].includes(o.status)).forEach(o=>o.items.forEach(i=>s.movements.push({id:'m'+s.nextId++,when:o.createdAt,productId:i.productId,qty:-i.qty,kind:'Salida a reparto',ref:o.id,note:'Movimiento de ejemplo'})));
    s.orders.slice(0,9).forEach(o=>audit(s,o.createdAt,o.status==='Entregado'?'Entrega confirmada':'Pedido '+o.status.toLowerCase(),o.id+' · '+s.customers.find(c=>c.id===o.customerId).name));s.history.sort((a,b)=>b.when.localeCompare(a.when));validate(s);return s;
  }
  const api={RESERVED,TRANSIT,FLOW,clone,money,reserved,transit,available,total,due,transportFor,validate,apply,seed};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.InventoryDemoModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);

/**
 * DEMOSTRACIÓN 0.4. setupPlantilla conserva una plantilla compatible;
 * setupDemo crea datos ficticios únicamente en una planilla nueva y vacía.
 * El modelo compartido se incorpora antes de este archivo en Code.gs.
 * Los registros de Operaciones son la fuente de verdad; las vistas son regenerables.
 */
function doGet() {
  assertAuthorized_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Gestión para emprendimientos · Demo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function setupDemo() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('GESTION_DEMO_SHEET_ID')) throw new Error('La demo ya está configurada. No se sobrescribieron datos.');
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create('Gestión para emprendimientos · Demo');
  if (ss.getSheets().some(sheet => sheet.getLastRow() > 0)) throw new Error('La planilla debe estar completamente vacía. Creá una planilla nueva para esta demo.');
  const email = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!email) throw new Error('No se pudo identificar la cuenta Google que instala la demo.');
  const state = InventoryDemoModel.seed();
  let base = ss.getSheetByName('Base');
  if (!base) base = ss.getSheets()[0].setName('Base');
  base.getRange(1,1,2,2).setValues([['Tipo','Contenido JSON'],['DEMO_FICTICIA_V1',JSON.stringify(state)]]);
  const log = ss.insertSheet('Operaciones');
  log.getRange(1,1,1,5).setValues([['Revisión','Solicitud','Fecha UTC','Tipo','Operación JSON']]);
  // Configuración local de esta instalación; no autoriza usuarios de otras empresas.
  props.setProperties({GESTION_DEMO_SHEET_ID:ss.getId(),USUARIOS_AUTORIZADOS:email,GESTION_DEMO_OWNER_EMAIL:email});
  projectViews_(ss,state);
  SpreadsheetApp.flush();
  console.log('Demo configurada con datos ficticios. Cuenta autorizada: '+email);
  return {ok:true,message:'Demo ficticia configurada. Implementá la app para ejecutar como el usuario que accede.'};
}

function setupPlantilla() {
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('GESTION_DEMO_SHEET_ID'))throw new Error('La app ya está configurada. No se sobrescribieron datos.');
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('Abrí Apps Script desde Extensiones en la planilla de la plantilla y ejecutá setupPlantilla allí.');
  const base=ss.getSheetByName('Base'),log=ss.getSheetByName('Operaciones');
  const headers=['Revisión','Solicitud','Fecha UTC','Tipo','Operación JSON'];
  if(!base||!log||base.getRange(2,1).getValue()!=='DEMO_FICTICIA_V1'||JSON.stringify(log.getRange(1,1,1,5).getValues()[0])!==JSON.stringify(headers))throw new Error('La planilla no es una plantilla compatible. No se sobrescribió nada.');
  const state=readState_(ss); // Validar el checkpoint y su cola, sin escribir en las hojas.
  const email=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  if(!email)throw new Error('No se pudo identificar la cuenta Google que instala la app.');
  props.setProperties({GESTION_DEMO_SHEET_ID:ss.getId(),USUARIOS_AUTORIZADOS:email,GESTION_DEMO_OWNER_EMAIL:email});
  console.log('Plantilla vinculada, sin reemplazar registros. Cuenta autorizada: '+email);
  return {ok:true,message:'Plantilla vinculada. Implementá la app para ejecutar como el usuario que accede.',revision:state.revision};
}

function getAppState() {
  assertAuthorized_();
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try { const ss=getBook_();return {state:readState_(ss),storage:'sheets',connection:connectionInfo_(ss)}; }
  finally {lock.releaseLock();}
}

function runAppAction(expectedRevision,action) {
  assertAuthorized_();
  if (!action || JSON.stringify(action).length>30000) throw new Error('La operación supera el tamaño permitido para esta demo.');
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss=getBook_(), loaded=readStateInfo_(ss), current=loaded.state;
    // Resolver reintentos antes de comprobar revisión evita duplicar una operación ya guardada.
    if (current.requests.includes(action.requestId)) return {state:current,storage:'sheets',connection:connectionInfo_(ss)};
    if (Number(expectedRevision)!==current.revision) throw new Error('Datos desactualizados. Se actualizará la vista; revisá y volvé a intentar.');
    const limit=operationLimit_();
    if (limit && current.revision>=limit) throw new Error('Se alcanzó el límite configurado de '+limit+' operaciones. Revisá GESTION_MAX_OPERACIONES.');
    const received=JSON.parse(JSON.stringify(action));
    received.when=new Date().toISOString();
    const next=InventoryDemoModel.apply(current,received);
    // El checkpoint contiene SOLO operaciones confirmadas. Si falla el append siguiente,
    // la revisión y el requestId pendientes todavía no pertenecen al estado persistido.
    const checkpoint=checkpointIfDue_(ss,loaded,false);
    if(PropertiesService.getScriptProperties().getProperty('GESTION_ARCHIVAR_OPERACIONES')==='true'){
      archiveCoveredOperations_(ss,checkpoint);
    }
    // Una sola fila es el compromiso autoritativo. Los reportes se reconstruyen desde el registro.
    const log=ss.getSheetByName('Operaciones');ensureGrid_(log,log.getLastRow()+1,5);
    log.appendRow([next.revision,received.requestId,received.when,received.type,JSON.stringify(received)]);
    SpreadsheetApp.flush();
    PropertiesService.getScriptProperties().setProperties({GESTION_DEMO_LAST_SAVED:received.when});
    let viewsUpdated=true;
    try {projectViews_(ss,next);SpreadsheetApp.flush();}catch(e){viewsUpdated=false;console.error('Operación guardada; vistas pendientes de regeneración: '+e.message);}
    return {state:next,storage:'sheets',viewsUpdated:viewsUpdated,connection:connectionInfo_(ss)};
  } finally {lock.releaseLock();}
}

function connectionInfo_(ss) {
  const props=PropertiesService.getScriptProperties(),email=String(Session.getActiveUser().getEmail()||'').toLowerCase();
  const owner=props.getProperty('GESTION_DEMO_OWNER_EMAIL')||String(props.getProperty('USUARIOS_AUTORIZADOS')||'').split(',')[0].trim().toLowerCase();
  return {spreadsheetId:ss.getId(),name:ss.getName(),url:ss.getUrl(),canConfigure:email===owner,lastSavedAt:props.getProperty('GESTION_DEMO_LAST_SAVED')||'',checkedAt:new Date().toISOString()};
}

function connectAppSheet(sheetReference,expectedCurrentId) {
  assertAuthorized_();
  const current=getBook_();
  if(!connectionInfo_(current).canConfigure)throw new Error('Solo la cuenta instaladora puede cambiar la hoja de datos.');
  const reference=String(sheetReference||'').trim();
  const match=reference.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:[/?#].*)?$/);
  const id=match?match[1]:reference;
  if(!/^[A-Za-z0-9_-]{10,200}$/.test(id))throw new Error('Ingresá el enlace de una hoja de Google Sheets o su ID.');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const props=PropertiesService.getScriptProperties();
    if(props.getProperty('GESTION_DEMO_SHEET_ID')!==String(expectedCurrentId))throw new Error('La conexión cambió en otra ventana. Actualizá antes de continuar.');
    if(id===current.getId())return {state:readState_(current),storage:'sheets',connection:connectionInfo_(current)};
    const target=SpreadsheetApp.openById(id);
    const empty=target.getSheets().every(sh=>sh.getLastRow()===0);
    if(empty){
      const state=readState_(current),chunks=stateChunks_(JSON.stringify(state),'DEMO_FICTICIA_V1');
      const base=target.getSheets()[0].setName('Base');ensureGrid_(base,chunks.length+1,2);
      base.getRange(1,1,1,2).setValues([['Tipo','Contenido JSON']]);base.getRange(2,1,chunks.length,2).setValues(chunks);
      target.insertSheet('Operaciones').getRange(1,1,1,5).setValues([['Revisión','Solicitud','Fecha UTC','Tipo','Operación JSON']]);
      projectViews_(target,state);SpreadsheetApp.flush();
    }else{
      const base=target.getSheetByName('Base'),log=target.getSheetByName('Operaciones');
      if(!base||!log||base.getRange(2,1).getValue()!=='DEMO_FICTICIA_V1')throw new Error('La hoja contiene información ajena a esta app. Elegí una vacía o una instalación compatible; no se sobrescribió nada.');
    }
    const state=readState_(target); // Comprobar antes de cambiar el vínculo.
    props.setProperties({GESTION_DEMO_SHEET_ID:target.getId(),GESTION_DEMO_LAST_SAVED:''});
    return {state:state,storage:'sheets',connection:connectionInfo_(target)};
  }finally{lock.releaseLock();}
}

function regenerateDemoViews() {
  assertAuthorized_();
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {const ss=getBook_();projectViews_(ss,readState_(ss));SpreadsheetApp.flush();return {ok:true};}
  finally {lock.releaseLock();}
}

function assertAuthorized_() {
  const props=PropertiesService.getScriptProperties();
  const allowed=String(props.getProperty('USUARIOS_AUTORIZADOS')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  const email=String(Session.getActiveUser().getEmail()||'').toLowerCase();
  if (!email || !allowed.includes(email)) throw new Error('Acceso no autorizado. Configurá USUARIOS_AUTORIZADOS e implementá para ejecutar como el usuario que accede. La identidad debe estar disponible.');
}

function getBook_() {
  const id=PropertiesService.getScriptProperties().getProperty('GESTION_DEMO_SHEET_ID');
  if(!id)throw new Error('Primero ejecutá setupPlantilla en la plantilla preparada, o setupDemo en una planilla nueva y vacía.');
  return SpreadsheetApp.openById(id);
}

// A:B conserva la Base original. D:E y G:H son dos slots alternados de snapshot.
// Cada slot se confirma escribiendo SU manifiesto al final, nunca un puntero global.
const SNAPSHOT_INTERVAL_=200;
const SNAPSHOT_KIND_='GESTION_SNAPSHOT_V1';
const OPERATION_HEADERS_=['Revisión','Solicitud','Fecha UTC','Tipo','Operación JSON'];

function operationLimit_() {
  const raw=PropertiesService.getScriptProperties().getProperty('GESTION_MAX_OPERACIONES');
  if(raw==null||String(raw).trim()==='')return 0;
  const limit=Number(raw);
  if(!Number.isSafeInteger(limit)||limit<0)throw new Error('Configurá GESTION_MAX_OPERACIONES como un entero no negativo; 0 deja el registro sin tope fijo.');
  return limit;
}

function ensureGrid_(sheet,rows,columns) {
  if(sheet.getMaxRows()<rows)sheet.insertRowsAfter(sheet.getMaxRows(),rows-sheet.getMaxRows());
  if(sheet.getMaxColumns()<columns)sheet.insertColumnsAfter(sheet.getMaxColumns(),columns-sheet.getMaxColumns());
}

function stateChunks_(json,firstMarker) {
  const rows=[];
  for(let offset=0;offset<json.length;){
    let end=Math.min(offset+24000,json.length);
    // No separar un par UTF-16: cada celda se serializa por separado en Sheets.
    if(end<json.length&&/[\uD800-\uDBFF]/.test(json[end-1])&&/[\uDC00-\uDFFF]/.test(json[end]))end--;
    rows.push([offset===0?firstMarker:'CONTINUACION',json.slice(offset,end)]);offset=end;
  }
  return rows;
}

function snapshotHash_(json) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,json,Utilities.Charset.UTF_8)
    .map(byte=>('0'+((byte+256)%256).toString(16)).slice(-2)).join('');
}

function snapshotSlots_(base) {
  return [4,7].map(column=>{
    if(base.getMaxColumns()<column+1)return {column:column,owned:false,meta:null};
    const header=base.getRange(1,column,1,2).getValues()[0];
    const owned=header[1]===SNAPSHOT_KIND_;
    if(!owned){
      if(String(header[0]).includes(SNAPSHOT_KIND_))throw new Error('El encabezado de un snapshot está dañado. Revisá la copia de seguridad antes de continuar.');
      return {column:column,owned:false,meta:null};
    }
    if(header[0]==='')return {column:column,owned:true,meta:null}; // Escritura incompleta, sin confirmar.
    let meta;try{meta=JSON.parse(String(header[0]));}catch(e){throw new Error('El manifiesto de un snapshot no es válido. No se usaron datos sustitutos.');}
    if(meta.kind!==SNAPSHOT_KIND_||!Number.isSafeInteger(meta.revision)||meta.revision<0||
      !Number.isSafeInteger(meta.baseRevision)||meta.baseRevision<0||meta.baseRevision>meta.revision||
      !Number.isSafeInteger(meta.chunks)||meta.chunks<1||!/^[a-f0-9]{64}$/.test(meta.hash)){
      throw new Error('El manifiesto de un snapshot es inconsistente. Revisá la copia de seguridad.');
    }
    return {column:column,owned:true,meta:meta};
  });
}

function readSnapshotData_(base,column,meta) {
  if(meta.chunks+1>base.getMaxRows())throw new Error('Faltan fragmentos del snapshot. No se reconstruyó un estado parcial.');
  const rows=base.getRange(2,column,meta.chunks,2).getValues();
  if(rows.some((row,i)=>row[0]!== (i===0?SNAPSHOT_KIND_:'CONTINUACION')||typeof row[1]!=='string'||!row[1]||row[1].length>24000)){
    throw new Error('Los fragmentos del snapshot son inconsistentes. No se reconstruyó un estado parcial.');
  }
  const json=rows.map(row=>row[1]).join('');
  if(snapshotHash_(json)!==meta.hash)throw new Error('El snapshot no coincide con su huella de integridad. Revisá la copia de seguridad.');
  const state=JSON.parse(json);InventoryDemoModel.validate(state);
  if(state.revision!==meta.revision||!Array.isArray(state.requests))throw new Error('La revisión del snapshot es inconsistente.');
  return state;
}

function readCheckpoint_(ss) {
  const base=ss.getSheetByName('Base');
  const slots=snapshotSlots_(base),complete=slots.filter(slot=>slot.meta);
  complete.sort((a,b)=>b.meta.revision-a.meta.revision);
  if(complete.length){
    const selected=complete[0];
    if(complete.some(slot=>slot.meta.baseRevision!==selected.meta.baseRevision||
      (slot.meta.revision===selected.meta.revision&&slot.meta.hash!==selected.meta.hash))){
      throw new Error('Los snapshots tienen revisiones incompatibles. No se eligió un estado sustituto.');
    }
    const archive=ss.getSheetByName('Operaciones archivo');
    if(archive&&archive.getLastRow()>1){
      const archived=operationBounds_(archive);
      if(archived.first!==selected.meta.baseRevision+1||archived.last>selected.meta.revision){
        throw new Error('El archivo supera la revisión del snapshot o no corresponde a esta Base. Recuperá una copia consistente.');
      }
    }
    return {state:readSnapshotData_(base,selected.column,selected.meta),column:selected.column,
      revision:selected.meta.revision,baseRevision:selected.meta.baseRevision};
  }
  const archive=ss.getSheetByName('Operaciones archivo');
  if(archive&&archive.getLastRow()>1)throw new Error('Hay operaciones archivadas pero falta un snapshot confirmado. Recuperá la copia de seguridad antes de continuar.');
  const raw=base.getRange(2,2,Math.max(1,base.getLastRow()-1),1).getValues().map(row=>String(row[0]||'')).join('');
  const state=JSON.parse(raw);InventoryDemoModel.validate(state);
  if(!Number.isSafeInteger(state.revision)||state.revision<0||!Array.isArray(state.requests))throw new Error('La revisión de Base es inconsistente.');
  return {state:state,column:null,revision:state.revision,baseRevision:state.revision};
}

function operationBounds_(log) {
  const count=Math.max(0,log.getLastRow()-1);
  if(!count)return {count:0,first:null,last:null};
  const first=Number(log.getRange(2,1).getValue()),last=Number(log.getRange(count+1,1).getValue());
  if(!Number.isSafeInteger(first)||first<1||!Number.isSafeInteger(last)||last!==first+count-1){
    throw new Error('El registro de operaciones tiene una secuencia inconsistente.');
  }
  return {count:count,first:first,last:last};
}

function operationFromRow_(row,revision) {
  if(Number(row[0])!==revision)throw new Error('El registro de operaciones tiene una secuencia inconsistente.');
  // El JSON sigue siendo autoritativo, como en las instalaciones anteriores.
  // Las columnas auxiliares pueden tener formatos de fecha/texto del propietario.
  return JSON.parse(row[4]);
}

function readStateInfo_(ss) {
  const base=ss.getSheetByName('Base'),log=ss.getSheetByName('Operaciones');
  if(!base||!log)throw new Error('Faltan hojas de la demo. No se crearon datos sustitutos.');
  const checkpoint=readCheckpoint_(ss),bounds=operationBounds_(log);
  let result=checkpoint.state;
  if(bounds.count){
    if(bounds.first>result.revision+1)throw new Error('El registro de operaciones tiene una secuencia inconsistente: faltan operaciones posteriores al snapshot.');
    const covered=Math.min(bounds.count,Math.max(0,result.revision-bounds.first+1));
    const remaining=bounds.count-covered;
    if(remaining)log.getRange(covered+2,1,remaining,5).getValues().forEach(row=>{
      const action=operationFromRow_(row,result.revision+1);
      result=InventoryDemoModel.apply(result,action);
      if(result.revision!==Number(row[0]))throw new Error('El registro de operaciones repite una solicitud ya confirmada.');
    });
  }
  return {state:result,checkpoint:checkpoint};
}

function readState_(ss) { return readStateInfo_(ss).state; }

function assertSnapshotSpace_(base,column) {
  if(base.getMaxColumns()<column)return;
  const width=Math.min(2,base.getMaxColumns()-column+1);
  const header=base.getRange(1,column,1,width).getValues()[0];
  if(header[1]===SNAPSHOT_KIND_)return;
  const occupied=base.getRange(1,column,Math.max(1,base.getLastRow()),width).getValues().some(row=>row.some(value=>value!==''&&value!=null));
  if(occupied)throw new Error('Base tiene información ajena en las columnas D:E o G:H. Hacé una copia de seguridad y liberá esos espacios antes de crear snapshots.');
}

function checkpointIfDue_(ss,loaded,force) {
  const current=loaded.state,previous=loaded.checkpoint;
  if(current.revision===previous.revision&&previous.column!==null)return previous;
  if(!force&&current.revision-previous.revision<SNAPSHOT_INTERVAL_)return previous;
  const base=ss.getSheetByName('Base');
  [4,7].forEach(column=>assertSnapshotSpace_(base,column));
  const column=previous.column===4?7:4,json=JSON.stringify(current),chunks=stateChunks_(json,SNAPSHOT_KIND_);
  const meta={kind:SNAPSHOT_KIND_,revision:current.revision,baseRevision:previous.baseRevision,chunks:chunks.length,hash:snapshotHash_(json)};
  ensureGrid_(base,chunks.length+1,8);
  // Invalidar el slot INACTIVO y aplicar esa invalidación antes de tocar sus datos.
  base.getRange(1,column,1,2).setValues([['',SNAPSHOT_KIND_]]);SpreadsheetApp.flush();
  base.getRange(2,column,chunks.length,2).setValues(chunks);SpreadsheetApp.flush();
  readSnapshotData_(base,column,meta); // Relectura y huella antes del compromiso.
  base.getRange(1,column).setValue(JSON.stringify(meta));SpreadsheetApp.flush();
  return {state:current,column:column,revision:current.revision,baseRevision:previous.baseRevision};
}

function archiveCoveredOperations_(ss,checkpoint) {
  const log=ss.getSheetByName('Operaciones'),bounds=operationBounds_(log);
  const count=bounds.count?Math.min(bounds.count,Math.max(0,checkpoint.revision-bounds.first+1)):0;
  if(!count||checkpoint.column===null)return {copied:0,removed:0};
  const rows=log.getRange(2,1,count,5).getValues();
  rows.forEach((row,i)=>{
    const action=operationFromRow_(row,bounds.first+i);
    if(!checkpoint.state.requests.includes(action.requestId))throw new Error('Una operación a archivar no está incluida en el snapshot. No se quitó ninguna fila.');
  });
  const archive=ss.getSheetByName('Operaciones archivo')||ss.insertSheet('Operaciones archivo');
  if(archive.getLastRow()===0)archive.getRange(1,1,1,5).setValues([OPERATION_HEADERS_]);
  if(JSON.stringify(archive.getRange(1,1,1,5).getValues()[0])!==JSON.stringify(OPERATION_HEADERS_)){
    throw new Error('La hoja Operaciones archivo contiene información ajena. No se sobrescribió nada.');
  }
  const archived=operationBounds_(archive);
  if(archived.count&&archived.first!==checkpoint.baseRevision+1)throw new Error('El archivo no corresponde a la Base de esta instalación. No se quitó ninguna fila.');
  const last=archived.count?archived.last:checkpoint.baseRevision;
  if(bounds.first<checkpoint.baseRevision+1||bounds.first>last+1)throw new Error('El archivo tiene una secuencia inconsistente. No se quitó ninguna fila.');
  const overlap=Math.min(count,Math.max(0,last-bounds.first+1));
  const archiveRow=bounds.first-checkpoint.baseRevision+1;
  if(overlap&&JSON.stringify(archive.getRange(archiveRow,1,overlap,5).getValues())!==JSON.stringify(rows.slice(0,overlap))){
    throw new Error('La copia archivada no coincide con las operaciones activas. No se quitó ninguna fila.');
  }
  const pending=rows.slice(overlap);
  if(pending.length){
    ensureGrid_(archive,archived.count+pending.length+1,5);
    archive.getRange(archived.count+2,2,pending.length,4).setNumberFormat('@');
    archive.getRange(archived.count+2,1,pending.length,5).setValues(pending);
  }
  SpreadsheetApp.flush();
  if(JSON.stringify(archive.getRange(archiveRow,1,count,5).getValues())!==JSON.stringify(rows)||
     JSON.stringify(log.getRange(2,1,count,5).getValues())!==JSON.stringify(rows)){
    throw new Error('No se pudo verificar el archivo. No se quitó ninguna fila del registro activo.');
  }
  // El snapshot confirmado y la copia verificada ya cubren TODAS estas filas.
  log.deleteRows(2,count);SpreadsheetApp.flush();
  return {copied:pending.length,removed:count};
}

function maintainDemoStorage_(archive) {
  assertAuthorized_();
  const ss=getBook_();
  if(!connectionInfo_(ss).canConfigure)throw new Error('Solo la cuenta instaladora puede crear snapshots o archivar operaciones.');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const checkpoint=checkpointIfDue_(ss,readStateInfo_(ss),true);
    const result=archive?archiveCoveredOperations_(ss,checkpoint):{copied:0,removed:0};
    return {ok:true,revision:checkpoint.revision,copied:result.copied,removed:result.removed};
  }finally{lock.releaseLock();}
}

// Mantenimiento explícito: primero hacé una copia de seguridad de la planilla.
function createDemoSnapshot() { return maintainDemoStorage_(false); }
function archiveDemoOperations() { return maintainDemoStorage_(true); }

function safeCell_(value) {
  if(typeof value==='number')return value;
  const text=String(value==null?'':value);
  return /^[=+@-]/.test(text)?"'"+text:text;
}

function writeView_(ss,name,headers,rows) {
  const sh=ss.getSheetByName(name)||ss.insertSheet(name);
  sh.clearContents();
  const values=[headers].concat(rows).map(row=>row.map(safeCell_));
  sh.getRange(1,1,values.length,headers.length).setValues(values);
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,headers.length).setBackground('#f1f3f4').setFontColor('#202124').setFontWeight('bold');
  sh.autoResizeColumns(1,headers.length);
}

function projectViews_(ss,s) {
  const m=InventoryDemoModel,c=id=>s.customers.find(x=>x.id===id),p=id=>s.products.find(x=>x.id===id);
  writeView_(ss,'Productos',['ID','SKU','Producto','Categoría','Precio UYU','En depósito','Reservado','Disponible','En reparto','Mínimo'],s.products.map(x=>[x.id,x.sku,x.name,x.category,x.price,x.stock,m.reserved(s,x.id),m.available(s,x.id),m.transit(s,x.id),x.min]));
  writeView_(ss,'Clientes',['ID','Nombre','Teléfono','Dirección','Zona','Observaciones'],s.customers.map(x=>[x.id,x.name,x.phone,x.address,x.area,x.note]));
  writeView_(ss,'Pedidos',['Pedido','Cliente ID','Cliente','Fecha UTC','Entrega prevista','Estado','Total UYU','Cobrado UYU','Saldo UYU','Empresa transportista','Matrícula','Conductor','Tipo de documento','Número de documento','Observaciones'],s.orders.map(o=>{const t=m.transportFor(o);return [o.id,o.customerId,c(o.customerId).name,o.createdAt,o.deliveryDate,o.status,m.total(o),o.paid,m.due(o),t.company,t.vehiclePlate,t.driverName,t.documentType,t.documentNumber,o.note];}));
  const lines=[];s.orders.forEach(o=>o.items.forEach(i=>lines.push([o.id,i.productId,p(i.productId).sku,p(i.productId).name,i.qty,i.price,m.money(i.qty*i.price)])));
  writeView_(ss,'Detalle pedidos',['Pedido','Producto ID','SKU','Producto','Cantidad','Precio UYU','Subtotal UYU'],lines);
  writeView_(ss,'Movimientos',['ID','Fecha UTC','Producto ID','SKU','Cantidad','Tipo','Referencia','Motivo'],s.movements.map(x=>[x.id,x.when,x.productId,p(x.productId).sku,x.qty,x.kind,x.ref,x.note]));
  writeView_(ss,'Actividad',['ID','Fecha UTC','Evento','Detalle'],s.history.map(x=>[x.id,x.when,x.title,x.detail]));
  const transportRows=[];s.orders.forEach(o=>(o.transportHistory||[]).forEach(h=>{const t=m.transportFor({transport:h.transport});transportRows.push([o.id,h.when,h.reason,t.company,t.vehiclePlate,t.driverName,t.documentType,t.documentNumber]);}));
  writeView_(ss,'Historial transporte',['Pedido','Fecha UTC','Acción','Empresa transportista','Matrícula','Conductor','Tipo de documento','Número de documento'],transportRows);
}
