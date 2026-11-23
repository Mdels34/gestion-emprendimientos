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
class Sheet{
 constructor(name,book){this.name=name;this.book=book;this.rows=[];}
 setName(name){delete this.book.sheets[this.name];this.name=name;this.book.sheets[name]=this;return this;}
 getLastRow(){return this.rows.length;}
 clearContents(){this.rows=[];return this;}
 appendRow(row){this.rows.push(row.slice());return this;}
 setFrozenRows(){return this;}autoResizeColumns(){return this;}
 getRange(row,col,numRows=1,numCols=1){const self=this;return {
  setValues(values){values.forEach((r,i)=>r.forEach((v,j)=>{self.rows[row-1+i]||=[];self.rows[row-1+i][col-1+j]=v;}));return this;},
  getValue(){return self.rows[row-1]?.[col-1]||'';},
  getValues(){return Array.from({length:numRows},(_,i)=>Array.from({length:numCols},(_,j)=>self.rows[row-1+i]?.[col-1+j]??''));},
  setBackground(){return this;},setFontColor(){return this;},setFontWeight(){return this;}
 };}
}
class Book{constructor(id='fake-book-id'){this.id=id;this.sheets={Hoja1:new Sheet('Hoja1',this)};}getSheets(){return Object.values(this.sheets);}getSheetByName(n){return this.sheets[n];}insertSheet(n){if(this.sheets[n])throw Error('Duplicada');return this.sheets[n]=new Sheet(n,this);}getId(){return this.id;}getName(){return 'Planilla ficticia '+this.id;}getUrl(){return 'https://docs.google.com/spreadsheets/d/'+this.id;}}
let book=new Book(),props={},email='demo@example.test',lockHeld=false;
const books={};books[book.id]=book;
const context={InventoryDemoModel:M,console:{log(){},error(){}},Session:{getEffectiveUser:()=>({getEmail:()=>email}),getActiveUser:()=>({getEmail:()=>email})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperties:o=>Object.assign(props,o)})},SpreadsheetApp:{getActiveSpreadsheet:()=>book,openById:id=>{if(!books[id])throw Error('Sin acceso a esa hoja');return books[id];},create:()=>{const b=new Book('generated-book-id');books[b.id]=b;return b;},flush(){}},LockService:{getScriptLock:()=>({waitLock(){assert.equal(lockHeld,false);lockHeld=true;},releaseLock(){lockHeld=false;}})}};
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
console.log(JSON.stringify({passed:checks,model:'reservas, movimientos, entregas, devoluciones, cobros y alta de cliente dentro del pedido',appsScript:'simulado: identidad, bloqueo, revisión, reintentos y persistencia de operaciones'}));
