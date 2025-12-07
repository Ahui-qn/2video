# 审计日志 (Audit Logs)

## 什么是审计日志？

审计日志是系统自动记录的操作历史，用于追踪谁在什么时候做了什么操作。这对于多人协作项目非常重要。

## 为什么需要审计日志？

在多人协作环境中，审计日志可以：

1. **安全追踪**：记录所有敏感操作（如权限变更）
2. **问题排查**：当出现问题时，可以查看操作历史找出原因
3. **防止滥用**：记录未授权的操作尝试
4. **合规要求**：某些行业需要保留操作记录

## 当前记录的操作

### 1. 成员加入 (member_joined)
- **触发时机**：新用户首次加入项目
- **记录内容**：用户ID、分配的角色
- **用途**：追踪项目成员增长

### 2. 权限变更 (update_role)
- **触发时机**：管理员修改成员权限
- **记录内容**：目标用户ID、新角色
- **用途**：追踪权限变更历史

### 3. 未授权更新尝试 (unauthorized_update)
- **触发时机**：
  - 查看者尝试编辑项目
  - 非成员尝试修改项目
- **记录内容**：用户角色、失败原因
- **用途**：安全监控，发现潜在的权限问题

## 数据库结构

```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT,              -- 项目ID
  user_id TEXT,                 -- 操作用户ID
  action TEXT,                  -- 操作类型
  details TEXT,                 -- JSON格式的详细信息
  created_at INTEGER            -- 时间戳
);
```

## 查询审计日志

目前审计日志存储在数据库中，可以通过SQL查询：

```sql
-- 查看某个项目的所有操作
SELECT * FROM audit_logs WHERE project_id = 'xxx' ORDER BY created_at DESC;

-- 查看某个用户的所有操作
SELECT * FROM audit_logs WHERE user_id = 'xxx' ORDER BY created_at DESC;

-- 查看所有未授权尝试
SELECT * FROM audit_logs WHERE action = 'unauthorized_update';
```

## 未来改进

可以考虑添加：
- 管理界面查看审计日志
- 导出审计日志功能
- 更多操作类型的记录（如删除项目、导出数据等）
- 日志保留策略（自动清理旧日志）
