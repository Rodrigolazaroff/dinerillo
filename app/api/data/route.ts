import { NextResponse } from "next/server";
import { calcular } from "@/lib/calc";
import { hoyISO } from "@/lib/format";
import { sesionActual } from "@/lib/guard";
import { condicionesDefault, leerTodo } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * Un solo endpoint de lectura: devuelve las filas crudas y todo lo calculado.
 * Es una sola llamada a Sheets por refresco, que es lo que tarda.
 */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) {
    return NextResponse.json({ error: "Sesión vencida. Volvé a entrar." }, { status: 401 });
  }
  try {
    const datos = await leerTodo();
    const hoy = hoyISO();
    const { contratos: calculados, resumen } = calcular(
      datos.propiedades, datos.contratos, datos.cobros, datos.gastos,
      datos.alquileres, datos.config, hoy
    );
    return NextResponse.json(
      {
        ...datos,
        condiciones: condicionesDefault(datos.config),
        calculados,
        resumen,
        sesion,
        hoy,
        // Para el link "abrir la planilla" de Ajustes. No es un secreto: la
        // planilla igual pide estar logueado con la cuenta de Google.
        sheetId: process.env.SHEET_ID ?? "",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No pude leer la planilla";
    console.error("[rentifay/data]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
