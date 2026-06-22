import Database from '@tauri-apps/plugin-sql';

let dbInstance: Database | null = null;

export async function getDB() {
  if (!dbInstance) {
    // Trocamos o nome para forçar o sistema a criar um banco zerado!
    dbInstance = await Database.load('sqlite:licitacoes_v2.db');
  }
  return dbInstance;
}

export async function iniciarBanco() {
  const db = await getDB();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS editais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      orgao TEXT NOT NULL,
      status TEXT DEFAULT 'Triagem',
      data_pregao TEXT,
      resumo TEXT
    );
  `);

  // TABELA DE ITENS ATUALIZADA (Novas colunas de Frete, Margem e Lance)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edital_id INTEGER,
      nome TEXT NOT NULL,
      quantidade INTEGER,
      preco_alvo REAL,
      melhor_cotacao REAL,
      fornecedor TEXT,
      link TEXT,
      frete REAL DEFAULT 0,
      margem_lucro REAL DEFAULT 30,
      lance_minimo REAL DEFAULT 0,
      FOREIGN KEY(edital_id) REFERENCES editais(id)
    );
  `);

  // NOVA TABELA: Cofre Pessoal
  await db.execute(`
    CREATE TABLE IF NOT EXISTS meus_documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      data_vencimento TEXT NOT NULL,
      link TEXT
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edital_id INTEGER,
      titulo TEXT NOT NULL,
      link TEXT NOT NULL,
      FOREIGN KEY(edital_id) REFERENCES editais(id)
    );
  `);

  console.log("Banco de dados inicializado com sucesso!");
}

// === FUNÇÕES DE EDITAL ===
export async function listarEditais() {
  const db = await getDB();
  return await db.select('SELECT * FROM editais ORDER BY id DESC');
}

export async function salvarEdital(numero: string, orgao: string, dataPregao: string) {
  const db = await getDB();
  await db.execute(
    'INSERT INTO editais (numero, orgao, data_pregao, status) VALUES ($1, $2, $3, $4)',
    [numero, orgao, dataPregao, 'Triagem']
  );
}

// NOVA Função de Excluir (Faxina Completa)
export async function excluirEdital(id: number) {
  const db = await getDB();
  // Limpa tudo que está amarrado ao Edital primeiro (Boas práticas de Banco Relacional)
  await db.execute('DELETE FROM itens WHERE edital_id = $1', [id]);
  try { await db.execute('DELETE FROM documentos WHERE edital_id = $1', [id]); } catch(e){}
  
  // Por fim, apaga a "pasta" principal
  await db.execute('DELETE FROM editais WHERE id = $1', [id]);
}


// === FUNÇÕES DE ITENS ===
export async function listarItens(editalId: number) {
  const db = await getDB();
  return await db.select('SELECT * FROM itens WHERE edital_id = $1 ORDER BY id DESC', [editalId]);
}

export async function salvarItem(editalId: number, nome: string, quantidade: number, precoAlvo: number) {
  const db = await getDB();
  await db.execute(
    'INSERT INTO itens (edital_id, nome, quantidade, preco_alvo, melhor_cotacao, fornecedor, link) VALUES ($1, $2, $3, $4, 0, $5, $6)',
    [editalId, nome, quantidade, precoAlvo, 'Pendente', '']
  );
}

// === NOVAS FUNÇÕES DE DOCUMENTOS ===
export async function listarDocumentos(editalId: number) {
  const db = await getDB();
  try {
    return await db.select('SELECT * FROM documentos WHERE edital_id = $1 ORDER BY id DESC', [editalId]);
  } catch(e) { return []; }
}

// === FUNÇÃO ATUALIZADA PARA SALVAR O LANCE MÍNIMO ===
export async function atualizarCotacaoItem(
  id: number, 
  melhorCotacao: number, 
  fornecedor: string, 
  link: string,
  frete: number,
  margemLucro: number,
  lanceMinimo: number
) {
  const db = await getDB();
  await db.execute(
    'UPDATE itens SET melhor_cotacao = $1, fornecedor = $2, link = $3, frete = $4, margem_lucro = $5, lance_minimo = $6 WHERE id = $7',
    [melhorCotacao, fornecedor, link, frete, margemLucro, lanceMinimo, id]
  );
}

export async function salvarDocumento(editalId: number, titulo: string, link: string) {
  const db = await getDB();
  await db.execute(
    'INSERT INTO documentos (edital_id, titulo, link) VALUES ($1, $2, $3)',
    [editalId, titulo, link]
  );
}

// === FUNÇÕES DO COFRE PESSOAL ===
export async function listarMeusDocumentos() {
  const db = await getDB();
  return await db.select('SELECT * FROM meus_documentos ORDER BY data_vencimento ASC');
}

export async function salvarMeuDocumento(nome: string, dataVencimento: string, link: string) {
  const db = await getDB();
  await db.execute(
    'INSERT INTO meus_documentos (nome, data_vencimento, link) VALUES ($1, $2, $3)',
    [nome, dataVencimento, link]
  );
}

export async function excluirMeuDocumento(id: number) {
  const db = await getDB();
  await db.execute('DELETE FROM meus_documentos WHERE id = $1', [id]);
}