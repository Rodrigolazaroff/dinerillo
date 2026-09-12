# Rentifay

App para llevar el control de los alquileres: qué falta cobrar, cómo vienen los aumentos,
el agua y el impuesto que se reparten entre inquilinos, y cuánto queda de verdad al final
del año.

Mobile-first e instalable en el celular. Los datos viven en una Google Sheet propia.

## Levantarla

```bash
npm install
cp .env.example .env.local   # y completar
npm run bootstrap            # prepara las pestañas de la Sheet
npm run dev
```

## Qué hace

- **Contratos con condiciones propias.** El monto inicial, cada cuánto y cuánto aumenta,
  la comisión de la inmobiliaria, el día de vencimiento, el recargo por mora y qué parte
  de los servicios paga el inquilino: todo se carga por contrato. Nada está fijo en la app.
- **Los meses armados solos.** Con el contrato cargado, la app proyecta el alquiler de
  cada mes con sus aumentos escalonados, la comisión, el neto y lo que tendría que entrar.
  Y si un mes salió distinto, se fija el importe real a mano.
- **Servicios que se reparten.** El agua y el impuesto se cargan una vez, con el total de
  la boleta, y cada inquilino se lleva su porcentaje.
- **Mora al día.** El recargo se calcula contra el día en que entró la plata; si todavía no
  entró, corre hasta hoy.
- **Gráficos.** Lo cobrado contra lo esperado mes a mes, la escalera de aumentos por
  propiedad, en qué se reparte cada peso de alquiler y los gastos que nadie reintegra.

Los detalles de arquitectura y las decisiones de diseño están en [CLAUDE.md](CLAUDE.md).
