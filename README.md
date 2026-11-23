# Gestión para emprendimientos

Demo 0.4 con **Fase 1 de persistencia** preparada el 23/11/2026, America/Montevideo. Nombre de trabajo; marca y condiciones comerciales pendientes.

> Saber qué hay, qué pidió cada cliente, qué falta preparar, quién retiró y qué falta entregar o cobrar.

Repositorio público: [Mdels34/gestion-emprendimientos](https://github.com/Mdels34/gestion-emprendimientos). La invitación de un colaborador se gestiona por separado.

## Esta entrega: solo Fase 1

- Snapshots del estado cada 200 operaciones confirmadas, con troceado, dos espacios alternados y comprobación SHA-256.
- Lectura desde el último snapshot y cola secuencial. Conserva Base antigua, revisión e idempotencia por requestId.
- Archivo seguro por copia y verificación, **manual por defecto y con respaldo previo**. El automatismo requiere activación explícita.
- Se elimina el tope fijo de 1.000; `GESTION_MAX_OPERACIONES` permite configurar otro. No implica capacidad ilimitada.
- Reglas e interfaz sin cambios. No se avanzó a las fases 2 a 7.

Leé [la entrega técnica y sus mediciones](docs/FASE_1.md), [la arquitectura](docs/ARQUITECTURA.md), [el alcance](docs/ALCANCE.md) y [la actualización con respaldo y checklist de Sheets](LEEME.md) antes de instalar.

**Validación:** 170 comprobaciones locales aprobadas: 115 anteriores + 55 nuevas. Backend simulado; esta persistencia no se probó en Sheets real y no se cambió el despliegue existente. La prueba remota histórica del 20/11/2026 corresponde a la demo anterior.

Con 4.000 operaciones ficticias, el benchmark reprodujo 200 y devolvió un estado profundamente idéntico al replay completo: 1.646,56 ms frente a 16.272,92 ms en esta ejecución local. **Todavía no cumple 300 ms**; esa aceptación corresponde al cierre de las fases 1 a 3.

## Empezar y construir

Requisitos: Node.js y Python 3; sin dependencias npm para ejecutar QA o construir la app.

```bash
node qa/checks.js
node qa/benchmark.js --output qa/benchmark-fase1.json
python3 build.py
```

`build.py` genera `demo.html`, `entrega/Google_Apps_Script/` y paquetes en `entrega/`. Para sincronizar la copia generada de la raíz, sin editarla a mano:

```bash
python3 -c "import shutil; shutil.copytree('entrega/Google_Apps_Script', 'Google_Apps_Script', dirs_exist_ok=True)"
```

Abrí `demo.html` para recorrer la app local con datos ficticios. Para una instalación de Google, seguí [LEEME.md](LEEME.md). No repitas instaladores al actualizar una app ya configurada.

## Funciones conservadas

| Módulo | Qué resuelve |
|---|---|
| Resumen | Disponible, pedidos activos, reparto y saldo por cobrar. |
| Inventario | Productos, precios, ingresos, ajustes, reservas y mínimos. |
| Clientes | Contacto, dirección, historial y alta dentro del pedido. |
| Pedidos | Varias líneas, estados, preparación y cobros manuales. |
| Repartos | Transporte, conductor, documento, despacho, entrega, incidencia y retorno. |
| Reportes | Entregas, cobros, inventario, descarga CSV y copia JSON. |

Documento y matrícula se mantienen como texto; cada despacho conserva su copia de transporte. Moneda UYU; zona America/Montevideo. Sin cambios en fecha de referencia ni tratamiento de devoluciones con cobros.

## Archivos

- `model.js`: reglas puras compartidas; `app.js`, `ui.html`: interfaz.
- `backend.gs`: persistencia, acceso, snapshots y archivo.
- `Google_Apps_Script/`: archivos instalables generados; no editar manualmente.
- `qa/checks.js`, `qa/sheets-mock.js`, `qa/fixtures.js`: comprobaciones y simulador.
- `qa/benchmark.js`, `qa/benchmark-fase1.json`: medición reproducible y resultado local.
- `plantilla/Gestion_Emprendimientos_Plantilla.xlsx`: plantilla para convertir a Sheets.
- `docs/`: arquitectura, alcance, guía y entrega de Fase 1.

## Presentación histórica 0.4

[Presentación PDF](docs/Gestion_Emprendimientos_Presentacion_Fabian.pdf) y [paquete completo 0.4](Gestion_Emprendimientos_Producto_Completo_v0.4.zip) se conservan como material histórico de funciones e interfaz. **No incluyen los cambios de persistencia de esta fase.** Instalá desde el código generado actual. La presentación puede reproducirse con `tools/generar_presentacion.py`; requiere reportlab, Pillow y DejaVu Sans.

El ZIP grande y su historial Git quedan sin cambios hasta la Fase 7. Los enlaces precargados del HTML apuntan a una instalación privada anterior; una nueva instalación usa su propio `/exec` y permisos.

## Estado del piloto

No hay demanda ni ventas validadas. No incluye GPS, rutas optimizadas, roles de repartidor, entregas parciales, devoluciones posteriores a una entrega, reintegros, pagos en línea ni facturación fiscal. Exportar JSON no implementa restauración ni copias automáticas. Las cuotas de Google requieren medición real.

Una instalación por negocio. El HTML local no sincroniza dispositivos. No se modifica ningún sistema externo al producto ni se conceden accesos como parte de esta entrega. Titularidad y licencia se acuerdan antes de distribuir o comercializar.

La Fase 2 queda pendiente de aprobación expresa.
