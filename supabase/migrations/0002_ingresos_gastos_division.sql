-- ═══════════════════════════════════════════════════════════════════
-- Dinerillo · 0002 · ingresos, gastos y división
--
-- Mismas reglas que el módulo de alquileres: id ULID del server, borrado
-- blando con deleted_at, user_id puesto por la base y RLS por usuario.
--
-- Nada viene precargado: las fuentes de ingreso y las categorías las crea
-- cada uno. Los números que alguien mencione son el dato, no la regla.
-- ═══════════════════════════════════════════════════════════════════

-- ── fuentes de ingreso ("Sueldo", "Consultoría", lo que sea) ─────────
-- Alquileres no vive acá: sale del módulo de alquileres y se muestra al lado.
create table public.ingresos (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre       text not null check (char_length(nombre) between 1 and 60),
  -- Código ISO 4217: ARS, USD, EUR… La fuente cobra siempre en la misma moneda.
  moneda       text not null default 'ARS' check (moneda ~ '^[A-Z]{3}$'),
  nota         text not null default '',
  orden        integer not null default 0,
  archivado_at timestamptz,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (user_id, id)
);

-- ── lo que se fue cobrando de cada fuente ───────────────────────────
create table public.ingreso_cobros (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ingreso_id   text not null,
  fecha        date not null,                     -- cuándo entró la plata
  periodo      text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),  -- a qué mes corresponde
  monto        numeric(14, 2) not null check (monto > 0),   -- en la moneda de la fuente
  -- Pesos por unidad de la moneda, el día que entró. En pesos vale 1. Queda
  -- guardado para que lo que ya pasó no cambie cuando se mueve el dólar.
  tipo_cambio  numeric(14, 4) not null default 1 check (tipo_cambio > 0),
  nota         text not null default '',
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  foreign key (user_id, ingreso_id) references public.ingresos (user_id, id)
);

-- ── categorías, compartidas entre Gastos y División ─────────────────
create table public.categorias (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 40),
  -- Uno de los ocho colores de la paleta (--color-serie-N). Sigue a la
  -- categoría, no a su posición en un ranking.
  color       integer not null default 1 check (color between 1 and 8),
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (user_id, id)
);

-- ── mis gastos (los personales, siempre en pesos) ───────────────────
create table public.gastos (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha         date not null,
  periodo       text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  descripcion   text not null check (char_length(descripcion) between 1 and 80),
  monto         numeric(14, 2) not null check (monto > 0),
  categoria_id  text,
  nota          text not null default '',
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  foreign key (user_id, categoria_id) references public.categorias (user_id, id)
);

-- ── gastos compartidos con la pareja ────────────────────────────────
-- Se cargan una sola vez, con quién pagó y qué parte es tuya. Tu parte
-- aparece en Gastos como una línea por mes: no se copia, se calcula.
create table public.div_gastos (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha         date not null,
  periodo       text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  descripcion   text not null check (char_length(descripcion) between 1 and 80),
  monto         numeric(14, 2) not null check (monto > 0),
  pago          text not null default 'yo' check (pago in ('yo', 'pareja')),
  mi_pct        numeric(5, 2) not null default 50 check (mi_pct between 0 and 100),
  categoria_id  text,
  nota          text not null default '',
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  foreign key (user_id, categoria_id) references public.categorias (user_id, id)
);

-- ── el ajuste del mes ya transferido ────────────────────────────────
-- La transferencia no es ingreso ni gasto: es plata que vuelve. Solo se
-- registra para dejar de avisar que hay una deuda pendiente.
create table public.div_cierres (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  periodo     text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  monto       numeric(14, 2) not null check (monto >= 0),
  fecha       date not null,
  nota        text not null default '',
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Un solo cierre vivo por mes.
create unique index div_cierres_un_vivo_por_mes
  on public.div_cierres (user_id, periodo) where deleted_at is null;

create index on public.ingresos (user_id);
create index on public.ingreso_cobros (user_id, ingreso_id);
create index on public.ingreso_cobros (user_id, periodo);
create index on public.categorias (user_id);
create index on public.gastos (user_id, periodo);
create index on public.gastos (user_id, categoria_id);
create index on public.div_gastos (user_id, periodo);
create index on public.div_gastos (user_id, categoria_id);

-- ── seguridad: cada uno ve y toca solo lo suyo ──────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'ingresos', 'ingreso_cobros', 'categorias', 'gastos', 'div_gastos', 'div_cierres'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_propias', t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
