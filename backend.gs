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
