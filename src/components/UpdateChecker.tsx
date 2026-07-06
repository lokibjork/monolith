import { useEffect, useState } from 'react';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, Update } from '@tauri-apps/plugin-updater';
import { Download, RefreshCw, X, Zap } from 'lucide-react';

export default function UpdateChecker() {
  const [updateObj, setUpdateObj] = useState<Update | null>(null);
  const [instalando, setInstalando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [dispensado, setDispensado] = useState(false);

  useEffect(() => {
    // Verifica atualização ao iniciar, com delay para não travar o boot
    const timer = setTimeout(() => {
      check()
        .then(update => { if (update?.available) setUpdateObj(update); })
        .catch(() => {}); // silencia erros de rede
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  async function handleInstalar() {
    if (!updateObj) return;
    setInstalando(true);
    try {
      let baixados = 0;
      let total = 0;

      await updateObj.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          baixados += event.data.chunkLength;
          if (total > 0) setProgresso(Math.round((baixados / total) * 100));
        } else if (event.event === 'Finished') {
          setProgresso(100);
        }
      });

      await relaunch();
    } catch (e) {
      console.error('Erro ao instalar atualização:', e);
      setInstalando(false);
    }
  }

  if (!updateObj || dispensado) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-80 shadow-2xl"
      style={{ border: '1px solid rgba(220,38,38,0.5)', background: '#090a0f' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.08)' }}>
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-red-500" />
          <span className="text-xs font-black uppercase tracking-widest text-red-400">
            Atualização Disponível
          </span>
        </div>
        {!instalando && (
          <button onClick={() => setDispensado(true)}
            className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-600 uppercase">Nova versão</span>
          <span className="text-xs font-black text-emerald-400 font-mono">v{updateObj.version}</span>
        </div>

        {updateObj.body && (
          <p className="text-[11px] text-zinc-500 font-mono leading-relaxed border-l-2 border-zinc-800 pl-2">
            {updateObj.body}
          </p>
        )}

        {instalando && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-zinc-600">
              <span>{progresso < 100 ? 'Baixando...' : 'Instalando...'}</span>
              <span>{progresso}%</span>
            </div>
            <div className="w-full h-1 bg-zinc-900 border border-zinc-800">
              <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${progresso}%` }} />
            </div>
          </div>
        )}

        {!instalando ? (
          <div className="flex gap-2 pt-1">
            <button onClick={handleInstalar}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black uppercase tracking-widest text-white transition-all"
              style={{ background: '#dc2626' }}>
              <Download size={12} /> Instalar agora
            </button>
            <button onClick={() => setDispensado(true)}
              className="px-3 py-2 text-xs font-bold uppercase text-zinc-600 hover:text-zinc-400 transition-colors border border-zinc-800">
              Depois
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-xs font-mono text-zinc-500">
            <RefreshCw size={12} className="animate-spin" />
            {progresso === 100 ? 'Reiniciando...' : 'Não feche o aplicativo'}
          </div>
        )}
      </div>
    </div>
  );
}
