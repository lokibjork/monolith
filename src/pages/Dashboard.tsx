import { useState, useEffect, useRef } from 'react';
import useSound from 'use-sound';
import { fetch } from '@tauri-apps/plugin-http';
import { open } from '@tauri-apps/plugin-shell';
import {
  Calendar, Bot, X, ArrowBigLeftDashIcon,
  FileText, Eye, Printer, AlertTriangle,
  Trash2, ExternalLink, Eraser, Ban,
  RefreshCw, CheckCircle2, Crosshair, Bomb,
  Trophy, Search, Download, Lock
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { sincronizarPNCP } from '../services/pncpAutoSync';
import { buscarEmpresaConfig, EmpresaConfig } from '../services/empresaConfig';
import Sidebar from '../components/Sidebar';
import Avatar from '../components/Avatar';
import Onboarding from '../components/Onboarding';
import { useAuth } from '../contexts/AuthContext';

function extrairMaiorArray(obj: any): any[] {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  if (typeof obj === 'object') {
    let maior = [] as any[];
    for (const key of Object.keys(obj)) {
      const resultado = extrairMaiorArray(obj[key]);
      if (resultado.length > maior.length) maior = resultado;
    }
    return maior;
  }
  return [];
}

function calcularTempoRestante(dataStr: string) {
  if (!dataStr || dataStr === 'Não informada') return { txt: 'N/A', cor: 'text-zinc-500 border-zinc-700 bg-zinc-900/50' };
  try {
    const partes = dataStr.match(/(\d{2})\/(\d{2})\/(\d{4}).*?(\d{2}):(\d{2})/);
    if (!partes) return { txt: dataStr, cor: 'text-zinc-500 border-zinc-700 bg-zinc-900/50' };
    const dataSessao = new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]), Number(partes[4]), Number(partes[5]));
    const agora = new Date(); const diff = dataSessao.getTime() - agora.getTime();
    if (diff <= 0) return { txt: 'ENCERRADO', cor: 'text-zinc-600 border-zinc-800 bg-zinc-950 font-bold' };
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (dias >= 14) return { txt: `${dias}d ${horas}h`, cor: 'text-zinc-400 border-zinc-700 bg-zinc-900/50' };
    if (dias >= 7)  return { txt: `${dias}d ${horas}h`, cor: 'text-zinc-300 border-zinc-600 bg-zinc-800/60' };
    if (dias >= 3)  return { txt: `${dias}d ${horas}h`, cor: 'text-amber-400 border-amber-800/60 bg-amber-950/30' };
    if (dias >= 1)  return { txt: `${dias}d ${horas}h`, cor: 'text-red-400 border-red-900/50 bg-red-950/30 font-bold' };
    if (horas > 0)  return { txt: `T-${horas}h ${minutos}m`, cor: 'text-red-400 border-red-500 bg-red-950/80 font-bold animate-pulse' };
    return { txt: `CRÍTICO: ${minutos}m`, cor: 'text-red-50 bg-red-600 border-red-400 font-bold animate-pulse' };
  } catch (e) { return { txt: dataStr, cor: 'text-zinc-600 border-zinc-700' }; }
}

export default function Dashboard() {
  const { perfil } = useAuth();
  const [editais, setEditais] = useState<any[]>([]);
  const [editalAtivo, setEditalAtivo] = useState<any>(null);
  const [abaAtiva, setAbaAtiva] = useState('itens');
  const [itens, setItens] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);

  // Estados de Modais
  const [isModalRoboOpen, setIsModalRoboOpen] = useState(false);
  const [linkRobo, setLinkRobo] = useState('');
  const [statusRobo, setStatusRobo] = useState<'idle' | 'scraping' | 'sucesso'>('idle');
  const [mensagemRobo, setMensagemRobo] = useState('');

  const [isModalCotacaoOpen, setIsModalCotacaoOpen] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<any>(null);
  const [dadosCotacao, setDadosCotacao] = useState({ fornecedor: '', preco: 0, link: '', frete: 0, freteGratis: true, margem: 30, ignorado: 0 });

  const [isModalPdfOpen, setIsModalPdfOpen] = useState(false);
  const [itemPdf, setItemPdf] = useState<any>(null);
  const [dadosPdf, setDadosPdf] = useState({ marca: '', modelo: '', descricao: '', imagem: '', quantidade: 1, valorUnitario: 0, prazoEntrega: '30', validadeProposta: '90' });
  const [empresaCfg, setEmpresaCfg] = useState<EmpresaConfig | null>(null);
  const [docVisualizacao, setDocVisualizacao] = useState<string | null>(null);

  // Auto-Sync
  type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const [syncResult, setSyncResult] = useState<{ novos: number; removidos: number } | null>(null);

  // Registrar Vitória
  const [isModalVitoriaOpen, setIsModalVitoriaOpen] = useState(false);
  const [dadosVitoria, setDadosVitoria] = useState({ valorTotal: 0, lucroLiquido: 0 });

  // Busca e filtro (painel de editais)
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'participando'>('todos');

  // Progresso por edital
  const [progressoMap, setProgressoMap] = useState<Record<number, { total: number; cotados: number }>>({});

  // Filtro dentro do edital (Task #2)
  const [buscaItens, setBuscaItens] = useState('');

  // Banco de Fornecedores — autocomplete (Task #3)
  const [sugestoesFornecedor, setSugestoesFornecedor] = useState<Array<{ fornecedor: string; preco: number; link: string }>>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const fornecedorRef = useRef<HTMLDivElement>(null);

  // Bloqueio de item em tempo real (Task #5)
  const [itensLocked, setItensLocked] = useState<Record<number, { nome: string; cor: string }>>({});

  // Participantes por edital (multiplayer)
  type Participante = { user_id: string; user_nome: string; user_cor: string; user_avatar_url?: string | null };
  const [participantesMap, setParticipantesMap] = useState<Record<number, Participante[]>>({});

  // Observações por edital
  const [obsTexto, setObsTexto] = useState('');
  const [obsTags, setObsTags] = useState<string[]>([]);
  const [obsSalvando, setObsSalvando] = useState(false);

  // Sala de Guerra — disputa ao vivo
  type LogLance = { itemNome: string; concorrente: number; ideal: number | null; status: 'vantagem' | 'limite' | 'prejuizo'; ts: string };
  const [lanceConcorrente, setLanceConcorrente] = useState<Record<number, string>>({});
  const [historicoLances, setHistoricoLances] = useState<LogLance[]>([]);
  const [sessaoInicio] = useState<Date>(new Date());

  // Onboarding (Task #6)
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);

  const [playHover] = useSound('/sounds/hover.mp3', { volume: 0.15 });
  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.3 });
  const [playSuccess] = useSound('/sounds/success.mp3', { volume: 0.4 });
  const [playAlert] = useSound('/sounds/alert.mp3', { volume: 0.5 });

  // Cálculos de Lance
  const custoTotalItem = Number((dadosCotacao.preco + (dadosCotacao.freteGratis ? 0 : dadosCotacao.frete)).toFixed(2));
  const lanceMinimoCalculado = Number((custoTotalItem + (custoTotalItem * (dadosCotacao.margem / 100))).toFixed(2));

  // Carregamento Inicial + Auto-Sync + check Onboarding
  useEffect(() => {
    carregarEditaisDaNuveem();
    executarAutoSync();
  }, []);

  // Detecta primeiro acesso (onboarding)
  useEffect(() => {
    if (perfil && perfil.onboarding_concluido === false) {
      setMostrarOnboarding(true);
    }
  }, [perfil]);

  // Carrega Itens e Documentos quando entra num Edital
  useEffect(() => {
    if (editalAtivo) {
      if (abaAtiva === 'itens') carregarItensDaNuvem(editalAtivo.id);
      if (abaAtiva === 'documentos') carregarDocumentosDaNuvem(editalAtivo.id);
    }
  }, [editalAtivo, abaAtiva]);

  // Carrega observações quando o edital ativo muda
  useEffect(() => {
    if (editalAtivo) {
      setObsTexto(editalAtivo.observacoes || '');
      setObsTags(editalAtivo.tags || []);
    }
  }, [editalAtivo?.id]);

  // Realtime: itens do edital ativo (bloqueio de cotação)
  useEffect(() => {
    if (!editalAtivo) return;
    const channel = supabase
      .channel(`itens-edital-${editalAtivo.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'itens',
        filter: `edital_id=eq.${editalAtivo.id}`,
      }, (payload) => {
        const updated = payload.new as any;
        // Atualiza lista de itens do edital ativo
        setItens(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
        // Atualiza barra de progresso em tempo real
        setProgressoMap(prev => {
          const editalId = updated.edital_id;
          if (!prev[editalId]) return prev;
          const entrada = prev[editalId];
          // Detecta se o item mudou de estado (cotado <-> pendente)
          const novoTotal = entrada.total;
          let novoCotados = entrada.cotados;
          // Só ajusta se o item não está ignorado
          if (updated.ignorado !== 1) {
            // Recarrega o progresso do servidor de forma leve
            supabase.from('itens').select('melhor_cotacao, ignorado').eq('edital_id', editalId).then(({ data }) => {
              if (data) {
                const ativos = data.filter(i => i.ignorado !== 1);
                setProgressoMap(p => ({
                  ...p,
                  [editalId]: { total: ativos.length, cotados: ativos.filter(i => i.melhor_cotacao > 0).length }
                }));
              }
            });
          }
          return { ...prev, [editalId]: { total: novoTotal, cotados: novoCotados } };
        });
        if (updated.locked_by_id && updated.locked_by_id !== perfil?.id) {
          setItensLocked(prev => ({ ...prev, [updated.id]: { nome: updated.locked_by_nome, cor: updated.locked_by_cor || '#dc2626' } }));
        } else {
          setItensLocked(prev => { const n = { ...prev }; delete n[updated.id]; return n; });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [editalAtivo?.id]);

  // Realtime: lista de editais (qualquer atualização de outro usuário)
  useEffect(() => {
    const channel = supabase
      .channel('editais-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'editais',
      }, () => {
        carregarEditaisDaNuveem();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Realtime: participantes (entrada/saída de usuários)
  useEffect(() => {
    const channel = supabase
      .channel('participantes-realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'edital_participantes',
      }, (payload) => {
        const p = payload.new as any;
        setParticipantesMap(prev => ({
          ...prev,
          [p.edital_id]: [...(prev[p.edital_id] || []).filter(x => x.user_id !== p.user_id),
            { user_id: p.user_id, user_nome: p.user_nome, user_cor: p.user_cor, user_avatar_url: p.user_avatar_url }],
        }));
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'edital_participantes',
      }, (payload) => {
        const p = payload.old as any;
        setParticipantesMap(prev => ({
          ...prev,
          [p.edital_id]: (prev[p.edital_id] || []).filter(x => x.user_id !== p.user_id),
        }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ESC para fechar qualquer modal aberto
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isModalCotacaoOpen) { fecharModalCotacao(); }
      else if (isModalPdfOpen) { setIsModalPdfOpen(false); setItemPdf(null); }
      else if (isModalVitoriaOpen) setIsModalVitoriaOpen(false);
      else if (isModalRoboOpen) setIsModalRoboOpen(false);
      else if (docVisualizacao) setDocVisualizacao(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isModalCotacaoOpen, isModalPdfOpen, isModalVitoriaOpen, isModalRoboOpen, docVisualizacao]);

  // Fechar dropdown de sugestões ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fornecedorRef.current && !fornecedorRef.current.contains(e.target as Node)) {
        setMostrarSugestoes(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ==========================================
  // SUPABASE / DADOS
  // ==========================================
  async function carregarParticipantes() {
    const { data } = await supabase.from('edital_participantes').select('edital_id, user_id, user_nome, user_cor, user_avatar_url');
    if (data) {
      const mapa: Record<number, Participante[]> = {};
      data.forEach((p: any) => {
        if (!mapa[p.edital_id]) mapa[p.edital_id] = [];
        mapa[p.edital_id].push({ user_id: p.user_id, user_nome: p.user_nome, user_cor: p.user_cor, user_avatar_url: p.user_avatar_url });
      });
      setParticipantesMap(mapa);
    }
  }

  async function carregarEditaisDaNuveem() {
    const { data } = await supabase.from('editais').select('*').order('id', { ascending: false });
    if (data) setEditais(data);
    await carregarParticipantes();
    const { data: itensResumo } = await supabase.from('itens').select('edital_id, melhor_cotacao, ignorado');
    if (itensResumo) {
      const mapa: Record<number, { total: number; cotados: number }> = {};
      itensResumo.forEach(item => {
        if (!mapa[item.edital_id]) mapa[item.edital_id] = { total: 0, cotados: 0 };
        if (item.ignorado !== 1) {
          mapa[item.edital_id].total++;
          if (item.melhor_cotacao > 0) mapa[item.edital_id].cotados++;
        }
      });
      setProgressoMap(mapa);
    }
  }

  async function carregarItensDaNuvem(editalId: number) {
    const { data } = await supabase.from('itens').select('*').eq('edital_id', editalId).order('id', { ascending: true });
    if (data) {
      setItens(data);
      // Monta mapa de bloqueios
      const locks: Record<number, { nome: string; cor: string }> = {};
      data.forEach(item => {
        if (item.locked_by_id && item.locked_by_id !== perfil?.id) {
          locks[item.id] = { nome: item.locked_by_nome, cor: item.locked_by_cor || '#dc2626' };
        }
      });
      setItensLocked(locks);
    }
  }

  async function carregarDocumentosDaNuvem(editalId: number) {
    const { data } = await supabase.from('documentos').select('*').eq('edital_id', editalId);
    if (data) setDocumentos(data);
  }

  async function executarAutoSync() {
    setSyncStatus('syncing');
    setSyncMsg('Sincronizando com PNCP...');
    try {
      const resultado = await sincronizarPNCP((msg) => setSyncMsg(msg));
      setSyncResult({ novos: resultado.novos, removidos: resultado.removidos });
      setSyncStatus('ok');
      if (resultado.novos > 0 || resultado.removidos > 0) {
        playSuccess();
        await carregarEditaisDaNuveem();
      }
    } catch {
      setSyncStatus('error');
      setSyncMsg('Falha na conexão com PNCP.');
    }
  }

  async function handleExcluirTodos() {
    playAlert();
    if (!window.confirm('Isso vai excluir todos os editais que ninguém está participando. Deseja continuar?')) return;
    // Protege editais que tenham ao menos 1 participante
    const { data: comParticipantes } = await supabase.from('edital_participantes').select('edital_id');
    const idsProtegidos = [...new Set((comParticipantes || []).map((p: any) => p.edital_id))];
    let query = supabase.from('editais').delete();
    if (idsProtegidos.length > 0) {
      query = query.not('id', 'in', `(${idsProtegidos.join(',')})`);
    }
    await query;
    playClick();
    await carregarEditaisDaNuveem();
  }

  async function handleParticipar(edital: any) {
    if (!perfil) return;
    playClick();
    const jaParticipando = participantesMap[edital.id]?.some(p => p.user_id === perfil.id);
    if (jaParticipando) {
      await supabase.from('edital_participantes')
        .delete()
        .eq('edital_id', edital.id)
        .eq('user_id', perfil.id);
      setParticipantesMap(prev => ({
        ...prev,
        [edital.id]: (prev[edital.id] || []).filter(p => p.user_id !== perfil.id),
      }));
    } else {
      await supabase.from('edital_participantes').insert({
        edital_id: edital.id,
        user_id: perfil.id,
        user_nome: perfil.nome,
        user_cor: perfil.cor,
        user_avatar_url: perfil.avatar_url ?? null,
      });
      playSuccess();
      setParticipantesMap(prev => ({
        ...prev,
        [edital.id]: [...(prev[edital.id] || []), { user_id: perfil.id, user_nome: perfil.nome, user_cor: perfil.cor, user_avatar_url: perfil.avatar_url }],
      }));
    }
  }

  async function handleExcluirEdital() {
    playAlert();
    if (!window.confirm('Tem certeza que deseja excluir este edital e todos os dados associados?')) return;
    await supabase.from('editais').delete().eq('id', editalAtivo.id);
    setEditalAtivo(null);
    await carregarEditaisDaNuveem();
    playClick();
  }

  // ==========================================
  // COTAÇÃO
  // ==========================================
  async function abrirModalCotacao(item: any) {
    // Bloqueia o item para outros usuários
    if (perfil) {
      await supabase.from('itens').update({
        locked_by_id: perfil.id,
        locked_by_nome: perfil.nome,
        locked_by_cor: perfil.cor,
        locked_at: new Date().toISOString(),
      }).eq('id', item.id);
    }
    playClick();
    setItemSelecionado(item);
    setDadosCotacao({
      fornecedor: item.fornecedor !== 'Pendente' ? item.fornecedor : '',
      preco: item.melhor_cotacao || 0,
      link: item.link || '',
      frete: item.frete || 0,
      freteGratis: item.frete === 0,
      margem: item.margem_lucro || 30,
      ignorado: item.ignorado || 0,
    });
    setIsModalCotacaoOpen(true);
  }

  async function fecharModalCotacao() {
    // Libera o bloqueio do item
    if (itemSelecionado && perfil) {
      await supabase.from('itens').update({
        locked_by_id: null,
        locked_by_nome: null,
        locked_by_cor: null,
        locked_at: null,
      }).eq('id', itemSelecionado.id);
    }
    setIsModalCotacaoOpen(false);
    setItemSelecionado(null);
    setSugestoesFornecedor([]);
    setMostrarSugestoes(false);
  }

  async function buscarSugestoesFornecedor(nome: string) {
    if (nome.length < 2) { setSugestoesFornecedor([]); return; }
    const { data } = await supabase
      .from('fornecedores_historico')
      .select('fornecedor, preco, link')
      .ilike('item_nome', `%${itemSelecionado?.nome?.substring(0, 30) || ''}%`)
      .ilike('fornecedor', `%${nome}%`)
      .order('atualizado_em', { ascending: false })
      .limit(5);
    if (data && data.length > 0) {
      setSugestoesFornecedor(data);
      setMostrarSugestoes(true);
    } else {
      setSugestoesFornecedor([]);
      setMostrarSugestoes(false);
    }
  }

  function aplicarSugestao(s: { fornecedor: string; preco: number; link: string }) {
    setDadosCotacao(prev => ({ ...prev, fornecedor: s.fornecedor, preco: s.preco, link: s.link }));
    setMostrarSugestoes(false);
  }

  async function handleSalvarCotacao(e: React.FormEvent) {
    e.preventDefault();
    const freteFinal = dadosCotacao.freteGratis ? 0 : dadosCotacao.frete;
    await supabase.from('itens').update({
      melhor_cotacao: dadosCotacao.preco,
      fornecedor: dadosCotacao.fornecedor,
      link: dadosCotacao.link,
      frete: freteFinal,
      margem_lucro: dadosCotacao.margem,
      lance_minimo: lanceMinimoCalculado,
      ignorado: 0,
      cotado_por_id: perfil?.id,
      cotado_por_nome: perfil?.nome,
      cotado_por_cor: perfil?.cor,
      // Libera o bloqueio ao salvar
      locked_by_id: null,
      locked_by_nome: null,
      locked_by_cor: null,
      locked_at: null,
    }).eq('id', itemSelecionado.id);

    // Salva no banco de fornecedores para autocomplete futuro
    if (dadosCotacao.fornecedor && dadosCotacao.preco > 0 && itemSelecionado?.nome) {
      await supabase.from('fornecedores_historico').upsert({
        item_nome: itemSelecionado.nome.substring(0, 200),
        fornecedor: dadosCotacao.fornecedor,
        preco: dadosCotacao.preco,
        link: dadosCotacao.link || '',
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'item_nome,fornecedor' });
    }

    setIsModalCotacaoOpen(false);
    setItemSelecionado(null);
    setSugestoesFornecedor([]);
    setMostrarSugestoes(false);
    await carregarItensDaNuvem(editalAtivo.id);
    if (lanceMinimoCalculado > itemSelecionado.preco_alvo) playAlert(); else playSuccess();
  }

  async function handleLimparCotacao() {
    await supabase.from('itens').update({
      melhor_cotacao: 0, fornecedor: 'Pendente', link: '', frete: 0,
      margem_lucro: 30, lance_minimo: 0, ignorado: 0,
      locked_by_id: null, locked_by_nome: null, locked_by_cor: null, locked_at: null,
    }).eq('id', itemSelecionado.id);
    setIsModalCotacaoOpen(false);
    setItemSelecionado(null);
    await carregarItensDaNuvem(editalAtivo.id);
    playClick();
  }

  async function handleIgnorarItem() {
    await supabase.from('itens').update({
      melhor_cotacao: 0, fornecedor: 'IGNORADO', link: '', frete: 0,
      margem_lucro: 0, lance_minimo: 0, ignorado: 1,
      locked_by_id: null, locked_by_nome: null, locked_by_cor: null, locked_at: null,
    }).eq('id', itemSelecionado.id);
    setIsModalCotacaoOpen(false);
    setItemSelecionado(null);
    await carregarItensDaNuvem(editalAtivo.id);
    playClick();
  }

  // ==========================================
  // OBSERVAÇÕES
  // ==========================================
  const TAGS_DISPONIVEIS = ['AMOSTRA', 'PRAZO CURTO', 'PARCELADO', 'EXCLUSIVO ME/EPP', 'VISITA TÉCNICA', 'FRETE INCLUSO', 'ATENÇÃO'];

  function toggleTag(tag: string) {
    playClick();
    setObsTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  async function handleSalvarObs() {
    if (!editalAtivo) return;
    setObsSalvando(true);
    await supabase.from('editais').update({ observacoes: obsTexto, tags: obsTags }).eq('id', editalAtivo.id);
    setEditais(prev => prev.map(e => e.id === editalAtivo.id ? { ...e, observacoes: obsTexto, tags: obsTags } : e));
    setEditalAtivo((prev: any) => ({ ...prev, observacoes: obsTexto, tags: obsTags }));
    setObsSalvando(false);
    playSuccess();
  }

  // ==========================================
  // REGISTRAR VITÓRIA (sem XP)
  // ==========================================
  async function handleRegistrarVitoria(e: React.FormEvent) {
    e.preventDefault();
    if (!perfil || !editalAtivo) return;
    await supabase.from('disputas_ganhas').insert({
      edital_id: editalAtivo.id,
      agente_id: perfil.id,
      agente_nome: perfil.nome,
      agente_cor: perfil.cor,
      orgao: editalAtivo.orgao,
      numero: editalAtivo.numero,
      valor_total: dadosVitoria.valorTotal,
      lucro_liquido: dadosVitoria.lucroLiquido,
      margem_percentual: dadosVitoria.valorTotal > 0 ? (dadosVitoria.lucroLiquido / dadosVitoria.valorTotal) * 100 : 0,
    });
    playSuccess();
    setIsModalVitoriaOpen(false);
    setDadosVitoria({ valorTotal: 0, lucroLiquido: 0 });
  }

  // ==========================================
  // EXPORTAR CSV (Task #4)
  // ==========================================
  function exportarCSV() {
    playClick();
    const headers = ['Nº', 'Descrição', 'Qtd', 'Teto (R$)', 'Fornecedor', 'Custo Unit (R$)', 'Frete (R$)', 'Margem (%)', 'Lance Mín (R$)', 'Lance Total (R$)', 'Situação'];
    const rows = itens.map((item, idx) => {
      const lanTotal = (item.lance_minimo || 0) * item.quantidade;
      const situacao = item.ignorado === 1 ? 'Ignorado' : item.melhor_cotacao > 0 ? (item.lance_minimo <= item.preco_alvo ? 'OK' : 'Acima do teto') : 'Pendente';
      return [
        idx + 1,
        `"${item.nome?.replace(/"/g, '""') || ''}"`,
        item.quantidade,
        item.preco_alvo?.toFixed(2) || '0',
        `"${(item.fornecedor || '').replace(/"/g, '""')}"`,
        item.melhor_cotacao?.toFixed(2) || '0',
        item.frete?.toFixed(2) || '0',
        item.margem_lucro || '0',
        item.lance_minimo?.toFixed(2) || '0',
        lanTotal.toFixed(2),
        situacao,
      ].join(';');
    });
    const csv = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cotacoes_${editalAtivo?.numero?.replace(/[^a-zA-Z0-9]/g, '_') || 'edital'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==========================================
  // PDF
  // ==========================================
  function handleUploadFoto(e: any) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width; let height = img.height;
          if (width > height) { if (width > 800) { height *= 800 / width; width = 800; } }
          else { if (height > 800) { width *= 800 / height; height = 800; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setDadosPdf({ ...dadosPdf, imagem: canvas.toDataURL('image/jpeg', 0.8) });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  function abrirModalPdf(e: React.MouseEvent, item: any) {
    e.stopPropagation(); playClick(); setItemPdf(item);
    setDadosPdf({ marca: '', modelo: '', descricao: item.nome, imagem: '', quantidade: item.quantidade || 1, valorUnitario: item.melhor_cotacao > 0 ? item.melhor_cotacao : item.preco_alvo, prazoEntrega: '30', validadeProposta: '90' });
    buscarEmpresaConfig().then(cfg => setEmpresaCfg(cfg));
    setIsModalPdfOpen(true);
  }

  // Converte número para valor por extenso em português
  function valorPorExtenso(valor: number): string {
    const unidades = ['', 'UM', 'DOIS', 'TRÊS', 'QUATRO', 'CINCO', 'SEIS', 'SETE', 'OITO', 'NOVE', 'DEZ', 'ONZE', 'DOZE', 'TREZE', 'QUATORZE', 'QUINZE', 'DEZESSEIS', 'DEZESSETE', 'DEZOITO', 'DEZENOVE'];
    const dezenas = ['', '', 'VINTE', 'TRINTA', 'QUARENTA', 'CINQUENTA', 'SESSENTA', 'SETENTA', 'OITENTA', 'NOVENTA'];
    const centenas = ['', 'CENTO', 'DUZENTOS', 'TREZENTOS', 'QUATROCENTOS', 'QUINHENTOS', 'SEISCENTOS', 'SETECENTOS', 'OITOCENTOS', 'NOVECENTOS'];
    const especiais: Record<number, string> = { 100: 'CEM', 1000: 'MIL' };
    if (valor === 0) return 'ZERO';
    if (especiais[valor]) return especiais[valor];
    function grupo(n: number): string {
      if (n === 0) return '';
      if (n === 100) return 'CEM';
      const c = Math.floor(n / 100);
      const resto = n % 100;
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      const partes: string[] = [];
      if (c > 0) partes.push(centenas[c]);
      if (resto > 0 && resto < 20) partes.push(unidades[resto]);
      else { if (d > 0) partes.push(dezenas[d]); if (u > 0) partes.push(unidades[u]); }
      return partes.join(' E ');
    }
    const inteiro = Math.floor(valor);
    const cents = Math.round((valor - inteiro) * 100);
    const partes: string[] = [];
    const mil = Math.floor(inteiro / 1000);
    const centPart = inteiro % 1000;
    if (mil === 1) partes.push('MIL');
    else if (mil > 1) partes.push(grupo(mil) + ' MIL');
    if (centPart > 0) partes.push(grupo(centPart));
    let resultado = partes.join(' E ');
    resultado += inteiro === 1 ? ' REAL' : ' REAIS';
    if (cents > 0) resultado += ' E ' + grupo(cents) + (cents === 1 ? ' CENTAVO' : ' CENTAVOS');
    return resultado;
  }

  // ==========================================
  // ROBÔ EXTRATOR PNCP
  // ==========================================
  async function handleAcionarRobo(e: React.FormEvent) {
    e.preventDefault(); playClick(); setStatusRobo('scraping');
    try {
      setMensagemRobo('Verificando link PNCP...');
      const match = linkRobo.match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
      if (!match) throw new Error("Link inválido. Use o formato oficial do portal PNCP.");
      const cnpj = match[1]; const ano = match[2]; const seq = match[3];

      setMensagemRobo('Buscando dados do edital...');
      const urlEdital = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}`;
      const resEdital = await fetch(urlEdital, { method: 'GET' });
      if (!resEdital.ok) throw new Error("Edital não localizado no PNCP.");
      const dataEdital = await resEdital.json();

      setMensagemRobo('Baixando itens (pode ter múltiplas páginas)...');
      let paginaAtual = 1;
      let todosItens: any[] = [];

      while (true) {
        const urlItens = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens?pagina=${paginaAtual}&tamanhoPagina=500`;
        const resItens = await fetch(urlItens, { method: 'GET' });
        if (!resItens.ok) break;
        const dataItensRaw = await resItens.json();
        const itensDaPagina = extrairMaiorArray(dataItensRaw);
        if (itensDaPagina.length === 0) break;
        todosItens = [...todosItens, ...itensDaPagina];
        setMensagemRobo(`Página ${paginaAtual} — ${todosItens.length} itens extraídos...`);
        if (itensDaPagina.length < 500) break;
        paginaAtual++;
      }

      setMensagemRobo('Baixando documentos (PDFs)...');
      const urlArquivos = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`;
      const resArquivos = await fetch(urlArquivos, { method: 'GET' });
      const dataArquivos = resArquivos.ok ? await resArquivos.json() : {};
      const listaDeArquivos = extrairMaiorArray(dataArquivos);

      setMensagemRobo('Salvando no banco de dados...');
      const numero = dataEdital.numeroCompra || `${seq}/${ano}`;
      const orgao = dataEdital.orgaoEntidade?.razaoSocial || "Desconhecido";

      let dataPregao = "Não informada";
      if (dataEdital.dataAberturaProposta) {
        const matchDate = dataEdital.dataAberturaProposta.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (matchDate) dataPregao = `${matchDate[3]}/${matchDate[2]}/${matchDate[1]} - ${matchDate[4]}:${matchDate[5]}`;
      }
      const linkOficialGerado = `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`;

      const { data: existe } = await supabase.from('editais').select('id').eq('numero', numero).eq('uasg', cnpj);
      let idEdital: number;

      if (existe && existe.length > 0) {
        idEdital = existe[0].id;
      } else {
        const { data: insertData, error: errEdital } = await supabase.from('editais').insert({
          numero, orgao, data_pregao: dataPregao, uasg: cnpj, link_oficial: linkOficialGerado, manual: true
        }).select();
        if (errEdital) throw errEdital;
        idEdital = insertData[0].id;

        const itensToInsert = todosItens.map(item => ({
          edital_id: idEdital, nome: item.descricao || item.materialOuServicoNome || "N/A",
          quantidade: item.quantidade || 1, preco_alvo: item.valorUnitarioEstimado || item.valorEstimado || 0
        }));
        await supabase.from('itens').insert(itensToInsert);

        const docsToInsert = listaDeArquivos.map(arquivo => ({
          edital_id: idEdital, titulo: arquivo.titulo || arquivo.nomeArquivo || "Anexo", link: arquivo.linkArquivo || arquivo.url || ""
        })).filter(doc => doc.link !== "");
        if (docsToInsert.length > 0) await supabase.from('documentos').insert(docsToInsert);
      }

      playSuccess();
      setMensagemRobo(`Concluído! ${todosItens.length} itens importados.`);
      setStatusRobo('sucesso');
      await carregarEditaisDaNuveem();
      setTimeout(() => { setIsModalRoboOpen(false); setStatusRobo('idle'); setLinkRobo(''); }, 2500);
    } catch (error: any) {
      playAlert();
      setMensagemRobo('Erro: ' + (error.message || "Falha de conexão."));
      setStatusRobo('idle');
    }
  }

  // ==========================================
  // FILTROS E CÁLCULOS
  // ==========================================
  const editaisFiltrados = editais.filter(e => {
    const termo = busca.toLowerCase();
    const passaBusca = !busca ||
      e.orgao?.toLowerCase().includes(termo) ||
      e.numero?.toLowerCase().includes(termo) ||
      e.objeto?.toLowerCase().includes(termo);
    const passaFiltro = filtroStatus === 'todos' || participantesMap[e.id]?.some(p => p.user_id === perfil?.id);
    return passaBusca && passaFiltro;
  });

  // Filtro dentro do edital (Task #2)
  const itensFiltrados = itens.filter(item =>
    item.nome?.toLowerCase().includes(buscaItens.toLowerCase()) ||
    item.fornecedor?.toLowerCase().includes(buscaItens.toLowerCase())
  );

  const itensNaoIgnorados = itens.filter(i => i.ignorado !== 1);
  const totalItens = itensNaoIgnorados.length;
  const itensCotados = itensNaoIgnorados.filter(i => i.melhor_cotacao > 0);
  const progressoCotacao = totalItens > 0 ? Math.round((itensCotados.length / totalItens) * 100) : 0;

  const totalGoverno = itensNaoIgnorados.reduce((acc, item) => acc + (item.preco_alvo * item.quantidade), 0);
  const custoOperacional = itensCotados.reduce((acc, item) => acc + ((item.melhor_cotacao + (item.frete || 0)) * item.quantidade), 0);
  const lanceTotal = itensCotados.reduce((acc, item) => acc + ((item.lance_minimo || 0) * item.quantidade), 0);
  const lucroLiquido = lanceTotal - custoOperacional;

  // ── GERADOR DE HTML PARA IMPRESSÃO ──────────────────────────────────────
  // Definido FORA do JSX para evitar erro de parser do OXC/Vite:
  // template literals com `</tag>` dentro de atributos JSX são mal interpretados
  // como "Unterminated regular expression".
  function gerarHtmlParaImprimir(
    p1: HTMLElement,
    p2: HTMLElement,
    p3: HTMLElement
  ): string {
    const numero = editalAtivo?.numero || '';
    return (
      '<!DOCTYPE html>' +
      '<html lang="pt-BR"><head>' +
      '<meta charset="UTF-8">' +
      '<title>Proposta ' + numero + '</title>' +
      '<style>' +
      '@page{size:A4 portrait;margin:0}' +
      '*,*::before,*::after{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}' +
      'html,body{margin:0;padding:0;background:white;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:black}' +
      '.pp{padding:14mm 17mm;background:white}' +
      '.pp+.pp{break-before:page;page-break-before:always}' +
      'table{border-collapse:collapse;width:100%}' +
      'img{max-width:100%}' +
      '</style></head>' +
      '<body>' +
      '<div class="pp">' + p1.innerHTML + '</div>' +
      '<div class="pp">' + p2.innerHTML + '</div>' +
      '<div class="pp">' + p3.innerHTML + '</div>' +
      '</body></html>'
    );
  }

  return (
    <div className="flex flex-1 w-full overflow-hidden relative">
      {/* Onboarding — aparece só no primeiro acesso */}
      {mostrarOnboarding && perfil && (
        <Onboarding
          perfilId={perfil.id}
          onConcluir={() => setMostrarOnboarding(false)}
        />
      )}

      <Sidebar onOpenRobo={() => setIsModalRoboOpen(true)} onSync={executarAutoSync} />

      <main className="flex-1 flex flex-col pt-10 overflow-hidden z-10 relative" style={{ background: 'var(--c-bg)' }}>
        {!editalAtivo ? (
          // ==========================================
          // PAINEL DE EDITAIS
          // ==========================================
          <div className="p-8 overflow-y-auto h-full aba-animada">
            <header className="mb-6 border-b-2 border-zinc-800 pb-5">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-black uppercase tracking-widest text-zinc-100">Painel de <span className="text-red-600">Editais</span></h1>
                <div className="flex items-center gap-2">
                  {syncStatus === 'syncing' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-xs font-mono text-red-400">
                      <RefreshCw size={11} className="animate-spin" />
                      <span className="truncate max-w-[200px]">{syncMsg}</span>
                    </div>
                  )}
                  {syncStatus === 'ok' && syncResult && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-emerald-900/50 text-xs font-mono text-emerald-500">
                      <CheckCircle2 size={11} />
                      <span>
                        {syncResult.novos > 0 ? `+${syncResult.novos} novo${syncResult.novos > 1 ? 's' : ''}` : 'Sincronizado'}
                        {syncResult.removidos > 0 && ` · ${syncResult.removidos} removido${syncResult.removidos > 1 ? 's' : ''}`}
                      </span>
                    </div>
                  )}
                  {syncStatus === 'error' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-red-900/50 text-xs font-mono text-red-500">
                      <AlertTriangle size={11} /><span>Falha na sincronização</span>
                    </div>
                  )}
                  <button onMouseEnter={() => playHover()} onClick={() => { playClick(); executarAutoSync(); }} disabled={syncStatus === 'syncing'}
                    className="p-2 border border-zinc-800 bg-black text-zinc-500 hover:text-red-400 hover:border-red-500 transition-all disabled:opacity-30" title="Sincronizar com PNCP">
                    <RefreshCw size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                  </button>
                  {editais.length > 0 && (
                    <button onMouseEnter={() => playHover()} onClick={handleExcluirTodos}
                      className="p-2 border border-red-900/40 bg-black text-red-800 hover:text-red-500 hover:border-red-600 transition-all" title="Excluir todos os editais não participados">
                      <Bomb size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                  <input
                    type="text" value={busca} onChange={e => setBusca(e.target.value)}
                    placeholder="Órgão, número ou palavra-chave..."
                    className="w-full pl-9 pr-4 py-2 bg-black border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-600 transition-all"
                  />
                  {busca && (
                    <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors">
                      <X size={12} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {(['todos', 'participando'] as const).map(f => (
                    <button key={f} onMouseEnter={() => playHover()} onClick={() => { playClick(); setFiltroStatus(f); }}
                      className={`px-4 py-2 text-xs font-bold uppercase tracking-wide border transition-all ${filtroStatus === f ? 'bg-red-600 border-red-600 text-white' : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}>
                      {f === 'todos' ? `Todos (${editais.length})` : `Participando (${editais.filter(e => participantesMap[e.id]?.some(p => p.user_id === perfil?.id)).length})`}
                    </button>
                  ))}
                </div>
              </div>
            </header>

            {editais.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-zinc-800 bg-[#090a0f]">
                <p className="text-zinc-600 text-sm">Nenhum edital encontrado. Use o Sync PNCP ou o Extrator Manual.</p>
              </div>
            ) : editaisFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 border border-dashed border-zinc-800/50 gap-2">
                <Search size={20} className="text-zinc-700" />
                <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest">Nenhum edital encontrado para "<span className="text-zinc-400">{busca}</span>"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {editaisFiltrados.map((edital) => {
                  const tempo = calcularTempoRestante(edital.data_pregao);
                  const listaParticipantes = participantesMap[edital.id] || [];
                  const participando = listaParticipantes.some(p => p.user_id === perfil?.id);
                  const prog = progressoMap[edital.id];
                  const pct = prog && prog.total > 0 ? Math.round((prog.cotados / prog.total) * 100) : null;
                  return (
                    <div
                      key={edital.id}
                      onMouseEnter={() => playHover()}
                      onClick={() => { playClick(); setEditalAtivo(edital); setBuscaItens(''); }}
                      style={participando
                        ? { boxShadow: '0 0 0 1px rgba(16,185,129,0.15), 0 4px 24px rgba(16,185,129,0.06)' }
                        : undefined}
                      className={`flex flex-col group card-premium relative cursor-pointer border-2 transition-all duration-200 hover:shadow-[0_0_0_1px_rgba(220,38,38,0.2),0_4px_32px_rgba(220,38,38,0.08)] ${participando ? 'bg-emerald-950/10 border-emerald-900/60 hover:border-emerald-500' : 'bg-[#12141d] border-zinc-800 hover:border-red-900/60'}`}
                    >
                      {/* Barra de acento superior */}
                      <div className={`h-0.5 w-full transition-all duration-300 ${participando ? 'bg-emerald-500' : 'bg-transparent group-hover:bg-red-600'}`} />

                      <div className="p-5 flex flex-col h-full relative">
                        {/* Header: número + timer */}
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-black border border-zinc-800 text-zinc-500 tracking-widest">Nº {edital.numero}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 border ${tempo.cor}`}>{tempo.txt}</span>
                        </div>

                        {/* Órgão */}
                        <h3 className={`font-bold text-sm mb-1 line-clamp-2 leading-snug transition-colors ${participando ? 'text-emerald-300 group-hover:text-emerald-200' : 'text-zinc-100 group-hover:text-red-400'}`}>
                          {edital.orgao}
                        </h3>

                        {/* Objeto — descrição do que está sendo comprado */}
                        {edital.objeto ? (
                          <p className="text-zinc-600 text-[10px] font-mono mb-3 line-clamp-2 leading-relaxed italic">
                            {edital.objeto}
                          </p>
                        ) : (
                          <p className="text-zinc-700 text-[10px] font-mono mb-3 tracking-widest">UASG: {edital.uasg || '—'}</p>
                        )}

                        {/* Progresso de cotação — sempre visível */}
                        {prog && (
                          <div className="mb-4">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
                                {pct === 100 ? '✓ Cotação completa' : `${prog.cotados} de ${prog.total} itens cotados`}
                              </span>
                              <span className={`text-[10px] font-bold tabular-nums ${pct === 100 ? 'text-emerald-400' : pct! > 0 ? 'text-red-400' : 'text-zinc-700'}`}>
                                {pct ?? 0}%
                              </span>
                            </div>
                            <div className="w-full h-1 bg-zinc-900 border border-zinc-800/50">
                              <div
                                className={`h-full transition-all duration-700 ${pct === 100 ? 'bg-emerald-500' : 'bg-red-600'}`}
                                style={{ width: `${pct ?? 0}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Tags de alerta */}
                        {edital.tags && edital.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {edital.tags.map((tag: string) => (
                              <span key={tag} className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-red-950/40 border border-red-900/50 text-red-400">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Botão participar + avatares */}
                        <div className="mb-4 flex items-center gap-2">
                          <button
                            onMouseEnter={(e) => { e.stopPropagation(); playHover(); }}
                            onClick={(e) => { e.stopPropagation(); handleParticipar(edital); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-all ${participando
                              ? 'bg-emerald-950/40 border-emerald-700 text-emerald-400 hover:bg-emerald-950/80'
                              : 'bg-black border-zinc-800 text-zinc-500 hover:border-red-600 hover:text-red-400'}`}
                          >
                            <Crosshair size={10} />
                            {participando ? 'Participando' : 'Participar'}
                          </button>
                          {listaParticipantes.length > 0 && (
                            <div className="flex items-center -space-x-1">
                              {listaParticipantes.slice(0, 4).map(p => (
                                <div key={p.user_id} title={`${p.user_nome} está nesta disputa`}>
                                  <Avatar nome={p.user_nome} cor={p.user_cor} avatar_url={p.user_avatar_url ?? null} size="xs" />
                                </div>
                              ))}
                              {listaParticipantes.length > 4 && (
                                <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center text-[9px] text-zinc-400 font-bold">
                                  +{listaParticipantes.length - 4}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Footer: data de abertura */}
                        <div className="mt-auto pt-3 border-t border-zinc-800/40 flex items-center gap-2">
                          <Calendar size={11} className={`shrink-0 ${participando ? 'text-emerald-700' : 'text-zinc-700'}`} />
                          <span className={`font-mono text-[10px] transition-colors ${participando ? 'text-emerald-500' : 'text-zinc-500'}`}>
                            {edital.data_pregao}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // ==========================================
          // VISÃO INTERNA DO EDITAL
          // ==========================================
          <div className="flex flex-col h-full aba-animada">
            <div className="px-8 pt-6 pb-0 bg-[#090a0f] border-b-2 border-red-900/30 z-10 relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <button onMouseEnter={() => playHover()} onClick={() => { playClick(); setEditalAtivo(null); }} className="w-10 h-10 border border-zinc-700 bg-black flex items-center justify-center text-zinc-400 hover:border-red-500 hover:text-red-500 transition-all shadow-[2px_2px_0_0_rgba(39,39,42,1)] hover:shadow-[2px_2px_0_0_rgba(220,38,38,0.5)] active:translate-y-0.5">
                    <ArrowBigLeftDashIcon size={20} strokeWidth={2} />
                  </button>
                  <div>
                    <h1 className="text-2xl font-black uppercase tracking-widest text-zinc-100">Disputa <span className="text-red-600">{editalAtivo.numero}</span></h1>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="w-2 h-2 rounded-none bg-red-600 animate-pulse"></span>
                      <p className="text-zinc-500 text-xs font-mono uppercase truncate max-w-sm">{editalAtivo.orgao}</p>
                      <span className="text-zinc-700">|</span>
                      <p className="text-zinc-500 text-xs font-mono uppercase">UASG: {editalAtivo.uasg || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editalAtivo.link_oficial && (
                    <button onMouseEnter={() => playHover()} onClick={() => open(editalAtivo.link_oficial)} className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 border border-zinc-800 bg-black hover:bg-zinc-900 hover:text-red-400 hover:border-red-500 transition-all active:translate-y-0.5 flex items-center gap-2">
                      <ExternalLink size={14} /> Portal
                    </button>
                  )}
                  <button
                    onMouseEnter={() => playHover()}
                    onClick={() => { playClick(); setDadosVitoria({ valorTotal: lanceTotal, lucroLiquido }); setIsModalVitoriaOpen(true); }}
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-yellow-400 border border-yellow-800/50 bg-yellow-950/20 hover:bg-yellow-950/50 hover:border-yellow-500 transition-all shadow-[2px_2px_0_0_rgba(161,98,7,0.3)] active:translate-y-0.5 flex items-center gap-2"
                  >
                    <Trophy size={14} /> Registrar Vitória
                  </button>
                  <button onMouseEnter={() => playHover()} onClick={handleExcluirEdital} className="px-3 py-2 text-xs font-bold uppercase text-red-500 border border-red-900/50 bg-[#12141d] hover:bg-red-950 hover:border-red-500 transition-all active:translate-y-0.5 flex items-center gap-2">
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>

              <div className="flex space-x-2 w-fit mb-[-2px] relative z-20">
                {['resumo', 'itens', 'documentos', 'obs', 'guerra'].map((aba) => (
                  <button
                    key={aba} onMouseEnter={() => playHover()} onClick={() => { playClick(); setAbaAtiva(aba); }}
                    className={`px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-200 border-t-2 border-l-2 border-r-2 ${abaAtiva === aba ? 'bg-[#0c0d12] text-red-500 border-red-600' : 'bg-black text-zinc-600 border-zinc-800 hover:text-zinc-300 hover:border-zinc-600'}`}
                  >
                    {aba}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8 overflow-y-auto bg-[#0c0d12] flex-1 border-t-2 border-zinc-800">
              {/* ---- ABA RESUMO ---- */}
              {abaAtiva === 'resumo' && (
                <div className="space-y-6 aba-animada">
                  <div className="bg-[#12141d] p-6 border border-zinc-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-3xl"></div>
                    <div className="flex justify-between items-end mb-4 relative z-10">
                      <div>
                        <h3 className="font-bold text-zinc-200 uppercase tracking-widest text-sm">Progresso de Cotação</h3>
                        <p className="text-xs text-zinc-500 mt-1">{itensCotados.length} de {totalItens} itens cotados</p>
                      </div>
                      <span className="text-3xl font-black font-mono text-red-500">{progressoCotacao}%</span>
                    </div>
                    <div className="w-full bg-black border border-zinc-800 h-2 relative z-10">
                      <div className="bg-red-600 h-full transition-all duration-1000 shadow-[0_0_10px_rgba(220,38,38,0.8)]" style={{ width: `${progressoCotacao}%` }}></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#12141d] p-6 border border-zinc-800 card-premium">
                      <span className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Teto do Governo</span>
                      <span className="text-2xl font-black font-mono text-zinc-200">R$ {totalGoverno.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="bg-[#12141d] p-6 border border-zinc-800 card-premium">
                      <span className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Custo dos Fornecedores</span>
                      <span className="text-2xl font-black font-mono text-amber-500">R$ {custoOperacional.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="bg-emerald-950/20 p-6 border border-emerald-900/50 card-premium relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent"></div>
                      <span className="text-xs font-bold text-emerald-600 uppercase mb-2 block relative z-10">Lucro Líquido Projetado</span>
                      <span className="text-3xl font-black font-mono text-emerald-400 relative z-10">R$ {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {itensCotados.some(i => i.lance_minimo > i.preco_alvo) && (
                    <div className="bg-red-600 border border-red-500 p-5 flex items-start gap-4 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                      <AlertTriangle className="text-red-50 shrink-0" size={28} strokeWidth={2} />
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-widest text-white">Lance acima do teto do governo</h4>
                        <p className="text-sm text-red-100 mt-1">Um ou mais itens estão com lance mínimo acima do valor permitido. Ajuste o preço ou desative esses itens.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ---- ABA ITENS ---- */}
              {abaAtiva === 'itens' && (
                <div className="bg-[#12141d] border border-zinc-800 aba-animada">
                  {/* Barra de controles */}
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-3 bg-black/50">
                    <div className="flex items-center gap-2 flex-1">
                      <Search size={14} className="text-zinc-600 shrink-0" />
                      <input
                        type="text"
                        value={buscaItens}
                        onChange={e => setBuscaItens(e.target.value)}
                        placeholder="Filtrar itens por descrição ou fornecedor..."
                        className="flex-1 bg-transparent border-none text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none"
                      />
                      {buscaItens && (
                        <button onClick={() => setBuscaItens('')} className="text-zinc-600 hover:text-red-400 transition-colors">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-zinc-600 font-mono">
                        {buscaItens ? `${itensFiltrados.length}/${itens.length}` : itens.length} itens
                      </span>
                      <button
                        onMouseEnter={() => playHover()}
                        onClick={exportarCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase border border-zinc-700 bg-black text-zinc-500 hover:border-emerald-600 hover:text-emerald-400 transition-all"
                        title="Exportar cotações como CSV"
                      >
                        <Download size={13} /> CSV
                      </button>
                    </div>
                  </div>

                  {itens.length === 0 ? (
                    <div className="p-12 text-center text-zinc-600 font-mono text-sm uppercase">Carregando itens...</div>
                  ) : itensFiltrados.length === 0 ? (
                    <div className="p-12 text-center text-zinc-600 font-mono text-sm">Nenhum item corresponde ao filtro.</div>
                  ) : (
                    <table className="w-full text-left text-sm text-zinc-400">
                      <thead className="bg-[#090a0f] text-xs uppercase tracking-wide text-zinc-500 border-b-2 border-red-900/30">
                        <tr>
                          <th className="px-6 py-3 font-bold w-2/5">Descrição do Item</th>
                          <th className="px-6 py-3 font-bold">Qtd.</th>
                          <th className="px-6 py-3 font-bold">Teto Gov.</th>
                          <th className="px-6 py-3 font-bold">Fornecedor</th>
                          <th className="px-6 py-3 font-bold text-right">Lance Mínimo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50 font-mono">
                        {itensFiltrados.map((item) => {
                          const isIgnorado = item.ignorado === 1;
                          const temCotacao = item.melhor_cotacao > 0 && !isIgnorado;
                          const lucroOk = temCotacao && item.lance_minimo <= item.preco_alvo;
                          const locked = itensLocked[item.id];
                          const isLockedByOther = !!locked;

                          return (
                            <tr
                              key={item.id}
                              onMouseEnter={() => playHover()}
                              onClick={() => { if (!isLockedByOther) abrirModalCotacao(item); }}
                              className={`group transition-colors ${isIgnorado ? 'opacity-30 grayscale cursor-default' : isLockedByOther ? 'cursor-not-allowed bg-zinc-900/30' : 'hover:bg-zinc-900/80 cursor-pointer'}`}
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <button onClick={(e) => abrirModalPdf(e, item)} className="p-2 bg-black border border-zinc-700 text-zinc-500 group-hover:text-red-500 group-hover:border-red-500 transition-colors shrink-0">
                                    <FileText size={16} strokeWidth={2} />
                                  </button>
                                  <span className="font-sans font-bold text-zinc-300 line-clamp-2 uppercase group-hover:text-red-100" title={item.nome}>
                                    {isIgnorado ? '[IGNORADO] ' : ''}{item.nome}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">{item.quantidade}x</td>
                              <td className="px-6 py-4 text-zinc-500">R$ {item.preco_alvo?.toFixed(2)}</td>
                              <td className="px-6 py-4">
                                {isLockedByOther ? (
                                  <span className="flex items-center gap-1.5 text-[10px] px-2 py-1 uppercase font-bold border border-amber-900/40 bg-amber-950/20 text-amber-500">
                                    <Lock size={10} /> {locked.nome} editando...
                                  </span>
                                ) : isIgnorado ? (
                                  <span className="text-[9px] px-2 py-1 uppercase font-bold bg-zinc-900 border border-zinc-800 text-zinc-600">INATIVO</span>
                                ) : item.link ? (
                                  <a href={item.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-red-500 hover:text-red-400 font-bold uppercase text-[10px] border-b border-red-900/50">
                                    {item.fornecedor} ↗
                                  </a>
                                ) : (
                                  <span className={`text-[9px] px-2 py-1 uppercase font-bold border ${temCotacao ? 'bg-zinc-900 border-zinc-700 text-zinc-400' : 'bg-amber-950/30 text-amber-500 border-amber-900/50'}`}>
                                    {item.fornecedor || 'Pendente'}
                                  </span>
                                )}
                              </td>
                              <td className={`px-6 py-4 text-right font-bold ${isIgnorado ? 'text-zinc-600' : !temCotacao ? 'text-zinc-600' : lucroOk ? 'text-emerald-400' : 'text-red-500'}`}>
                                <div className="flex items-center justify-end gap-2">
                                  {item.cotado_por_nome && (
                                    <Avatar nome={item.cotado_por_nome} cor={item.cotado_por_cor} avatar_url={null} size="xs"
                                      title={`Cotado por ${item.cotado_por_nome}`} />
                                  )}
                                  <div>
                                    {temCotacao ? `R$ ${item.lance_minimo?.toFixed(2)}` : '--'}
                                    {lucroOk && <span className="text-[9px] block text-emerald-600 uppercase tracking-widest mt-1">Margem OK</span>}
                                    {temCotacao && !lucroOk && <span className="text-[9px] block text-red-600 uppercase tracking-widest mt-1">OVERFLOW</span>}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ---- ABA DOCUMENTOS ---- */}
              {abaAtiva === 'documentos' && (
                <div className="bg-[#12141d] border border-zinc-800 aba-animada">
                  <div className="p-4 border-b border-zinc-800 bg-black/50">
                    <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-300">Documentos do Edital</h3>
                  </div>
                  {documentos.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center border-dashed border-2 border-zinc-800 m-4">
                      <p className="text-zinc-500 font-mono text-sm uppercase mb-1">Nenhum anexo encontrado para este edital.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-zinc-800/50 font-mono">
                      {documentos.map((doc) => (
                        <li key={doc.id} className="p-4 hover:bg-zinc-900/50 transition-colors flex justify-between items-center group cursor-default">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-black border border-zinc-700 text-zinc-500 group-hover:text-red-500 group-hover:border-red-500 transition-colors">
                              <FileText size={18} strokeWidth={2} />
                            </div>
                            <span className="font-bold text-xs text-zinc-300 uppercase">{doc.titulo}</span>
                          </div>
                          <button onMouseEnter={() => playHover()} onClick={() => { playClick(); setDocVisualizacao(doc.link); }} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-red-400 border border-red-900/30 bg-[#090a0f] hover:bg-red-950/40 hover:border-red-500 transition-all shadow-[2px_2px_0_0_rgba(127,29,29,0.2)] active:translate-y-0.5 flex items-center gap-2">
                            <Eye size={14} /> Visualizar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ---- ABA OBSERVAÇÕES ---- */}
              {abaAtiva === 'obs' && (
                <div className="bg-[#12141d] border border-zinc-800 aba-animada p-6 space-y-6">
                  {/* Tags rápidas */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Alertas Rápidos</p>
                    <div className="flex flex-wrap gap-2">
                      {TAGS_DISPONIVEIS.map(tag => (
                        <button
                          key={tag}
                          onMouseEnter={() => playHover()}
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                            obsTags.includes(tag)
                              ? 'bg-red-600 border-red-500 text-white'
                              : 'bg-black border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Textarea de observações */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Observações Livres</p>
                    <textarea
                      value={obsTexto}
                      onChange={e => setObsTexto(e.target.value)}
                      placeholder="Anote exigências, alertas, detalhes do edital..."
                      rows={8}
                      className="w-full bg-black border border-zinc-800 text-zinc-300 text-sm font-mono p-4 resize-none focus:outline-none focus:border-red-600 placeholder:text-zinc-700"
                    />
                  </div>

                  <button
                    onMouseEnter={() => playHover()}
                    onClick={handleSalvarObs}
                    disabled={obsSalvando}
                    className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white border border-red-500 transition-all disabled:opacity-50"
                  >
                    {obsSalvando ? 'Salvando...' : 'Salvar Observações'}
                  </button>
                </div>
              )}

              {/* ---- ABA SALA DE GUERRA ---- */}
              {abaAtiva === 'guerra' && (() => {
                const itensAtivos = itens.filter(i => i.ignorado !== 1 && i.lance_minimo > 0);

                function registrarLance(item: any) {
                  const concorrenteStr = lanceConcorrente[item.id] || '';
                  const concorrente = parseFloat(concorrenteStr.replace(',', '.'));
                  if (isNaN(concorrente) || concorrente <= 0) return;

                  const meuMinimo = item.lance_minimo;
                  const ideal = concorrente - 0.01;
                  let status: 'vantagem' | 'limite' | 'prejuizo';

                  if (concorrente < meuMinimo) {
                    status = 'prejuizo';
                    playAlert();
                  } else if (ideal <= meuMinimo) {
                    status = 'limite';
                    playAlert();
                  } else {
                    status = 'vantagem';
                    playSuccess();
                  }

                  const agora = new Date();
                  const ts = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  setHistoricoLances(prev => [{ itemNome: item.nome.slice(0, 50), concorrente, ideal: status === 'prejuizo' ? null : ideal, status, ts }, ...prev].slice(0, 50));
                }

                return (
                  <div className="aba-animada space-y-4">
                    {/* Header da sessão */}
                    <div className="bg-black border border-red-900/40 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-widest text-red-400">Sala de Guerra — Sessão Ativa</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        Início: {sessaoInicio.toLocaleTimeString('pt-BR')}
                      </span>
                    </div>

                    {itensAtivos.length === 0 ? (
                      <div className="bg-[#12141d] border border-zinc-800 p-12 text-center">
                        <p className="text-zinc-500 text-sm font-mono uppercase">Cote os itens primeiro para ativar a Sala de Guerra.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Tabela de batalha */}
                        <div className="bg-[#12141d] border border-zinc-800 overflow-hidden">
                          <div className="grid grid-cols-[1fr_120px_120px_140px_120px] text-[9px] font-bold uppercase tracking-widest text-zinc-600 border-b border-zinc-800 bg-black/60">
                            <div className="px-4 py-3">Item</div>
                            <div className="px-4 py-3 text-right">Teto Gov.</div>
                            <div className="px-4 py-3 text-right">Meu Mínimo</div>
                            <div className="px-4 py-3 text-center">Lance Concorrente</div>
                            <div className="px-4 py-3 text-right">Meu Lance Ideal</div>
                          </div>
                          {itensAtivos.map(item => {
                            const concorrenteStr = lanceConcorrente[item.id] || '';
                            const concorrente = parseFloat(concorrenteStr.replace(',', '.'));
                            const meuMinimo = item.lance_minimo;
                            const temConcorrente = !isNaN(concorrente) && concorrente > 0;
                            const ideal = temConcorrente ? concorrente - 0.01 : null;
                            const isPrejuizo = temConcorrente && concorrente < meuMinimo;
                            const isLimite = temConcorrente && ideal !== null && ideal <= meuMinimo && !isPrejuizo;
                            const isVantagem = temConcorrente && !isPrejuizo && !isLimite;

                            return (
                              <div key={item.id} className={`grid grid-cols-[1fr_120px_120px_140px_120px] border-b border-zinc-800/50 transition-colors ${isPrejuizo ? 'bg-red-950/20' : ''}`}>
                                <div className="px-4 py-3 text-xs text-zinc-300 font-mono line-clamp-2 self-center">{item.nome}</div>
                                <div className="px-4 py-3 text-right text-xs font-mono text-zinc-500 self-center">R$ {item.preco_alvo?.toFixed(2)}</div>
                                <div className="px-4 py-3 text-right text-xs font-mono text-zinc-400 self-center font-bold">R$ {meuMinimo?.toFixed(2)}</div>
                                <div className="px-4 py-3 flex items-center gap-2 justify-center self-center">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                    value={concorrenteStr}
                                    onChange={e => setLanceConcorrente(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') { playClick(); registrarLance(item); } }}
                                    className={`w-24 text-center text-xs font-mono font-bold bg-black border px-2 py-1.5 focus:outline-none transition-colors ${isPrejuizo ? 'border-red-500 text-red-400' : isLimite ? 'border-amber-600 text-amber-400' : 'border-zinc-700 text-zinc-200 focus:border-red-600'}`}
                                  />
                                  <button
                                    onMouseEnter={() => playHover()}
                                    onClick={() => { playClick(); registrarLance(item); }}
                                    className="text-[9px] font-bold uppercase px-2 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:border-red-600 hover:text-red-400 transition-all"
                                  >
                                    LOG
                                  </button>
                                </div>
                                <div className="px-4 py-3 text-right self-center">
                                  {!temConcorrente ? (
                                    <span className="text-zinc-700 text-xs font-mono">—</span>
                                  ) : isPrejuizo ? (
                                    <div>
                                      <span className="text-[9px] font-bold uppercase tracking-widest text-red-500 block">⚠ PREJUÍZO</span>
                                      <span className="text-[9px] text-red-700 font-mono">abaixo do custo</span>
                                    </div>
                                  ) : isLimite ? (
                                    <div>
                                      <span className="text-xs font-bold font-mono text-amber-400 block">R$ {meuMinimo.toFixed(2)}</span>
                                      <span className="text-[9px] uppercase tracking-widest text-amber-600">no limite</span>
                                    </div>
                                  ) : (
                                    <div>
                                      <span className="text-xs font-bold font-mono text-emerald-400 block">R$ {ideal!.toFixed(2)}</span>
                                      <span className="text-[9px] uppercase tracking-widest text-emerald-700">vantagem</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Histórico de lances */}
                        {historicoLances.length > 0 && (
                          <div className="bg-[#12141d] border border-zinc-800">
                            <div className="px-4 py-3 border-b border-zinc-800 bg-black/60 flex items-center justify-between">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Log da Sessão</span>
                              <button onMouseEnter={() => playHover()} onClick={() => { playClick(); setHistoricoLances([]); }} className="text-[9px] uppercase text-zinc-700 hover:text-red-500 transition-colors">Limpar</button>
                            </div>
                            <div className="divide-y divide-zinc-900 max-h-48 overflow-y-auto">
                              {historicoLances.map((log, i) => (
                                <div key={i} className="px-4 py-2 flex items-center gap-4 font-mono text-[10px]">
                                  <span className="text-zinc-600 shrink-0">{log.ts}</span>
                                  <span className="text-zinc-400 flex-1 truncate">{log.itemNome}</span>
                                  <span className="text-zinc-500 shrink-0">concorr: <span className="text-zinc-300">R$ {log.concorrente.toFixed(2)}</span></span>
                                  {log.status === 'prejuizo' ? (
                                    <span className="text-red-500 font-bold shrink-0">PREJUÍZO</span>
                                  ) : (
                                    <span className={`shrink-0 font-bold ${log.status === 'vantagem' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                      ideal: R$ {log.ideal?.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      {/* ========================================= */}
      {/* MODAL COTAÇÃO (com autocomplete)           */}
      {/* ========================================= */}
      {isModalCotacaoOpen && itemSelecionado && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center overlay-glass">
          <div className="bg-[#090a0f] w-full max-w-lg border-2 border-red-600 shadow-[8px_8px_0_0_rgba(220,38,38,0.2)]">
            <div className="px-6 py-4 border-b-2 border-red-900/30 bg-[#12141d] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-100 line-clamp-1">{itemSelecionado.nome}</h3>
                <p className="text-[10px] font-mono text-red-500 mt-0.5">TETO DO GOVERNO: R$ {itemSelecionado.preco_alvo?.toFixed(2)}</p>
              </div>
              <button onClick={fecharModalCotacao} className="text-zinc-600 hover:text-red-500 ml-4 shrink-0"><X size={18} /></button>
            </div>

            <form onSubmit={handleSalvarCotacao} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                {/* Fornecedor com autocomplete */}
                <div className="col-span-2" ref={fornecedorRef}>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Fornecedor</label>
                  <div className="relative">
                    <input
                      disabled={dadosCotacao.ignorado === 1}
                      required
                      type="text"
                      value={dadosCotacao.fornecedor}
                      onChange={(e) => {
                        setDadosCotacao({ ...dadosCotacao, fornecedor: e.target.value });
                        buscarSugestoesFornecedor(e.target.value);
                      }}
                      onFocus={() => dadosCotacao.fornecedor.length >= 2 && buscarSugestoesFornecedor(dadosCotacao.fornecedor)}
                      placeholder="Nome do fornecedor..."
                      className="w-full px-3 py-2 bg-black border border-zinc-800 text-zinc-200 text-sm focus:outline-none disabled:opacity-30"
                    />
                    {mostrarSugestoes && sugestoesFornecedor.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-[#090a0f] border border-zinc-700 border-t-0 shadow-xl">
                        {sugestoesFornecedor.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => aplicarSugestao(s)}
                            className="w-full px-4 py-2.5 text-left hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-zinc-200 font-bold truncate">{s.fornecedor}</span>
                              <span className="text-xs text-emerald-400 font-mono ml-2 shrink-0">R$ {s.preco?.toFixed(2)}</span>
                            </div>
                            {s.link && <span className="text-[10px] text-zinc-600 font-mono truncate block">{s.link}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Custo Unitário (R$)</label>
                  <input disabled={dadosCotacao.ignorado === 1} required type="number" step="0.01" min="0" value={dadosCotacao.preco || ''} onChange={(e) => setDadosCotacao({ ...dadosCotacao, preco: Number(e.target.value) })} className="w-full px-3 py-2 bg-black border border-zinc-800 text-zinc-200 font-bold text-sm focus:outline-none disabled:opacity-30" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Frete (R$)</label>
                    <label className="flex items-center text-[9px] text-zinc-400 font-mono cursor-pointer uppercase">
                      <input disabled={dadosCotacao.ignorado === 1} type="checkbox" checked={dadosCotacao.freteGratis} onChange={(e) => setDadosCotacao({ ...dadosCotacao, freteGratis: e.target.checked, frete: 0 })} className="mr-1.5 accent-red-600" />
                      Grátis
                    </label>
                  </div>
                  <input disabled={dadosCotacao.freteGratis || dadosCotacao.ignorado === 1} type="number" step="0.01" min="0" value={dadosCotacao.frete || ''} onChange={(e) => setDadosCotacao({ ...dadosCotacao, frete: Number(e.target.value) })} className="w-full px-3 py-2 bg-black border border-zinc-800 text-zinc-200 text-sm focus:outline-none disabled:opacity-30 disabled:bg-zinc-900" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Margem (%)</label>
                  <input disabled={dadosCotacao.ignorado === 1} required type="number" min="0" value={dadosCotacao.margem} onChange={(e) => setDadosCotacao({ ...dadosCotacao, margem: Number(e.target.value) })} className="w-full px-3 py-2 bg-black border border-zinc-800 text-emerald-400 font-bold text-sm focus:outline-none disabled:opacity-30" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">URL de Referência</label>
                  <input disabled={dadosCotacao.ignorado === 1} type="url" value={dadosCotacao.link} onChange={(e) => setDadosCotacao({ ...dadosCotacao, link: e.target.value })} className="w-full px-3 py-2 bg-black border border-zinc-800 text-zinc-200 text-sm focus:outline-none disabled:opacity-30" />
                </div>
              </div>

              <div className={`p-4 border-l-4 font-mono ${dadosCotacao.ignorado === 1 ? 'bg-zinc-900 border-zinc-700' : lanceMinimoCalculado <= itemSelecionado.preco_alvo ? 'bg-emerald-950/20 border-emerald-500' : 'bg-red-950/30 border-red-600'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Lance de Venda:</span>
                  <span className={`text-xl font-black ${dadosCotacao.ignorado === 1 ? 'text-zinc-600' : lanceMinimoCalculado <= itemSelecionado.preco_alvo ? 'text-emerald-400' : 'text-red-500'}`}>
                    {dadosCotacao.ignorado === 1 ? '--' : `R$ ${lanceMinimoCalculado.toFixed(2)}`}
                  </span>
                </div>
                {lanceMinimoCalculado > itemSelecionado.preco_alvo && dadosCotacao.ignorado === 0 && (
                  <p className="text-[9px] text-red-500 uppercase mt-1.5">Aviso: lance acima do teto do governo.</p>
                )}
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-zinc-800">
                <div className="flex gap-2">
                  <button type="button" onMouseEnter={() => playHover()} onClick={handleLimparCotacao} className="p-2 text-zinc-500 hover:text-amber-500 border border-zinc-800 bg-black transition-all" title="Limpar cotação">
                    <Eraser size={14} />
                  </button>
                  <button type="button" onMouseEnter={() => playHover()} onClick={handleIgnorarItem} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center gap-2 ${dadosCotacao.ignorado === 1 ? 'bg-zinc-800 text-zinc-300 border-zinc-600' : 'bg-black text-zinc-500 border-zinc-800 hover:text-zinc-300'}`}>
                    <Ban size={14} /> {dadosCotacao.ignorado === 1 ? 'Desativado' : 'Desativar'}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button type="button" onMouseEnter={() => playHover()} onClick={fecharModalCotacao} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors">Cancelar</button>
                  <button type="submit" disabled={dadosCotacao.ignorado === 1} onMouseEnter={() => playHover()} className="px-6 py-2 bg-red-600 text-white font-bold text-xs uppercase tracking-widest shadow-[4px_4px_0_0_rgba(220,38,38,0.3)] hover:shadow-[6px_6px_0_0_rgba(220,38,38,0.5)] hover:-translate-y-1 active:translate-y-0.5 transition-all disabled:opacity-30">Salvar Cotação</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* MODAL ROBÔ EXTRATOR                        */}
      {/* ========================================= */}
      {isModalRoboOpen && (
        <div className="absolute inset-0 z-[300] flex items-center justify-center overlay-glass">
          <div className="bg-[#090a0f] w-full max-w-md border-2 border-red-600 shadow-[8px_8px_0_0_rgba(220,38,38,0.3)] overflow-hidden">
            <div className="px-6 py-4 border-b-2 border-red-900 bg-[#dc2626] fundo-listras relative flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest text-white relative z-10 flex items-center gap-2">
                <Bot size={18} strokeWidth={2.5} /> Extrator PNCP
              </h3>
              {statusRobo === 'idle' && <button onClick={() => { playClick(); setIsModalRoboOpen(false); }} className="text-red-200 hover:text-white relative z-10"><X size={18} strokeWidth={3} /></button>}
            </div>
            <div className="p-6">
              {statusRobo === 'idle' ? (
                <form onSubmit={handleAcionarRobo} className="space-y-6">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Cole o link do edital no portal PNCP para importar todos os itens automaticamente.</p>
                  <input required type="url" value={linkRobo} onChange={(e) => setLinkRobo(e.target.value)} placeholder="https://pncp.gov.br/app/editais/..." className="w-full px-4 py-3 bg-black border border-zinc-700 text-red-500 font-mono text-sm focus:outline-none focus:border-red-500" />
                  <button type="submit" onMouseEnter={() => playHover()} className="w-full py-3 bg-red-600 text-white font-bold text-xs uppercase tracking-widest hover:shadow-[6px_6px_0_0_rgba(220,38,38,0.5)] active:translate-y-0.5 transition-all">Importar Edital</button>
                </form>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 space-y-5 w-full font-mono">
                  {statusRobo === 'scraping' ? (
                    <div className="w-12 h-12 border-4 border-zinc-800 border-t-red-600 rounded-none animate-spin"></div>
                  ) : (
                    <CheckCircle2 size={40} className="text-emerald-500" />
                  )}
                  <p className="text-xs font-bold text-red-500 uppercase tracking-widest animate-pulse text-center px-4">{mensagemRobo}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* MODAL GERADOR DE PDF                       */}
      {/* ========================================= */}
      {isModalPdfOpen && itemPdf && (() => {
        const valorTotal = dadosPdf.quantidade * dadosPdf.valorUnitario;
        const valorExt = valorPorExtenso(dadosPdf.valorUnitario);
        const hoje = new Date();
        const dataFormatada = `${empresaCfg?.cidade || ''}-${empresaCfg?.uf || ''}, ${hoje.getDate()} de ${hoje.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase()} de ${hoje.getFullYear()}.`;
        const emp = empresaCfg;
        const numEdital = editalAtivo?.numero || '';
        const dispNum = numEdital.includes('/') ? numEdital : numEdital;

        const CabecalhoPdf = () => (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', paddingBottom: '16px', marginBottom: '24px', borderBottom: '1px solid #999' }}>
            {emp?.logo_base64
              ? <img src={emp.logo_base64} alt="Logo" style={{ height: '64px', objectFit: 'contain' }} />
              : <div style={{ width: '64px', height: '64px', background: '#eee', border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#999', textAlign: 'center' }}>LOGO</div>
            }
            <div style={{ fontSize: '11px', lineHeight: '1.7', fontWeight: 'bold' }}>
              {(emp?.nome_fantasia || emp?.razao_social) && (
                <p style={{ fontSize: '13px', marginBottom: '2px' }}>{emp?.nome_fantasia || emp?.razao_social}</p>
              )}
              <p>{emp?.endereco || '[ENDEREÇO]'}{emp?.bairro ? ', ' + emp.bairro : ''}</p>
              {emp?.cep && <p>CEP: {emp.cep}</p>}
              <p>{emp?.cidade || '[CIDADE]'}{emp?.uf ? '- UF: ' + emp.uf : ''}</p>
              {emp?.telefone && <p>TEL: {emp.telefone}</p>}
              {emp?.celular && <p>CEL: {emp.celular}</p>}
              {emp?.email && <p>Email: {emp.email}</p>}
              {emp?.cnpj && <p>CNPJ: {emp.cnpj}</p>}
            </div>
          </div>
        );

        return (
          <div className="absolute inset-0 z-[250] flex items-center justify-center overlay-glass p-4 overflow-y-auto">
            <div className="w-full max-w-6xl rounded-none shadow-2xl flex flex-col md:flex-row overflow-hidden border-2 border-red-600 relative my-auto" style={{ background: 'var(--c-elevated)' }}>
              <button onClick={() => { playClick(); setIsModalPdfOpen(false); }} className="absolute top-4 right-4 text-zinc-500 hover:text-red-500 border border-zinc-700 p-2 z-10 no-print" style={{ background: 'var(--c-surface)' }}><X size={18} /></button>

              {/* ── PAINEL DE CONTROLE (não imprime) ── */}
              <div className="w-full md:w-72 shrink-0 border-r no-print flex flex-col max-h-[90vh] overflow-y-auto" style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--c-border)' }}>
                  <h3 className="font-black text-sm uppercase tracking-widest" style={{ color: 'var(--c-text-1)' }}>Proposta PDF</h3>
                  <p className="text-[10px] font-mono mt-1 uppercase" style={{ color: 'var(--c-text-2)' }}>
                    {emp ? `Empresa: ${emp.razao_social}` : '⚠ Configure a empresa no Perfil antes de gerar'}
                  </p>
                </div>

                <div className="p-4 space-y-4 flex-1">
                  {/* Identificação */}
                  <div className="p-3 space-y-3 rounded" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest border-b pb-2" style={{ borderColor: 'var(--c-border)' }}>Produto</p>
                    <div>
                      <label className="block text-[9px] font-bold uppercase mb-1" style={{ color: 'var(--c-text-2)' }}>Marca</label>
                      <input type="text" value={dadosPdf.marca} onChange={e => setDadosPdf({ ...dadosPdf, marca: e.target.value })} className="w-full px-2 py-1.5 border text-xs focus:outline-none" style={{ background: 'var(--c-input-bg)', color: 'var(--c-input-text)', borderColor: 'var(--c-border-md)' }} />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase mb-1" style={{ color: 'var(--c-text-2)' }}>Modelo</label>
                      <input type="text" value={dadosPdf.modelo} onChange={e => setDadosPdf({ ...dadosPdf, modelo: e.target.value })} className="w-full px-2 py-1.5 border text-xs focus:outline-none" style={{ background: 'var(--c-input-bg)', color: 'var(--c-input-text)', borderColor: 'var(--c-border-md)' }} />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase mb-1" style={{ color: 'var(--c-text-2)' }}>Foto do produto</label>
                      <input type="file" accept="image/*" onChange={handleUploadFoto} className="w-full text-[10px] cursor-pointer" style={{ color: 'var(--c-text-2)' }} />
                    </div>
                  </div>

                  {/* Valores */}
                  <div className="p-3 space-y-3 rounded" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest border-b pb-2" style={{ borderColor: 'var(--c-border)' }}>Valores</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold uppercase mb-1" style={{ color: 'var(--c-text-2)' }}>Qtd.</label>
                        <input type="number" min="1" value={dadosPdf.quantidade} onChange={e => setDadosPdf({ ...dadosPdf, quantidade: Number(e.target.value) })} className="w-full px-2 py-1.5 border text-xs focus:outline-none" style={{ background: 'var(--c-input-bg)', color: 'var(--c-input-text)', borderColor: 'var(--c-border-md)' }} />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase mb-1" style={{ color: 'var(--c-text-2)' }}>Valor Unit. (R$)</label>
                        <input type="number" step="0.01" min="0" value={dadosPdf.valorUnitario} onChange={e => setDadosPdf({ ...dadosPdf, valorUnitario: Number(e.target.value) })} className="w-full px-2 py-1.5 border text-xs focus:outline-none font-bold text-emerald-400" style={{ background: 'var(--c-input-bg)', borderColor: 'var(--c-border-md)' }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold uppercase mb-1" style={{ color: 'var(--c-text-2)' }}>Prazo entrega (dias)</label>
                        <input type="text" value={dadosPdf.prazoEntrega} onChange={e => setDadosPdf({ ...dadosPdf, prazoEntrega: e.target.value })} className="w-full px-2 py-1.5 border text-xs focus:outline-none" style={{ background: 'var(--c-input-bg)', color: 'var(--c-input-text)', borderColor: 'var(--c-border-md)' }} />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase mb-1" style={{ color: 'var(--c-text-2)' }}>Validade proposta (dias)</label>
                        <input type="text" value={dadosPdf.validadeProposta} onChange={e => setDadosPdf({ ...dadosPdf, validadeProposta: e.target.value })} className="w-full px-2 py-1.5 border text-xs focus:outline-none" style={{ background: 'var(--c-input-bg)', color: 'var(--c-input-text)', borderColor: 'var(--c-border-md)' }} />
                      </div>
                    </div>
                  </div>

                  {/* Descrição */}
                  <div className="p-3 space-y-2 rounded" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest border-b pb-2" style={{ borderColor: 'var(--c-border)' }}>Descrição Técnica</p>
                    <textarea rows={6} value={dadosPdf.descricao} onChange={e => setDadosPdf({ ...dadosPdf, descricao: e.target.value })} className="w-full px-2 py-1.5 border text-xs focus:outline-none resize-none font-mono" style={{ background: 'var(--c-input-bg)', color: 'var(--c-input-text)', borderColor: 'var(--c-border-md)' }} />
                  </div>
                </div>

                <div className="p-4 border-t" style={{ borderColor: 'var(--c-border)' }}>
                  <button
                    onClick={() => {
                      playSuccess();
                      const p1 = document.getElementById('pdf-p1');
                      const p2 = document.getElementById('pdf-p2');
                      const p3 = document.getElementById('pdf-p3');
                      if (!p1 || !p2 || !p3) return;

                      const htmlContent = gerarHtmlParaImprimir(p1, p2, p3);

                      // IFRAME OCULTO — abordagem mais confiável no Tauri/WebView2:
                      // window.open() pode ser bloqueado silenciosamente (retorna null).
                      // iframe.contentWindow.print() imprime o iframe, não a janela pai.
                      const iframe = document.createElement('iframe');
                      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;visibility:hidden;';
                      document.body.appendChild(iframe);

                      const doc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
                      if (!doc) { document.body.removeChild(iframe); return; }

                      doc.open();
                      doc.write(htmlContent);
                      doc.close();

                      // Aguarda imagens/fontes antes de abrir o diálogo de impressão
                      setTimeout(() => {
                        iframe.contentWindow?.print();
                        setTimeout(() => {
                          if (document.body.contains(iframe)) document.body.removeChild(iframe);
                        }, 3000);
                      }, 800);
                    }}
                    onMouseEnter={() => playHover()}
                    className="w-full py-3 bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:-translate-y-0.5 active:translate-y-0.5 transition-all flex justify-center gap-2 items-center shadow-[0_4px_12px_rgba(220,38,38,0.4)]"
                  >
                    <Printer size={15} /> Gerar / Imprimir PDF
                  </button>
                </div>
              </div>

              {/* ── PREVIEW A4 — 3 folhas separadas ── */}
              <div className="flex-1 p-6 flex flex-col items-center gap-6 overflow-y-auto max-h-[90vh]" style={{ background: '#d1d5db' }}>

                {/* ─── PÁGINA 1 ─── */}
                <div id="pdf-p1" style={{ background: 'white', color: 'black', padding: '20mm 18mm', width: '210mm', minHeight: '297mm', fontFamily: 'Arial, sans-serif', fontSize: '11px', lineHeight: '1.6', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                  <CabecalhoPdf />

                  <div style={{ textAlign: 'center', padding: '6px 0', background: '#e5e7eb', marginBottom: '16px', fontWeight: 'bold', fontSize: '13px', letterSpacing: '1px' }}>
                    PROPOSTA DE PREÇOS
                  </div>

                  <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    UASG {editalAtivo?.uasg} - {editalAtivo?.orgao?.toUpperCase()}
                  </p>
                  <p style={{ fontWeight: 'bold', marginBottom: '20px' }}>
                    DISPENSA ELETRÔNICA &nbsp;&nbsp; {dispNum}
                  </p>

                  <p style={{ marginBottom: '8px' }}>Senhor Pregoeiro,</p>
                  <p style={{ marginBottom: '20px', textAlign: 'justify' }}>
                    Seguindo os ditames da Dispensa Eletrônica apresento a V.Sa. a nossa proposta de preços para o item 1 da dispensa {dispNum}, conforme a seguir relacionados.
                  </p>

                  {/* Tabela de preços */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                        <th style={{ border: '1px solid #374151', padding: '8px 6px', textAlign: 'center', width: '6%' }}>Item</th>
                        <th style={{ border: '1px solid #374151', padding: '8px 6px', textAlign: 'center' }}>Especificação</th>
                        <th style={{ border: '1px solid #374151', padding: '8px 6px', textAlign: 'center', width: '8%' }}>Und.</th>
                        <th style={{ border: '1px solid #374151', padding: '8px 6px', textAlign: 'center', width: '14%' }}>Preço Unitário R$</th>
                        <th style={{ border: '1px solid #374151', padding: '8px 6px', textAlign: 'center', width: '14%' }}>Preço Global R$</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #374151', padding: '8px 6px', textAlign: 'center', verticalAlign: 'top' }}>1</td>
                        <td style={{ border: '1px solid #374151', padding: '8px 6px', fontWeight: 'bold', verticalAlign: 'top' }}>
                          {itemPdf.nome?.toUpperCase()}
                          {dadosPdf.marca && <div style={{ fontWeight: 'normal', marginTop: '4px' }}>Marca: {dadosPdf.marca} {dadosPdf.modelo ? '| Modelo: ' + dadosPdf.modelo : ''}</div>}
                        </td>
                        <td style={{ border: '1px solid #374151', padding: '8px 6px', textAlign: 'center', verticalAlign: 'top' }}>{dadosPdf.quantidade}</td>
                        <td style={{ border: '1px solid #374151', padding: '8px 6px', textAlign: 'center', verticalAlign: 'top' }}>{dadosPdf.valorUnitario.toFixed(2)}</td>
                        <td style={{ border: '1px solid #374151', padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top' }}>{valorTotal.toFixed(2)}</td>
                      </tr>
                      <tr style={{ background: '#f3f4f6' }}>
                        <td colSpan={4} style={{ border: '1px solid #374151', padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>TOTAL MÁXIMO ESTIMADO R$</td>
                        <td style={{ border: '1px solid #374151', padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>{valorTotal.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                    {/* ── PRODUTO: marca, modelo, foto, descrição ── */}
                    {(dadosPdf.marca || dadosPdf.modelo || dadosPdf.imagem || dadosPdf.descricao) && (
                      <div style={{ marginTop: '24px' }}>
                        {(dadosPdf.marca || dadosPdf.modelo) && (
                          <p style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '10px' }}>{dadosPdf.marca}{dadosPdf.modelo ? ' ' + dadosPdf.modelo : ''}</p>
                        )}
                        {dadosPdf.imagem && (
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                            <img src={dadosPdf.imagem} alt="Produto" style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain', border: '1px solid #e5e7eb', padding: '4px' }} />
                          </div>
                        )}
                        {dadosPdf.descricao && (
                          <>
                            <p style={{ fontWeight: 'bold', marginBottom: '6px' }}>Descrição do produto</p>
                            <p style={{ whiteSpace: 'pre-wrap', textAlign: 'justify', lineHeight: '1.6', color: '#374151' }}>{dadosPdf.descricao}</p>
                          </>
                        )}
                      </div>
                    )}

                </div>

                {/* ─── PÁGINA 2 ─── */}
                <div id="pdf-p2" style={{ background: 'white', color: 'black', padding: '20mm 18mm', width: '210mm', minHeight: '297mm', fontFamily: 'Arial, sans-serif', fontSize: '11px', lineHeight: '1.6', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                    {/* Cabeçalho compacto — evita repetir bloco completo logo+endereço */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{emp?.nome_fantasia || emp?.razao_social}</span>
                      <span style={{ color: '#555', fontSize: '10px' }}>CNPJ: {emp?.cnpj}</span>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid #d1d5db', marginBottom: '14px' }} />

                    <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Declaramos ainda que:</p>
                    <ol style={{ paddingLeft: '18px', marginBottom: '14px', lineHeight: '1.6' }}>
                      <li>Valor da proposta para o item 1: <strong>R${dadosPdf.valorUnitario.toFixed(2)} ({valorExt})</strong></li>
                      <li>Declaramos que a validade desta proposta é de {dadosPdf.validadeProposta} ({valorPorExtenso(Number(dadosPdf.validadeProposta)).replace(/ RE(AL|AIS).*/, '')}) dias a contar da data de sua entrega.</li>
                      <li>Declaramos expressamente que, no(s) preço(s) acima ofertado(s), estão inclusos todos os custos indiretos tais como: impostos, taxas, fretes, seguros etc.</li>
                      <li>Declaramos, ainda, que os preços de nossa proposta estão de acordo com os preços praticados no mercado, e que estão incluídos todos os insumos que o compõe, tais como as despesas com mão-de-obra, materiais, impostos, taxas, fretes, descontos e quaisquer outros que incidam direta ou indiretamente no cumprimento do contrato.</li>
                    </ol>
                    <p style={{ fontWeight: 'bold', marginBottom: '14px' }}>PRAZO DE ENTREGA DO PRODUTO: {dadosPdf.prazoEntrega} DIAS OU ANTES</p>

                    <p style={{ fontWeight: 'bold', marginBottom: '6px' }}>Dados da empresa:</p>
                    <div style={{ lineHeight: '1.5', marginBottom: '14px' }}>
                      <p>Empresa/Razão Social: {emp?.razao_social}</p>
                      <p>CNPJ: {emp?.cnpj}</p>
                      {emp?.ie && <p>IE: {emp.ie}</p>}
                      <p>Endereço: {emp?.endereco}{emp?.bairro ? ', Bairro ' + emp.bairro : ''}, {emp?.cidade}-{emp?.uf}</p>
                      {emp?.cep && <p>CEP: {emp.cep}</p>}
                      {emp?.telefone && <p>Telefone: {emp.telefone}</p>}
                      {emp?.celular && <p>Celular: {emp.celular}</p>}
                      {emp?.banco_nome && <p>Banco: {emp.banco_codigo ? emp.banco_codigo + ' ' : ''}{emp.banco_nome}{emp.banco_agencia ? ' Agência: ' + emp.banco_agencia : ''}{emp.banco_conta ? ' Conta-Corrente: ' + emp.banco_conta : ''}</p>}
                      {emp?.email && <p>E-mail: {emp.email}</p>}
                    </div>

                    {emp?.responsavel_nome && (
                      <>
                        <p style={{ fontWeight: 'bold', marginBottom: '6px' }}>Qualificação do preposto autorizado a firmar o Contrato:</p>
                        <div style={{ lineHeight: '1.5', marginBottom: '14px' }}>
                          <p>Nome completo: {emp.responsavel_nome}</p>
                          {emp.responsavel_cpf && <p>CPF: {emp.responsavel_cpf}</p>}
                          {emp.responsavel_rg && <p>RG: {emp.responsavel_rg}</p>}
                          {emp.responsavel_cargo && <p>Cargo: {emp.responsavel_cargo}</p>}
                          {emp.responsavel_naturalidade && <p>Naturalidade: {emp.responsavel_naturalidade}</p>}
                          {emp.responsavel_nacionalidade && <p>Nacionalidade: {emp.responsavel_nacionalidade}</p>}
                          {emp.responsavel_estado_civil && <p>Estado Civil: {emp.responsavel_estado_civil}</p>}
                        </div>
                      </>
                    )}

                    <p style={{ textAlign: 'justify' }}>Finalizando, declaramos que estamos de pleno acordo com todas as condições estabelecidas no pregão eletrônico.</p>
                  </div>

                {/* ─── PÁGINA 3 — ASSINATURA ─── */}
                <div id="pdf-p3" style={{ background: 'white', color: 'black', padding: '20mm 18mm', width: '210mm', minHeight: '297mm', fontFamily: 'Arial, sans-serif', fontSize: '11px', lineHeight: '1.6', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <CabecalhoPdf />

                    <div style={{ flex: 1 }} />

                    <p style={{ textAlign: 'right', marginBottom: '60px' }}>{dataFormatada}</p>

                    <div style={{ textAlign: 'center', paddingBottom: '40px' }}>
                      <div style={{ display: 'inline-block', borderTop: '1px solid #374151', paddingTop: '8px', minWidth: '240px' }}>
                        <p style={{ fontWeight: 'bold', fontSize: '12px' }}>{emp?.responsavel_nome || emp?.razao_social || 'REPRESENTANTE'}</p>
                        <p style={{ fontSize: '11px', color: '#555' }}>{emp?.responsavel_cargo || 'PROPRIETÁRIO(A)'}</p>
                      </div>
                    </div>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================= */}
      {/* MODAL REGISTRAR VITÓRIA                    */}
      {/* ========================================= */}
      {isModalVitoriaOpen && editalAtivo && (
        <div className="absolute inset-0 z-[300] flex items-center justify-center overlay-glass p-4">
          <div className="bg-[#090a0f] w-full max-w-md border-2 border-yellow-700/50 shadow-[0_0_30px_rgba(161,98,7,0.2)]">
            <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between bg-yellow-950/20">
              <div className="flex items-center gap-3">
                <Trophy size={18} className="text-yellow-400" />
                <h3 className="font-black text-sm uppercase tracking-widest text-yellow-300">Registrar Vitória</h3>
              </div>
              <button onClick={() => { playClick(); setIsModalVitoriaOpen(false); }} className="text-zinc-500 hover:text-red-500"><X size={18} /></button>
            </div>
            <form onSubmit={handleRegistrarVitoria} className="p-6 space-y-5">
              <p className="text-xs font-mono text-zinc-500 uppercase border border-zinc-800 bg-black/50 px-3 py-2 truncate">{editalAtivo.orgao}</p>
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Valor Total do Lance (R$)</label>
                <input
                  type="number" step="0.01" required min="0"
                  value={dadosVitoria.valorTotal}
                  onChange={(e) => setDadosVitoria(v => ({ ...v, valorTotal: Number(e.target.value) }))}
                  className="w-full px-4 py-3 bg-black border border-zinc-800 text-yellow-300 font-bold text-lg focus:outline-none focus:border-yellow-600 font-mono"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Lucro Líquido (R$)</label>
                <input
                  type="number" step="0.01" required min="0"
                  value={dadosVitoria.lucroLiquido}
                  onChange={(e) => setDadosVitoria(v => ({ ...v, lucroLiquido: Number(e.target.value) }))}
                  className="w-full px-4 py-3 bg-black border border-zinc-800 text-emerald-400 font-bold text-lg focus:outline-none focus:border-emerald-600 font-mono"
                />
              </div>
              {dadosVitoria.valorTotal > 0 && (
                <div className="text-center text-sm font-mono text-zinc-400 border border-zinc-800 bg-black/50 py-2">
                  Margem: <span className="text-emerald-400 font-bold">{((dadosVitoria.lucroLiquido / dadosVitoria.valorTotal) * 100).toFixed(1)}%</span>
                </div>
              )}
              <button
                type="submit"
                onMouseEnter={() => playHover()}
                className="w-full py-3 bg-yellow-700 hover:bg-yellow-600 text-white font-black text-sm uppercase tracking-widest transition-all shadow-[4px_4px_0_0_rgba(161,98,7,0.4)] hover:-translate-y-0.5 active:translate-y-0.5 flex items-center justify-center gap-2"
              >
                <Trophy size={16} /> Confirmar Vitória
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Leitor de Documentos */}
      {docVisualizacao && (
        <div className="absolute inset-0 z-[250] flex items-center justify-center bg-[#050508]/90 backdrop-blur-xl p-4 no-print">
          <div className="bg-[#12141d] w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden border-2 border-red-900/50 shadow-[0_0_30px_rgba(220,38,38,0.1)]">
            <div className="px-6 py-4 border-b-2 border-red-900/50 flex justify-between items-center bg-[#090a0f]">
              <h3 className="font-black text-zinc-200 uppercase tracking-widest text-sm flex items-center gap-3">
                <FileText size={18} className="text-red-500" /> Visualizador de Documentos
              </h3>
              <div className="flex gap-4 items-center">
                <button onClick={async () => await open(docVisualizacao)} className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-red-400 transition-colors">
                  Abrir externamente ↗
                </button>
                <div className="w-px h-5 bg-zinc-800"></div>
                <button onClick={() => { playClick(); setDocVisualizacao(null); }} className="text-zinc-600 hover:text-red-500 font-bold transition-colors"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 bg-black w-full relative">
              <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(docVisualizacao)}&embedded=true`} className="w-full h-full border-none absolute inset-0" title="Leitor PDF"></iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
