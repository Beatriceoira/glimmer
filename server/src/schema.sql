create extension if not exists pgcrypto;
create table if not exists users(
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text not null default 'reader',
  free_turns int not null default 10,
  free_turns_ts timestamptz not null default now(),
  purchased_turns int not null default 0,
  accepted_terms_at timestamptz,
  created_at timestamptz default now());
create table if not exists stories(
  id uuid primary key default gen_random_uuid(),
  title varchar(255) not null,
  blurb text default '',
  author_id uuid references users(id) on delete cascade,
  fandom varchar(100),
  tags text[] default '{}',
  variables text[] default '{}',
  author_rules text default '',
  is_published boolean default false,
  start_node_id uuid,
  created_at timestamptz default now());
create table if not exists story_nodes(
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id) on delete cascade,
  title varchar(120) default '',
  content text not null default '',
  is_ending boolean default false,
  allow_custom boolean default true,
  is_ai_generated boolean default false,
  node_metadata jsonb default '{}',
  pos_x real default 0,
  pos_y real default 0);
create table if not exists node_choices(
  id uuid primary key default gen_random_uuid(),
  parent_node_id uuid not null references story_nodes(id) on delete cascade,
  next_node_id uuid references story_nodes(id) on delete set null,
  choice_text varchar(255) not null,
  required_state jsonb default '{}',
  effects jsonb default '{}',
  sort int default 0);
create table if not exists player_sessions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  story_id uuid not null references stories(id) on delete cascade,
  current_node_id uuid references story_nodes(id),
  state_variables jsonb not null default '{}',
  summary text default '',
  beats jsonb default '[]',
  updated_at timestamptz default now(),
  unique(user_id, story_id));
create table if not exists content_reports(
  id uuid primary key default gen_random_uuid(),
  story_id uuid references stories(id) on delete cascade,
  reporter_id uuid references users(id) on delete set null,
  reason text not null,
  created_at timestamptz default now());
create table if not exists processed_events(id text primary key, created_at timestamptz default now());
create index if not exists idx_nodes_story on story_nodes(story_id);
create index if not exists idx_choices_parent on node_choices(parent_node_id);
create index if not exists idx_stories_pub on stories(is_published, created_at desc);
