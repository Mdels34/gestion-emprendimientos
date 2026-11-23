# Continuidad del producto

Actualizado: 23/11/2026, America/Montevideo.

Repositorio público: https://github.com/Mdels34/gestion-emprendimientos. Acceso de colaboradores pendiente de gestionar por separado. Este repositorio contiene únicamente el producto.

La demo 0.4 conserva reglas e interfaz. Su presentación PDF y paquete completo se mantienen como material histórico. La prueba real documentada del 20/11/2026 corresponde a esa versión anterior.

Fase 1 implementada en `feat/fase-1-snapshots-archivo`: snapshots alternados y troceados cada 200 operaciones confirmadas, lectura de cola, archivo verificado manual por defecto y límite configurable. Base original A:B conservada. Ver `docs/FASE_1.md` y `LEEME.md` para actualización con respaldo y recuperación.

Validación: 170 comprobaciones aprobadas (115 anteriores + 55 nuevas), Node y Sheets simulado. Con 4.000 operaciones, snapshot más cola reproduce 200, devuelve estado idéntico y tarda aproximadamente 1,65 s frente a 16,27 s de replay completo. Todavía no alcanza 300 ms. Esta persistencia no se probó en Sheets real y no se cambió el despliegue.

Pendiente: prueba manual en copia con datos ficticios y aprobación expresa antes de Fase 2. No se implementaron índices, validación parcial, replay sin clones, vistas incrementales, nueva concurrencia, fechas, reglas de devoluciones, respaldos automáticos, roles ni cambios de historial Git.

Antes del piloto comercial: definir negocio, alcance, responsabilidades, marca, precios, soporte, titularidad y recuperación.
