# OrbitPOS Public

Sistema de terminal de venta al publico desarrollado con Electron, React, Express y SQLite.

Este repositorio publico contiene solo el sistema principal. No incluye:

- generador de licencias
- documentos internos de desarrollo
- secretos comerciales de licenciamiento
- feed local / servidor generico legado

## Incluye

- app de escritorio con Electron
- frontend React + Vite
- backend Express + SQLite
- wizard inicial
- demo de 30 dias
- ventas, caja, creditos, devoluciones, productos, compras, clientes, usuarios y reportes
- backups y restauracion
- plantillas de impresion editables
- actualizaciones por GitHub Releases

## Seguridad de licencias en esta version publica

La logica de activacion comercial requiere una clave privada fuera del repositorio.

Configura esta variable antes de usar licencias firmadas:

```bash
ORBITPOS_LICENSE_SECRET=tu_clave_privada
```

Si no configuras esa variable, el sistema puede ejecutarse en modo demo, pero no validara activaciones comerciales firmadas.

Puedes copiar el ejemplo base desde:

- [.env.example](./.env.example)

## Estructura

```text
OrbitPOS/
├── assets/
├── backend/
├── electron/
├── frontend/
├── installer/
├── scripts/
├── shared/
├── package.json
└── vite.config.js
```

## Requisitos

- Node.js 20+
- npm 10+
- Windows recomendado para empaquetado Electron

## Desarrollo local

```bash
npm install
npm run dev
```

## Builds

```bash
npm run build
npm run build:electron
npm run build:portable
npm run build:unpacked
```

## Publicacion de updates

El proyecto esta preparado para publicar actualizaciones con GitHub Releases.

```bash
npm run build:github-release
```

## Notas

- la base de datos nueva inicia limpia, sin productos precargados
- el usuario inicial es `admin/admin`
- el generador comercial de licencias se mantiene privado

## Licencia del codigo

Codigo fuente publico de referencia y distribucion controlada por JRTech.
Todos los derechos reservados.
