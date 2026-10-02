const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MESES_LARGO = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

/** Pesos sin centavos: en un alquiler de 600 lucas los centavos no dicen nada. */
export function plata(monto: number): string {
  const n = Number.isFinite(monto) ? monto : 0;
  const signo = n < 0 ? "−" : "";
  return `${signo}$ ${nf0.format(Math.abs(n))}`;
}

/** Con centavos, para el detalle de una boleta de agua de $17.872,66. */
export function plataExacta(monto: number): string {
  const n = Number.isFinite(monto) ? monto : 0;
  const signo = n < 0 ? "−" : "";
  return `${signo}$ ${nf2.format(Math.abs(n))}`;
}

export function plataCorta(monto: number): string {
  const n = Math.abs(monto);
  const signo = monto < 0 ? "−" : "";
  if (n >= 1_000_000) return `${signo}$ ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".", ",")}M`;
  if (n >= 10_000) return `${signo}$ ${Math.round(n / 1000)}k`;
  return plata(monto);
}

/** Ticks del eje Y: sin simbolo, una sola escala para todos. */
export function ejeCorto(v: number): string {
  const n = Math.abs(v);
  const escala = (div: number, sufijo: string) =>
    (v / div).toFixed(1).replace(/[.,]0$/, "").replace(".", ",") + sufijo;
  if (n >= 1_000_000) return escala(1_000_000, "M");
  if (n >= 1000) return escala(1000, "k");
  return String(Math.round(v));
}

export function pct(v: number, decimales = 1): string {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(decimales).replace(".", ",")}%`;
}

/** "2026-05" -> "may 26" */
export function periodoCorto(periodo: string): string {
  const [y, m] = periodo.split("-");
  const i = Number(m) - 1;
  if (!y || i < 0 || i > 11) return periodo;
  return `${MESES[i]} ${y.slice(2)}`;
}

/** "2026-05" -> "mayo 2026" */
export function periodoLargo(periodo: string): string {
  const [y, m] = periodo.split("-");
  const i = Number(m) - 1;
  if (!y || i < 0 || i > 11) return periodo;
  return `${MESES_LARGO[i]} ${y}`;
}

/** "2026-05-10" -> "10/05/26" */
export function fechaCorta(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

/** "2026-05-10" -> "10 de mayo" */
export function fechaDia(iso: string): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  const i = Number(m) - 1;
  if (i < 0 || i > 11) return iso;
  return `${Number(d)} de ${MESES_LARGO[i]}`;
}

export function hoyISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function periodoActual(): string {
  return hoyISO().slice(0, 7);
}

/** Suma meses a un "YYYY-MM" sin pasar por Date (evita lios de zona horaria). */
export function sumarMeses(periodo: string, n: number): string {
  const [y, m] = periodo.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const yy = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

/** Dias entre dos ISO. Positivo si `b` es posterior a `a`. */
export function diasEntre(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  if (!Number.isFinite(ms)) return 0;
  return Math.round(ms / 86_400_000);
}

/** Ultimo dia del mes, para que un vencimiento 31 en febrero no se vaya a marzo. */
export function ultimoDiaDelMes(periodo: string): number {
  const [y, m] = periodo.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function vencimientoDe(periodo: string, dia: number): string {
  const d = Math.min(Math.max(1, Math.round(dia) || 1), ultimoDiaDelMes(periodo));
  return `${periodo}-${String(d).padStart(2, "0")}`;
}

export function redondear(n: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round((Number.isFinite(n) ? n : 0) * f) / f;
}

/** Símbolo para mostrar al lado de un monto. Si no lo conocemos, el código. */
export function simboloMoneda(moneda: string): string {
  return ({ ARS: "$", USD: "US$", EUR: "€", BRL: "R$", BGN: "лв" } as Record<string, string>)[moneda] ?? moneda;
}

/** Un monto en su moneda: "US$ 1.200", "€ 300,50". */
export function enMoneda(monto: number, moneda: string): string {
  if (moneda === "ARS") return plata(monto);
  const entero = Number.isInteger(Math.round(monto * 100) / 100);
  return `${simboloMoneda(moneda)} ${(entero ? nf0 : nf2).format(Math.abs(monto))}`;
}
