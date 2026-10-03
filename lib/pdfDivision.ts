// El PDF del mes de División, para mandarlo por WhatsApp. Mismo formato que
// usaba la app Divisor de Gastos: arriba la frase que importa (quién le pasa
// cuánto a quién), después el detalle, el resumen y el reparto por categoría.

// Solo el tipo: jsPDF pesa ~380 kB y se carga recién al tocar el botón.
import type JsPdf from "jspdf";
import type { Division } from "./finanzas";
import { periodoLargo } from "./format";
import type { Categoria, DivGasto } from "./types";

/** jspdf-autotable cuelga esto del documento sin declararlo. */
type Doc = JsPdf & { lastAutoTable?: { finalY: number } };

const IZQ = 18;
const DER = 192;
const CENTRO = 105;
const FONDO_PAGINA = 275;

const nf = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plata = (n: number) => `$ ${nf.format(n)}`;

/**
 * La letra del PDF (Helvetica) no tiene emojis ni símbolos fuera de Latin-1:
 * "Nahi ❤️" saldría con basura. Se quedan las letras.
 */
const limpio = (s: string) => s.replace(/[^ -ÿ]/g, "").replace(/\s+/g, " ").trim();

const fecha = (iso: string) => iso.split("-").reverse().join("/");

export function fraseDelAjuste(d: Division, yo: string, pareja: string): string {
  if (Math.abs(d.saldo) < 1) return "Están a mano.";
  return d.saldo > 0
    ? `${pareja} le transfiere ${plata(d.saldo)} a ${yo}.`
    : `${yo} le transfiere ${plata(-d.saldo)} a ${pareja}.`;
}

export async function pdfDivision(entrada: {
  mes: string;
  yo: string;
  pareja: string;
  gastos: DivGasto[];
  categorias: Categoria[];
  division: Division;
}): Promise<Blob> {
  const [{ default: JsPdfCtor }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new JsPdfCtor({ unit: "mm", format: "a4" }) as Doc;

  const yo = limpio(entrada.yo) || "Yo";
  const pareja = limpio(entrada.pareja) || "Pareja";
  const d = entrada.division;
  const cats = new Map(entrada.categorias.map((c) => [c.id, c]));
  const mesTitulo = periodoLargo(entrada.mes).replace(/^./, (c) => c.toUpperCase());

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text("División de gastos", IZQ, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(mesTitulo, IZQ, 27);
  doc.text(`${yo} · ${pareja}`, DER, 27, { align: "right" });

  doc.setDrawColor(215);
  doc.setLineWidth(0.3);
  doc.line(IZQ, 31, DER, 31);

  // El ajuste es el punto del documento: va primero.
  doc.setTextColor(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(fraseDelAjuste(d, yo, pareja), IZQ, 41, { maxWidth: DER - IZQ });

  const filas = [...entrada.gastos].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.created_at.localeCompare(b.created_at)
  );

  autoTable(doc, {
    startY: 50,
    head: [["Fecha", "Detalle", "Categoría", "Monto", "Pagó", "Reparto"]],
    body: filas.length
      ? filas.map((g) => {
          const c = g.categoria_id ? cats.get(g.categoria_id) : undefined;
          return [
            fecha(g.fecha),
            limpio(g.descripcion),
            c && !c.deleted_at ? limpio(c.nombre) : "-",
            nf.format(g.monto),
            g.pago === "yo" ? yo : pareja,
            `${Math.round(g.mi_pct)}% / ${Math.round(100 - g.mi_pct)}%`,
          ];
        })
      : [["", "Sin gastos cargados", "", "", "", ""]],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2, textColor: 40 },
    headStyles: {
      fontStyle: "bold",
      textColor: 90,
      lineWidth: { bottom: 0.3, top: 0, left: 0, right: 0 },
      lineColor: [200, 200, 200],
    },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: 22 },
      3: { halign: "right", cellWidth: 28 },
      5: { halign: "right", cellWidth: 26 },
    },
    margin: { left: IZQ, right: 18 },
  });

  let y = (doc.lastAutoTable?.finalY ?? 60) + 12;

  y = seccion(doc, "Resumen", y);
  for (const [etiqueta, valor] of [
    ["Total del mes", plata(d.total)],
    [`Pagó ${yo}`, plata(d.pagueYo)],
    [`Pagó ${pareja}`, plata(d.pagoPareja)],
    [`Le corresponde a ${yo}`, plata(d.miParte)],
    [`Le corresponde a ${pareja}`, plata(d.suParte)],
  ] as const) {
    y = fila(doc, etiqueta, valor, y);
  }

  // Por categoría: el total compartido de cada una, con su peso en el mes.
  const porCat = new Map<string, { nombre: string; total: number; n: number }>();
  for (const g of filas) {
    const c = g.categoria_id ? cats.get(g.categoria_id) : undefined;
    const clave = c && !c.deleted_at ? c.id : "";
    const acc = porCat.get(clave) ?? { nombre: clave ? limpio(c!.nombre) : "Sin categoría", total: 0, n: 0 };
    acc.total += g.monto;
    acc.n += 1;
    porCat.set(clave, acc);
  }
  if (porCat.size && d.total > 0) {
    y = seccion(doc, "Por categoría", y + 6);
    for (const c of [...porCat.values()].sort((a, b) => b.total - a.total)) {
      y = fila(doc, `${c.nombre} · ${c.n}`, `${plata(c.total)}   ${Math.round((c.total / d.total) * 100)}%`, y);
    }
  }

  if (d.cierre) {
    y = seccion(doc, "Estado", y + 6);
    fila(doc, `Transferido el ${fecha(d.cierre.fecha)}`, plata(d.cierre.monto), y);
  }

  const generado = `Generado con Dinerillo el ${new Date().toLocaleDateString("es-AR")}`;
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(generado, CENTRO, 287, { align: "center" });
  }

  return doc.output("blob");
}

function seccion(doc: Doc, titulo: string, y: number): number {
  const en = saltoSiHaceFalta(doc, y);
  doc.setDrawColor(215);
  doc.setLineWidth(0.3);
  doc.line(IZQ, en - 5, DER, en - 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text(titulo, IZQ, en);
  return en + 8;
}

function fila(doc: Doc, etiqueta: string, valor: string, y: number): number {
  const en = saltoSiHaceFalta(doc, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(etiqueta, IZQ, en);
  doc.setTextColor(30);
  doc.text(valor, DER, en, { align: "right" });
  return en + 6;
}

function saltoSiHaceFalta(doc: Doc, y: number): number {
  if (y <= FONDO_PAGINA) return y;
  doc.addPage();
  return 22;
}

/**
 * Compartir el PDF. En el celular abre la hoja de compartir del sistema (ahí
 * está WhatsApp); en la compu, o si el navegador no deja compartir archivos,
 * lo descarga.
 */
export async function compartirPdf(blob: Blob, nombre: string, texto: string): Promise<"compartido" | "descargado" | "cancelado"> {
  const archivo = new File([blob], nombre, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [archivo] })) {
    try {
      await nav.share({ files: [archivo], title: nombre, text: texto });
      return "compartido";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
      // Si falla por otra cosa, que al menos lo descargue.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "descargado";
}
