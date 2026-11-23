# Instalación y uso

## Demo local

Abrir `demo.html` o `Gestion_Emprendimientos_Demo.html` en un navegador moderno. Incluye ejemplos ficticios. Las operaciones quedan en ese navegador cuando el almacenamiento está disponible. La copia JSON se descarga desde Reportes; no hay sincronización automática del HTML local.

## Instalar un piloto independiente

1. Subir `plantilla/Gestion_Emprendimientos_Plantilla.xlsx` a Drive y convertirlo a Google Sheets. Conservar las hojas Base y Operaciones y sus encabezados.
2. Abrir Extensiones → Apps Script desde la planilla convertida.
3. Copiar `Google_Apps_Script/Code.gs` al archivo de código. Crear un HTML llamado exactamente `Index` y copiar `Index.html`.
4. Mostrar el manifiesto desde la configuración del proyecto y copiar `appsscript.json`.
5. Ejecutar `setupPlantilla` desde el proyecto vinculado. Valida la estructura y registra la instalación sin reemplazar sus datos. Autorizar los permisos de la cuenta propietaria.
6. Implementar como aplicación web, ejecutar como el usuario que accede y comenzar con el acceso más restringido, solo del instalador. No elegir acceso anónimo.
7. Abrir el enlace `/exec` de esa implementación. Verificar que la cabecera indique Google Sheets y que la pantalla de conexión identifique la planilla correcta.
8. Crear un producto ficticio y comprobar en Sheets que se registró. Recargar y confirmar su persistencia antes de ingresar datos reales.

Alternativa para una planilla totalmente nueva y vacía: `setupDemo` crea datos ficticios. No ejecutar sobre una instalación que ya está operativa. Para actualizar una instalación existente se reemplazan archivos y se publica una versión nueva, conservando propiedades y hojas. No repetir los instaladores.

## Incorporar un segundo usuario

El propietario debe definir el correo exacto, agregarlo a `USUARIOS_AUTORIZADOS` en las propiedades del script, darle los permisos necesarios sobre la planilla y revisar la audiencia del despliegue. La implementación deniega acceso si no obtiene una identidad autorizada. Todos los usuarios autorizados pueden operar la demo completa; no hay perfiles diferenciados de repartidor.

La entrega de estos archivos no comparte la aplicación ni la planilla. No hay invitaciones enviadas.

## Datos y mantenimiento

Base conserva el estado inicial; Operaciones registra cambios. Las otras hojas son vistas de consulta reconstruibles. Operar desde la app: editar una vista a mano no modifica el estado del sistema. No borrar ni editar Base u Operaciones sin un procedimiento de mantenimiento.

Usar un proyecto Apps Script por negocio y planilla. El bloqueo coordina llamadas de esa instalación, no proyectos independientes. El código conserva revisión e identificadores de solicitud para evitar sobrescrituras y repeticiones.

Las llamadas y el almacenamiento están sujetos a las cuotas de Google. El piloto debe comprobar tiempos reales y recuperación; el paquete demostrativo admite hasta 1.000 operaciones.

## Acceso a los ejemplos privados existentes

La demo conserva accesos precargados a una instalación privada usada para validar el conector. Requieren la cuenta propietaria y no habilitan datos a terceros. Para el nuevo piloto usar **Usar otra instalación de Google** o abrir directamente su nuevo `/exec`. Revisar esta configuración antes de entregar una versión a un cliente.
