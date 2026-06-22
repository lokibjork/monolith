import { supabase } from './supabase';

// ============================================================
// SISTEMA DE XP
// ============================================================

export type Acao =
  | 'participou'        // +5 XP
  | 'cotou_item'        // +10 XP (+15 se margem > 30%)
  | 'cotacao_concluida' // +50 XP (todos os itens cotados)
  | 'ganhou';           // +200 XP

const XP_BASE: Record<Acao, number> = {
  participou: 5,
  cotou_item: 10,
  cotacao_concluida: 50,
  ganhou: 200,
};

// ============================================================
// NÍVEIS CYBER / HACKER
// ============================================================
const NIVEIS = [
  { min: 0,    label: 'GHOST',        cor: '#52525b' },
  { min: 100,  label: 'INFILTRATOR',  cor: '#0891b2' },
  { min: 300,  label: 'OPERATIVE',    cor: '#2563eb' },
  { min: 600,  label: 'SPECIALIST',   cor: '#7c3aed' },
  { min: 1000, label: 'AGENT',        cor: '#dc2626' },
  { min: 2000, label: 'SENIOR AGENT', cor: '#ea580c' },
  { min: 4000, label: 'COMMANDER',    cor: '#d97706' },
];

export interface NivelInfo {
  indice: number;
  label: string;
  cor: string;
  xpTotal: number;
  xpNivelAtual: number;   // XP dentro do nível atual
  xpParaProximo: number;  // XP necessário para o próximo nível
  progresso: number;      // 0-100%
  isMax: boolean;
}

export function calcularNivel(xpTotal: number): NivelInfo {
  let indice = 0;
  for (let i = 0; i < NIVEIS.length; i++) {
    if (xpTotal >= NIVEIS[i].min) indice = i;
  }

  const isMax = indice === NIVEIS.length - 1;
  const xpNivelAtual = xpTotal - NIVEIS[indice].min;
  const xpParaProximo = isMax ? 0 : NIVEIS[indice + 1].min - NIVEIS[indice].min;
  const progresso = isMax ? 100 : Math.min(100, Math.round((xpNivelAtual / xpParaProximo) * 100));

  return {
    indice,
    label: NIVEIS[indice].label,
    cor: NIVEIS[indice].cor,
    xpTotal,
    xpNivelAtual,
    xpParaProximo,
    progresso,
    isMax,
  };
}

// ============================================================
// REGISTRAR AÇÃO NO LOG
// ============================================================
export async function registrarAcao(params: {
  editalId: number;
  editalOrgao?: string;
  agenteId: string;
  agenteNome: string;
  agenteCor: string;
  acao: Acao;
  detalhe?: string;
  xpBonus?: number;
}): Promise<number> {
  const xp = XP_BASE[params.acao] + (params.xpBonus || 0);

  await supabase.from('log_atividade').insert({
    edital_id: params.editalId,
    edital_orgao: params.editalOrgao,
    agente_id: params.agenteId,
    agente_nome: params.agenteNome,
    agente_cor: params.agenteCor,
    acao: params.acao,
    detalhe: params.detalhe || '',
    xp_ganho: xp,
  });

  return xp;
}

// ============================================================
// REGISTRAR VITÓRIA
// ============================================================
export async function registrarVitoria(params: {
  editalId: number;
  agenteId: string;
  agenteNome: string;
  agenteCor: string;
  orgao: string;
  numero: string;
  valorTotal: number;
  lucroLiquido: number;
}): Promise<number> {
  const margem = params.valorTotal > 0
    ? ((params.lucroLiquido / params.valorTotal) * 100)
    : 0;

  // Bônus de XP por margem alta (> 30%)
  const xpBonus = margem > 30 ? 100 : margem > 20 ? 50 : 0;

  await supabase.from('disputas_ganhas').insert({
    edital_id: params.editalId,
    agente_id: params.agenteId,
    agente_nome: params.agenteNome,
    agente_cor: params.agenteCor,
    orgao: params.orgao,
    numero: params.numero,
    valor_total: params.valorTotal,
    lucro_liquido: params.lucroLiquido,
    margem_percentual: margem,
  });

  // Também registra no log
  await registrarAcao({
    editalId: params.editalId,
    editalOrgao: params.orgao,
    agenteId: params.agenteId,
    agenteNome: params.agenteNome,
    agenteCor: params.agenteCor,
    acao: 'ganhou',
    detalhe: `Lucro: R$ ${params.lucroLiquido.toFixed(2)} (${margem.toFixed(1)}% margem)`,
    xpBonus,
  });

  return XP_BASE['ganhou'] + xpBonus;
}

// ============================================================
// BUSCAR LEADERBOARD
// ============================================================
export interface LeaderboardEntry {
  id: string;
  nome: string;
  cor: string;
  avatar_url: string | null;
  cargo: string;
  xp_total: number;
  vitorias: number;
  lucro_total: number;
  itens_cotados: number;
}

export async function buscarLeaderboard(): Promise<LeaderboardEntry[]> {
  // XP total por agente
  const { data: xpData } = await supabase
    .from('log_atividade')
    .select('agente_id, xp_ganho');

  // Vitórias e lucro por agente
  const { data: vitoriaData } = await supabase
    .from('disputas_ganhas')
    .select('agente_id, lucro_liquido');

  // Itens cotados por agente
  const { data: itensData } = await supabase
    .from('itens')
    .select('cotado_por_id')
    .not('cotado_por_id', 'is', null);

  // Perfis
  const { data: perfis } = await supabase
    .from('profiles')
    .select('id, nome, cor, avatar_url, cargo');

  if (!perfis) return [];

  return perfis
    .map(p => {
      const xp = (xpData || [])
        .filter(x => x.agente_id === p.id)
        .reduce((acc, x) => acc + (x.xp_ganho || 0), 0);

      const vitoriasFiltradas = (vitoriaData || []).filter(v => v.agente_id === p.id);
      const lucro = vitoriasFiltradas.reduce((acc, v) => acc + (v.lucro_liquido || 0), 0);
      const itensCotados = (itensData || []).filter(i => i.cotado_por_id === p.id).length;

      return {
        id: p.id,
        nome: p.nome,
        cor: p.cor,
        avatar_url: p.avatar_url,
        cargo: p.cargo,
        xp_total: xp,
        vitorias: vitoriasFiltradas.length,
        lucro_total: lucro,
        itens_cotados: itensCotados,
      };
    })
    .sort((a, b) => b.xp_total - a.xp_total);
}
