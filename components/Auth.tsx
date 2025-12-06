import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthProps {
  onLogin: (user: { email: string; name: string; isAdmin: boolean }) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock Auth Logic
    if (email && password) {
      if (isRegister && !name) return;
      
      // Simulate API delay
      setTimeout(() => {
        const mockUser = {
          email,
          name: name || email.split('@')[0],
          isAdmin
        };
        localStorage.setItem('script2video_user', JSON.stringify(mockUser));
        localStorage.setItem('script2video_token', 'mock_jwt_token_' + Date.now());
        onLogin(mockUser);
      }, 800);
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
               <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsAdmin(!isAdmin)}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${isAdmin ? 'bg-[#d946ef] border-[#d946ef]' : 'border-slate-500'}`}>
                      {isAdmin && <ShieldCheck size={10} className="text-white" />}
                  </div>
                  <span className="text-xs text-slate-400">注册为管理员账户</span>
               </div>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-[#ccff00] hover:bg-[#d9f99d] text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all mt-4 hover:scale-[1.02]"
            >
              {isRegister ? '立即注册' : '登 录'}
              <ArrowRight size={18} />
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
