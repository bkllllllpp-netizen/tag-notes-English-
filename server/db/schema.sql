create extension if not exists "uuid-ossp";

create table if not exists notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  strokes jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'notes'
      and column_name = 'user_id'
  ) then
    alter table notes add column user_id uuid references auth.users (id) on delete cascade;
  end if;
end $$;

create index if not exists idx_notes_user_id on notes (user_id, updated_at desc);
create index if not exists idx_notes_tags on notes using gin (tags);
create index if not exists idx_notes_updated_at on notes (updated_at desc);

alter table notes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notes'
      and policyname = 'Users manage own notes'
  ) then
    create policy "Users manage own notes"
      on notes
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create table if not exists ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (scope in ('all', 'tag')),
  tag text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scope_tag_consistency check ((scope = 'tag' and tag is not null) or (scope = 'all' and tag is null))
);

create index if not exists idx_ai_conversations_user_scope on ai_conversations (user_id, scope, tag);

alter table ai_conversations enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_conversations'
      and policyname = 'Users manage own conversations'
  ) then
    create policy "Users manage own conversations"
      on ai_conversations
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
