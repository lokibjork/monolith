import { useNavigate, useLocation } from 'react-router-dom';
import useSound from 'use-sound';
import { LayoutDashboard, ShieldCheck, Bot, RefreshCw, UserCircle, Sun, Moon } from 'lucide-react';
import { LogoMonolith } from './UiElements';
import Avatar from './Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Sidebar({ onOpenRobo, onSync }: { onOpenRobo: () => void; onSync?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { perfil } = useAuth();
  const { tema, toggleTema } = useTheme();
  const [playHover] = useSound('/sounds/hover.mp3', { volume: 0.15 });
  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.3 });

  const isDashboard = location.pathname === '/dashboard';
  const isVault     = location.pathname === '/vault';
  const isPerfil    = location.pathname === '/perfil';
  const isLight     = tema === 'light';

  const nav = (path: string) => { playClick(); navigate(path); };

  const navItem = (active: boolean, icon: React.ReactNode, label: string, path: string) => (
    <button
      onMouseEnter={() => playHover()}
      onClick={() => nav(path)}
      className="flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
      style={{
        background: active ? 'rgba(220,38,38,0.12)' : 'transparent',
        color: active ? '#f87171' : 'var(--c-text-2)',
        border: active ? '1px solid rgba(220,38,38,0.25)' : '1px solid transparent',
      }}
    >
      <span style={{ color: active ? '#ef4444' : 'var(--c-text-3)' }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <aside
      className="w-56 flex flex-col pt-10 z-10 shrink-0 h-full transition-colors duration-300"
      style={{
        background: 'var(--c-surface)',
        borderRight: '1px solid var(--c-border)',
      }}
    >
      {/* LOGO */}
      <div className="px-5 mb-6 flex items-center gap-3 mt-4">
        <div className="w-8 h-8 flex items-center justify-center">
          <LogoMonolith animated={false} className="w-7 h-7 text-red-600" />
        </div>
        <h2 className="text-base font-black tracking-widest" style={{ color: 'var(--c-text-1)' }}>
          MONOLITH
        </h2>
      </div>

      {/* NAV */}
      <nav className="flex-1 px-3 space-y-1">
        {navItem(isDashboard, <LayoutDashboard size={16} />, 'Painel de Editais', '/dashboard')}
        {navItem(isVault,     <ShieldCheck size={16} />,     'Cofre de Documentos', '/vault')}
        {navItem(isPerfil,    <UserCircle size={16} />,      'Meu Perfil', '/perfil')}
      </nav>

      {/* USUÁRIO LOGADO */}
      {perfil && (
        <button
          onMouseEnter={() => playHover()}
          onClick={() => nav('/perfil')}
          className="mx-3 mb-2 px-3 py-2.5 flex items-center gap-3 rounded-lg transition-all cursor-pointer"
          style={{
            background: 'var(--c-card)',
            border: '1px solid var(--c-border)',
          }}
        >
          <div className="relative">
            <Avatar nome={perfil.nome} cor={perfil.cor} avatar_url={perfil.avatar_url} size="sm" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2" style={{ borderColor: 'var(--c-surface)' }}></span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide truncate" style={{ color: 'var(--c-text-1)' }}>{perfil.nome}</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--c-text-2)' }}>{perfil.cargo}</p>
          </div>
        </button>
      )}

      {/* RODAPÉ */}
      <div className="px-3 pb-4 space-y-2" style={{ borderTop: '1px solid var(--c-border)', paddingTop: '12px' }}>

        {/* Botão de tema */}
        <button
          onMouseEnter={() => playHover()}
          onClick={() => { playClick(); toggleTema(); }}
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
          style={{
            background: 'var(--c-card)',
            border: '1px solid var(--c-border)',
            color: 'var(--c-text-2)',
          }}
          title={isLight ? 'Mudar para modo escuro' : 'Mudar para modo claro'}
        >
          <span>{isLight ? 'Modo escuro' : 'Modo claro'}</span>
          {isLight
            ? <Moon size={14} className="text-indigo-400" />
            : <Sun size={14} className="text-amber-400" />
          }
        </button>

        {/* Sync PNCP */}
        {onSync && (
          <button
            onMouseEnter={() => playHover()}
            onClick={() => { playClick(); onSync(); }}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
            style={{
              background: 'rgba(220,38,38,0.1)',
              border: '1px solid rgba(220,38,38,0.3)',
              color: '#f87171',
            }}
          >
            <RefreshCw size={13} />
            Sync PNCP
          </button>
        )}

        {/* Extrator Manual */}
        <button
          onMouseEnter={() => playHover()}
          onClick={() => { playClick(); onOpenRobo(); }}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
          style={{
            background: 'transparent',
            border: '1px solid var(--c-border)',
            color: 'var(--c-text-2)',
          }}
        >
          <Bot size={13} />
          Extrator Manual
        </button>
      </div>
    </aside>
  );
}
