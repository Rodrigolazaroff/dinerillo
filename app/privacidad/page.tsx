import type { Metadata } from "next";
import { CONTACTO, Legal } from "@/components/Legal";

export const metadata: Metadata = { title: "Privacidad · Dinerillo" };

export default function Privacidad() {
  return (
    <Legal titulo="Política de privacidad" actualizado="3 de octubre de 2026">
      <p>
        Dinerillo es una app para ordenar tu plata del mes, hecha en Argentina por Rodrigo
        Lazaroff. Acá está, sin vueltas, qué datos guarda y qué hace con ellos.
      </p>

      <section>
        <h2>Qué datos guarda</h2>
        <ul>
          <li>Tu mail, tu nombre y, si entrás con Google, tu foto de perfil.</li>
          <li>Lo que cargás: ingresos, gastos, ahorros, gastos compartidos y alquileres.</li>
          <li>
            Datos técnicos mínimos: los errores de la app (qué pasó, en qué pantalla y desde qué
            navegador) y cuántas veces usás la carga asistida.
          </li>
          <li>Las ideas, críticas y comentarios que mandás desde &quot;Ideas y mejoras&quot;.</li>
        </ul>
      </section>

      <section>
        <h2>Para qué</h2>
        <p>
          Solo para mostrarte tus cuentas y que la app funcione. <strong>No hay publicidad, no se
          venden ni se comparten tus datos</strong> con nadie para otros fines.
        </p>
      </section>

      <section>
        <h2>Quién lo ve</h2>
        <p>
          Lo que cargás lo ves <strong>solo vos</strong>: la base de datos no le deja a ninguna otra
          cuenta leerlo. El administrador puede ver tu mail, cuándo te diste de alta y entraste,
          cuántas veces usaste la carga asistida, los errores que tuvo la app y las ideas que
          mandaste (para analizarlas puede usar Claude, de Anthropic); <strong>nunca tus
          montos ni tus movimientos</strong>.
        </p>
      </section>

      <section>
        <h2>Dónde vive y con quién se procesa</h2>
        <ul>
          <li>
            <strong>Supabase</strong>: la base de datos y el inicio de sesión, en servidores de São
            Paulo, Brasil.
          </li>
          <li>
            <strong>Vercel</strong>: donde corre la app.
          </li>
          <li>
            <strong>Anthropic</strong>: cuando usás Dictar o Factura, el texto o el archivo se manda
            para leerlo y precargar el formulario. Dinerillo no guarda el archivo.
          </li>
          <li>
            <strong>Google</strong>: si elegís entrar con Google.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cookies y tu dispositivo</h2>
        <p>
          Solo la cookie de la sesión, para que no tengas que entrar cada vez. Algunas preferencias
          (ocultar los montos, el mes que estabas mirando) quedan guardadas en tu celular.
        </p>
      </section>

      <section>
        <h2>Tus derechos</h2>
        <p>
          Podés ver y corregir tus datos en la app, y borrar tu cuenta con todo lo que cargaste
          desde <strong>Ajustes → Eliminar mi cuenta</strong>. También podés pedir acceso,
          rectificación o supresión escribiendo a{" "}
          <a className="font-medium text-acento" href={`mailto:${CONTACTO}`}>
            {CONTACTO}
          </a>
          , según la Ley 25.326 de Protección de Datos Personales.
        </p>
        <p className="mt-2">
          La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, tiene
          la atribución de atender las denuncias y reclamos que se presenten por incumplimiento de
          las normas sobre protección de datos personales.
        </p>
      </section>

      <section>
        <h2>Cambios</h2>
        <p>Si esta política cambia, se actualiza esta página con la fecha nueva.</p>
      </section>
    </Legal>
  );
}
