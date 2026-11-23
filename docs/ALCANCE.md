# Alcance · demo 0.4 + Fase 1

Actualizado: 23/11/2026, America/Montevideo. Esta fase modifica persistencia; conserva las reglas e interfaz existentes.

## Reglas operativas

| Evento | Resultado conservado |
|---|---|
| Pedido pendiente, en preparación o listo | Reserva mercadería sin reducir el depósito. |
| Despacho | Reduce depósito y traslada unidades a reparto. |
| Entrega confirmada | Confirma el resultado; el cobro se registra por separado. |
| Entrega fallida | Mantiene unidades fuera del depósito. |
| Reintento | Conserva la salida ya realizada, sin descontar otra vez. |
| Retorno recibido | Ingresa al depósito la mercadería que volvió. |
| Registro de cobro | Actualiza el saldo; no procesa un pago. |
| Ajuste negativo que afecta reservas | Se rechaza. |
| Alta de cliente dentro de un pedido | Se confirma junto al pedido; si falla, no deja registros sueltos. |
| Cambio de transporte | Se agrega al historial y conserva los retiros anteriores. |

Disponible = físico en depósito − reservado. Reparto se muestra por separado. Empresa, matrícula, conductor, tipo y número de documento pertenecen al pedido. El nombre del conductor es necesario para despachar. Documento y matrícula son texto; no se valida su autenticidad.

## Incluido en la Fase 1

- Snapshots cada 200 operaciones confirmadas, tomados antes de agregar la operación siguiente; también se pueden crear manualmente.
- Base inicial compatible, troceado de 24.000 caracteres y dos espacios alternados con manifiesto y SHA-256.
- Lectura desde el último snapshot más cola secuencial, con idempotencia preservada.
- Archivo mediante copia, relectura, comparación y retiro del prefijo activo. Manual por defecto; automático solo con activación explícita posterior al respaldo.
- Tope configurable; sin el límite fijo de 1.000 por defecto.
- Pruebas de recuperación y benchmark ficticio reproducible. No se desplegó esta versión en Sheets real.

No hay migración destructiva automática ni borrado de historia. El archivo reorganiza filas dentro de la misma planilla; no reduce por sí solo almacenamiento total ni cuotas.

## Límites que siguen vigentes

- Una instalación y planilla independientes por negocio; usuarios autorizados sin roles diferenciados.
- Clonado y validación completa del modelo por operación; estado con history, movements y requests completos.
- Regeneración completa de las siete vistas y ajuste de columnas por operación.
- Lecturas con bloqueo y rechazo de la revisión esperada cuando otro usuario modificó datos.
- Fecha de referencia fija y tratamiento actual de retornos con cobros; requieren decisión en fases posteriores.
- Entregas y retornos completos; sin devolución de pedidos ya entregados ni reintegros automáticos.
- Sin GPS, rutas, pagos en línea, facturación fiscal ni integraciones automáticas.
- Sin sincronización entre dispositivos en el HTML autónomo.
- Exportar JSON no implementa restauración validada ni respaldo automático. Roles y copias diarias quedan fuera de esta fase.

La meta de lectura menor a 300 ms con 4.000 operaciones se evalúa al terminar las fases 1 a 3. En la Fase 1 se verificaron igualdad profunda y máximo de 200 operaciones reproducidas, pero **no se alcanzaron los 300 ms**. Ver `FASE_1.md`.

No se modificó el historial Git, la URL precargada, la política de encoding de `build.py` ni se agregó GitHub Actions. Esas tareas quedan para la Fase 7. La lista de archivos del paquete sí incluye los nuevos auxiliares necesarios para ejecutar QA.

## Piloto pendiente

Probar esta persistencia en una copia de Sheets con datos ficticios, permisos, segundo usuario, tiempos y recuperación. Definir negocio piloto, marca, precios, soporte, titularidad y condiciones comerciales. La Fase 2 requiere aprobación expresa antes de empezar.
