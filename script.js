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
   22. Visualizador de registros do banco (página BANCO)

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
// CORREÇÃO (v1.5.0): estas duas variáveis guardavam o objeto "File" do
// PDF anexado, que é apenas um ATALHO para o arquivo no disco — não o
// conteúdo dele. Esse atalho vence: se o arquivo for movido, renomeado,
// apagado ou estiver aberto em outro programa, gravá-lo no banco falha.
// Era exatamente o que acontecia ao SUBSTITUIR um paciente cujo PDF
// tinha sido arrastado de dentro da própria pasta do banco: o botão
// apagava a pasta antiga e, junto com ela, o arquivo que ainda seria
// gravado. Agora guardamos { nome, bytes } — os bytes já lidos para a
// memória no momento do anexo, independentes do que ocorra no disco.
let arquivoAgendamentoObj = null;      // { nome, bytes } do PDF de Agendamento
let arquivoSolicitacaoObj = null;      // { nome, bytes } do PDF de Solicitação
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

// Algumas OM já aparecem abreviadas no DIEx, mas com grafia diferente da
// usada em "omsConhecidas" (ex.: o HGuB assina como "H Gu Ba"). Este mapa
// padroniza essas variações. Acrescente aqui novas grafias conforme forem
// aparecendo — a comparação ignora acento, caixa e espaços.
const siglasAlternativasOM = {
    "H Gu Ba": "HGuB",
    "HGuBa": "HGuB"
};

// Trecho do cargo (como aparece no PDF) -> categoria usada para decidir
// pronome ("esse"/"essa") e tratamento ("Comandante"/"Diretor"/"Chefe").
//
// A ORDEM IMPORTA: a busca é por "contém", então os termos mais
// específicos precisam vir antes dos mais genéricos
// (ex.: "CHEFE AO ESCALÃO" antes de "CHEFE").
const cargosConhecidos = {
    "CHEFE AO ESCALAO": "Grande Comando",
    "CHEFE AO ESCALÃO": "Grande Comando",
    "SUBCOMANDANTE": "Comando",
    "COMANDANTE": "Comando",
    // CORREÇÃO: DIEx assinado por Diretor/Diretora é DIREÇÃO, não Comando.
    // Antes o sistema classificava como "Comando" e o texto saía
    // "Informo a esse Comando..." num documento de Direção.
    "SUBDIRETOR": "Direção",
    "DIRETOR": "Direção",       // cobre DIRETOR, DIRETORA, SUBDIRETOR(A)
    "DIREÇÃO": "Direção",
    "DIRECAO": "Direção",
    "CHEFE": "Chefia",
    "CHEFIA": "Chefia"
};

// Para cada tipo de OM, como tratá-la no texto do documento:
//   {PRONOME} {TIPO_OM}  -> "esse Comando" / "essa Direção" / "essa Chefia"
//   {CARGO_OM} do {OM}   -> "Comandante" / "Diretor" / "Chefe"
const tratamentoPorTipoOM = {
    "Comando":        { cargo: "Comandante", pronome: "esse" },
    "Grande Comando": { cargo: "Comandante", pronome: "esse" },
    "Chefia":         { cargo: "Chefe",      pronome: "essa" },
    "Direção":        { cargo: "Diretor",    pronome: "essa" }
};

/** Devolve o par cargo/pronome de um tipo de OM (com "Comando" como padrão). */
function tratamentoDoTipoOM(tipoOM) {
    return tratamentoPorTipoOM[tipoOM] || tratamentoPorTipoOM["Comando"];
}

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
   MÓDULO 4.1 — DIAGNÓSTICO DA EXTRAÇÃO (CONSOLE)
   O que este bloco faz: registra no console do navegador (F12) tudo o
   que o sistema leu dos PDFs e como chegou em cada valor final —
   qual padrão (regex) casou, o que veio "cru" do PDF e qual correção
   foi aplicada em cima disso.

   Como usar:
     • Abra o console (F12) e anexe os PDFs normalmente.
     • Cada leitura imprime um grupo "TEXTO BRUTO DO PDF" e um grupo
       "RASTREIO DA EXTRAÇÃO" com uma tabela campo a campo.
     • Para desligar:  AutoMedDebug.desligar()   (fica salvo no navegador)
     • Para religar:   AutoMedDebug.ligar()
     • Para ver o último texto lido: AutoMedDebug.ultimoTexto()
   ============================================================ */

const DEBUG_EXTRACAO = { ativo: localStorage.getItem("automed_debug") !== "off" };

// Guarda os últimos textos lidos, para inspeção manual no console.
const ultimosTextosPDF = { agendamento: "", solicitacao: "", outro: "" };

// Evita imprimir o mesmo rastreio várias vezes seguidas (a extração é
// reexecutada a cada atualização de painel).
let ultimaAssinaturaExtracao = "";

window.AutoMedDebug = {
    ligar() {
        DEBUG_EXTRACAO.ativo = true;
        localStorage.setItem("automed_debug", "on");
        console.log("%c[AutoMed] Diagnóstico de extração LIGADO.", "color:#0a7;font-weight:bold");
    },
    desligar() {
        DEBUG_EXTRACAO.ativo = false;
        localStorage.setItem("automed_debug", "off");
        console.log("%c[AutoMed] Diagnóstico de extração DESLIGADO.", "color:#a70;font-weight:bold");
    },
    ultimoTexto(qual = "solicitacao") {
        return ultimosTextosPDF[qual] || "";
    }
};

/**
 * Cria um "rastreio": um acumulador de linhas que, no final, vira uma
 * tabela no console mostrando CAMPO / BRUTO / FINAL / REGRA / CORREÇÃO.
 *
 * - registrar(): um campo extraído com sucesso (ou não).
 * - nota():      um raciocínio/decisão que não é um campo (ex.: "usei o
 *                padrão alternativo porque o principal não casou").
 */
function criarRastreio(titulo) {
    const linhas = [];
    const notas = [];

    return {
        registrar(campo, bruto, valorFinal, regra = "", correcao = "") {
            linhas.push({
                Campo: campo,
                "Extraído do PDF (bruto)": bruto === undefined || bruto === null || bruto === ""
                    ? "— (não encontrado)"
                    : String(bruto),
                "Valor final": valorFinal === undefined || valorFinal === null || valorFinal === ""
                    ? "— (vazio)"
                    : String(valorFinal),
                "Regra usada": regra,
                "Correção aplicada": correcao || (String(bruto ?? "") === String(valorFinal ?? "") ? "nenhuma" : "normalização")
            });
        },

        nota(mensagem) {
            notas.push(mensagem);
        },

        imprimir() {
            if (!DEBUG_EXTRACAO.ativo) return;

            console.groupCollapsed(`%c🩺 AutoMed — ${titulo}`, "color:#0a7;font-weight:bold");

            if (typeof console.table === "function") {
                console.table(linhas);
            } else {
                linhas.forEach(l => console.log(l));
            }

            if (notas.length) {
                console.groupCollapsed("%c🧠 Como o sistema raciocinou", "color:#06c;font-weight:bold");
                notas.forEach(n => console.log("•", n));
                console.groupEnd();
            }

            // Campos que ficaram vazios são o ponto mais comum de erro:
            // ganham um aviso separado para não se perderem na tabela.
            const vazios = linhas.filter(l => l["Valor final"] === "— (vazio)").map(l => l.Campo);
            if (vazios.length) {
                console.warn("⚠️ Campos que NÃO foram preenchidos:", vazios.join(", "));
            }

            console.groupEnd();
        }
    };
}

/** Mostra no console o texto cru que o pdf.js conseguiu ler do arquivo. */
function logTextoBrutoPDF(rotulo, nomeArquivo, texto, numPaginas) {
    if (rotulo in ultimosTextosPDF) ultimosTextosPDF[rotulo] = texto;
    else ultimosTextosPDF.outro = texto;

    if (!DEBUG_EXTRACAO.ativo) return;

    console.groupCollapsed(
        `%c📄 AutoMed — TEXTO BRUTO DO PDF (${rotulo}): ${nomeArquivo}`,
        "color:#a06;font-weight:bold"
    );
    console.log(`Páginas: ${numPaginas} | Caracteres lidos: ${texto.length}`);
    console.log(texto);
    if (!texto.trim()) {
        console.warn("⚠️ O PDF não devolveu texto algum — provavelmente é um PDF digitalizado (imagem), sem camada de texto.");
    }
    console.groupEnd();
}

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

/** Chave de comparação "frouxa": sem acento, sem pontuação, sem espaço e em maiúsculas. */
function chaveComparacao(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")   // tira acentos
        .replace(/[^a-zA-Z0-9]/g, "")      // tira espaços e pontuação
        .toUpperCase();
}

/**
 * Devolve a sigla da OM se ela estiver cadastrada; senão, devolve o nome original.
 * A busca é feita em 4 passadas, da mais rígida para a mais tolerante:
 *   1) nome exato como está no dicionário;
 *   2) nome ignorando acento/caixa/espaço (o PDF varia muito);
 *   3) o texto JÁ é uma sigla conhecida (ex.: "3º RCG") — devolve na forma oficial;
 *   4) o texto é uma grafia alternativa cadastrada (ex.: "H Gu Ba" -> "HGuB").
 */
function abreviarOM(om, rastreio = null) {
    if (!om) return "";

    if (omsConhecidas[om]) {
        rastreio?.nota(`OM "${om}" encontrada no dicionário (nome exato) → sigla "${omsConhecidas[om]}".`);
        return omsConhecidas[om];
    }

    const alvo = chaveComparacao(om);

    for (const nomeCompleto in omsConhecidas) {
        if (chaveComparacao(nomeCompleto) === alvo) {
            rastreio?.nota(`OM "${om}" bateu com "${nomeCompleto}" ignorando acento/caixa/espaço → sigla "${omsConhecidas[nomeCompleto]}".`);
            return omsConhecidas[nomeCompleto];
        }
    }

    for (const nomeCompleto in omsConhecidas) {
        if (chaveComparacao(omsConhecidas[nomeCompleto]) === alvo) {
            rastreio?.nota(`O PDF já trouxe a OM abreviada ("${om}") → padronizada para "${omsConhecidas[nomeCompleto]}".`);
            return omsConhecidas[nomeCompleto];
        }
    }

    for (const variacao in siglasAlternativasOM) {
        if (chaveComparacao(variacao) === alvo) {
            rastreio?.nota(`Sigla "${om}" reconhecida como variação de "${siglasAlternativasOM[variacao]}" (mapa "siglasAlternativasOM").`);
            return siglasAlternativasOM[variacao];
        }
    }

    rastreio?.nota(`OM "${om}" NÃO está no dicionário "omsConhecidas" — mantida exatamente como veio do PDF. Se quiser a sigla oficial, cadastre-a nesse dicionário.`);
    return om;
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

/**
 * Isola o "bloco do remetente" do DIEx — o trecho que vai do "Do/Da"
 * até o destinatário ("Ao", "À", "A Sr..."). Ex.: "Diretor do H Gu Ba".
 *
 * CORREÇÃO: a versão anterior exigia que o destinatário começasse com
 * "Ao" (regex /Do\s+(.*?)\s+Ao/). Em DIEx endereçados a uma mulher o
 * cabeçalho é "À Sra Diretora do HMAPA", então nada casava e o sistema
 * caía silenciosamente no padrão "Comando". Agora aceita Ao / À / A Sr(a)
 * e ignora candidatos que não contenham um cargo conhecido (evita casar
 * com "Do MINISTÉRIO DA DEFESA..." no cabeçalho).
 */
function extrairBlocoRemetente(textoSolicitacao, rastreio = null) {
    if (!textoSolicitacao) return "";

    // [\s\S] em vez de "." para funcionar mesmo com quebras de linha no meio.
    const regex = /\bD[oa]\s+([\s\S]{3,120}?)\s+(?:Ao\b|A\s+Sr|À)/gi;

    for (const match of textoSolicitacao.matchAll(regex)) {
        const bloco = normalizarTexto(match[1]);

        if (/(comandante|chefe|diretor|diretora|chefia|dire[çc][ãa]o)/i.test(bloco)) {
            rastreio?.nota(`Bloco do remetente localizado entre "Do/Da" e o destinatário (Ao/À/A Sr): "${bloco}".`);
            return bloco;
        }

        rastreio?.nota(`Trecho "${bloco}" descartado: não contém um cargo conhecido (comandante/chefe/diretor).`);
    }

    rastreio?.nota('Nenhum bloco "Do <cargo> ... Ao/À ..." foi encontrado no PDF de Solicitação.');
    return "";
}

/** Extrai o nome completo da OM que está solicitando o exame, a partir do PDF de Solicitação. */
function extrairOMSolicitante(textoSolicitacao, rastreio = null) {
    const bloco = extrairBlocoRemetente(textoSolicitacao, rastreio);
    if (!bloco) return "";

    // "Diretor do H Gu Ba"           -> "H Gu Ba"
    // "Comandante da 3ª Cia Inf"     -> "3ª Cia Inf"
    // "Chefe da Seção de Saúde do X" -> "Seção de Saúde do X"  (corta só o 1º "do/da")
    const match = bloco.match(/^(.*?)\s+(?:do|da|de|dos|das)\s+(.+)$/i);

    if (!match) {
        rastreio?.nota(`O bloco "${bloco}" não tem o formato "<cargo> do <OM>" — usado inteiro como nome da OM.`);
        return bloco;
    }

    rastreio?.nota(`Cargo "${match[1]}" separado do nome da OM "${match[2]}".`);
    return normalizarTexto(match[2]);
}

/**
 * Classifica a OM solicitante em Comando / Direção / Chefia / Grande
 * Comando, com base no cargo de quem assina o DIEx.
 */
function extrairTipoOM(textoSolicitacao, rastreio = null) {
    const bloco = extrairBlocoRemetente(textoSolicitacao);

    if (!bloco) {
        rastreio?.nota('Cargo do remetente não identificado → assumido "Comando" (padrão).');
        return "Comando";
    }

    const cargo = bloco.toUpperCase();

    for (const chave in cargosConhecidos) {
        if (cargo.includes(chave.toUpperCase())) {
            rastreio?.nota(`Cargo "${bloco}" contém "${chave}" → tipo de OM = "${cargosConhecidos[chave]}".`);
            return cargosConhecidos[chave];
        }
    }

    rastreio?.nota(`Cargo "${bloco}" não bateu com nenhum item de "cargosConhecidos" → assumido "Comando" (padrão).`);
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

    const rastreio = criarRastreio("RASTREIO DA EXTRAÇÃO (Marcação + Solicitação)");
    let regraPaciente = "Paciente: <cód> - <nome> ... Médico(a)/Profissional:";

    if (!paciente) {
        rastreio.nota('Padrão principal do paciente não casou — tentando o alternativo ("Especialidade: ... Agendamento:").');
        regraPaciente = "ALTERNATIVO: Especialidade: <nome> Agendamento:";
        paciente = normalizarTexto(
            extrair(texto, /Especialidade:\s*([A-ZÀ-Ú\s]+?)\s*Agendamento:/i)
        );
    }

    rastreio.registrar("paciente", paciente, paciente, regraPaciente);

    // --- Médico: idem, com um padrão alternativo de fallback ---
    let medico = normalizarTexto(
        extrair(texto, /Médico\(a\)\/Profissional:\s*([A-ZÀ-Ú]+)/i)
    );
    let regraMedico = "Médico(a)/Profissional: <nome>";

    if (!medico) {
        rastreio.nota('Padrão principal do médico não casou — tentando o alternativo ("Usuário Marcação: ... Médico/Prof.:").');
        regraMedico = "ALTERNATIVO: Usuário Marcação: ... Médico/Prof.:";
        const match = texto.match(
            /Usuário Marcação:\s*[A-ZÀ-Ú]+\s*([A-ZÀ-Ú]+)\s*Médico\/Prof\.:/i
        );
        if (match) medico = normalizarTexto(match[1]);
    }

    rastreio.registrar("medico", medico, medico, regraMedico);

    // --- Data e hora da consulta ---
    let dataHora = extrair(
        texto, /Dia da Consulta:\s*([0-9\/]{10}\s*-\s*[0-9:]{5})/i
    );

    let regraDataHora = "Dia da Consulta: dd/mm/aaaa - hh:mm";

    if (!dataHora) {
        rastreio.nota('Padrão "Dia da Consulta:" não casou — montando a data/hora a partir de "Agendamento:" + primeiro horário do texto.');
        regraDataHora = "ALTERNATIVO: Agendamento: <data> + primeiro hh:mm do texto";

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

    rastreio.registrar("dataHora", dataHora, dataHora, regraDataHora);
    rastreio.registrar("data / horario", dataHora, `${data} | ${horario}`, "separação pelo hífen", "dataHora dividida em data e horário");

    // --- Local do atendimento: padrão principal e um alternativo ---
    let local = extrair(
        texto, /Local da Consulta:\s*(.*?)Usuário da Marcação/i
    );

    const localBruto = local;
    let regraLocal = "Local da Consulta: ... Usuário da Marcação";

    if (local) {
        const match = local.match(/(.*?)\s*-\s*(.*)/i);
        if (match) {
            const bloco1 = capitalizarPalavras(match[1]);
            const bloco2 = adicionarNumeroLocal(capitalizarPalavras(match[2]));
            local = `${bloco1}, ${bloco2}`;
        }
    }

    if (!local) {
        rastreio.nota('Padrão principal do local não casou — tentando o alternativo ("manhã/tarde ... Local Consulta: ... Usuário Marcação:").');
        regraLocal = "ALTERNATIVO: manhã|tarde ... Local Consulta: ... Usuário Marcação:";

        const match = texto.match(
            /(?:manh[aã]|tarde)\s+(.*?)\s+Local\s+Consulta:\s*(.*?)\s*Usuário\s+Marcação:/i
        );
        if (match) {
            const bloco1 = capitalizarPalavras(match[1]);
            const bloco2 = adicionarNumeroLocal(capitalizarPalavras(match[2]));
            local = `${bloco1}, ${bloco2}`;
        }
    }

    rastreio.registrar(
        "local", localBruto, local, regraLocal,
        localBruto === local ? "nenhuma" : 'hífen virou vírgula, capitalização e "nº" no número da sala'
    );

    // --- Número do DIEx de solicitação (se o PDF de solicitação foi anexado) ---
    let numeroDIEx = "";
    if (textoSolicitacao) {
        const matchNum = textoSolicitacao.match(/DIEx\s*n[º°]?\s*(\d+)/i);
        if (matchNum) {
            numeroDIEx = matchNum[1];
        }
        rastreio.registrar("numeroDIEx", matchNum?.[0], numeroDIEx, "DIEx nº <número>", "mantido só o número");
    } else {
        rastreio.nota("PDF de Solicitação não anexado — OM, tipo de OM, número e data do DIEx ficarão em branco.");
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

        let regraDataDIEx = "";
        let brutoDataDIEx = "";

        if (matchDataExtenso) {
            // Ex.: "5 de junho de 2026"
            regraDataDIEx = "1º) data por extenso: <dia> de <mês> de <ano>";
            brutoDataDIEx = matchDataExtenso[0];
            const dia = matchDataExtenso[1].padStart(2, '0');
            const mesNome = matchDataExtenso[2].toLowerCase();
            const ano = matchDataExtenso[3].length === 2 ? `20${matchDataExtenso[3]}` : matchDataExtenso[3];
            const mes = mesesNum[mesNome] || "01";
            if (!mesesNum[mesNome]) {
                rastreio.nota(`⚠️ Mês "${matchDataExtenso[2]}" não reconhecido na data do DIEx — assumido "01" (janeiro).`);
            }
            dataDIEx = `${dia}/${mes}/${ano}`;
        } else if (matchDataMilitar) {
            // Ex.: "de 5 JUN 26"
            regraDataDIEx = "2º) data militar: de <dia> <MES> <ano>";
            brutoDataDIEx = matchDataMilitar[0];
            const dia = matchDataMilitar[1].padStart(2, '0');
            const mesNome = matchDataMilitar[2].toLowerCase();
            const ano = matchDataMilitar[3].length === 2 ? `20${matchDataMilitar[3]}` : matchDataMilitar[3];
            const mes = mesesNum[mesNome] || "01";
            dataDIEx = `${dia}/${mes}/${ano}`;
        } else if (matchDataAssinatura) {
            // Ex.: "...em 05/06/2026, às..."
            regraDataDIEx = "3º) data da assinatura eletrônica: em <dd/mm/aaaa>, às";
            brutoDataDIEx = matchDataAssinatura[0];
            dataDIEx = formatarData(matchDataAssinatura[1]);
        } else {
            // Último recurso: qualquer data solta no texto que não seja a data de nascimento.
            regraDataDIEx = "4º) ÚLTIMO RECURSO: primeira data solta do texto";
            const matchDataSeparador = textoSolicitacao.match(/(?<!Nascimento:\s*)\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/i);
            if (matchDataSeparador) {
                brutoDataDIEx = matchDataSeparador[0];
                dataDIEx = formatarData(matchDataSeparador[1]);
                rastreio.nota(`⚠️ A data do DIEx veio do último recurso (data solta no texto): "${brutoDataDIEx}". Confira se é mesmo a data do documento.`);
            }
        }

        rastreio.registrar("dataDIEx", brutoDataDIEx, dataDIEx, regraDataDIEx, "convertida para dd/mm/aaaa");
    }

    // --- Campos derivados (calculados a partir dos anteriores) ---
    const especialidade = formatarEspecialidade(texto);
    const especialidadeCrua = extrairEspecialidadeCrua(texto);

    rastreio.registrar(
        "especialidade", especialidadeCrua, especialidade,
        "primeira especialidade da lista 'especialidadesConhecidas' encontrada no texto",
        especialidadeCrua ? "capitalizada" : "nenhuma especialidade da lista foi encontrada no PDF"
    );

    const om = extrairOMSolicitante(textoSolicitacao, rastreio);
    const omAbr = abreviarOM(om, rastreio);
    const tipoOM = extrairTipoOM(textoSolicitacao, rastreio);

    // CORREÇÃO: antes só existiam duas saídas ("Comando" ou "Chefe"/"essa"),
    // então um DIEx de Direção era tratado como Comando. Agora cada tipo de
    // OM tem seu próprio tratamento (ver tratamentoPorTipoOM, MÓDULO 4).
    const { cargo: cargoOM, pronome } = tratamentoDoTipoOM(tipoOM);

    rastreio.registrar("om", om, omAbr, "bloco 'Do <cargo> do <OM>' do DIEx", om === omAbr ? "nenhuma (não cadastrada em omsConhecidas)" : "trocada pela sigla oficial");
    rastreio.registrar("tipoOM", om ? "cargo do remetente" : "", tipoOM, "dicionário 'cargosConhecidos'", `texto sairá como "${pronome} ${tipoOM}" e "${cargoOM} do ${omAbr || "<OM>"}"`);

    const dataMilitar = formatarDataMilitar(data);
    const dataNomeArquivo = formatarDataNomeArquivo(data);

    rastreio.registrar("dataMilitar", data, dataMilitar, "dd/mm/aaaa → d MES aa", "formato militar");

    // A extração roda várias vezes (a cada atualização de painel) com o mesmo
    // conteúdo. Só imprime quando o par de PDFs realmente mudou, para o console
    // não encher de grupos repetidos.
    const assinatura = `${texto.length}|${(textoSolicitacao || "").length}|${paciente}|${omAbr}`;
    if (assinatura !== ultimaAssinaturaExtracao) {
        ultimaAssinaturaExtracao = assinatura;
        rastreio.imprimir();
    }

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

    const assinatura = `etica|${texto.length}|${paciente}|${sessao}`;
    if (assinatura !== ultimaAssinaturaExtracao) {
        ultimaAssinaturaExtracao = assinatura;

        const rastreio = criarRastreio("RASTREIO DA EXTRAÇÃO (Comissão de Ética)");
        rastreio.registrar("sessao", matchSessao?.[1], sessao, "Sessão: <n>/<ano>", "espaços removidos");
        rastreio.registrar("paciente", matchPaciente?.[1], paciente, "Paciente: <nome> Solicitante", "convertido para MAIÚSCULAS");
        rastreio.registrar("data", data, dataFormatada, "primeira data dd/mm/aaaa do texto", "convertida para o formato militar");
        rastreio.imprimir();
    }

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
 * @param {(conteudo:{nome:string, bytes:ArrayBuffer})=>void} [aoCapturarBytes] -
 *        recebe uma CÓPIA independente do conteúdo do arquivo, para quem
 *        precisar gravá-lo depois (ver MÓDULO 14 — banco de dados).
 */
/**
 * Descobre, pelo id do rótulo, qual PDF está sendo lido — só para
 * identificar o arquivo nos grupos do console (MÓDULO 4.1).
 */
function rotuloDoPDF(idElementoNome) {
    if (/Solicitacao/i.test(idElementoNome)) return "solicitacao";
    if (/ComissaoEtica/i.test(idElementoNome)) return "comissao-etica";
    if (/Agendamento|Consulta/i.test(idElementoNome)) return "agendamento";
    return "outro";
}

function lerTextoDePDF(file, idElementoNome, aoConcluir, mensagemErro, aoCapturarBytes) {
    // Mostra o nome do arquivo imediatamente, antes mesmo da leitura terminar
    // (feedback visual rápido para o usuário).
    document.getElementById(idElementoNome).textContent = file.name;

    const reader = new FileReader();

    // Executa quando o arquivo termina de ser carregado em memória.
    reader.onload = async function () {
        try {
            // CORREÇÃO (v1.5.0): a cópia dos bytes é feita ANTES de entregar
            // o arquivo ao pdf.js. A biblioteca "transfere" o bloco de
            // memória para o seu worker interno, e depois disso o original
            // fica inutilizável — por isso a cópia (slice) precisa vir
            // primeiro. É essa cópia que será gravada no banco.
            if (typeof aoCapturarBytes === "function") {
                aoCapturarBytes({ nome: file.name, bytes: this.result.slice(0) });
            }

            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let texto = "";

            // Percorre cada página do PDF e concatena o texto de todas elas.
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                texto += content.items.map(item => item.str).join(" ") + " ";
            }

            // Diagnóstico: mostra no console exatamente o que o pdf.js leu,
            // antes de qualquer regex rodar em cima (ver MÓDULO 4.1).
            logTextoBrutoPDF(rotuloDoPDF(idElementoNome), file.name, texto, pdf.numPages);

            aoConcluir(texto);

        } catch (erro) {
            console.error("Falha ao ler o PDF:", file.name, erro);
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
    arquivoAgendamentoObj = null;   // só volta a valer quando os bytes forem lidos, logo abaixo
    dadosBancoCarregados = null;   // um novo PDF anexado invalida o paciente carregado do banco

    lerTextoDePDF(
        file,
        "nomeArquivoAgendamento",
        texto => {
            textoPDF = texto;
            atualizarPainelLME();
        },
        "Erro ao ler o PDF.",
        conteudo => { arquivoAgendamentoObj = conteudo; }
    );
}

function lerPDFSolicitacao(file) {
    arquivoSolicitacaoObj = null;   // idem: preenchido ao terminar a leitura
    dadosBancoCarregados = null;

    lerTextoDePDF(
        file,
        "nomeArquivoSolicitacao",
        texto => {
            textoPDFSolicitacao = texto;
            atualizarPainelLME();
        },
        "Erro ao ler PDF de solicitação.",
        conteudo => { arquivoSolicitacaoObj = conteudo; }
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

    // v1.5.0: redesenha a lista visual de registros da página BANCO
    // (ver MÓDULO 22). Fica aqui, e não em cada botão, para que QUALQUER
    // mudança no banco — conectar, salvar, excluir, importar backup —
    // apareça na tela sem ninguém precisar lembrar de atualizar.
    renderizarRegistrosBanco();
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
 * Troca por "_" os caracteres que o Windows não aceita em nome de
 * pasta/arquivo, e mais o que a File System Access API do navegador
 * recusa em getDirectoryHandle/getFileHandle.
 *
 * CORREÇÃO: a versão anterior só trocava os caracteres proibidos. Isso
 * deixava passar nome vazio, "." e "..", finais com ponto ou espaço e
 * nomes reservados do Windows (CON, PRN, COM1...), que o navegador
 * rejeita com "TypeError: ... Name is not allowed".
 */
function sanitizarNomePasta(texto, alternativo = "Sem nome") {
    let limpo = String(texto ?? "")
        .replace(/[\/\\:*?"<>|]/g, "_")     // proibidos no SO e na API
        .replace(/[\u0000-\u001F\u007F]/g, "")   // caracteres de controle
        .replace(/\s{2,}/g, " ")
        .trim()
        .replace(/[.\s]+$/g, "");           // Windows não aceita final com "." ou espaço

    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i.test(limpo)) {
        limpo = `_${limpo}`;
    }

    if (!limpo || limpo === "." || limpo === "..") {
        limpo = alternativo;
    }

    // Limite conservador para não estourar o caminho máximo do sistema.
    return limpo.slice(0, 150).trim().replace(/[.\s]+$/g, "") || alternativo;
}

/**
 * Monta o nome padronizado da pasta de um paciente
 * ("PACIENTE - OM - DATA"). Existe como função própria porque três
 * lugares diferentes precisam chegar EXATAMENTE ao mesmo nome:
 * salvar, substituir e renomear ao editar (MÓDULO 22).
 *
 * CORREÇÃO: só o nome do paciente passava pela limpeza. A sigla da OM
 * pode conter barra ("AD/3", "PqRMnt/3", "B Adm Ap/ 3ª RM") — e aí o
 * navegador lia o nome como CAMINHO e recusava a criação da pasta com
 * "Name is not allowed". Agora a limpeza vale para o nome inteiro, e
 * partes vazias não entram (nada de "FULANO -  - ").
 */
function montarNomePastaPaciente(dados, sufixoPasta = "") {
    const pacienteLimpo = sanitizarNomePasta(dados.paciente, "Paciente");

    const partes = [
        pacienteLimpo,
        String(dados.omAbr || "").trim(),
        String(dados.dataNomeArquivo || "").trim()
    ].filter(Boolean);

    let nomePasta = partes.join(" - ");
    if (sufixoPasta) nomePasta += ` ${sufixoPasta}`;

    return sanitizarNomePasta(nomePasta, pacienteLimpo);
}

/** Descobre se um arquivo já existe dentro de uma pasta, sem criá-lo. */
async function arquivoExisteNaPasta(pastaHandle, nomeArquivo) {
    try {
        await pastaHandle.getFileHandle(nomeArquivo);
        return true;
    } catch {
        return false;
    }
}

/**
 * Grava um arquivo dentro de uma pasta de forma segura.
 *
 * CORREÇÃO (v1.5.0): a versão anterior criava o arquivo e só depois
 * tentava escrever o conteúdo. Quando a escrita falhava, sobrava no
 * disco um arquivo de 0 byte — que aparecia na pasta como se fosse um
 * PDF válido, mas dava erro ao abrir. Aqui, se a escrita falhar:
 *   • o conteúdo anterior é preservado (writer.abort());
 *   • se o arquivo tinha acabado de ser criado, ele é apagado;
 *   • o erro é repassado para quem chamou, com o motivo técnico real.
 */
async function gravarArquivoNaPasta(pastaHandle, nomeArquivo, conteudo) {
    const jaExistia = await arquivoExisteNaPasta(pastaHandle, nomeArquivo);
    const fileHandle = await pastaHandle.getFileHandle(nomeArquivo, { create: true });
    const writer = await fileHandle.createWritable();

    try {
        await writer.write(conteudo);
        await writer.close();
    } catch (erro) {
        try { await writer.abort(); } catch { /* o writer já pode ter morrido junto */ }
        if (!jaExistia) {
            try { await pastaHandle.removeEntry(nomeArquivo); } catch { /* nada a limpar */ }
        }
        throw erro;
    }
}

/**
 * Copia para "pastaDestino" os arquivos de "pastaOrigem" que ainda não
 * existem lá. Usado para não perder os PDFs antigos quando um registro
 * muda de pasta (substituição ou edição do nome/OM/data).
 * @param {(nome:string)=>string} [mapearNome] - permite gravar o arquivo
 *        com outro nome no destino (usado ao corrigir o nome do
 *        paciente, que aparece dentro do nome do PDF).
 */
async function copiarArquivosDaPasta(pastaOrigem, pastaDestino, ignorar = ["dados.json"], mapearNome = null) {
    for await (const entrada of pastaOrigem.values()) {
        if (entrada.kind !== "file") continue;
        if (ignorar.includes(entrada.name)) continue;

        const nomeDestino = typeof mapearNome === "function" ? mapearNome(entrada.name) : entrada.name;
        if (await arquivoExisteNaPasta(pastaDestino, nomeDestino)) continue;

        const arquivo = await entrada.getFile();
        await gravarArquivoNaPasta(pastaDestino, nomeDestino, await arquivo.arrayBuffer());
    }
}

/** Remove os campos internos do sistema (começados com "_") antes de gravar o JSON no disco. */
function limparCamposInternos(dados) {
    const copia = { ...dados };
    for (const chave of Object.keys(copia)) {
        if (chave.startsWith("_")) delete copia[chave];
    }
    return copia;
}

/** Monta a lista de PDFs a gravar a partir do que está anexado na página LME. */
function anexosDaPaginaLME(dados) {
    const pacienteLimpo = sanitizarNomePasta(dados.paciente);
    const lista = [];

    if (arquivoAgendamentoObj && arquivoAgendamentoObj.bytes) {
        lista.push({ nome: `Marcação - ${pacienteLimpo}.pdf`, bytes: arquivoAgendamentoObj.bytes });
    }
    if (arquivoSolicitacaoObj && arquivoSolicitacaoObj.bytes) {
        lista.push({ nome: `Solicitação - ${pacienteLimpo}.pdf`, bytes: arquivoSolicitacaoObj.bytes });
    }
    return lista;
}

/**
 * Cria (ou reutiliza) uma subpasta para o paciente e grava dentro dela
 * o "dados.json" e os PDFs anexados.
 * @param {string} sufixoPasta - texto extra no nome da pasta, usado para não colidir ao "Salvar Ambos".
 * @param {{avisar?: boolean, atualizarLista?: boolean, arquivos?: Array}} opcoes -
 *        "arquivos" permite passar uma lista própria de anexos; quando
 *        vem uma lista vazia, nenhum PDF é gravado (é o caso da
 *        importação de backup — ver MÓDULO 20).
 * @returns {{ok: boolean, nomePasta: string, motivo: string}}
 */
async function executarSalvamentoBanco(dados, sufixoPasta = "", opcoes = {}) {
    const { avisar = true, atualizarLista = true, arquivos = null } = opcoes;

    const nomePasta = montarNomePastaPaciente(dados, sufixoPasta);
    const anexos = arquivos !== null ? arquivos : anexosDaPaginaLME(dados);

    let pastaHandle;

    // Etapa 1: a pasta do paciente.
    try {
        pastaHandle = await dirHandleBanco.getDirectoryHandle(nomePasta, { create: true });
    } catch (erro) {
        console.error("Erro ao criar a pasta do paciente:", erro);
        if (avisar) mostrarToast(`Não foi possível criar a pasta do paciente (${erro.name || "erro"}).`, "erro");
        return { ok: false, nomePasta, motivo: `não foi possível criar a pasta (${erro.name || "erro"})` };
    }

    // Etapa 2: o dados.json.
    try {
        await gravarArquivoNaPasta(pastaHandle, "dados.json", JSON.stringify(limparCamposInternos(dados), null, 4));
    } catch (erro) {
        console.error("Erro ao gravar o dados.json:", erro);
        if (avisar) mostrarToast(`Não foi possível gravar o dados.json (${erro.name || "erro"}).`, "erro");
        return { ok: false, nomePasta, motivo: `falha ao gravar o dados.json (${erro.name || "erro"})` };
    }

    // Etapa 3: os PDFs — CADA UM em seu próprio tratamento de erro.
    // CORREÇÃO (v1.5.0): antes, tudo ficava dentro de um único "try". Se a
    // gravação do primeiro PDF falhasse, o segundo simplesmente nunca era
    // tentado e a mensagem sempre culpava a permissão da pasta, qualquer
    // que fosse o motivo real. Agora uma falha não derruba as outras
    // gravações e o aviso diz QUAL arquivo falhou e POR QUÊ.
    const falhas = [];
    for (const anexo of anexos) {
        try {
            await gravarArquivoNaPasta(pastaHandle, anexo.nome, anexo.bytes);
        } catch (erro) {
            console.error(`Erro ao gravar "${anexo.nome}":`, erro);
            falhas.push(`${anexo.nome} (${erro.name || "erro"})`);
        }
    }

    if (atualizarLista) await atualizarListaPacientesBanco();

    if (falhas.length > 0) {
        if (avisar) mostrarToast(`Dados salvos, mas falhou ao gravar: ${falhas.join(", ")}.`, "erro");
        return { ok: false, nomePasta, motivo: `falha ao gravar ${falhas.join(", ")}` };
    }

    if (avisar) mostrarToast("Dados salvos no banco com sucesso!", "sucesso");
    return { ok: true, nomePasta, motivo: "" };
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

    // Modal Duplicidade - Substituir (grava o novo registro e só então apaga o antigo)
    //
    // CORREÇÃO (v1.5.0) — três problemas nesta ação:
    //   1. A pasta antiga era apagada ANTES de gravar a nova. Quem arrasta
    //      um PDF de dentro da própria pasta do banco (ex.: reaproveitar o
    //      DIEx de solicitação numa remarcação) tinha o arquivo apagado no
    //      meio do caminho — daí o "Erro ao salvar" e o PDF que sumia.
    //   2. Os PDFs antigos eram perdidos quando o novo salvamento não
    //      trazia anexos (paciente carregado pela barra de pesquisa).
    //   3. O aviso "substituído com sucesso" aparecia mesmo quando o
    //      salvamento tinha falhado.
    else if (btn.id === "btnModalSubstituir") {
        if (!pacienteExistenteModal || !pacienteNovoModal) return;

        const existente = pacienteExistenteModal;
        const novo = pacienteNovoModal;
        fecharModalDuplicidade();

        const nomePastaNova = montarNomePastaPaciente(novo);

        // 1) Grava o registro novo primeiro. Nada é apagado até aqui.
        const resultado = await executarSalvamentoBanco(novo, "", { avisar: false, atualizarLista: false });

        if (!resultado.ok) {
            await atualizarListaPacientesBanco();
            mostrarToast(`Nada foi substituído: ${resultado.motivo}.`, "erro");
            return;
        }

        // 2) Só agora cuida da pasta antiga — levando junto os arquivos
        //    que existiam lá e não foram regravados agora.
        if (existente._nomePasta && existente._nomePasta !== nomePastaNova) {
            try {
                const pastaAntiga = await dirHandleBanco.getDirectoryHandle(existente._nomePasta);
                const pastaNova = await dirHandleBanco.getDirectoryHandle(nomePastaNova);

                await copiarArquivosDaPasta(pastaAntiga, pastaNova);
                await dirHandleBanco.removeEntry(existente._nomePasta, { recursive: true });
            } catch (erro) {
                console.error("Erro ao remover a pasta antiga:", erro);
                mostrarToast("Registro novo salvo, mas a pasta antiga não pôde ser apagada.", "aviso");
                await atualizarListaPacientesBanco();
                return;
            }
        }

        await atualizarListaPacientesBanco();
        mostrarToast("Registro antigo substituído com sucesso!", "sucesso");
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

            // v1.5.0: o cartão aberto no visualizador (MÓDULO 22) pode ser
            // justamente o que acabou de sumir do disco — fecha antes de
            // redesenhar para não deixar campos órfãos na tela.
            if (typeof fecharRegistroAberto === "function") fecharRegistroAberto();

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

/** Concorda o número com a palavra ("1 paciente" / "12 pacientes"). */
function contagemPorExtenso(quantidade, singular, plural) {
    return `${quantidade} ${quantidade === 1 ? singular : plural}`;
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

    // REVISÃO (v1.5.3): o resumo deixou de ser um cartão solto e virou a
    // primeira LINHA do banco (ver o HTML da página BANCO). São dois
    // níveis de informação agora: a linha fechada mostra só os totais,
    // uma por coluna, seguindo a mesma divisão das linhas de paciente
    // logo abaixo; o corpo aberto mostra o detalhamento.
    document.getElementById("statResumoPacientes").textContent =
        contagemPorExtenso(total, "paciente", "pacientes");
    document.getElementById("statResumoOMs").textContent =
        contagemPorExtenso(contagemOM.size, "OM", "OMs");
    document.getElementById("statResumoEspecialidades").textContent =
        contagemPorExtenso(contagemEspecialidade.size, "especialidade", "especialidades");

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

            // CORREÇÃO (v1.5.0): "arquivos: []" impede que os PDFs que
            // estiverem anexados na aba LME neste momento sejam copiados
            // para dentro da pasta de TODOS os pacientes importados — era
            // o que acontecia antes, porque o salvamento sempre olhava as
            // variáveis globais de anexo.
            const resultado = await executarSalvamentoBanco(dados, "", { avisar: false, atualizarLista: false, arquivos: [] });
            if (resultado.ok) importados++; else ignorados++;
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
    // REVISÃO (v1.5.2): a recuperação continua acontecendo — o texto ainda
    // aparece sozinho no campo "Resultado" — mas o aviso em tela foi
    // removido a pedido do usuário, que achava a mensagem incômoda.
    const rascunhoSalvo = localStorage.getItem("automed_rascunhoResultado");
    if (rascunhoSalvo && rascunhoSalvo.trim() && !campoResultadoLme.innerHTML.trim()) {
        campoResultadoLme.innerHTML = rascunhoSalvo;
    }
}


/* ============================================================
   MÓDULO 22 — VISUALIZADOR DE REGISTROS DO BANCO (PÁGINA BANCO)
   O que este bloco faz: mostra, dentro da barra recolhível "BANCO DE
   DADOS", a lista dos pacientes salvos na pasta do banco. Cada linha
   abre em sanfona e revela:
     • os campos do "dados.json", já editáveis;
     • os PDFs guardados na pasta daquele paciente;
     • os botões SALVAR ALTERAÇÕES, USAR NO (LME/EXCEL/DOC) e EXCLUIR.

   COMO ELE SE ENCAIXA NO RESTO DO SISTEMA
   Ele não lê a pasta por conta própria: aproveita o índice que o
   MÓDULO 14 já monta em "mapaPacientesBanco" toda vez que a pasta é
   varrida. Por isso a última linha de "atualizarListaPacientesBanco"
   chama a função de desenhar a lista — sempre que o banco muda (ao
   conectar, salvar, excluir ou importar), a tela se redesenha sozinha.

   O QUE É CALCULADO E O QUE É DIGITADO
   Dos 17 campos do "dados.json", 11 são digitados pelo usuário e 6 são
   recalculados na hora de salvar (ver "recalcularCamposDerivados").
   Isso evita o erro clássico de corrigir a data em um campo e o
   sistema continuar usando a data antiga em outro.
   ============================================================ */

// ------------------------------------------------------------------
// 1. ESTADO DO VISUALIZADOR
// ------------------------------------------------------------------

/** Quantos registros aparecem de uma vez (o resto vem no "CARREGAR MAIS"). */
const LOTE_REGISTROS = 50;

let mapaRegistrosPorPasta = new Map();   // "nome da pasta" -> dados do paciente
let filtroRegistros = "";                 // texto digitado na busca da lista
let quantidadeVisivelRegistros = LOTE_REGISTROS;

let registroAbertoPasta = null;      // qual cartão está aberto agora
let registroReabrirPasta = null;     // qual cartão reabrir depois de redesenhar
let registroTemAlteracao = false;    // há edição não salva no cartão aberto?
let registroAvisouDescarte = false;  // o aviso de "alterações não salvas" já apareceu?
let anexosPendentesRegistro = [];    // PDFs soltos no cartão, ainda não gravados
let urlsTemporariasRegistro = [];    // endereços temporários criados para visualizar PDFs

// ------------------------------------------------------------------
// 2. QUAIS CAMPOS O USUÁRIO PODE EDITAR
// Cada item vira um campo na grade do cartão aberto. "lista" liga o
// campo a um <datalist> do HTML: o usuário escolhe um valor conhecido
// OU digita um novo (nenhuma lista é uma prisão).
// ------------------------------------------------------------------
const CAMPOS_EDITAVEIS_REGISTRO = [
    { chave: "paciente",      rotulo: "Paciente",           largo: true },
    { chave: "medico",        rotulo: "Médico",             lista: "listaMedicosRegistro" },
    { chave: "especialidade", rotulo: "Especialidade",      lista: "listaEspecialidadesRegistro" },
    { chave: "data",          rotulo: "Data da consulta",   dica: "dd/mm/aaaa" },
    { chave: "horario",       rotulo: "Horário",            dica: "hh:mm" },
    { chave: "local",         rotulo: "Local",              largo: true },
    { chave: "om",            rotulo: "OM solicitante",     lista: "listaOMsRegistro", largo: true },
    { chave: "omAbr",         rotulo: "OM abreviada",       lista: "listaOMsAbrRegistro" },
    { chave: "tipoOM",        rotulo: "Tipo de OM",         lista: "listaTiposOMRegistro" },
    { chave: "numeroDIEx",    rotulo: "Nº do DIEx" },
    { chave: "dataDIEx",      rotulo: "Data do DIEx",       dica: "dd/mm/aaaa" }
];

// ------------------------------------------------------------------
// 3. LISTAS DE SUGESTÃO
// Preenche os <datalist> vazios do HTML com o conteúdo dos dicionários
// do MÓDULO 4. Assim, cadastrar uma nova OM continua sendo mexer em um
// lugar só — a sugestão aqui aparece de graça.
// ------------------------------------------------------------------
function preencherListaSugestao(idDatalist, valores) {
    const datalist = document.getElementById(idDatalist);
    if (!datalist) return;

    datalist.innerHTML = "";
    for (const valor of [...new Set(valores)].sort()) {
        if (!valor) continue;
        const option = document.createElement("option");
        option.value = valor;
        datalist.appendChild(option);
    }
}

function prepararListasDeSugestaoRegistros() {
    preencherListaSugestao("listaMedicosRegistro", Object.values(medicosConhecidos));
    preencherListaSugestao("listaOMsRegistro", Object.keys(omsConhecidas));
    preencherListaSugestao("listaOMsAbrRegistro", Object.values(omsConhecidas));
    // Os tipos vêm de "tratamentoPorTipoOM", e não dos VALORES de
    // "cargosConhecidos": lá vários cargos apontam para o mesmo tipo
    // (DIRETOR e SUBDIRETOR -> "Direção"), o que repetiria a sugestão.
    preencherListaSugestao("listaTiposOMRegistro", Object.keys(tratamentoPorTipoOM));

    // As especialidades ficam guardadas em CAIXA ALTA; no dados.json elas
    // aparecem capitalizadas ("Traumatologia"), então a sugestão segue o
    // mesmo formato que o campo espera.
    preencherListaSugestao(
        "listaEspecialidadesRegistro",
        especialidadesConhecidas.map(esp => esp.toLowerCase().replace(/\b\w/g, letra => letra.toUpperCase()))
    );
}

// ------------------------------------------------------------------
// 4. BUSCA VISUAL
// ------------------------------------------------------------------

/** Tira acentos e deixa em caixa alta, preservando espaços — usado só para comparar. */
function normalizarParaBusca(texto) {
    return (texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
}

/** Junta num texto só tudo que a busca deve enxergar de um paciente. */
function textoBuscavelDoRegistro(dados) {
    return normalizarParaBusca([
        dados.paciente, dados.omAbr, dados.om, dados.especialidade,
        dados.medico, dados.data, dados.dataMilitar, dados.numeroDIEx
    ].join(" "));
}

/**
 * Devolve os registros que atendem à busca, em ordem alfabética de
 * paciente (A→Z). Cada palavra digitada é procurada separadamente,
 * então "silva trauma" acha o paciente Silva da Traumatologia mesmo
 * com as duas informações vindo de campos diferentes.
 */
function registrosFiltrados() {
    const termos = normalizarParaBusca(filtroRegistros).split(/\s+/).filter(Boolean);

    const lista = [...mapaRegistrosPorPasta.values()].filter(dados => {
        if (termos.length === 0) return true;
        const alvo = textoBuscavelDoRegistro(dados);
        return termos.every(termo => alvo.includes(termo));
    });

    return lista.sort((a, b) =>
        (a.paciente || "").localeCompare(b.paciente || "", "pt-BR", { sensitivity: "base" })
    );
}

// ------------------------------------------------------------------
// 5. DESENHO DA LISTA
// ------------------------------------------------------------------

/** Cria um <span> de coluna do cabeçalho já com o texto certo. */
function criarColunaRegistro(texto, classeExtra) {
    const span = document.createElement("span");
    span.className = "registro-col " + classeExtra;
    span.textContent = texto || "-";
    return span;
}

/** Monta a linha fechada de um paciente (o cabeçalho clicável da sanfona). */
function criarLinhaRegistro(dados) {
    const item = document.createElement("div");
    item.className = "registro-item";
    item.dataset.pasta = dados._nomePasta;

    const cabecalho = document.createElement("button");
    cabecalho.type = "button";
    cabecalho.className = "registro-cabecalho";
    cabecalho.title = "Clique para abrir os dados deste paciente";

    cabecalho.appendChild(criarColunaRegistro(dados.paciente, "registro-col-paciente"));
    cabecalho.appendChild(criarColunaRegistro(dados.omAbr, "registro-col-secundaria"));
    cabecalho.appendChild(criarColunaRegistro(dados.data, "registro-col-secundaria"));
    cabecalho.appendChild(criarColunaRegistro(dados.especialidade, "registro-col-secundaria"));

    const seta = document.createElement("span");
    seta.className = "registro-seta";
    seta.textContent = "▼";
    cabecalho.appendChild(seta);

    cabecalho.addEventListener("click", () => alternarRegistro(item));

    item.appendChild(cabecalho);
    return item;
}

/** Escreve uma mensagem no lugar da lista (banco desconectado, busca sem resultado, etc.). */
function mostrarMensagemNaLista(container, mensagem) {
    const aviso = document.createElement("div");
    aviso.className = "lista-registros-vazia";
    aviso.textContent = mensagem;
    container.appendChild(aviso);
}

/**
 * Redesenha a lista inteira a partir de "mapaPacientesBanco".
 * É chamada pelo MÓDULO 14 sempre que a pasta do banco é varrida.
 */
function renderizarRegistrosBanco() {
    const container = document.getElementById("listaRegistrosBanco");
    if (!container) return;   // sistema aberto numa versão do HTML sem esta área

    // Reconstrói o índice por nome de pasta (chave única e estável:
    // duas pastas nunca têm o mesmo nome dentro do mesmo diretório).
    mapaRegistrosPorPasta = new Map();
    for (const dados of mapaPacientesBanco.values()) {
        if (dados && dados._nomePasta) mapaRegistrosPorPasta.set(dados._nomePasta, dados);
    }

    container.innerHTML = "";
    registroAbertoPasta = null;
    registroTemAlteracao = false;
    registroAvisouDescarte = false;
    anexosPendentesRegistro = [];
    liberarUrlsTemporarias();

    const contador = document.getElementById("contadorRegistros");
    const btnCarregarMais = document.getElementById("btnCarregarMaisRegistros");

    if (!dirHandleBanco) {
        mostrarMensagemNaLista(container, "Conecte a pasta do banco para ver os registros salvos.");
        if (contador) contador.textContent = "";
        btnCarregarMais?.classList.add("oculto");
        return;
    }

    const encontrados = registrosFiltrados();
    const visiveis = encontrados.slice(0, quantidadeVisivelRegistros);

    if (encontrados.length === 0) {
        mostrarMensagemNaLista(
            container,
            filtroRegistros
                ? "Nenhum registro encontrado para esta pesquisa."
                : "Nenhum paciente salvo nesta pasta ainda."
        );
    } else {
        for (const dados of visiveis) {
            container.appendChild(criarLinhaRegistro(dados));
        }
    }

    if (contador) {
        contador.textContent = encontrados.length === 0
            ? ""
            : `Mostrando ${visiveis.length} de ${encontrados.length} registro(s).`;
    }

    if (btnCarregarMais) {
        btnCarregarMais.classList.toggle("oculto", visiveis.length >= encontrados.length);
    }

    // Reabre o cartão que estava aberto antes de salvar (o nome da pasta
    // pode ter mudado no caminho — por isso a variável guarda o nome NOVO).
    if (registroReabrirPasta) {
        const item = container.querySelector(`.registro-item[data-pasta="${CSS.escape(registroReabrirPasta)}"]`);
        registroReabrirPasta = null;
        if (item) abrirRegistro(item);
    }
}

// ------------------------------------------------------------------
// 6. ABRIR E FECHAR O CARTÃO (SANFONA)
// ------------------------------------------------------------------

/* ANIMAÇÃO DE ABRIR/FECHAR (v1.5.4)
   Antes o corpo do cartão simplesmente aparecia e sumia de uma vez.
   As duas funções abaixo fazem ele crescer e encolher suavemente, e são
   usadas tanto pelos cartões de paciente quanto pela linha de resumo.

   Por que a altura precisa ser medida no JS: o resto do sistema anima
   com um teto fixo de altura (ver ".conteudo-dropzones" no CSS), o que
   funciona quando o conteúdo tem sempre o mesmo tamanho. Aqui não tem:
   um cartão varia conforme a quantidade de PDFs na pasta do paciente.
   Um teto fixo alto demais faria a animação "terminar antes da hora" na
   abertura e demorar para começar no fechamento; baixo demais cortaria
   o conteúdo. Por isso a altura real é medida na hora.

   E por que a altura é LIBERADA ao final da abertura: a lista de PDFs
   é carregada depois que o cartão já está montado (ver a chamada a
   carregarArquivosDoRegistro em abrirRegistro). Se o teto continuasse
   valendo, os arquivos que chegassem depois ficariam escondidos. */

const DURACAO_SANFONA = 320;   // ms — mesma casa de grandeza das demais transições

/** Respeita quem pediu ao sistema operacional para reduzir animações. */
function preferirMenosMovimento() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Abre o bloco: cresce de zero até a altura real do conteúdo. */
function abrirSanfona(el) {
    if (!el) return;

    if (preferirMenosMovimento()) return;   // aparece direto, sem animar

    clearTimeout(el._timerSanfona);

    // Mede a altura natural ANTES de encolher o bloco para zero.
    const alturaFinal = el.offsetHeight;

    el.classList.add("sanfona-animando", "sanfona-fechada");
    void el.offsetHeight;   // força o navegador a assumir o estado fechado antes de animar

    el.classList.remove("sanfona-fechada");
    el.style.maxHeight = `${alturaFinal}px`;

    el._timerSanfona = setTimeout(() => {
        // Solta o teto: daqui em diante o bloco cresce sozinho conforme
        // os PDFs do paciente vão sendo listados.
        el.style.maxHeight = "";
        el.classList.remove("sanfona-animando");
    }, DURACAO_SANFONA + 30);
}

/**
 * Fecha o bloco encolhendo até sumir e só então executa "aoTerminar"
 * (que costuma ser remover o elemento ou escondê-lo de vez).
 */
function fecharSanfona(el, aoTerminar) {
    const concluir = () => { if (typeof aoTerminar === "function") aoTerminar(); };

    if (!el) { concluir(); return; }

    if (preferirMenosMovimento()) { concluir(); return; }

    clearTimeout(el._timerSanfona);

    // Parte da altura atual: sem um valor de origem concreto não há o que
    // animar (a altura natural é "auto", que não é interpolável).
    el.classList.add("sanfona-animando");
    el.style.maxHeight = `${el.offsetHeight}px`;
    void el.offsetHeight;

    el.style.maxHeight = "";              // deixa a classe abaixo mandar
    el.classList.add("sanfona-fechada");

    el._timerSanfona = setTimeout(() => {
        el.classList.remove("sanfona-animando", "sanfona-fechada");
        concluir();
    }, DURACAO_SANFONA + 30);
}

/** Fecha os endereços temporários dos PDFs abertos (libera memória). */
function liberarUrlsTemporarias() {
    for (const url of urlsTemporariasRegistro) {
        try { URL.revokeObjectURL(url); } catch { /* já liberado */ }
    }
    urlsTemporariasRegistro = [];
}

/**
 * Antes de fechar/trocar de cartão, avisa uma vez que há edição não
 * salva. O segundo clique confirma o descarte — é o mesmo espírito dos
 * avisos do sistema (toast), sem inventar mais uma janela modal.
 */
function podeDescartarEdicaoAberta() {
    if (!registroTemAlteracao) return true;

    if (!registroAvisouDescarte) {
        registroAvisouDescarte = true;
        mostrarToast("Há alterações não salvas neste registro. Clique de novo para descartá-las.", "aviso");
        return false;
    }
    return true;
}

function fecharRegistroAberto() {
    const container = document.getElementById("listaRegistrosBanco");
    const aberto = container?.querySelector(".registro-item.aberto");

    if (aberto) {
        aberto.classList.remove("aberto");

        // O corpo só sai do DOM depois de encolher até sumir. A referência
        // é capturada aqui de propósito: se outro cartão for aberto no meio
        // da animação, esta remoção continua valendo para ESTE corpo, e não
        // para o que estiver aberto quando o tempo terminar.
        const corpo = aberto.querySelector(".registro-corpo");
        if (corpo) fecharSanfona(corpo, () => corpo.remove());
    }

    registroAbertoPasta = null;
    registroTemAlteracao = false;
    registroAvisouDescarte = false;
    anexosPendentesRegistro = [];
    liberarUrlsTemporarias();
}

function alternarRegistro(item) {
    const pasta = item.dataset.pasta;

    if (registroAbertoPasta === pasta) {
        if (!podeDescartarEdicaoAberta()) return;
        fecharRegistroAberto();
        return;
    }

    if (registroAbertoPasta && !podeDescartarEdicaoAberta()) return;

    fecharRegistroAberto();
    abrirRegistro(item);
}

// ------------------------------------------------------------------
// 7. CONTEÚDO DO CARTÃO ABERTO
// ------------------------------------------------------------------

/** Marca que algo foi editado e acende o botão de salvar. */
function marcarRegistroEditado(corpo) {
    registroTemAlteracao = true;
    registroAvisouDescarte = false;

    const btnSalvar = corpo.querySelector(".btn-salvar-registro");
    if (btnSalvar) btnSalvar.disabled = false;
}

/** Cria um campo editável da grade (rótulo + caixa de digitação). */
function criarCampoRegistro(campo, valor, corpo) {
    const caixa = document.createElement("div");
    caixa.className = "campo-registro" + (campo.largo ? " campo-registro-largo" : "");

    const label = document.createElement("label");
    label.textContent = campo.rotulo;

    const input = document.createElement("input");
    input.type = "text";
    input.value = valor || "";
    input.dataset.campo = campo.chave;
    input.autocomplete = "off";
    if (campo.dica) input.placeholder = campo.dica;
    if (campo.lista) input.setAttribute("list", campo.lista);

    input.addEventListener("input", () => {
        marcarRegistroEditado(corpo);

        // Cortesia: ao escolher uma OM conhecida pelo nome completo, a
        // sigla se preenche sozinha (o usuário ainda pode trocá-la).
        if (campo.chave === "om" && omsConhecidas[input.value]) {
            const campoAbr = corpo.querySelector('[data-campo="omAbr"]');
            if (campoAbr) campoAbr.value = omsConhecidas[input.value];
        }
    });

    caixa.appendChild(label);
    caixa.appendChild(input);
    return caixa;
}

/** Lê o conteúdo atual da pasta do paciente e lista os arquivos encontrados. */
async function carregarArquivosDoRegistro(dados, area) {
    area.innerHTML = "";

    let arquivos = [];
    try {
        const pasta = await dirHandleBanco.getDirectoryHandle(dados._nomePasta);
        for await (const entrada of pasta.values()) {
            if (entrada.kind === "file" && entrada.name !== "dados.json") {
                arquivos.push(entrada.name);
            }
        }
    } catch (erro) {
        console.error("Erro ao listar os arquivos do paciente:", erro);
        mostrarMensagemNaLista(area, "Não foi possível ler os arquivos desta pasta.");
        return;
    }

    if (arquivos.length === 0) {
        mostrarMensagemNaLista(area, "Nenhum PDF guardado na pasta deste paciente.");
    }

    for (const nome of arquivos.sort()) {
        const linha = document.createElement("div");
        linha.className = "arquivo-registro";

        const nomeEl = document.createElement("span");
        nomeEl.className = "arquivo-registro-nome";
        nomeEl.textContent = nome;

        const btnVer = document.createElement("button");
        btnVer.type = "button";
        btnVer.className = "btn-registro btn-arquivo-registro";
        btnVer.textContent = "VISUALIZAR";
        btnVer.addEventListener("click", () => visualizarArquivoDoRegistro(dados._nomePasta, nome));

        linha.appendChild(nomeEl);
        linha.appendChild(btnVer);
        area.appendChild(linha);
    }

    // Mostra também o que está esperando para ser gravado (arquivo
    // arrastado no cartão e ainda não confirmado com SALVAR ALTERAÇÕES).
    for (const pendente of anexosPendentesRegistro) {
        const linha = document.createElement("div");
        linha.className = "arquivo-registro";

        const nomeEl = document.createElement("span");
        nomeEl.className = "arquivo-registro-nome";
        nomeEl.textContent = pendente.nomeOriginal;

        const aviso = document.createElement("span");
        aviso.className = "arquivo-registro-aviso";
        aviso.textContent = "PENDENTE — grava ao salvar";

        linha.appendChild(nomeEl);
        linha.appendChild(aviso);
        area.appendChild(linha);
    }
}

/** Abre o PDF numa nova aba do navegador, sem baixar nada. */
async function visualizarArquivoDoRegistro(nomePasta, nomeArquivo) {
    try {
        const pasta = await dirHandleBanco.getDirectoryHandle(nomePasta);
        const handle = await pasta.getFileHandle(nomeArquivo);
        const arquivo = await handle.getFile();

        const url = URL.createObjectURL(arquivo);
        urlsTemporariasRegistro.push(url);

        const janela = window.open(url, "_blank");

        // Se o navegador bloquear a janela (política de pop-ups), tenta
        // pelo caminho de um link temporário, que costuma passar.
        if (!janela) {
            const link = document.createElement("a");
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener";
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
    } catch (erro) {
        console.error("Erro ao abrir o PDF:", erro);
        mostrarToast(`Não foi possível abrir "${nomeArquivo}" (${erro.name || "erro"}).`, "erro");
    }
}

/** Monta a área de anexar/substituir PDF dentro do cartão. */
function criarAreaAnexoRegistro(dados, corpo, areaArquivos) {
    const linha = document.createElement("div");
    linha.className = "linha-anexo-registro";

    const dropzone = document.createElement("div");
    dropzone.className = "dropZoneDoc dropzone-registro";

    const texto = document.createElement("div");
    texto.className = "textoDrop";
    texto.textContent = "Clique ou arraste um PDF para anexar/substituir";

    const dica = document.createElement("div");
    dica.className = "nomeArquivo";
    dica.textContent = "Escolha ao lado com que nome ele será gravado ANTES de soltar o arquivo.";
    dropzone.appendChild(dica);
    dropzone.appendChild(texto);

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    dropzone.appendChild(input);

    // Para onde o arquivo vai: com o nome que ele já tem, ou assumindo o
    // lugar do "Marcação"/"Solicitação" padrão daquele paciente.
    const select = document.createElement("select");
    select.className = "select-nome-anexo";
    select.title = "Com que nome o arquivo será gravado na pasta";
    for (const opcao of [
        { valor: "original", texto: "MANTER NOME DO ARQUIVO" },
        { valor: "marcacao", texto: "GRAVAR COMO MARCAÇÃO" },
        { valor: "solicitacao", texto: "GRAVAR COMO SOLICITAÇÃO" }
    ]) {
        const option = document.createElement("option");
        option.value = opcao.valor;
        option.textContent = opcao.texto;
        select.appendChild(option);
    }

    // Reaproveita a mesma função de arrastar-e-soltar das outras páginas
    // (MÓDULO 9), inclusive o acesso por teclado.
    configurarDropZone(dropzone, input, async (file) => {
        try {
            anexosPendentesRegistro.push({
                nomeOriginal: file.name,
                destino: select.value,
                bytes: await file.arrayBuffer()
            });

            marcarRegistroEditado(corpo);
            await carregarArquivosDoRegistro(dados, areaArquivos);
            mostrarToast("PDF na fila. Clique em SALVAR ALTERAÇÕES para gravá-lo.", "aviso");
        } catch (erro) {
            console.error("Erro ao ler o PDF anexado:", erro);
            mostrarToast("Não foi possível ler o PDF anexado.", "erro");
        }
        input.value = "";
    });

    linha.appendChild(dropzone);
    linha.appendChild(select);
    return linha;
}

/** Monta o rodapé de ações do cartão (salvar / usar em / excluir). */
function criarAcoesRegistro(dados, corpo) {
    const acoes = document.createElement("div");
    acoes.className = "registro-acoes";

    const btnSalvar = document.createElement("button");
    btnSalvar.type = "button";
    btnSalvar.className = "btn-registro btn-salvar-registro";
    btnSalvar.textContent = "SALVAR ALTERAÇÕES";
    btnSalvar.disabled = true;   // só acende quando algo for editado
    btnSalvar.addEventListener("click", () => salvarAlteracoesRegistro(dados, corpo));

    const selectUsar = document.createElement("select");
    selectUsar.className = "select-usar-registro";
    for (const opcao of [
        { valor: "lme", texto: "USAR NO LME (GERAR DIEx)" },
        { valor: "excel", texto: "USAR NO EXCEL (LINHA DA PLANILHA)" },
        { valor: "doc", texto: "USAR NO DOC (RENOMEAR PDF)" }
    ]) {
        const option = document.createElement("option");
        option.value = opcao.valor;
        option.textContent = opcao.texto;
        selectUsar.appendChild(option);
    }

    const btnUsar = document.createElement("button");
    btnUsar.type = "button";
    btnUsar.className = "btn-registro";
    btnUsar.textContent = "USAR";
    btnUsar.addEventListener("click", () => usarRegistroNaPagina(selectUsar.value, dados));

    const btnExcluir = document.createElement("button");
    btnExcluir.type = "button";
    btnExcluir.className = "btn-registro btn-registro-perigo";
    btnExcluir.textContent = "EXCLUIR DO BANCO";
    btnExcluir.addEventListener("click", () => abrirModalExcluir(dados));

    acoes.appendChild(btnSalvar);
    acoes.appendChild(selectUsar);
    acoes.appendChild(btnUsar);
    acoes.appendChild(btnExcluir);
    return acoes;
}

/** Monta e exibe o conteúdo do cartão de um paciente. */
function abrirRegistro(item) {
    const dados = mapaRegistrosPorPasta.get(item.dataset.pasta);
    if (!dados) return;

    const corpo = document.createElement("div");
    corpo.className = "registro-corpo";

    // --- Campos editáveis ---
    const tituloCampos = document.createElement("div");
    tituloCampos.className = "registro-subtitulo";
    tituloCampos.textContent = "DADOS DO PACIENTE (dados.json)";
    corpo.appendChild(tituloCampos);

    const grade = document.createElement("div");
    grade.className = "registro-campos";
    for (const campo of CAMPOS_EDITAVEIS_REGISTRO) {
        grade.appendChild(criarCampoRegistro(campo, dados[campo.chave], corpo));
    }
    corpo.appendChild(grade);

    // --- Arquivos da pasta ---
    const tituloArquivos = document.createElement("div");
    tituloArquivos.className = "registro-subtitulo";
    tituloArquivos.textContent = "ARQUIVOS NA PASTA";
    corpo.appendChild(tituloArquivos);

    const areaArquivos = document.createElement("div");
    areaArquivos.className = "registro-arquivos";
    corpo.appendChild(areaArquivos);

    corpo.appendChild(criarAreaAnexoRegistro(dados, corpo, areaArquivos));

    // --- Ações ---
    corpo.appendChild(criarAcoesRegistro(dados, corpo));

    // Sobra de um fechamento ainda em andamento (clique rápido para reabrir
    // o mesmo cartão): sai na hora, sem esperar o fim da animação, para o
    // cartão não ficar com dois corpos ao mesmo tempo.
    item.querySelector(".registro-corpo")?.remove();

    item.appendChild(corpo);
    item.classList.add("aberto");
    abrirSanfona(corpo);

    registroAbertoPasta = item.dataset.pasta;
    registroTemAlteracao = false;
    registroAvisouDescarte = false;
    anexosPendentesRegistro = [];

    // A leitura dos arquivos é assíncrona: o cartão já aparece montado e
    // a lista de PDFs se completa em seguida.
    carregarArquivosDoRegistro(dados, areaArquivos);
}

// ------------------------------------------------------------------
// 8. SALVAR AS ALTERAÇÕES
// ------------------------------------------------------------------

/**
 * Recalcula os campos que NÃO são digitados: eles nascem de outros.
 * Se o usuário corrige a data da consulta, por exemplo, a data militar
 * e a data usada no nome do arquivo precisam acompanhar — senão o
 * registro fica com duas verdades diferentes dentro do mesmo JSON.
 */
function recalcularCamposDerivados(dados) {
    dados.dataHora = (dados.data && dados.horario) ? `${dados.data} - ${dados.horario}` : (dados.data || "");
    dados.dataMilitar = formatarDataMilitar(dados.data);
    dados.dataNomeArquivo = formatarDataNomeArquivo(dados.data);
    const tratamento = tratamentoDoTipoOM(dados.tipoOM);
    dados.cargoOM = tratamento.cargo;
    dados.pronome = tratamento.pronome;
    dados.especialidadeCrua = extrairEspecialidadeCrua(dados.especialidade) || (dados.especialidade || "").toUpperCase();
    return dados;
}

/** Confere se o texto está no formato de data que o sistema sabe converter. */
function dataValidaParaBanco(texto) {
    return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test((texto || "").trim());
}

/** Descobre com que nome cada anexo pendente será gravado. */
function nomeFinalDoAnexo(anexo, dados) {
    const pacienteLimpo = sanitizarNomePasta(dados.paciente);

    if (anexo.destino === "marcacao") return `Marcação - ${pacienteLimpo}.pdf`;
    if (anexo.destino === "solicitacao") return `Solicitação - ${pacienteLimpo}.pdf`;
    return sanitizarNomePasta(anexo.nomeOriginal);
}

/**
 * Grava no disco tudo que foi editado no cartão: o dados.json, os PDFs
 * pendentes e — se o nome do paciente, a OM ou a data mudaram — o
 * próprio nome da pasta.
 */
async function salvarAlteracoesRegistro(dadosOriginais, corpo) {
    if (!dirHandleBanco) {
        mostrarToast("Conecte a pasta do banco antes de salvar.", "aviso");
        return;
    }

    // 1) Lê o que está escrito nos campos.
    const editado = { ...dadosOriginais };
    for (const campo of CAMPOS_EDITAVEIS_REGISTRO) {
        const input = corpo.querySelector(`[data-campo="${campo.chave}"]`);
        if (input) editado[campo.chave] = input.value.trim();
    }

    // 2) Confere o mínimo necessário. Paciente, OM abreviada e data
    //    formam o nome da pasta — sem eles não há onde gravar.
    if (!editado.paciente || !editado.omAbr) {
        mostrarToast("Paciente e OM abreviada não podem ficar em branco.", "aviso");
        return;
    }
    if (!dataValidaParaBanco(editado.data)) {
        mostrarToast("A data da consulta precisa estar no formato dd/mm/aaaa.", "aviso");
        return;
    }

    // 3) Atualiza os campos calculados e descobre como a pasta deve se chamar.
    recalcularCamposDerivados(editado);

    const pastaAtual = dadosOriginais._nomePasta;
    const pastaNova = montarNomePastaPaciente(editado);
    const vaiRenomear = pastaNova !== pastaAtual;

    const btnSalvar = corpo.querySelector(".btn-salvar-registro");
    if (btnSalvar) btnSalvar.disabled = true;

    try {
        // 4) Renomear = criar a pasta nova, levar os arquivos e apagar a
        //    antiga (o navegador não tem um comando "renomear pasta").
        if (vaiRenomear) {
            if (await pastaJaExisteNoBanco(pastaNova)) {
                mostrarToast(`Já existe a pasta "${pastaNova}" no banco. Ajuste os dados ou exclua o registro repetido.`, "erro");
                if (btnSalvar) btnSalvar.disabled = false;
                return;
            }

            const destino = await dirHandleBanco.getDirectoryHandle(pastaNova, { create: true });
            await gravarArquivoNaPasta(destino, "dados.json", JSON.stringify(limparCamposInternos(editado), null, 4));
            await gravarAnexosPendentes(destino, editado);

            const origem = await dirHandleBanco.getDirectoryHandle(pastaAtual);

            // Os PDFs padrão carregam o nome do paciente; se o nome foi
            // corrigido, o arquivo copiado acompanha a correção.
            await copiarArquivosDaPasta(origem, destino, ["dados.json"], nomeAntigo =>
                renomearAnexoPadrao(nomeAntigo, dadosOriginais.paciente, editado.paciente)
            );

            await dirHandleBanco.removeEntry(pastaAtual, { recursive: true });
            mostrarToast(`Registro salvo. A pasta passou a se chamar "${pastaNova}".`, "sucesso");

        } else {
            const pasta = await dirHandleBanco.getDirectoryHandle(pastaAtual, { create: true });
            await gravarArquivoNaPasta(pasta, "dados.json", JSON.stringify(limparCamposInternos(editado), null, 4));
            await gravarAnexosPendentes(pasta, editado);
            mostrarToast("Registro atualizado com sucesso!", "sucesso");
        }

        // 5) Relê a pasta e reabre o mesmo cartão, agora com os dados novos.
        registroTemAlteracao = false;
        anexosPendentesRegistro = [];
        registroReabrirPasta = pastaNova;
        await atualizarListaPacientesBanco();

    } catch (erro) {
        console.error("Erro ao salvar as alterações do registro:", erro);
        mostrarToast(`Não foi possível salvar (${erro.name || "erro"}). Veja o console (F12) para o detalhe.`, "erro");
        if (btnSalvar) btnSalvar.disabled = false;
    }
}

/** Diz se já existe uma pasta com esse nome dentro do banco. */
async function pastaJaExisteNoBanco(nomePasta) {
    try {
        await dirHandleBanco.getDirectoryHandle(nomePasta);
        return true;
    } catch {
        return false;
    }
}

/** Grava, na pasta indicada, os PDFs que estavam na fila do cartão. */
async function gravarAnexosPendentes(pastaHandle, dados) {
    for (const anexo of anexosPendentesRegistro) {
        await gravarArquivoNaPasta(pastaHandle, nomeFinalDoAnexo(anexo, dados), anexo.bytes);
    }
}

/** Troca o nome do paciente dentro de "Marcação - FULANO.pdf" quando ele é corrigido. */
function renomearAnexoPadrao(nomeArquivo, pacienteAntigo, pacienteNovo) {
    if (pacienteAntigo === pacienteNovo) return nomeArquivo;

    const antigo = sanitizarNomePasta(pacienteAntigo);
    const novo = sanitizarNomePasta(pacienteNovo);

    if (nomeArquivo === `Marcação - ${antigo}.pdf`) return `Marcação - ${novo}.pdf`;
    if (nomeArquivo === `Solicitação - ${antigo}.pdf`) return `Solicitação - ${novo}.pdf`;
    return nomeArquivo;
}

// ------------------------------------------------------------------
// 9. USAR O REGISTRO EM OUTRA PÁGINA
// ------------------------------------------------------------------

/**
 * Joga o paciente escolhido direto na página de trabalho desejada.
 * Em vez de repetir aqui a lógica de cada página, o código escreve o
 * identificador na barra de pesquisa daquela página e dispara o mesmo
 * evento que o usuário dispararia digitando — assim existe um só
 * caminho para carregar um paciente do banco, e ele já é testado.
 */
function usarRegistroNaPagina(destino, dados) {
    const identificador = `${dados.paciente} - ${dados.omAbr} (${dados.data})`;

    if (!mapaPacientesBanco.has(identificador)) {
        mostrarToast("Não foi possível carregar este paciente. Clique em ATUALIZAR e tente de novo.", "erro");
        return;
    }

    const paginas = { lme: "inputPesquisaBanco", excel: "inputPesquisaExcel", doc: "inputPesquisaDoc" };
    const campo = document.getElementById(paginas[destino]);
    if (!campo) return;

    // A busca da página DOC só existe no modo "LME SCAN".
    if (destino === "doc" && tipoDocumentoSelect) {
        tipoDocumentoSelect.value = "o";
        tipoDocumentoSelect.dispatchEvent(new Event("change"));
    }

    campo.value = identificador;
    campo.dispatchEvent(new Event("input"));

    ativarAba(destino);
    localStorage.setItem("automed_abaAtiva", destino);

    mostrarToast(`Paciente carregado na página ${destino.toUpperCase()}.`, "sucesso");
}

// ------------------------------------------------------------------
// 10. LIGAÇÕES DA TELA (busca, carregar mais, atualizar, recolher)
// ------------------------------------------------------------------

document.getElementById("inputBuscaRegistros")?.addEventListener("input", (e) => {
    // Uma edição em aberto seria perdida no redesenho: avisa e segue.
    if (registroTemAlteracao) {
        mostrarToast("As alterações não salvas do registro aberto foram descartadas.", "aviso");
    }

    filtroRegistros = e.target.value;
    quantidadeVisivelRegistros = LOTE_REGISTROS;   // toda busca nova recomeça pelos 50 primeiros
    renderizarRegistrosBanco();
});

document.getElementById("btnCarregarMaisRegistros")?.addEventListener("click", () => {
    quantidadeVisivelRegistros += LOTE_REGISTROS;
    renderizarRegistrosBanco();
});

document.getElementById("btnAtualizarRegistros")?.addEventListener("click", async () => {
    if (!dirHandleBanco) {
        mostrarToast("Conecte a pasta do banco primeiro.", "aviso");
        return;
    }
    await atualizarListaPacientesBanco();
    mostrarToast("Lista relida da pasta.", "sucesso");
});

// REVISÃO (v1.5.3): a LISTA não recolhe mais — é o conteúdo principal da
// página e agora fica sempre aberta, no topo (a barra "BANCO DE DADOS"
// virou só um título, sem seta). Quem recolhe agora é o bloco de CONEXÃO,
// que desceu para o fim da página, usando a mesma função das dropzones
// das outras páginas (MÓDULO 9).
//
// Sem nada salvo no localStorage, "configurarToggleDropzone" deixa o
// bloco EXPANDIDO — que é o desejado na primeira abertura, já que o
// navegador pede a permissão da pasta a cada recarga e o botão CONECTAR
// precisa estar à mão. Daí em diante vale a escolha do usuário.
configurarToggleDropzone("headerConexaoBanco", "areaConexaoBanco", "automed_conexaoBancoRecolhido");


// ------------------------------------------------------------------
// 11. RESUMO DO BANCO (primeira linha da lista)
// ------------------------------------------------------------------

/**
 * Abre/fecha a linha de resumo do banco, reaproveitando as mesmas classes
 * das linhas de paciente ("aberto" gira a seta e escurece a barra).
 *
 * Há uma diferença importante em relação aos cartões de paciente: o corpo
 * do resumo é fixo no HTML e apenas some/reaparece, enquanto o corpo de um
 * paciente é construído e destruído a cada abertura (ver abrirRegistro e
 * fecharRegistroAberto). Por isso o resumo fica FORA de
 * "#listaRegistrosBanco": não é filtrado pela busca, não entra no
 * redesenho da lista e não passa pelo controle de "edição não salva".
 */
function alternarResumoBanco(abrir, animar = true) {
    const item = document.getElementById("estatisticasBanco");
    const corpo = document.getElementById("corpoResumoBanco");
    const cabecalho = document.getElementById("cabecalhoResumoBanco");

    if (!item || !corpo || !cabecalho) return;

    item.classList.toggle("aberto", abrir);
    cabecalho.setAttribute("aria-expanded", String(abrir));
    localStorage.setItem("automed_resumoBancoAberto", abrir);

    // Sem animação na restauração inicial: ali o bloco só assume o estado
    // salvo, e animar um bloco que o usuário nem viu ainda seria estranho.
    if (!animar) {
        corpo.classList.toggle("oculto", !abrir);
        return;
    }

    if (abrir) {
        // Tira o "oculto" primeiro: um elemento escondido não tem altura
        // para ser medida, e é a altura que a animação precisa.
        corpo.classList.remove("oculto");
        abrirSanfona(corpo);
    } else {
        fecharSanfona(corpo, () => corpo.classList.add("oculto"));
    }
}

document.getElementById("cabecalhoResumoBanco")?.addEventListener("click", () => {
    const estaAberto = document.getElementById("estatisticasBanco")?.classList.contains("aberto");
    alternarResumoBanco(!estaAberto);
});

// Restaura a escolha da última vez. Na primeira abertura fica FECHADO,
// para o resumo ocupar uma linha só e não empurrar a lista para baixo.
alternarResumoBanco(localStorage.getItem("automed_resumoBancoAberto") === "true", false);

// Monta as listas de sugestão e desenha o estado inicial (normalmente
// a mensagem "conecte a pasta do banco").
prepararListasDeSugestaoRegistros();
renderizarRegistrosBanco();
