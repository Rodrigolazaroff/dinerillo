import { SignJWT, jwtVerify } from "jose";
import type { Rol } from "./types";

// Una sola clave para entrar. En el celular escribir usuario y contraseña es un
// bardo, asi que el rol lo define la clave que pongas:
//
//   AUTH_PASS_RODRIGO  -> editor  (carga, edita, borra)
//   AUTH_PASS_INVITADO -> lectura (ve todo, no escribe). Opcional: si no esta
//                         definida, el usuario de lectura no existe.

export const COOKIE = "rentifay_sesion";

export interface Sesion {
  usuario: string;
  rol: Rol;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("Falta AUTH_SECRET (minimo 16 caracteres) en las variables de entorno.");
  }
  return new TextEncoder().encode(s);
}

/** Comparacion en tiempo constante, para no filtrar la clave por timing. */
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export function verificarClave(clave: string): Sesion | null {
  const puesta = String(clave ?? "");
  const editor = process.env.AUTH_PASS_RODRIGO;
  if (editor && igual(puesta, editor)) return { usuario: "Rodrigo", rol: "editor" };

  const invitado = process.env.AUTH_PASS_INVITADO;
  if (invitado && igual(puesta, invitado)) return { usuario: "Invitado", rol: "lectura" };

  return null;
}

export async function firmarSesion(sesion: Sesion): Promise<string> {
  return new SignJWT({ usuario: sesion.usuario, rol: sesion.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(secret());
}

export async function leerSesion(token: string | undefined): Promise<Sesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const rol: Rol = payload.rol === "editor" ? "editor" : "lectura";
    return { usuario: String(payload.usuario ?? ""), rol };
  } catch {
    return null;
  }
}
