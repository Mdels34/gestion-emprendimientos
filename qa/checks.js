const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../model.js');let checks=0,n=0;
function check(fn){fn();checks++;}
const action=(type,data)=>({type,data,requestId:'test_request_'+(++n),when:'2026-11-20T15:00:00.000Z'});
let s=M.seed();
check(()=>assert.equal(M.validate(s),true));

// Transporte: se conserva el documento como texto y la asignación histórica al despachar.
let transportState=M.seed();
const transport={company:'Transporte de ejemplo',vehiclePlate:'demo-123',driverName:'Conductor ficticio',documentType:'CI',documentNumber:'000-DEMO-01'};
const transportAction=action('assign',{orderId:'PED-1003',transport});
transportState=M.apply(transportState,transportAction);
let transportOrder=transportState.orders.find(o=>o.id==='PED-1003');
check(()=>assert.equal(M.transportFor(transportOrder).vehiclePlate,'DEMO-123'));
check(()=>assert.equal(M.transportFor(transportOrder).documentNumber,'000-DEMO-01'));
check(()=>assert.equal(transportOrder.driver,'Conductor ficticio'));
check(()=>assert.equal(transportOrder.transportHistory.length,1));
check(()=>assert.equal(M.apply(transportState,transportAction).orders.find(o=>o.id==='PED-1003').transportHistory.length,1));
const stockBeforeTransport=transportState.products.map(p=>p.stock);
check(()=>assert.deepEqual(transportState.products.map(p=>p.stock),M.seed().products.map(p=>p.stock)));
transportState=M.apply(transportState,action('status',{orderId:'PED-1003',status:'En reparto'}));
transportOrder=transportState.orders.find(o=>o.id==='PED-1003');
check(()=>assert.equal(transportOrder.events.at(-1).transport.documentNumber,'000-DEMO-01'));
check(()=>assert.equal(transportOrder.transportHistory.length,2));
const dispatchedSnapshot=JSON.stringify(transportOrder.events.at(-1).transport);
transportState=M.apply(transportState,action('assign',{orderId:'PED-1003',transport:{...transport,company:'Otra empresa de ejemplo',vehiclePlate:'demo-456',driverName:'Otro conductor ficticio',documentNumber:'000-DEMO-02'}}));
transportOrder=transportState.orders.find(o=>o.id==='PED-1003');
check(()=>assert.equal(JSON.stringify(transportOrder.events.at(-1).transport),dispatchedSnapshot));
check(()=>assert.equal(transportOrder.transportHistory[0].transport.documentNumber,'000-DEMO-01'));
check(()=>assert.equal(transportOrder.transport.documentNumber,'000-DEMO-02'));
check(()=>assert.equal(transportState.products.find(p=>p.id==='p3').stock,stockBeforeTransport[2]-1));
check(()=>assert.throws(()=>M.apply(transportState,action('assign',{orderId:'PED-1003',transport:{documentType:'No admitido'}})),/Tipo de documento/));
check(()=>assert.throws(()=>M.apply(transportState,action('assign',{orderId:'PED-1003',transport:{driverName:''}})),/nombre del conductor/));
check(()=>assert.equal(M.transportFor({driver:'Conductor de versión anterior'}).driverName,'Conductor de versión anterior'));
const withTransport=M.apply(M.seed(),action('createOrder',{customerId:'c1',items:[{productId:'p1',qty:1}],deliveryDate:'2026-11-21',transport}));
check(()=>assert.equal(withTransport.orders[0].transport.company,'Transporte de ejemplo'));

// Alta desde el pedido: una sola operación, sin clientes sueltos si falla la reserva.
const initial=M.seed(),newCustomer={name:'Cliente nuevo de prueba',phone:'099000909',address:'Dirección ficticia 909',area:'Prueba'};
const combinedAction=action('createOrder',{newCustomer,items:[{productId:'p1',qty:2}],paid:100,deliveryDate:'2026-11-21',driver:'Repartidor de prueba',note:'Conservar observación'});
const combined=M.apply(initial,combinedAction),newOrder=combined.orders[0],created=combined.customers.find(c=>c.id===newOrder.customerId);
check(()=>assert.equal(combined.customers.length,initial.customers.length+1));
check(()=>assert.equal(created.name,newCustomer.name));
check(()=>assert.equal(newOrder.paid,100));
check(()=>assert.equal(newOrder.note,'Conservar observación'));
check(()=>assert.equal(M.available(combined,'p1'),M.available(initial,'p1')-2));
check(()=>assert.equal(combined.revision,initial.revision+1));
check(()=>assert.deepEqual(M.apply(combined,combinedAction),combined));
check(()=>assert.throws(()=>M.apply(initial,action('createOrder',{newCustomer,items:[{productId:'p1',qty:9999}],deliveryDate:'2026-11-21'})),/insuficiente/));
check(()=>assert.equal(initial.customers.length,8));
check(()=>assert.throws(()=>M.apply(initial,action('createOrder',{newCustomer:{...newCustomer,phone:'099 000 101'},items:[{productId:'p1',qty:1}],deliveryDate:'2026-11-21'})),/clientes registrados/));
check(()=>assert.throws(()=>M.apply(initial,action('createOrder',{newCustomer,customerId:'c1',items:[{productId:'p1',qty:1}],deliveryDate:'2026-11-21'})),/registrado o ingresá/));
check(()=>s.products.forEach(p=>assert.equal(p.stock,s.movements.filter(x=>x.productId===p.id).reduce((n,x)=>n+x.qty,0))));
check(()=>assert.equal(s.products.reduce((n,p)=>n+M.available(s,p.id),0),146));
const before=M.clone(s),a=action('createOrder',{customerId:'c1',items:[{productId:'p1',qty:2}],paid:0,deliveryDate:'2026-11-21',driver:'Demo'});
s=M.apply(s,a);let id=s.orders[0].id;
check(()=>assert.equal(s.products[0].stock,before.products[0].stock));
check(()=>assert.equal(M.available(s,'p1'),M.available(before,'p1')-2));
check(()=>assert.equal(before.orders.length+1,s.orders.length));
check(()=>assert.deepEqual(M.apply(s,a),s));
check(()=>assert.throws(()=>M.apply(s,action('createOrder',{customerId:'c1',items:[{productId:'p1',qty:20},{productId:'p1',qty:20}],deliveryDate:'2026-11-21'})),/insuficiente/));
check(()=>assert.throws(()=>M.apply(s,action('createOrder',{customerId:'c1',items:[{productId:'p1',qty:0}],deliveryDate:'2026-11-21'})),/Cantidad/));
check(()=>assert.throws(()=>M.apply(s,action('createOrder',{customerId:'c1',items:[{productId:'p1',qty:1}],deliveryDate:'2026-02-30'})),/Fecha/));
check(()=>assert.throws(()=>M.apply(s,action('status',{orderId:id,status:'Entregado'})),/permitido/));
s=M.apply(s,action('status',{orderId:id,status:'En preparación'}));
s=M.apply(s,action('status',{orderId:id,status:'Listo para repartir'}));
const availableBefore=M.available(s,'p1'),physicalBefore=s.products[0].stock,transitBefore=M.transit(s,'p1');
s=M.apply(s,action('status',{orderId:id,status:'En reparto'}));
check(()=>assert.equal(s.products[0].stock,physicalBefore-2));
check(()=>assert.equal(M.available(s,'p1'),availableBefore));
check(()=>assert.equal(M.transit(s,'p1'),transitBefore+2));
check(()=>assert.throws(()=>M.apply(s,action('status',{orderId:id,status:'No entregado'})),/motivo/));
s=M.apply(s,action('status',{orderId:id,status:'No entregado',note:'Cliente ausente'}));
check(()=>assert.equal(s.products[0].stock,physicalBefore-2));
check(()=>assert.equal(M.transit(s,'p1'),transitBefore+2));
s=M.apply(s,action('status',{orderId:id,status:'En reparto'}));
check(()=>assert.equal(s.products[0].stock,physicalBefore-2));
s=M.apply(s,action('status',{orderId:id,status:'Devuelto',note:'Recibidas las dos unidades'}));
check(()=>assert.equal(s.products[0].stock,physicalBefore));
check(()=>assert.equal(M.transit(s,'p1'),transitBefore));
check(()=>assert.throws(()=>M.apply(s,action('status',{orderId:id,status:'Devuelto',note:'Duplicado'})),/permitido/));
const r=M.reserved(s,'p2');s=M.apply(s,action('status',{orderId:'PED-1006',status:'Cancelado'}));
check(()=>assert.equal(M.reserved(s,'p2'),r-2));
check(()=>assert.throws(()=>M.apply(s,action('status',{orderId:'PED-1005',status:'Cancelado'})),/cobros/));
check(()=>assert.throws(()=>M.apply(s,action('movement',{productId:'p4',kind:'Ajuste negativo',qty:7,note:'Recuento'})),/reservadas/));
check(()=>assert.throws(()=>M.apply(s,action('addProduct',{sku:'TER-001',name:'Repetido',price:10,stock:0,min:0})),/código/));
const due=M.due(s.orders.find(o=>o.id==='PED-1004'));
s=M.apply(s,action('collect',{orderId:'PED-1004',amount:100}));
check(()=>assert.equal(M.due(s.orders.find(o=>o.id==='PED-1004')),due-100));
check(()=>assert.throws(()=>M.apply(s,action('collect',{orderId:'PED-1004',amount:99999})),/supera/));
check(()=>assert.throws(()=>M.apply(s,action('addCustomer',{name:'Otro',phone:'099000101',address:'Demo'})),/teléfono/));
s=M.apply(s,action('addProduct',{sku:'NEW1',name:'Producto demo',price:10.5,stock:10,min:2}));
check(()=>assert.equal(s.products.at(-1).stock,10));
check(()=>assert.equal(M.validate(s),true));

// Ejecución de Apps Script con planilla simulada: autenticación, concurrencia e idempotencia.
const {Sheet,Book,utilities,createHarness}=require('./sheets-mock.js');
let book=new Book(),props={},email='demo@example.test',lockHeld=false;
const books={};books[book.id]=book;
const context={InventoryDemoModel:M,Utilities:utilities,console:{log(){},error(){}},Session:{getEffectiveUser:()=>({getEmail:()=>email}),getActiveUser:()=>({getEmail:()=>email})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperties:o=>Object.assign(props,o)})},SpreadsheetApp:{getActiveSpreadsheet:()=>book,openById:id=>{if(!books[id])throw Error('Sin acceso a esa hoja');return books[id];},create:()=>{const b=new Book('generated-book-id');books[b.id]=b;return b;},flush(){}},LockService:{getScriptLock:()=>({waitLock(){assert.equal(lockHeld,false);lockHeld=true;},releaseLock(){lockHeld=false;}})}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../backend.gs','utf8'),context);
context.setupDemo();
check(()=>assert.equal(book.getSheets().length,9));
check(()=>assert.equal(context.getAppState().state.revision,0));
check(()=>assert.throws(()=>context.setupDemo(),/ya está/));
email='intruso@example.test';check(()=>assert.throws(()=>context.getAppState(),/no autorizado/));
email='';check(()=>assert.throws(()=>context.getAppState(),/no autorizado/));email='demo@example.test';
const serverAction=action('createOrder',{customerId:'c1',items:[{productId:'p1',qty:1}],deliveryDate:'2026-11-21',driver:'Demo'});
const response=context.runAppAction(0,serverAction);
check(()=>assert.equal(response.state.revision,1));
check(()=>assert.equal(context.runAppAction(0,serverAction).state.revision,1));
check(()=>assert.equal(book.getSheetByName('Operaciones').rows.length,2));
check(()=>assert.throws(()=>context.runAppAction(0,action('collect',{orderId:'PED-1004',amount:10})),/desactualizados/));
check(()=>assert.equal(lockHeld,false));
// Si falla una vista, la operación confirmada sigue disponible al reconstruir el estado.
const originalProject=context.projectViews_;context.projectViews_=()=>{throw Error('Falla de vista');};
const committed=context.runAppAction(1,action('collect',{orderId:'PED-1004',amount:10}));
check(()=>assert.equal(committed.viewsUpdated,false));
check(()=>assert.equal(context.getAppState().state.orders.find(o=>o.id==='PED-1004').paid,510));
context.projectViews_=originalProject;context.regenerateDemoViews();
const cloudCombined=context.runAppAction(2,combinedAction);
check(()=>assert.equal(cloudCombined.state.customers.length,9));
check(()=>assert.equal(cloudCombined.state.customers.find(c=>c.id===cloudCombined.state.orders[0].customerId).name,newCustomer.name));
check(()=>assert.equal(context.runAppAction(2,combinedAction).state.customers.length,9));
const logCount=book.getSheetByName('Operaciones').getLastRow();
check(()=>assert.throws(()=>context.runAppAction(3,action('createOrder',{newCustomer:{...newCustomer,phone:'099000910'},items:[{productId:'p1',qty:99999}],deliveryDate:'2026-11-21'})),/insuficiente/));
check(()=>assert.equal(context.getAppState().state.customers.length,9));
check(()=>assert.equal(book.getSheetByName('Operaciones').getLastRow(),logCount));
const cloudTransport=context.runAppAction(3,transportAction);
check(()=>assert.equal(cloudTransport.state.orders.find(o=>o.id==='PED-1003').transport.documentNumber,'000-DEMO-01'));
const orderView=book.getSheetByName('Pedidos').rows,documentColumn=orderView[0].indexOf('Número de documento');
check(()=>assert.equal(orderView.find(row=>row[0]==='PED-1003')[documentColumn],'000-DEMO-01'));
check(()=>assert.equal(book.getSheetByName('Historial transporte').rows.at(-1).length,8));

// Vínculo con Sheets: solo propietario, copia a hoja vacía y rechazo sin sobrescribir datos ajenos.
const info=context.getAppState().connection;
check(()=>assert.equal(info.spreadsheetId,book.getId()));
check(()=>assert.equal(info.canConfigure,true));
check(()=>assert.ok(info.lastSavedAt));
const originalBookId=book.id,newBook=new Book('new-empty-book-id');books[newBook.id]=newBook;
const migrated=context.connectAppSheet(newBook.getUrl(),originalBookId);
check(()=>assert.equal(migrated.connection.spreadsheetId,newBook.id));
check(()=>assert.equal(migrated.state.orders.find(o=>o.id==='PED-1003').transport.documentNumber,'000-DEMO-01'));
check(()=>assert.equal(books[originalBookId].getSheetByName('Operaciones').getLastRow(),logCount+1));
check(()=>assert.equal(context.getAppState().state.revision,4));
const savedOnNewSheet=context.runAppAction(4,action('collect',{orderId:'PED-1004',amount:10}));
check(()=>assert.equal(savedOnNewSheet.state.revision,5));
check(()=>assert.equal(context.getAppState().state.orders.find(o=>o.id==='PED-1004').paid,520));
check(()=>assert.equal(books[originalBookId].getSheetByName('Operaciones').getLastRow(),logCount+1));
check(()=>assert.throws(()=>context.connectAppSheet(originalBookId,originalBookId),/otra ventana/));
const foreign=new Book('foreign-data-book-id');foreign.getSheets()[0].appendRow(['Información ajena']);books[foreign.id]=foreign;
check(()=>assert.throws(()=>context.connectAppSheet(foreign.getUrl(),newBook.id),/no se sobrescribió/));
check(()=>assert.equal(foreign.getSheets()[0].rows[0][0],'Información ajena'));
check(()=>assert.equal(props.GESTION_DEMO_SHEET_ID,newBook.id));
props.USUARIOS_AUTORIZADOS+='\n,other@example.test';email='other@example.test';
check(()=>assert.throws(()=>context.connectAppSheet(originalBookId,newBook.id),/Solo la cuenta instaladora/));
email='demo@example.test';const restored=context.connectAppSheet(books[originalBookId].getUrl(),newBook.id);
check(()=>assert.equal(restored.connection.spreadsheetId,originalBookId));
check(()=>assert.equal(restored.state.revision,4));
const oldBook=book,oldProps=props;book=new Book();book.getSheets()[0].appendRow(['dato existente']);props={};
check(()=>assert.throws(()=>context.setupDemo(),/completamente vacía/));
check(()=>assert.equal(book.getSheets()[0].rows[0][0],'dato existente'));
book=oldBook;props=oldProps;

// Plantilla preparada: instalar conserva el estado vacío y también operaciones previas.
const templateState=M.seed();
Object.assign(templateState,{business:'Mi emprendimiento',revision:0,nextId:1,nextOrder:1,requests:[],products:[],customers:[],orders:[],movements:[],history:[]});
book=new Book('prepared-template-id');books[book.id]=book;props={};
const templateBase=book.getSheets()[0].setName('Base');
templateBase.appendRow(['Tipo','Contenido JSON']).appendRow(['DEMO_FICTICIA_V1',JSON.stringify(templateState)]);
book.insertSheet('Operaciones').appendRow(['Revisión','Solicitud','Fecha UTC','Tipo','Operación JSON']);
book.insertSheet('Inicio').appendRow(['Instrucciones']);
const originalBase=JSON.stringify(templateBase.rows);
check(()=>assert.equal(context.setupPlantilla().ok,true));
check(()=>assert.equal(JSON.stringify(templateBase.rows),originalBase));
check(()=>assert.equal(book.getSheetByName('Operaciones').getLastRow(),1));
check(()=>assert.equal(context.getAppState().state.products.length,0));
check(()=>assert.equal(context.getAppState().state.customers.length,0));
check(()=>assert.equal(context.getAppState().state.orders.length,0));
check(()=>assert.equal(book.getSheetByName('Inicio').rows[0][0],'Instrucciones'));
check(()=>assert.throws(()=>context.setupPlantilla(),/ya está configurada/));
context.runAppAction(0,action('addProduct',{sku:'DEMO-EMPTY',name:'Producto de prueba',price:10,stock:3,min:1}));
const operationsBeforeSetup=JSON.stringify(book.getSheetByName('Operaciones').rows);
props={};context.setupPlantilla();
check(()=>assert.equal(context.getAppState().state.products[0].stock,3));
check(()=>assert.equal(context.getAppState().state.revision,1));
check(()=>assert.equal(JSON.stringify(book.getSheetByName('Operaciones').rows),operationsBeforeSetup));
check(()=>assert.equal(JSON.stringify(templateBase.rows),originalBase));
props={};book=foreign;
check(()=>assert.throws(()=>context.setupPlantilla(),/no es una plantilla compatible/));
check(()=>assert.equal(Object.keys(props).length,0));
book=books['prepared-template-id'];props={};
const goodJson=templateBase.rows[1][1];templateBase.rows[1][1]='JSON inválido';
check(()=>assert.throws(()=>context.setupPlantilla()));
check(()=>assert.equal(Object.keys(props).length,0));
templateBase.rows[1][1]=goodJson;book=null;
check(()=>assert.throws(()=>context.setupPlantilla(),/Extensiones/));
check(()=>assert.equal(Object.keys(props).length,0));
book=oldBook;props=oldProps;
const originalChecks=checks;assert.equal(originalChecks,115);
const {makeFixture,loadFixture}=require('./fixtures.js');
const backendSource=fs.readFileSync(__dirname+'/../backend.gs','utf8');
const fixture=makeFixture(1001),phase1Cases=[];
const plain=value=>JSON.parse(JSON.stringify(value));
function phaseCheck(name,fn){check(()=>{try{fn();}catch(error){error.message=name+': '+error.message;throw error;}});phase1Cases.push(name);}
function scenario(revision=200){return loadFixture(createHarness(M,backendSource),fixture,revision);}
function snapshotAt(h,revision){return h.context.checkpointIfDue_(h.book,{state:fixture.checkpoints.get(revision),checkpoint:h.context.readCheckpoint_(h.book)},true);}
function failOnce(h,predicate,message='Falla ficticia de almacenamiento'){
 h.env.hook=event=>{if(predicate(event)){h.env.hook=null;throw Error(message);}};
}
function replayAll(h){
 const base=h.book.getSheetByName('Base');let state=JSON.parse(base.rows.slice(1).map(row=>String(row?.[1]||'')).join(''));
 const byRevision=new Map();
 for(const name of ['Operaciones archivo','Operaciones']){
  for(const row of (h.book.getSheetByName(name)?.rows||[]).slice(1)){
   if(byRevision.has(row[0]))assert.deepEqual(row,byRevision.get(row[0]));else byRevision.set(row[0],row);
  }
 }
 for(const row of [...byRevision.values()].sort((a,b)=>a[0]-b[0])){assert.equal(Number(row[0]),state.revision+1);state=M.apply(state,JSON.parse(row[4]));}
 return state;
}

phaseCheck('Base histórica de una celda y registro completo',()=>{
 const h=scenario(400),baseBefore=JSON.stringify(h.book.getSheetByName('Base').rows);
 assert.deepEqual(plain(h.context.readState_(h.book)),fixture.checkpoints.get(400));
 assert.equal(JSON.stringify(h.book.getSheetByName('Base').rows),baseBefore);
 assert.equal(h.book.getSheetByName('Operaciones archivo'),undefined);
});
phaseCheck('Snapshot más cola equivale al registro completo',()=>{
 const h=scenario(400);snapshotAt(h,200);h.env.replayed=0;h.env.reads=[];
 assert.deepEqual(plain(h.context.readState_(h.book)),replayAll(h));assert.equal(h.env.replayed,200);
 assert.equal(h.env.reads.filter(r=>r.sheet==='Operaciones'&&r.numColumns===5).reduce((n,r)=>n+r.numRows,0),200);
});
phaseCheck('Solo se usa el último snapshot confirmado',()=>{
 const h=scenario(600);snapshotAt(h,200);snapshotAt(h,400);h.env.replayed=0;
 assert.deepEqual(plain(h.context.readState_(h.book)),fixture.checkpoints.get(600));assert.equal(h.env.replayed,200);
 assert.equal(JSON.parse(h.book.getSheetByName('Base').rows[0][3]).revision,200);
 assert.equal(JSON.parse(h.book.getSheetByName('Base').rows[0][6]).revision,400);
});
phaseCheck('Snapshot íntegro cuando no queda cola',()=>{
 const h=scenario(400);snapshotAt(h,400);h.env.replayed=0;
 assert.deepEqual(plain(h.context.readState_(h.book)),fixture.checkpoints.get(400));assert.equal(h.env.replayed,0);
});
phaseCheck('La operación 201 crea el snapshot 200 sin alterar Base A:B',()=>{
 const h=scenario(),original=h.book.getSheetByName('Base').rows.map(row=>row.slice(0,2));
 const response=h.context.runAppAction(200,JSON.parse(fixture.rows[200][4]));
 assert.equal(response.state.revision,201);assert.equal(h.context.readCheckpoint_(h.book).revision,200);
 assert.deepEqual(h.book.getSheetByName('Base').rows.slice(0,original.length).map(row=>row.slice(0,2)),original);
 assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),202);
 assert.equal(h.book.getSheetByName('Operaciones archivo'),undefined);
});
phaseCheck('Los snapshots se trocean en 24.000 caracteres',()=>{
 const h=scenario();snapshotAt(h,200);const base=h.book.getSheetByName('Base'),meta=JSON.parse(base.rows[0][3]);
 assert.ok(meta.chunks>1);assert.ok(base.rows.slice(1,meta.chunks+1).every(row=>row[4].length<=24000));
 assert.deepEqual(plain(h.context.readState_(h.book)),fixture.checkpoints.get(200));
});
phaseCheck('El troceado conserva pares sustitutos Unicode',()=>{
 const h=scenario(0),value='x'.repeat(23999)+'😀'+'y'.repeat(24001),chunks=h.context.stateChunks_(value,'PRUEBA');
 assert.equal(chunks.map(row=>row[1]).join(''),value);assert.ok(chunks.every(row=>row[1].length<=24000));
 assert.ok(chunks.every(row=>!/[\uD800-\uDBFF]$/.test(row[1])));
});
phaseCheck('Se amplía una Base pequeña sin borrar columnas existentes',()=>{
 const h=scenario(),base=h.book.getSheetByName('Base');base.maxRows=2;base.maxColumns=2;
 snapshotAt(h,200);assert.ok(base.getMaxRows()>=3);assert.ok(base.getMaxColumns()>=8);
 assert.deepEqual(plain(h.context.readState_(h.book)),fixture.checkpoints.get(200));
});
phaseCheck('No se sobrescribe contenido ajeno en los slots de Base',()=>{
 const h=scenario(),base=h.book.getSheetByName('Base');base.getRange(3,7).setValue('Dato ficticio ajeno');
 const previous=JSON.stringify(base.rows);
 assert.throws(()=>snapshotAt(h,200),/ocupado|información|snapshot/i);
 assert.equal(JSON.stringify(base.rows),previous);
});

for(const [name,predicate] of [
 ['antes de escribir fragmentos',e=>e.method==='setValues'&&e.sheet==='Base'&&e.row===2&&e.column===4&&e.phase==='before'],
 ['después de escribir fragmentos',e=>e.method==='setValues'&&e.sheet==='Base'&&e.row===2&&e.column===4&&e.phase==='after'],
 ['antes de confirmar manifiesto',e=>e.method==='setValues'&&e.sheet==='Base'&&e.row===1&&e.column===4&&e.numColumns===1&&e.phase==='before']
])phaseCheck('Primer snapshot interrumpido '+name,()=>{
 const h=scenario();failOnce(h,predicate);assert.throws(()=>snapshotAt(h,200),/Falla ficticia/);
 assert.deepEqual(plain(h.context.readState_(h.book)),fixture.checkpoints.get(200));
 snapshotAt(h,200);assert.equal(h.context.readCheckpoint_(h.book).revision,200);
});
phaseCheck('Fallo tras confirmar el manifiesto no invalida el snapshot',()=>{
 const h=scenario();failOnce(h,e=>e.method==='setValues'&&e.sheet==='Base'&&e.row===1&&e.column===4&&e.numColumns===1&&e.phase==='after');
 assert.throws(()=>snapshotAt(h,200),/Falla ficticia/);
 assert.equal(h.context.readCheckpoint_(h.book).revision,200);assert.deepEqual(plain(h.context.readState_(h.book)),fixture.checkpoints.get(200));
});
phaseCheck('Un slot interrumpido conserva el snapshot previo',()=>{
 const h=scenario(600);snapshotAt(h,200);snapshotAt(h,400);
 failOnce(h,e=>e.method==='setValues'&&e.sheet==='Base'&&e.row===2&&e.column===4&&e.phase==='before');
 assert.throws(()=>snapshotAt(h,600),/Falla ficticia/);
 assert.equal(h.context.readCheckpoint_(h.book).revision,400);assert.deepEqual(plain(h.context.readState_(h.book)),fixture.checkpoints.get(600));
});
phaseCheck('Fallo entre snapshot y append deja pendiente el requestId',()=>{
 const h=scenario(),pending=JSON.parse(fixture.rows[200][4]);
 failOnce(h,e=>e.method==='appendRow'&&e.sheet==='Operaciones'&&e.phase==='before');
 assert.throws(()=>h.context.runAppAction(200,pending),/Falla ficticia/);
 const state=h.context.readState_(h.book);assert.equal(state.revision,200);assert.equal(state.requests.includes(pending.requestId),false);
 assert.equal(h.context.readCheckpoint_(h.book).revision,200);assert.equal(h.env.locked,false);
 assert.equal(h.context.runAppAction(200,pending).state.revision,201);
 assert.equal(h.context.runAppAction(200,pending).state.revision,201);assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),202);
});
phaseCheck('Append confirmado con respuesta fallida se reintenta sin duplicar',()=>{
 const h=scenario(),pending=JSON.parse(fixture.rows[200][4]);
 failOnce(h,e=>e.method==='appendRow'&&e.sheet==='Operaciones'&&e.phase==='after');
 assert.throws(()=>h.context.runAppAction(200,pending),/Falla ficticia/);
 assert.equal(h.context.readState_(h.book).revision,201);assert.equal(h.context.runAppAction(200,pending).state.revision,201);
 assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),202);
});
phaseCheck('Un snapshot alterado falla cerrado y conserva el registro',()=>{
 const h=scenario();snapshotAt(h,200);const base=h.book.getSheetByName('Base');base.rows[1][4]=base.rows[1][4].slice(0,-1)+'X';
 assert.throws(()=>h.context.readState_(h.book),/huella/);assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),201);
});
phaseCheck('Un manifiesto inconsistente no se omite silenciosamente',()=>{
 const h=scenario();snapshotAt(h,200);const base=h.book.getSheetByName('Base'),meta=JSON.parse(base.rows[0][3]);meta.chunks=0;base.rows[0][3]=JSON.stringify(meta);
 assert.throws(()=>h.context.readState_(h.book),/manifiesto/);
});
for(const [name,change] of [
 ['revisión intermedia duplicada',log=>{log.rows[250][0]=249;}],
 ['hueco en la cola',log=>{log.rows.splice(250,1);}],
 ['solicitud repetida en la cola',log=>{log.rows[400][4]=log.rows[399][4];}]
])phaseCheck('Secuencia: se rechaza '+name,()=>{
 const h=scenario(400);snapshotAt(h,200);change(h.book.getSheetByName('Operaciones'));
 assert.throws(()=>h.context.readState_(h.book),/secuencia|repite/);
});
phaseCheck('Se rechaza un hueco inmediatamente después del snapshot',()=>{
 const h=scenario(400);snapshotAt(h,200);h.book.getSheetByName('Operaciones').rows.splice(1,201);
 assert.throws(()=>h.context.readState_(h.book),/faltan operaciones/);
});

phaseCheck('Archivo explícito: copia, verifica y quita solo el prefijo cubierto',()=>{
 const h=scenario();const result=h.context.archiveDemoOperations();
 assert.equal(result.copied,200);assert.equal(result.removed,200);assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),1);
 assert.equal(h.book.getSheetByName('Operaciones archivo').getLastRow(),201);
 assert.deepEqual(plain(h.context.readState_(h.book)),replayAll(h));
 assert.deepEqual(plain(h.context.archiveDemoOperations()),{ok:true,revision:200,copied:0,removed:0});
});
phaseCheck('Conserva texto del documento y la copia de transporte en archivo',()=>{
 const h=scenario();h.context.archiveDemoOperations();const state=h.context.readState_(h.book);
 assert.equal(state.orders[0].transport.documentNumber,'000-DEMO');
 assert.equal(state.orders.find(o=>o.status==='Entregado').events.find(e=>e.status==='En reparto').transport.vehiclePlate,'DEMO-001');
 assert.deepEqual(plain(state),fixture.checkpoints.get(200));
});
phaseCheck('Reintento de un requestId anterior al archivo conserva revisión y cobro',()=>{
 const h=scenario();h.context.archiveDemoOperations();const before=h.context.readState_(h.book);
 const result=h.context.runAppAction(0,JSON.parse(fixture.rows[5][4]));
 assert.deepEqual(plain(result.state),plain(before));assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),1);
});
phaseCheck('Activar archivo automático no deja un registro doble',()=>{
 const h=scenario();h.env.props.GESTION_ARCHIVAR_OPERACIONES='true';
 const result=h.context.runAppAction(200,JSON.parse(fixture.rows[200][4]));
 assert.equal(result.state.revision,201);assert.equal(h.book.getSheetByName('Operaciones archivo').getLastRow(),201);
 assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),2);assert.deepEqual(plain(result.state),replayAll(h));
});
for(const phase of ['before','after'])phaseCheck('Fallo '+phase+' de copiar el archivo es reintentable',()=>{
 const h=scenario();failOnce(h,e=>e.method==='setValues'&&e.sheet==='Operaciones archivo'&&e.row===2&&e.phase===phase);
 assert.throws(()=>h.context.archiveDemoOperations(),/Falla ficticia/);
 assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),201);
 assert.deepEqual(plain(h.context.readState_(h.book)),fixture.checkpoints.get(200));
 h.context.archiveDemoOperations();assert.equal(h.book.getSheetByName('Operaciones archivo').getLastRow(),201);
 assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),1);
});
phaseCheck('Copia parcial de archivo se completa sin duplicados',()=>{
 const h=scenario();h.env.hook=e=>{
  if(e.method==='setValues'&&e.sheet==='Operaciones archivo'&&e.row===2&&e.phase==='before'){
   h.env.hook=null;h.book.getSheetByName('Operaciones archivo').rows.push(...e.values.slice(0,77).map(row=>Array.from(row)));throw Error('Copia parcial ficticia');
  }
 };
 assert.throws(()=>h.context.archiveDemoOperations(),/Copia parcial/);assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),201);
 assert.equal(h.context.archiveDemoOperations().copied,123);assert.deepEqual(plain(h.context.readState_(h.book)),replayAll(h));
});
for(const phase of ['before','after'])phaseCheck('Fallo '+phase+' de quitar filas conserva todas las operaciones',()=>{
 const h=scenario();failOnce(h,e=>e.method==='deleteRows'&&e.sheet==='Operaciones'&&e.phase===phase);
 assert.throws(()=>h.context.archiveDemoOperations(),/Falla ficticia/);
 assert.deepEqual(plain(h.context.readState_(h.book)),fixture.checkpoints.get(200));
 h.context.archiveDemoOperations();assert.equal(h.book.getSheetByName('Operaciones archivo').getLastRow(),201);
 assert.deepEqual(plain(h.context.readState_(h.book)),replayAll(h));
});
phaseCheck('Archivo verificado pero append siguiente fallido no pierde el pedido pendiente',()=>{
 const h=scenario();h.env.props.GESTION_ARCHIVAR_OPERACIONES='true';const pending=JSON.parse(fixture.rows[200][4]);
 failOnce(h,e=>e.method==='appendRow'&&e.sheet==='Operaciones'&&e.phase==='before');
 assert.throws(()=>h.context.runAppAction(200,pending),/Falla ficticia/);
 assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),1);assert.equal(h.context.readState_(h.book).revision,200);
 assert.equal(h.context.runAppAction(200,pending).state.revision,201);assert.deepEqual(plain(h.context.readState_(h.book)),replayAll(h));
});
phaseCheck('No se quitan filas cuando falla la verificación de la copia',()=>{
 const h=scenario();h.env.hook=e=>{if(e.method==='setValues'&&e.sheet==='Operaciones archivo'&&e.row===2&&e.phase==='after'){
  h.env.hook=null;h.book.getSheetByName('Operaciones archivo').rows[1][4]='Copia ficticia alterada';
 }};
 assert.throws(()=>h.context.archiveDemoOperations(),/verificar/);assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),201);
 assert.throws(()=>h.context.archiveDemoOperations(),/no coincide/);
});
phaseCheck('No se reemplaza una hoja de archivo ajena',()=>{
 const h=scenario();h.book.insertSheet('Operaciones archivo').appendRow(['Contenido ajeno de prueba']);
 assert.throws(()=>h.context.archiveDemoOperations(),/información ajena/);
 assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),201);assert.equal(h.book.getSheetByName('Operaciones archivo').rows[0][0],'Contenido ajeno de prueba');
});
phaseCheck('Quitar el último snapshot con archivo confirmado no restaura Base vieja',()=>{
 const h=scenario();h.context.archiveDemoOperations();h.book.getSheetByName('Base').rows[0][3]='';
 assert.throws(()=>h.context.readState_(h.book),/falta un snapshot/);
});
phaseCheck('Un archivo posterior al único snapshot disponible falla cerrado',()=>{
 const h=scenario(400);snapshotAt(h,200);h.context.archiveDemoOperations();h.book.getSheetByName('Base').rows[0][6]='';
 assert.throws(()=>h.context.readState_(h.book),/supera la revisión/);
});
phaseCheck('Con cuadrícula de una fila el append posterior al archivo funciona',()=>{
 const h=scenario(),log=h.book.getSheetByName('Operaciones');log.maxRows=201;h.context.archiveDemoOperations();
 assert.equal(log.getMaxRows(),1);assert.equal(h.context.runAppAction(200,JSON.parse(fixture.rows[200][4])).state.revision,201);
});
phaseCheck('setupPlantilla reconoce una instalación con snapshot y archivo sin escribir',()=>{
 const h=scenario();h.context.archiveDemoOperations();const before=JSON.stringify(h.book.getSheets().map(sh=>sh.rows));h.env.props={};
 assert.equal(h.context.setupPlantilla().revision,200);assert.equal(JSON.stringify(h.book.getSheets().map(sh=>sh.rows)),before);
 assert.deepEqual(plain(h.context.getAppState().state),fixture.checkpoints.get(200));
});
phaseCheck('connectAppSheet copia estado completo, requestIds y conserva origen archivado',()=>{
 const h=scenario();h.context.archiveDemoOperations();const source=JSON.stringify(h.book.getSheets().map(sh=>sh.rows));
 const target=new Book('target-empty-fixture-id');h.env.books[target.id]=target;
 const result=h.context.connectAppSheet(target.getUrl(),h.book.id);
 assert.equal(result.state.revision,200);assert.equal(JSON.stringify(h.book.getSheets().map(sh=>sh.rows)),source);
 assert.deepEqual(plain(h.context.getAppState().state),fixture.checkpoints.get(200));
 assert.equal(h.context.runAppAction(0,JSON.parse(fixture.rows[0][4])).state.revision,200);
 assert.equal(h.context.runAppAction(200,JSON.parse(fixture.rows[200][4])).state.revision,201);
 assert.equal(h.context.archiveDemoOperations().copied,1);assert.equal(target.getSheetByName('Operaciones archivo').rows[1][0],201);
});
phaseCheck('connectAppSheet lee otro destino con snapshot y archivo existente',()=>{
 const source=scenario(0),target=scenario();target.context.archiveDemoOperations();target.book.id='existing-snapshot-target-id';source.env.books[target.book.id]=target.book;
 const result=source.context.connectAppSheet(target.book.getUrl(),source.book.id);
 assert.deepEqual(plain(result.state),fixture.checkpoints.get(200));
});
phaseCheck('connectAppSheet rechaza un snapshot dañado sin cambiar el vínculo',()=>{
 const source=scenario(0),target=scenario();snapshotAt(target,200);target.book.id='corrupt-snapshot-target-id';source.env.books[target.book.id]=target.book;
 target.book.getSheetByName('Base').rows[1][4]='X'+target.book.getSheetByName('Base').rows[1][4].slice(1);
 assert.throws(()=>source.context.connectAppSheet(target.book.getUrl(),source.book.id),/huella/);
 assert.equal(source.env.props.GESTION_DEMO_SHEET_ID,source.book.id);
});
phaseCheck('Dos tandas de archivo conservan la secuencia y las copias previas',()=>{
 const h=scenario(600);snapshotAt(h,200);h.context.archiveCoveredOperations_(h.book,h.context.readCheckpoint_(h.book));
 snapshotAt(h,400);const result=h.context.archiveCoveredOperations_(h.book,h.context.readCheckpoint_(h.book));
 assert.equal(result.copied,200);assert.equal(result.removed,200);
 assert.equal(h.book.getSheetByName('Operaciones archivo').rows[400][0],400);
 assert.equal(h.book.getSheetByName('Operaciones').rows[1][0],401);assert.deepEqual(plain(h.context.readState_(h.book)),replayAll(h));
});
phaseCheck('Un prefijo parcialmente quitado se termina sin duplicar archivo',()=>{
 const h=scenario();h.env.hook=e=>{
  if(e.method==='deleteRows'&&e.sheet==='Operaciones'&&e.phase==='before'){
   h.env.hook=null;h.book.getSheetByName('Operaciones').deleteRows(2,77);throw Error('Borrado parcial ficticio');
  }
 };
 assert.throws(()=>h.context.archiveDemoOperations(),/Borrado parcial/);
 assert.deepEqual(plain(h.context.readState_(h.book)),fixture.checkpoints.get(200));
 const result=h.context.archiveDemoOperations();assert.equal(result.copied,0);assert.equal(result.removed,123);
 assert.deepEqual(plain(h.context.readState_(h.book)),replayAll(h));
});
phaseCheck('El archivo no quita un prefijo con secuencia intermedia alterada',()=>{
 const h=scenario();snapshotAt(h,200);h.book.getSheetByName('Operaciones').rows[100][0]=99;
 assert.throws(()=>h.context.archiveDemoOperations(),/secuencia/);assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),201);
});
phaseCheck('Un encabezado de snapshot perdido no se ignora',()=>{
 const h=scenario();snapshotAt(h,200);h.book.getSheetByName('Base').rows[0][4]='';
 assert.throws(()=>h.context.readState_(h.book),/encabezado/);
});
for(const at of [1,2,3])phaseCheck('Fallo de flush '+at+' durante snapshot conserva un estado completo',()=>{
 const h=scenario();let calls=0;failOnce(h,e=>e.method==='flush'&&++calls===at);
 assert.throws(()=>h.context.createDemoSnapshot(),/Falla ficticia/);assert.equal(h.env.locked,false);
 assert.deepEqual(plain(h.context.readState_(h.book)),fixture.checkpoints.get(200));
 assert.equal(h.context.createDemoSnapshot().revision,200);
});
phaseCheck('Mantenimiento manual exige la cuenta instaladora',()=>{
 const h=scenario();h.env.email='operador@example.test';h.env.props.USUARIOS_AUTORIZADOS+=','+h.env.email;
 assert.throws(()=>h.context.createDemoSnapshot(),/Solo la cuenta instaladora/);
 assert.throws(()=>h.context.archiveDemoOperations(),/Solo la cuenta instaladora/);assert.equal(h.env.locked,false);
});
phaseCheck('Sin tope fijo se leen más de 1.000 operaciones antiguas',()=>{
 const h=scenario(1001);assert.deepEqual(plain(h.context.readState_(h.book)),fixture.state);
 snapshotAt(h,1000);h.env.replayed=0;assert.deepEqual(plain(h.context.readState_(h.book)),fixture.state);assert.equal(h.env.replayed,1);
});
phaseCheck('Sin tope fijo una instalación antigua puede guardar la operación 1.002',()=>{
 const h=scenario(1001),pending=action('collect',{orderId:'PED-0167',amount:100});
 const result=h.context.runAppAction(1001,pending);
 assert.equal(result.state.revision,1002);assert.equal(result.state.orders[0].paid,100);
 assert.equal(h.context.getAppState().state.revision,1002);
 assert.equal(h.context.runAppAction(1001,pending).state.revision,1002);
});
phaseCheck('El tope configurable bloquea acciones nuevas pero permite reintentos',()=>{
 const h=scenario();h.env.props.GESTION_MAX_OPERACIONES='200';
 assert.throws(()=>h.context.runAppAction(200,JSON.parse(fixture.rows[200][4])),/límite configurado/);
 assert.equal(h.context.runAppAction(0,JSON.parse(fixture.rows[0][4])).state.revision,200);
 h.env.props.GESTION_MAX_OPERACIONES='0';assert.equal(h.context.runAppAction(200,JSON.parse(fixture.rows[200][4])).state.revision,201);
});
phaseCheck('Configuración de límite inválida se rechaza antes de guardar',()=>{
 const h=scenario();for(const value of ['-1','2.5','no-es-numero']){
  h.env.props.GESTION_MAX_OPERACIONES=value;assert.throws(()=>h.context.runAppAction(200,JSON.parse(fixture.rows[200][4])),/entero no negativo/);
 }assert.equal(h.book.getSheetByName('Operaciones').getLastRow(),201);
});
phaseCheck('Una acción inválida no provoca mantenimiento ni archivo',()=>{
 const h=scenario();h.env.props.GESTION_ARCHIVAR_OPERACIONES='true';
 assert.throws(()=>h.context.runAppAction(200,action('movement',{productId:'p-prueba',kind:'Ajuste negativo',qty:99999,note:'Prueba'})),/reservadas/);
 assert.equal(h.context.readCheckpoint_(h.book).column,null);assert.equal(h.book.getSheetByName('Operaciones archivo'),undefined);
});
phaseCheck('Fallo de vistas después de snapshot y archivo mantiene la operación',()=>{
 const h=scenario();h.env.props.GESTION_ARCHIVAR_OPERACIONES='true';h.context.projectViews_=()=>{throw Error('Vista ficticia fallida');};
 assert.equal(h.context.runAppAction(200,JSON.parse(fixture.rows[200][4])).viewsUpdated,false);
 assert.equal(h.context.getAppState().state.revision,201);assert.deepEqual(plain(h.context.readState_(h.book)),replayAll(h));
});

console.log(JSON.stringify({passed:checks,existing:originalChecks,phase1:phase1Cases.length,
 model:'sin cambios de reglas; reservas, transporte y cobros preservados',
 appsScript:'simulado: snapshots, secuencia, archivo, fallos y compatibilidad; no probado en Sheets real'}));
