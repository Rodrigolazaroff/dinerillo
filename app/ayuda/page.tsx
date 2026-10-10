"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { Emoji } from "@/components/Emoji";
import { pedirRecorrido } from "@/components/Recorrido";
import { Shell } from "@/components/Shell";
import { IconoFlecha } from "@/components/iconos";
import { clasesBoton } from "@/components/ui";
import { useData, usaAlquileres, usaDivision } from "@/lib/useData";

// Preguntas frecuentes, en el menú del avatar. Cortas, como las contestaría
// un amigo: qué tocar, no cómo funciona por dentro. Lo que la persona no usa
// (División, Alquileres) no se explica: se le cuenta cómo prenderlo.
//
// Un link a /ayuda#dolares abre esa pregunta.

interface Pregunta {
  id: string;
  p: string;
  r: ReactNode;
}

interface Tema {
  id: string;
  emoji: string;
  titulo: string;
  preguntas: Pregunta[];
}

function temas({ divide, alquila }: { divide: boolean; alquila: boolean }): Tema[] {
  return [
    {
      id: "mes",
      emoji: "bolsa-plata",
      titulo: "Tu mes",
      preguntas: [
        {
          id: "te-quedo",
          p: "¿Qué es «Te quedó»?",
          r: <>Lo que entró menos lo que salió en el mes. Se arma solo con lo que cargás en Ingresos y Gastos.</>,
        },
        {
          id: "ahorrado",
          p: "¿Qué diferencia hay entre Ahorrado y Disponible?",
          r: (
            <>
              <strong>Ahorrado</strong> es lo que apartaste a propósito con el botón Ahorrar, en pesos o en
              dólares. <strong>Disponible</strong> es lo que te quedó menos eso: lo que tenés a mano para gastar.
            </>
          ),
        },
        {
          id: "meta",
          p: "¿Cómo funciona la meta de ahorro?",
          r: (
            <>
              Es un porcentaje de lo que entró en el mes. La barrita se llena con lo que apartás con Ahorrar, no
              con lo que sobra: sobrar no es ahorrar. El porcentaje lo cambiás en Ajustes.
            </>
          ),
        },
        {
          id: "otro-mes",
          p: "¿Cómo veo otro mes?",
          r: <>Con las flechas de arriba, al lado del nombre del mes.</>,
        },
      ],
    },
    {
      id: "cargar",
      emoji: "tarjeta",
      titulo: "Cargar",
      preguntas: [
        {
          id: "gasto",
          p: "¿Cómo cargo un gasto?",
          r: (
            <>
              En Inicio tocá <strong>Gasto</strong>, o en Gastos el <strong>“+”</strong> de abajo (en la compu,{" "}
              <strong>Nuevo gasto</strong>). Monto, qué fue y una categoría.
            </>
          ),
        },
        {
          id: "dictar",
          p: "¿Cómo funcionan Dictar y Factura?",
          r: (
            <>
              Con <strong>Dictar</strong> decís algo como «ayer el súper 85 lucas»; con <strong>Factura</strong>{" "}
              subís la foto o el PDF. La app completa el formulario y vos lo revisás antes de guardar: nunca se
              guarda solo, y el archivo no queda guardado en ningún lado. Si tu navegador no reconoce la voz, lo
              escribís como lo dirías.
            </>
          ),
        },
        {
          id: "cobro",
          p: "¿Cómo anoto lo que cobro?",
          r: (
            <>
              En Ingresos entrá a la fuente (tu sueldo, por ejemplo) y cargá el cobro. Si todavía no existe, creala
              con <strong>Nuevo ingreso</strong>.
            </>
          ),
        },
        {
          id: "dolares",
          p: "Cobro en dólares, ¿cómo lo cargo?",
          r: (
            <>
              Creá ese ingreso en dólares y, en cada cobro, anotá el tipo de cambio del día. Así todo se compara en
              pesos.
            </>
          ),
        },
        {
          id: "fijos",
          p: "¿Qué son los gastos fijos?",
          r: (
            <>
              Lo que pagás todos los meses. Marcá <strong>Todos los meses</strong> al cargar el gasto, o armalos en
              Gastos → <strong>Fijos del mes</strong>. Si el monto es siempre igual (Netflix) se carga solo; si varía
              (la luz), te pide confirmarlo unos días antes. Si algo se repite, la app te lo sugiere.
            </>
          ),
        },
        {
          id: "editar",
          p: "¿Cómo edito o borro algo?",
          r: <>Tocalo en la lista: se abre para editarlo, y ahí también está Borrar.</>,
        },
        {
          id: "deshacer",
          p: "Borré algo sin querer",
          r: (
            <>
              Apenas lo borrás aparece un aviso abajo: tocá <strong>Deshacer</strong> y vuelve como estaba.
            </>
          ),
        },
      ],
    },
    {
      id: "division",
      emoji: "corazones",
      titulo: "Gastos compartidos",
      preguntas: divide
        ? [
            {
              id: "compartido",
              p: "¿Cómo cargo un gasto compartido?",
              r: (
                <>
                  En División tocá el <strong>“+”</strong>, o <strong>Compartido</strong> en Inicio. Elegís quién
                  pagó y qué parte es tuya; tu parte viene de Ajustes y se cambia en cada gasto.
                </>
              ),
            },
            {
              id: "saldo",
              p: "¿Cómo sé quién le pasa plata a quién?",
              r: (
                <>
                  División te dice cuánto le pasa uno al otro en el mes. Cuando hagan la transferencia, tocá{" "}
                  <strong>Ya se transfirió</strong> y queda saldado.
                </>
              ),
            },
            {
              id: "pdf",
              p: "¿Cómo le mando el detalle?",
              r: (
                <>
                  Con <strong>Compartir PDF</strong> en División: en el celu se abre para mandarlo por WhatsApp; en la
                  compu se descarga.
                </>
              ),
            },
            {
              id: "mi-parte",
              p: "¿Por qué en Gastos aparece solo una parte?",
              r: (
                <>
                  Porque tu gasto es tu parte, la haya pagado quien la haya pagado. Lo compartido va en una sola
                  línea, «Compartidos con…».
                </>
              ),
            },
          ]
        : [
            {
              id: "dividir",
              p: "¿Puedo dividir gastos con alguien?",
              r: (
                <>
                  Sí: en Ajustes prendé <strong>Divido gastos con alguien</strong> y aparece la pestaña División.
                </>
              ),
            },
          ],
    },
    {
      id: "alquileres",
      emoji: "llave",
      titulo: "Alquileres",
      preguntas: alquila
        ? [
            {
              id: "contrato",
              p: "¿Cómo cargo un contrato?",
              r: (
                <>
                  En Alquileres → <strong>Contratos</strong>. Cada uno guarda sus propias condiciones: aumento, cada
                  cuántos meses, comisión, mora y día de vencimiento.
                </>
              ),
            },
            {
              id: "a-mano",
              p: "Un mes se cobró distinto a lo pactado",
              r: (
                <>
                  En Contratos tocá <strong>Cambiar</strong> en ese mes y poné el importe: le gana a la cuenta.{" "}
                  <strong>Restaurar</strong> vuelve al calculado.
                </>
              ),
            },
            {
              id: "boletas",
              p: "¿Cómo reparto el agua o el inmobiliario?",
              r: (
                <>
                  En <strong>Boletas</strong> cargás el total una sola vez y cada contrato se lleva su parte. Si los
                  porcentajes no suman 100, la app te avisa.
                </>
              ),
            },
          ]
        : [
            {
              id: "alquilo",
              p: "¿Sirve si alquilo propiedades?",
              r: (
                <>
                  Sí: en Ingresos tocá <strong>Nuevo ingreso → ¿Alquilás propiedades?</strong> y se suma Alquileres,
                  con contratos, cobros y boletas.
                </>
              ),
            },
          ],
    },
    {
      id: "cuenta",
      emoji: "ojo",
      titulo: "Tu cuenta",
      preguntas: [
        {
          id: "ocultar",
          p: "¿Cómo oculto los montos?",
          r: <>Con el ojito de arriba. Sirve para mostrar la app sin mostrar tu plata.</>,
        },
        {
          id: "instalar",
          p: "¿La puedo tener como app en el celu?",
          r: (
            <>
              Sí: tocá tu foto → <strong>Instalar la app</strong>. Si no aparece, en Ajustes están los pasos.
            </>
          ),
        },
        {
          id: "ajustes",
          p: "¿Dónde cambio mi nombre, la meta o las categorías?",
          r: <>En Ajustes: tocá tu foto, arriba a la derecha.</>,
        },
        {
          id: "privacidad",
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
          id: "borrar-cuenta",
          p: "¿Cómo borro mi cuenta?",
          r: (
            <>
              En Ajustes → <strong>Eliminar mi cuenta</strong>. Se borra todo lo que cargaste.
            </>
          ),
        },
      ],
    },
  ];
}

export default function Ayuda() {
  const { data } = useData();
  const divide = data ? usaDivision(data) : true;
  const alquila = data ? usaAlquileres(data) : false;

  // /ayuda#dolares abre esa pregunta y la trae a la vista.
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="titulo flex items-center gap-2 text-2xl font-bold">
              <Emoji nombre="pensando" tamano="md" />
              Preguntas frecuentes
            </h1>
            <p className="mt-1 text-sm text-suave">Lo que más se pregunta, contestado corto.</p>
          </div>
          <Link href="/" onClick={pedirRecorrido} className={clasesBoton("secundario", "sm")}>
            <Emoji nombre="cohete" tamano="xs" />
            Ver el recorrido otra vez
          </Link>
        </div>

        {temas({ divide, alquila }).map((t) => (
          <section key={t.id} aria-labelledby={`tema-${t.id}`}>
            <h2 id={`tema-${t.id}`} className="titulo mb-2.5 flex items-center gap-2 text-lg font-bold">
              <Emoji nombre={t.emoji} tamano="sm" />
              {t.titulo}
            </h2>
            <div className="divide-y divide-linea rounded-2xl border border-borde bg-papel">
              {t.preguntas.map((q) => (
                <details key={q.id} id={q.id} className="group scroll-mt-20">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold sm:px-5 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">{q.p}</span>
                    <IconoFlecha className="shrink-0 text-tenue transition-transform duration-200 group-open:rotate-90" />
                  </summary>
                  <p className="px-4 pb-4 text-sm leading-relaxed text-suave sm:px-5 [&_strong]:text-tinta">{q.r}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <section className="flex flex-col items-center gap-2 rounded-2xl bg-celeste-claro px-5 py-6 text-center">
          <Emoji nombre="guino" tamano="xl" />
          <p className="titulo text-base font-semibold">¿No está tu pregunta?</p>
          <p className="max-w-xs text-xs leading-relaxed text-suave">
            Mandala en Ideas y mejoras: la leemos y te contestamos ahí mismo.
          </p>
          <Link href="/mejoras" className={`${clasesBoton("primario")} mt-1`}>
            Preguntar
          </Link>
        </section>
      </div>
    </Shell>
  );
}
