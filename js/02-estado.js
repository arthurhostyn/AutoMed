/* ============================================================
   MÓDULO 2 — ESTADO GLOBAL DA APLICAÇÃO
   O que este arquivo faz: declara as variáveis que guardam, durante
   o uso do sistema, o texto extraído de cada PDF e os dados do
   paciente atualmente carregado. Como o projeto não usa um bundler
   (é aberto direto pelo navegador, inclusive via arquivo local),
   todos os arquivos de /js compartilham este mesmo escopo global —
   por isso essas variáveis são declaradas uma única vez, aqui.
   ============================================================ */

// --- Página LME (gerador de DIEx) ---
let textoPDF = "";              // texto do PDF de Agendamento
let textoPDFSolicitacao = "";   // texto do PDF do DIEx de Solicitação

// --- Página DOC (renomeador), modo "LME SCAN" ---
let textoConsultaDoc = "";      // texto do PDF de Marcação
let textoSolicitacaoDoc = "";   // texto do PDF de Solicitação

// --- Página DOC (renomeador), modo "COMISSÃO DE ÉTICA" ---
let textoComissaoEtica = "";    // texto do PDF do parecer da comissão

// Arquivo (objeto File) que efetivamente será baixado com novo nome.
let arquivoRenomear = null;

// --- Banco de Dados Local ---
let arquivoAgendamentoObj = null;      // File original de Agendamento (para salvar no banco)
let arquivoSolicitacaoObj = null;      // File original de Solicitação (para salvar no banco)
let dirHandleBanco = null;             // referência à pasta do banco escolhida pelo usuário
let dadosBancoCarregados = null;       // dados de um paciente já salvo, quando selecionado na busca
let mapaPacientesBanco = new Map();    // índice "identificador -> dados" de todos os pacientes salvos

// --- Página EXCEL ---
let textoPDFExcelAgendamento = "";
let textoPDFExcelSolicitacao = "";
