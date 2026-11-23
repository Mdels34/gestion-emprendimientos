# Gestión para emprendimientos

Producto demostrativo **0.4**, preparado por Martín de los Santos para conversar y trabajar con Fabián. Entrega del 22/11/2026, America/Montevideo. Nombre de trabajo; marca y condiciones comerciales pendientes.

> Saber qué hay, qué pidió cada cliente, qué falta preparar, quién retiró y qué falta entregar o cobrar.

## Repositorio del producto

Repositorio privado: https://github.com/Mdels34/gestion-emprendimientos

- [Abrir la presentación PDF](docs/Gestion_Emprendimientos_Presentacion_Fabian.pdf).
- [Descargar el paquete completo de la demo 0.4](Gestion_Emprendimientos_Producto_Completo_v0.4.zip), incluido el tutorial.
- El código y las guías están organizados en este repositorio. El acceso de Fabián requiere identificar su cuenta y agregarlo como colaborador.

## Empezar

1. Leer `docs/Gestion_Emprendimientos_Presentacion_Fabian.pdf`: presentación de 12 páginas con funciones, ejemplos y estado del producto.
2. Abrir `demo.html` en un navegador moderno. Los datos son ficticios y las pruebas quedan en ese navegador.
3. Usar `docs/PRESENTACION.md` como guion para recorrer el producto.
4. Revisar `LEEME.md` para preparar una instalación independiente en Google Sheets.

| Módulo | Qué resuelve |
|---|---|
| Resumen | Disponible, pedidos activos, reparto y saldo por cobrar. |
| Inventario | Productos, precios, ingresos, ajustes, reservas y mínimos. |
| Clientes | Contacto, dirección, historial y alta dentro del pedido. |
| Pedidos | Varias líneas, estados, preparación y cobros manuales. |
| Repartos | Transporte, conductor, documento, despacho, entrega, incidencia y retorno. |
| Reportes | Entregas, cobros, inventario, descarga CSV y copia JSON. |

## Contenido del proyecto

- `model.js`: reglas compartidas de negocio.
- `app.js` y `ui.html`: interfaz adaptable.
- `backend.gs`: control de acceso y persistencia en Sheets.
- `Google_Apps_Script/`: archivos instalables generados.
- `plantilla/Gestion_Emprendimientos_Plantilla.xlsx`: estructura vacía exportada; debe convertirse a Google Sheets para la instalación.
- `qa/checks.js`: 115 comprobaciones de reglas y backend con Sheets simulado.
- `docs/`: presentación, alcance, arquitectura, estado y guías.
- `assets/capturas/`: imágenes del tutorial con registros ficticios.
- `tools/generar_presentacion.py`: fuente reproducible del PDF; requiere reportlab, Pillow y DejaVu Sans.

El paquete completo incluye además el tutorial en vídeo, subtítulos y el repositorio Git transportable. El vídeo no es necesario para ejecutar la aplicación.

## Construcción y validación

Requisitos para el código: Python 3 y Node.js. El HTML generado no requiere instalar dependencias ni usar una API de pago.

```bash
node qa/checks.js
python3 build.py
```

El segundo comando genera `demo.html`, los archivos de Apps Script y un paquete de instalación en `entrega/`.

Para regenerar la presentación en un entorno con sus dependencias:

```bash
python3 tools/generar_presentacion.py
```

## Dos modos

**Local:** el archivo HTML guarda en el navegador; no sincroniza otros dispositivos.

**Google:** la misma interfaz utiliza Apps Script para validar y escribir las operaciones en una planilla. Requiere cuenta Google autorizada y despliegue propio por negocio. Los enlaces precargados en la demo corresponden a la instalación privada de prueba del propietario y no conceden acceso. Una nueva instalación utiliza su propio enlace `/exec`.

La instalación privada se probó el 20/11/2026 con lectura, escritura y recarga, y se retiraron los registros de esa prueba. Esta entrega no realiza una nueva prueba remota, no cambia el despliegue y no concede acceso a Fabián.

## Estado y límites

Base funcional para un primer piloto. No hay demanda ni ventas validadas. No incluye GPS, rutas optimizadas, roles independientes de repartidor, entregas parciales, devoluciones posteriores a una entrega, reintegros, pagos en línea, facturación fiscal ni integraciones automáticas.

El paquete limita el registro a 1.000 operaciones. Antes de ampliar el uso deben validarse rendimiento, permisos, concurrencia, copias y recuperación. Descargar JSON no acredita por sí solo una restauración completa.

El proyecto se mantiene separado de los sistemas productivos de Estawol y de la memoria personal. No se concede una licencia de distribución pública ni se define aquí la titularidad entre colaboradores; esos puntos se acuerdan antes de comercializar.

Siguiente paso: elegir un negocio piloto y acordar con Fabián alcance, responsabilidades, soporte y modelo de cobro.
