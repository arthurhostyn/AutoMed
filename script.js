/* ============================================================
   AUTOMED - LÓGICA DO SISTEMA (script.js)
   ------------------------------------------------------------
   ÍNDICE DE MÓDULOS:
    1. Mensagens flutuantes (toasts)
    2. Estado global da aplicação
    3. Referências ao DOM
    4. Base de conhecimento (dicionários fixos)
    5. Utilitários de texto
    6. Formatadores
    7. Extratores de dados do PDF
    8. Leitura de arquivos PDF
    9. Dropzones e botões de recolher
   10. Atualização dos painéis de dados extraídos
   11. Gerador de DIEx (página LME)
   12. Renomeador de documentos (página DOC)
   13. Navegação entre abas/páginas e menu do rodapé
   14. Banco de dados local, conexão e modais
   15. Pesquisa e cópia automática (página EXCEL)
   16. Revelação suave da página (anti-flicker)
   17. Atalhos de teclado
   18. Nova consulta (botão "LIMPAR" das dropzones, todas as páginas)
   19. Estatísticas do banco de dados
   20. Backup do banco de dados (exportar / importar)
   21. Rascunho automático do resultado gerado

   Este arquivo é carregado como um <script> comum (sem
   type="module") de propósito: assim o sistema continua
   funcionando ao abrir o AutoMed.html direto do disco (duplo
   clique), sem precisar de um servidor local — módulos ES são
   bloqueados pelo navegador nesse cenário.
   ============================================================ */

/* ============================================================
   MÓDULO 1 — MENSAGENS FLUTUANTES (TOASTS)
   O que este arquivo faz: mostra pequenas notificações no canto da
   tela (sucesso, erro ou aviso) que somem sozinhas depois de um
   tempo. É a primeira coisa carregada porque quase todos os outros
   módulos chamam "mostrarToast" para avisar o usuário de algo.
   ============================================================ */

/**
 * Mostra uma notificação flutuante (toast) no canto superior direito.
 * @param {string} mensagem - texto a exibir para o usuário.
 * @param {"sucesso"|"erro"|"aviso"} tipo - define cor e ícone do toast.
 */
function mostrarToast(mensagem, tipo = "aviso") {
    // Procura o container dos toasts; se ainda não existe, cria um só
    // (todos os toasts futuros reaproveitam o mesmo container).
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";

        // Atributos de acessibilidade: avisam leitores de tela que o
        // conteúdo desta região muda sozinho e deve ser anunciado.
        container.setAttribute("role", "status");
        container.setAttribute("aria-live", "polite");
        container.setAttribute("aria-atomic", "true");

        document.body.appendChild(container);
    }

    // Escolhe o ícone de acordo com o tipo da mensagem.
    let icone = "ℹ️";
    if (tipo === "sucesso") icone = "✅";
    if (tipo === "erro") icone = "❌";
    if (tipo === "aviso") icone = "⚠️";

    // Monta o toast criando elementos DOM diretamente (em vez de usar
    // innerHTML com a mensagem interpolada). Isso evita que um texto
    // com caracteres "<" ou ">" seja interpretado como HTML/script —
    // mesmo hoje todas as mensagens serem fixas no próprio código,
    // essa é a forma segura de montar conteúdo dinâmico no DOM.
    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;

    const spanIcone = document.createElement("span");
    spanIcone.className = "toast-icone";
    spanIcone.textContent = icone;

    const spanTexto = document.createElement("span");
    spanTexto.className = "toast-texto";
    spanTexto.textContent = mensagem;   // textContent nunca interpreta HTML

    // FUNCIONALIDADE NOVA: botão "×" para o usuário dispensar o toast
    // manualmente, sem precisar esperar os 3.5s automáticos.
    const btnFechar = document.createElement("button");
    btnFechar.type = "button";
    btnFechar.className = "toast-fechar";
    btnFechar.setAttribute("aria-label", "Fechar aviso");
    btnFechar.textContent = "×";
    btnFechar.addEventListener("click", () => {
        toast.classList.remove("visivel");
        toast.addEventListener("transitionend", () => toast.remove());
    });

    toast.appendChild(spanIcone);
    toast.appendChild(spanTexto);
    toast.appendChild(btnFechar);
    container.appendChild(toast);

    // Espera o próximo frame de render para então adicionar a classe
    // "visivel" — é o que dispara a transição de entrada em CSS.
    requestAnimationFrame(() => {
        toast.classList.add("visivel");
    });

    // Depois de 3.5s, inicia a saída e remove o elemento quando a
    // transição de CSS terminar.
    setTimeout(() => {
        toast.classList.remove("visivel");
        toast.addEventListener("transitionend", () => {
            toast.remove();
        });
    }, 3500);
}
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
/* ============================================================
   MÓDULO 3 — REFERÊNCIAS AO DOM
   O que este arquivo faz: busca, uma única vez, os elementos HTML
   usados repetidamente pelo restante do sistema, e guarda cada um
   em uma constante. Evita chamar "document.getElementById" várias
   vezes para o mesmo elemento espalhado pelo código.

   IMPORTANTE: este arquivo precisa ser carregado depois que o HTML
   do <body> já existe (por isso todos os <script> ficam no fim do
   documento) e antes de qualquer outro módulo que use estas
   constantes no nível principal do arquivo (ex.: MÓDULO 9, mais abaixo).
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
/* ============================================================
   MÓDULO 4 — BASE DE CONHECIMENTO (dicionários fixos)
   O que este arquivo faz: guarda as listas e "de-para" usados para
   traduzir textos crus do PDF em nomes padronizados: médicos
   conhecidos, postos militares, organizações militares (OM) e suas
   abreviações, cargos e especialidades médicas.

   Estas tabelas não têm lógica — são apenas dados. Para adicionar um
   novo médico, OM ou especialidade, basta incluir uma nova linha no
   dicionário correspondente, sem precisar mexer em nenhuma função.
   ============================================================ */

// "Texto como aparece no PDF" -> "Como deve aparecer no documento gerado".
const medicosConhecidos = {
    "TENEVERTON": "Ten EVERTON",
    "MAJFRANCISCOBRAGA": "Maj FRANCISCO BRAGA",
    "MAJMONICAPOFFO": "Maj MONICA POFFO",
    "TENTATIANEPINTO": "Ten TATIANE PINTO",
    "CONFPSIQUIATRIA": "Conferência Psiquiatrica",
    "TENFRANCISCOSOUZA": "Ten FRANCISCO SOUZA",
    "CONFTRAUMATOLOGIA": "Conferência Traumatológica"
};

// Prefixo do posto/graduação (como vem no PDF, maiúsculo) -> abreviação padrão.
const postosMilitares = {
    "TEN": "Ten",
    "CAP": "Cap",
    "MAJ": "Maj",
    "TC": "Ten Cel",
    "CEL": "Cel",
    "GEN": "Gen",
    "ST": "Sub Ten",
    "SGT": "Sgt"
};

// Nome completo da Organização Militar -> sigla abreviada usada nos documentos.
const omsConhecidas = {
    "Comando Militar do Sul": "CMS",
    "Companhia de Comando do Comando Militar do Sul": "Cia C CMS",
    "3º Regimento de Cavalaria de Guarda": "3º RCG",
    "3º Batalhão de Comunicações e Guerra Eletrônica": "3º B Com GE",
    "3º Batalhão de Polícia do Exército": "3º BPE",
    "1ª Companhia de Inteligência": "1ª Cia Intlg",
    "8ª Brigada de Infantaria Motorizada": "8ª Bda Inf Mtz",
    "Companhia de Comando da 8ª Brigada de Infantaria Motorizada": "Cia C 8ª Bda Inf Mtz",
    "9º Batalhão de Infantaria Motorizado": "9º BI Mtz",
    "18º Batalhão de Infantaria Motorizado": "18º BI Mtz",
    "19º Batalhão de Infantaria Motorizado": "19º BI Mtz",
    "6º Grupo de Artilharia de Campanha": "6º GAC",
    "6º Batalhão de Comunicações": "6º B Com",
    "8º Batalhão Logístico": "8º B Log",
    "8º Esquadrão de Cavalaria Mecanizado": "8º Esqd C Mec",
    "8º Pelotão de Polícia do Exército": "8º Pel PE",
    "Comando de Artilharia do Exército": "Cmdo A Ex",
    "Bateria de Comando do Comando de Artilharia do Exército": "Bia C Cmdo A Ex",
    "13º Grupo de Artilharia de Campanha": "13º GAC",
    "16º Grupo de Artilharia de Campanha Autopropulsado": "16º GAC AP",
    "4º Grupamento de Engenharia": "4º Gpt E",
    "Companhia de Comando do 4º Grupamento de Engenharia": "Cia C 4º Gpt E",
    "1º Batalhão Ferroviário": "1º B Fv",
    "3º Batalhão de Engenharia de Combate": "3º BE Cmb",
    "6º Batalhão de Engenharia de Combate": "6º BE Cmb",
    "3ª Região Militar": "3ª RM",
    "Base de Administração e Apoio da 3ª Região Militar": "B Adm Ap/ 3ª RM",
    "1ª Companhia de Guardas": "1ª Cia Gda",
    "Hospital Militar de Área de Porto Alegre": "HMAPA",
    "Policlínica Militar de Porto Alegre": "PM Porto Alegre",
    "Hospital da Guarnição de Alegrete": "HGuAl",
    "Hospital da Guarnição de Bagé": "HGuB",
    "Hospital da Guarnição de Santa Maria": "HGuSM",
    "Hospital da Guarnição de Santiago": "HGuStg",
    "8ª Circunscrição de Serviço Militar": "8ª CSM",
    "10ª Circunscrição de Serviço Militar": "10ª CSM",
    "3º Grupamento Logístico": "3º Gpt Log",
    "Companhia de Comando do 3º Grupamento Logístico": "Cia C 3º Gpt Log",
    "3º Batalhão de Suprimento": "3º B Sup",
    "Parque Regional de Manutenção da 3ª Região Militar": "PqRMnt/3",
    "Depósito de Subsistência de Santa Maria": "D Sub Santa Maria",
    "Depósito de Subsistência de Santo Ângelo": "D Sub Santo Ângelo",
    "13ª Companhia Depósito de Armamento e Munição": "13ª Cia Dep A Mu",
    "3ª Divisão de Exército": "3ª DE",
    "Companhia de Comando da 3ª Divisão de Exército": "Cia C 3ª DE",
    "1º Batalhão de Comunicações": "1º B Com",
    "Artilharia Divisionária da 3ª Divisão de Exército": "AD/3",
    "Bateria de Comando da Artilharia Divisionária da 3ª DE": "Bia C AD/3",
    "27º Grupo de Artilharia de Campanha": "27º GAC",
    "29º Grupo de Artilharia de Campanha Autopropulsado": "29º GAC AP",
    "1ª Brigada de Cavalaria Mecanizada": "1ª Bda C Mec",
    "Esquadrão de Comando da 1ª Brigada de Cavalaria Mecanizada": "Esqd C 1ª Bda C Mec",
    "1º Regimento de Cavalaria Mecanizado": "1º RC Mec",
    "2º Regimento de Cavalaria Mecanizado": "2º RC Mec",
    "4º Regimento de Cavalaria Blindado": "4º RCB",
    "19º Regimento de Cavalaria Mecanizado": "19º RC Mec",
    "19º Grupo de Artilharia de Campanha": "19º GAC",
    "9º Batalhão Logístico": "9º B Log",
    "1ª Companhia de Engenharia de Combate Mecanizada": "1ª Cia E Cmb Mec",
    "11ª Companhia de Comunicações Mecanizada": "11ª Cia Com Mec",
    "1º Pelotão de Polícia do Exército": "1º Pel PE",
    "2ª Brigada de Cavalaria Mecanizada": "2ª Bda C Mec",
    "Esquadrão de Comando da 2ª Brigada de Cavalaria Mecanizada": "Esqd C 2ª Bda C Mec",
    "5º Regimento de Cavalaria Mecanizado": "5º RC Mec",
    "6º Regimento de Cavalaria Blindado": "6º RCB",
    "8º Regimento de Cavalaria Mecanizado": "8º RC Mec",
    "22º Grupo de Artilharia de Campanha": "22º GAC",
    "10º Batalhão Logístico": "10º B Log",
    "2ª Companhia de Engenharia de Combate Mecanizada": "2ª Cia E Cmb Mec",
    "12ª Companhia de Comunicações": "12ª Cia Com",
    "2º Pelotão de Polícia do Exército": "2º Pel PE",
    "3ª Brigada de Cavalaria Mecanizada": "3ª Bda C Mec",
    "Esquadrão de Comando da 3ª Brigada de Cavalaria Mecanizada": "Esqd C 3ª Bda C Mec",
    "3º Regimento de Cavalaria Mecanizado": "3º RC Mec",
    "7º Regimento de Cavalaria Mecanizado": "7º RC Mec",
    "9º Regimento de Cavalaria Blindado": "9º RCB",
    "12º Regimento de Cavalaria Mecanizado": "12º RC Mec",
    "25º Grupo de Artilharia de Campanha": "25º GAC",
    "3º Batalhão Logístico": "3º B Log",
    "2ª Bateria de Artilharia Antiaérea": "2ª Bia AAAe",
    "3ª Companhia de Engenharia de Combate Mecanizada": "3ª Cia E Cmb Mec",
    "13ª Companhia de Comunicações Mecanizada": "13ª Cia Com Mec",
    "3º Pelotão de Polícia do Exército": "3º Pel PE",
    "6ª Brigada de Infantaria Blindada": "6ª Bda Inf Bld",
    "Companhia de Comando da 6ª Brigada de Infantaria Blindada": "Cia C 6ª Bda Inf Bld",
    "1º Regimento de Carros de Combate": "1º RCC",
    "4º Regimento de Carros de Combate": "4º RCC",
    "7º Batalhão de Infantaria Blindado": "7º BIB",
    "29º Batalhão de Infantaria Blindado": "29º BIB",
    "3º Grupo de Artilharia de Campanha Autopropulsado": "3º GAC AP",
    "12º Batalhão de Engenharia de Combate Blindado": "12º BE Cmb Bld",
    "4º Batalhão Logístico": "4º B Log",
    "6º Esquadrão de Cavalaria Mecanizado": "6º Esqd C Mec",
    "6ª Bateria de Artilharia Antiaérea": "6ª Bia AAAe",
    "3ª Companhia de Comunicações Blindada": "3ª Cia Com Bld",
    "26º Pelotão de Polícia do Exército": "26º Pel PE",
    "5ª Região Militar": "5ª RM",
    "Base de Administração e Apoio da 5ª Região Militar": "B Adm Ap/ 5ª RM",
    "Parque Regional de Manutenção da 5ª Região Militar": "PqRMnt/5",
    "5º Batalhão de Suprimento": "5º B Sup",
    "5ª Companhia de Polícia do Exército": "5ª Cia PE",
    "Hospital Geral de Curitiba": "HGeC",
    "Hospital da Guarnição de Florianópolis": "HGuFlo",
    "15ª Circunscrição de Serviço Militar": "15ª CSM",
    "16ª Circunscrição de Serviço Militar": "16ª CSM",
    "5ª Divisão de Exército": "5ª DE",
    "Companhia de Comando da 5ª Divisão de Exército": "Cia C 5ª DE",
    "14º Regimento de Cavalaria Mecanizado": "14º RC Mec",
    "27º Batalhão Logístico": "27º B Log",
    "Artilharia Divisionária da 5ª Divisão de Exército": "AD/5",
    "Bateria de Comando da Artilharia Divisionária da 5ª DE": "Bia C AD/5",
    "15º Grupo de Artilharia de Campanha Autopropulsado": "15º GAC AP",
    "5ª Brigada de Cavalaria Blindada": "5ª Bda C Bld",
    "Esquadrão de Comando da 5ª Brigada de Cavalaria Blindada": "Esqd C 5ª Bda C Bld",
    "3º Regimento de Carros de Combate": "3º RCC",
    "5º Regimento de Carros de Combate": "5º RCC",
    "13º Batalhão de Infantaria Blindado": "13º BIB",
    "20º Batalhão de Infantaria Blindado": "20º BIB",
    "5º Grupo de Artilharia de Campanha Autopropulsado": "5º GAC AP",
    "5º Batalhão de Engenharia de Combate Blindado": "5º BE Cmb Bld",
    "5º Batalhão Logístico": "5º B Log",
    "5º Esquadrão de Cavalaria Mecanizado": "5º Esqd C Mec",
    "5ª Companhia de Comunicações Blindada": "5ª Cia Com Bld",
    "25º Pelotão de Polícia do Exército": "25º Pel PE",
    "14ª Brigada de Infantaria Motorizada": "14ª Bda Inf Mtz",
    "Companhia de Comando da 14ª Brigada de Infantaria Motorizada": "Cia C 14ª Bda Inf Mtz",
    "23º Batalhão de Infantaria": "23º BI",
    "62º Batalhão de Infantaria": "62º BI",
    "63º Batalhão de Infantaria": "63º BI",
    "28º Grupo de Artilharia de Campanha": "28º GAC",
    "14º Pelotão de Polícia do Exército": "14º Pel PE",
    "15ª Brigada de Infantaria Mecanizada": "15ª Bda Inf Mec",
    "Companhia de Comando da 15ª Brigada de Infantaria Mecanizada": "Cia C 15ª Bda Inf Mec",
    "30º Batalhão de Infantaria Mecanizado": "30º BI Mec",
    "33º Batalhão de Infantaria Mecanizado": "33º BI Mec",
    "34º Batalhão de Infantaria Mecanizado": "34º BI Mec",
    "26º Grupo de Artilharia de Campanha": "26º GAC",
    "15º Batalhão Logístico": "15º B Log",
    "15ª Companhia de Infantaria Motorizada": "15ª Cia Inf Mtz",
    "16º Esquadrão de Cavalaria Mecanizado": "16º Esqd C Mec",
    "15ª Companhia de Engenharia de Combate Mecanizada": "15ª Cia E Cmb Mec",
    "15ª Companhia de Comunicações Mecanizada": "15ª Cia Com Mec"
};

// Trecho do cargo (como aparece no PDF) -> categoria usada para decidir
// pronome ("esse"/"essa") e tratamento ("Comandante"/"Chefe").
const cargosConhecidos = {
    "COMANDANTE": "Comando",
    "SUBCOMANDANTE": "Comando",
    "CHEFE": "Chefia",
    "Chefe ao Escalão": "Grande Comando",
    "DIRETOR": "Comando",
    "SUBDIRETOR": "Comando",
    "SUBDIRETOR(A)": "Comando"
};

// Lista de especialidades médicas reconhecidas pelo sistema.
const especialidadesConhecidas = [
    "NEUROCIRURGIA",
    "NEUROLOGIA",
    "TRAUMATOLOGIA",
    "PSIQUIATRIA",
    "VASCULAR",
    "HEMATOLOGIA",
    "UROLOGIA",
    "MASTOLOGIA",
    "ENDOCRINOLOGIA",
    "ONCOLOGIA",
    "PNEUMOLOGIA",
    "CIRURGIÃO GERAL",
    "CIRURGIA DE MÃO",
    "CIRURGIA BUCO-MAXILO-FACIAL"
];

// Número do mês (com e sem zero à esquerda) -> abreviação em português.
const mesesAbreviados = {
    "01": "JAN", "02": "FEV", "03": "MAR", "04": "ABR", "05": "MAIO", "06": "JUN",
    "07": "JUL", "08": "AGO", "09": "SET", "10": "OUT", "11": "NOV", "12": "DEZ",
    "1": "JAN", "2": "FEV", "3": "MAR", "4": "ABR", "5": "MAIO", "6": "JUN",
    "7": "JUL", "8": "AGO", "9": "SET"
};
/* ============================================================
   MÓDULO 5 — UTILITÁRIOS DE TEXTO
   O que este arquivo faz: funções pequenas e genéricas de limpeza de
   texto, reaproveitadas por vários formatadores e extratores.
   ============================================================ */

/**
 * Limpa espaços/quebras de linha e normaliza a pontuação de um texto
 * extraído do PDF (o PDF costuma vir com espaços e quebras de linha
 * bagunçados).
 */
function normalizarTexto(texto) {
    if (!texto) return "";
    return texto
        .replace(/[\r\n]+/g, " ")     // quebras de linha viram espaço
        .replace(/\s{2,}/g, " ")      // vários espaços seguidos viram um só
        .replace(/\s+,/g, ",")        // remove espaço antes de vírgula
        .replace(/,\s*/g, ", ")       // garante um espaço depois da vírgula
        .replace(/,+/g, ",")          // remove vírgulas duplicadas
        .replace(/,\s*,/g, ", ")      // remove vírgula duplicada com espaço no meio
        .replace(/\s+([.;:])/g, "$1") // remove espaço antes de . ; :
        .replace(/\s{2,}/g, " ")      // reforça a limpeza de espaços duplos
        .trim();                       // remove espaços nas pontas
}

/**
 * Deixa cada palavra com a primeira letra maiúscula
 * (ex.: "SALA DE ESPERA" -> "Sala De Espera").
 */
function capitalizarPalavras(texto) {
    return texto
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
}

/**
 * Padroniza números de sala/local para o formato "nºX"
 * (ex.: "Sala N° 12" -> "Sala nº12", "Sala 12" -> "Sala nº12").
 */
function adicionarNumeroLocal(texto) {
    return texto
        .replace(/\bN[º°]\s*(\d+)/gi, "nº$1")          // já tem "Nº"/"N°": padroniza formato
        .replace(/(?<!nº)\b(\d+)\b/gi, "nº$1");        // número solto (sem "nº" antes): adiciona o prefixo
}
/* ============================================================
   MÓDULO 6 — FORMATADORES
   O que este arquivo faz: transforma os dados crus (já extraídos do
   PDF) no formato final que aparece nos documentos: nome do médico
   com posto abreviado, sigla da OM, especialidade, datas e local.
   ============================================================ */

/**
 * Formata o nome do médico: primeiro tenta um "de-para" exato
 * (medicosConhecidos); senão, identifica o posto militar no início
 * do nome e abrevia; por último, cai para "Primeira Letra Maiúscula".
 */
function formatarMedico(nome) {
    if (!nome) return "";
    nome = nome.toUpperCase().trim();

    // 1) Nome exato já cadastrado na base de conhecimento.
    if (medicosConhecidos[nome]) {
        return medicosConhecidos[nome];
    }

    // 2) O nome começa com um posto militar conhecido (ex.: "MAJ...")?
    for (let posto in postosMilitares) {
        if (nome.startsWith(posto)) {
            const restante = nome.substring(posto.length).trim();
            return `${postosMilitares[posto]} ${restante}`;
        }
    }

    // 3) Nenhum caso especial: apenas capitaliza cada palavra.
    return nome
        .toLowerCase()
        .replace(/\b\w/g, letra => letra.toUpperCase());
}

/** Devolve a sigla da OM se ela estiver cadastrada; senão, devolve o nome original. */
function abreviarOM(om) {
    if (!om) return "";
    return omsConhecidas[om] || om;
}

/** Procura, no texto, qual especialidade conhecida está presente e a devolve capitalizada. */
function formatarEspecialidade(texto) {
    texto = texto.toUpperCase();
    for (let esp of especialidadesConhecidas) {
        if (texto.includes(esp)) {
            return esp
                .toLowerCase()
                .replace(/\b\w/g, letra => letra.toUpperCase());
        }
    }
    return "";
}

/** Mesma busca de formatarEspecialidade, mas devolve o texto em maiúsculas "cru" (usado na planilha Excel). */
function extrairEspecialidadeCrua(texto) {
    if (!texto) return "";
    const textoUpper = texto.toUpperCase();
    for (let esp of especialidadesConhecidas) {
        if (textoUpper.includes(esp)) {
            return esp;
        }
    }
    return "";
}

/** Converte "dd/mm/aaaa" para "dd/mm/aa" (ano com 2 dígitos). */
function formatarData(data) {
    if (!data) return "";
    const partes = data.split("/");
    if (partes.length !== 3) return data;   // formato inesperado: devolve como veio
    const dia = partes[0];
    const mes = partes[1];
    const ano = partes[2].slice(-2);
    return `${dia}/${mes}/${ano}`;
}

/** Converte "dd/mm/aaaa" para o formato militar "d MES aa" (ex.: "5 JUN 26"). */
function formatarDataAbreviada(data) {
    if (!data) return "";
    const partes = data.split("/");
    return `${parseInt(partes[0])} ${mesesAbreviados[partes[1]]} ${partes[2].slice(-2)}`;
}

// Os dois formatadores abaixo usam a mesma regra de formatarDataAbreviada,
// mas recebem nomes próprios para deixar claro, em cada ponto do código,
// COM QUE FINALIDADE a data está sendo formatada (texto do documento
// militar vs. nome do arquivo gerado). Se um dia essas duas regras
// precisarem divergir, já existe um lugar certo para alterar cada uma
// sem afetar a outra.
function formatarDataMilitar(data) {
    return formatarDataAbreviada(data);
}

function formatarDataNomeArquivo(data) {
    return formatarDataAbreviada(data);
}

/** Limpa e padroniza o texto do local de atendimento (remove lixo, adiciona "nºX", etc.). */
function formatarLocal(local) {
    if (!local) return "";
    local = local
        .replace(/Usuário Marcação.*$/i, "")   // remove tudo a partir de "Usuário Marcação"
        .replace(/\s*-\s*/g, ", ");             // troca hífen separador por vírgula

    // Se começar com "Nº Andar", separa o andar do resto com vírgula.
    if (/^(\d+º?\s*Andar)/i.test(local)) {
        local = local.replace(/^(\d+º?\s*Andar)\s*(.*)$/i, "$1, $2");
    }

    return normalizarTexto(local);
}

/** Devolve o dia da semana (por extenso, em português) de uma data "dd/mm/aaaa". */
function diaSemana(data) {
    if (!data) return "";
    const partes = data.split("/");
    const d = new Date(
        parseInt(partes[2]),
        parseInt(partes[1]) - 1,   // mês em JS começa em 0 (Janeiro = 0)
        parseInt(partes[0])
    );
    const dias = [
        "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
        "Quinta-feira", "Sexta-feira", "Sábado"
    ];
    return dias[d.getDay()];
}
/* ============================================================
   MÓDULO 7 — EXTRATORES DE DADOS DO PDF
   O que este arquivo faz: usa expressões regulares (regex) para
   localizar, dentro do texto bruto de cada PDF, os campos que
   interessam (paciente, médico, data, local, OM, etc.) e devolve
   tudo já organizado em um único objeto de dados.
   ============================================================ */

/** Aplica um regex ao texto e devolve o primeiro grupo capturado, já normalizado (ou "" se não achar). */
function extrair(texto, regex) {
    const match = texto.match(regex);
    if (!match) return "";
    return normalizarTexto(match[1]);
}

/** Extrai o nome completo da OM que está solicitando o exame, a partir do PDF de Solicitação. */
function extrairOMSolicitante(textoSolicitacao) {
    const match = textoSolicitacao.match(
        /(?:Do|Da|Ao)\s+(?:\S*comandante|Chefe|diretor)\s+(?:do|da|ao)\s+(.*?)\s+(?:Ao|À)/i
    );
    if (!match) return "";
    return normalizarTexto(match[1]);
}

/** Identifica se a OM solicitante é do tipo "Comando" ou "Chefia", com base no cargo mencionado no texto. */
function extrairTipoOM(textoSolicitacao) {
    const match = textoSolicitacao.match(/Do\s+(.*?)\s+Ao/i);
    if (!match) return "Comando";   // não achou o cargo: usa "Comando" como padrão seguro

    const cargo = normalizarTexto(match[1]).toUpperCase();
    for (const chave in cargosConhecidos) {
        if (cargo.includes(chave.toUpperCase())) {
            return cargosConhecidos[chave];
        }
    }
    return "Comando";
}

/**
 * Extrai TODOS os dados de um agendamento a partir do texto do PDF de
 * Marcação (obrigatório) e, opcionalmente, do texto do PDF de
 * Solicitação (usado para OM, tipo de OM, número e data do DIEx).
 * Devolve um objeto com todos os campos já formatados, ou null se o
 * texto principal estiver vazio.
 */
function extrairDadosCompletos(texto, textoSolicitacao) {
    if (!texto) return null;

    // --- Paciente: tenta o padrão principal e, se não achar, um padrão alternativo ---
    let paciente = normalizarTexto(
        extrair(texto, /Paciente:\s*\d+\s*-\s*(.*?)\s*Médico\(a\)\/Profissional:/i)
    ).replace(/\s{2,}/g, " ").trim();

    if (!paciente) {
        paciente = normalizarTexto(
            extrair(texto, /Especialidade:\s*([A-ZÀ-Ú\s]+?)\s*Agendamento:/i)
        );
    }

    // --- Médico: idem, com um padrão alternativo de fallback ---
    let medico = normalizarTexto(
        extrair(texto, /Médico\(a\)\/Profissional:\s*([A-ZÀ-Ú]+)/i)
    );

    if (!medico) {
        const match = texto.match(
            /Usuário Marcação:\s*[A-ZÀ-Ú]+\s*([A-ZÀ-Ú]+)\s*Médico\/Prof\.:/i
        );
        if (match) medico = normalizarTexto(match[1]);
    }

    // --- Data e hora da consulta ---
    let dataHora = extrair(
        texto, /Dia da Consulta:\s*([0-9\/]{10}\s*-\s*[0-9:]{5})/i
    );

    if (!dataHora) {
        const dataTmp = extrair(texto, /Agendamento:\s*([0-9\/]{10})/i);
        const horaTmp = extrair(texto, /([0-9]{2}:[0-9]{2})/i);

        if (dataTmp && horaTmp) {
            dataHora = `${dataTmp} - ${horaTmp}`;
        }
    }

    let data = "";
    let horario = "";

    if (dataHora) {
        const partes = dataHora.split("-");
        data = partes[0].trim();
        horario = partes[1].trim();
    }

    // --- Local do atendimento: padrão principal e um alternativo ---
    let local = extrair(
        texto, /Local da Consulta:\s*(.*?)Usuário da Marcação/i
    );

    if (local) {
        const match = local.match(/(.*?)\s*-\s*(.*)/i);
        if (match) {
            const bloco1 = capitalizarPalavras(match[1]);
            const bloco2 = adicionarNumeroLocal(capitalizarPalavras(match[2]));
            local = `${bloco1}, ${bloco2}`;
        }
    }

    if (!local) {
        const match = texto.match(
            /(?:manh[aã]|tarde)\s+(.*?)\s+Local\s+Consulta:\s*(.*?)\s*Usuário\s+Marcação:/i
        );
        if (match) {
            const bloco1 = capitalizarPalavras(match[1]);
            const bloco2 = adicionarNumeroLocal(capitalizarPalavras(match[2]));
            local = `${bloco1}, ${bloco2}`;
        }
    }

    // --- Número do DIEx de solicitação (se o PDF de solicitação foi anexado) ---
    let numeroDIEx = "";
    if (textoSolicitacao) {
        const matchNum = textoSolicitacao.match(/DIEx\s*n[º°]?\s*(\d+)/i);
        if (matchNum) {
            numeroDIEx = matchNum[1];
        }
    }

    // --- Data do DIEx de solicitação: tenta 4 formatos diferentes, em ordem de prioridade ---
    let dataDIEx = "";
    if (textoSolicitacao) {
        const mesesNum = {
            "janeiro": "01", "fevereiro": "02", "março": "03", "marco": "03", "abril": "04",
            "maio": "05", "junho": "06", "julho": "07", "agosto": "08", "setembro": "09",
            "outubro": "10", "novembro": "11", "dezembro": "12",
            "jan": "01", "fev": "02", "mar": "03", "abr": "04", "mai": "05", "jun": "06",
            "jul": "07", "ago": "08", "set": "09", "out": "10", "nov": "11", "dez": "12"
        };

        const matchDataExtenso = textoSolicitacao.match(/(\d{1,2})\s+de\s+([a-zA-ZçÇ]+)\s+de\s+(\d{2,4})/i);
        const matchDataMilitar = textoSolicitacao.match(/de\s+(\d{1,2})\s+([A-Z]{3})\s+(\d{2,4})/i);
        const matchDataAssinatura = textoSolicitacao.match(/em\s+(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*às/i);

        if (matchDataExtenso) {
            // Ex.: "5 de junho de 2026"
            const dia = matchDataExtenso[1].padStart(2, '0');
            const mesNome = matchDataExtenso[2].toLowerCase();
            const ano = matchDataExtenso[3].length === 2 ? `20${matchDataExtenso[3]}` : matchDataExtenso[3];
            const mes = mesesNum[mesNome] || "01";
            dataDIEx = `${dia}/${mes}/${ano}`;
        } else if (matchDataMilitar) {
            // Ex.: "de 5 JUN 26"
            const dia = matchDataMilitar[1].padStart(2, '0');
            const mesNome = matchDataMilitar[2].toLowerCase();
            const ano = matchDataMilitar[3].length === 2 ? `20${matchDataMilitar[3]}` : matchDataMilitar[3];
            const mes = mesesNum[mesNome] || "01";
            dataDIEx = `${dia}/${mes}/${ano}`;
        } else if (matchDataAssinatura) {
            // Ex.: "...em 05/06/2026, às..."
            dataDIEx = formatarData(matchDataAssinatura[1]);
        } else {
            // Último recurso: qualquer data solta no texto que não seja a data de nascimento.
            const matchDataSeparador = textoSolicitacao.match(/(?<!Nascimento:\s*)\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/i);
            if (matchDataSeparador) {
                dataDIEx = formatarData(matchDataSeparador[1]);
            }
        }
    }

    // --- Campos derivados (calculados a partir dos anteriores) ---
    const especialidade = formatarEspecialidade(texto);
    const especialidadeCrua = extrairEspecialidadeCrua(texto);

    const om = extrairOMSolicitante(textoSolicitacao);
    const omAbr = abreviarOM(om);
    const tipoOM = extrairTipoOM(textoSolicitacao);

    const cargoOM = tipoOM === "Comando" ? "Comandante" : "Chefe";
    const pronome = tipoOM === "Comando" ? "esse" : "essa";

    const dataMilitar = formatarDataMilitar(data);
    const dataNomeArquivo = formatarDataNomeArquivo(data);

    return {
        paciente, medico, dataHora, data, horario, local, especialidade, especialidadeCrua,
        om, omAbr, tipoOM, cargoOM, pronome, dataMilitar, dataNomeArquivo,
        numeroDIEx, dataDIEx
    };
}

/**
 * Extrai os dados específicos de um parecer da Comissão de Ética
 * (sessão, paciente e data), usados na página DOC/Renomeador.
 */
function extrairDadosComissaoEtica(texto) {
    if (!texto) return null;

    const textoNormalizado = normalizarTexto(texto);

    const matchSessao = textoNormalizado.match(
        /Sess[ãa]o[s]?:?\s*(\d{1,3}\s*\/\s*\d{4})/i
    );
    const sessao = matchSessao ? matchSessao[1].replace(/\s+/g, "") : "";

    const matchPaciente = textoNormalizado.match(
        /Paciente:?\s*(.*?)\s*Solicitante/i
    );
    const paciente = matchPaciente ? matchPaciente[1].toUpperCase() : "";

    const matchData = textoNormalizado.match(
        /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/
    );
    const data = matchData ? matchData[1] : "";
    const dataFormatada = data ? formatarDataAbreviada(data) : "";

    return { sessao, paciente, data, dataFormatada };
}
/* ============================================================
   MÓDULO 8 — LEITURA DE ARQUIVOS PDF
   O que este arquivo faz: usa a biblioteca pdf.js (carregada via
   CDN no HTML) para ler um arquivo PDF escolhido pelo usuário e
   transformar seu conteúdo em texto puro, que depois é passado para
   os extratores do MÓDULO 7.
   ============================================================ */

/**
 * Lê um arquivo PDF e devolve seu texto através do callback "aoConcluir".
 * @param {File} file - arquivo selecionado/arrastado pelo usuário.
 * @param {string} idElementoNome - id do elemento onde exibir o nome do arquivo.
 * @param {(texto:string)=>void} aoConcluir - chamado com o texto lido, quando pronto.
 * @param {string} mensagemErro - mensagem exibida em um toast caso a leitura falhe.
 */
function lerTextoDePDF(file, idElementoNome, aoConcluir, mensagemErro) {
    // Mostra o nome do arquivo imediatamente, antes mesmo da leitura terminar
    // (feedback visual rápido para o usuário).
    document.getElementById(idElementoNome).textContent = file.name;

    const reader = new FileReader();

    // Executa quando o arquivo termina de ser carregado em memória.
    reader.onload = async function () {
        try {
            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let texto = "";

            // Percorre cada página do PDF e concatena o texto de todas elas.
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                texto += content.items.map(item => item.str).join(" ") + " ";
            }

            aoConcluir(texto);

        } catch (erro) {
            console.error(erro);
            mostrarToast(mensagemErro, "erro");
        }
    };

    // REVISÃO: a versão original não tratava falha de LEITURA do arquivo
    // (por exemplo, arquivo corrompido, removido do disco durante a
    // leitura, ou sem permissão do sistema operacional) — nesse caso o
    // usuário não via nenhum aviso e o campo simplesmente nunca era
    // preenchido. Este "onerror" fecha essa lacuna com o mesmo padrão de
    // aviso usado no resto do sistema.
    reader.onerror = function () {
        console.error("Erro ao carregar o arquivo:", reader.error);
        mostrarToast(mensagemErro, "erro");
    };

    reader.readAsArrayBuffer(file);
}

// --- Página LME ---

function lerPDF(file) {
    arquivoAgendamentoObj = file;
    dadosBancoCarregados = null;   // um novo PDF anexado invalida o paciente carregado do banco

    lerTextoDePDF(
        file,
        "nomeArquivoAgendamento",
        texto => {
            textoPDF = texto;
            atualizarPainelLME();
        },
        "Erro ao ler o PDF."
    );
}

function lerPDFSolicitacao(file) {
    arquivoSolicitacaoObj = file;
    dadosBancoCarregados = null;

    lerTextoDePDF(
        file,
        "nomeArquivoSolicitacao",
        texto => {
            textoPDFSolicitacao = texto;
            atualizarPainelLME();
        },
        "Erro ao ler PDF de solicitação."
    );
}

// --- Página DOC (modo LME SCAN) ---

function lerConsultaDoc(file) {
    lerTextoDePDF(
        file,
        "nomeArquivoConsultaDoc",
        texto => {
            textoConsultaDoc = texto;
            atualizarPainelDocLmeScan();
        },
        "Erro ao ler o PDF de Marcação."
    );
}

function lerSolicitacaoDoc(file) {
    lerTextoDePDF(
        file,
        "nomeArquivoSolicitacaoDoc",
        texto => {
            textoSolicitacaoDoc = texto;
            atualizarPainelDocLmeScan();
        },
        "Erro ao ler o PDF de Solicitação."
    );
}

/** Guarda o arquivo que será renomeado/baixado — não precisa ler o conteúdo, só o nome. */
function capturarArquivoRenomear(file) {
    arquivoRenomear = file;
    document.getElementById("nomeArquivoRenomear").textContent = file.name;
}

// --- Página DOC (modo COMISSÃO DE ÉTICA) ---

function lerComissaoEtica(file) {
    arquivoRenomear = file;   // aqui o próprio PDF anexado já é o arquivo a ser renomeado

    lerTextoDePDF(
        file,
        "nomeArquivoComissaoEtica",
        texto => {
            textoComissaoEtica = texto;
            atualizarPainelComissaoEtica();
        },
        "Erro ao ler o PDF da Comissão de Ética."
    );
}

// --- Página EXCEL ---

function lerExcelAgendamento(file) {
    lerTextoDePDF(
        file,
        "nomeArquivoExcelAgendamento",
        texto => {
            textoPDFExcelAgendamento = texto;
            dadosBancoCarregados = null;
            atualizarLinhaExcel();
        },
        "Erro ao ler PDF de Agendamento."
    );
}

function lerExcelSolicitacao(file) {
    lerTextoDePDF(
        file,
        "nomeArquivoExcelSolicitacao",
        texto => {
            textoPDFExcelSolicitacao = texto;
            dadosBancoCarregados = null;
            atualizarLinhaExcel();
        },
        "Erro ao ler PDF de Solicitação."
    );
}
/* ============================================================
   MÓDULO 9 — DROPZONES E BOTÕES DE RECOLHER
   O que este arquivo faz: liga cada área de "arrastar e soltar PDF"
   ao seu input de arquivo escondido, e controla o botão que
   recolhe/expande o bloco de dropzones (lembrando o estado escolhido
   no localStorage).
   ============================================================ */

/**
 * Liga os eventos de clique/arrastar-soltar de uma dropzone ao seu
 * <input type="file"> escondido, chamando "callback(file)" sempre que
 * um arquivo é selecionado (seja por clique, seja por arraste).
 */
function configurarDropZone(dropZone, inputFile, callback) {
    // Clicar na área abre o seletor de arquivos do sistema operacional.
    dropZone.addEventListener("click", () => {
        inputFile.click();
    });

    // Feedback visual enquanto o usuário arrasta um arquivo por cima.
    dropZone.addEventListener("dragover", e => {
        e.preventDefault();   // necessário para permitir o "drop" depois
        dropZone.classList.add("hover");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("hover");
    });

    // Soltar o arquivo sobre a área: pega o primeiro arquivo arrastado.
    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.classList.remove("hover");
        const file = e.dataTransfer.files[0];
        if (file) callback(file);
    });

    // Também funciona quando o arquivo é escolhido pela janela do sistema.
    inputFile.addEventListener("change", e => {
        const file = e.target.files[0];
        if (file) callback(file);
    });

    // REVISÃO (acessibilidade): as dropzones são <div>s, que por padrão
    // não recebem foco de teclado nem são anunciadas como algo clicável
    // por leitores de tela. Isso torna a dropzone inutilizável para quem
    // navega só com o teclado. As três linhas abaixo resolvem isso sem
    // alterar a aparência: tornam a div focável (Tab), anunciam que é um
    // botão, e fazem Enter/Espaço disparar o mesmo clique do mouse.
    if (!dropZone.hasAttribute("tabindex")) {
        dropZone.setAttribute("tabindex", "0");
    }
    if (!dropZone.hasAttribute("role")) {
        dropZone.setAttribute("role", "button");
    }
    dropZone.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();   // evita rolar a página ao pressionar espaço
            inputFile.click();
        }
    });
}

// Liga cada par (dropzone, input) já existente no HTML à sua função
// de leitura correspondente (ver MÓDULO 8, logo acima).
configurarDropZone(dropZone, pdfFile, lerPDF);
configurarDropZone(dropZoneSolicitacao, pdfSolicitacao, lerPDFSolicitacao);
configurarDropZone(dropZoneDocConsulta, pdfConsultaDoc, lerConsultaDoc);
configurarDropZone(dropZoneDocSolicitacao, pdfSolicitacaoDoc, lerSolicitacaoDoc);
configurarDropZone(dropZoneDocArquivo, pdfRenomear, capturarArquivoRenomear);
configurarDropZone(dropZoneComissaoEtica, pdfComissaoEtica, lerComissaoEtica);
configurarDropZone(dropZoneExcelAgendamento, pdfExcelAgendamento, lerExcelAgendamento);
configurarDropZone(dropZoneExcelSolicitacao, pdfExcelSolicitacao, lerExcelSolicitacao);


/**
 * Liga o clique no cabeçalho de um bloco de dropzones ao
 * recolher/expandir do conteúdo abaixo dele, lembrando a preferência
 * do usuário no localStorage (persiste entre sessões).
 */
function configurarToggleDropzone(headerId, containerId, storageKey) {
    const header = document.getElementById(headerId);
    const container = document.getElementById(containerId);

    if (!header || !container) return;   // página sem esse bloco: não faz nada

    function aplicarEstadoDropzone(recolher) {
        if (recolher) {
            container.classList.add("recolhido");
        } else {
            container.classList.remove("recolhido");
        }
    }

    // Restaura o estado salvo da última vez que o usuário usou o sistema.
    const estaRecolhido = localStorage.getItem(storageKey) === "true";
    if (estaRecolhido) {
        aplicarEstadoDropzone(true);
    }

    header.addEventListener("click", () => {
        const recolher = !container.classList.contains("recolhido");
        aplicarEstadoDropzone(recolher);
        localStorage.setItem(storageKey, recolher);
    });
}

configurarToggleDropzone("headerDropzoneLme", "areaDropzoneLme", "automed_dropzoneLmeRecolhido");
configurarToggleDropzone("headerDropzoneExcel", "areaDropzoneExcel", "automed_dropzoneExcelRecolhido");
configurarToggleDropzone("headerDropzoneDoc", "areaDropzoneDoc", "automed_dropzoneDocRecolhido");
/* ============================================================
   MÓDULO 10 — ATUALIZAÇÃO DOS PAINÉIS DE DADOS EXTRAÍDOS
   O que este arquivo faz: pega os dados já extraídos (ou carregados
   do banco) e escreve cada valor no card correspondente da tela,
   em cada uma das páginas (LME, DOC e EXCEL).
   ============================================================ */

/** Atualiza os cards "Dados Extraídos" da página LME. */
function atualizarPainelLME() {
    // Se um paciente foi carregado do banco, usa esses dados; senão,
    // extrai novamente a partir dos PDFs anexados.
    const dados = dadosBancoCarregados || extrairDadosCompletos(textoPDF, textoPDFSolicitacao);
    if (!dados) return;

    const dbgPaciente = document.getElementById("dbgPaciente");
    const dbgMedico = document.getElementById("dbgMedico");
    const dbgDataHora = document.getElementById("dbgDataHora");
    const dbgLocal = document.getElementById("dbgLocal");
    const dbgEspecialidade = document.getElementById("dbgEspecialidade");

    if (dbgPaciente) dbgPaciente.textContent = dados.paciente || "-";
    if (dbgMedico) dbgMedico.textContent = formatarMedico(dados.medico) || "-";
    if (dbgDataHora) dbgDataHora.textContent = dados.dataHora || "-";
    if (dbgLocal) dbgLocal.textContent = dados.local || "-";
    if (dbgEspecialidade) dbgEspecialidade.textContent = dados.especialidade || "-";

    const dbgOM = document.getElementById("dbgOM");
    const dbgOMAbr = document.getElementById("dbgOMAbr");
    const dbgTipoOM = document.getElementById("dbgTipoOM");

    if (dbgOM) dbgOM.textContent = dados.om || "-";
    if (dbgOMAbr) dbgOMAbr.textContent = dados.omAbr || "-";
    if (dbgTipoOM) dbgTipoOM.textContent = dados.tipoOM || "-";
}

/** Atualiza os cards da página DOC quando está no modo "LME SCAN", e sugere o nome do arquivo. */
function atualizarPainelDocLmeScan() {
    const dados = extrairDadosCompletos(textoConsultaDoc, textoSolicitacaoDoc);
    if (!dados) return;

    const dbgPacienteDoc = document.getElementById("dbgPacienteDoc");
    const dbgEspecialidadeDoc = document.getElementById("dbgEspecialidadeDoc");

    if (dbgPacienteDoc) dbgPacienteDoc.textContent = dados.paciente || "-";
    if (dbgEspecialidadeDoc) dbgEspecialidadeDoc.textContent = dados.especialidade || "-";

    // OM e Data só existem depois que o PDF de Solicitação também foi lido.
    if (textoSolicitacaoDoc) {
        const dbgOMAbrDoc = document.getElementById("dbgOMAbrDoc");
        const dbgDataDoc = document.getElementById("dbgDataDoc");

        if (dbgOMAbrDoc) dbgOMAbrDoc.textContent = dados.omAbr || "-";
        if (dbgDataDoc) dbgDataDoc.textContent = dados.data || "-";

        const campoNome = document.getElementById("nomeArquivoGerado");

        // Só preenche automaticamente se o campo ainda estiver vazio —
        // não sobrescreve um nome que o usuário já tenha digitado/editado.
        if (campoNome && !campoNome.value) {
            campoNome.value =
                `${dados.paciente} - ${dados.omAbr} - ${dados.dataNomeArquivo} - ${dados.especialidade}.pdf`;
        }
    }
}

/** Atualiza os cards da página DOC quando está no modo "COMISSÃO DE ÉTICA". */
function atualizarPainelComissaoEtica() {
    const dados = extrairDadosComissaoEtica(textoComissaoEtica);
    if (!dados) return;

    const dbgSessao = document.getElementById("dbgSessaoComissao");
    const dbgPaciente = document.getElementById("dbgPacienteComissao");
    const dbgData = document.getElementById("dbgDataComissao");

    if (dbgSessao) dbgSessao.textContent = dados.sessao || "-";
    if (dbgPaciente) dbgPaciente.textContent = dados.paciente || "-";
    if (dbgData) dbgData.textContent = dados.dataFormatada || "-";

    const campoNome = document.getElementById("nomeArquivoGerado");
    const dadosCompletos = dados.sessao && dados.paciente && dados.dataFormatada;

    if (campoNome && !campoNome.value && dadosCompletos) {
        campoNome.value = montarNomeComissaoEtica(dados);
    }
}

/** Converte "dd/mm/aaaa" (dentro de um texto qualquer) para "dd/mm/aa". */
function formatarDataAno2Digitos(textoData) {
    if (!textoData) return "";
    return textoData.replace(/\b(\d{1,2}\/\d{1,2}\/)\d{2}(\d{2})\b/g, "$1$2");
}

/** Monta a linha de texto (separada por " - ") que será colada na planilha Excel. */
function atualizarLinhaExcel() {
    const campoResultado = document.getElementById("resultadoExcel");
    if (!campoResultado) return;

    const dados = dadosBancoCarregados || extrairDadosCompletos(textoPDFExcelAgendamento, textoPDFExcelSolicitacao);

    if (!dados) {
        campoResultado.value = "";
        return;
    }

    const nome = dados.paciente || "";
    const agendado = "Agendado";

    // Remove o hífen: "22/09/26 - 08:00" vira "22/09/26 08:00".
    const dataHoraBruta = (dados.dataHora || "").replace(/\s*-\s*/, " ");
    const dataHora = formatarDataAno2Digitos(dataHoraBruta);

    // NOTA DE REVISÃO: as colunas abaixo ("Não", "Não", "Sim") são
    // valores fixos definidos propositalmente — representam colunas da
    // planilha que este sistema sempre preenche com o mesmo padrão
    // (não foram esquecidas nem são um bug). Caso a regra de negócio
    // mude, é só editar os três valores aqui.
    const nao1 = "Não";
    const nao2 = "Não";
    const numDIEx = dados.numeroDIEx || "";
    const dataDIEx = formatarDataAno2Digitos(dados.dataDIEx || "");
    const omAbr = dados.omAbr || "";
    const especialidadeExcel = (dados.especialidadeCrua || dados.especialidade || "").toUpperCase();
    const medico = formatarMedico(dados.medico) || "";
    const sim = "Sim";

    const linhaVisual = `${nome} - ${agendado} - ${dataHora} - ${nao1} - ${nao2} - ${numDIEx} - ${dataDIEx} - ${omAbr} - ${especialidadeExcel} - ${medico} - ${sim}`;

    campoResultado.value = linhaVisual;
}
/* ============================================================
   MÓDULO 11 — GERADOR DE DIEx (PÁGINA LME)
   O que este arquivo faz: controla a escolha do modelo de texto,
   preenche as variáveis ({PACIENTE}, {MEDICO}, etc.) com os dados
   extraídos e copia o resultado final para a área de transferência.
   ============================================================ */

// Restaura as últimas escolhas do usuário (select de modelo, pronome
// do paciente e select de conferência/laudo), salvas no localStorage.
if (localStorage.getItem("automed_modeloSelect")) {
    modeloSelect.value = localStorage.getItem("automed_modeloSelect");
}
if (localStorage.getItem("automed_pronomePaciente")) {
    pronomePaciente.value = localStorage.getItem("automed_pronomePaciente");
}
if (localStorage.getItem("automed_tipoLaudoConferenciaSelect") && tipoLaudoConferenciaSelect) {
    tipoLaudoConferenciaSelect.value = localStorage.getItem("automed_tipoLaudoConferenciaSelect");
}

/**
 * Atualiza apenas os pequenos trechos "variáveis" dentro dos modelos
 * de texto (os <span class="var-..."> no HTML), de acordo com a
 * escolha do select "Conferência / Laudo". Assim não é preciso
 * reescrever o modelo inteiro, só os pedaços que mudam.
 */
function atualizarVariaveisModelo() {
    if (!tipoLaudoConferenciaSelect) return;

    const valor = tipoLaudoConferenciaSelect.value;
    const textoTipoDoc = (valor === "laudo")
        ? "Laudo Médico Especializado - LME"
        : "conferência médica";

    const textoSufixoMedico = (valor === "laudo")
        ? ", com o/a {MEDICO}"
        : "";

    document.querySelectorAll(".var-tipo-doc").forEach(el => {
        el.textContent = textoTipoDoc;
    });

    document.querySelectorAll(".var-sufixo-medico").forEach(el => {
        el.textContent = textoSufixoMedico;
    });
}

/** Mostra o modelo de texto escolhido no select e esconde os outros. */
function alternarModeloTexto() {
    localStorage.setItem("automed_modeloSelect", modeloSelect.value);

    document.querySelectorAll(".modeloTexto")
        .forEach(t => t.style.display = "none");

    if (modeloSelect.value === "agendamento") {
        document.getElementById("modelo_agendamento").style.display = "block";
        // O modelo de agendamento não usa "Conferência/Laudo": esconde o select.
        if (tipoLaudoConferenciaSelect) {
            tipoLaudoConferenciaSelect.classList.add("oculto-select");
        }
    } else if (modeloSelect.value === "s2") {
        document.getElementById("modelo_s2").style.display = "block";
        if (tipoLaudoConferenciaSelect) {
            tipoLaudoConferenciaSelect.classList.remove("oculto-select");
        }
    } else if (modeloSelect.value === "remessa") {
        document.getElementById("modelo_remessa").style.display = "block";
        if (tipoLaudoConferenciaSelect) {
            tipoLaudoConferenciaSelect.classList.remove("oculto-select");
        }
    }

    atualizarVariaveisModelo();
}

pronomePaciente.addEventListener("change", () => {
    localStorage.setItem("automed_pronomePaciente", pronomePaciente.value);
});

if (tipoLaudoConferenciaSelect) {
    tipoLaudoConferenciaSelect.addEventListener("change", () => {
        localStorage.setItem("automed_tipoLaudoConferenciaSelect", tipoLaudoConferenciaSelect.value);
        atualizarVariaveisModelo();
    });
}

modeloSelect.addEventListener("change", alternarModeloTexto);
alternarModeloTexto();   // aplica o estado inicial assim que a página carrega

/** Converte marcações simples de negrito ("**texto**" ou "*texto*") em HTML "<b>texto</b>". */
function converterNegritos(texto) {
    if (!texto) return "";
    return texto
        .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
        .replace(/\*(.*?)\*/g, "<b>$1</b>");
}

// Botão "GERAR DIEx": substitui as variáveis {PLACEHOLDER} do modelo
// escolhido pelos dados extraídos (ou carregados do banco) e escreve
// o resultado final na área "Resultado".
document.getElementById("gerarBtn").addEventListener("click", () => {

    if (!textoPDF && !dadosBancoCarregados) {
        mostrarToast("Carregue um PDF ou selecione um paciente do Banco de Dados primeiro.", "aviso");
        return;
    }

    const dados = dadosBancoCarregados || extrairDadosCompletos(textoPDF, textoPDFSolicitacao);
    if (!dados) return;

    atualizarPainelLME();   // garante que os cards laterais reflitam os dados usados

    let modeloEl = null;

    if (modeloSelect.value === "agendamento") {
        modeloEl = document.getElementById("modelo_agendamento");
    } else if (modeloSelect.value === "s2") {
        modeloEl = document.getElementById("modelo_s2");
    } else if (modeloSelect.value === "remessa") {
        modeloEl = document.getElementById("modelo_remessa");
    }

    if (!modeloEl) return;

    let modelo = modeloEl.innerHTML;
    const pronomePacienteTexto = pronomePaciente.value;

    // Troca cada {VARIAVEL} pelo valor correspondente dos dados extraídos.
    let resultado = modelo
        .replace(/{PACIENTE}/g, dados.paciente || "")
        .replace(/{MEDICO}/g, formatarMedico(dados.medico) || "")
        .replace(/{ESPECIALIDADE}/g, dados.especialidade || "")
        .replace(/{DATA}/g, formatarData(dados.data) || "")
        .replace(/{DATA_MILITAR}/g, dados.dataMilitar || "")
        .replace(/{DIASEMANA}/g, diaSemana(dados.data) || "")
        .replace(/{HORARIO}/g, dados.horario || "")
        .replace(/{LOCAL}/g, formatarLocal(dados.local) || "")
        .replace(/{OM}/g, dados.om || "")
        .replace(/{OMABR}/g, dados.omAbr || "")
        .replace(/{TIPO_OM}/g, dados.tipoOM || "")
        .replace(/{CARGO_OM}/g, dados.cargoOM || "")
        .replace(/{PRONOME}/g, dados.pronome || "")
        .replace(/{PRONOMEPACIENTE}/g, pronomePacienteTexto || "");

    resultado = converterNegritos(resultado);

    const campoResultado = document.getElementById("resultado");
    campoResultado.innerHTML = resultado;
});

// Botão "COPIAR TEXTO": copia o resultado gerado para a área de
// transferência, preservando negrito (HTML) para colar em editores
// como o Word, com um texto simples como alternativa.
document.getElementById("copiarBtn").addEventListener("click", async () => {
    const elementoResultado = document.getElementById("resultado");
    if (!elementoResultado || !elementoResultado.innerText.trim()) {
        mostrarToast("Gere o texto antes de copiar.", "aviso");
        return;
    }

    let htmlContent = elementoResultado.innerHTML;
    let plainText = elementoResultado.innerText;

    let htmlParaWord = htmlContent
        .replace(/\r\n/g, "<br>")
        .replace(/\n/g, "<br>")
        .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>");   // evita blocos gigantes de linhas em branco

    try {
        if (navigator.clipboard && window.ClipboardItem) {
            // Navegadores modernos: copia HTML e texto puro ao mesmo tempo.
            const blobHtml = new Blob([htmlParaWord], { type: "text/html" });
            const blobText = new Blob([plainText], { type: "text/plain" });

            const item = new ClipboardItem({
                "text/html": blobHtml,
                "text/plain": blobText
            });

            await navigator.clipboard.write([item]);
            mostrarToast("Texto copiado com sucesso!", "sucesso");
        } else {
            // Alternativa para navegadores sem suporte à Clipboard API moderna.
            const range = document.createRange();
            range.selectNodeContents(elementoResultado);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            document.execCommand("copy");
            selection.removeAllRanges();
            mostrarToast("Texto copiado com sucesso!", "sucesso");
        }
    } catch (erro) {
        console.error("Erro ao copiar:", erro);
        mostrarToast("Não foi possível copiar o texto automaticamente.", "erro");
    }
});
/* ============================================================
   MÓDULO 12 — RENOMEADOR DE DOCUMENTOS (PÁGINA DOC)
   O que este arquivo faz: monta o nome padronizado do arquivo (LME
   Scan ou Comissão de Ética) e baixa o PDF anexado já com esse nome.
   ============================================================ */

// Restaura o último tipo de documento escolhido (LME Scan / Comissão de Ética).
if (localStorage.getItem("automed_tipoDocumento")) {
    tipoDocumentoSelect.value = localStorage.getItem("automed_tipoDocumento");
}

/** Alterna a página DOC entre os modos "LME SCAN" e "COMISSÃO DE ÉTICA". */
function alternarTipoDocumento() {
    localStorage.setItem("automed_tipoDocumento", tipoDocumentoSelect.value);

    const comissaoSelecionada = tipoDocumentoSelect.value === "a";
    const inputPesquisaDoc = document.getElementById("inputPesquisaDoc");

    if (inputPesquisaDoc) {
        inputPesquisaDoc.classList.toggle("oculto", comissaoSelecionada);
        if (comissaoSelecionada) inputPesquisaDoc.value = "";
    }

    blocoLmeScan.classList.toggle("oculto", comissaoSelecionada);
    blocoComissaoEtica.classList.toggle("oculto", !comissaoSelecionada);

    painelExtraidosLmeScan.classList.toggle("oculto", comissaoSelecionada);
    painelExtraidosComissao.classList.toggle("oculto", !comissaoSelecionada);

    // Troca de modo sempre limpa o nome gerado e o arquivo pendente,
    // para não misturar dados de um modo com o outro.
    document.getElementById("nomeArquivoGerado").value = "";
    arquivoRenomear = null;
}

tipoDocumentoSelect.addEventListener("change", alternarTipoDocumento);
alternarTipoDocumento();   // aplica o estado inicial assim que a página carrega

/** Gera o nome padronizado no modo "LME SCAN": "Paciente - OM - Data - Especialidade.pdf". */
function gerarNomeArquivoLmeScan() {
    if (!textoConsultaDoc || !textoSolicitacaoDoc) {
        mostrarToast("Carregue os PDFs de Marcação e Solicitação.", "aviso");
        return;
    }

    const dados = extrairDadosCompletos(textoConsultaDoc, textoSolicitacaoDoc);

    if (dados) {
        document.getElementById("nomeArquivoGerado").value =
            `${dados.paciente} - ${dados.omAbr} - ${dados.dataNomeArquivo} - ${dados.especialidade}.pdf`;
    }
}

/** Monta o nome padronizado no modo "COMISSÃO DE ÉTICA": "Sessão - Paciente - Data.pdf". */
function montarNomeComissaoEtica(dados) {
    const sessaoArquivo = dados.sessao.replace("/", "-");
    return `${sessaoArquivo} - ${dados.paciente} - ${dados.dataFormatada}.pdf`;
}

function gerarNomeArquivoComissaoEtica() {
    if (!textoComissaoEtica) {
        mostrarToast("Carregue o PDF da Comissão de Ética.", "aviso");
        return;
    }

    const dados = extrairDadosComissaoEtica(textoComissaoEtica);

    if (!dados || !dados.sessao || !dados.paciente || !dados.dataFormatada) {
        mostrarToast("Não foi possível extrair todos os dados deste PDF. Digite manualmente.", "erro");
        return;
    }

    document.getElementById("nomeArquivoGerado").value = montarNomeComissaoEtica(dados);
}

// Botão "GERAR NOME": decide qual das duas funções acima chamar,
// conforme o modo selecionado no momento.
document.getElementById("gerarNomeBtn").addEventListener("click", () => {
    if (tipoDocumentoSelect.value === "a") {
        gerarNomeArquivoComissaoEtica();
    } else {
        gerarNomeArquivoLmeScan();
    }
});

/**
 * FUNCIONALIDADE NOVA: remove do nome do arquivo os caracteres que o
 * Windows/macOS/Linux não aceitam em nomes de arquivo (/ \ : * ? " < > |).
 * O campo "nomeArquivoGerado" é editável livremente pelo usuário — sem
 * essa limpeza, um caractere digitado por engano faria o download falhar
 * silenciosamente ou salvar com um nome truncado/diferente do esperado.
 */
function sanitizarNomeArquivo(nome) {
    return nome.replace(/[\/\\:*?"<>|]/g, "_").trim();
}

/**
 * CORREÇÃO: limpeza específica para nomes de PASTA/ARQUIVO criados pela
 * File System Access API (getDirectoryHandle / getFileHandle).
 *
 * O navegador rejeita com "Name is not allowed" qualquer nome que:
 *   • esteja vazio;
 *   • seja "." ou "..";
 *   • contenha "/" ou "\".
 * E o Windows ainda recusa nomes terminados em "." ou espaço, caracteres
 * de controle e nomes reservados (CON, PRN, NUL, COM1, LPT1...).
 *
 * Isso quebrava o salvamento quando a sigla da OM tinha barra
 * (ex.: "B Adm Ap/ 3ª RM", "PqRMnt/3", "AD/3") ou quando algum campo
 * vinha com data em "dd/mm/aaaa" — o nome da pasta ficava com "/" e o
 * navegador entendia como caminho, lançando TypeError.
 */
function sanitizarNomePastaFS(nome, alternativo = "Sem nome") {
    let limpo = String(nome ?? "")
        .replace(/[\/\\:*?"<>|]/g, "_")     // proibidos no SO e na API
        .replace(/[\x00-\x1F\x7F]/g, "")    // caracteres de controle
        .replace(/\s{2,}/g, " ")
        .trim()
        .replace(/[.\s]+$/g, "");           // Windows não aceita final com "." ou espaço

    // Nomes reservados do Windows (com ou sem extensão).
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i.test(limpo)) {
        limpo = `_${limpo}`;
    }

    if (!limpo || limpo === "." || limpo === "..") {
        limpo = alternativo;
    }

    // Limite conservador para não estourar o caminho máximo do sistema.
    return limpo.slice(0, 150).trim().replace(/[.\s]+$/g, "") || alternativo;
}

/** Dispara o download de um arquivo (Blob/File) no navegador, com o nome escolhido. */
function baixarArquivoComNome(arquivo, nome) {
    const url = URL.createObjectURL(arquivo);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);   // libera a memória usada pelo link temporário
}

// Botão "BAIXAR PDF": valida se há arquivo e nome antes de baixar.
document.getElementById("renomearBtn").addEventListener("click", () => {
    if (!arquivoRenomear) {
        mostrarToast("Anexe o PDF a ser renomeado.", "aviso");
        return;
    }

    const novoNome = sanitizarNomeArquivo(document.getElementById("nomeArquivoGerado").value.trim());

    if (!novoNome) {
        mostrarToast("Gere ou preencha o nome do arquivo antes de baixar.", "aviso");
        return;
    }

    baixarArquivoComNome(arquivoRenomear, novoNome);
});

// Campo de busca de paciente na página DOC: ao digitar um nome que já
// existe no banco, preenche os cards e o nome do arquivo automaticamente.
document.getElementById("inputPesquisaDoc")?.addEventListener("input", (e) => {
    const valorDigitado = e.target.value;

    if (mapaPacientesBanco.has(valorDigitado)) {
        const dados = mapaPacientesBanco.get(valorDigitado);

        const dbgPacienteDoc = document.getElementById("dbgPacienteDoc");
        const dbgOMAbrDoc = document.getElementById("dbgOMAbrDoc");
        const dbgDataDoc = document.getElementById("dbgDataDoc");
        const dbgEspecialidadeDoc = document.getElementById("dbgEspecialidadeDoc");

        if (dbgPacienteDoc) dbgPacienteDoc.textContent = dados.paciente || "-";
        if (dbgOMAbrDoc) dbgOMAbrDoc.textContent = dados.omAbr || "-";
        if (dbgDataDoc) dbgDataDoc.textContent = dados.data || "-";
        if (dbgEspecialidadeDoc) dbgEspecialidadeDoc.textContent = dados.especialidade || "-";

        const campoNome = document.getElementById("nomeArquivoGerado");
        if (campoNome) {
            campoNome.value = `${dados.paciente} - ${dados.omAbr} - ${dados.dataNomeArquivo} - ${dados.especialidade}.pdf`;
        }
    } else if (valorDigitado === "") {
        // Campo de busca limpo: reseta os cards para o estado vazio.
        const dbgPacienteDoc = document.getElementById("dbgPacienteDoc");
        const dbgOMAbrDoc = document.getElementById("dbgOMAbrDoc");
        const dbgDataDoc = document.getElementById("dbgDataDoc");
        const dbgEspecialidadeDoc = document.getElementById("dbgEspecialidadeDoc");

        if (dbgPacienteDoc) dbgPacienteDoc.textContent = "-";
        if (dbgOMAbrDoc) dbgOMAbrDoc.textContent = "-";
        if (dbgDataDoc) dbgDataDoc.textContent = "-";
        if (dbgEspecialidadeDoc) dbgEspecialidadeDoc.textContent = "-";

        const campoNome = document.getElementById("nomeArquivoGerado");
        if (campoNome) campoNome.value = "";
    }
});
/* ============================================================
   MÓDULO 13 — NAVEGAÇÃO ENTRE ABAS/PÁGINAS E MENU DO RODAPÉ
   O que este arquivo faz: troca a página visível (LME/DOC/EXCEL/
   BANCO) quando uma aba é clicada, decidindo a direção da animação,
   e controla o botão que recolhe o rodapé inteiro.
   ============================================================ */

const abas = document.querySelectorAll(".aba");
const paginas = document.querySelectorAll(".pagina");
const ordemPaginas = ["lme", "doc", "excel", "banco"];   // ordem usada para decidir a direção do slide
let abaAtualNome = "lme";

/** Ativa a página "nomeAba", aplicando a animação de slide na direção correta. */
function ativarAba(nomeAba) {
    const abaAlvo = document.querySelector(`.aba[data-aba="${nomeAba}"]`);
    const paginaAlvo = document.getElementById("pagina-" + nomeAba);

    if (abaAlvo && paginaAlvo) {
        const indexAtual = ordemPaginas.indexOf(abaAtualNome);
        const indexNova = ordemPaginas.indexOf(nomeAba);

        // Desativa tudo antes de ativar a nova aba/página.
        abas.forEach(a => a.classList.remove("ativa"));
        paginas.forEach(p => {
            p.classList.remove("ativa", "slide-direita", "slide-esquerda");
        });

        abaAlvo.classList.add("ativa");
        paginaAlvo.classList.add("ativa");

        // Página mais à direita na ordem: desliza entrando pela direita.
        // Página mais à esquerda: desliza entrando pela esquerda.
        if (indexNova > indexAtual) {
            paginaAlvo.classList.add("slide-direita");
        } else if (indexNova < indexAtual) {
            paginaAlvo.classList.add("slide-esquerda");
        }

        abaAtualNome = nomeAba;
    }
}

// Ao carregar a página, retoma a última aba usada (se houver uma salva).
const abaSalva = localStorage.getItem("automed_abaAtiva");
if (abaSalva && ordemPaginas.includes(abaSalva)) {
    abaAtualNome = abaSalva;
    ativarAba(abaSalva);
}

abas.forEach(botao => {
    botao.addEventListener("click", () => {
        const nomeAba = botao.dataset.aba;
        ativarAba(nomeAba);
        localStorage.setItem("automed_abaAtiva", nomeAba);
    });
});

// Botão "▼" do rodapé: recolhe/expande o menu de abas, lembrando a
// preferência do usuário.
const btnAbas = document.getElementById("toggleAbas");
const footerSistema = document.getElementById("footerSistema");

if (btnAbas && footerSistema) {
    if (localStorage.getItem("automed_footerRecolhido") === "true") {
        footerSistema.classList.add("recolhido");
    }

    btnAbas.addEventListener("click", () => {
        footerSistema.classList.toggle("recolhido");
        const estaRecolhido = footerSistema.classList.contains("recolhido");
        localStorage.setItem("automed_footerRecolhido", estaRecolhido);
    });
}
/* ============================================================
   MÓDULO 14 — BANCO DE DADOS LOCAL, CONEXÃO E MODAIS
   O que este arquivo faz: usa a File System Access API do navegador
   para ler/gravar uma pasta escolhida pelo usuário no próprio
   computador, guardando um subdiretório por paciente com um
   "dados.json" e os PDFs originais. Também controla os modais de
   "paciente duplicado" e "confirmar exclusão".
   ============================================================ */

// Guardam temporariamente os dados envolvidos em cada modal aberto,
// para os botões de confirmação saberem em cima de qual registro agir.
let pacienteExistenteModal = null;
let pacienteNovoModal = null;
let pacienteExcluirModal = null;

// 1. CONEXÃO COM A PASTA DO BANCO DE DADOS
document.getElementById("btnConectarBanco")?.addEventListener("click", async () => {
    try {
        // Abre o seletor de pastas nativo do sistema operacional.
        dirHandleBanco = await window.showDirectoryPicker({ mode: 'readwrite' });
        const statusPermissao = await dirHandleBanco.requestPermission({ mode: 'readwrite' });

        if (statusPermissao !== 'granted') {
            mostrarToast("Você precisa permitir o acesso para o banco funcionar.", "aviso");
            return;
        }

        const statusEl = document.getElementById("statusBanco");
        if (statusEl) {
            statusEl.textContent = `CONECTADO`;
            statusEl.style.color = "#c7d59f";
        }

        try {
            await atualizarListaPacientesBanco();
            mostrarToast("Banco de dados conectado com sucesso!", "sucesso");
        } catch (e) {
            console.warn("Conectado, mas houve erro ao listar pastas:", e);
        }

    } catch (erro) {
        if (erro.name === 'AbortError') return;   // usuário cancelou a janela: não é erro
        console.error("Erro na conexão:", erro);
        mostrarToast("Erro técnico ao conectar.", "erro");
    }
});

// 2. ATUALIZAÇÃO DA LISTA DE PACIENTES SALVOS NA PASTA
/** Varre todas as subpastas do banco, lê o "dados.json" de cada uma e monta a lista de sugestões da busca. */
async function atualizarListaPacientesBanco() {
    if (!dirHandleBanco) return;

    const datalist = document.getElementById("listaPacientesBanco");
    if (!datalist) return;

    datalist.innerHTML = "";
    mapaPacientesBanco.clear();

    try {
        for await (const entry of dirHandleBanco.values()) {
            if (entry.kind !== 'directory') continue;   // ignora arquivos soltos na raiz

            try {
                const pastaHandle = entry;
                const jsonFileHandle = await pastaHandle.getFileHandle("dados.json");
                const file = await jsonFileHandle.getFile();
                const textoJson = await file.text();
                const dados = JSON.parse(textoJson);

                dados._nomePasta = entry.name;   // guarda o nome da pasta para permitir excluir depois

                const identificador = `${dados.paciente} - ${dados.omAbr} (${dados.data})`;
                mapaPacientesBanco.set(identificador, dados);

                const option = document.createElement("option");
                option.value = identificador;
                datalist.appendChild(option);
            } catch (err) {
                continue;   // pasta sem "dados.json" válido: ignora e segue para a próxima
            }
        }
    } catch (erro) {
        console.error("Erro ao varrer a pasta principal:", erro);
    }

    // FUNCIONALIDADE NOVA: recalcula o resumo estatístico sempre que a
    // lista de pacientes é recarregada (ver MÓDULO 19, mais abaixo).
    atualizarEstatisticasBanco();
}

// 3. SELEÇÃO DE PACIENTE PELA BARRA DE PESQUISA DO BANCO (página LME)
document.getElementById("inputPesquisaBanco")?.addEventListener("input", (e) => {
    const valorDigitado = e.target.value;

    if (mapaPacientesBanco.has(valorDigitado)) {
        dadosBancoCarregados = mapaPacientesBanco.get(valorDigitado);

        // Um paciente vindo do banco substitui os PDFs recém-anexados.
        textoPDF = "";
        textoPDFSolicitacao = "";
        arquivoAgendamentoObj = null;
        arquivoSolicitacaoObj = null;

        atualizarPainelLME();
    } else if (valorDigitado === "") {
        dadosBancoCarregados = null;
        atualizarPainelLME();
    }
});

// 4. FUNÇÃO AUXILIAR DE NORMALIZAÇÃO DE NOME PARA COMPARAR
/** Remove acentos, deixa maiúsculo e tira tudo que não for letra/número — usado só para COMPARAR nomes, não para exibir. */
function normalizarParaComparacao(texto) {
    if (!texto) return "";
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")   // remove os acentos (separados pelo normalize NFD)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
}

// 5. BUSCA DUPLICATA DE PACIENTE
/** Procura, no mapa de pacientes já carregados, alguém com o mesmo nome (ignorando acentos/maiúsculas). */
function buscarPacienteExistentePorNome(nomePaciente) {
    if (!nomePaciente) return null;
    const nomeAlvo = normalizarParaComparacao(nomePaciente);

    for (const [chave, dados] of mapaPacientesBanco.entries()) {
        if (dados && dados.paciente && normalizarParaComparacao(dados.paciente) === nomeAlvo) {
            return dados;
        }
    }
    return null;
}

// 6. CONTROLADORES DOS MODAIS

/** Abre o modal comparando o registro já salvo com o novo que está prestes a ser gravado. */
function abrirModalDuplicidade(existente, novo) {
    pacienteExistenteModal = existente;
    pacienteNovoModal = novo;

    document.getElementById("compExistentePaciente").textContent = existente.paciente || "-";
    document.getElementById("compExistenteOM").textContent = existente.omAbr || "-";
    document.getElementById("compExistenteData").textContent = existente.data || "-";
    document.getElementById("compExistenteEspecialidade").textContent = existente.especialidade || "-";
    document.getElementById("compExistenteMedico").textContent = formatarMedico(existente.medico) || "-";

    document.getElementById("compNovoPaciente").textContent = novo.paciente || "-";
    document.getElementById("compNovoOM").textContent = novo.omAbr || "-";
    document.getElementById("compNovoData").textContent = novo.data || "-";
    document.getElementById("compNovoEspecialidade").textContent = novo.especialidade || "-";
    document.getElementById("compNovoMedico").textContent = formatarMedico(novo.medico) || "-";

    document.getElementById("modalDuplicidade")?.classList.remove("oculto");
}

function fecharModalDuplicidade() {
    document.getElementById("modalDuplicidade")?.classList.add("oculto");
    pacienteExistenteModal = null;
    pacienteNovoModal = null;
}

function abrirModalExcluir(dados) {
    pacienteExcluirModal = dados;

    document.getElementById("excluirNomePaciente").textContent = dados.paciente || "-";
    document.getElementById("excluirOMPaciente").textContent = dados.omAbr || "-";
    document.getElementById("excluirDataPaciente").textContent = dados.data || "-";

    document.getElementById("modalExcluir")?.classList.remove("oculto");
}

function fecharModalExcluir() {
    document.getElementById("modalExcluir")?.classList.add("oculto");
    pacienteExcluirModal = null;
}

// 7. SALVAMENTO DE DADOS NA PASTA LOCAL
/**
 * Cria (ou reutiliza) uma subpasta para o paciente e grava dentro dela
 * o "dados.json" e os PDFs originais anexados nesta sessão.
 * @param {string} sufixoPasta - texto extra no nome da pasta, usado para não colidir ao "Salvar Ambos".
 * @param {{avisar?: boolean, atualizarLista?: boolean}} opcoes - permite
 *        salvar em lote (ver MÓDULO 20 — importar backup) sem disparar um
 *        toast e sem revarrer a pasta inteira a cada item importado.
 */
async function executarSalvamentoBanco(dados, sufixoPasta = "", opcoes = {}) {
    const { avisar = true, atualizarLista = true } = opcoes;
    try {
        // Remove caracteres proibidos em nomes de pasta/arquivo do sistema operacional.
        // ATENÇÃO: a limpeza precisa valer para TODAS as partes do nome — a sigla
        // da OM pode conter barra (ex.: "AD/3", "B Adm Ap/ 3ª RM") e, sem isso,
        // o navegador lança "Name is not allowed" em getDirectoryHandle.
        const pacienteLimpo = sanitizarNomePastaFS(dados.paciente, "Paciente");

        // Só entram no nome as partes realmente preenchidas, para não gerar
        // pastas como "FULANO -  - " quando a OM ou a data não forem extraídas.
        const partesNome = [
            pacienteLimpo,
            (dados.omAbr || "").trim(),
            (dados.dataNomeArquivo || "").trim()
        ].filter(Boolean);

        let nomePasta = partesNome.join(" - ");
        if (sufixoPasta) nomePasta += ` ${sufixoPasta}`;

        nomePasta = sanitizarNomePastaFS(nomePasta, pacienteLimpo);

        const pastaHandle = await dirHandleBanco.getDirectoryHandle(nomePasta, { create: true });

        const fileJson = await pastaHandle.getFileHandle("dados.json", { create: true });
        const writerJson = await fileJson.createWritable();
        await writerJson.write(JSON.stringify(dados, null, 4));
        await writerJson.close();

        if (arquivoAgendamentoObj) {
            const f = await pastaHandle.getFileHandle(`Marcação - ${pacienteLimpo}.pdf`, { create: true });
            const w = await f.createWritable();
            await w.write(arquivoAgendamentoObj);
            await w.close();
        }
        if (arquivoSolicitacaoObj) {
            const f = await pastaHandle.getFileHandle(`Solicitação - ${pacienteLimpo}.pdf`, { create: true });
            const w = await f.createWritable();
            await w.write(arquivoSolicitacaoObj);
            await w.close();
        }

        if (avisar) mostrarToast("Dados salvos no banco com sucesso!", "sucesso");
        if (atualizarLista) await atualizarListaPacientesBanco();   // recarrega a lista para incluir o registro recém-salvo
        return true;
    } catch (e) {
        console.error("Erro ao salvar no banco:", e);
        // Mostra o motivo real no toast: "permissão negada" e "nome inválido"
        // são erros bem diferentes, e a mensagem genérica escondia isso.
        if (avisar) {
            const motivo = e?.name === "NotAllowedError" || e?.name === "SecurityError"
                ? "Verifique as permissões da pasta."
                : (e?.message || "Erro desconhecido.");
            mostrarToast(`Erro ao salvar. ${motivo}`, "erro");
        }
        return false;
    }
}

// 8. DISPARADORES DOS BOTÕES PRINCIPAIS

document.getElementById("btnInserirBanco")?.addEventListener("click", async () => {
    if (!dirHandleBanco) {
        mostrarToast("Primeiro clique em 'CONECTAR PASTA DO BANCO'.", "aviso");
        return;
    }

    const dadosNovos = dadosBancoCarregados || extrairDadosCompletos(textoPDF, textoPDFSolicitacao);

    if (!dadosNovos || !dadosNovos.paciente) {
        mostrarToast("Anexe os PDFs antes de salvar.", "aviso");
        return;
    }

    const existente = buscarPacienteExistentePorNome(dadosNovos.paciente);

    if (existente) {
        // Já existe alguém com esse nome: pede confirmação em vez de sobrescrever direto.
        abrirModalDuplicidade(existente, dadosNovos);
    } else {
        await executarSalvamentoBanco(dadosNovos);
    }
});

document.getElementById("btnExcluirBanco")?.addEventListener("click", () => {
    if (!dirHandleBanco) {
        mostrarToast("Conecte a pasta do banco de dados primeiro.", "aviso");
        return;
    }

    if (!dadosBancoCarregados || !dadosBancoCarregados._nomePasta) {
        mostrarToast("Selecione um paciente salvo na barra de pesquisa para excluir.", "aviso");
        return;
    }

    abrirModalExcluir(dadosBancoCarregados);
});

// 9. DELEGAÇÃO DE EVENTOS GLOBAL PARA OS BOTÕES DOS MODAIS
// Em vez de um listener por botão, um único listener no "document"
// identifica qual botão foi clicado pelo seu id (delegação de eventos).
document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    // Modal Duplicidade - Cancelar
    if (btn.id === "btnModalCancelar") {
        fecharModalDuplicidade();
    }

    // Modal Duplicidade - Substituir (apaga o registro antigo e grava o novo no lugar)
    else if (btn.id === "btnModalSubstituir") {
        if (!pacienteExistenteModal || !pacienteNovoModal) return;

        try {
            if (pacienteExistenteModal._nomePasta) {
                await dirHandleBanco.removeEntry(pacienteExistenteModal._nomePasta, { recursive: true });
            }

            const dadosParaSalvar = pacienteNovoModal;
            fecharModalDuplicidade();
            await executarSalvamentoBanco(dadosParaSalvar);
            mostrarToast("Registro antigo substituído com sucesso!", "sucesso");
        } catch (erro) {
            console.error("Erro ao substituir paciente:", erro);
            mostrarToast("Erro ao excluir o paciente antigo para substituição.", "erro");
        }
    }

    // Modal Duplicidade - Salvar Ambos (mantém o antigo e cria uma pasta nova com sufixo "(Cópia NNNN)")
    else if (btn.id === "btnModalSalvarAmbos") {
        if (!pacienteNovoModal) return;

        const dadosParaSalvar = pacienteNovoModal;
        fecharModalDuplicidade();

        const idUnico = new Date().getTime().toString().slice(-4);
        await executarSalvamentoBanco(dadosParaSalvar, `(Cópia ${idUnico})`);
    }

    // Modal Excluir - Cancelar
    else if (btn.id === "btnModalCancelarExclusao") {
        fecharModalExcluir();
    }

    // Modal Excluir - Confirmar Exclusão
    else if (btn.id === "btnModalConfirmarExclusao") {
        if (!pacienteExcluirModal || !pacienteExcluirModal._nomePasta) return;

        try {
            await dirHandleBanco.removeEntry(pacienteExcluirModal._nomePasta, { recursive: true });

            fecharModalExcluir();
            mostrarToast("Registro excluído com sucesso!", "sucesso");

            dadosBancoCarregados = null;

            const inputPesquisa = document.getElementById("inputPesquisaBanco");
            if (inputPesquisa) inputPesquisa.value = "";

            await atualizarListaPacientesBanco();
            atualizarPainelLME();

        } catch (erro) {
            console.error("Erro ao excluir pasta:", erro);
            mostrarToast("Erro ao excluir o registro do computador.", "erro");
        }
    }
});
/* ============================================================
   MÓDULO 15 — PESQUISA E CÓPIA AUTOMÁTICA (PÁGINA EXCEL)
   O que este arquivo faz: liga a busca de paciente já salvo à linha
   do Excel, e copia essa linha para a área de transferência já
   separada por TAB (para colar direto nas colunas da planilha).
   ============================================================ */

document.getElementById("inputPesquisaExcel")?.addEventListener("input", (e) => {
    const valorDigitado = e.target.value;

    if (mapaPacientesBanco.has(valorDigitado)) {
        dadosBancoCarregados = mapaPacientesBanco.get(valorDigitado);
        textoPDFExcelAgendamento = "";
        textoPDFExcelSolicitacao = "";
        atualizarLinhaExcel();
    } else if (valorDigitado === "") {
        dadosBancoCarregados = null;
        atualizarLinhaExcel();
    }
});

document.getElementById("copiarExcelBtn")?.addEventListener("click", async () => {
    let textoVisual = document.getElementById("resultadoExcel")?.value.trim();

    if (!textoVisual) {
        mostrarToast("Não há dados para copiar. Anexe os PDFs ou selecione um paciente.", "aviso");
        return;
    }

    textoVisual = formatarDataAno2Digitos(textoVisual);

    // Separa exatamente as 11 colunas divididas pelos hífens principais.
    let partes = textoVisual.split(/\s*-\s*/);

    // Junta as colunas com TAB: ao colar no Excel, cada parte cai em
    // uma célula diferente automaticamente.
    const textoParaExcel = partes.join("\t");

    try {
        await navigator.clipboard.writeText(textoParaExcel);
        mostrarToast("Linha copiada com sucesso! Cole na sua planilha no Excel.", "sucesso");
    } catch {
        mostrarToast("Não foi possível copiar o texto.", "erro");
    }
});
/* ============================================================
   MÓDULO 16 — REVELAÇÃO SUAVE DA PÁGINA (ANTI-FLICKER)
   O que este bloco faz: espera o HTML terminar de montar e então
   libera a opacidade do body (ver MÓDULO 1 do style.css), evitando
   o "flash" de conteúdo desalinhado que apareceria por uma fração de
   segundo antes do CSS/JS aplicarem os estados iniciais (aba ativa,
   dropzones recolhidas, etc.).
   ============================================================ */

window.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => {
        document.body.classList.add("carregado");
    });
});


/* ============================================================
   MÓDULO 17 — ATALHOS DE TECLADO
   O que este bloco faz: acelera o uso do sistema para quem prefere
   teclado a mouse.
     • Alt + 1..4      -> troca de aba (LME / DOC / EXCEL / BANCO)
     • Ctrl + Enter    -> clica em "GERAR DIEx" (só na página LME)
     • Ctrl+Shift + C  -> clica em "COPIAR TEXTO" (só na página LME)
   ============================================================ */

document.addEventListener("keydown", (e) => {
    // Alt+1..4: troca de aba, na mesma ordem mostrada no rodapé.
    if (e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const nomeAba = ordemPaginas[parseInt(e.key, 10) - 1];
        ativarAba(nomeAba);
        localStorage.setItem("automed_abaAtiva", nomeAba);
        return;
    }

    // Ctrl+Enter: gera o DIEx sem precisar tirar a mão do teclado.
    if (e.ctrlKey && e.key === "Enter" && abaAtualNome === "lme") {
        e.preventDefault();
        document.getElementById("gerarBtn")?.click();
        return;
    }

    // Ctrl+Shift+C: copia o resultado gerado (não conflita com o
    // Ctrl+C normal de copiar texto selecionado).
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c" && abaAtualNome === "lme") {
        e.preventDefault();
        document.getElementById("copiarBtn")?.click();
    }
});


/* ============================================================
   MÓDULO 18 — NOVA CONSULTA (BOTÃO "LIMPAR" DAS DROPZONES)
   O que este bloco faz: em cada página (LME, EXCEL e DOC) existe um
   botão "LIMPAR" ao lado da barra "ANEXAR PDF'S" — ele zera os PDFs
   anexados e os campos daquela página, sem precisar recarregar tudo,
   para começar uma nova consulta do zero.

   O "LIMPAR" é uma caixa independente, irmã da barra (e não um filho
   dela) — ver ".linha-barra-dropzone" no MÓDULO 4 do style.css. Por
   isso o clique aqui não tem como chegar ao listener que recolhe a
   barra, e nenhum "stopPropagation" é necessário. Ele só aparece com a
   dropzone aberta: ao recolher, encolhe até zero e a barra cresce
   ocupando o espaço dele.
   ============================================================ */

/** Volta os cards de "Dados Extraídos" da página LME para o estado vazio ("-"). */
function limparPainelLME() {
    const ids = [
        "dbgPaciente", "dbgMedico", "dbgDataHora", "dbgLocal",
        "dbgEspecialidade", "dbgOM", "dbgOMAbr", "dbgTipoOM"
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "-";
    });
}

// Botão "LIMPAR" da página LME.
document.getElementById("btnLimparLme")?.addEventListener("click", () => {
    // Zera o estado global relacionado à página LME.
    textoPDF = "";
    textoPDFSolicitacao = "";
    arquivoAgendamentoObj = null;
    arquivoSolicitacaoObj = null;
    dadosBancoCarregados = null;

    // Limpa os inputs de arquivo (permite reanexar o mesmo PDF em seguida).
    pdfFile.value = "";
    pdfSolicitacao.value = "";

    const nomeAgendamento = document.getElementById("nomeArquivoAgendamento");
    const nomeSolicitacao = document.getElementById("nomeArquivoSolicitacao");
    if (nomeAgendamento) nomeAgendamento.textContent = "";
    if (nomeSolicitacao) nomeSolicitacao.textContent = "";

    const inputPesquisaBanco = document.getElementById("inputPesquisaBanco");
    if (inputPesquisaBanco) inputPesquisaBanco.value = "";

    limparPainelLME();

    const campoResultado = document.getElementById("resultado");
    if (campoResultado) campoResultado.innerHTML = "";
    localStorage.removeItem("automed_rascunhoResultado");   // ver MÓDULO 21, mais abaixo

    mostrarToast("Campos limpos. Pronto para uma nova consulta.", "sucesso");
});

// Botão "LIMPAR" da página EXCEL.
document.getElementById("btnLimparExcel")?.addEventListener("click", () => {
    textoPDFExcelAgendamento = "";
    textoPDFExcelSolicitacao = "";
    dadosBancoCarregados = null;

    pdfExcelAgendamento.value = "";
    pdfExcelSolicitacao.value = "";

    const nomeAgendamento = document.getElementById("nomeArquivoExcelAgendamento");
    const nomeSolicitacao = document.getElementById("nomeArquivoExcelSolicitacao");
    if (nomeAgendamento) nomeAgendamento.textContent = "";
    if (nomeSolicitacao) nomeSolicitacao.textContent = "";

    const inputPesquisaExcel = document.getElementById("inputPesquisaExcel");
    if (inputPesquisaExcel) inputPesquisaExcel.value = "";

    atualizarLinhaExcel();   // com tudo zerado, isso deixa o campo de resultado vazio

    mostrarToast("Campos limpos. Pronto para uma nova consulta.", "sucesso");
});

// Botão "LIMPAR" da página DOC (limpa os dois modos: LME Scan e Comissão de Ética).
document.getElementById("btnLimparDoc")?.addEventListener("click", () => {
    textoConsultaDoc = "";
    textoSolicitacaoDoc = "";
    textoComissaoEtica = "";
    arquivoRenomear = null;

    pdfConsultaDoc.value = "";
    pdfSolicitacaoDoc.value = "";
    pdfComissaoEtica.value = "";
    pdfRenomear.value = "";

    const idsNomeArquivo = [
        "nomeArquivoConsultaDoc", "nomeArquivoSolicitacaoDoc",
        "nomeArquivoComissaoEtica", "nomeArquivoRenomear"
    ];
    idsNomeArquivo.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "";
    });

    const nomeArquivoGerado = document.getElementById("nomeArquivoGerado");
    if (nomeArquivoGerado) nomeArquivoGerado.value = "";

    const inputPesquisaDoc = document.getElementById("inputPesquisaDoc");
    if (inputPesquisaDoc) inputPesquisaDoc.value = "";

    const idsPainelDoc = [
        "dbgPacienteDoc", "dbgOMAbrDoc", "dbgDataDoc", "dbgEspecialidadeDoc",
        "dbgSessaoComissao", "dbgPacienteComissao", "dbgDataComissao"
    ];
    idsPainelDoc.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "-";
    });

    mostrarToast("Campos limpos. Pronto para uma nova consulta.", "sucesso");
});


/* ============================================================
   MÓDULO 19 — ESTATÍSTICAS DO BANCO DE DADOS (PÁGINA BANCO)
   O que este bloco faz: depois que a pasta do banco é lida (ver
   atualizarListaPacientesBanco, MÓDULO 14), calcula um resumo rápido
   — total de pacientes, OMs e especialidades mais frequentes — e
   mostra na página BANCO.
   ============================================================ */

/** Devolve as "n" chaves mais frequentes de um Map(chave -> quantidade), já formatadas como texto. */
function principaisOcorrencias(mapaContagem, n = 3) {
    return [...mapaContagem.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([nome, quantidade]) => `${nome} (${quantidade})`)
        .join(", ");
}

function atualizarEstatisticasBanco() {
    const painel = document.getElementById("estatisticasBanco");
    if (!painel) return;

    const total = mapaPacientesBanco.size;
    if (total === 0) {
        painel.classList.add("oculto");
        return;
    }

    const contagemOM = new Map();
    const contagemEspecialidade = new Map();

    for (const dados of mapaPacientesBanco.values()) {
        const om = dados.omAbr || "Não informado";
        const especialidade = dados.especialidade || "Não informado";

        contagemOM.set(om, (contagemOM.get(om) || 0) + 1);
        contagemEspecialidade.set(especialidade, (contagemEspecialidade.get(especialidade) || 0) + 1);
    }

    document.getElementById("statTotalPacientes").textContent = total;
    document.getElementById("statTopOMs").textContent = principaisOcorrencias(contagemOM) || "-";
    document.getElementById("statTopEspecialidades").textContent = principaisOcorrencias(contagemEspecialidade) || "-";

    painel.classList.remove("oculto");
}


/* ============================================================
   MÓDULO 20 — BACKUP DO BANCO DE DADOS (EXPORTAR / IMPORTAR)
   O que este bloco faz: junta todos os "dados.json" das subpastas do
   banco em um único arquivo de backup (.json) para download, e faz o
   caminho inverso — lê um backup e recria as pastas que ainda não
   existem no banco conectado.
   ============================================================ */

document.getElementById("btnExportarBackup")?.addEventListener("click", () => {
    if (!dirHandleBanco || mapaPacientesBanco.size === 0) {
        mostrarToast("Conecte o banco e certifique-se de que há pacientes salvos.", "aviso");
        return;
    }

    // Remove o campo interno "_nomePasta" (é só um detalhe da implementação
    // local; não faz sentido guardá-lo dentro do arquivo de backup).
    const todosOsDados = [...mapaPacientesBanco.values()].map(({ _nomePasta, ...resto }) => resto);

    const blob = new Blob([JSON.stringify(todosOsDados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `automed_backup_${new Date().toISOString().slice(0, 10)}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    mostrarToast(`Backup exportado com ${todosOsDados.length} paciente(s)!`, "sucesso");
});

document.getElementById("btnImportarBackup")?.addEventListener("click", () => {
    document.getElementById("inputImportarBackup")?.click();
});

document.getElementById("inputImportarBackup")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!dirHandleBanco) {
        mostrarToast("Conecte a pasta do banco antes de importar um backup.", "aviso");
        e.target.value = "";
        return;
    }

    try {
        const lista = JSON.parse(await file.text());

        if (!Array.isArray(lista)) {
            mostrarToast("Arquivo de backup inválido.", "erro");
            return;
        }

        let importados = 0;
        let ignorados = 0;

        // Salva cada registro sem disparar um toast por item nem
        // revarrer a pasta inteira a cada iteração (ver a assinatura
        // estendida de executarSalvamentoBanco, no MÓDULO 14) —
        // a lista é atualizada e o aviso final aparece uma única vez.
        for (const dados of lista) {
            if (!dados || !dados.paciente) { ignorados++; continue; }

            if (buscarPacienteExistentePorNome(dados.paciente)) {
                ignorados++;   // já existe um registro com esse nome: não sobrescreve
                continue;
            }

            const sucesso = await executarSalvamentoBanco(dados, "", { avisar: false, atualizarLista: false });
            if (sucesso) importados++; else ignorados++;
        }

        await atualizarListaPacientesBanco();
        mostrarToast(`Importação concluída: ${importados} paciente(s) adicionados, ${ignorados} ignorado(s).`, "sucesso");
    } catch (erro) {
        console.error("Erro ao importar backup:", erro);
        mostrarToast("Não foi possível ler o arquivo de backup.", "erro");
    } finally {
        e.target.value = "";
    }
});


/* ============================================================
   MÓDULO 21 — RASCUNHO AUTOMÁTICO DO RESULTADO GERADO (PÁGINA LME)
   O que este bloco faz: salva automaticamente, a cada geração ou
   edição manual, uma cópia do texto do DIEx no localStorage. Se o
   navegador fechar ou recarregar por acidente antes de copiar o
   texto, ele é recuperado sozinho na próxima vez que a página abrir.
   ============================================================ */

const campoResultadoLme = document.getElementById("resultado");

if (campoResultadoLme) {
    campoResultadoLme.addEventListener("input", () => {
        localStorage.setItem("automed_rascunhoResultado", campoResultadoLme.innerHTML);
    });

    // Também salva logo após o botão "GERAR DIEx" preencher o campo.
    document.getElementById("gerarBtn")?.addEventListener("click", () => {
        // Pequeno atraso para rodar depois que o MÓDULO 11 já escreveu o resultado.
        setTimeout(() => {
            if (campoResultadoLme.innerHTML.trim()) {
                localStorage.setItem("automed_rascunhoResultado", campoResultadoLme.innerHTML);
            }
        }, 0);
    });

    // Ao carregar a página, recupera um rascunho não copiado (se existir).
    const rascunhoSalvo = localStorage.getItem("automed_rascunhoResultado");
    if (rascunhoSalvo && rascunhoSalvo.trim() && !campoResultadoLme.innerHTML.trim()) {
        campoResultadoLme.innerHTML = rascunhoSalvo;
        mostrarToast("Um rascunho não copiado foi recuperado.", "aviso");
    }
}
