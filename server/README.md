# Tag Notebook API (Supabase)

This Express service exposes REST endpoints used by the Tag Notebook prototype.\
Data is persisted in a Supabase (Postgres) project.

## Prerequisites
- Node.js ≥ 18
- Supabase project (https://supabase.com) with a Postgres database

## Database setup
1. Sign in to Supabase and create a new project (or reuse an existing one).
2. In the SQL editor，运行 `server/db/schema.sql` 中的语句，创建 `notes` 表。
3. 获取以下凭据：
   - `SUPABASE_URL`（项目的 API URL）
   - `SUPABASE_SERVICE_ROLE_KEY`（Service Role Key，用于服务器端写操作）
   - `SUPABASE_ANON_KEY`（匿名公开 Key，供前端调用）

## 本地运行
```bash
cd server
cp .env.example .env   # 填写 Supabase 的 URL 和 Key
npm install
npm run dev
```
服务默认监听 `http://localhost:8787`，健康检查接口为 `/health`。

## 可用接口
- `GET /api/notes`：列出所有笔记。
- `GET /api/notes/:id`：获取单条笔记。
- `POST /api/notes`：创建笔记。
- `PATCH /api/notes/:id`：更新笔记。
- `DELETE /api/notes/:id`：删除笔记。
- `GET /api/tags`：汇总所有标签及其笔记数量、最后更新时间。
- `GET /api/tags/:name/notes`：列出包含指定标签的笔记。

> 若需扩展更多字段或逻辑，可在 `server/src` 下新增模型、服务与路由。
