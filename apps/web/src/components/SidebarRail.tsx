import { MessageSquare, Flame, Compass, Laptop, LogOut } from 'lucide-react';
import type { UserProfile } from '@converse/shared';

export type WebTab = 'chats' | 'discover' | 'feed';

interface SidebarRailProps {
  user: UserProfile;
  activeTab: WebTab;
  unreadTotal: number;
  onChangeTab: (tab: WebTab) => void;
  onOpenDevices: () => void;
  onLogout: () => void;
}

export function SidebarRail({
  user,
  activeTab,
  unreadTotal,
  onChangeTab,
  onOpenDevices,
  onLogout,
}: SidebarRailProps) {
  const navBtn = (tab: WebTab, label: string, icon: React.ReactNode, badge?: number) => {
    const active = activeTab === tab;
    return (
      <button
        onClick={() => onChangeTab(tab)}
        title={label}
        className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 ${active
          ? 'bg-gradient-to-br from-[#00D4FF]/20 to-[#2563EB]/20 text-[#00D4FF] border border-[#00D4FF]/40 shadow-[0_0_16px_rgba(0,212,255,0.2)]'
          : 'text-[#8BA4BE] hover:bg-[#132030] hover:text-white'
          }`}
      >
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#0284C7] text-[#070B12] text-[10px] font-extrabold flex items-center justify-center shadow">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <aside className="w-[72px] bg-[#0B121D] border-r border-white/[0.07] flex flex-col items-center justify-between py-5 shrink-0">
      <div className="flex flex-col items-center gap-3.5">
        <div className="relative mb-3">
          <div className="w-11 h-11 rounded-full p-[2px] ig-ring shadow-[0_0_14px_rgba(0,212,255,0.25)]">
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              title={`${user.displayName} (@${user.username})`}
              className="w-full h-full rounded-full object-cover border-2 border-[#0B121D]"
            />
          </div>
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00D4FF] border-2 border-[#0B121D]" />
        </div>

        {navBtn('chats', 'Conversas', <MessageSquare className="w-5 h-5" />, unreadTotal)}
        {navBtn('discover', 'Conexões & Match', <Flame className="w-5 h-5" />)}
        {navBtn('feed', 'Momentos (Feed)', <Compass className="w-5 h-5" />)}
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <button
          onClick={onOpenDevices}
          title="Dispositivos Conectados"
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#8BA4BE] hover:bg-[#132030] hover:text-[#00D4FF] transition"
        >
          <Laptop className="w-5 h-5" />
        </button>
        <button
          onClick={onLogout}
          title="Desconectar Web"
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#8BA4BE] hover:bg-rose-500/15 hover:text-rose-400 transition"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
}
