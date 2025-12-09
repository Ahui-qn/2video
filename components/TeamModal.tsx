
import React, { useState, useEffect } from 'react';
import { X, Users, Shield, UserPlus, Trash2, Check, Activity } from 'lucide-react';
import { useCollaboration, Role, MemberInfo } from './CollaborationContext';
import { API_BASE_URL } from '../services/apiConfig';

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

interface AuditLog {
  id: number;
  action: string;
  details: string;
  created_at: number;
  user_name: string;
}

export const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose, projectId }) => {
  const { activeUsers, members, role: myRole, updatePermission, currentUserId } = useCollaboration();
  const [inviteLink, setInviteLink] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'audit'>('members');
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (isOpen && activeTab === 'audit') {
      const token = localStorage.getItem('script2video_token');
      fetch(`${API_BASE_URL}/project/${projectId}/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
    }
  }, [isOpen, activeTab, projectId]);

  if (!isOpen) return null;

  const handleRoleChange = (userId: string, newRole: Role) => {
    updatePermission(userId, newRole);
  };

  const copyInvite = async () => {
    // 生成邀请链接
    const link = `${window.location.origin}/?join=${projectId}`;
    
    try {
      // 优先使用 Clipboard API（需要 HTTPS 或 localhost）
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
        setInviteLink('已复制!');
      } else {
        // 降级方案：使用传统的 execCommand
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setInviteLink('已复制!');
      }
    } catch (err) {
      // 如果都失败，显示链接让用户手动复制
      setInviteLink(link);
    }
    setTimeout(() => setInviteLink(''), 3000);
  };

  // Combine members and active users for display
  // Now members contains full MemberInfo, so we can get names for offline users too
  const memberList = Object.keys(members).map(userId => {
    const memberInfo = members[userId] as MemberInfo;
    const active = activeUsers.find(u => u.id === userId);
    return {
      id: userId,
      name: memberInfo?.name || active?.name || userId.substring(0, 8),
      email: memberInfo?.email || '',
      role: memberInfo?.role || 'viewer',
      isOnline: !!active
    };
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      <div className="relative bg-[#0f0518] border border-white/10 w-full max-w-md shadow-2xl overflow-hidden rounded-2xl flex flex-col max-h-[85vh] animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02] shrink-0">
          <h3 className="text-white font-bold flex items-center gap-2 text-lg font-display">
            <Users size={18} className="text-[#ccff00]" />
            团队协作
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
            <button 
                onClick={() => setActiveTab('members')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'members' ? 'text-[#ccff00] border-b-2 border-[#ccff00] bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}
            >
                成员列表
            </button>
            <button 
                onClick={() => setActiveTab('audit')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'audit' ? 'text-[#ccff00] border-b-2 border-[#ccff00] bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}
            >
                审计日志
            </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            {activeTab === 'members' ? (
                <>
                    {/* Invite Section */}
                    {myRole === 'admin' && (
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">邀请成员</label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-slate-500 font-mono truncate">
                                    {`${window.location.origin}/?join=${projectId}`}
                                </div>
                                <button 
                                    onClick={copyInvite}
                                    className="bg-[#ccff00] hover:bg-[#dfff40] text-black px-4 py-2 rounded font-bold text-xs transition-colors"
                                >
                                    {inviteLink || '复制链接'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Members List */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">成员列表 ({memberList.length})</label>
                        <div className="space-y-2">
                            {memberList.map(member => (
                                <div key={member.id} className="flex items-center justify-between bg-white/[0.02] p-3 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black ${member.isOnline ? 'bg-[#ccff00]' : 'bg-slate-600'}`}>
                                            {member.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white flex items-center gap-2">
                                                {member.name}
                                                {member.id === currentUserId && <span className="text-[10px] text-slate-500">(我)</span>}
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${member.isOnline ? 'bg-green-500' : 'bg-slate-600'}`} />
                                                {member.isOnline ? '在线' : '离线'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Role Selector */}
                                    {myRole === 'admin' && member.id !== currentUserId ? (
                                        <select 
                                            value={member.role}
                                            onChange={(e) => handleRoleChange(member.id, e.target.value as Role)}
                                            className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#ccff00]"
                                        >
                                            <option value="viewer">查看者</option>
                                            <option value="editor">编辑者</option>
                                            <option value="admin">管理员</option>
                                        </select>
                                    ) : (
                                        <span className="text-xs font-mono text-slate-400 px-2 py-1 bg-white/5 rounded border border-white/5 uppercase">
                                            {member.role}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <div className="space-y-3">
                    {logs.length === 0 ? (
                        <div className="text-center text-slate-500 text-xs py-8">暂无日志记录</div>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} className="p-3 rounded-lg bg-white/5 border border-white/5 text-xs">
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold text-white">{log.user_name}</span>
                                    <span className="text-slate-500 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                                </div>
                                <div className="text-slate-300">
                                    <span className="text-[#ccff00] uppercase mr-2 font-bold text-[10px]">{log.action}</span>
                                    {log.details}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>

      </div>
    </div>
  );
};
