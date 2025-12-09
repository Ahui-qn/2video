import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../services/apiConfig';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

interface AuthProps {
  onLogin: (user: AuthUser) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }
    if (isRegister && !name) {
      setError('请输入姓名');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = isRegister ? `${API_BASE_URL}/auth/register` : `${API_BASE_URL}/auth/login`;
      const body = isRegister ? { email, password, name } : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Add isAdmin field (default false for regular users)
      const userWithAdmin: AuthUser = {
        ...data.user,
        isAdmin: data.user.isAdmin ?? false
      };
      localStorage.setItem('script2video_user', JSON.stringify(userWithAdmin));
      localStorage.setItem('script2video_token', data.token);
      onLogin(userWithAdmin);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#05030a]">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#ccff00]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#d946ef]/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-display font-bold tracking-tighter text-white mb-2">
            SCRIPT<span className="text-[#ccff00]">2</span>VIDEO
          </h1>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-slate-500">
            ToB Enterprise Login
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">
            {isRegister ? '注册企业账户' : '登录账户'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">企业名称 / 姓名</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:border-[#ccff00] outline-none transition-colors"
                    placeholder="输入名称"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">企业邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:border-[#ccff00] outline-none transition-colors"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:border-[#ccff00] outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
              {isRegister && password && (
                <div className="flex gap-1 mt-2">
                  <div className={`h-1 flex-1 rounded-full ${password.length > 6 ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div className={`h-1 flex-1 rounded-full ${password.length > 8 ? 'bg-green-500' : 'bg-slate-700'}`} />
                  <div className={`h-1 flex-1 rounded-full ${password.length > 10 ? 'bg-green-500' : 'bg-slate-700'}`} />
                </div>
              )}
            </div>

            {isRegister && (
              <div className="text-xs text-slate-500 text-center">
                注册即代表同意我们的<span className="text-[#ccff00] cursor-pointer">服务条款</span>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#ccff00] hover:bg-[#dfff40] text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : (isRegister ? '立即注册' : '登 录')}
              {!isLoading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs text-slate-500 hover:text-white transition-colors"
            >
              {isRegister ? '已有账户？直接登录' : '没有账户？申请试用'}
            </button>
            {!isRegister && (
                 <div className="mt-2">
                    <button className="text-[10px] text-slate-600 hover:text-[#d946ef]">忘记密码？</button>
                 </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
