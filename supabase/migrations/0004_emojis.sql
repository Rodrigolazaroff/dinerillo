-- ═══════════════════════════════════════════════════════════════════
-- Dinerillo · 0004 · un emoji para cada categoría y cada ingreso
--
-- Guarda el nombre del emoji del set propio (public/emoji/<nombre>.webp),
-- no el carácter: así se ve igual en todos los celulares. Vacío = la app
-- elige uno por el nombre de la categoría.
-- ═══════════════════════════════════════════════════════════════════

alter table public.categorias
  add column emoji text not null default '' check (emoji ~ '^[a-z0-9-]{0,30}$');

alter table public.ingresos
  add column emoji text not null default '' check (emoji ~ '^[a-z0-9-]{0,30}$');
