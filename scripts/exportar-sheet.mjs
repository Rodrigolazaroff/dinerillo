// Foto de la Sheet para migrarla a Supabase.
//
//   node --env-file=.env.local scripts/exportar-sheet.mjs <salida.json>
//
// Lee con el mismo repo.ts que usaba la app (asi los numeros salen ya
// normalizados igual que siempre) y guarda las filas, el resumen calculado y
// un conteo por tabla. Es solo lectura: no escribe nada en la planilla.
//
// La salida tiene datos personales: va a una carpeta temporal, nunca al repo.

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const salida = process.argv[2];
if (!salida) {
  console.error("Uso: node --env-file=.env.local scripts/exportar-sheet.mjs <salida.json>");
  process.exit(1);
}

execSync(
  "npx tsc scripts/legacy/repo-sheet.ts lib/calc.ts lib/format.ts --outDir .migrar-build --rootDir . --module commonjs " +
    "--target es2020 --moduleResolution node --skipLibCheck --esModuleInterop",
  { stdio: "inherit" }
);

const require = createRequire(import.meta.url);
const { leerTodo } = require("../.migrar-build/scripts/legacy/repo-sheet.js");
const { calcular } = require("../.migrar-build/lib/calc.js");

const hoy = process.env.HOY ?? new Date().toISOString().slice(0, 10);
const datos = await leerTodo();
const { resumen } = calcular(
  datos.propiedades, datos.contratos, datos.cobros, datos.gastos,
  datos.alquileres, datos.config, hoy
);

const conteo = Object.fromEntries(
  ["propiedades", "contratos", "alquileres", "cobros", "gastos"].map((t) => [t, datos[t].length])
);
conteo.config = Object.keys(datos.config).length;

writeFileSync(salida, JSON.stringify({ hoy, conteo, datos, resumen }, null, 2));

console.log("Filas por tabla:", conteo);
console.log("Borrados en papelera:",
  ["propiedades", "contratos", "alquileres", "cobros", "gastos"]
    .map((t) => `${t} ${datos[t].filter((x) => x.deleted_at).length}`).join(", "));
