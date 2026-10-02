# Dinerillo

La plata del mes en un solo lugar. Hoy tiene el módulo de **alquileres** (cobros,
aumentos, boletas que se reparten entre inquilinos). Vienen **ingresos**, **gastos** y
**división** de gastos con la pareja. Antes se llamaba Rentifay y vivía en una Google Sheet.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Recharts · SWR · Zod · Supabase
(`@supabase/ssr`). PWA instalable. Deploy en Vercel, datos y login en Supabase.

## Cómo se levanta

```bash
npm install
cp .env.example .env.local   # y completar
npm run dev
```

El schema vive en `supabase/migrations/`, en orden. Se aplica desde el SQL Editor del
proyecto (o con la CLI de Supabase): cada archivo una sola vez.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública. Va al navegador por diseño: lo que protege los datos es RLS |
| `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`, `SHEET_ID` | Solo para `scripts/exportar-sheet.mjs` mientras dure la migración. Después se borran |

No hay clave de servicio en la app: todo se lee y se escribe como el usuario logueado.

## Login y usuarios

Entrar con Google o con mail y contraseña (con "Crear cuenta" en la misma pantalla).
Cada cuenta ve **solo lo suyo**: todas las tablas tienen `user_id` (lo pone la base con
`auth.uid()`) y una política RLS `user_id = auth.uid()`. El proxy (`proxy.ts`) refresca
la sesión y manda al login a quien no la tenga; los endpoints lo vuelven a chequear.

- Google: proyecto de Google Cloud `dinerillo`, cliente OAuth "Dinerillo web". La
  pantalla de consentimiento está en **Prueba**: solo entran con Google los mails de la
  lista de usuarios de prueba. El resto puede crear cuenta con mail.
- Supabase → Authentication → URL Configuration: cada dominio donde corra la app tiene
  que estar en *Redirect URLs* (`https://dominio/**`).

## La decisión de diseño que importa

**Las condiciones viven en el contrato, no en la app.**

Hoy los contratos son 15% cada 3 meses, comisión 7%, 12 meses, mora 2% diario y vencen
el 10. Pero eso es lo que se pactó *esta vez*. Cada fila de `contratos` guarda sus
propios `aumento_pct`, `aumento_meses`, `meses`, `comision_pct`, `mora_pct_diario`,
`dia_vencimiento` y `prorrateo_pct`. La tabla `ajustes` sólo guarda con qué valores
viene **precargado el formulario**; cambiarla no toca ningún contrato ya cargado.

Y por si la fórmula no alcanza: **cualquier mes puede llevar un importe fijado a mano**
(tabla `alq_fijados`). Le gana a la proyección. Con eso entra un contrato atado al ICL,
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
parte junto con el alquiler. **Se carga el total de la boleta una sola vez** (tabla
`alq_boletas`) y cada contrato se lleva su `prorrateo_pct`.

Con dos inquilinos al 50% el total queda cubierto. Si los porcentajes de los contratos
vigentes no suman 100, la app avisa: la diferencia la está poniendo el dueño.

Los gastos que nadie reintegra (un arreglo, el seguro) **no se cargan en este módulo**:
se decidió sacarlos. Si hace falta registrarlos, van a los gastos personales.

## La base

Proyecto de Supabase `dinerillo` (São Paulo). Tablas del módulo de alquileres, con
prefijo `alq_`:

- `alq_propiedades` — `id, nombre, direccion, tipo, nota, orden`
- `alq_contratos` — `id, propiedad_id, inquilino, telefono, email, fecha_inicio, meses, ajuste_tipo, alquiler_inicial, aumento_pct, aumento_meses, comision_pct, mora_pct_diario, dia_vencimiento, prorrateo_pct, deposito, nota`
- `alq_fijados` — `id, contrato_id, periodo, monto, nota` (importes fijados a mano)
- `alq_cobros` — `id, contrato_id, periodo, fecha_cobro, importe, nota`
- `alq_boletas` — `id, tipo, periodo, fecha, propiedad_id, monto, nota` (solo las que se reparten)
- `ajustes` — `clave, valor` por usuario

Todas llevan además `user_id, created_at, deleted_at`. Las claves foráneas incluyen
`user_id`, así un contrato no puede colgar de una propiedad de otra cuenta.

`id` es un ULID generado en el server: **es la clave para editar y borrar**.

**Borrado = borrado blando.** Se escribe `deleted_at`. El borrado físico pasa sólo al
vaciar la papelera desde Ajustes.

La API sigue usando los nombres de antes (`/api/gastos`, `/api/alquileres`): el mapeo a
tablas está en `TABLAS`, en `lib/repo.ts`.

## Colores de los gráficos

La paleta de series está en `app/globals.css` como `--color-serie-1..8`, en orden fijo, y
está validada para daltonismo (protan / deutan / tritan) sobre fondo blanco. **El color
sigue a la propiedad, no a su posición en un ranking**, y no se generan colores nuevos
más allá del slot 8.

La escalera de alquileres se dibuja con `stepAfter`: el alquiler es una función escalón y
dibujarlo interpolado sería mentir sobre el dato.
