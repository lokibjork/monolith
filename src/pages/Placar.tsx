import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSound from 'use-sound';
import { Trophy, Zap, Target, TrendingUp, Crown } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Avatar from '../components/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { buscarLeaderboard, calcularNivel, LeaderboardEntry } from '../services/xpEngine';

const MEDALHAS = ['🥇', '🥈', '🥉'];

function BarraXP({ progresso, cor }: { progresso: number; cor: string }) {
  return (
    <div className="w-full h-1.5 bg-zinc-900 border border-zinc-800 relative overflow-hidden">
      <div
        className="h-full transition-all duration-1000"
        style={{ width: `${progresso}%`, backgroundColor: cor, boxShadow: `0 0 6px ${cor}` }}
      />
    </div>
  );
}

function CardAgente({ entry, posicao, isVoce }: { entry: LeaderboardEntry; posicao: number; isVoce: boolean }) {
  const nivel = calcularNivel(entry.xp_total);

  return (
    <div className={`relative p-5 border-2 transition-all ${isVoce
      ? 'bg-red-950/20 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.15)]'
      : 'bg-[#12141d] border-zinc-800'}`}
    >
      {/* Posição */}
      <div className="absolute top-3 right-4 text-2xl">
        {posicao <= 3 ? MEDALHAS[posicao - 1] : (
          <span className="text-zinc-600 font-black font-mono text-sm">#{posicao}</span>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Avatar nome={entry.nome} cor={entry.cor} avatar_url={entry.avatar_url} size="md" />
          {posicao === 1 && (
            <Crown size={12} className="absolute -top-1.5 -right-1 text-yellow-400" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-zinc-100 uppercase tracking-widest text-sm truncate">{entry.nome}</span>
            {isVoce && <span className="text-[8px] font-bold text-red-400 border border-red-900/50 px-1 uppercase">você</span>}
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: nivel.cor }}>
            [{`LVL ${nivel.indice}`}] {nivel.label}
          </span>
        </div>
      </div>

      {/* Barra de XP */}
      <div className="mb-4">
        <div className="flex justify-between text-[9px] font-mono text-zinc-500 mb-1">
          <span>{entry.xp_total} XP</span>
          {!nivel.isMax && <span>{nivel.xpNivelAtual}/{nivel.xpParaProximo} → LVL {nivel.indice + 1}</span>}
          {nivel.isMax && <span className="text-yellow-400">MAX LEVEL</span>}
        </div>
        <BarraXP progresso={nivel.progresso} cor={nivel.cor} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-800">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-yellow-400 mb-0.5">
            <Trophy size={11} />
            <span className="font-black text-base">{entry.vitorias}</span>
          </div>
          <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">Vitórias</span>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-emerald-400 mb-0.5">
            <TrendingUp size={11} />
            <span className="font-black text-sm">
              {entry.lucro_total >= 1000
                ? `R$${(entry.lucro_total / 1000).toFixed(1)}k`
                : `R$${entry.lucro_total.toFixed(0)}`}
            </span>
          </div>
          <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">Lucro</span>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-blue-400 mb-0.5">
            <Target size={11} />
            <span className="font-black text-base">{entry.itens_cotados}</span>
          </div>
          <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">Itens</span>
        </div>
      </div>
    </div>
  );
}

export default function Placar() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const [ranking, setRanking] = useState<LeaderboardEntry[]>([]);
  const [carregando, setCarregando] = useState(true);

  useSound('/sounds/hover.mp3', { volume: 0.15 });

  useEffect(() => {
    buscarLeaderboard().then(data => {
      setRanking(data);
      setCarregando(false);
    });
  }, []);

  const meuPerfil = ranking.find(r => r.id === perfil?.id);
  const minhaPosicao = ranking.findIndex(r => r.id === perfil?.id) + 1;
  const meuNivel = meuPerfil ? calcularNivel(meuPerfil.xp_total) : null;

  return (
    <div className="flex flex-1 w-full overflow-hidden relative">
      <Sidebar onOpenRobo={() => navigate('/dashboard')} />

      <main className="flex-1 flex flex-col pt-10 overflow-hidden bg-[#0c0d12] z-10 relative">
        <div className="p-8 overflow-y-auto h-full aba-animada">

          {/* HEADER */}
          <header className="mb-10 border-b-2 border-zinc-800 pb-6 flex items-end justify-between">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-zinc-900 border-2 border-red-900 flex items-center justify-center text-red-500 shadow-[4px_4px_0_0_rgba(220,38,38,0.2)]">
                <Zap size={32} strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-widest uppercase text-zinc-100">
                  Sys.<span className="text-red-600">Leaderboard</span>
                </h1>
                <p className="text-xs text-zinc-500 mt-1 font-mono uppercase">Ranking de performance da equipe</p>
              </div>
            </div>
            {meuNivel && minhaPosicao > 0 && (
              <div className="text-right font-mono">
                <span className="text-[9px] text-zinc-600 uppercase">sua posição</span>
                <p className="text-3xl font-black" style={{ color: meuNivel.cor }}>#{minhaPosicao}</p>
                <span className="text-[10px] font-bold uppercase" style={{ color: meuNivel.cor }}>
                  {meuNivel.label}
                </span>
              </div>
            )}
          </header>

          {/* MEU CARD DESTAQUE (se não estiver no top visível) */}
          {meuPerfil && minhaPosicao > 3 && (
            <div className="mb-6">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Sua posição</p>
              <CardAgente entry={meuPerfil} posicao={minhaPosicao} isVoce={true} />
            </div>
          )}

          {/* RANKING */}
          {carregando ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-zinc-800 border-t-red-600 animate-spin" />
            </div>
          ) : ranking.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-zinc-800">
              <p className="text-zinc-600 font-mono text-sm uppercase">Nenhum dado ainda. Comece a cotar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {ranking.map((entry, i) => (
                <CardAgente
                  key={entry.id}
                  entry={entry}
                  posicao={i + 1}
                  isVoce={entry.id === perfil?.id}
                />
              ))}
            </div>
          )}

          {/* TABELA DE NÍVEIS */}
          <div className="mt-12 bg-[#12141d] border border-zinc-800 p-6">
            <h3 className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-4 border-b border-zinc-800 pb-3">
              Tabela de Classificação
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { xp: 0, label: 'GHOST', cor: '#52525b' },
                { xp: 100, label: 'INFILTRATOR', cor: '#0891b2' },
                { xp: 300, label: 'OPERATIVE', cor: '#2563eb' },
                { xp: 600, label: 'SPECIALIST', cor: '#7c3aed' },
                { xp: 1000, label: 'AGENT', cor: '#dc2626' },
                { xp: 2000, label: 'SENIOR AGENT', cor: '#ea580c' },
                { xp: 4000, label: 'COMMANDER', cor: '#d97706' },
              ].map(n => (
                <div key={n.label} className="flex items-center gap-2 p-2 bg-black/30 border border-zinc-800">
                  <div className="w-2 h-6" style={{ backgroundColor: n.cor, boxShadow: `0 0 4px ${n.cor}` }} />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: n.cor }}>{n.label}</p>
                    <p className="text-[9px] text-zinc-600 font-mono">{n.xp.toLocaleString()} XP</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-[9px] font-mono text-zinc-500">
              <div>🎯 Participar edital: <span className="text-blue-400 font-bold">+5 XP</span></div>
              <div>💰 Cotar item: <span className="text-blue-400 font-bold">+10 XP</span></div>
              <div>✅ 100% cotado: <span className="text-purple-400 font-bold">+50 XP</span></div>
              <div>🏆 Vitória: <span className="text-yellow-400 font-bold">+200 XP</span></div>
              <div>📈 Margem {'>'} 20%: <span className="text-emerald-400 font-bold">+50 XP bonus</span></div>
              <div>🚀 Margem {'>'} 30%: <span className="text-emerald-400 font-bold">+100 XP bonus</span></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
