// Solo datos ficticios. Mide readState_, sin red, interfaz ni vistas.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const model=require('../model.js');
const {createHarness}=require('./sheets-mock.js');
const {makeFixture,loadFixture}=require('./fixtures.js');
const source=fs.readFileSync(path.join(__dirname,'../backend.gs'),'utf8');
const sizes=[1000,2000,4000],fixture=makeFixture(Math.max(...sizes));
const plain=value=>JSON.parse(JSON.stringify(value));
const round=value=>Math.round(value*100)/100;
const report={phase:1,runtime:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},
 scope:'Node + Sheets simulado; lectura, SHA-256, JSON, validación completa y replay. Sin latencia de Google ni vistas.',
 methodology:'Un fixture de 4.000 operaciones; prefijos de 1.000/2.000/4.000. Una lectura completa y tres con snapshot (mediana), sin warmup explícito.',
 target:{maxReplayed:200,maxMilliseconds:300,requiredAfterPhase:3},results:[]};
function measure(h){
 h.env.replayed=0;h.env.reads=[];
 const started=performance.now(),state=h.context.readState_(h.book),milliseconds=performance.now()-started;
 const operationRowsRead=h.env.reads.filter(e=>e.sheet==='Operaciones'&&e.numColumns===5).reduce((sum,e)=>sum+e.numRows,0);
 return {state,milliseconds,replayed:h.env.replayed,operationRowsRead};
}
for(const count of sizes){
 const h=loadFixture(createHarness(model,source),fixture,count),full=measure(h);
 assert.equal(full.replayed,count);assert.deepEqual(plain(full.state),fixture.checkpoints.get(count));
 // La operación N+1 toma el snapshot de N. Al terminar exactamente un múltiplo
 // de 200, el checkpoint normal más reciente está 200 operaciones atrás.
 const revision=count-200;
 const checkpoint=h.context.checkpointIfDue_(h.book,{state:fixture.checkpoints.get(revision),checkpoint:h.context.readCheckpoint_(h.book)},true);
 const samples=[];
 for(let i=0;i<3;i++){
  const measured=measure(h);assert.ok(measured.replayed<=200);assert.ok(measured.operationRowsRead<=200);
  assert.deepEqual(plain(measured.state),plain(full.state));samples.push(measured.milliseconds);
 }
 // El archivado es mantenimiento: se mide aparte de la lectura.
 const archiveStart=performance.now(),archive=h.context.archiveCoveredOperations_(h.book,checkpoint),archiveMilliseconds=performance.now()-archiveStart;
 const archived=measure(h);assert.ok(archived.replayed<=200);assert.deepEqual(plain(archived.state),plain(full.state));
 const median=[...samples].sort((a,b)=>a-b)[1];
 const result={operations:count,completedOrders:Math.floor(count/6),remainingOrderOperations:count%6,snapshotRevision:revision,
  fullReplay:{milliseconds:round(full.milliseconds),operations:full.replayed},
  snapshot:{medianMilliseconds:round(median),samplesMilliseconds:samples.map(round),replayed:count-revision,deepEqual:true},
  archived:{milliseconds:round(archived.milliseconds),replayed:archived.replayed,deepEqual:true,copied:archive.copied,maintenanceMilliseconds:round(archiveMilliseconds)},
  targetMillisecondsMet:median<300};
 report.results.push(result);console.log(JSON.stringify(result));
}
const outputIndex=process.argv.indexOf('--output');
if(outputIndex>=0){
 assert.ok(process.argv[outputIndex+1],'Indicá el archivo después de --output.');
 fs.writeFileSync(process.argv[outputIndex+1],JSON.stringify(report,null,2)+'\n','utf8');
}
console.log('Comparación profunda y máximo de 200 operaciones: validados en Node con backend simulado. Tiempos de Sheets real: pendientes.');
