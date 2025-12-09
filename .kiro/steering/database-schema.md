# 数据库结构说明

## 表结构

### 1. `users` 表 - 用户信息
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 用户唯一ID (UUID, 主键) |
| `name` | TEXT | 用户显示名称 |
| `email` | TEXT | 邮箱地址 (唯一约束) |
| `password_hash` | TEXT | bcrypt加密的密码哈希 |
| `created_at` | INTEGER | 注册时间戳 (毫秒) |

### 2. `projects` 表 - 项目信息
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 项目唯一ID (UUID, 主键) |
| `name` | TEXT | 项目名称 |
| `creator_id` | TEXT | 创建者用户ID (外键→users.id) |
| `description` | TEXT | 项目描述 |
| `cover_image` | TEXT | 封面图片URL或Base64 |
| `data` | TEXT | **JSON字符串 - AI分析结果** |
| `episodes` | TEXT | **JSON字符串 - 剧集列表** |
| `created_at` | INTEGER | 创建时间戳 |
| `updated_at` | INTEGER | 最后更新时间戳 |

#### `data` 字段结构 (AnalysisResult)
```json
{
  "title": "项目标题",
  "synopsis": "剧情简介",
  "characters": [
    {
      "name": "角色名",
      "visualSummary": "外观描述",
      "traits": "性格特点",
      "imageUrls": ["图片URL数组"]
    }
  ],
  "assets": [
    {
      "name": "资产名",
      "description": "描述",
      "type": "Location/Prop/Vehicle",
      "imageUrls": ["图片URL数组"]
    }
  ],
  "episodes": [
    {
      "id": "集ID",
      "title": "第X集",
      "scenes": [
        {
          "sceneId": "场景ID",
          "header": "场景标题",
          "shots": [
            {
              "id": "镜头编号",
              "shotSize": "景别(远景/中景/特写等)",
              "cameraAngle": "机位角度",
              "visualDescription": "画面描述/生图提示词",
              "environment": "环境描述",
              "characters": "出场角色",
              "action": "动作描述",
              "dialogue": "台词",
              "duration": "时长"
            }
          ]
        }
      ]
    }
  ],
  "scenes": [] // 所有场景的扁平数组
}
```

#### `episodes` 字段结构 (ScriptEpisode[])
```json
[
  {
    "id": "集ID",
    "title": "第 1 集",
    "content": "用户输入的剧本文本",
    "status": "draft/analyzing/analyzed",
    "isExpanded": true
  }
]
```

### 3. `project_members` 表 - 项目成员关系
| 字段 | 类型 | 说明 |
|------|------|------|
| `project_id` | TEXT | 项目ID (联合主键) |
| `user_id` | TEXT | 用户ID (联合主键) |
| `role` | TEXT | 角色: 'admin'(管理员)/'editor'(编辑者)/'viewer'(查看者) |
| `joined_at` | INTEGER | 加入时间戳 |

**角色权限:**
- `admin`: 可编辑、删除项目、管理成员权限
- `editor`: 可编辑项目内容
- `viewer`: 只能查看，不能编辑

### 4. `audit_logs` 表 - 审计日志
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 自增ID (主键) |
| `project_id` | TEXT | 项目ID |
| `user_id` | TEXT | 操作用户ID |
| `action` | TEXT | 操作类型 |
| `details` | TEXT | JSON格式的详细信息 |
| `created_at` | INTEGER | 操作时间戳 |

**操作类型:**
- `project_created`: 项目创建
- `member_joined`: 成员加入
- `update_role`: 权限变更
- `unauthorized_update`: 未授权的更新尝试

## 数据流

### 创建项目
1. 前端调用 `POST /api/project`
2. 服务器创建项目记录，创建者自动成为 `admin`
3. 项目仅对创建者可见，其他用户需要通过邀请链接加入

### 保存分镜数据
1. 用户在各组件中保存时自动触发同步（无需手动点击全局保存按钮）
2. 触发同步的操作包括：
   - 保存剧集内容（ScriptEditor）
   - 保存分镜表编辑（StoryboardTable）
   - 保存资产编辑（AssetPanel）
   - 添加/删除剧集、镜头、角色、资产
   - AI分析完成
3. 前端发送 `project-update` Socket事件，包含:
   - `result`: AI分析结果 (包含分镜表)
   - `episodes`: 剧集列表 (用户输入的剧本)
   - `globalAssets`: 全局资产库
4. 服务器更新 `projects` 表的 `data` 和 `episodes` 字段
5. 广播 `project-updated` 到项目房间内的其他用户

### 实时协作
1. 用户进入项目时，Socket加入项目房间
2. 用户保存时，广播更新到房间内其他用户
3. 其他用户收到更新，显示"有人修改"提示
