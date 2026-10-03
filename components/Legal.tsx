import Link from "next/link";
import type { ReactNode } from "react";
import { Emoji } from "@/components/Emoji";

/** Las páginas legales: texto corto, legible y público (sin login). */
export function Legal({ titulo, actualizado, children }: { titulo: string; actualizado: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Link href="/" className="mb-8 inline-flex items-center gap-1.5">
        <Emoji nombre="moneda" tamano="md" />
        <span className="titulo text-xl font-extrabold text-acento">dinerillo</span>
      </Link>
      <h1 className="titulo text-3xl font-extrabold">{titulo}</h1>
      <p className="mt-1 text-xs text-tenue">Actualizado el {actualizado}</p>
      <div className="mt-6 flex flex-col gap-5 text-sm leading-relaxed text-suave [&_h2]:titulo [&_h2]:mb-1 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-tinta [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-tinta">
        {children}
      </div>
    </main>
  );
}

export const CONTACTO = "rodrigolazaroff@gmail.com";
