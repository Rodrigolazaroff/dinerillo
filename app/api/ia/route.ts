import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hoyISO } from "@/lib/format";
import { registrarError } from "@/lib/errores";
import { exigirEditor } from "@/lib/guard";
import { TIPOS_GASTO } from "@/lib/schemas";
import { supabaseServer } from "@/lib/supabase/server";

// Carga asistida: un texto dictado ("luz 40 mil compartido") o una factura
// (PDF o foto) entra, y sale lo que hay que cargar. Este endpoint NO guarda
// nada: devuelve la interpretación y la pantalla abre el formulario ya
// completo para que la persona la revise y toque "Cargar".
//
// El archivo se manda a Claude y se descarta: no se escribe en ningún lado.

// El más barato que lee PDFs y fotos: una factura sale ~US$0,003 y un dictado
// ~US$0,001. La respuesta es un JSON chico, así que el tope de salida es bajo.
const MODELO = "claude-haiku-4-5";
const MAX_TOKENS_SALIDA = 500;

// Topes de uso: por persona, para que nadie se coma la cuenta, y entre todos,
// para que la factura de Anthropic tenga techo aunque se sumen muchas cuentas.
const TOPE_POR_PERSONA = 30;
const TOPE_DIARIO_TOTAL = 400;

// Si Claude se traba, se corta a los 25 segundos y se reintenta una sola vez:
// la pantalla también tiene su propio límite y vuelve a habilitar el botón.
const TIMEOUT_MS = 25_000;
const REINTENTOS = 1;

/** Vercel corta los pedidos en 4,5 MB; el base64 pesa un tercio más. */
const MAX_BASE64 = 4_000_000;

// Dos intentos de 25 s entran holgados; más que esto, la pantalla ya cortó.
export const maxDuration = 60;

const TIPOS_ARCHIVO = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const pedidoSchema = z.object({
  texto: z.string().trim().max(2000).optional(),
  /** Desde qué pantalla se dictó: en Ingresos todo es un cobro. */
  pantalla: z.enum(["libre", "gasto", "compartido", "boleta", "ingreso"]).optional(),
  archivo: z
    .object({
      tipo: z.enum(TIPOS_ARCHIVO),
      base64: z.string().max(MAX_BASE64, "El archivo es muy pesado. Probá con uno de menos de 3 MB."),
    })
    .optional(),
});

const fecha = z.string().nullable().describe("YYYY-MM-DD o null si no se sabe");

/** Lo que devuelve el modelo. Todo nullable: mejor un campo vacío que inventado. */
const interpretacionSchema = z.object({
  destino: z
    .enum(["gasto", "compartido", "boleta", "cobro_ingreso", "ahorro"])
    .describe(
      "gasto: gasto personal. compartido: gasto a dividir con la pareja. boleta: boleta de una propiedad alquilada que se reparte entre inquilinos. cobro_ingreso: plata que entró (sueldo, honorarios, un pago). ahorro: plata que la persona apartó para ahorrar (plazo fijo, dólares, FCI)."
    ),
  monto: z.number().nullable().describe("Importe en número, sin separadores. En facturas, el total a pagar."),
  descripcion: z.string().describe("1 a 4 palabras, como la escribiría la persona: 'Luz', 'Agua', 'Super del finde'. Sin razón social ni número de factura."),
  fecha: fecha.describe("Cuándo se pagó o se cobró. 'ayer', 'el viernes', etc. se resuelven contra hoy."),
  periodo: z.string().nullable().describe("YYYY-MM al que corresponde. En facturas, el período facturado."),
  vencimiento: fecha.describe("Solo facturas: el primer vencimiento."),
  categoria: z.string().nullable().describe("Exactamente uno de los nombres de categoría dados, o null."),
  pago: z.enum(["yo", "pareja"]).nullable().describe("Solo compartido: quién pagó."),
  mi_pct: z.number().nullable().describe("Solo compartido: qué % es de la persona (0-100). null si no lo dijo."),
  tipo_boleta: z.enum(TIPOS_GASTO).nullable().describe("Solo boleta."),
  ingreso: z.string().nullable().describe("Solo cobro_ingreso: exactamente uno de los nombres de ingreso dados, o null."),
  nombre_ingreso: z
    .string()
    .nullable()
    .describe("Solo cobro_ingreso: cómo lo nombró la persona, 1 a 3 palabras con mayúscula inicial ('Sueldo', 'Consultoría'), aunque no esté en la lista. null si no lo dijo."),
  moneda: z.enum(["ARS", "USD"]).nullable().describe("La moneda del monto: USD si dijo dólares, verdes, USD o US$. Si no, ARS."),
  duda: z
    .string()
    .nullable()
    .describe("Algo que la persona tenga que revisar, en una frase. null si está todo claro."),
});


const SISTEMA = `Ayudás a cargar movimientos en una app argentina de finanzas personales.
Recibís un texto dictado o una factura y devolvés los datos para precargar un formulario; la persona siempre lo revisa antes de guardar.

Reglas:
- Montos en formato argentino: "40 mil" = 40000, "85 lucas" = 85000, "1,5 palos" = 1500000, "$ 17.872,66" = 17872.66.
- En facturas, el monto es el TOTAL A PAGAR del período. Si hay saldo anterior, recargo o dos vencimientos, usá el total del primer vencimiento y explicalo en "duda".
- "compartido", "a medias", "con [nombre de la pareja]" → destino compartido. "lo pagó [pareja]" → pago pareja.
- "cobré", "me pagaron", "me depositaron", "entró el sueldo" → destino cobro_ingreso. El ingreso es el de la lista que corresponda aunque lo diga distinto ("el sueldo" → "Sueldo"); si no hay uno que corresponda, ingreso = null y nombre_ingreso con cómo lo llamó.
- "ahorré", "aparté", "puse en un plazo fijo", "compré dólares para ahorrar" → destino ahorro; la descripcion dice dónde ("Plazo fijo", "Dólares").
- Si no dice quién pagó, pago = "yo". Si no dice qué parte es suya, mi_pct = null: la app usa el porcentaje de siempre. Ninguna de las dos cosas es una duda.
- Sin fecha, usá hoy.
- En facturas de servicios: descripcion = el servicio ("Luz", "Gas", "Agua", "Internet"); periodo = el último mes facturado, en YYYY-MM.
- Categoría e ingreso: solo nombres de las listas dadas, escritos igual. Si ninguno encaja, null.
- No inventes datos: lo que no está, va null.`;

export async function POST(req: Request) {
  const no = await exigirEditor();
  if (no) return no;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta configurar ANTHROPIC_API_KEY." }, { status: 503 });
  }

  const parsed = pedidoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Pedido inválido" }, { status: 400 });
  }
  const { texto, archivo, pantalla } = parsed.data;
  if (!texto && !archivo) {
    return NextResponse.json({ error: "Decí o subí algo para cargar." }, { status: 400 });
  }

  const supabase = await supabaseServer();

  // Antes de gastar: los topes del día. Si la tabla no existe todavía, sigue.
  const desde = new Date(Date.now() - 86_400_000).toISOString();
  const [propios, total] = await Promise.all([
    supabase.from("ia_usos").select("id", { count: "exact", head: true }).gte("created_at", desde),
    supabase.rpc("ia_usos_hoy_total"),
  ]);
  if ((propios.count ?? 0) >= TOPE_POR_PERSONA) {
    return NextResponse.json(
      { error: `Llegaste a las ${TOPE_POR_PERSONA} cargas asistidas de hoy. Mañana se renuevan; mientras, cargalo a mano.` },
      { status: 429 }
    );
  }
  if (typeof total.data === "number" && total.data >= TOPE_DIARIO_TOTAL) {
    registrarError("Se llegó al tope diario total de la IA", `${total.data} usos`, "/api/ia");
    return NextResponse.json({ error: "El asistente descansa por hoy. Cargalo a mano." }, { status: 503 });
  }

  // El contexto que necesita para elegir bien: las listas de la persona.
  const [cats, ings, ajustes, contratos] = await Promise.all([
    supabase.from("categorias").select("nombre").is("deleted_at", null),
    supabase.from("ingresos").select("nombre, moneda").is("deleted_at", null).is("archivado_at", null),
    supabase.from("ajustes").select("clave, valor").in("clave", ["pareja_nombre", "divide", "alquileres"]),
    supabase.from("alq_contratos").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);
  const categorias = (cats.data ?? []).map((c) => c.nombre);
  const ingresos = (ings.data ?? []).map((i) => `${i.nombre} (${i.moneda})`);
  const ajuste = (k: string) => ajustes.data?.find((a) => a.clave === k)?.valor ?? "";
  const pareja = ajuste("pareja_nombre") || "la pareja";
  // Lo que la persona no usa no se ofrece: sin pareja no hay compartidos, y
  // sin alquileres una factura de luz es un gasto y no una boleta.
  const divide = ajuste("divide") !== "no";
  const alquileres = ajuste("alquileres") === "si" || (contratos.count ?? 0) > 0;

  const contexto = [
    `Hoy es ${hoyISO()}.`,
    divide ? `La pareja se llama: ${pareja}.` : "La persona no divide gastos con nadie: nunca uses destino compartido.",
    alquileres
      ? `Tipos de boleta: ${TIPOS_GASTO.join(", ")}.`
      : "La persona no tiene propiedades en alquiler: nunca uses destino boleta; una factura de servicios es un gasto.",
    `Categorías: ${categorias.length ? categorias.join(", ") : "(ninguna todavía)"}.`,
    `Ingresos: ${ingresos.length ? ingresos.join(", ") : "(ninguno todavía)"}.`,
    pantalla === "ingreso" ? "Está en la pantalla de Ingresos: es un cobro de ingreso." : "",
    texto ? `Lo que dijo: "${texto}"` : "Leé la factura adjunta.",
  ].join("\n");

  const contenido: Anthropic.ContentBlockParam[] = [];
  if (archivo) {
    contenido.push(
      archivo.tipo === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: archivo.base64 } }
        : { type: "image", source: { type: "base64", media_type: archivo.tipo, data: archivo.base64 } }
    );
  }
  contenido.push({ type: "text", text: contexto });

  try {
    const client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: REINTENTOS });
    const respuesta = await client.messages.parse({
      model: MODELO,
      max_tokens: MAX_TOKENS_SALIDA,
      system: SISTEMA,
      output_config: { format: zodOutputFormat(interpretacionSchema) },
      messages: [{ role: "user", content: contenido }],
    });

    // Cada uso cuenta para el tope y para ver cuánto se gasta en /admin.
    await supabase.from("ia_usos").insert({
      tipo: archivo ? "archivo" : "texto",
      tokens_entrada: respuesta.usage.input_tokens,
      tokens_salida: respuesta.usage.output_tokens,
    });

    if (respuesta.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "No pude terminar de leerlo. Cargalo a mano." }, { status: 422 });
    }
    if (respuesta.stop_reason === "refusal") {
      return NextResponse.json({ error: "No pude leer eso. Cargalo a mano." }, { status: 422 });
    }
    const datos = respuesta.parsed_output;
    if (!datos) {
      return NextResponse.json({ error: "No entendí. Probá de nuevo o cargalo a mano." }, { status: 422 });
    }

    // Formatos: la pantalla espera YYYY-MM y YYYY-MM-DD. Si vino otra cosa
    // ("08/2026-09/2026", "15/10/26"), se rescata lo que se pueda o se descarta.
    datos.periodo = aPeriodo(datos.periodo);
    datos.fecha = aFecha(datos.fecha);
    datos.vencimiento = aFecha(datos.vencimiento);
    if (datos.monto !== null && !(datos.monto > 0)) datos.monto = null;
    if (datos.mi_pct !== null && !(datos.mi_pct >= 0 && datos.mi_pct <= 100)) datos.mi_pct = null;
    if (!divide && datos.destino === "compartido") datos.destino = "gasto";
    if (!alquileres && datos.destino === "boleta") datos.destino = "gasto";

    // Solo nombres que existen: si el modelo se tomó una licencia, se descarta.
    if (datos.categoria && !categorias.includes(datos.categoria)) datos.categoria = null;
    // El ingreso, escrito exactamente como en la lista: si el modelo cambió una
    // mayúscula se corrige, y si no existe queda para elegir o crear.
    const nombresIngreso = (ings.data ?? []).map((i) => i.nombre);
    const mismo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    const pedido = datos.ingreso ?? datos.nombre_ingreso;
    datos.ingreso = (pedido && nombresIngreso.find((n) => mismo(n, pedido))) || null;
    if (datos.nombre_ingreso) datos.nombre_ingreso = datos.nombre_ingreso.trim().slice(0, 60) || null;

    return NextResponse.json({ ok: true, datos });
  } catch (e) {
    if (e instanceof Anthropic.APIConnectionTimeoutError) {
      return NextResponse.json({ error: "El asistente tardó demasiado. Probá de nuevo." }, { status: 504 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Muchos pedidos seguidos. Esperá un momento." }, { status: 429 });
    }
    if (e instanceof Anthropic.AuthenticationError) {
      registrarError("La clave de Anthropic no es válida", e.message, "/api/ia");
      return NextResponse.json({ error: "La clave de Anthropic no es válida." }, { status: 503 });
    }
    if (e instanceof Anthropic.BadRequestError) {
      console.error("[dinerillo/ia]", e.message);
      return NextResponse.json({ error: "No pude leer ese archivo. Probá con otro o cargalo a mano." }, { status: 400 });
    }
    if (e instanceof Anthropic.APIError) {
      console.error("[dinerillo/ia]", e.status, e.message);
      registrarError(`Anthropic respondió ${e.status}`, e.message, "/api/ia");
      return NextResponse.json({ error: "El asistente no respondió. Probá de nuevo." }, { status: 502 });
    }
    throw e;
  }
}

/** "2026-09", "09/2026", "08/2026-09/2026" (se queda con el último) → "2026-09". */
function aPeriodo(v: string | null): string | null {
  if (!v) return null;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return v;
  const meses = [...v.matchAll(/(0?[1-9]|1[0-2])[/-](\d{4})/g)];
  const ultimo = meses.at(-1);
  return ultimo ? `${ultimo[2]}-${ultimo[1].padStart(2, "0")}` : null;
}

/** "2026-10-15" o "15/10/2026" → "2026-10-15". Otra cosa, null. */
function aFecha(v: string | null): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}
