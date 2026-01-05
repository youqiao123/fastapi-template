thread_id 是 user-scoped 的
任何 thread 的存在与访问都必须通过 user_id 解释。
TODO: 在Agent服务端，对话线程还不是用户隔离的。也就是说，如果用户A知道了用户B的thread_id，如果A能把这个thread_id传给Agent服务端，它就能知道B的对话内容。

docker compose rm -f backend
docker compose up -d backend

docker exec -it fastapi-template-db-1 psql -U postgres -d app
docker exec -it fastapi-template-db-1 psql -U agent_user -d app
docker exec -it fastapi-template-db-1 psql "postgresql://agent_user:YouqiaoQian_agent@localhost:5432/app"

docker compose build --no-cache backend && docker compose up -d backend
docker compose build --no-cache frontend && docker compose up -d frontend


cd backend && uvicorn app.main:app --port 9000
cd frontend && npm run dev 

http://47.99.82.91:8081
## 在db容器里创建agent schema

目标只有一个：

> **让 `protac-agent` 从这一刻起，彻底停止污染 `public`，并与 `main-site` 在同一数据库实例下实现逻辑隔离。**

---

1. 以数据库管理员身份进入 psql

```bash
docker exec -it fastapi-template-db-1 psql -U postgres -d app
```
2. 创建 Agent 专用 schema（安全、可重复）

```sql
CREATE SCHEMA IF NOT EXISTS agent;
```
3. 创建 Agent 专用数据库用户（核心隔离点）

```sql
CREATE USER agent_user WITH PASSWORD 'YouqiaoQian_agent';
```
> 生产环境请用强密码或 secret 注入
4. 最小权限原则（非常关键）
- 4.1 允许 agent_user 连接数据库
```sql
GRANT CONNECT ON DATABASE app_db TO agent_user;
```
- 4.2 只允许使用 agent schema
```sql
GRANT USAGE ON SCHEMA agent TO agent_user;
GRANT CREATE ON SCHEMA agent TO agent_user;
```
- 4.3 **明确禁止访问 public schema（关键止血）**
```sql
REVOKE ALL ON SCHEMA public FROM agent_user;
```
5. 固化 search_path（零歧义的关键）
```sql
ALTER ROLE agent_user SET search_path = agent;
```
6. 为 Agent 提供专用 DATABASE_URL
```text
postgresql://agent_user:CHANGE_ME_STRONG_PASSWORD@db:5432/app_db
```

