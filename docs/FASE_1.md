# Entrega de Fase 1 · snapshots y archivo

Fecha: 23/11/2026, America/Montevideo. Base de implementación: commit `238976f5a583fe49a71bcd80c328054df3aaaee5`. Rama: `feat/fase-1-snapshots-archivo`.

## 1. Plan aplicado y riesgos

Conservar Base inicial, agregar dos espacios alternados de snapshot, reconstruir únicamente la cola y archivar solo después de confirmar y releer la copia. El archivo es manual por defecto: no hay recorte automático de instalaciones existentes sin activación expresa.

No cambian reglas, interfaz, fechas, cobros ni política de concurrencia. `flush` no es una transacción. El bloqueo protege un solo proyecto Apps Script. Ediciones manuales del historial, cuotas, interrupciones reales del servicio y latencia de Google requieren respaldo y prueba en una copia. Un snapshot corrupto produce error, no recuperación silenciosa. El archivo conserva el volumen total de historia dentro de la misma planilla.

Los checkpoints se toman antes de agregar la operación siguiente al bloque: el de revisión 200 se confirma durante la llamada 201, sobre el estado ya guardado. Esto evita incluir una acción pendiente que después no pueda agregarse. `createDemoSnapshot()` permite tomar uno explícito sin quitar filas.

## 2. Archivos modificados

| Archivo | Cambio |
|---|---|
| `backend.gs` | Snapshot alternado y troceado, huella, lectura de cola, archivo verificable, límite configurable y mantenimiento del instalador. |
| `qa/checks.js` | Conserva las 115 comprobaciones y agrega 55 para esta fase. |
| `qa/sheets-mock.js` | Simulación compartida e inyección de fallos de escritura. |
| `qa/fixtures.js` | Pedidos ficticios y registro reproducible de seis acciones por pedido. |
| `qa/benchmark.js` | Comparación profunda y tiempos con 1.000, 2.000 y 4.000 operaciones. |
| `qa/benchmark-fase1.json` | Evidencia de la ejecución local. |
| `build.py` | Solo agrega al paquete los nuevos archivos de QA y documentación, necesarios para que el paquete siga siendo ejecutable. Las demás correcciones quedan para Fase 7. |
| `Google_Apps_Script/Code.gs` | Regenerado desde modelo y backend; sin edición manual. |
| `ARQUITECTURA.md`, `ALCANCE.md`, `LEEME.md`, `README.md`, `CONTINUIDAD.md` | Formato, alcance, actualización, límites y continuidad. |

`model.js`, `app.js`, `ui.html`, `demo.html`, el PDF y el ZIP histórico no cambian. El PDF y ZIP están identificados como presentación de la versión anterior; la persistencia actual se documenta aquí.

## 3. Pruebas y benchmark

Ejecutado en Node v24.22.3, backend simulado, solo datos ficticios:

- `node qa/checks.js`: **170 aprobadas**, 115 originales + 55 nuevas.
- Igualdad profunda entre replay completo, snapshot más cola y snapshot más cola con archivo.
- Base antigua, trozos de 24.000 caracteres, Unicode, selección de snapshot, huella y secuencia.
- Fallos antes/después de fragmentos, confirmación, flush, append, copia y retiro de filas; copia y retiro parciales, reintento sin duplicados y preservación del bloqueo.
- RequestId confirmado antes o después de archivar; mismo cobro y revisión.
- `setupPlantilla` sin cambios de celdas; `connectAppSheet` a destino vacío o compatible, incluso con revisión inicial distinta de cero; destino corrupto no cambia vínculo.
- Límite opcional, autorización de mantenimiento y operación persistida aunque fallen las vistas.
- `python3 build.py`: aprobado; Code.gs e Index.html generados coinciden con sus fuentes. El paquete de código se extrajo y ejecutó con QA para verificar sus dependencias.

```bash
node qa/benchmark.js --output qa/benchmark-fase1.json
```

| Operaciones | Replay completo, ms | Con snapshot, mediana ms | Operaciones reproducidas | Estado idéntico |
|---:|---:|---:|---:|---|
| 1.000 | 1.081,70 | 386,42 | 200 | Sí |
| 2.000 | 4.136,57 | 781,81 | 200 | Sí |
| 4.000 | 16.272,92 | 1.646,56 | 200 | Sí |

El fixture usa un producto y cliente ficticios, con ciclos crear → preparar → listo → despachar → entregar → cobrar. Los tamaños exactos dejan un último pedido parcial: 166, 333 y 666 pedidos completos respectivamente. Se genera una vez el historial de 4.000 y se usan sus prefijos con la misma Base ficticia.

La lectura normal al finalizar un múltiplo de 200 usa el checkpoint 200 operaciones anterior: no se fuerza un snapshot final para favorecer la medición. Se mide una lectura completa y tres lecturas con snapshot, sin warmup explícito. Los tiempos incluyen JSON, SHA-256, validación y replay; excluyen construcción del fixture, vistas y red. Son mediciones orientativas de esta máquina, no un SLA.

Después de archivar, las lecturas midieron 368,36 / 790,69 / 1.660,78 ms respectivamente y conservaron igualdad profunda. El detalle está en `qa/benchmark-fase1.json`.

**Aceptación parcial:** máximo de 200 operaciones e igualdad profunda cumplidos con backend simulado. **Menos de 300 ms no cumplido**; queda como meta para el cierre de fases 1 a 3. `apply` sigue clonando y validando todo el estado en cada operación; resolverlo pertenece a la Fase 2.

## 4. Checklist manual de Sheets real

El procedimiento detallado y la recuperación están en [LEEME.md](../LEEME.md). Antes de aprobar:

- [ ] Respaldo completo de planilla y código; primera prueba en copia con datos ficticios.
- [ ] Instalar archivos generados, conservando propiedades y hojas; no repetir instaladores.
- [ ] Comparar Base antigua y estado antes/después de snapshot; verificar alternancia en 201 y 401.
- [ ] Probar las seis acciones del pedido, transporte como texto y copia del despacho.
- [ ] Archivar dos veces, comparar filas y estado; reintentar el mismo requestId sin duplicados.
- [ ] Probar plantilla y cambio de planilla, conservando el origen y la revisión inicial.
- [ ] Revisar acceso, límite opcional, tiempos de ejecuciones, cuotas y regeneración de vistas.
- [ ] Ensayar restauración de una copia completa separada. Después de archivar, el código viejo requiere restaurar el respaldo completo compatible.

**Sheets real: pendiente.** No se accedió a una planilla operativa ni se modificó el despliegue.

## 5. Documentación y siguiente fase

Actualizados `docs/ARQUITECTURA.md`, `docs/ALCANCE.md`, `LEEME.md` y `README.md`. `CONTINUIDAD.md` identifica esta entrega y sus pendientes. La Fase 2 no se inicia sin aprobación expresa.

Referencias oficiales para verificar el servicio: [flush](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app#flush()), [deleteRows](https://developers.google.com/apps-script/reference/spreadsheet/sheet#deleteRows(Integer,Integer)), [computeDigest](https://developers.google.com/apps-script/reference/utilities/utilities#computeDigest(DigestAlgorithm,String,Charset)) y [cuotas vigentes](https://developers.google.com/apps-script/guides/services/quotas). Las cuotas dependen de la cuenta y pueden cambiar; comprobá la documentación y Ejecuciones del proyecto antes del piloto.
