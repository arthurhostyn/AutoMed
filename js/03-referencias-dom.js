/* ============================================================
   MÓDULO 3 — REFERÊNCIAS AO DOM
   O que este arquivo faz: busca, uma única vez, os elementos HTML
   usados repetidamente pelo restante do sistema, e guarda cada um
   em uma constante. Evita chamar "document.getElementById" várias
   vezes para o mesmo elemento espalhado pelo código.

   IMPORTANTE: este arquivo precisa ser carregado depois que o HTML
   do <body> já existe (por isso todos os <script> ficam no fim do
   documento) e antes de qualquer outro módulo que use estas
   constantes no nível principal do arquivo (ex.: 09-dropzones.js).
   ============================================================ */

// --- Página LME: dropzones de Agendamento e Solicitação ---
const dropZone = document.getElementById("dropZone");
const pdfFile = document.getElementById("pdfFile");

const dropZoneSolicitacao = document.getElementById("dropZoneSolicitacao");
const pdfSolicitacao = document.getElementById("pdfSolicitacao");

// --- Página DOC: dropzones do modo "LME SCAN" ---
const dropZoneDocConsulta = document.getElementById("dropZoneDocConsulta");
const pdfConsultaDoc = document.getElementById("pdfConsultaDoc");

const dropZoneDocSolicitacao = document.getElementById("dropZoneDocSolicitacao");
const pdfSolicitacaoDoc = document.getElementById("pdfSolicitacaoDoc");

const dropZoneDocArquivo = document.getElementById("dropZoneDocArquivo");
const pdfRenomear = document.getElementById("pdfRenomear");

// --- Página DOC: dropzone do modo "COMISSÃO DE ÉTICA" ---
const dropZoneComissaoEtica = document.getElementById("dropZoneComissaoEtica");
const pdfComissaoEtica = document.getElementById("pdfComissaoEtica");

// --- Página DOC: alternância entre os dois modos acima ---
const tipoDocumentoSelect = document.getElementById("tipodocumento");
const blocoLmeScan = document.getElementById("blocoLmeScan");
const blocoComissaoEtica = document.getElementById("blocoComissaoEtica");
const painelExtraidosLmeScan = document.getElementById("painelExtraidosLmeScan");
const painelExtraidosComissao = document.getElementById("painelExtraidosComissao");

// --- Página LME: escolha do modelo de texto e pronome do paciente ---
const modeloSelect = document.getElementById("modeloSelect");
const pronomePaciente = document.getElementById("pronomePaciente");

// --- Página EXCEL: dropzones de Agendamento e Solicitação ---
const dropZoneExcelAgendamento = document.getElementById("dropZoneExcelAgendamento");
const pdfExcelAgendamento = document.getElementById("pdfExcelAgendamento");

const dropZoneExcelSolicitacao = document.getElementById("dropZoneExcelSolicitacao");
const pdfExcelSolicitacao = document.getElementById("pdfExcelSolicitacao");

// --- Página LME: select "Conferência / Laudo", usado só em alguns modelos ---
const tipoLaudoConferenciaSelect = document.getElementById("tipoLaudoConferenciaSelect");
