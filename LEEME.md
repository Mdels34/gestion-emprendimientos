# Instalación y uso · demo 0.4 + Fase 1

Actualizado: 23/11/2026, America/Montevideo. Validación local y Sheets simulado. Esta versión no se desplegó ni probó en Sheets real.

## Demo local

Abrí `demo.html` en un navegador moderno. Usa datos ficticios y guarda en ese navegador. La copia JSON de Reportes no sincroniza dispositivos ni implementa restauración. Los snapshots de esta fase se usan solamente en Apps Script con Sheets.

## Construir los archivos instalables

Desde la raíz del repositorio, con Node.js y Python 3:

```bash
node qa/checks.js
python3 build.py
```

Usá los archivos recién generados en `entrega/Google_Apps_Script/`. La carpeta `Google_Apps_Script/` del repositorio contiene una copia de esos archivos generados. No edites ninguna de las dos a mano: las fuentes son `model.js`, `backend.gs`, `app.js` y `ui.html`.

Para mantener también la copia de la raíz, después de construir:

```bash
python3 -c "import shutil; shutil.copytree('entrega/Google_Apps_Script', 'Google_Apps_Script', dirs_exist_ok=True)"
```

El paquete histórico `Gestion_Emprendimientos_Producto_Completo_v0.4.zip` y el PDF de presentación describen la demo 0.4 anterior. No los uses para instalar esta persistencia. El paquete nuevo se genera en `entrega/`.

## Instalar una copia de prueba independiente

1. Usá solamente datos ficticios. Subí `plantilla/Gestion_Emprendimientos_Plantilla.xlsx` a Drive y convertí a Google Sheets. Conservá Base y Operaciones y sus encabezados.
2. Abrí Extensiones → Apps Script desde esa planilla.
3. Copiá el `Code.gs` generado. Creá un HTML llamado exactamente `Index` con el `Index.html` generado. Mostrá el manifiesto y copiá `appsscript.json`.
4. Ejecutá `setupPlantilla`. Valida la estructura sin reemplazar datos y configura la cuenta instaladora. Autorizá desde tu cuenta Google; no compartas credenciales.
5. Implementá como aplicación web, ejecutando como el usuario que accede, con acceso restringido al instalador para empezar. No elijas acceso anónimo.
6. Abrí el `/exec` de esa implementación. Confirmá Google Sheets y la planilla correcta en la pantalla de conexión. Creá un registro ficticio, recargá y comprobá persistencia.

Alternativa: `setupDemo` crea datos ficticios únicamente en una planilla completamente vacía. No ejecutes instaladores sobre una app ya configurada.

## Actualizar una instalación existente: primero respaldo

1. Detené temporalmente el uso de esa instalación. Hacé una **copia completa de la planilla**, con Base, Operaciones, cualquier archivo y todas las demás hojas. Conservá también versión anterior del código y configuración en tu cuenta. Descargá además el JSON y anotá la revisión para comparar; el JSON por sí solo no reemplaza la copia de la planilla.
2. Probá el procedimiento primero en una instalación separada con datos ficticios. Para probar una instalación antigua sin snapshots, usá una copia ficticia con Base en una celda y Operaciones existentes. No ingreses ni compartas datos reales en esta tarea.
3. En la instalación a actualizar, reemplazá los archivos por los generados desde esta rama. Conservá las propiedades del proyecto, los IDs y las hojas. **No repitas `setupDemo` ni `setupPlantilla`** si ya está configurada.
4. Verificá que `Base!D:E` y `Base!G:H` estén vacías. Son los dos espacios nuevos de snapshot. Si contienen algo ajeno, respaldalo y movelo manualmente; el backend se negará a sobrescribirlo. No cambies A:B.
5. Publicá una versión nueva del despliegue. Abrí la app y compará estado, revisión y exportación JSON con el respaldo anterior. Esa primera lectura aún puede reconstruir todo el registro antiguo.
6. Ejecutá `createDemoSnapshot()` desde Apps Script con la cuenta instaladora. No quita operaciones. Volvé a leer y comparar. Después, las operaciones normales tomarán un snapshot cada 200 cambios confirmados, antes de agregar el cambio siguiente.
7. Solo después del respaldo y las comparaciones, ejecutá `archiveDemoOperations()` para mover el prefijo cubierto a `Operaciones archivo`. Crea o reutiliza un snapshot y compara las filas copiadas antes de quitarlas del registro activo. Repetir la función debe devolver cero filas nuevas cuando ya terminó.
8. Si querés archivo automático, agregá la propiedad del script `GESTION_ARCHIVAR_OPERACIONES` con el texto exacto `true`. Sin esa propiedad, el archivo permanece manual. Quitarla desactiva el archivo automático; no devuelve filas ya archivadas.
9. `GESTION_MAX_OPERACIONES` es opcional: ausente, vacío o `0` deja sin tope fijo; un entero positivo limita la revisión total. Archivar no reinicia esa revisión. Un límite ya superado no impide leer ni reintentar una solicitud confirmada.

No hay migración destructiva automática. Los snapshots agregan celdas; el retiro de filas requiere la función manual de archivo o la activación expresa indicada arriba. El archivo conserva el historial en la misma planilla, por lo que no reduce su almacenamiento total.

## Checklist en Sheets real, solo con datos ficticios

- [ ] Ejecutá las pruebas locales y usá el código generado de esta fase en una copia independiente.
- [ ] Comprobá que Base antigua de una celda y registro existente se lean con el mismo estado y revisión antes y después de `createDemoSnapshot()`.
- [ ] Con un historial ficticio de al menos 201 acciones, comprobá manifiesto 200 y cola desde 201. Continuá hasta 401 y comprobá alternancia de los espacios y snapshot 400. Podés usar un fixture generado localmente para cargar exclusivamente la copia de prueba.
- [ ] Creá, prepará, marcá listo, despachá, entregá y cobrá un pedido ficticio; recargá y compará stock, reserva, reparto y saldo. Documento y matrícula deben seguir como texto; el despacho debe conservar su copia aunque cambie la asignación posterior.
- [ ] En un script de prueba de esa copia, llamá dos veces a `runAppAction` con la misma revisión y **el mismo** requestId para una acción ficticia. La segunda llamada no debe agregar fila ni duplicar cobros. Repetí después de archivar esa acción. No generes un requestId nuevo al reintentar.
- [ ] Ejecutá `archiveDemoOperations()` dos veces. Verificá copia idéntica, continuidad de revisiones entre archivo y cola, ausencia de duplicados nuevos y estado idéntico antes y después.
- [ ] Probá `setupPlantilla` en un proyecto nuevo vinculado a una plantilla ficticia con snapshots y archivo: no debe cambiar celdas. No borres propiedades de una instalación operativa para hacer esta prueba.
- [ ] Probá `connectAppSheet` hacia una hoja vacía y hacia otra instalación ficticia compatible con snapshots y archivo. El origen debe conservarse. En destino vacío, la Base copiada incluye requests e historia; los registros crudos anteriores quedan en el origen. Conservá esa planilla como respaldo de auditoría.
- [ ] Probá un límite pequeño en una copia: lecturas y reintentos confirmados deben seguir funcionando; acciones nuevas deben rechazarse al llegar al límite. Después quitá el límite o dejalo en `0`.
- [ ] Revisá acceso denegado para una cuenta no autorizada y mantenimiento reservado al instalador. Dos ventanas conservan el rechazo actual por revisión desactualizada.
- [ ] Medí lectura, escritura, snapshot y archivo desde **Ejecuciones** de Apps Script con la cuenta y volumen previstos. Verificá también `regenerateDemoViews()`. No induzcas fallas ni borres manifiestos sobre información real: los cortes de escritura se prueban en el simulador.
- [ ] Ensayá la recuperación de una copia de respaldo completa en otra planilla antes de dar por aprobado el piloto.

La automatización no acredita ninguna de estas casillas en Sheets real. Registrá resultado, revisión, despliegue y fecha al probarlas.

## Recuperación y límites

Si falla un snapshot antes de confirmarse, repetí la misma operación o `createDemoSnapshot()`. Si se copió el archivo pero no se quitaron filas, repetir `archiveDemoOperations()` verifica el solapamiento y termina sin duplicarlo. Un manifiesto corrupto, huecos o copias diferentes detienen la operación: conservá las hojas y recuperá una copia consistente; no borres celdas para forzar continuidad.

Para volver al código anterior **después de archivar**, restaurá una copia completa coherente de la planilla junto con el código anterior. El backend viejo no conoce los snapshots ni el archivo y no debe ejecutarse sobre un registro recortado. Restaurá primero en una copia separada, validá y luego elegí el destino; no mezcles Base, registro o snapshots de fechas diferentes.

Sin límite fijo no equivale a capacidad ilimitada. En Node, 4.000 operaciones con cola de 200 todavía superan 300 ms porque el modelo clona y valida todo por paso. Las cuotas y tiempos reales dependen de Google y de la cuenta. Verificá la documentación vigente de [cuotas de Apps Script](https://developers.google.com/apps-script/guides/services/quotas) y las ejecuciones de tu proyecto. No se extrapolan milisegundos de Node a Sheets.

## Usuarios y aislamiento

Para incorporar otro usuario, la cuenta instaladora debe agregar su correo exacto a `USUARIOS_AUTORIZADOS`, compartir la planilla con los permisos necesarios y revisar la audiencia del despliegue. Todos los autorizados mantienen el acceso operativo completo; no se implementaron roles nuevos. La entrega no envía invitaciones.

Usá un proyecto Apps Script por planilla y negocio. El bloqueo no coordina proyectos independientes. Operá desde la app: editar vistas no cambia el modelo. No edites Base ni registros manualmente.

Los enlaces precargados de la demo 0.4 corresponden a una instalación privada y no conceden acceso. Para tu piloto elegí **Usar otra instalación de Google** o abrí su propio `/exec`. La extracción de esa URL a configuración queda para la Fase 7.
