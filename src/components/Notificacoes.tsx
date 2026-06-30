import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { X, Crosshair } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';

// ============================================================
// TIPOS
// ============================================================
export interface Toast {
  id: string;
  tipo: 'participacao' | 'cotacao';
  mensagem: string;
  agente: { nome: string; cor: string; avatar_url: string | null };
  edital?: string;
}

interface NotifContextType {
  emitirToast: (toast: Omit<Toast, 'id'>) => void;
}

const NotifContext = createContext<NotifContextType>({ emitirToast: () => {} });
export const useNotificacoes = () => useContext(NotifContext);

// ============================================================
// PROVIDER (envolve o app, escuta o Supabase Realtime)
// ============================================================
export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { usuario } = useAuth();

  function emitirToast(t: Omit<Toast, 'id'>) {
    const id = crypto.randomUUID();
    setToasts(prev => [{ ...t, id }, ...prev].slice(0, 5));
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 6000);
  }

  function removerToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  useEffect(() => {
    if (!usuario) return;

    const canal = supabase
      .channel('monolith-realtime')

      // Quando alguém marca participação num edital
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'editais',
        filter: 'status=eq.participando',
      }, (payload) => {
        const novo = payload.new as any;
        // Ignora mudanças feitas pelo próprio usuário
        if (novo.participante_id === usuario.id) return;
        if (!novo.participante_nome) return;

        emitirToast({
          tipo: 'participacao',
          mensagem: `entrou na disputa`,
          edital: novo.orgao || novo.numero,
          agente: {
            nome: novo.participante_nome,
            cor: novo.participante_cor || '#dc2626',
            avatar_url: null,
          },
        });
      })

      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [usuario]);

  return (
    <NotifContext.Provider value={{ emitirToast }}>
      {children}

      {/* TOASTS — canto superior direito, abaixo da barra de título */}
      <div className="fixed top-12 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 p-3 pr-4 bg-[#12141d] border border-zinc-700 shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] w-72 aba-animada"
          >
            <Avatar nome={t.agente.nome} cor={t.agente.cor} avatar_url={t.agente.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Crosshair size={10} className="text-red-500 shrink-0" />
                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest truncate">
                  {t.agente.nome}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono truncate">{t.mensagem}</p>
              {t.edital && (
                <p className="text-[9px] text-zinc-600 font-mono truncate mt-0.5 border-l border-zinc-700 pl-1.5">
                  {t.edital}
                </p>
              )}
            </div>
            <button onClick={() => removerToast(t.id)} className="text-zinc-700 hover:text-zinc-400 mt-0.5 shrink-0">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </NotifContext.Provider>
  );
}
