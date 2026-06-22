import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export interface Perfil {
  id: string;
  nome: string;
  cargo: string;
  cor: string;
  avatar_url: string | null;
  onboarding_concluido?: boolean;
}

interface AuthContextType {
  usuario: User | null;
  perfil: Perfil | null;
  carregando: boolean;
  atualizarPerfil: (dados: Partial<Perfil>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  perfil: null,
  carregando: true,
  atualizarPerfil: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function carregarPerfil(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      setPerfil(data as Perfil);
    } else {
      // Cria perfil padrão na primeira entrada
      const { data: user } = await supabase.auth.getUser();
      const nomeEmail = user?.user?.email?.split('@')[0] || 'Agente';

      // Primeiro usuário do sistema vira Diretor automaticamente
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      const cargoInicial = (count === 0) ? 'Diretor' : 'Cotador';

      const novoPerfil: Perfil = {
        id: userId,
        nome: nomeEmail,
        cargo: cargoInicial,
        cor: '#dc2626',
        avatar_url: null,
        onboarding_concluido: false,
      };
      await supabase.from('profiles').insert(novoPerfil);
      setPerfil(novoPerfil);
    }
  }

  async function atualizarPerfil(dados: Partial<Perfil>) {
    if (!usuario) return;
    await supabase.from('profiles').update(dados).eq('id', usuario.id);
    setPerfil(prev => prev ? { ...prev, ...dados } : null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      setUsuario(user);
      if (user) carregarPerfil(user.id).finally(() => setCarregando(false));
      else setCarregando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setUsuario(user);
      if (user) carregarPerfil(user.id);
      else setPerfil(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, perfil, carregando, atualizarPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
