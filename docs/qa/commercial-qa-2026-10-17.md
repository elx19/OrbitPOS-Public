# QA comercial — 2026-10-17

## Resultado

La prueba automatizada completó **26 pasos OK** usando Node.js 22.12.0 y un secreto temporal de QA fuera del repositorio.

Ejecución: `.qa/commercial/2026-10-17T15-33-07-227Z/reports/commercial-qa-result.md`

## Flujos cubiertos

- health check, metadata y wizard inicial;
- demo, login y recuperación local de contraseña;
- activación de licencia mensual e historial/diagnóstico;
- productos, cliente y ventas de contado/crédito;
- créditos, abonos y devolución parcial;
- apertura/cierre de caja y notificaciones;
- reporte resumido, PDF, backup, mutación y restauración.

## Cómo repetirla

Define `ORBITPOS_LICENSE_SECRET` solo en el entorno local autorizado y ejecuta:

```bash
npm run qa:commercial:node22
```

La QA no sustituye las pruebas físicas de impresora, lector, báscula, instalación limpia y actualización desde el feed productivo.
