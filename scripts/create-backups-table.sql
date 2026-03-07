-- Create the tree_backups table for automatic backup snapshots
create table if not exists tree_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  tree_data jsonb not null,
  created_at timestamptz default now()
);

-- Index for fast lookup by user, newest first
create index if not exists idx_tree_backups_user_created
  on tree_backups (user_id, created_at desc);

-- Row Level Security: users can only access their own backups
alter table tree_backups enable row level security;

create policy "Users can insert their own backups"
  on tree_backups for insert
  with check (auth.uid() = user_id);

create policy "Users can select their own backups"
  on tree_backups for select
  using (auth.uid() = user_id);

create policy "Users can delete their own backups"
  on tree_backups for delete
  using (auth.uid() = user_id);
