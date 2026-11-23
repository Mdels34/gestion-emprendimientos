# Repositorio Git para colaborar

La entrega contiene el código fuente y `Gestion_Emprendimientos_v0.4.bundle`, una copia Git transportable con la rama main y la etiqueta demo-0.4-entrega-20261122. No necesita acceso a una cuenta para abrirse.

## Abrir el repositorio

Desde la carpeta Repositorio_Git del paquete:

```bash
git clone Gestion_Emprendimientos_v0.4.bundle gestion-emprendimientos
cd gestion-emprendimientos
node qa/checks.js
```

La carpeta Codigo_fuente ofrece los mismos archivos para leerlos sin instalar Git.

## Publicarlo en GitHub

1. Crear un repositorio **privado** e independiente del producto, sin inicializar README ni licencia.
2. En la copia clonada, consultar `git remote -v`: el origen apunta al archivo bundle local.
3. Reemplazar ese origen por la URL que GitHub entregue al crear el repositorio. Ejemplo de estructura, con USUARIO y REPOSITORIO sustituidos por los valores reales:

```bash
git remote set-url origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
git push origin --tags
```

4. Para dar acceso a Fabián, identificar su usuario exacto y elegir el permiso acordado. No compartir la Memoria Central personal ni la instalación privada de prueba.

El repositorio privado del producto está disponible en https://github.com/Mdels34/gestion-emprendimientos. Puede clonarse directamente con `git clone https://github.com/Mdels34/gestion-emprendimientos.git` usando una cuenta autorizada. No se enviaron invitaciones ni mensajes a Fabián; falta identificar su usuario. El archivo bundle del paquete descargable conserva el corte anterior a la publicación remota.

## Colaboración

Mantener cambios pequeños y documentados; revisar alcance antes de prometer funciones comerciales. La titularidad y las condiciones de uso o distribución siguen pendientes de acuerdo entre Martín y Fabián.
