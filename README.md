# OrbitPOS

OrbitPOS es un punto de venta de escritorio para pequeños y medianos comercios. Este checkout contiene la línea funcional **2.1.0-alpha.17** para Windows.

## Lenguaje y tecnología

El proyecto utiliza **JavaScript y JSX**; no está desarrollado en TypeScript.

- Node.js 22.12+.
- Electron 35.7.5.
- React 18.3.1 y Vite 6.4.3.
- Express 4.21.2.
- SQLite con better-sqlite3 11.10.0.
- serialport 13.0.0 para dispositivos seriales.
- electron-updater 6.8.3 para actualizaciones.

El frontend está escrito con React/JSX y el backend y proceso principal de Electron están escritos en JavaScript. La base de datos opera localmente en el equipo donde se instala OrbitPOS.

## Release actual

El instalador generado localmente para esta línea es `release/OrbitPOS Setup 2.1.0-alpha.17.exe`. La publicación en GitHub Releases debe hacerse después de completar las pruebas físicas y firmar el artefacto.

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

El backend de desarrollo se ejecuta con Node 22 mediante `npm run dev:backend`, porque `better-sqlite3` debe coincidir con el ABI nativo usado por la aplicación. Si necesitas reinicio automático al editar backend y ya tienes Node 22 activo, usa `npm run dev:backend:watch`.

Build web y de escritorio:

```bash
npm run build
npm run build:electron
npm run build:portable
npm run build:unpacked
```

## Rediseño OrbitPOS 2.1

La línea `v2.1.0-alpha.17` corrige el flujo de acceso al panel principal, elimina un fallo de ejecución que dejaba la pantalla en blanco después del login y ajusta el login responsive para conservar el logotipo y las proporciones de referencia en el navegador integrado. La navegación navy compacta, las tarjetas blancas, las acciones emerald y la carpeta [`docs/ui-reference/authoritative`](docs/ui-reference/authoritative) quedan versionadas junto con cada hito funcional.

## Generador de licencias

El generador operativo vive en `scripts/license-generator.js`. La clave privada nunca se guarda en el repositorio; define `ORBITPOS_LICENSE_SECRET` solo en la máquina autorizada para emitir licencias.

```bash
set ORBITPOS_LICENSE_SECRET=clave-privada-local
node scripts/license-generator.js generate --machine-id ID --business "Tienda San Jose" --type monthly --json
node scripts/license-generator.js verify --key ORB2.... --json
node scripts/license-generator.js decode --key ORB2.... --json
```

La prueba aislada del generador se ejecuta con `npm run qa:license`. La QA comercial completa y las pruebas físicas de dispositivos siguen siendo gates obligatorios antes de producción.

La integridad del artefacto se comprueba con `npm run qa:release`; valida el tag, el instalador, el hash del manifiesto, el ejecutable desempaquetado, la identidad visual y las referencias de todos los módulos.

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

Los secretos de JRTech y la clave privada de emisión se mantienen fuera de este repositorio público.

## Licencia

Software propietario de JRTech. Todos los derechos reservados. La publicación del código o de los instaladores no concede derechos de redistribución, modificación o sublicencia.
