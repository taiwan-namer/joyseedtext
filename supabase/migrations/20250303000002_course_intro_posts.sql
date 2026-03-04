-- 課程介紹文章：來自「新增課程」自動備份 或 「課程介紹」手動新增；前台 /courses 顯示此表
create table if not exists course_intro_posts (
  id uuid primary key default gen_random_uuid(),
  merchant_id text not null,
  source text not null check (source in ('course', 'manual')),
  course_id text,
  title text not null,
  image_url text,
  gallery_urls jsonb default '[]',
  intro_text text,
  post_content text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_course_intro_posts_merchant on course_intro_posts(merchant_id);
create index if not exists idx_course_intro_posts_course_id on course_intro_posts(course_id);

comment on table course_intro_posts is '課程介紹：備份自新增課程 或 手動新增部落格；刪除課程不刪此表，僅在課程介紹後台刪除才移除';
