# Design Document: Auth Session Management

## Overview

本设计文档描述了修复AI漫剧创作平台认证会话管理问题的技术方案。主要解决应用启动时不验证token有效性、API返回401时未正确处理、以及WebSocket认证失败时的会话管理问题。

## Architecture

系统采用集中式会话管理架构，通过一个SessionManager工具类统一处理所有认证相关逻辑：

```mermaid
graph TB
    subgraph Frontend
        App[App.tsx]
        SessionMgr[SessionManager]
        Auth[Auth.tsx]
        ProjectList[ProjectList.tsx]
        CollabCtx[CollaborationContext.tsx]
    end
    
    subgraph Backend
        AuthAPI[/api/auth]
        ProjectAPI[/api/project]
        SocketIO[Socket.IO]
    end
    
    App --> SessionMgr
    SessionMgr --> Auth
    SessionMgr --> ProjectList
    SessionMgr --> CollabCtx
    
    SessionMgr -.->|validate| AuthAPI
    ProjectList -.->|401| SessionMgr
    CollabCtx -.->|auth error| SessionMgr
```

## Components and Interfaces

### 1. SessionManager 工具类

```typescript
// services/sessionManager.ts
interface SessionState {
  isAuthenticated: boolean;
  isValidating: boolean;
  user: AppUser | null;
  token: string | null;
}

interface SessionManager {
  // 验证当前会话是否有效
  validateSession(): Promise<boolean>;
  
  // 清除会话数据并登出
  clearSession(): void;
  
  // 获取当前会话状态
  getSessionState(): SessionState;
  
  // 处理401错误
  handle401Error(redirectUrl?: string): void;
  
  // 获取存储的token
  getToken(): string | null;
  
  // 获取存储的用户
  getUser(): AppUser | null;
}
```

### 2. App.tsx 改进

```typescript
// 新增状态
const [isValidatingSession, setIsValidatingSession] = useState(true);

// 启动时验证会话
useEffect(() => {
  const validateOnStartup = async () => {
    const isValid = await sessionManager.validateSession();
    if (!isValid) {
      sessionManager.clearSession();
      setView('auth');
    } else {
      setUser(sessionManager.getUser());
      setView('home');
    }
    setIsValidatingSession(false);
  };
  
  validateOnStartup();
}, []);
```

### 3. API请求包装器

```typescript
// services/apiClient.ts
const apiClient = {
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const token = sessionManager.getToken();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: token ? `Bearer ${token}` : ''
      }
    });
    
    if (response.status === 401) {
      sessionManager.handle401Error(window.location.pathname);
      throw new AuthenticationError('Session expired');
    }
    
    return response;
  }
};
```

## Data Models

### SessionState
```typescript
interface SessionState {
  isAuthenticated: boolean;  // 是否已认证
  isValidating: boolean;     // 是否正在验证
  user: AppUser | null;      // 用户信息
  token: string | null;      // JWT token
}
```

### AppUser (已存在)
```typescript
interface AppUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Invalid Token Clears Session
*For any* stored session with an invalid or expired JWT token, when the application validates the session, the system should clear localStorage (both user data and token) and set the view to 'auth'.
**Validates: Requirements 1.2, 4.2**

### Property 2: Valid Token Preserves Session
*For any* stored session with a valid JWT token, when the application validates the session, the system should preserve the session data and set the view to 'home'.
**Validates: Requirements 1.3**

### Property 3: 401 Response Triggers Logout
*For any* API request that returns a 401 status code, the system should clear the session data and redirect to the auth view.
**Validates: Requirements 2.1, 2.2**

### Property 4: Session Clear Removes All Data
*For any* session clear operation, both 'script2video_user' and 'script2video_token' keys should be removed from localStorage.
**Validates: Requirements 4.2**

### Property 5: Socket Auth Failure Triggers Validation
*For any* WebSocket authentication failure, the system should trigger a session validation check, and if validation fails, redirect to auth view.
**Validates: Requirements 3.2, 3.3**

## Error Handling

1. **Token验证失败**: 清除会话，显示"会话已过期，请重新登录"提示，重定向到登录页
2. **API 401错误**: 清除会话，保存当前URL，重定向到登录页
3. **Socket认证失败**: 显示连接错误提示，触发会话验证
4. **网络错误**: 显示网络错误提示，不清除会话（可能是临时网络问题）

## Testing Strategy

### 单元测试
- 使用 Vitest 作为测试框架
- 测试 SessionManager 的各个方法
- Mock localStorage 和 fetch API

### 属性测试
- 使用 fast-check 进行属性测试
- 每个属性测试运行至少100次迭代
- 测试标注格式: `**Feature: auth-session-management, Property {number}: {property_text}**`

### 测试覆盖
1. SessionManager.validateSession() - 各种token状态
2. SessionManager.clearSession() - 确保清除所有数据
3. SessionManager.handle401Error() - 401处理流程
4. App.tsx 启动时的会话验证流程
5. API请求的401拦截

