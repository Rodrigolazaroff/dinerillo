"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { Emoji } from "@/components/Emoji";
import { CONTACTO } from "@/components/Legal";
import { Shell } from "@/components/Shell";
import { clasesBoton } from "@/components/ui";
import { IconoFlecha } from "@/components/iconos";
import { marcarAyudaVista, mostrarAyudaInicial, useData, usaAlquileres, usaDivision } from "@/lib/useData";

// Cómo se usa, contado como lo contaría un amigo: qué responde cada pantalla y
// cómo se carga. Primero los cuatro pasos para arrancar; después cada pantalla
// plegada, para ir directo a lo que no se entiende. No explica cómo funciona
// la app por dentro: explica qué tocar.

const PASOS = [
  { emoji: "bolsa-plata", titulo: "Cargá lo que entra", texto: "En Ingresos creá tus fuentes (sueldo, changas, alquileres) y anotá cada cobro." },
  { emoji: "tarjeta", titulo: "Cargá lo que sale", texto: "Cada gasto con el “+”, dictándolo o con la foto de la factura. Lleva segundos." },
  { emoji: "brote", titulo: "Apartá tu ahorro", texto: "Con “Ahorrar” en Inicio marcás lo que guardaste a propósito este mes." },
  { emoji: "grafico", titulo: "Mirá cómo viene el mes", texto: "Inicio te dice cuánto te quedó, cuánto ahorraste y en qué se fue." },
];

interface Tema {
  id: string;
  emoji: string;
  titulo: string;
  bajada: string;
  cuerpo: ReactNode;
  ir?: { href: string; label: string };
}

function temas({ divide, alquila }: { divide: boolean; alquila: boolean }): Tema[] {
  return [
    {
      id: "inicio",
      emoji: "bolsa-plata",
      titulo: "Inicio",
      bajada: "Te quedó, ahorrado y disponible",
      ir: { href: "/", label: "Ir a Inicio" },
      cuerpo: (
        <>
          <ul>
            <li><strong>Te quedó</strong> = lo que entró menos lo que salió en el mes.</li>
            <li><strong>Ahorrado</strong> = lo que apartaste a propósito con “Ahorrar” (en pesos o en dólares).</li>
            <li><strong>Disponible</strong> = te quedó menos lo ahorrado: lo que tenés a mano para gastar.</li>
          </ul>
          <p>
            La barrita es tu meta de ahorro (por defecto, 15% de lo que entró). Se llena con lo que
            apartás, no con lo que sobró: sobrar no es ahorrar.
          </p>
          <p>
            Con las flechas de arriba cambiás de mes. En <strong>Para hacer</strong> aparece lo que
            pide que hagas algo: un gasto fijo por confirmar, un alquiler por cobrar.
          </p>
        </>
      ),
    },
    {
      id: "cargar",
      emoji: "microfono",
      titulo: "Cargar rápido: Dictar y Factura",
      bajada: "Hablale o mandale la foto",
      cuerpo: (
        <>
          <ul>
            <li>
              <strong>Dictar</strong>: tocalo y decí algo como “gasté 12 mil en el súper” o “hoy
              cobré 5 millones de sueldo”.
            </li>
            <li>
              <strong>Factura</strong>: subí la foto o el PDF de una factura o un ticket.
            </li>
          </ul>
          <p>
            Nunca se guarda solo: se abre el formulario ya completado para que lo revises y toques
            Guardar. La foto o el archivo no quedan guardados en ningún lado.
          </p>
          <p>Están en Inicio, Ingresos, Gastos{divide ? ", División" : ""}{alquila ? " y Boletas" : ""}.</p>
        </>
      ),
    },
    {
      id: "ingresos",
      emoji: "grafico",
      titulo: "Ingresos",
      bajada: "De dónde te entra la plata",
      ir: { href: "/ingresos", label: "Ir a Ingresos" },
      cuerpo: (
        <>
          <p>
            Cada fuente (sueldo, consultoría, redes) tiene su moneda. Entrá a una y cargá cada cobro
            con su fecha.
          </p>
          <p>
            ¿Cobrás en dólares? Al cargar el cobro anotás el tipo de cambio del día: así todo se
            compara en pesos.
          </p>
          {!alquila && (
            <p>
              ¿Alquilás propiedades? Tocá <strong>Nuevo ingreso → ¿Alquilás propiedades?</strong> y se
              suma Alquileres.
            </p>
          )}
        </>
      ),
    },
    {
      id: "gastos",
      emoji: "tarjeta",
      titulo: "Gastos",
      bajada: "En qué se te va",
      ir: { href: "/gastos", label: "Ir a Gastos" },
      cuerpo: (
        <>
          <p>
            Cargá con el <strong>“+”</strong> de abajo a la derecha: monto, qué fue y una categoría.
            Tocá un gasto para editarlo o borrarlo.
          </p>
          <p>
            <strong>Gastos fijos</strong> (Netflix, el alquiler, la luz): marcá “Todos los meses” al
            cargarlo, o armalos en <strong>Fijos del mes</strong>. Si el monto es siempre el mismo se
            carga solo; si varía, te pide confirmarlo unos días antes. Si la app ve que algo se repite,
            te lo sugiere.
          </p>
          {divide && (
            <p>
              Lo compartido aparece en una sola línea con <strong>tu parte</strong>, que sale de
              División.
            </p>
          )}
          <p>Las categorías se editan en Ajustes.</p>
        </>
      ),
    },
    {
      id: "division",
      emoji: "corazones",
      titulo: "División",
      bajada: "Gastos con tu pareja o roomie",
      ir: divide ? { href: "/division", label: "Ir a División" } : { href: "/ajustes", label: "Ir a Ajustes" },
      cuerpo: divide ? (
        <>
          <p>
            Cargá cada gasto compartido diciendo <strong>quién pagó</strong> y qué parte es tuya. La
            app suma y te dice quién le pasa cuánto a quién.
          </p>
          <p>
            Cuando hagan la transferencia, tocá <strong>Ya se transfirió</strong> y el mes queda
            saldado. Con <strong>Compartir PDF</strong> le mandás el detalle por WhatsApp.
          </p>
          <p>A tus gastos va solo tu parte, la haya pagado quien la haya pagado.</p>
        </>
      ) : (
        <p>
          Está apagada porque dijiste que no dividís gastos. Si eso cambia, prendé{" "}
          <strong>Divido gastos con alguien</strong> en Ajustes y aparece la pestaña.
        </p>
      ),
    },
    ...(alquila
      ? [
          {
            id: "alquileres",
            emoji: "llave",
            titulo: "Alquileres",
            bajada: "Contratos, cobros y boletas",
            ir: { href: "/alquileres", label: "Ir a Alquileres" },
            cuerpo: (
              <>
                <ul>
                  <li>
                    <strong>Contratos</strong>: cargá cada uno con sus condiciones (aumento, cada cuántos
                    meses, comisión, mora). La app arma la escalera de cuotas.
                  </li>
                  <li>
                    <strong>Cobros</strong>: lo que falta cobrar este mes y el próximo aumento. Anotá
                    cada cobro cuando entra la plata.
                  </li>
                  <li>
                    <strong>Boletas</strong>: el agua o el inmobiliario que te reintegran. Cargás el
                    total una vez y cada contrato se lleva su parte.
                  </li>
                </ul>
                <p>
                  ¿Un mes salió distinto a lo pactado? Fijá ese importe a mano en el contrato y le gana
                  a la cuenta.
                </p>
              </>
            ),
          } satisfies Tema,
        ]
      : []),
  ];
}

const PREGUNTAS: { p: string; r: ReactNode }[] = [
  {
    p: "Borré algo sin querer",
    r: <>Apenas lo borrás aparece un aviso abajo: tocá <strong>Deshacer</strong> y vuelve todo como estaba.</>,
  },
  {
    p: "¿Cómo oculto los montos?",
    r: <>Con el ojito de arriba. Sirve para mostrar la app sin mostrar cuánta plata tenés.</>,
  },
  {
    p: "¿La puedo tener como app en el celu?",
    r: <>Sí: tocá tu foto arriba a la derecha → <strong>Instalar la app</strong>. En iPhone, en Ajustes están los pasos.</>,
  },
  {
    p: "¿Quién ve lo que cargo?",
    r: (
      <>
        Solo vos. Más detalle en{" "}
        <Link href="/privacidad" className="font-semibold text-acento">
          Privacidad
        </Link>
        .
      </>
    ),
  },
  {
    p: "¿Cómo borro mi cuenta?",
    r: <>En Ajustes → <strong>Eliminar mi cuenta</strong>. Se borra todo lo que cargaste.</>,
  },
];

export default function Ayuda() {
  const { data } = useData();
  const divide = data ? usaDivision(data) : true;
  const alquila = data ? usaAlquileres(data) : false;

  // Si llegó desde la tarjeta de "¿Primera vez?", ya no hace falta mostrarla.
  const primeraVez = data ? mostrarAyudaInicial(data) : false;
  useEffect(() => {
    if (primeraVez) void marcarAyudaVista();
  }, [primeraVez]);

  // Un link a /ayuda#gastos abre ese tema y lo trae a la vista.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    const el = id ? document.getElementById(id) : null;
    if (el instanceof HTMLDetailsElement) {
      el.open = true;
      el.scrollIntoView({ block: "start" });
    }
  }, [data]);

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="titulo flex items-center gap-2 text-2xl font-bold">
            <Emoji nombre="pensando" tamano="md" />
            Cómo funciona
          </h1>
          <p className="mt-1 text-sm text-suave">Lo justo para arrancar, en un minuto.</p>
        </div>

        <section aria-labelledby="arrancar">
          <h2 id="arrancar" className="titulo mb-3 text-lg font-bold">
            Para arrancar
          </h2>
          <ol className="grid gap-2.5 sm:grid-cols-2">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="flex gap-3 rounded-2xl bg-celeste-claro px-4 py-3.5">
                <span className="relative shrink-0">
                  <Emoji nombre={p.emoji} tamano="lg" />
                  <span className="numero absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-acento text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{p.titulo}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-suave">{p.texto}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="pantallas">
          <h2 id="pantallas" className="titulo mb-3 text-lg font-bold">
            Cada pantalla
          </h2>
          <div className="flex flex-col gap-2.5">
            {temas({ divide, alquila }).map((t) => (
              <details
                key={t.id}
                id={t.id}
                className="group scroll-mt-20 rounded-2xl border border-borde bg-papel open:border-celeste"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <Emoji nombre={t.emoji} tamano="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{t.titulo}</span>
                    <span className="block text-xs text-tenue">{t.bajada}</span>
                  </span>
                  <IconoFlecha className="shrink-0 text-tenue transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none" />
                </summary>
                <div className="flex flex-col gap-2.5 border-t border-linea px-4 pb-4 pt-3 text-sm leading-relaxed text-suave sm:px-5 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-tinta [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
                  {t.cuerpo}
                  {t.ir && (
                    <Link href={t.ir.href} className={`${clasesBoton("secundario", "sm")} mt-1 w-fit`}>
                      {t.ir.label}
                      <IconoFlecha />
                    </Link>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="preguntas">
          <h2 id="preguntas" className="titulo mb-3 text-lg font-bold">
            Preguntas rápidas
          </h2>
          <div className="divide-y divide-linea rounded-2xl border border-borde bg-papel">
            {PREGUNTAS.map((q) => (
              <details key={q.p} className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">{q.p}</span>
                  <IconoFlecha className="shrink-0 text-tenue transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none" />
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-suave sm:px-5 [&_strong]:text-tinta">{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-center gap-2 rounded-2xl bg-celeste-claro px-5 py-6 text-center">
          <Emoji nombre="guino" tamano="xl" />
          <p className="titulo text-base font-semibold">¿Algo no se entiende o le falta algo?</p>
          <p className="max-w-xs text-xs leading-relaxed text-suave">
            Contame: lo que me digan va directo a la lista de pendientes.
          </p>
          <a href={`mailto:${CONTACTO}?subject=Dinerillo`} className={`${clasesBoton("primario")} mt-1`}>
            Escribime
          </a>
        </section>
      </div>
    </Shell>
  );
}
