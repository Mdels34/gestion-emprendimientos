# Arquitectura · demo 0.4 + Fase 1

Actualizado: 23/11/2026, America/Montevideo. Implementación local y backend simulado; esta versión todavía no se probó en Sheets real.

## Componentes

| Archivo | Responsabilidad |
|---|---|
| `model.js` | Reglas puras compartidas entre navegador, Node y Apps Script. Sin cambios. |
| `app.js`, `ui.html` | Interfaz y exportaciones. Sin cambios. |
| `backend.gs` | Autorización, bloqueo, registro, snapshots, archivo y vistas de Sheets. |
| `build.py` | Genera HTML, Apps Script y paquetes. Incluye los auxiliares de QA de esta fase. |
| `qa/checks.js` | Las 115 comprobaciones anteriores más pruebas de persistencia y fallos. |
| `qa/sheets-mock.js`, `qa/fixtures.js` | Simulación de Sheets e historial ficticio reproducible. |
| `qa/benchmark.js` | Lecturas con 1.000, 2.000 y 4.000 operaciones y comparación profunda. |

El HTML autónomo sigue usando `localStorage`. Los snapshots corresponden exclusivamente al backend de Sheets. La interfaz conectada sigue llamando a `getAppState`, `runAppAction` y `connectAppSheet` mediante `google.script.run`.

## Persistencia compatible

| Ubicación | Contenido |
|---|---|
| `Base!A:B` | Estado inicial original. Una celda o fragmentos de hasta 24.000 caracteres. No se reemplaza al crear snapshots. |
| `Base!D:E` | Primer espacio de snapshot: manifiesto en D1, marca en E1 y fragmentos desde D2:E2. |
| `Base!G:H` | Segundo espacio de snapshot, con el mismo formato. |
| `Operaciones` | Registro activo, con revisión, requestId y operación JSON. |
| `Operaciones archivo` | Prefijo antiguo del mismo registro, copiado y verificado antes de quitar filas activas. Se crea al archivar. |
| Las siete hojas de consulta | Vistas regenerables; no son entradas del modelo. |

La fuente de verdad sigue siendo Base inicial más el registro completo: `Operaciones archivo` + `Operaciones`. Un snapshot es una representación derivada, no un reemplazo del historial. Durante un reintento de archivo puede haber filas idénticas en ambas hojas; se identifican por revisión y no se aplican dos veces.

La instalación anterior con Base en una celda y sin snapshots se lee sin migración. El archivo automático está desactivado por defecto. El código no borra la Base inicial ni modifica contenido ajeno en los espacios reservados. Si D:E o G:H están ocupadas, crear un snapshot falla y exige liberar esos espacios manualmente, con respaldo previo.

## Escritura y confirmación de snapshots

`runAppAction` mantiene el bloqueo, la revisión esperada y la idempotencia. El orden es:

1. Reconstruir el estado. Resolver un requestId ya confirmado antes de revisar la revisión o el límite.
2. Aplicar la acción con el modelo actual, sin persistirla todavía. Una acción inválida no dispara mantenimiento.
3. Si hay 200 operaciones confirmadas desde el checkpoint, guardar **el estado anterior a la acción pendiente**. La llamada de la operación 201 crea el snapshot 200 antes de agregar la 201. Al terminar exactamente 4.000 operaciones, el checkpoint normal es 3.800 y quedan 200 por reproducir.
4. Si se activó el archivo automático, archivar únicamente el prefijo cubierto por el snapshot confirmado.
5. Agregar una fila a `Operaciones` y aplicar cambios pendientes con `flush`.
6. Regenerar vistas. Si fallan, la operación permanece guardada y se informa `viewsUpdated: false`.

Se alternan dos espacios. Antes de escribir fragmentos se invalida el manifiesto del espacio inactivo y se hace `flush`. Luego se escriben fragmentos, se hace `flush`, se releen y se validan SHA-256, JSON y reglas completas. Se confirma al final con un único manifiesto JSON que contiene formato, revisión, revisión inicial, cantidad de fragmentos y huella.

No se divide un par sustituto UTF-16 entre fragmentos. Los espacios pueden conservar distinta cantidad de filas: solo se leen las declaradas en su manifiesto.

Una escritura sin manifiesto confirmado se ignora. Un manifiesto presente pero inválido o un snapshot con huella incorrecta produce error; no se sustituye silenciosamente por uno viejo. Si falla el agregado posterior, el snapshot no contiene ni la revisión ni el requestId pendiente. Si el agregado se guardó pero falló la respuesta, repetir el mismo requestId no duplica el cambio.

`SpreadsheetApp.flush()` aplica cambios pendientes; **no ofrece una transacción de base de datos**. La secuencia reduce ventanas de inconsistencia y se verifica con fallos simulados, pero requiere prueba real y respaldo. La huella detecta cambios accidentales; no es una firma contra manipulación deliberada.

## Lectura y secuencia

`readState_` conserva su contrato y delega en `readStateInfo_`:

- Selecciona el snapshot confirmado de mayor revisión, verifica fragmentos, huella y estado completo. Si no existe, lee la Base original.
- Comprueba extremos de revisión y cantidad de filas del registro activo. Si hay archivo, comprueba que arranque después de la revisión inicial y no supere el snapshot.
- Calcula por revisión la fila inicial y lee solamente las operaciones posteriores al snapshot. Exige revisión consecutiva y un incremento por acción; un requestId repetido dentro del registro es un error.

El prefijo cubierto no se vuelve a aplicar ni se examina íntegramente en cada lectura. Su secuencia se validó al reconstruir el estado que generó el snapshot y se vuelve a revisar antes de archivar. La comprobación habitual del prefijo usa extremos y cantidad: no detecta toda edición manual de celdas históricas. Base y ambos registros deben tratarse como almacenamiento exclusivo de la app.

Tras crear el primer snapshot y con escrituras normales de esta versión, la cola es de hasta 200 operaciones. La primera lectura de una instalación antigua todavía reconstruye su registro completo; `createDemoSnapshot()` permite hacer ese trabajo explícitamente. Un fallo de mantenimiento puede exigir más replay hasta que un reintento termine el snapshot.

## Archivo recuperable

`archiveDemoOperations()` exige la cuenta instaladora y usa el mismo bloqueo. Primero fuerza un snapshot del estado confirmado y luego:

1. Verifica revisiones e inclusión de cada requestId del prefijo en el snapshot.
2. Comprueba encabezado, origen y continuidad del archivo. Compara el solapamiento existente y agrega solo el sufijo que falta.
3. Hace `flush` y relee copia y prefijo activo. Solo si coinciden quita ese prefijo mediante `deleteRows` y vuelve a hacer `flush`.

Un corte después de copiar permite completar o reutilizar la copia sin duplicados. Un corte después de quitar filas conserva snapshot y archivo. Si falta un snapshot compatible con operaciones ya archivadas, se falla cerrado: no se restaura una Base inicial desactualizada. El archivo no elimina historia ni reduce la cantidad total de celdas entre ambas hojas.

## Configuración y conexión

`GESTION_MAX_OPERACIONES`: ausente, vacío o `0` elimina el tope fijo de 1.000; un entero positivo limita la **revisión total**, no las filas activas. Un valor inválido rechaza acciones nuevas. Lecturas y reintentos ya confirmados siguen funcionando.

`GESTION_ARCHIVAR_OPERACIONES`: solo el texto exacto `true` habilita archivo automático. Activarlo exige la copia manual previa de `LEEME.md`. Los snapshots automáticos no requieren esa propiedad.

`setupPlantilla` valida Base/snapshot y cola antes de configurar el proyecto; no modifica las hojas. `connectAppSheet` conserva el origen: un destino vacío recibe el estado completo en Base troceada, incluidos requests e historia; su registro empieza después de esa revisión inicial. No copia los registros crudos anteriores al nuevo destino: quedan en la planilla de origen, que debe conservarse para auditoría. Un destino compatible usa su propia Base, snapshots y archivo. El vínculo cambia únicamente después de validar el destino.

## Reglas y pendientes

Documento y matrícula siguen como texto, y cada despacho conserva su copia de transporte. Moneda UYU y zona America/Montevideo. No se cambian fecha de referencia, devoluciones, cobros, roles ni concurrencia.

El bloqueo cubre lecturas y escrituras del mismo proyecto; no coordina proyectos distintos sobre la misma planilla. Las siete vistas siguen regenerándose y ajustando columnas por operación. El modelo sigue clonando y validando todo el estado en cada `apply`; índices y replay sin clones corresponden a la Fase 2, y vistas a la Fase 3.

Sin tope fijo no significa capacidad ilimitada. Ver `FASE_1.md` para mediciones y `LEEME.md` para respaldo, actualización, prueba real y recuperación.
