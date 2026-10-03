# Dinerillo

La plata del mes en un solo lugar: lo que entra, lo que sale, lo que dividís con alguien
y, si tenés propiedades, los alquileres. Antes se llamaba Rentifay.

Mobile-first e instalable en el celular (PWA). Cualquiera se crea una cuenta; los datos
viven en Supabase y cada cuenta ve solo lo suyo.

## Levantarla

```bash
npm install
cp .env.example .env.local   # y completar
npm run dev
```

## Qué hace

- **Arranca a tu medida.** Al crear la cuenta, cuatro preguntas (cómo te llamás, de
  dónde te entra la plata, cuánto querés ahorrar y si dividís gastos) y la app queda
  armada: sin División si no dividís, sin Alquileres si no tenés.
- **Cargar en segundos.** El "+", dictar o sacarle una foto a la factura. Los montos se
  formatean mientras escribís, en pesos o en dólares.
- **El mes en un número.** Cuánto te quedó, contra la meta de ahorro.
- **División.** Quién pagó qué y quién le pasa cuánto a quién, con PDF para mandar.
- **Alquileres.** Contratos con sus propias condiciones (aumentos escalonados, comisión,
  mora, reparto de servicios), lo que falta cobrar y las boletas que se reparten.

Los detalles de arquitectura y las decisiones de diseño están en [CLAUDE.md](CLAUDE.md).
