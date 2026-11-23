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
  const state=readState_(ss); // Validar Base y el registro completo sin escribir en las hojas.
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
    const ss=getBook_(), current=readState_(ss);
    // Resolver reintentos antes de comprobar revisión evita duplicar una operación ya guardada.
    if (current.requests.includes(action.requestId)) return {state:current,storage:'sheets',connection:connectionInfo_(ss)};
    if (Number(expectedRevision)!==current.revision) throw new Error('Datos desactualizados. Se actualizará la vista; revisá y volvé a intentar.');
    if (current.revision>=1000) throw new Error('Se alcanzó el límite de 1.000 operaciones del paquete demostrativo.');
    const received=JSON.parse(JSON.stringify(action));
    received.when=new Date().toISOString();
    const next=InventoryDemoModel.apply(current,received);
    // Una sola fila es el compromiso autoritativo. Los reportes se reconstruyen desde el registro.
    ss.getSheetByName('Operaciones').appendRow([next.revision,received.requestId,received.when,received.type,JSON.stringify(received)]);
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
      const state=readState_(current),json=JSON.stringify(state),chunks=[];
      for(let i=0;i<json.length;i+=24000)chunks.push([i===0?'DEMO_FICTICIA_V1':'CONTINUACION',json.slice(i,i+24000)]);
      const base=target.getSheets()[0].setName('Base');base.getRange(1,1,1,2).setValues([['Tipo','Contenido JSON']]);base.getRange(2,1,chunks.length,2).setValues(chunks);
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

function readState_(ss) {
  const base=ss.getSheetByName('Base'),log=ss.getSheetByName('Operaciones');
  if(!base||!log)throw new Error('Faltan hojas de la demo. No se crearon datos sustitutos.');
  const raw=base.getRange(2,2,Math.max(1,base.getLastRow()-1),1).getValues().map(row=>String(row[0]||'')).join('');
  const state=JSON.parse(raw);InventoryDemoModel.validate(state);
  let result=state;
  const count=log.getLastRow()-1;
  if(count>1000)throw new Error('Este paquete demostrativo admite hasta 1.000 operaciones. Revisá el diseño de persistencia antes de ampliar el uso.');
  if(count>0){
    log.getRange(2,1,count,5).getValues().forEach(row=>{
      const a=JSON.parse(row[4]);
      if(Number(row[0])!==result.revision+1)throw new Error('El registro de operaciones tiene una secuencia inconsistente.');
      result=InventoryDemoModel.apply(result,a);
    });
  }
  return result;
}

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
