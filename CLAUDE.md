# Rentifay

Control de alquileres. Cobros, aumentos, servicios que se reparten entre inquilinos y
rentabilidad real, sin abrir la planilla nunca.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Recharts · SWR · Zod · googleapis.
PWA instalable. Deploy en Vercel, datos en una Google Sheet.

## Cómo se levanta

```bash
npm install
cp .env.example .env.local   # y completar
npm run dev
```

Para preparar la Sheet la primera vez (o después de agregar una columna):

```bash
npm run bootstrap
```

Es idempotente: crea las pestañas que falten, escribe los headers y **nunca toca datos
ya cargados**. Si una pestaña ya tiene filas y le falta una columna, la agrega al final
en vez de reescribir el header.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `GOOGLE_SA_EMAIL` | Mail del service account con acceso de editor a la Sheet |
| `GOOGLE_SA_PRIVATE_KEY` | Su clave privada, en una línea con los `\n` escapados |
| `SHEET_ID` | ID de la Sheet que oficia de base de datos |
| `AUTH_SECRET` | Firma de la cookie de sesión (string largo y random) |
| `AUTH_PASS_RODRIGO` | Clave de acceso con rol editor |
| `AUTH_PASS_INVITADO` | Opcional. Clave de solo lectura; si no está, ese usuario no existe |
| `SHARE_WITH` | Sólo para el bootstrap, si algún día crea la planilla desde cero |

## La decisión de diseño que importa

**Las condiciones viven en el contrato, no en la app.**

Hoy los contratos son 15% cada 3 meses, comisión 7%, 12 meses, mora 2% diario y vencen
el 10. Pero eso es lo que se pactó *esta vez*. Cada fila de `contratos` guarda sus
propios `aumento_pct`, `aumento_meses`, `meses`, `comision_pct`, `mora_pct_diario`,
`dia_vencimiento` y `prorrateo_pct`. La pestaña `config` sólo guarda con qué valores
viene **precargado el formulario**; cambiarla no toca ningún contrato ya cargado.

Y por si la fórmula no alcanza: **cualquier mes puede llevar un importe fijado a mano**
(pestaña `alquileres`). Le gana a la proyección. Con eso entra un contrato atado al ICL,
uno con montos negociados mes a mes o uno donde el aumento salió distinto a lo pactado,
sin tocar una línea de código.

## Cómo se calcula una cuota

Todo en `lib/calc.ts`, puro, sin efectos. El server lo usa para responder y el cliente
para adelantar los números mientras escribís.

```
bruto      = importe fijado a mano, o inicial × (1 + aumento%)^piso(cuota / cada_cuántos)
comisión   = bruto × comisión%                      ← lo retiene la inmobiliaria
neto       = bruto − comisión                       ← lo que te transfieren del alquiler
reintegro  = Σ (boleta del período × prorrateo% del contrato)
subtotal   = neto + reintegro
mora       = bruto × mora%_diario × días de atraso
esperado   = subtotal + mora
```

El aumento es un **escalón**, no interés compuesto mes a mes: con 15% cada 3 meses, las
cuotas 1 a 3 valen lo mismo y la 4 salta a inicial × 1,15.

La **mora** se calcula contra el día en que entró la plata. Si todavía no entró y el
vencimiento pasó, corre hasta hoy y la cuota se marca con `moraEstimada`, así la deuda
que ves es la que podés reclamar hoy y no la de la semana pasada.

## Los servicios que se reparten

El agua y el impuesto inmobiliario los paga el dueño y los inquilinos le reintegran su
parte junto con el alquiler. En la pestaña `gastos` eso es `reparte = si`: **se carga el
total de la boleta una sola vez** y cada contrato se lleva su `prorrateo_pct`.

Con dos inquilinos al 50% el total queda cubierto. Si los porcentajes de los contratos
vigentes no suman 100, la app avisa: la diferencia la está poniendo el dueño.

Un gasto con `reparte = no` (mantenimiento, seguro, una reparación) no entra en lo que se
cobra: sale del resultado del año.

## La Sheet

Seis pestañas planas, sin fórmulas ni formato. Fila 1 = headers.

- `propiedades` — `id, nombre, direccion, tipo, nota, orden, created_at, deleted_at`
- `contratos` — `id, propiedad_id, inquilino, telefono, email, fecha_inicio, meses, ajuste_tipo, alquiler_inicial, aumento_pct, aumento_meses, comision_pct, mora_pct_diario, dia_vencimiento, prorrateo_pct, deposito, nota, created_at, deleted_at`
- `alquileres` — `id, contrato_id, periodo, monto, nota, created_at, deleted_at` (importes fijados a mano)
- `cobros` — `id, contrato_id, periodo, fecha_cobro, importe, nota, created_at, deleted_at`
- `gastos` — `id, tipo, periodo, fecha, propiedad_id, monto, reparte, nota, created_at, deleted_at`
- `config` — `clave, valor`

`id` es un ULID generado en el server: **es la clave para editar y borrar**, nunca se
depende del número de fila.

**Borrado = borrado blando.** Se escribe `deleted_at` y la fila no se mueve, así dos
escrituras a la vez no se pisan. El borrado físico pasa sólo al vaciar la papelera desde
Ajustes.

Las escrituras mapean **por nombre de columna**, no por posición: si abrís la planilla y
movés una columna de lugar, los datos siguen cayendo donde corresponde.

## Colores de los gráficos

La paleta de series está en `app/globals.css` como `--color-serie-1..8`, en orden fijo, y
está validada para daltonismo (protan / deutan / tritan) sobre fondo blanco. **El color
sigue a la propiedad, no a su posición en un ranking**, y no se generan colores nuevos
más allá del slot 8.

La escalera de alquileres se dibuja con `stepAfter`: el alquiler es una función escalón y
dibujarlo interpolado sería mentir sobre el dato.
