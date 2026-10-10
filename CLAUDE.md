# Dinerillo

La plata del mes en un solo lugar: **ingresos**, **gastos**, **división** de gastos con
alguien y, para quien tiene propiedades, **alquileres** (cobros, aumentos, boletas que se
reparten entre inquilinos). Cualquiera puede crearse una cuenta. Antes se llamaba
Rentifay y vivía en una Google Sheet.

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
| `ANTHROPIC_API_KEY` | Secreta. Para la carga asistida (`/api/ia`). Solo en el server |
| `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`, `SHEET_ID` | Solo para `scripts/exportar-sheet.mjs` mientras dure la migración. Después se borran |

No hay clave de servicio en la app: todo se lee y se escribe como el usuario logueado.

## Login y usuarios

Entrar con Google o con mail y contraseña (con "Crear cuenta" en la misma pantalla).
Cada cuenta ve **solo lo suyo**: todas las tablas tienen `user_id` (lo pone la base con
`auth.uid()`) y una política RLS `user_id = auth.uid()`. El proxy (`proxy.ts`) refresca
la sesión y manda al login a quien no la tenga; los endpoints lo vuelven a chequear.
Los dos usan `getClaims()`, que verifica la firma del token ahí mismo: sin un viaje a
Supabase en cada navegación (`getUser()` lo hacía y se notaba).

- **¿Olvidaste la contraseña?** en el login manda un link; vuelve por `/auth/callback`
  con `siguiente=/nueva-clave` (único destino permitido) y ahí se elige la nueva.
- **Eliminar mi cuenta** (Ajustes) llama a `eliminar_mi_cuenta()` (migración 0005):
  borra el usuario de Auth y, por el `on delete cascade` de cada tabla, todos sus datos.
  Solo puede borrarse a uno mismo. Sin clave de servicio.

- Google: proyecto de Google Cloud `dinerillo`, cliente OAuth "Dinerillo web". La
  pantalla de consentimiento está en **Prueba**: solo entran con Google los mails de la
  lista de usuarios de prueba. El resto puede crear cuenta con mail.
- Supabase → Authentication → URL Configuration: cada dominio donde corra la app tiene
  que estar en *Redirect URLs* (`https://dominio/**`).

**Bienvenida** (`/bienvenida`): una cuenta nueva contesta cuatro preguntas (nombre, de
dónde le entra la plata, meta de ahorro, si divide gastos) y la app queda armada: crea
los ingresos elegidos (Alquileres es una opción más entre ellos), ocho categorías de
base y guarda `onboarding` en `ajustes`. El
`Shell` manda ahí a quien no tiene `onboarding` ni datos; a quien ya usaba la app lo
marca `onboarding=previo` en silencio. Cada paso se guarda al seguir.

**Tu cuenta** vive en el avatar de arriba (`components/MenuPerfil.tsx`): nombre, mail,
Ajustes, instalar y cerrar sesión. El nombre que se muestra es `ajustes.nombre` o, si no
hay, el primer nombre de la cuenta (`nombreVisible` en `lib/useData.ts`).

## Módulos y pantallas

Pestañas abajo (en compu, arriba): **Inicio · Ingresos · Gastos · División**. División
desaparece si la persona dijo que no divide gastos (`ajustes.divide = "no"`) y no tiene
ninguno cargado; Alquileres aparece en Ingresos solo si lo eligió como ingreso
(`ajustes.alquileres = "si"`) o ya cargó un contrato (`usaDivision` / `usaAlquileres` en
`lib/useData.ts`). No hay un interruptor de Alquileres en Ajustes: se activa desde "Nuevo
ingreso" (¿Alquilás propiedades?). Arriba, el ojito que oculta los montos y el avatar.

- **Inicio** (`/`): lo que te quedó en el mes, entró/salió, **ahorrado / disponible** con
  el botón "Ahorrar" (`components/PanelAhorro.tsx`), atajos de carga, avisos accionables y
  el gráfico del año.
- **Ingresos** (`/ingresos`, `/ingresos/[id]`): fuentes que crea el usuario (nada
  precargado), cada una con su moneda y sus cobros. Alquileres aparece como un ingreso
  más y abre su módulo. Arriba, la meta de ahorro y Dictar/Factura para cargar cobros.
- **Alquileres** (`/alquileres/...`): tres secciones, **Cobros** (`/alquileres`: lo que
  falta cobrar, la lista para cobrar, el próximo aumento, lo real del año a la fecha y
  los cobros anteriores), **Boletas** (en el celu, un mes a la vez) y **Contratos** (con
  la escalera de cada contrato y, plegados al final, los valores con que arranca un
  contrato nuevo). `/cobros`, `/alquileres/cobros` y `/contratos` redirigen.
- **Gastos** (`/gastos`): los gastos personales + una línea "Compartidos con …" con tu
  parte, que se calcula desde División (no se copia).
- **División** (`/division`): gastos con la pareja, quién pagó y qué parte es tuya. El
  saldo dice quién le pasa cuánto a quién; "Ya se transfirió" lo marca como saldado.

Todas las cuentas del mes están en `lib/finanzas.ts`, puras como `calc.ts`, y se
verifican en `npm test`. Reglas:

- Todo se compara en pesos: un cobro en otra moneda guarda el tipo de cambio del día.
- Ingreso de alquileres = lo cobrado menos el reintegro de boletas (eso es plata que vuelve).
- Tu gasto de lo compartido es tu parte, la pague quien la pague.
- La transferencia del ajuste con la pareja no es ingreso ni gasto.
- **Lo que te quedó no es lo que ahorraste.** Te quedó = entró − salió. Ahorrado = lo que
  apartaste a propósito ese mes (tabla `ahorros`, en pesos o dólares con el tipo de
  cambio del día). Disponible = te quedó − ahorrado. La meta (15% de lo que entró, por
  defecto) se cumple con lo ahorrado, no con lo que sobró.

Guardar un gasto, un cobro o un ahorro se ve al instante: la pantalla actualiza la caché
de SWR con la fila nueva (`actualizarLocal` en `lib/useData.ts`) y atrás vuelve a leer
todo. Las funciones de Vercel corren en São Paulo (`gru1` en `vercel.json`), al lado de
la base.

Borrar es blando y se puede deshacer desde el aviso de abajo (`PATCH` con
`restaurar: true`).

## Carga asistida (dictado y facturas)

Botones "Dictar" y "Factura" en Inicio, Ingresos, Gastos, División y Boletas
(`components/Asistente.tsx`). El texto dictado (Web Speech API del navegador, gratis) o
el PDF/foto van a `/api/ia`, que llama a Claude (`claude-haiku-4-5`, tope de 800 tokens
de salida, timeout 25 s con un reintento) y devuelve los datos interpretados. **Nunca
guarda:** abre el formulario precargado para revisar. El archivo no se guarda en ningún
lado. Las fotos se achican a 1600 px en el navegador antes de mandarlas. La pantalla corta
a los 35 s y vuelve a habilitar los botones. Necesita `ANTHROPIC_API_KEY` en Vercel.

En Inicio decide lo que se entendió: gasto, compartido, boleta, cobro de un ingreso
("hoy cobré 5 millones de sueldo") o ahorro ("aparté 200 dólares"). Un cobro de un
ingreso que no existe abre "¿De qué ingreso?" con los tuyos y la opción de crearlo ahí.
Para que se vea a dónde va, el formulario de gasto nuevo muestra arriba **Mío / Con
{pareja}** ya elegido y se cambia de un toque. Lo que la persona no usa no se ofrece: sin
División, "compartido" cae en gasto; sin Alquileres, una factura de luz es un gasto y no
una boleta (el server y la pantalla lo filtran los dos).

## PDF de División

"Compartir PDF" en División arma el detalle del mes con jsPDF (cargado recién al tocar el
botón, `lib/pdfDivision.ts`) y abre la hoja de compartir del celular (WhatsApp); en la
compu lo descarga. Mismo formato que el viejo Divisor de Gastos.

## Gastos fijos

Lo que se paga todos los meses (`gastos_fijos`, migración 0006). Se crean desde Gastos →
"Fijos del mes", con "Todos los meses" al cargar un gasto, o aceptando una sugerencia.

- **Monto fijo** (Netflix, alquiler): se carga solo. Al abrir la app, el `Shell` carga
  los que ya tocaron este mes y no están (`fijosParaCargarSolos`). Cada gasto lleva
  `fijo_id` y un índice único impide cargar dos veces el mismo fijo en el mes.
- **Monto que varía** (la luz): "Para hacer" pide confirmarlo tres días antes, con el
  promedio de los últimos tres meses como estimado.
- **Sugerencias**: el mismo concepto ("Luz octubre" = "luz") en dos de los últimos tres
  meses, una o dos veces por mes (`sugerirFijos`). Si el monto varía se sugiere como
  variable, con el promedio. Es contar, no IA: gratis y sin mandar datos a nadie.

## Administración y errores

`/admin` (link en el menú del avatar, solo para quien está en la tabla `admins`):
usuarios, activos, usos y costo estimado de la IA, y los últimos errores con su detalle.
Lo deciden las funciones `admin_*` de la base (security definer): nunca muestran montos.

Los errores se guardan en `errores`: los del navegador los manda `ReportarErrores`
(y `app/error.tsx` / `app/global-error.tsx`), y los del server `registrarError`
(`lib/errores.ts`, después de responder). Los logs crudos siguen en Vercel → Logs.

**Sugerencias** ("Sugerir una mejora" en el menú del avatar, `components/MandarMejora.tsx`):
un texto libre que se manda y listo; la persona no lo vuelve a ver ni le hace seguimiento
(tabla `mejoras`, migraciones 0007 y 0008, tope 10 por día). El admin las lee en `/admin`,
sin marcarlas ni clasificarlas. Los martes a la 1 corre la tarea programada
`dinerillo-mejoras-semanal` (app de escritorio de Claude): lee desde el SQL Editor por Chrome
las que llegaron desde el informe anterior (el Supabase de dinerillo está en otra cuenta, el
conector MCP no llega), las clasifica y analiza contra el código, y escribe el informe en
`informes-mejoras/AAAA-MM-DD.md` (ignorado por git: tiene texto de usuarios). No escribe en
la base.

**Topes de la IA** (`/api/ia`): 30 usos por persona por día y 400 entre todos
(`ia_usos`), 500 tokens de salida por pedido, fotos a 1600 px y PDFs de hasta 2 MB.

**Páginas legales**: `/privacidad` y `/terminos`, públicas, con el contacto en
`components/Legal.tsx`.

## Formularios

- **`Panel`** (`components/ui.tsx`) es un diálogo flotante centrado, en celu y en compu,
  montado en un portal. Se centra en el área visible (`visualViewport`): con el teclado
  abierto no queda tapado. Al abrir, el foco va al diálogo y **no a un campo**: el
  teclado no salta solo. Esc cierra solo el de arriba (un panel puede abrir otro).
- **`InputPlata`** formatea mientras escribís: `1.234.567,89`, con el símbolo de la
  moneda adelante (`simbolo="US$"`). El punto del teclado numérico abre los centavos;
  pegar `17.872` o `1,234.50` se entiende. El valor sigue siendo texto y se lee con
  `aNumero` de `lib/format.ts` (la máscara es `enmascararMonto`, probada en
  `scripts/verificar-formato.js`). `grande` para el importe protagonista.
- **`ajustes`** acepta solo las claves de `CLAVES_AJUSTES` (`lib/schemas.ts`), con tope
  de largo: con registro abierto, el endpoint no guarda cualquier cosa.

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
- `ajustes` — `clave, valor` por usuario (`nombre`, `onboarding`, `ahorro_pct`, `divide`,
  `pareja_nombre`, `div_mi_pct`, `alquileres` y los `def_*` del contrato nuevo)

Del resto de los módulos: `ingresos`, `ingreso_cobros` (con `tipo_cambio`),
`categorias` (compartidas entre Gastos y División, color = slot de la paleta),
`gastos`, `div_gastos` (`pago`, `mi_pct`), `div_cierres` y `ahorros` (`monto`, `moneda`,
`tipo_cambio`; migración 0005, ya aplicada en el proyecto `dinerillo`).

Todas llevan además `user_id, created_at, deleted_at`. Las claves foráneas incluyen
`user_id`, así un contrato no puede colgar de una propiedad de otra cuenta.

`id` es un ULID generado en el server: **es la clave para editar y borrar**.

**Borrado = borrado blando.** Se escribe `deleted_at`. El borrado físico pasa sólo al
vaciar la papelera desde Ajustes.

El mapeo de recurso de la API a tabla está en `TABLAS`, en `lib/repo.ts`. Ojo con dos
nombres: `/api/boletas` son las boletas de alquileres y `/api/mis-gastos` los gastos
personales; `/api/alquileres` son los importes fijados a mano.

## Diseño

Contexto de producto en `PRODUCT.md` (divertida, clara, liviana; estilo Lemon con paleta
propia). Lo visual:

- **Paleta** (tokens en `app/globals.css`, OKLCH): azul eléctrico `acento` (marca,
  tarjetas principales), `lima` (acción principal: botones y el "+", siempre con tinta
  encima), `celeste` / `celeste-claro` (superficies suaves, pestaña activa), blanco de
  fondo. Contrastes verificados AA.
- **Tipografía:** Figtree para todo; Bricolage Grotesque (`.numero`, `.titulo`) solo para
  números grandes y títulos. Las dos tienen cifras tabulares. Se sirven con `next/font`.
- **Emojis:** Fluent Emoji 3D (Microsoft, MIT) en `public/emoji/*.webp` a 128 px, nunca
  el emoji del sistema. Catálogo y sugerencia por nombre en `lib/emoji.ts`; categorías e
  ingresos guardan el nombre en la columna `emoji`.
- **Movimiento:** contador en los números grandes (`<Monto animado>`), entrada de filas
  (`.lista-entra`), `pop` en emojis, confeti solo al saldar el mes (`lib/festejo.ts`).
  Todo respeta `prefers-reduced-motion`.

## Colores de los gráficos

La paleta de series está en `app/globals.css` como `--color-serie-1..8`, en orden fijo, y
está validada para daltonismo (protan / deutan / tritan) sobre fondo blanco. **El color
sigue a la propiedad, no a su posición en un ranking**, y no se generan colores nuevos
más allá del slot 8.

Hay dos gráficos, nada más (`components/Graficos.tsx`), y los dos se esconden con el ojito:

- **Mes a mes** (Inicio): una barra por mes con lo que te quedó, verde si sobró y roja si
  faltó; el mes elegido resaltado y el mes en curso a media tinta (está incompleto).
- **Escalera de cada contrato** (Contratos): se dibuja con `stepAfter`, porque el alquiler
  es una función escalón y dibujarlo interpolado sería mentir sobre el dato. Eje desde 0,
  línea "hoy" y el color de su propiedad.

Se sacaron "cobrado vs. esperado" (con inquilinos al día, todo da igual) y "de cada peso
facturado" (una constante del contrato que además mezclaba el reintegro).
