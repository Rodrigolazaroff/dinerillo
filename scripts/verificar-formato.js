// Verificacion del campo de plata (lib/format.ts): la mascara que formatea
// mientras escribis y la lectura de lo tipeado.
//
//   npm test
const f = require("../.test-build/format.js");

let fallas = 0;
function chequeo(nombre, obtenido, esperado) {
  const ok = Number.isNaN(esperado) ? Number.isNaN(obtenido) : obtenido === esperado;
  if (!ok) fallas++;
  console.log(`${ok ? "  ok  " : " FALLA"} ${nombre.padEnd(52)} ${JSON.stringify(obtenido).padStart(16)}  esperado ${JSON.stringify(esperado)}`);
}

/** Tipea `teclas` una por una sobre un campo vacío, como en el celular. */
function tipear(teclas, decimales = 2) {
  let v = "";
  for (const t of teclas) v = f.enmascararMonto(v + t, v, decimales);
  return v;
}

console.log("\n=== mientras se escribe ===");
chequeo("1234567", tipear("1234567"), "1.234.567");
chequeo("1234,5", tipear("1234,5"), "1.234,5");
chequeo("el punto del teclado abre centavos", tipear("1234.56"), "1.234,56");
chequeo("no más de dos centavos", tipear("12,345"), "12,34");
chequeo("una coma sola arranca en cero", tipear(","), "0,");
chequeo("sin ceros adelante", tipear("0005"), "5");
chequeo("letras afuera", tipear("12a3"), "123");
chequeo("sin decimales, la coma no entra", tipear("12,5", 0), "125");

console.log("\n=== borrar y pegar ===");
chequeo("borrar un dígito de 1.234 deja 123", f.enmascararMonto("1.23", "1.234"), "123");
chequeo("borrar la coma junta los dígitos", f.enmascararMonto("1.2345", "1.234,5"), "12.345");
chequeo("pegar 17.872 son miles", f.enmascararMonto("17.872", ""), "17.872");
chequeo("pegar 1234.5 son centavos", f.enmascararMonto("1234.5", ""), "1.234,5");
chequeo("pegar $ 1.234.567,89", f.enmascararMonto("$ 1.234.567,89", ""), "1.234.567,89");
chequeo("vacío", f.enmascararMonto("", "5"), "");
chequeo("una segunda coma no hace nada", f.enmascararMonto("12,5,", "12,5"), "12,5");
chequeo("pegar 1,234.50 (formato inglés)", f.enmascararMonto("1,234.50", ""), "1.234,50");
chequeo("con 4 decimales, 1.234 pegado son miles", f.enmascararMonto("1.234", "", 4), "1.234");
chequeo("tipo de cambio con 4 decimales", tipear("1234,5678", 4), "1.234,5678");

console.log("\n=== leer lo tipeado ===");
chequeo("1.234.567,89", f.aNumero("1.234.567,89"), 1234567.89);
chequeo("17.872", f.aNumero("17.872"), 17872);
chequeo("17.87", f.aNumero("17.87"), 17.87);
chequeo("0,", f.aNumero("0,"), 0);
chequeo("vacío es NaN", f.aNumero(""), NaN);
chequeo("ida y vuelta 17872.66", f.aNumero(f.aCampo(17872.66)), 17872.66);
chequeo("tipo de cambio sin redondear", f.aCampo(1234.5678, 4), "1.234,5678");

console.log(fallas ? `\n${fallas} FALLAS` : "\nTODO OK: el campo de plata escribe y lee bien.");
process.exit(fallas ? 1 : 0);
