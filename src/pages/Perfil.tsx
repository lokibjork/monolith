import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSound from 'use-sound';
import { User, Camera, Save, LogOut, ShieldCheck, Building2, Banknote, UserCheck, ChevronDown, ChevronUp, Users, Lock, Crown } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Avatar from '../components/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import {
  EmpresaConfig, CONFIG_VAZIO,
  buscarEmpresaConfig, salvarEmpresaConfig,
} from '../services/empresaConfig';

const CORES = [
  '#dc2626', '#ea580c', '#d97706', '#16a34a',
  '#0891b2', '#2563eb', '#7c3aed', '#db2777',
  '#64748b', '#e11d48',
];

const CARGOS = [
  'Cotador', 'Analista de Licitações', 'Gerente',
  'Supervisor', 'Diretor', 'Agente de Compras',
];

interface AgentePerfil {
  id: string;
  nome: string;
  cargo: string;
  cor: string;
  email?: string;
}

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

function LabelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--c-text-2)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function InputEmpresa({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border text-sm focus:outline-none font-mono transition-all"
      style={{
        background: 'var(--c-input-bg)', color: 'var(--c-input-text)',
        borderColor: 'var(--c-border-md)',
      }}
    />
  );
}

export default function Perfil() {
  const { perfil, atualizarPerfil, usuario } = useAuth();
  const navigate = useNavigate();

  // Perfil do agente
  const [nome, setNome] = useState(perfil?.nome || '');
  const [cargo] = useState(perfil?.cargo || 'Cotador');
  const [cor, setCor] = useState(perfil?.cor || '#dc2626');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(perfil?.avatar_url || null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const isDiretor = perfil?.cargo === 'Diretor';

  // Empresa Config
  const [empresa, setEmpresa] = useState<EmpresaConfig>(CONFIG_VAZIO);
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const [sucessoEmpresa, setSucessoEmpresa] = useState(false);
  const [abertaSecao, setAbertaSecao] = useState<'empresa' | 'banco' | 'responsavel' | null>('empresa');

  // Gestão de Agentes (só Diretor)
  const [agentes, setAgentes] = useState<AgentePerfil[]>([]);
  const [cargosEditados, setCargosEditados] = useState<Record<string, string>>({});
  const [salvandoCargos, setSalvandoCargos] = useState(false);
  const [sucessoCargos, setSucessoCargos] = useState(false);

  const [playHover] = useSound('/sounds/hover.mp3', { volume: 0.15 });
  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.3 });
  const [playSuccess] = useSound('/sounds/success.mp3', { volume: 0.4 });

  useEffect(() => {
    buscarEmpresaConfig().then(cfg => {
      if (cfg) setEmpresa(cfg);
    });
  }, []);

  useEffect(() => {
    if (!isDiretor) return;
    supabase.from('profiles').select('id, nome, cargo, cor').then(({ data }) => {
      if (data) {
        const lista = (data as AgentePerfil[]).filter(a => a.id !== perfil?.id);
        setAgentes(lista);
        const mapa: Record<string, string> = {};
        lista.forEach(a => { mapa[a.id] = a.cargo; });
        setCargosEditados(mapa);
      }
    });
  }, [isDiretor]);

  function setEmp(field: keyof EmpresaConfig, value: string) {
    setEmpresa(prev => ({ ...prev, [field]: value }));
  }

  function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 200;
        let w = img.width, h = img.height;
        if (w > h) { if (w > max) { h *= max / w; w = max; } }
        else { if (h > max) { w *= max / h; h = max; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        setAvatarUrl(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 300;
        let w = img.width, h = img.height;
        if (w > max) { h *= max / w; w = max; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        setEmp('logo_base64', canvas.toDataURL('image/png', 0.9));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSalvarAgente(e: React.FormEvent) {
    e.preventDefault();
    playClick();
    setSalvando(true);
    // cargo nunca é salvo pelo próprio usuário — só o Diretor pode alterar cargos
    await atualizarPerfil({ nome, cor, avatar_url: avatarUrl });
    setSalvando(false);
    setSucesso(true);
    playSuccess();
    setTimeout(() => setSucesso(false), 3000);
  }

  async function handleSalvarCargos() {
    playClick();
    setSalvandoCargos(true);
    for (const [id, cargo] of Object.entries(cargosEditados)) {
      await supabase.from('profiles').update({ cargo }).eq('id', id);
    }
    setSalvandoCargos(false);
    setSucessoCargos(true);
    playSuccess();
    setTimeout(() => setSucessoCargos(false), 3000);
    // Atualiza lista local
    setAgentes(prev => prev.map(a => ({ ...a, cargo: cargosEditados[a.id] ?? a.cargo })));
  }

  async function handleSalvarEmpresa(e: React.FormEvent) {
    e.preventDefault();
    playClick();
    setSalvandoEmpresa(true);
    await salvarEmpresaConfig(empresa);
    setSalvandoEmpresa(false);
    setSucessoEmpresa(true);
    playSuccess();
    setTimeout(() => setSucessoEmpresa(false), 3000);
  }

  async function handleLogout() {
    playClick();
    await supabase.auth.signOut();
    navigate('/login');
  }

  function SecaoHeader({ id, titulo, icone }: { id: 'empresa' | 'banco' | 'responsavel'; titulo: string; icone: React.ReactNode }) {
    const aberta = abertaSecao === id;
    return (
      <button
        type="button"
        onMouseEnter={() => playHover()}
        onClick={() => { playClick(); setAbertaSecao(aberta ? null : id); }}
        className="w-full flex items-center justify-between px-6 py-4 border-b transition-all cursor-pointer"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-card-hover)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-red-500">{icone}</span>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-1)' }}>{titulo}</span>
        </div>
        {aberta ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
      </button>
    );
  }

  return (
    <div className="flex flex-1 w-full overflow-hidden relative">
      <Sidebar onOpenRobo={() => navigate('/dashboard')} />

      <main className="flex-1 flex flex-col pt-10 overflow-hidden z-10 relative" style={{ background: 'var(--c-bg)' }}>
        <div className="p-8 overflow-y-auto h-full aba-animada">

          {/* HEADER */}
          <header className="mb-8 flex justify-between items-center pb-5" style={{ borderBottom: '2px solid var(--c-border)' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-lg" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)' }}>
                <User size={22} className="text-red-500" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-wider uppercase" style={{ color: 'var(--c-text-1)' }}>Perfil &amp; Configurações</h1>
                <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--c-text-2)' }}>{usuario?.email}</p>
              </div>
            </div>
            <button
              onMouseEnter={() => playHover()} onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all"
              style={{ border: '1px solid var(--c-border)', color: 'var(--c-text-2)', background: 'var(--c-card)' }}
            >
              <LogOut size={13} /> Desconectar
            </button>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* AVATAR */}
            <div className="rounded-xl p-6 flex flex-col items-center gap-5" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
              <div className="relative group cursor-pointer">
                <Avatar nome={nome} cor={cor} avatar_url={avatarUrl} size="lg" className="w-24 h-24 text-2xl" />
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                  <Camera size={20} className="text-white" />
                  <input type="file" accept="image/*" onChange={handleUploadFoto} className="hidden" />
                </label>
              </div>
              <div className="text-center">
                <p className="font-black text-lg uppercase tracking-wider" style={{ color: 'var(--c-text-1)' }}>{nome || 'AGENTE'}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-2)' }}>{cargo}</p>
              </div>
              <div className="w-full pt-4 space-y-2 text-xs font-mono uppercase" style={{ borderTop: '1px solid var(--c-border)', color: 'var(--c-text-3)' }}>
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className="text-emerald-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>Online
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ID</span>
                  <span style={{ color: 'var(--c-text-2)' }}>{usuario?.id?.slice(0, 8)}...</span>
                </div>
              </div>
            </div>

            {/* FORMULÁRIOS */}
            <div className="lg:col-span-2 space-y-5">

              {/* DADOS DO AGENTE */}
              <form onSubmit={handleSalvarAgente} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
                <div className="px-5 py-4" style={{ background: 'var(--c-card-hover)', borderBottom: '1px solid var(--c-border)' }}>
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-red-500" />
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-1)' }}>Dados do Agente</span>
                  </div>
                </div>
                <div className="p-5 space-y-4" style={{ background: 'var(--c-card)' }}>
                  <LabelField label="Nome de Exibição">
                    <input type="text" required value={nome} onChange={e => setNome(e.target.value)}
                      className="w-full px-3 py-2.5 border text-sm focus:outline-none font-mono"
                      style={{ background: 'var(--c-input-bg)', color: 'var(--c-input-text)', borderColor: 'var(--c-border-md)' }}
                      placeholder="Ex: Arthur Silva" />
                  </LabelField>
                  <LabelField label="Cargo">
                    <div className="flex items-center gap-2 px-3 py-2.5 border text-sm font-mono"
                      style={{ background: 'var(--c-input-bg)', borderColor: 'var(--c-border-md)', color: 'var(--c-text-2)' }}>
                      {isDiretor
                        ? <><Crown size={13} className="text-yellow-500" /> <span className="text-yellow-400 font-bold">{cargo}</span></>
                        : <><Lock size={13} className="text-zinc-600" /> <span>{cargo}</span></>
                      }
                      <span className="ml-auto text-[10px] text-zinc-600">atribuído pelo Diretor</span>
                    </div>
                  </LabelField>
                  <LabelField label="Cor do Avatar">
                    <div className="flex flex-wrap gap-2 pt-1">
                      {CORES.map(c => (
                        <button key={c} type="button" onMouseEnter={() => playHover()} onClick={() => { playClick(); setCor(c); }}
                          className="w-8 h-8 rounded-full transition-all"
                          style={{ backgroundColor: c, boxShadow: cor === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none', transform: cor === c ? 'scale(1.2)' : 'scale(1)' }} />
                      ))}
                    </div>
                  </LabelField>
                  <button type="submit" disabled={salvando} onMouseEnter={() => playHover()}
                    className="w-full py-3 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-white"
                    style={{ background: sucesso ? '#059669' : '#dc2626' }}>
                    {sucesso ? <><ShieldCheck size={15} /> Salvo!</> : <><Save size={15} /> {salvando ? 'Salvando...' : 'Salvar Perfil'}</>}
                  </button>
                </div>
              </form>

              {/* DADOS DA EMPRESA */}
              <form onSubmit={handleSalvarEmpresa} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
                <div className="px-5 py-4 flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.06)', borderBottom: '1px solid var(--c-border)' }}>
                  <Building2 size={14} className="text-red-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-red-400">Dados da Empresa</span>
                  <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--c-text-2)' }}>Usados para gerar propostas PDF</span>
                </div>

                {/* Bloqueio para não-Diretores */}
                {!isDiretor ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12" style={{ background: 'var(--c-card)' }}>
                    <Lock size={28} className="text-zinc-700" />
                    <p className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>
                      Acesso restrito ao Diretor
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--c-text-3)' }}>
                      Solicite ao Diretor que atualize os dados da empresa.
                    </p>
                  </div>
                ) : (

                <div style={{ background: 'var(--c-card)' }}>

                  {/* Secão: Empresa */}
                  <SecaoHeader id="empresa" titulo="Identificação &amp; Endereço" icone={<Building2 size={14} />} />
                  {abertaSecao === 'empresa' && (
                    <div className="p-5 grid grid-cols-2 gap-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
                      <div className="col-span-2 flex gap-4 items-end">
                        <div className="flex-1">
                          <LabelField label="Logo da empresa (aparece no PDF)">
                            <label className="flex items-center gap-2 px-3 py-2 border cursor-pointer text-xs transition-all"
                              style={{ background: 'var(--c-input-bg)', borderColor: 'var(--c-border-md)', color: 'var(--c-text-2)' }}>
                              <Camera size={13} /> Carregar logo (PNG/JPG)
                              <input type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" />
                            </label>
                          </LabelField>
                        </div>
                        {empresa.logo_base64 && (
                          <img src={empresa.logo_base64} alt="Logo" className="h-12 object-contain border p-1" style={{ borderColor: 'var(--c-border)' }} />
                        )}
                      </div>
                      <div className="col-span-2">
                        <LabelField label="Nome Fantasia (exibido no cabeçalho do PDF)">
                          <InputEmpresa value={empresa.nome_fantasia} onChange={v => setEmp('nome_fantasia', v)} placeholder="Prisma Distribuidora" />
                        </LabelField>
                      </div>
                      <div className="col-span-2">
                        <LabelField label="Razão Social * (usado nos documentos legais)">
                          <InputEmpresa value={empresa.razao_social} onChange={v => setEmp('razao_social', v)} placeholder="João Silva Santos 12345678900" />
                        </LabelField>
                      </div>
                      <LabelField label="CNPJ *">
                        <InputEmpresa value={empresa.cnpj} onChange={v => setEmp('cnpj', v)} placeholder="00.000.000/0001-00" />
                      </LabelField>
                      <LabelField label="Inscrição Estadual (IE)">
                        <InputEmpresa value={empresa.ie} onChange={v => setEmp('ie', v)} placeholder="000.000.000" />
                      </LabelField>
                      <div className="col-span-2">
                        <LabelField label="Endereço (logradouro + número)">
                          <InputEmpresa value={empresa.endereco} onChange={v => setEmp('endereco', v)} placeholder="Rua das Flores, 100" />
                        </LabelField>
                      </div>
                      <LabelField label="Bairro">
                        <InputEmpresa value={empresa.bairro} onChange={v => setEmp('bairro', v)} placeholder="Centro" />
                      </LabelField>
                      <LabelField label="CEP">
                        <InputEmpresa value={empresa.cep} onChange={v => setEmp('cep', v)} placeholder="00000-000" />
                      </LabelField>
                      <LabelField label="Cidade">
                        <InputEmpresa value={empresa.cidade} onChange={v => setEmp('cidade', v)} placeholder="São Paulo" />
                      </LabelField>
                      <LabelField label="UF">
                        <select value={empresa.uf} onChange={e => setEmp('uf', e.target.value)}
                          className="w-full px-3 py-2 border text-sm focus:outline-none"
                          style={{ background: 'var(--c-input-bg)', color: 'var(--c-input-text)', borderColor: 'var(--c-border-md)' }}>
                          <option value="">Selecione</option>
                          {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </LabelField>
                      <LabelField label="Telefone">
                        <InputEmpresa value={empresa.telefone} onChange={v => setEmp('telefone', v)} placeholder="(11) 3000-0000" />
                      </LabelField>
                      <LabelField label="Celular / WhatsApp">
                        <InputEmpresa value={empresa.celular} onChange={v => setEmp('celular', v)} placeholder="(11) 99999-9999" />
                      </LabelField>
                      <div className="col-span-2">
                        <LabelField label="E-mail da empresa">
                          <InputEmpresa value={empresa.email} onChange={v => setEmp('email', v)} placeholder="contato@empresa.com.br" type="email" />
                        </LabelField>
                      </div>
                    </div>
                  )}

                  {/* Seção: Banco */}
                  <SecaoHeader id="banco" titulo="Dados Bancários" icone={<Banknote size={14} />} />
                  {abertaSecao === 'banco' && (
                    <div className="p-5 grid grid-cols-2 gap-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
                      <LabelField label="Nome do Banco">
                        <InputEmpresa value={empresa.banco_nome} onChange={v => setEmp('banco_nome', v)} placeholder="Nubank Pagamentos PJ" />
                      </LabelField>
                      <LabelField label="Código do Banco">
                        <InputEmpresa value={empresa.banco_codigo} onChange={v => setEmp('banco_codigo', v)} placeholder="260" />
                      </LabelField>
                      <LabelField label="Agência">
                        <InputEmpresa value={empresa.banco_agencia} onChange={v => setEmp('banco_agencia', v)} placeholder="0001" />
                      </LabelField>
                      <LabelField label="Conta-Corrente">
                        <InputEmpresa value={empresa.banco_conta} onChange={v => setEmp('banco_conta', v)} placeholder="00000000-0" />
                      </LabelField>
                    </div>
                  )}

                  {/* Seção: Responsável */}
                  <SecaoHeader id="responsavel" titulo="Preposto / Responsável" icone={<UserCheck size={14} />} />
                  {abertaSecao === 'responsavel' && (
                    <div className="p-5 grid grid-cols-2 gap-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
                      <div className="col-span-2">
                        <LabelField label="Nome Completo *">
                          <InputEmpresa value={empresa.responsavel_nome} onChange={v => setEmp('responsavel_nome', v)} placeholder="João da Silva" />
                        </LabelField>
                      </div>
                      <LabelField label="CPF">
                        <InputEmpresa value={empresa.responsavel_cpf} onChange={v => setEmp('responsavel_cpf', v)} placeholder="000.000.000-00" />
                      </LabelField>
                      <LabelField label="RG">
                        <InputEmpresa value={empresa.responsavel_rg} onChange={v => setEmp('responsavel_rg', v)} placeholder="0.000.000-0" />
                      </LabelField>
                      <LabelField label="Cargo / Função">
                        <InputEmpresa value={empresa.responsavel_cargo} onChange={v => setEmp('responsavel_cargo', v)} placeholder="Administrador" />
                      </LabelField>
                      <LabelField label="Estado Civil">
                        <select value={empresa.responsavel_estado_civil} onChange={e => setEmp('responsavel_estado_civil', e.target.value)}
                          className="w-full px-3 py-2 border text-sm focus:outline-none"
                          style={{ background: 'var(--c-input-bg)', color: 'var(--c-input-text)', borderColor: 'var(--c-border-md)' }}>
                          <option value="">Selecione</option>
                          {['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'].map(ec => (
                            <option key={ec} value={ec}>{ec}</option>
                          ))}
                        </select>
                      </LabelField>
                      <LabelField label="Naturalidade (Cidade-UF)">
                        <InputEmpresa value={empresa.responsavel_naturalidade} onChange={v => setEmp('responsavel_naturalidade', v)} placeholder="São Paulo-SP" />
                      </LabelField>
                      <LabelField label="Nacionalidade">
                        <InputEmpresa value={empresa.responsavel_nacionalidade} onChange={v => setEmp('responsavel_nacionalidade', v)} placeholder="Brasileiro(a)" />
                      </LabelField>
                    </div>
                  )}

                  {/* Botão salvar empresa */}
                  <div className="p-5">
                    <button type="submit" disabled={salvandoEmpresa} onMouseEnter={() => playHover()}
                      className="w-full py-3 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-white"
                      style={{ background: sucessoEmpresa ? '#059669' : '#dc2626' }}>
                      {sucessoEmpresa
                        ? <><ShieldCheck size={15} /> Dados da Empresa Salvos!</>
                        : <><Save size={15} /> {salvandoEmpresa ? 'Salvando...' : 'Salvar Dados da Empresa'}</>}
                    </button>
                  </div>
                </div>
                )} {/* fim isDiretor */}
              </form>

              {/* GESTÃO DE AGENTES — exclusivo do Diretor */}
              {isDiretor && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(234,179,8,0.3)' }}>
                  <div className="px-5 py-4 flex items-center gap-2" style={{ background: 'rgba(234,179,8,0.06)', borderBottom: '1px solid rgba(234,179,8,0.2)' }}>
                    <Crown size={14} className="text-yellow-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-yellow-400">Gestão de Agentes</span>
                    <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--c-text-2)' }}>Apenas o Diretor pode atribuir cargos</span>
                  </div>

                  <div className="p-5 space-y-3" style={{ background: 'var(--c-card)' }}>
                    {agentes.length === 0 ? (
                      <div className="flex items-center gap-2 py-6 justify-center">
                        <Users size={16} className="text-zinc-700" />
                        <p className="text-xs font-mono" style={{ color: 'var(--c-text-3)' }}>Nenhum outro agente cadastrado ainda.</p>
                      </div>
                    ) : (
                      <>
                        {agentes.map(agente => (
                          <div key={agente.id} className="flex items-center gap-3 p-3 rounded" style={{ background: 'var(--c-card-hover)', border: '1px solid var(--c-border)' }}>
                            {/* Avatar colorido */}
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                              style={{ background: agente.cor || '#dc2626' }}>
                              {agente.nome?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate" style={{ color: 'var(--c-text-1)' }}>{agente.nome}</p>
                            </div>
                            {/* Seletor de cargo — só o Diretor vê isso */}
                            <select
                              value={cargosEditados[agente.id] ?? agente.cargo}
                              onChange={e => setCargosEditados(prev => ({ ...prev, [agente.id]: e.target.value }))}
                              onMouseEnter={() => playHover()}
                              className="px-2 py-1.5 border text-xs focus:outline-none cursor-pointer"
                              style={{ background: 'var(--c-input-bg)', color: 'var(--c-input-text)', borderColor: 'var(--c-border-md)', minWidth: '160px' }}>
                              {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        ))}

                        <button
                          type="button"
                          disabled={salvandoCargos}
                          onMouseEnter={() => playHover()}
                          onClick={handleSalvarCargos}
                          className="w-full py-3 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-white mt-2"
                          style={{ background: sucessoCargos ? '#059669' : 'rgba(234,179,8,0.8)' }}>
                          {sucessoCargos
                            ? <><ShieldCheck size={15} /> Cargos Atualizados!</>
                            : <><Save size={15} /> {salvandoCargos ? 'Salvando...' : 'Salvar Cargos'}</>}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
