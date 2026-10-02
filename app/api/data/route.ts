import { NextResponse } from "next/server";
import { calcular } from "@/lib/calc";
import { hoyISO } from "@/lib/format";
import { sesionActual } from "@/lib/guard";
import { condicionesDefault, leerTodo } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * Un solo endpoint de lectura: devuelve las filas crudas y todo lo calculado.
 * Las seis tablas se piden en paralelo; RLS hace que cada uno vea solo lo suyo.
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
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No pude leer los datos";
    console.error("[dinerillo/data]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
