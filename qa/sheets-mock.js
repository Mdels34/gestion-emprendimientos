// Simulación local de Sheets; no llama a Google ni utiliza datos reales.
const assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');

class Sheet {
 constructor(name,book){this.name=name;this.book=book;this.rows=[];this.maxRows=1000;this.maxColumns=26;}
 emit(method,phase,details={}){if(this.book.onCall)this.book.onCall({method,phase,sheet:this.name,...details});}
 setName(name){delete this.book.sheets[this.name];this.name=name;this.book.sheets[name]=this;return this;}
 getLastRow(){return this.rows.length;}
 getMaxRows(){return this.maxRows;} getMaxColumns(){return this.maxColumns;}
 insertRowsAfter(position,count){assert.ok(position>0&&position<=this.maxRows&&count>0);this.maxRows+=count;return this;}
 insertColumnsAfter(position,count){assert.ok(position>0&&position<=this.maxColumns&&count>0);this.maxColumns+=count;return this;}
 clearContents(){this.rows=[];return this;}
 appendRow(row){
  const details={row:this.rows.length+1,column:1,values:[row]};this.emit('appendRow','before',details);
  this.rows.push(Array.from(row));this.maxRows=Math.max(this.maxRows,this.rows.length);
  this.emit('appendRow','after',details);return this;
 }
 deleteRows(position,count){
  assert.ok(position>0&&count>0&&position+count-1<=this.maxRows&&count<this.maxRows);
  const details={row:position,count};this.emit('deleteRows','before',details);
  this.rows.splice(position-1,count);this.maxRows-=count;this.emit('deleteRows','after',details);
 }
 setFrozenRows(){return this;}autoResizeColumns(){return this;}
 getRange(row,column,numRows=1,numColumns=1){
  assert.ok(row>0&&column>0&&numRows>0&&numColumns>0);
  assert.ok(row+numRows-1<=this.maxRows&&column+numColumns-1<=this.maxColumns,'El rango supera la cuadrícula simulada.');
  const self=this,details={row,column,numRows,numColumns};
  const range={
   setValues(values){
    assert.equal(values.length,numRows);values.forEach(r=>assert.equal(r.length,numColumns));
    self.emit('setValues','before',{...details,values});
    values.forEach((r,i)=>r.forEach((v,j)=>{self.rows[row-1+i]||=[];self.rows[row-1+i][column-1+j]=v;}));
    self.emit('setValues','after',{...details,values});return this;
   },
   setValue(value){assert.equal(numRows*numColumns,1);return this.setValues([[value]]);},
   getValue(){self.emit('getValue','before',details);return self.rows[row-1]?.[column-1]??'';},
   getValues(){self.emit('getValues','before',details);return Array.from({length:numRows},(_,i)=>Array.from({length:numColumns},(_,j)=>self.rows[row-1+i]?.[column-1+j]??''));},
   setNumberFormat(){return this;},setBackground(){return this;},setFontColor(){return this;},setFontWeight(){return this;}
  };return range;
 }
}
class Book {
 constructor(id='fake-book-id'){this.id=id;this.sheets={Hoja1:new Sheet('Hoja1',this)};this.onCall=null;}
 getSheets(){return Object.values(this.sheets);} getSheetByName(name){return this.sheets[name];}
 insertSheet(name){if(this.sheets[name])throw Error('Duplicada');return this.sheets[name]=new Sheet(name,this);}
 getId(){return this.id;}getName(){return 'Planilla ficticia '+this.id;}
 getUrl(){return 'https://docs.google.com/spreadsheets/d/'+this.id;}
}
const utilities={DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},computeDigest(algorithm,value,charset){
 assert.equal(algorithm,'SHA_256');assert.equal(charset,'UTF_8');
 return Array.from(crypto.createHash('sha256').update(value,'utf8').digest(),b=>b>127?b-256:b);
}};

function createHarness(model,source){
 const book=new Book('fixture-book-id');
 const env={book,books:{[book.id]:book},email:'propietario@example.test',props:{GESTION_DEMO_SHEET_ID:book.id,USUARIOS_AUTORIZADOS:'propietario@example.test',GESTION_DEMO_OWNER_EMAIL:'propietario@example.test'},locked:false,hook:null,errors:[],replayed:0,reads:[]};
 book.onCall=event=>{if(event.method==='getValues')env.reads.push(event);if(env.hook)env.hook(event);};
 const context={InventoryDemoModel:{...model,apply(...args){env.replayed++;return model.apply(...args);}},Utilities:utilities,
  console:{log(){},error(message){env.errors.push(message);}},
  Session:{getEffectiveUser:()=>({getEmail:()=>env.email}),getActiveUser:()=>({getEmail:()=>env.email})},
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>env.props[key],setProperties:values=>Object.assign(env.props,values)})},
  SpreadsheetApp:{getActiveSpreadsheet:()=>env.book,openById:id=>{if(!env.books[id])throw Error('Sin acceso a esa hoja');return env.books[id];},create:()=>{const b=new Book('generated-fixture-id');env.books[b.id]=b;return b;},flush(){if(env.hook)env.hook({method:'flush',phase:'after'});}},
  LockService:{getScriptLock:()=>({waitLock(){assert.equal(env.locked,false);env.locked=true;},releaseLock(){env.locked=false;}})}
 };
 vm.createContext(context);vm.runInContext(source,context);
 return {book,env,context};
}
module.exports={Sheet,Book,utilities,createHarness};
