import { useState } from 'react';
import useSound from 'use-sound';
import { X, Bot, Search, FileText, Trophy, ChevronRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { LogoMonolith } from './UiElements';

interface OnboardingProps {
  perfilId: string;
  onConcluir: () => void;
}

const PASSOS = [
  {
    icone: Bot,
    titulo: 'Importar Editais',
    subtitulo: 'Passo 1 de 4',
    cor: 'text-red-500',
    corBorda: 'border-red-600',
    corBg: 'bg-red-950/20',
    descricao: 'O MONOLITH se conecta diretamente ao PNCP (Portal Nacional de Contratações Públicas) e importa editais de Dispensa Eletrônica automaticamente.',
    como: [
      'Clique em "Sync PNCP" na barra lateral para buscar novos editais do seu CNPJ.',
      'Ou use o "Extrator Manual" para importar um edital específico pelo link.',
      'O sistema baixa todos os itens automaticamente — mesmo editais com centenas de itens.',
    ],
  },
  {
    icone: Search,
    titulo: 'Cotar os Itens',
    subtitulo: 'Passo 2 de 4',
    cor: 'text-amber-400',
    corBorda: 'border-amber-600',
    corBg: 'bg-amber-950/20',
    descricao: 'Dentro de cada edital, você cota os itens um a um. O sistema calcula automaticamente se o seu lance cabe dentro do teto do governo.',
    como: [
      'Clique em qualquer item da lista para abrir o painel de cotação.',
      'Informe o fornecedor, custo unitário, frete e margem de lucro desejada.',
      'O "Lance Mínimo" é calculado em tempo real. Verde = dentro do teto. Vermelho = acima.',
    ],
  },
  {
    icone: FileText,
    titulo: 'Gerar Propostas',
    subtitulo: 'Passo 3 de 4',
    cor: 'text-blue-400',
    corBorda: 'border-blue-600',
    corBg: 'bg-blue-950/20',
    descricao: 'Para cada item cotado, você pode gerar uma proposta comercial em PDF no formato A4 — pronta para submeter no pregão.',
    como: [
      'Clique no ícone de documento (📄) ao lado de qualquer item.',
      'Preencha marca, modelo, foto do produto e descrição técnica.',
      'Clique em "Gerar PDF" e imprima ou salve diretamente pelo sistema.',
    ],
  },
  {
    icone: Trophy,
    titulo: 'Registrar Vitórias',
    subtitulo: 'Passo 4 de 4',
    cor: 'text-yellow-400',
    corBorda: 'border-yellow-600',
    corBg: 'bg-yellow-950/20',
    descricao: 'Ganhou a disputa? Registre a vitória com o valor e o lucro líquido. O histórico fica salvo para análise de desempenho.',
    como: [
      'Dentro do edital, clique em "Registrar Vitória" no canto superior direito.',
      'Informe o valor total e o lucro líquido da operação.',
      'O registro fica salvo no histórico da sua empresa.',
    ],
  },
];

export default function Onboarding({ perfilId, onConcluir }: OnboardingProps) {
  const [passo, setPasso] = useState(0);
  const [concluindo, setConcluindo] = useState(false);

  const [playHover] = useSound('/sounds/hover.mp3', { volume: 0.15 });
  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.3 });
  const [playSuccess] = useSound('/sounds/success.mp3', { volume: 0.4 });

  const passoAtual = PASSOS[passo];
  const Icone = passoAtual.icone;
  const isUltimo = passo === PASSOS.length - 1;

  async function handleConcluir() {
    setConcluindo(true);
    playSuccess();
    await supabase.from('profiles').update({ onboarding_concluido: true }).eq('id', perfilId);
    onConcluir();
  }

  function avancar() {
    playClick();
    if (isUltimo) {
      handleConcluir();
    } else {
      setPasso(p => p + 1);
    }
  }

  function voltar() {
    playClick();
    setPasso(p => Math.max(0, p - 1));
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-[#050508]/95 backdrop-blur-sm">
      {/* Skip */}
      <button
        onMouseEnter={() => playHover()}
        onClick={() => { playClick(); handleConcluir(); }}
        className="absolute top-6 right-6 flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-widest font-mono"
      >
        <X size={14} /> Pular introdução
      </button>

      <div className="w-full max-w-xl mx-4">
        {/* Logo e boas-vindas — só no passo 0 */}
        {passo === 0 && (
          <div className="flex flex-col items-center mb-8 aba-animada">
            <LogoMonolith animated={false} className="w-12 h-12 text-red-600 mb-4 drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
            <h1 className="text-2xl font-black tracking-widest text-zinc-100 uppercase">Bem-vindo ao <span className="text-red-600">MONOLITH</span></h1>
            <p className="text-sm text-zinc-500 mt-2 text-center">Veja como funciona o sistema em 4 passos rápidos.</p>
          </div>
        )}

        {/* Card do passo */}
        <div key={passo} className={`bg-[#090a0f] border-2 ${passoAtual.corBorda} shadow-xl aba-animada`}>
          {/* Header */}
          <div className={`px-6 py-5 ${passoAtual.corBg} border-b border-zinc-800 flex items-center gap-4`}>
            <div className={`w-12 h-12 border ${passoAtual.corBorda} bg-black flex items-center justify-center shrink-0`}>
              <Icone size={22} className={passoAtual.cor} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{passoAtual.subtitulo}</p>
              <h2 className={`text-xl font-black uppercase tracking-widest ${passoAtual.cor}`}>{passoAtual.titulo}</h2>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="p-6 space-y-5">
            <p className="text-sm text-zinc-300 leading-relaxed">{passoAtual.descricao}</p>

            <div className="space-y-2.5">
              {passoAtual.como.map((dica, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-5 h-5 shrink-0 border ${passoAtual.corBorda} flex items-center justify-center mt-0.5`}>
                    <span className={`text-[10px] font-black font-mono ${passoAtual.cor}`}>{i + 1}</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">{dica}</p>
                </div>
              ))}
            </div>

            {/* Barra de progresso */}
            <div className="flex items-center gap-2 pt-2">
              {PASSOS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 transition-all duration-300 ${i <= passo ? 'bg-red-600' : 'bg-zinc-800'}`}
                />
              ))}
            </div>
          </div>

          {/* Rodapé */}
          <div className="px-6 pb-6 flex items-center justify-between">
            <button
              onMouseEnter={() => playHover()}
              onClick={voltar}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border border-zinc-800 bg-black text-zinc-500 hover:text-zinc-300 transition-all ${passo === 0 ? 'opacity-0 pointer-events-none' : ''}`}
            >
              Voltar
            </button>

            <button
              onMouseEnter={() => playHover()}
              onClick={avancar}
              disabled={concluindo}
              className={`flex items-center gap-2 px-6 py-3 font-black text-xs uppercase tracking-widest transition-all shadow-[4px_4px_0_0_rgba(220,38,38,0.3)] hover:shadow-[6px_6px_0_0_rgba(220,38,38,0.5)] hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-50 ${isUltimo ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
            >
              {concluindo ? (
                <><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin"></div> Carregando...</>
              ) : isUltimo ? (
                <><CheckCircle2 size={14} /> Começar a usar</>
              ) : (
                <>Próximo <ChevronRight size={14} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
