/* ============================================================
   AUTOMED - LÓGICA DO SISTEMA (script.js)
   ------------------------------------------------------------
   ÍNDICE DE MÓDULOS:
    1. Mensagens flutuantes (toasts)
    2. Estado global da aplicação
    3. Referências ao DOM
    4 a 7. (movidos para logica.js — dicionários, utilitários de
            texto, formatadores e extratores de dados do PDF)
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
   22. Validação de campos essenciais extraídos do PDF
   23. Compatibilidade do navegador com o Banco de Dados local

   Este arquivo (e o logica.js, carregado antes dele) são carregados
   como <script> comum (sem type="module") de propósito: assim o
   sistema continua funcionando ao abrir o AutoMed.html direto do
   disco (duplo clique), sem precisar de um servidor local — módulos
   ES são bloqueados pelo navegador nesse cenário.
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
   MÓDULOS 4 a 7 — movidos para logica.js
   Base de conhecimento (dicionários), utilitários de texto,
   formatadores e extratores de dados do PDF: nenhum desses módulos
   usa o DOM/navegador, então viraram um arquivo à parte (logica.js),
   carregado antes deste no AutoMed.html, para poder ser testado com
   Node puro (ver tests/logica.test.js). Continuam no MESMO escopo
   global de sempre — todas as funções e dicionários de lá (ex.:
   extrairDadosCompletos, formatarMedico, omsConhecidas) são usados
   normalmente a partir daqui, como se estivessem neste arquivo.
   ============================================================ */
/* ============================================================
   MÓDULO 8 — LEITURA DE ARQUIVOS PDF
   O que este arquivo faz: usa a biblioteca pdf.js (hospedada
   localmente em vendor/pdfjs, sem depender de internet) para ler um
   arquivo PDF escolhido pelo usuário e transformar seu conteúdo em
   texto puro, que depois é passado para os extratores do logica.js
   (extrairDadosCompletos / extrairDadosComissaoEtica).
   ============================================================ */

// Aponta o pdf.js para o worker também hospedado localmente (vendor/pdfjs),
// em vez de deixá-lo buscar um worker via CDN. Sem isso, versões recentes do
// pdf.js caem num modo de compatibilidade mais lento ("fake worker") e,
// dependendo da rede, ainda tentam alcançar a internet nos bastidores.
if (typeof pdfjsLib !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.js";
}

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

/**
 * Escreve "valor" (ou "-" se vazio) dentro de "el" e marca o card com a
 * classe "campo-vazio" quando o dado não foi encontrado na extração —
 * ver estilo correspondente em style.css. É só um alerta visual (não
 * bloqueia nada): ajuda o usuário a notar, de relance, quais campos
 * pode valer a pena conferir/completar manualmente antes de usar o
 * documento gerado.
 */
function definirValorCampo(el, valor) {
    if (!el) return;
    el.textContent = valor || "-";
    el.classList.toggle("campo-vazio", !valor);
}

/** Atualiza os cards "Dados Extraídos" da página LME. */
function atualizarPainelLME() {
    // Se um paciente foi carregado do banco, usa esses dados; senão,
    // extrai novamente a partir dos PDFs anexados.
    const dados = dadosBancoCarregados || extrairDadosCompletos(textoPDF, textoPDFSolicitacao);
    if (!dados) return;

    definirValorCampo(document.getElementById("dbgPaciente"), dados.paciente);
    definirValorCampo(document.getElementById("dbgMedico"), formatarMedico(dados.medico));
    definirValorCampo(document.getElementById("dbgDataHora"), dados.dataHora);
    definirValorCampo(document.getElementById("dbgLocal"), dados.local);
    definirValorCampo(document.getElementById("dbgEspecialidade"), dados.especialidade);
    definirValorCampo(document.getElementById("dbgOM"), dados.om);
    definirValorCampo(document.getElementById("dbgOMAbr"), dados.omAbr);
    definirValorCampo(document.getElementById("dbgTipoOM"), dados.tipoOM);
}

/** Atualiza os cards da página DOC quando está no modo "LME SCAN", e sugere o nome do arquivo. */
function atualizarPainelDocLmeScan() {
    const dados = extrairDadosCompletos(textoConsultaDoc, textoSolicitacaoDoc);
    if (!dados) return;

    definirValorCampo(document.getElementById("dbgPacienteDoc"), dados.paciente);
    definirValorCampo(document.getElementById("dbgEspecialidadeDoc"), dados.especialidade);

    // OM e Data só existem depois que o PDF de Solicitação também foi lido.
    if (textoSolicitacaoDoc) {
        definirValorCampo(document.getElementById("dbgOMAbrDoc"), dados.omAbr);
        definirValorCampo(document.getElementById("dbgDataDoc"), dados.data);

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

    definirValorCampo(document.getElementById("dbgSessaoComissao"), dados.sessao);
    definirValorCampo(document.getElementById("dbgPacienteComissao"), dados.paciente);
    definirValorCampo(document.getElementById("dbgDataComissao"), dados.dataFormatada);

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

// Guarda o último objeto de dados usado para montar a linha do Excel,
// só para o botão "COPIAR PARA EXCEL" (MÓDULO 15) poder avisar sobre
// campos faltantes sem precisar recalcular tudo de novo.
let ultimosDadosExcel = null;

/** Monta a linha de texto (separada por " - ") que será colada na planilha Excel. */
function atualizarLinhaExcel() {
    const campoResultado = document.getElementById("resultadoExcel");
    if (!campoResultado) return;

    const dados = dadosBancoCarregados || extrairDadosCompletos(textoPDFExcelAgendamento, textoPDFExcelSolicitacao);
    ultimosDadosExcel = dados;

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

    // Avisa (sem bloquear) se algum campo importante para ESTE modelo não
    // foi encontrado no PDF — ver MÓDULO 22, mais abaixo.
    avisarCamposFaltantes(dados, camposEssenciaisPorModelo(modeloSelect.value));

    let modelo = modeloEl.innerHTML;
    const pronomePacienteTexto = pronomePaciente.value;

    // Troca cada {VARIAVEL} pelo valor correspondente dos dados extraídos.
    // Cada valor passa por escaparHTML() antes de entrar no template: os
    // dados vêm de texto lido de um PDF (fora do nosso controle), e o
    // resultado é inserido como innerHTML logo abaixo — sem escapar, um
    // PDF com "<" ou ">" em algum campo (nome de paciente, local, etc.)
    // seria interpretado como HTML em vez de aparecer como texto. O HTML
    // do próprio modelo (negrito, spans) continua intacto: só os valores
    // extraídos são escapados, não o "molde" do texto.
    let resultado = modelo
        .replace(/{PACIENTE}/g, escaparHTML(dados.paciente))
        .replace(/{MEDICO}/g, escaparHTML(formatarMedico(dados.medico)))
        .replace(/{ESPECIALIDADE}/g, escaparHTML(dados.especialidade))
        .replace(/{DATA}/g, escaparHTML(formatarData(dados.data)))
        .replace(/{DATA_MILITAR}/g, escaparHTML(dados.dataMilitar))
        .replace(/{DIASEMANA}/g, escaparHTML(diaSemana(dados.data)))
        .replace(/{HORARIO}/g, escaparHTML(dados.horario))
        .replace(/{LOCAL}/g, escaparHTML(formatarLocal(dados.local)))
        .replace(/{OM}/g, escaparHTML(dados.om))
        .replace(/{OMABR}/g, escaparHTML(dados.omAbr))
        .replace(/{TIPO_OM}/g, escaparHTML(dados.tipoOM))
        .replace(/{CARGO_OM}/g, escaparHTML(dados.cargoOM))
        .replace(/{PRONOME}/g, escaparHTML(dados.pronome))
        .replace(/{PRONOMEPACIENTE}/g, escaparHTML(pronomePacienteTexto));

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
        avisarCamposFaltantes(dados, ["paciente", "omAbr", "data", "especialidade"]);

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

        definirValorCampo(document.getElementById("dbgPacienteDoc"), dados.paciente);
        definirValorCampo(document.getElementById("dbgOMAbrDoc"), dados.omAbr);
        definirValorCampo(document.getElementById("dbgDataDoc"), dados.data);
        definirValorCampo(document.getElementById("dbgEspecialidadeDoc"), dados.especialidade);

        const campoNome = document.getElementById("nomeArquivoGerado");
        if (campoNome) {
            campoNome.value = `${dados.paciente} - ${dados.omAbr} - ${dados.dataNomeArquivo} - ${dados.especialidade}.pdf`;
        }
    } else if (valorDigitado === "") {
        // Campo de busca limpo: reseta os cards para o estado neutro
        // (sem a marcação visual de "campo não encontrado" — aqui é só
        // "ainda não pesquisou nada", não uma extração que falhou).
        ["dbgPacienteDoc", "dbgOMAbrDoc", "dbgDataDoc", "dbgEspecialidadeDoc"].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = "-";
                el.classList.remove("campo-vazio");
            }
        });

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
    // Defesa extra além do MÓDULO 23 (que já desabilita este botão em
    // navegadores sem suporte): evita cair no catch genérico caso o
    // botão seja acionado de outra forma (ex.: Enter/Espaço com foco nele).
    if (typeof window.showDirectoryPicker !== "function") {
        mostrarToast("Este navegador não suporta o Banco de Dados local. Use Google Chrome ou Microsoft Edge.", "erro");
        return;
    }

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
        const pacienteLimpo = dados.paciente.replace(/[\/\\:*?"<>|]/g, "_");
        let nomePasta = `${pacienteLimpo} - ${dados.omAbr} - ${dados.dataNomeArquivo}`;

        if (sufixoPasta) {
            nomePasta += ` ${sufixoPasta}`;
        }

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
        console.error(e);
        if (avisar) mostrarToast("Erro ao salvar. Verifique as permissões da pasta.", "erro");
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

    // Avisa (sem bloquear o salvamento) se algum campo usado para
    // localizar/organizar o paciente no banco não foi encontrado.
    avisarCamposFaltantes(dadosNovos, ["paciente", "omAbr", "data", "especialidade", "medico"]);

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

    // Só avisa se a linha veio de uma extração de PDF/paciente do banco
    // (ultimosDadosExcel preenchido). O campo é um <input> comum e pode
    // ter sido digitado manualmente pelo usuário — nesse caso não faria
    // sentido "avisar" sobre todos os campos como se estivessem faltando.
    if (ultimosDadosExcel) {
        avisarCamposFaltantes(ultimosDadosExcel, ["paciente", "omAbr", "data", "especialidade", "medico"]);
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
        if (el) {
            el.textContent = "-";
            el.classList.remove("campo-vazio");   // volta ao estado neutro (ainda não tentou extrair nada)
        }
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
        if (el) {
            el.textContent = "-";
            el.classList.remove("campo-vazio");
        }
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


/* ============================================================
   MÓDULO 22 — VALIDAÇÃO DE CAMPOS ESSENCIAIS EXTRAÍDOS DO PDF
   O que este bloco faz: (1) escapa texto antes de inserir como HTML,
   protegendo contra um PDF com "<"/">" em algum campo; e (2) avisa —
   sem bloquear — quando um campo importante não foi encontrado no
   PDF, para o usuário perceber antes de gerar/copiar/salvar um
   documento com dados incompletos. Usado pelos MÓDULOS 11, 12, 14 e
   15.
   ============================================================ */

/**
 * Escapa caracteres especiais de HTML (&, <, >, ", ') em texto vindo de
 * fora do nosso controle (o conteúdo de um PDF) antes de ele ser
 * inserido via innerHTML em algum lugar da tela. Sem isso, um PDF cujo
 * texto contivesse algo como "<b>" ou "<img ...>" no nome do paciente,
 * no local, etc. seria interpretado como HTML de verdade em vez de
 * aparecer como texto simples.
 */
function escaparHTML(texto) {
    if (!texto) return "";
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Nome de cada campo do objeto "dados" (ver extrairDadosCompletos, em
// logica.js) -> rótulo amigável mostrado no aviso ao usuário.
const ROTULOS_CAMPOS_ESSENCIAIS = {
    paciente: "Paciente",
    medico: "Médico",
    especialidade: "Especialidade",
    data: "Data",
    horario: "Horário",
    local: "Local",
    om: "OM Solicitante",
    omAbr: "OM Abreviada"
};

/**
 * Devolve, para cada modelo de texto da página LME, quais campos do
 * objeto "dados" fazem parte do texto gerado — usado para não avisar
 * sobre um campo que aquele modelo específico nem usa (ex.: o modelo
 * "S2" não menciona horário/local, só o modelo "Agendamento" usa).
 */
function camposEssenciaisPorModelo(modelo) {
    if (modelo === "agendamento") {
        return ["paciente", "medico", "especialidade", "data", "horario", "local"];
    }
    // "s2" e "remessa" usam {OMABR}/{OM} e {DATA_MILITAR} (= data).
    return ["paciente", "omAbr", "data"];
}

/** Devolve os rótulos dos campos de "camposParaChecar" que vieram vazios em "dados". */
function listarCamposFaltantes(dados, camposParaChecar) {
    if (!dados) return camposParaChecar.map(campo => ROTULOS_CAMPOS_ESSENCIAIS[campo] || campo);
    return camposParaChecar
        .filter(campo => !dados[campo])
        .map(campo => ROTULOS_CAMPOS_ESSENCIAIS[campo] || campo);
}

/**
 * Mostra um toast de aviso (NÃO bloqueia a ação) listando quais campos
 * não foram encontrados no(s) PDF(s), para o usuário conferir/completar
 * manualmente antes de usar o documento gerado. Devolve a lista de
 * rótulos faltantes, caso quem chamou queira decidir algo com isso.
 */
function avisarCamposFaltantes(dados, camposParaChecar) {
    const faltando = listarCamposFaltantes(dados, camposParaChecar);
    if (faltando.length > 0) {
        mostrarToast(
            `Atenção: não encontrei no PDF: ${faltando.join(", ")}. Confira o resultado antes de usar.`,
            "aviso"
        );
    }
    return faltando;
}


/* ============================================================
   MÓDULO 23 — COMPATIBILIDADE DO NAVEGADOR COM O BANCO DE DADOS
   O que este bloco faz: a aba BANCO depende da File System Access API
   do navegador (window.showDirectoryPicker), disponível hoje só em
   navegadores baseados em Chromium (Chrome, Edge) — não existe no
   Firefox, por exemplo. Antes desta correção, tentar conectar num
   navegador sem suporte caía num "Erro técnico ao conectar." genérico
   (o catch do MÓDULO 14), sem explicar o motivo real. Agora o sistema
   detecta a falta de suporte de antemão e explica em vez de falhar às
   cegas — as outras abas (LME, DOC, EXCEL) continuam funcionando
   normalmente, só o Banco de Dados depende disso.
   ============================================================ */

(function avisarCompatibilidadeBanco() {
    if (typeof window.showDirectoryPicker === "function") return;   // navegador suportado: nada a fazer

    const cartao = document.querySelector(".cartao-conexao");
    if (cartao) {
        const aviso = document.createElement("p");
        aviso.className = "aviso-compatibilidade-banco";
        aviso.textContent =
            "Este navegador não suporta a função de Banco de Dados local " +
            "(é necessário Google Chrome ou Microsoft Edge — não funciona no Firefox). " +
            "As demais abas do AutoMed (LME, DOC, EXCEL) continuam funcionando normalmente.";
        cartao.appendChild(aviso);
    }

    const btnConectar = document.getElementById("btnConectarBanco");
    if (btnConectar) btnConectar.disabled = true;
})();
