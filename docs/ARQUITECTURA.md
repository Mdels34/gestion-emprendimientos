# Arquitectura de la demo 0.4

## Componentes

| Archivo | Responsabilidad |
|---|---|
| `ui.html` | Estructura y estilos adaptables a celular y computadora. |
| `app.js` | Pantallas, formularios, transporte, conector visible y exportaciones. |
| `model.js` | Reglas de stock, clientes, pedidos, cobros y asignaciones. Funciona en navegador, Node y Apps Script. |
| `backend.gs` | Autorización, bloqueo, persistencia, vínculo con Sheets y vistas legibles. |
| `build.py` | Construcción del HTML y paquete de instalación. |
| `qa/checks.js` | Pruebas de negocio y backend con Sheets simulado. |

## Dos modos de uso

En el HTML autónomo, las operaciones se validan con el modelo compartido y se conservan en `localStorage` de ese navegador. La conexión a Google permanece identificada como pendiente.

En la instalación de Apps Script, la misma interfaz llama a `getAppState`, `runAppAction` y `connectAppSheet` mediante `google.script.run`. El backend comprueba identidad y acceso, vuelve a validar la operación y conserva los datos en la planilla.

## Persistencia

- `Base`: estado inicial serializado; admite segmentos para conservar estados más grandes al cambiar de planilla.
- `Operaciones`: fuente de verdad de los cambios, con revisión secuencial e identificador de solicitud.
- `Productos`, `Clientes`, `Pedidos`, `Detalle pedidos`, `Movimientos`, `Actividad`, `Historial transporte`: vistas reconstruibles para consulta.

Las escrituras se hacen desde la app. Editar directamente una vista no cambia el estado de la aplicación. No modificar Base ni Operaciones sin un procedimiento específico de mantenimiento.

Cada llamada de escritura usa un bloqueo de script y comprueba la revisión esperada. Los reintentos con el mismo identificador no duplican pedidos, clientes, cobros ni asignaciones. Si se guardó una operación y falló una vista, la operación permanece disponible para reconstrucción.

El bloqueo protege llamadas del mismo proyecto Apps Script. No coordina instalaciones independientes sobre la misma planilla: usar una instalación por negocio y evitar dos proyectos escribiendo al mismo archivo.

## Transporte y trazabilidad

Los datos actuales de transporte pertenecen al pedido. `transportHistory` conserva asignaciones fechadas. Un evento de despacho o reintento incluye su propia copia de empresa, vehículo y conductor: una actualización posterior no altera esa evidencia. El documento es texto, sin conversión a número.

## Conexión configurable

La cuenta instaladora puede elegir otra hoja con `connectAppSheet`. Antes de cambiar la propiedad que la identifica, se valida y lee el destino. Una hoja vacía recibe una copia del estado; una compatible aporta sus propios registros. Se rechaza contenido ajeno. La hoja anterior se conserva. Otros usuarios autorizados pueden operar y consultar la conexión, pero no cambiarla.

La versión autónoma permite guardar el enlace `/exec` de la aplicación de Google para abrir la instalación conectada. No usa endpoints anónimos, credenciales incrustadas ni una planilla pública.

## Límites del piloto

Hasta 1.000 operaciones registradas en el paquete demostrativo; reconstrucción del estado y regeneración completa de vistas en cada operación. Medir tiempos y cuotas antes de ampliar uso. No hay GPS, optimización de rutas, pagos bancarios, roles de conductor separados, entregas parciales ni validación de identidad documental.

La conexión real a Google, OAuth, despliegue y operación con un negocio real requieren su propia verificación. Las pruebas con mocks no acreditan esos resultados.

## Instalación sobre la plantilla preparada

`setupPlantilla` exige un proyecto vinculado a una planilla con Base y Operaciones compatibles. Reproduce el estado completo para comprobarlo, valida la cuenta instaladora y recién entonces guarda las propiedades del proyecto. No modifica las hojas ni reemplaza el registro. Es independiente de `setupDemo`, que genera datos ficticios únicamente en un archivo vacío. La plantilla vacía no habilita acceso a la aplicación ni instala Apps Script por sí sola.
