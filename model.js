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
