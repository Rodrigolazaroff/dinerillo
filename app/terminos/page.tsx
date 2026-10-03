import type { Metadata } from "next";
import Link from "next/link";
import { CONTACTO, Legal } from "@/components/Legal";

export const metadata: Metadata = { title: "Términos · Dinerillo" };

export default function Terminos() {
  return (
    <Legal titulo="Términos y condiciones" actualizado="3 de octubre de 2026">
      <p>Al crear una cuenta o usar Dinerillo aceptás estas condiciones. Son pocas.</p>

      <section>
        <h2>Qué es</h2>
        <p>
          Una herramienta gratuita para ordenar tus ingresos, gastos, ahorros y alquileres. Te
          ayuda a ver los números; <strong>no es asesoramiento financiero, contable ni
          impositivo</strong>.
        </p>
      </section>

      <section>
        <h2>Los números</h2>
        <p>
          Las cuentas (aumentos, mora, repartos, estimaciones de gastos fijos) se calculan con lo
          que vos cargás y las condiciones que pusiste. Revisalas antes de tomar una decisión o
          reclamarle algo a alguien.
        </p>
      </section>

      <section>
        <h2>La carga asistida</h2>
        <p>
          Dictar y Factura usan inteligencia artificial y pueden equivocarse: nada se guarda sin
          que lo revises. Tiene un tope de usos por día para que alcance para todos.
        </p>
      </section>

      <section>
        <h2>Tu cuenta</h2>
        <p>
          Sos responsable de lo que cargás y de cuidar tu acceso. Podés borrar tu cuenta cuando
          quieras desde Ajustes. Una cuenta que se use para algo ilegal o para dañar el servicio
          puede darse de baja.
        </p>
      </section>

      <section>
        <h2>El servicio</h2>
        <p>
          Se hace lo posible para que funcione siempre, pero puede haber cortes o errores.
          Dinerillo puede cambiar o dejar de existir; si pasa, se avisa antes para que puedas
          llevarte lo tuyo.
        </p>
      </section>

      <section>
        <h2>Privacidad y contacto</h2>
        <p>
          Qué datos se guardan y para qué está en la{" "}
          <Link className="font-medium text-acento" href="/privacidad">
            política de privacidad
          </Link>
          . Dudas o reclamos:{" "}
          <a className="font-medium text-acento" href={`mailto:${CONTACTO}`}>
            {CONTACTO}
          </a>
          . Rige la ley argentina.
        </p>
      </section>
    </Legal>
  );
}
