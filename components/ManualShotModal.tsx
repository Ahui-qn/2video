import React, { useState } from 'react';
import { X, Plus, Film } from 'lucide-react';
import { Shot, Episode } from '../types';

interface ManualShotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (shot: Shot, sceneHeader: string, episodeId?: string) => void;
  episodes?: Episode[];
}

const SHOT_SIZES = ['特写 (CU)', '近景 (MCU)', '中景 (MS)', '中远景 (MLS)', '全景 (LS)', '大远景 (ELS)'];
const CAMERA_ANGLES = ['平视', '俯视', '仰视', '侧视', '斜角'];

export const ManualShotModal: React.FC<ManualShotModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  episodes = []
}) => {
  const [sceneHeader, setSceneHeader] = useState('');
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('');
  const [shot, setShot] = useState<Shot>({
    id: '1',
    shotSize: '中景 (MS)',
    cameraAngle: '平视',
    visualDescription: '',
    environment: '',
    characters: '',
    action: '',
    dialogue: '',
    duration: '3s'
  });

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!sceneHeader.trim()) {
      alert('请输入场景标题');
      return;
    }
    onSubmit(shot, sceneHeader, selectedEpisodeId || undefined);
    // Reset form
    setSceneHeader('');
    setShot({
      id: '1',
      shotSize: '中景 (MS)',
      cameraAngle: '平视',
      visualDescription: '',
      environment: '',
      characters: '',
      action: '',
      dialogue: '',
      duration: '3s'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      <div className="relative bg-[#0f0518] border border-white/10 w-full max-w-2xl shadow-2xl overflow-hidden rounded-2xl flex flex-col max-h-[90vh] animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02] shrink-0">
          <h3 className="text-white font-bold flex items-center gap-2 text-lg font-display">
            <Film size={18} className="text-[#ccff00]" />
            手动添加分镜
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Episode Selection */}
          {episodes.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                选择集数
              </label>
              <select
                value={selectedEpisodeId}
                onChange={(e) => setSelectedEpisodeId(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#ccff00] transition-colors"
              >
                <option value="">自动添加到第一集</option>
                {episodes.map(ep => (
                  <option key={ep.id} value={ep.id}>{ep.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Scene Header */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
              场景标题 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={sceneHeader}
              onChange={(e) => setSceneHeader(e.target.value)}
              placeholder="例如：内景 - 咖啡厅 - 日"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#ccff00] transition-colors placeholder:text-slate-600"
            />
          </div>

          {/* Shot Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Shot Size */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                景别
              </label>
              <select
                value={shot.shotSize}
                onChange={(e) => setShot({...shot, shotSize: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#ccff00] transition-colors"
              >
                {SHOT_SIZES.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>

            {/* Camera Angle */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                机位角度
              </label>
              <select
                value={shot.cameraAngle}
                onChange={(e) => setShot({...shot, cameraAngle: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#ccff00] transition-colors"
              >
                {CAMERA_ANGLES.map(angle => (
                  <option key={angle} value={angle}>{angle}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Visual Description */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
              画面描述 / Prompt
            </label>
            <textarea
              value={shot.visualDescription}
              onChange={(e) => setShot({...shot, visualDescription: e.target.value})}
              placeholder="描述这个镜头的画面内容..."
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#ccff00] transition-colors placeholder:text-slate-600 resize-none"
            />
          </div>

          {/* Environment & Characters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                环境
              </label>
              <input
                type="text"
                value={shot.environment}
                onChange={(e) => setShot({...shot, environment: e.target.value})}
                placeholder="场景环境描述"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#ccff00] transition-colors placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                人物
              </label>
              <input
                type="text"
                value={shot.characters}
                onChange={(e) => setShot({...shot, characters: e.target.value})}
                placeholder="出场人物"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#ccff00] transition-colors placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Action */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
              动作 / 运镜
            </label>
            <input
              type="text"
              value={shot.action}
              onChange={(e) => setShot({...shot, action: e.target.value})}
              placeholder="人物动作或镜头运动"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#ccff00] transition-colors placeholder:text-slate-600"
            />
          </div>

          {/* Dialogue & Duration */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                台词
              </label>
              <input
                type="text"
                value={shot.dialogue}
                onChange={(e) => setShot({...shot, dialogue: e.target.value})}
                placeholder="角色台词（可选）"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#ccff00] transition-colors placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                时长
              </label>
              <input
                type="text"
                value={shot.duration}
                onChange={(e) => setShot({...shot, duration: e.target.value})}
                placeholder="3s"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#ccff00] transition-colors placeholder:text-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#ccff00] text-black hover:bg-[#dfff40] transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            添加分镜
          </button>
        </div>
      </div>
    </div>
  );
};
