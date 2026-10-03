// El set de emojis propio: Fluent Emoji 3D de Microsoft (licencia MIT), en
// public/emoji/<nombre>.webp a 128 px. Se guardan en la app y no se usa el
// emoji del sistema: así se ven igual en un Android, un iPhone y la compu, y
// funcionan sin conexión.
//
// Una categoría o un ingreso guardan el nombre; si no tienen, se sugiere uno
// por las palabras de su nombre.

export interface EmojiDef {
  nombre: string;
  /** Para el lector de pantalla cuando el emoji aporta algo, y para elegir. */
  etiqueta: string;
  /** Palabras que lo sugieren, en minúscula y sin tildes. */
  claves: string[];
}

export const EMOJIS: EmojiDef[] = [
  { nombre: "carrito", etiqueta: "Carrito", claves: ["super", "mercado", "compra", "almacen", "chino", "verduleria", "carniceria"] },
  { nombre: "casa", etiqueta: "Casa", claves: ["alquiler", "casa", "hogar", "expensa", "depto", "departamento", "vivienda"] },
  { nombre: "luz", etiqueta: "Lamparita", claves: ["luz", "edesur", "edenor", "electricidad", "energia"] },
  { nombre: "agua", etiqueta: "Gota", claves: ["agua", "aysa"] },
  { nombre: "fuego", etiqueta: "Fuego", claves: ["gas", "metrogas", "naturgy", "garrafa"] },
  { nombre: "antena", etiqueta: "Señal", claves: ["internet", "wifi", "flow", "fibertel", "telecentro", "personal", "movistar", "claro"] },
  { nombre: "celular", etiqueta: "Celular", claves: ["celular", "telefono", "linea", "redes"] },
  { nombre: "tarjeta", etiqueta: "Tarjeta", claves: ["tarjeta", "tc", "visa", "master", "amex", "credito", "cuota"] },
  { nombre: "impuestos", etiqueta: "Edificio público", claves: ["impuesto", "agip", "arba", "abl", "afip", "arca", "monotributo", "inmobiliario", "municipal"] },
  { nombre: "salud", etiqueta: "Pastilla", claves: ["salud", "osde", "prepaga", "swiss", "galeno", "farmacia", "medico", "remedio"] },
  { nombre: "auto", etiqueta: "Auto", claves: ["auto", "nafta", "combustible", "seguro", "patente", "estacionamiento", "peaje", "uber", "cabify"] },
  { nombre: "colectivo", etiqueta: "Colectivo", claves: ["colectivo", "sube", "transporte", "subte", "tren"] },
  { nombre: "comida", etiqueta: "Hamburguesa", claves: ["comida", "delivery", "rappi", "pedidos", "almuerzo", "cena", "resto", "restaurant"] },
  { nombre: "pizza", etiqueta: "Pizza", claves: ["pizza"] },
  { nombre: "cafe", etiqueta: "Café", claves: ["cafe", "desayuno", "merienda"] },
  { nombre: "cerveza", etiqueta: "Cervezas", claves: ["salida", "bar", "birra", "cerveza", "boliche"] },
  { nombre: "pochoclo", etiqueta: "Pochoclo", claves: ["cine", "entretenimiento", "teatro", "recital"] },
  { nombre: "tele", etiqueta: "Tele", claves: ["netflix", "streaming", "disney", "hbo", "max", "prime", "spotify", "suscripcion"] },
  { nombre: "musica", etiqueta: "Música", claves: ["musica", "spotify"] },
  { nombre: "juego", etiqueta: "Joystick", claves: ["juego", "play", "steam", "gaming"] },
  { nombre: "ropa", etiqueta: "Remera", claves: ["ropa", "zapatilla", "indumentaria", "vestimenta"] },
  { nombre: "zapatilla", etiqueta: "Zapatilla", claves: ["gimnasio", "gym", "deporte", "running", "club"] },
  { nombre: "tijera", etiqueta: "Tijera", claves: ["peluqueria", "barberia", "corte", "belleza"] },
  { nombre: "regalo", etiqueta: "Regalo", claves: ["regalo", "cumple", "cumpleanos"] },
  { nombre: "avion", etiqueta: "Avión", claves: ["viaje", "vacaciones", "pasaje", "vuelo", "hotel"] },
  { nombre: "libros", etiqueta: "Libros", claves: ["educacion", "curso", "facultad", "libro", "colegio", "ucema"] },
  { nombre: "perro", etiqueta: "Perro", claves: ["perro", "mascota", "veterinaria"] },
  { nombre: "gato", etiqueta: "Gato", claves: ["gato"] },
  { nombre: "bebe", etiqueta: "Mamadera", claves: ["bebe", "hijo", "panales"] },
  { nombre: "herramientas", etiqueta: "Herramientas", claves: ["arreglo", "reparacion", "mantenimiento", "plomero", "electricista", "ferreteria"] },
  { nombre: "planta", etiqueta: "Planta", claves: ["vivero", "jardin", "planta"] },
  { nombre: "paquete", etiqueta: "Paquete", claves: ["mercadolibre", "envio", "compras", "online", "amazon"] },
  { nombre: "maletin", etiqueta: "Maletín", claves: ["sueldo", "salario", "trabajo", "recibo"] },
  { nombre: "laptop", etiqueta: "Notebook", claves: ["consultoria", "freelance", "cliente", "proyecto"] },
  { nombre: "mundo", etiqueta: "Mundo", claves: ["ciudadania", "bulgara", "exterior", "afuera"] },
  { nombre: "camara", etiqueta: "Cámara", claves: ["instagram", "tiktok", "youtube", "contenido"] },
  { nombre: "llave", etiqueta: "Llave", claves: ["alquileres", "inquilino", "propiedad"] },
  { nombre: "bolsa-plata", etiqueta: "Bolsa de plata", claves: ["ahorro", "inversion", "plazo", "fondo"] },
  { nombre: "grafico", etiqueta: "Gráfico", claves: ["acciones", "cedear", "bonos", "rendimiento"] },
  { nombre: "billete", etiqueta: "Dólar", claves: ["dolar", "usd"] },
  { nombre: "euro", etiqueta: "Euro", claves: ["euro", "eur"] },
  { nombre: "moneda", etiqueta: "Moneda", claves: ["varios", "otro", "otros", "extra"] },
  { nombre: "corazones", etiqueta: "Corazones", claves: ["pareja", "nahi", "regalo pareja"] },
  { nombre: "recibo", etiqueta: "Recibo", claves: ["factura", "boleta", "servicios", "servicio"] },
  // Solo para la interfaz (avisos, atajos, festejos): no se ofrecen para elegir.
  { nombre: "brote", etiqueta: "Brote", claves: [] },
  { nombre: "microfono", etiqueta: "Micrófono", claves: [] },
  { nombre: "plata-vuela", etiqueta: "Plata con alas", claves: [] },
  { nombre: "check", etiqueta: "Listo", claves: [] },
  { nombre: "calendario", etiqueta: "Calendario", claves: [] },
  { nombre: "alerta", etiqueta: "Atención", claves: [] },
  { nombre: "ojo", etiqueta: "Ojos", claves: [] },
  { nombre: "cara-feliz", etiqueta: "Cara feliz", claves: [] },
  { nombre: "guino", etiqueta: "Guiño", claves: [] },
  { nombre: "pensando", etiqueta: "Pensando", claves: [] },
  { nombre: "fiesta", etiqueta: "Fiesta", claves: [] },
  { nombre: "cohete", etiqueta: "Cohete", claves: [] },
  { nombre: "trofeo", etiqueta: "Trofeo", claves: [] },
  { nombre: "chispas", etiqueta: "Chispas", claves: [] },
];

const POR_NOMBRE = new Map(EMOJIS.map((e) => [e.nombre, e]));

/** Los que se ofrecen para elegir: todos los del set con alguna palabra clave. */
export const ELEGIBLES = EMOJIS.filter((e) => e.claves.length > 0);

const sinTildes = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** El emoji que mejor encaja con un nombre ("Super del finde" → carrito). */
export function sugerirEmoji(nombre: string, porDefecto = "moneda"): string {
  const palabras = sinTildes(nombre).split(/[^a-z0-9]+/).filter(Boolean);
  for (const p of palabras) {
    const hit = EMOJIS.find((e) => e.claves.some((c) => p === c || (c.length > 3 && p.startsWith(c))));
    if (hit) return hit.nombre;
  }
  return porDefecto;
}

/** El guardado si existe en el set; si no, el sugerido por el nombre. */
export function emojiDe(guardado: string | undefined, nombre: string, porDefecto?: string): string {
  return guardado && POR_NOMBRE.has(guardado) ? guardado : sugerirEmoji(nombre, porDefecto);
}

export const rutaEmoji = (nombre: string) => `/emoji/${POR_NOMBRE.has(nombre) ? nombre : "moneda"}.webp`;
