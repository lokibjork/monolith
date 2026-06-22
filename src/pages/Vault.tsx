import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSound from 'use-sound';
import { VaultIcon, PlusCircleIcon, Trash2, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import Sidebar from '../components/Sidebar';

export default function Vault() {
  const [meusDocumentos, setMeusDocumentos] = useState<any[]>([]);
  const [isModalMeuDocOpen, setIsModalMeuDocOpen] = useState(false);
  const [novoMeuDoc, setNovoMeuDoc] = useState({ nome: '', dataVencimento: '', link: '' });
  
  const navigate = useNavigate();
  const [playHover] = useSound('/sounds/hover.mp3', { volume: 0.15 });
  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.3 });
  const [playSuccess] = useSound('/sounds/success.mp3', { volume: 0.4 });

  useEffect(() => {
    carregarCofre();
  }, []);

  async function carregarCofre() {
    const { data } = await supabase.from('meus_documentos').select('*').order('data_vencimento', { ascending: true });
    if (data) setMeusDocumentos(data);
  }

async function handleSalvarMeuDoc(e: React.FormEvent) {
    e.preventDefault();
    
    // Tenta salvar na nuvem
    const { error } = await supabase.from('meus_documentos').insert({
      nome: novoMeuDoc.nome,
      data_vencimento: novoMeuDoc.dataVencimento,
      link: novoMeuDoc.link
    });

    // Se a nuvem bloquear, solta um alerta na tela
    if (error) {
      alert("🛡️ Bloqueio do Supabase: " + error.message);
      return;
    }

    // Se der sucesso, limpa a tela e recarrega
    setNovoMeuDoc({ nome: '', dataVencimento: '', link: '' });
    setIsModalMeuDocOpen(false);
    await carregarCofre();
    playSuccess();
  }

  async function handleExcluirDoc(id: number) {
    await supabase.from('meus_documentos').delete().eq('id', id);
    playClick();
    await carregarCofre();
  }

  return (
    <div className="flex flex-1 w-full overflow-hidden relative">
      {/* Se o usuário clicar em Extrair PNCP no cofre, mandamos ele pro Dashboard */}
      <Sidebar onOpenRobo={() => navigate('/dashboard')} />
      
      <main className="flex-1 flex flex-col pt-10 overflow-hidden z-10 relative" style={{ background: 'var(--c-bg)' }}>
        <div className="p-8 overflow-y-auto h-full aba-animada">
          <header className="mb-10 flex justify-between items-center border-b-2 border-zinc-800 pb-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-none bg-zinc-900 border-2 border-red-900 flex items-center justify-center text-red-500 shadow-[4px_4px_0_0_rgba(220,38,38,0.2)]">
                <VaultIcon size={32} strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-widest uppercase text-zinc-100">Cofre de <span className="text-red-600">Documentos</span></h1>
                <p className="text-sm text-zinc-500 mt-1">Certidões e documentos com alertas de vencimento.</p>
              </div>
            </div>

            <button 
              onMouseEnter={() => playHover()} onClick={() => { playClick(); setIsModalMeuDocOpen(true); }} 
              className="group relative px-6 py-3 rounded-none border border-zinc-700 bg-zinc-900 shadow-[4px_4px_0_0_rgba(39,39,42,1)] hover:border-red-500 hover:shadow-[4px_4px_0_0_rgba(220,38,38,0.5)] active:translate-y-1 transition-all duration-200 cursor-pointer flex items-center gap-3">
              <PlusCircleIcon size={18} className="text-red-500" strokeWidth={2} />
              <span className="font-bold uppercase tracking-wider text-xs text-zinc-300 group-hover:text-red-50">Adicionar Documento</span>
            </button>
          </header>

          <div className="bg-[#12141d] rounded-none border border-zinc-800 shadow-xl overflow-hidden">
            {meusDocumentos.length === 0 ? (
              <div className="p-12 text-center text-zinc-600 font-mono text-sm uppercase">Nenhum registro encontrado no cofre.</div>
            ) : (
              <table className="w-full text-left text-sm text-zinc-400">
                <thead className="bg-[#090a0f] text-xs font-bold uppercase tracking-wide text-zinc-500 border-b-2 border-red-900/30">
                  <tr>
                    <th className="px-6 py-3 w-1/2">Documento</th>
                    <th className="px-6 py-3">Vencimento</th>
                    <th className="px-6 py-3">Situação</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="font-mono divide-y divide-zinc-800/50">
                  {meusDocumentos.map((doc) => {
                    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
                    const venc = new Date(doc.data_vencimento + 'T00:00:00');
                    const diffDias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                    
                    let status = { cor: 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20', txt: 'Válido' };
                    if (diffDias < 0) status = { cor: 'text-red-50 border-red-500 bg-red-600 animate-pulse', txt: 'Vencido' };
                    else if (diffDias <= 15) status = { cor: 'text-amber-400 border-amber-900/50 bg-amber-950/30', txt: `Vence em ${diffDias}d` };

                    return (
                      <tr key={doc.id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-zinc-200 font-sans tracking-wide uppercase">{doc.nome}</td>
                        <td className="px-6 py-4">{venc.toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-[10px] uppercase font-bold border ${status.cor}`}>{status.txt}</span>
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-3">
                          {doc.link && <a href={doc.link} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-red-400 font-bold uppercase text-xs border border-zinc-700 hover:border-red-500 px-3 py-1 bg-black transition-colors">Abrir</a>}
                          <button onMouseEnter={() => playHover()} onClick={() => handleExcluirDoc(doc.id)} className="text-zinc-600 hover:text-red-500 transition-colors">
                            <Trash2 size={16} strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Modal de Novo Documento */}
      {isModalMeuDocOpen && (
        <div className="absolute inset-0 z-[300] flex items-center justify-center overlay-glass">
          <div className="bg-[#090a0f] w-full max-w-md border-2 border-zinc-700">
            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-[#12141d]">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-200">Novo Documento</h3>
              <button onClick={() => { playClick(); setIsModalMeuDocOpen(false); }} className="text-zinc-600 hover:text-red-500"><X size={18}/></button>
            </div>
            <form onSubmit={handleSalvarMeuDoc} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nome do Documento</label>
                <input required type="text" value={novoMeuDoc.nome} onChange={(e) => setNovoMeuDoc({...novoMeuDoc, nome: e.target.value})} className="w-full px-3 py-2 bg-black border border-zinc-800 text-zinc-200 text-sm focus:outline-none"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Data de Vencimento</label>
                <input required type="date" value={novoMeuDoc.dataVencimento} onChange={(e) => setNovoMeuDoc({...novoMeuDoc, dataVencimento: e.target.value})} className="w-full px-3 py-2 bg-black border border-zinc-800 text-zinc-200 text-sm focus:outline-none [color-scheme:dark]"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Link do documento (opcional)</label>
                <input type="text" value={novoMeuDoc.link} onChange={(e) => setNovoMeuDoc({...novoMeuDoc, link: e.target.value})} className="w-full px-3 py-2 bg-black border border-zinc-800 text-zinc-200 text-sm focus:outline-none"/>
              </div>
              <div className="pt-4 flex justify-end space-x-4 mt-6 border-t border-zinc-800">
                <button type="submit" onMouseEnter={() => playHover()} className="px-6 py-2 bg-zinc-200 text-black font-bold text-xs uppercase tracking-widest shadow-[4px_4px_0_0_rgba(161,161,170,0.3)] hover:-translate-y-1 active:translate-y-0.5 transition-all">Salvar Documento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}