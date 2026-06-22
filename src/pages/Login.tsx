import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSound from 'use-sound';
import { Eye, EyeOff } from 'lucide-react';
import { LogoMonolith } from '../components/UiElements';
import { supabase } from '../services/supabase';

const STORAGE_KEY_EMAIL = 'monolith_saved_email';
const STORAGE_KEY_LEMBRAR = 'monolith_lembrar';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrarEmail, setLembrarEmail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const navigate = useNavigate();

  const [playHover] = useSound('/sounds/hover.mp3', { volume: 0.15 });
  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.3 });
  const [playAlert] = useSound('/sounds/alert.mp3', { volume: 0.5 });
  const [playSuccess] = useSound('/sounds/success.mp3', { volume: 0.4 });

  useEffect(() => {
    // Se já tem sessão ativa, vai direto pro dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard');
    });
    // Restaura email salvo
    const emailSalvo = localStorage.getItem(STORAGE_KEY_EMAIL);
    const lembrarSalvo = localStorage.getItem(STORAGE_KEY_LEMBRAR) === 'true';
    if (emailSalvo && lembrarSalvo) {
      setEmail(emailSalvo);
      setLembrarEmail(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    setIsLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      playAlert();
      setErrorMsg('ACESSO NEGADO // Credenciais inválidas.');
      setIsLoading(false);
    } else if (data.session) {
      // Salva ou limpa o email conforme preferência
      if (lembrarEmail) {
        localStorage.setItem(STORAGE_KEY_EMAIL, email);
        localStorage.setItem(STORAGE_KEY_LEMBRAR, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEY_EMAIL);
        localStorage.removeItem(STORAGE_KEY_LEMBRAR);
      }
      playSuccess();
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center relative overflow-hidden font-mono" style={{ background: 'var(--c-bg)' }}>
      <div className="absolute inset-0 scanline opacity-30"></div>
      <div className="absolute inset-0 fundo-estrelas opacity-20"></div>

      {/* Glow de fundo centralizado */}
      <div className="absolute w-96 h-96 bg-red-600/5 blur-3xl rounded-full pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Card principal */}
        <div className="p-10 bg-[#090a0f] border-2 border-red-900/50 shadow-[0_0_40px_rgba(220,38,38,0.12),4px_4px_0_0_rgba(220,38,38,0.15)] flex flex-col items-center">

          <LogoMonolith animated={false} className="w-16 h-16 text-red-600 mb-6 drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
          <h2 className="text-xl font-black text-zinc-100 uppercase tracking-[0.3em] mb-1">Acesso Restrito</h2>
          <p className="text-[10px] text-red-500/70 uppercase tracking-widest mb-8 font-mono">Autenticação obrigatória · MONOLITH v1.0</p>

          <form onSubmit={handleLogin} className="w-full space-y-5">

            {/* EMAIL */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                ID Operacional (Email)
              </label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-black border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-red-600 focus:shadow-[0_0_10px_rgba(220,38,38,0.2)] transition-all disabled:opacity-50"
                placeholder="agente@prisma.com"
                autoComplete="email"
              />
            </div>

            {/* SENHA com toggle */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                Passcode (Senha)
              </label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 pr-12 bg-black border border-zinc-800 text-red-400 font-bold tracking-widest text-sm focus:outline-none focus:border-red-600 focus:shadow-[0_0_10px_rgba(220,38,38,0.2)] transition-all disabled:opacity-50"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onMouseEnter={() => playHover()}
                  onClick={() => { playClick(); setMostrarSenha(v => !v); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* LEMBRAR EMAIL */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onMouseEnter={() => playHover()}
                onClick={() => { playClick(); setLembrarEmail(v => !v); }}
                className={`w-4 h-4 border-2 flex items-center justify-center transition-all flex-shrink-0 ${lembrarEmail ? 'bg-red-600 border-red-600' : 'bg-black border-zinc-700 hover:border-zinc-500'}`}
              >
                {lembrarEmail && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest select-none">Lembrar meu email neste dispositivo</span>
            </div>

            {/* ERRO */}
            {errorMsg && (
              <div className="p-3 border border-red-900 bg-red-950/30 text-[10px] text-red-400 font-bold uppercase tracking-widest text-center">
                ⚠ {errorMsg}
              </div>
            )}

            {/* BOTÃO PRINCIPAL */}
            <button
              type="submit"
              disabled={isLoading}
              onMouseEnter={() => playHover()}
              className="w-full mt-2 py-4 bg-red-600 text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-red-500 shadow-[4px_4px_0_0_rgba(127,29,29,0.5)] hover:shadow-[6px_6px_0_0_rgba(127,29,29,0.8)] active:translate-y-1 active:shadow-[2px_2px_0_0_rgba(127,29,29,0.5)] transition-all flex justify-center items-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin"></div>
                  VERIFICANDO CREDENCIAIS...
                </>
              ) : (
                'ESTABELECER CONEXÃO'
              )}
            </button>
          </form>
        </div>

        {/* Rodapé discreto */}
        <p className="text-center text-[9px] text-zinc-800 mt-4 uppercase tracking-widest font-mono">
          MONOLITH · PRISMA DISTRIBUIDORA · USO INTERNO
        </p>
      </div>
    </div>
  );
}
