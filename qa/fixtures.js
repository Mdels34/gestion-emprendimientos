// Pedidos completos ficticios: crear, preparar, listo, despachar, entregar, cobrar.
const model=require('../model.js');
function makeFixture(count){
 const initial=model.seed();
 Object.assign(initial,{revision:0,nextId:10,nextOrder:1,business:'Negocio ficticio de prueba',requests:[],orders:[],history:[],
  products:[{id:'p-prueba',sku:'SKU-PRUEBA',name:'Producto ficticio',category:'Prueba',price:100,stock:count+10,min:0}],
  customers:[{id:'c-prueba',name:'Cliente ficticio',phone:'000000000',address:'Dirección ficticia',area:'Prueba',note:''}],
  movements:[{id:'m-inicial',when:'2026-11-20T12:00:00.000Z',productId:'p-prueba',qty:count+10,kind:'Ingreso inicial',ref:'Prueba',note:'Saldo ficticio'}]});
 model.validate(initial);
 const rows=[],checkpoints=new Map([[0,initial]]);let state=initial;
 for(let i=0;i<count;i++){
  const orderId='PED-'+String(Math.floor(i/6)+1).padStart(4,'0'),step=i%6;
  const operations=[['createOrder',{customerId:'c-prueba',items:[{productId:'p-prueba',qty:1}],deliveryDate:'2026-11-21',transport:{company:'Transporte ficticio',vehiclePlate:'demo-001',driverName:'Conductor ficticio',documentType:'Otro',documentNumber:'000-DEMO'}}],
   ['status',{orderId,status:'En preparación'}],['status',{orderId,status:'Listo para repartir'}],['status',{orderId,status:'En reparto'}],['status',{orderId,status:'Entregado'}],['collect',{orderId,amount:100}]];
  const [type,data]=operations[step],action={requestId:'fixture_request_'+String(i+1).padStart(6,'0'),when:new Date(Date.UTC(2026,10,20,12,0,i)).toISOString(),type,data};
  state=model.apply(state,action);rows.push([state.revision,action.requestId,action.when,type,JSON.stringify(action)]);
  if(state.revision%200===0)checkpoints.set(state.revision,state);
 }
 return {initial,rows,checkpoints,state};
}
function loadFixture(harness,fixture,revision=fixture.rows.length){
 const {book,context,env}=harness,base=book.getSheets()[0].setName('Base');
 const chunks=context.stateChunks_(JSON.stringify(fixture.initial),'DEMO_FICTICIA_V1');
 context.ensureGrid_(base,chunks.length+1,2);base.getRange(1,1,1,2).setValues([['Tipo','Contenido JSON']]);base.getRange(2,1,chunks.length,2).setValues(chunks);
 const log=book.insertSheet('Operaciones');context.ensureGrid_(log,revision+1,5);
 log.getRange(1,1,1,5).setValues([['Revisión','Solicitud','Fecha UTC','Tipo','Operación JSON']]);
 if(revision)log.getRange(2,1,revision,5).setValues(fixture.rows.slice(0,revision));
 env.reads=[];env.replayed=0;return harness;
}
module.exports={makeFixture,loadFixture};
