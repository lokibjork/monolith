import { fetch } from '@tauri-apps/plugin-http';
import { supabase } from './supabase';

// ============================================================
// CONFIGURAÇÃO DO AUTO-SYNC
// ============================================================
const UF = 'SP';
const MUNICIPIO_IBGE = 3550308;   // São Paulo capital (código IBGE)
const MUNICIPIO_NOME = 'São Paulo'; // Validação no detalhe do edital
const MODALIDADE = 8;              // Dispensa Eletrônica
const JANELA_DIAS_FUTURO = 60;     // Busca propostas abertas até 60 dias à frente
const PALAVRAS_CHAVE = ['informática', 'informatica'];

// ============================================================
// UTILITÁRIOS
// ============================================================
function extrairMaiorArray(obj: any): any[] {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  if (typeof obj === 'object') {
    let maior: any[] = [];
    for (const key of Object.keys(obj)) {
      const r = extrairMaiorArray(obj[key]);
      if (r.length > maior.length) maior = r;
    }
    return maior;
  }
  return [];
}

function formatarData(isoDate: string): string {
  if (!isoDate) return 'Não informada';
  const m = isoDate.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return 'Não informada';
  return `${m[3]}/${m[2]}/${m[1]} - ${m[4]}:${m[5]}`;
}

function dataJaPassou(dataStr: string): boolean {
  if (!dataStr || dataStr === 'Não informada') return false;
  try {
    const m = dataStr.match(/(\d{2})\/(\d{2})\/(\d{4}).*?(\d{2}):(\d{2})/);
    if (!m) return false;
    const data = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
    return data.getTime() < Date.now();
  } catch {
    return false;
  }
}

function normalizar(texto: string): string {
  return (texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function temPalavraChave(texto: string): boolean {
  const t = normalizar(texto);
  return PALAVRAS_CHAVE.some(p => t.includes(normalizar(p)));
}



function dataISOParaYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================================
// LIMPEZA DE EDITAIS EXPIRADOS
// ============================================================
export async function limparEditaisExpirados(): Promise<number> {
  const { data } = await supabase
    .from('editais')
    .select('id, data_pregao, status')
    .neq('status', 'participando');

  if (!data || data.length === 0) return 0;

  const idsExpirados = data
    .filter(e => dataJaPassou(e.data_pregao))
    .map(e => e.id);

  if (idsExpirados.length === 0) return 0;

  await supabase.from('editais').delete().in('id', idsExpirados);
  return idsExpirados.length;
}

// ============================================================
// BUSCA DE EDITAIS (endpoint "proposta" = recebendo proposta agora)
// ============================================================
async function buscarPaginaEditais(dataInicial: string, dataFinal: string, pagina: number): Promise<any[]> {
  // /contratacoes/proposta = propostas abertas agora (status=recebendo_proposta)
  // codigoMunicipio filtra SP capital na API; palavra-chave é validada no cliente.
  const url =
    `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta` +
    `?dataInicial=${dataInicial}&dataFinal=${dataFinal}` +
    `&codigoModalidadeContratacao=${MODALIDADE}` +
    `&uf=${UF}` +
    `&codigoMunicipio=${MUNICIPIO_IBGE}` +
    `&pagina=${pagina}&tamanhoPagina=50`;

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) return [];

  const json = await res.json() as any;
  if (Array.isArray(json)) return json;
  if (json?.data && Array.isArray(json.data)) return json.data;
  return [];
}

// ============================================================
// IMPORTAÇÃO DE UM EDITAL ESPECÍFICO
// ============================================================
function extrairMunicipioNome(obj: any): string {
  // Percorre todos os caminhos conhecidos onde o PNCP pode guardar municipioNome
  const candidatos = [
    obj?.unidadeOrgao?.municipioNome,
    obj?.unidadeCompradora?.municipioNome,
    obj?.municipioNome,
    obj?.orgaoEntidade?.municipioNome,
    obj?.municipio?.nome,
    obj?.municipioEntrega?.nome,
    obj?.localEntrega?.municipio?.nome,
  ].filter(Boolean);
  return candidatos[0]?.trim() || '';
}

async function importarEdital(item: any, onStatus: (msg: string) => void): Promise<boolean> {
  const cnpj: string = item.orgaoEntidade?.cnpj || item.cnpjOrgao || '';
  const ano: string = String(item.anoCompra || item.ano || new Date().getFullYear());
  const seq: string = String(item.sequencialCompra || item.sequencial || '');

  if (!cnpj || !seq) return false;

  // Link oficial como chave de deduplicação primária (única por edital)
  const linkOficial = `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`;

  const { data: existente } = await supabase
    .from('editais')
    .select('id')
    .eq('link_oficial', linkOficial)
    .maybeSingle();

  if (existente) return false; // já existe, pula

  const orgaoNome = item.orgaoEntidade?.razaoSocial || 'Desconhecido';
  onStatus(`IMPORT // ${orgaoNome.slice(0, 45)}...`);

  // Detalhes completos (inclui município — segunda barreira de filtro)
  const urlEdital = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}`;
  const resEdital = await fetch(urlEdital, { method: 'GET' });
  if (!resEdital.ok) return false;
  const dataEdital = await resEdital.json() as any;

  // Valida município cruzando dados da listagem + detalhe em todos os caminhos conhecidos.
  // Aceita se qualquer campo diz "São Paulo". Rejeita só se encontra outra cidade explícita.
  const municipioDetalhe = extrairMunicipioNome(dataEdital);
  const municipioListagem = extrairMunicipioNome(item);
  const municipioEncontrado = municipioDetalhe || municipioListagem;

  if (municipioEncontrado && normalizar(municipioEncontrado) !== normalizar(MUNICIPIO_NOME)) {
    return false; // cidade explícita diferente de São Paulo — descarta
  }
  // Se municipioEncontrado estiver vazio, dá benefício da dúvida (entidades federais)

  // Itens (com paginação)
  let todosItens: any[] = [];
  let paginaItens = 1;
  while (true) {
    const urlItens = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens?pagina=${paginaItens}&tamanhoPagina=500`;
    const resItens = await fetch(urlItens, { method: 'GET' });
    if (!resItens.ok) break;
    const raw = await resItens.json();
    const itensPagina = extrairMaiorArray(raw);
    if (itensPagina.length === 0) break;
    todosItens = [...todosItens, ...itensPagina];
    if (itensPagina.length < 500) break;
    paginaItens++;
  }

  // Arquivos/documentos
  const urlArquivos = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`;
  const resArquivos = await fetch(urlArquivos, { method: 'GET' });
  const listaArquivos = resArquivos.ok ? extrairMaiorArray(await resArquivos.json()) : [];

  // Monta campos do edital
  const numero = dataEdital.numeroCompra || item.numeroCompra || `${seq}/${ano}`;
  const orgao = dataEdital.orgaoEntidade?.razaoSocial || orgaoNome;
  const dataPregao = formatarData(
    dataEdital.dataEncerramentoProposta ||
    dataEdital.dataAberturaProposta ||
    item.dataEncerramentoProposta ||
    item.dataAberturaProposta || ''
  );

  const { data: insertData, error } = await supabase
    .from('editais')
    .insert({ numero, orgao, data_pregao: dataPregao, uasg: cnpj, link_oficial: linkOficial, status: 'ativo' })
    .select();

  if (error || !insertData) return false;
  const idEdital = insertData[0].id;

  if (todosItens.length > 0) {
    const itensInsert = todosItens.map(i => ({
      edital_id: idEdital,
      nome: i.descricao || i.materialOuServicoNome || 'N/A',
      quantidade: i.quantidade || 1,
      preco_alvo: i.valorUnitarioEstimado || i.valorEstimado || 0,
    }));
    await supabase.from('itens').insert(itensInsert);
  }

  const docsInsert = listaArquivos
    .map((a: any) => ({
      edital_id: idEdital,
      titulo: a.titulo || a.nomeArquivo || 'Anexo',
      link: a.linkArquivo || a.url || '',
    }))
    .filter((d: any) => d.link !== '');

  if (docsInsert.length > 0) {
    await supabase.from('documentos').insert(docsInsert);
  }

  return true;
}

// ============================================================
// FUNÇÃO PRINCIPAL EXPORTADA
// ============================================================
export interface SyncResult {
  novos: number;
  removidos: number;
  erros: number;
}

export async function sincronizarPNCP(onStatus: (msg: string) => void): Promise<SyncResult> {
  const resultado: SyncResult = { novos: 0, removidos: 0, erros: 0 };

  // 1. Remove editais expirados (exceto os marcados como participando)
  onStatus('CLEANUP // Expurgando editais expirados...');
  resultado.removidos = await limparEditaisExpirados();

  // 2. Janela de busca: hoje até +JANELA_DIAS_FUTURO dias
  //    O endpoint /proposta filtra pelo encerramento da proposta,
  //    então buscamos propostas que fecham de hoje em diante.
  const hoje = new Date();
  const futuro = new Date();
  futuro.setDate(hoje.getDate() + JANELA_DIAS_FUTURO);

  const dataInicial = dataISOParaYYYYMMDD(hoje);
  const dataFinal = dataISOParaYYYYMMDD(futuro);

  onStatus(`SCAN // Varrendo propostas abertas em SP [até ${dataFinal}]...`);

  // 3. Percorre páginas
  let paginaAtual = 1;

  while (true) {
    const itens = await buscarPaginaEditais(dataInicial, dataFinal, paginaAtual);
    if (itens.length === 0) break;

    // Filtra por palavra-chave no objetoCompra — a API não faz busca semântica
    const candidatos = itens.filter(i =>
      temPalavraChave(i.objetoCompra || i.objeto || '')
    );

    onStatus(`FILTER // Página ${paginaAtual}: ${candidatos.length}/${itens.length} com "informática" no objeto`);

    for (const candidato of candidatos) {
      try {
        const importado = await importarEdital(candidato, onStatus);
        if (importado) resultado.novos++;
      } catch {
        resultado.erros++;
      }
    }

    if (itens.length < 50) break;
    paginaAtual++;
  }

  return resultado;
}
