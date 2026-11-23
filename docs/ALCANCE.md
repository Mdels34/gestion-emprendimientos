# Alcance de la demo 0.4

## Reglas operativas

| Evento | Resultado |
|---|---|
| Pedido pendiente, en preparación o listo | Reserva mercadería. No reduce el depósito. |
| Despacho | Reduce depósito y traslada unidades a reparto. |
| Entrega confirmada | Confirma el resultado; el cobro se registra por separado. |
| Entrega fallida | Mantiene unidades fuera del depósito. |
| Reintento | Conserva la salida ya realizada, sin descontar otra vez. |
| Retorno recibido | Ingresa al depósito la mercadería que volvió. |
| Registro de cobro | Actualiza el saldo; no procesa un pago. |
| Ajuste negativo que afecta reservas | Se rechaza. |
| Alta de cliente dentro de un pedido | Se confirma junto al pedido; si falla, no deja registros sueltos. |
| Cambio de transporte | Se agrega al historial; conserva la constancia de retiros anteriores. |

Disponible = físico en depósito - reservado. El reparto se muestra por separado.

## Datos de transporte

Empresa transportista, matrícula, conductor, tipo y número de documento. El nombre es necesario para asignar o despachar. Los demás campos se completan cuando están disponibles. Documento y matrícula se conservan como texto. No se valida identidad ni autenticidad.

## Límites actuales

- Una instalación y planilla independientes por negocio; no es una plataforma multiempresa compartida.
- Usuarios autorizados sin roles diferenciados.
- Hasta 1.000 operaciones registradas; medir tiempos y cuotas antes de ampliar.
- Entregas y retornos completos; sin devoluciones de pedidos ya entregados.
- Sin cancelación de pedidos que tengan cobros ni reintegros automáticos.
- Sin GPS, rutas, pagos en línea, facturación fiscal ni integraciones automáticas.
- Sin sincronización entre dispositivos en el HTML autónomo.
- Exportar JSON no equivale a contar con respaldo automático ni restauración validada.

## Piloto pendiente

Validar permisos, segundo usuario, reservas concurrentes, teléfonos reales, rendimiento, operación diaria, copias y recuperación. Marca, precios, soporte y acuerdo comercial siguen abiertos.
