-- ═══════════════════════════════════════════════════════════════════
-- Dinerillo · 0003 · qué pasa al vaciar la papelera
--
-- El borrado de todos los días es blando (deleted_at). Esto solo importa
-- cuando se vacía la papelera y una fila se va de verdad:
--
--   - una fuente de ingreso se lleva sus cobros: sin la fuente no se pueden
--     mostrar ni editar;
--   - una categoría deja a sus gastos "sin categoría": el gasto existió igual.
-- ═══════════════════════════════════════════════════════════════════

alter table public.ingreso_cobros
  drop constraint ingreso_cobros_user_id_ingreso_id_fkey,
  add constraint ingreso_cobros_user_id_ingreso_id_fkey
    foreign key (user_id, ingreso_id) references public.ingresos (user_id, id)
    on delete cascade;

-- `set null (categoria_id)`: solo esa columna, no el user_id de la clave.
alter table public.gastos
  drop constraint gastos_user_id_categoria_id_fkey,
  add constraint gastos_user_id_categoria_id_fkey
    foreign key (user_id, categoria_id) references public.categorias (user_id, id)
    on delete set null (categoria_id);

alter table public.div_gastos
  drop constraint div_gastos_user_id_categoria_id_fkey,
  add constraint div_gastos_user_id_categoria_id_fkey
    foreign key (user_id, categoria_id) references public.categorias (user_id, id)
    on delete set null (categoria_id);
