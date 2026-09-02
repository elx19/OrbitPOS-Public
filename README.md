# OrbitPOS

OrbitPOS es un punto de venta de escritorio para pequeños y medianos comercios. La versión distribuida actualmente es **5.1.2** para Windows.

## Lenguaje y tecnología

El proyecto utiliza **JavaScript y JSX**; no está desarrollado en TypeScript.

- Node.js 22.12+.
- Electron 41.10.7.
- React 18.3.1 y Vite 6.4.3.
- Express 5.2.1.
- SQLite con better-sqlite3 13.0.3.
- serialport 13.0.0 para dispositivos seriales.
- electron-updater 6.8.9 para actualizaciones.

El frontend está escrito con React/JSX y el backend y proceso principal de Electron están escritos en JavaScript. La base de datos opera localmente en el equipo donde se instala OrbitPOS.

## Release actual

Descarga el instalador o el portable desde [OrbitPOS v5.1.2](https://github.com/elx19/OrbitPOS-Public/releases/tag/v5.1.2).

La release contiene los artefactos de Windows y su manifiesto de actualización. Authenticode no está incluido en esta versión; el instalador no debe considerarse firmado digitalmente.

## Perfiles de negocio

El wizard inicial permite configurar la instalación para:

- comercio general;
- colmado;
- boutique, con variantes de talla y color;
- ferretería, con unidades y fracciones;
- farmacia pequeña, con lotes, vencimientos y FEFO;
- restaurante, con menú, mesas, comandas, cocina y modificadores;
- venta por peso, con tara, precisión, báscula y etiquetas;
- celulares y reparaciones, con IMEI, garantías y órdenes de servicio.

Las funciones visibles dependen del perfil elegido y de la configuración del negocio.

## Funciones principales

Ventas, caja, inventario, categorías, compras, proveedores, clientes, crédito y abonos, devoluciones, cotizaciones, descuentos, listas de precios, gastos, reportes, usuarios, sucursales, backups, restauración, tickets editables, pesaje, restaurantes, celulares y reparaciones.

La aplicación incluye validaciones para inventario, crédito, devoluciones, auditoría de cambios y operación offline controlada. La prueba física de impresora, lector, báscula y etiquetas debe hacerse en el equipo final antes de distribuirla a clientes.

## Requisitos

- Windows para el instalador, portable y dispositivos.
- Node.js 22.12+ y npm 10+ si se desea ejecutar el proyecto desde código.
- La instalación normal para usuarios finales solo requiere descargar el instalador de la release.

## Desarrollo local

Este repositorio se usa principalmente para distribuir las releases de Windows. La fuente canónica de desarrollo y sus comandos actualizados se mantienen en el repositorio privado [OrbitPOS-Pro](https://github.com/elx19/OrbitPOS-Pro); los archivos fuente públicos que existan aquí son una referencia y no sustituyen esa fuente.

```bash
npm install
npm run dev
```

Build web y de escritorio:

```bash
npm run build
npm run build:electron
npm run build:portable
npm run build:unpacked
```

Publicación de una nueva release:

```bash
npm run build:github-release
```

La publicación requiere credenciales de GitHub en la máquina del publicador. Nunca guardes tokens, claves privadas, bases de datos ni backups dentro del repositorio.

## Estructura del código

```text
OrbitPOS/
├── backend/      # API Express, servicios y SQLite
├── electron/     # proceso de escritorio y actualizador
├── frontend/     # React, JSX y Vite
├── shared/       # perfiles y lógica compartida
├── assets/       # recursos visuales
└── scripts/      # build, migraciones y pruebas
```

El generador comercial de licencias, documentos internos y secretos de JRTech se mantienen fuera de este repositorio público.

## Licencia

Software propietario de JRTech. Todos los derechos reservados. La publicación del código o de los instaladores no concede derechos de redistribución, modificación o sublicencia.
