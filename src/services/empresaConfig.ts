import { supabase } from './supabase';

export interface EmpresaConfig {
  id?: string;
  // Dados da empresa
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  ie: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  celular: string;
  email: string;
  // Dados bancários
  banco_nome: string;
  banco_codigo: string;
  banco_agencia: string;
  banco_conta: string;
  // Responsável / Preposto
  responsavel_nome: string;
  responsavel_cpf: string;
  responsavel_rg: string;
  responsavel_cargo: string;
  responsavel_naturalidade: string;
  responsavel_nacionalidade: string;
  responsavel_estado_civil: string;
  // Logo em base64 (opcional)
  logo_base64?: string;
}

export const CONFIG_VAZIO: EmpresaConfig = {
  nome_fantasia: '', razao_social: '', cnpj: '', ie: '',
  endereco: '', bairro: '', cidade: '', uf: '', cep: '',
  telefone: '', celular: '', email: '',
  banco_nome: '', banco_codigo: '', banco_agencia: '', banco_conta: '',
  responsavel_nome: '', responsavel_cpf: '', responsavel_rg: '',
  responsavel_cargo: 'Administrador',
  responsavel_naturalidade: '', responsavel_nacionalidade: 'Brasileiro',
  responsavel_estado_civil: '',
  logo_base64: '',
};

export async function buscarEmpresaConfig(): Promise<EmpresaConfig | null> {
  const { data } = await supabase
    .from('empresa_config')
    .select('*')
    .limit(1)
    .maybeSingle();
  return data as EmpresaConfig | null;
}

export async function salvarEmpresaConfig(config: EmpresaConfig): Promise<void> {
  if (config.id) {
    await supabase.from('empresa_config').update(config).eq('id', config.id);
  } else {
    await supabase.from('empresa_config').insert(config);
  }
}
