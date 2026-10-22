-- ==============================================================================
-- ISET N° 57 - Configuración de Supabase (Autenticación, Roles y Contenido JSON)
-- ==============================================================================
-- Ejecutá este script en el "SQL Editor" de tu proyecto en Supabase (https://supabase.com).
-- Crea automáticamente las tablas de perfiles, roles, contenido JSON, políticas de seguridad
-- y el bucket para subida de imágenes.
-- ==============================================================================

-- 1. Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- 2. Tabla de perfiles de usuario
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text default '',
  role text not null default 'visitante' check (role in ('visitante', 'admin', 'superuser')),
  carreras text[] default '{}', -- IDs de carreras asignadas: 'digitales', 'higiene', 'enfermeria', 'simulacion'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar Row Level Security (RLS) en perfiles
alter table public.profiles enable row level security;

-- Políticas para profiles:
-- Todos los usuarios autenticados pueden leer perfiles
create policy "Los usuarios autenticados pueden leer perfiles"
  on public.profiles for select
  to authenticated
  using (true);

-- Los usuarios pueden actualizar su propio perfil básico (nombre)
create policy "Los usuarios pueden actualizar su propio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Solo los superusuarios pueden actualizar roles y carreras de otros usuarios
create policy "Superusuarios pueden actualizar roles"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'superuser'
    )
  );

-- 3. Función y Trigger automático al registrarse un nuevo usuario
-- Asigna 'superuser' si es pedro.bolig@gamil.com / pedro.bolig@gmail.com o si es el primer usuario registrado.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  is_first boolean;
  assigned_role text := 'visitante';
begin
  select not exists (select 1 from public.profiles) into is_first;

  if lower(new.email) in ('pedro.bolig@gamil.com', 'pedro.bolig@gmail.com') or is_first then
    assigned_role := 'superuser';
  end if;

  insert into public.profiles (id, email, full_name, role, carreras)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    assigned_role,
    case when assigned_role = 'superuser' then array['digitales', 'higiene', 'enfermeria', 'simulacion'] else array[]::text[] end
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger que se dispara cuando un usuario se registra en auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Tabla de contenido del sitio (almacena el JSON de data y materias sincronizado en tiempo real)
create table if not exists public.site_content (
  id text primary key, -- 'data' o 'materias'
  content jsonb not null,
  version integer default 1,
  updated_by uuid references auth.users,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.site_content enable row level security;

-- Cualquiera (incluso visitantes anónimos) puede leer el contenido del sitio
create policy "Lectura pública de site_content"
  on public.site_content for select
  to anon, authenticated
  using (true);

-- Solo usuarios autenticados con rol 'admin' o 'superuser' pueden modificar contenido
create policy "Admins y Superusers pueden actualizar site_content"
  on public.site_content for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'superuser')
    )
  );

-- Habilitar Supabase Realtime para site_content
alter publication supabase_realtime add table public.site_content;

-- 5. Bucket de almacenamiento para subida de imágenes (Storage)
insert into storage.buckets (id, name, public)
values ('iset-assets', 'iset-assets', true)
on conflict (id) do nothing;

-- Políticas de Storage para iset-assets:
-- Lectura pública de imágenes
create policy "Imágenes públicas para todos"
  on storage.objects for select
  to public
  using (bucket_id = 'iset-assets');

-- Subida de imágenes solo para admins y superusers
create policy "Admins y superusers pueden subir imágenes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'iset-assets' and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'superuser')
    )
  );
