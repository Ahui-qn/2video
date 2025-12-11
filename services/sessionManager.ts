/**
 * SessionManager - 集中式会话管理工具
 * 
 * 核心职责：
 * 1. 统一管理用户认证状态（token和用户信息）
 * 2. 验证会话有效性（调用后端API验证token）
 * 3. 处理401错误，统一登出流程
 * 
 * Requirements: 4.1, 4.2, 4.3
 */
import { API_BASE_URL } from './apiConfig';

// 用户信息接口
export interface AppUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

// 会话状态接口
export interface SessionState {
  isAuthenticated: boolean;
  isValidating: boolean;
  user: AppUser | null;
  token: string | null;
}

// localStorage 键名常量
const STORAGE_KEYS = {
  USER: 'script2video_user',
  TOKEN: 'script2video_token',
  CURRENT_PROJECT: 'script2video_current_project',
} as const;

/**
 * 获取存储的JWT Token
 * @returns token字符串或null
 */
export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

/**
 * 获取存储的用户信息
 * @returns 用户对象或null
 */
export function getUser(): AppUser | null {
  const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
  if (!storedUser) return null;
  
  try {
    return JSON.parse(storedUser) as AppUser;
  } catch {
    return null;
  }
}

/**
 * 清除所有会话数据
 * 同时清除用户信息、token和当前项目ID
 * 
 * Requirements: 4.2 - 清除会话时移除User_Data和JWT_Token
 */
export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_PROJECT);
}

/**
 * 验证当前会话是否有效
 * 调用后端 /api/auth/validate 端点验证token
 * 
 * @returns Promise<boolean> - true表示会话有效，false表示无效
 * 
 * Requirements: 4.1 - 使用单一工具函数验证会话
 */
export async function validateSession(): Promise<boolean> {
  const token = getToken();
  
  // 没有token，会话无效
  if (!token) {
    return false;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/validate`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.status === 401) {
      // Token无效或过期
      return false;
    }
    
    if (!response.ok) {
      // 其他错误（如网络问题），保守处理为无效
      return false;
    }
    
    // 验证成功
    return true;
  } catch (error) {
    // 网络错误等异常情况
    console.error('Session validation error:', error);
    return false;
  }
}

/**
 * 处理401错误的统一方法
 * 清除会话数据，可选保存重定向URL，并触发页面刷新回到登录页
 * 
 * @param redirectUrl - 可选的重定向URL，登录后可返回
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export function handle401Error(redirectUrl?: string): void {
  // 清除会话数据
  clearSession();
  
  // 保存重定向URL（如果提供）
  if (redirectUrl) {
    localStorage.setItem('script2video_redirect_url', redirectUrl);
  }
  
  // 刷新页面，App.tsx会检测到无用户数据并显示登录页
  window.location.reload();
}

/**
 * 获取当前会话状态
 * 
 * Requirements: 4.3 - 提供一致的接口检查认证状态
 */
export function getSessionState(): Omit<SessionState, 'isValidating'> {
  const token = getToken();
  const user = getUser();
  
  return {
    isAuthenticated: !!(token && user),
    user,
    token,
  };
}

// 导出默认对象，方便统一导入
const sessionManager = {
  getToken,
  getUser,
  clearSession,
  validateSession,
  handle401Error,
  getSessionState,
  STORAGE_KEYS,
};

export default sessionManager;
