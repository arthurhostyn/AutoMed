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
   23. Adicionar paciente pela página BANCO
   24. "Abrir no banco" nas barras de pesquisa (LME/EXCEL/DOC)
   25. Navegação por teclado na lista de registros (página BANCO)
   ============================================================ */

/* ============================================================
   MÓDULO 1 — MENSAGENS FLUTUANTES (TOASTS)
   ============================================================ */
function mostrarToast(mensagem, tipo = "aviso", acao = null) {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.setAttribute("role", "status");
        container.setAttribute("aria-live", "polite");
        container.setAttribute("aria-atomic", "true");
        document.body.appendChild(container);
    }

    let icone = "ℹ️";
    if (tipo === "sucesso") icone = "✅";
    if (tipo === "erro") icone = "❌";
    if (tipo === "aviso") icone = "⚠️";

    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;

    const spanIcone = document.createElement("span");
    spanIcone.className = "toast-icone";
    spanIcone.textContent = icone;

    const spanTexto = document.createElement("span");
    spanTexto.className = "toast-texto";
    spanTexto.textContent = mensagem;

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

    if (acao && acao.texto && typeof acao.aoClicar === "function") {
        const btnAcao = document.createElement("button");
        btnAcao.type = "button";
        btnAcao.className = "toast-acao";
        btnAcao.textContent = acao.texto;
        btnAcao.addEventListener("click", () => {
            acao.aoClicar();
            toast.classList.remove("visivel");
            toast.addEventListener("transitionend", () => toast.remove());
        });
        toast.appendChild(btnAcao);
    }

    toast.appendChild(btnFechar);
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("visivel");
    });

    if (!acao) {
        setTimeout(() => {
            toast.classList.remove("visivel");
            toast.addEventListener("transitionend", () => {
                toast.remove();
            });
        }, 3500);
    }
}

/* ============================================================
   MÓDULO 2 — ESTADO GLOBAL DA APLICAÇÃO
   ============================================================ */
let textoPDF = "";
let textoPDFSolicitacao = "";
let textoConsultaDoc = "";
let textoSolicitacaoDoc = "";
let textoComissaoEtica = "";
let arquivoRenomear = null;
let arquivoAgendamentoObj = null;
let arquivoSolicitacaoObj = null;
let dirHandleBanco = null;
let dadosBancoCarregados = null;
let mapaPacientesBanco = new Map();
let textoPDFExcelAgendamento = "";
let textoPDFExcelSolicitacao = "";

/* ============================================================
   MÓDULO 3 — REFERÊNCIAS AO DOM
   ============================================================ */
const dropZone = document.getElementById("dropZone");
const pdfFile = document.getElementById("pdfFile");
const dropZoneSolicitacao = document.getElementById("dropZoneSolicitacao");
const pdfSolicitacao = document.getElementById("pdfSolicitacao");

const dropZoneDocConsulta = document.getElementById("dropZoneDocConsulta");
const pdfConsultaDoc = document.getElementById("pdfConsultaDoc");
const dropZoneDocSolicitacao = document.getElementById("dropZoneDocSolicitacao");
const pdfSolicitacaoDoc = document.getElementById("pdfSolicitacaoDoc");
const dropZoneDocArquivo = document.getElementById("dropZoneDocArquivo");
const pdfRenomear = document.getElementById("pdfRenomear");

const dropZoneComissaoEtica = document.getElementById("dropZoneComissaoEtica");
const pdfComissaoEtica = document.getElementById("pdfComissaoEtica");

const tipoDocumentoSelect = document.getElementById("tipodocumento");
const blocoLmeScan = document.getElementById("blocoLmeScan");
const blocoComissaoEtica = document.getElementById("blocoComissaoEtica");
const painelExtraidosLmeScan = document.getElementById("painelExtraidosLmeScan");
const painelExtraidosComissao = document.getElementById("painelExtraidosComissao");

const modeloSelect = document.getElementById("modeloSelect");
const pronomePaciente = document.getElementById("pronomePaciente");

const dropZoneExcelAgendamento = document.getElementById("dropZoneExcelAgendamento");
const pdfExcelAgendamento = document.getElementById("pdfExcelAgendamento");
const dropZoneExcelSolicitacao = document.getElementById("dropZoneExcelSolicitacao");
const pdfExcelSolicitacao = document.getElementById("pdfExcelSolicitacao");

const tipoLaudoConferenciaSelect = document.getElementById("tipoLaudoConferenciaSelect");

/* ============================================================
   MÓDULO 4 — BASE DE CONHECIMENTO (dicionários fixos)
   ============================================================ */
const medicosConhecidos = {
    "TENEVERTON": "Ten EVERTON",
    "MAJFRANCISCOBRAGA": "Maj FRANCISCO BRAGA",
    "MAJMONICAPOFFO": "Maj MONICA POFFO",
    "TENTATIANEPINTO": "Ten TATIANE PINTO",
    "CONFPSIQUIATRIA": "Conferência Psiquiatrica",
    "TENFRANCISCOSOUZA": "Ten FRANCISCO SOUZA",
    "CONFTRAUMATOLOGIA": "Conferência Traumatológica"
};

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
    "15ª Companhia de Comunicações Mecanizada": "15ª Cia Com Mec",
    "Colégio Militar de Porto Alegre" : "CMPA",
    "Escalão de Saúde da 3ª Região Militar" : "Esc Sau/3ªRM",
    "Posto Médico da Guarnição de Cruz Alta" : "PMGuCA"
};

const siglasAlternativasOM = {
    "H Gu Ba": "HGuB",
    "HGuBa": "HGuB"
};

const cargosConhecidos = {
    "CHEFE AO ESCALAO": "Grande Comando",
    "CHEFE AO ESCALÃO": "Grande Comando",
    "SUBCOMANDANTE": "Comando",
    "COMANDANTE": "Comando",
    "SUBDIRETOR": "Direção",
    "DIRETOR": "Direção",
    "DIREÇÃO": "Direção",
    "DIRECAO": "Direção",
    "CHEFE": "Chefia",
    "CHEFIA": "Chefia"
};

const tratamentoPorTipoOM = {
    "Comando":        { cargo: "Comandante", pronome: "esse" },
    "Grande Comando": { cargo: "Comandante", pronome: "esse" },
    "Chefia":         { cargo: "Chefe",      pronome: "essa" },
    "Direção":        { cargo: "Diretor",    pronome: "essa" }
};

function tratamentoDoTipoOM(tipoOM) {
    return tratamentoPorTipoOM[tipoOM] || tratamentoPorTipoOM["Comando"];
}

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

const mesesAbreviados = {
    "01": "JAN", "02": "FEV", "03": "MAR", "04": "ABR", "05": "MAIO", "06": "JUN",
    "07": "JUL", "08": "AGO", "09": "SET", "10": "OUT", "11": "NOV", "12": "DEZ",
    "1": "JAN", "2": "FEV", "3": "MAR", "4": "ABR", "5": "MAIO", "6": "JUN",
    "7": "JUL", "8": "AGO", "9": "SET"
};

/* ============================================================
   MÓDULO 4.1 — DIAGNÓSTICO DA EXTRAÇÃO
   ============================================================ */
const DEBUG_EXTRACAO = { ativo: localStorage.getItem("automed_debug") !== "off" };
const ultimosTextosPDF = { agendamento: "", solicitacao: "", outro: "" };
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
            const vazios = linhas.filter(l => l["Valor final"] === "— (vazio)").map(l => l.Campo);
            if (vazios.length) {
                console.warn("⚠️ Campos que NÃO foram preenchidos:", vazios.join(", "));
            }
            console.groupEnd();
        }
    };
}

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
   ============================================================ */
function normalizarTexto(texto) {
    if (!texto) return "";
    return texto
        .replace(/[\r\n]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+,/g, ",")
        .replace(/,\s*/g, ", ")
        .replace(/,+/g, ",")
        .replace(/,\s*,/g, ", ")
        .replace(/\s+([.;:])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function capitalizarPalavras(texto) {
    return texto
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
}

function adicionarNumeroLocal(texto) {
    return texto
        .replace(/\bN[º°]\s*(\d+)/gi, "nº$1")
        .replace(/(?<!nº)\b(\d+)\b/gi, "nº$1");
}

/* ============================================================
   MÓDULO 6 — FORMATADORES
   ============================================================ */
function formatarMedico(nome) {
    if (!nome) return "";
    nome = nome.toUpperCase().trim();

    if (medicosConhecidos[nome]) {
        return medicosConhecidos[nome];
    }

    for (let posto in postosMilitares) {
        if (nome.startsWith(posto)) {
            const restante = nome.substring(posto.length).trim();
            return `${postosMilitares[posto]} ${restante}`;
        }
    }

    return nome
        .toLowerCase()
        .replace(/\b\w/g, letra => letra.toUpperCase());
}

function chaveComparacao(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase();
}

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

    rastreio?.nota(`OM "${om}" NÃO está no dicionário "omsConhecidas" — mantida exatamente como veio do PDF.`);
    return om;
}

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

function formatarData(data) {
    if (!data) return "";
    const partes = data.split("/");
    if (partes.length !== 3) return data;
    const dia = partes[0];
    const mes = partes[1];
    const ano = partes[2].slice(-2);
    return `${dia}/${mes}/${ano}`;
}

function formatarDataAbreviada(data) {
    if (!data) return "";
    const partes = data.split("/");
    return `${parseInt(partes[0])} ${mesesAbreviados[partes[1]]} ${partes[2].slice(-2)}`;
}

function formatarDataMilitar(data) {
    return formatarDataAbreviada(data);
}

function formatarDataNomeArquivo(data) {
    return formatarDataAbreviada(data);
}

function formatarLocal(local) {
    if (!local) return "";
    local = local
        .replace(/Usuário Marcação.*$/i, "")
        .replace(/\s*-\s*/g, ", ");

    if (/^(\d+º?\s*Andar)/i.test(local)) {
        local = local.replace(/^(\d+º?\s*Andar)\s*(.*)$/i, "$1, $2");
    }

    return normalizarTexto(local);
}

function diaSemana(data) {
    if (!data) return "";
    const partes = data.split("/");
    const d = new Date(
        parseInt(partes[2]),
        parseInt(partes[1]) - 1,
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
   ============================================================ */
function extrair(texto, regex) {
    const match = texto.match(regex);
    if (!match) return "";
    return normalizarTexto(match[1]);
}

function extrairBlocoRemetente(textoSolicitacao, rastreio = null) {
    if (!textoSolicitacao) return "";
    const regex = /\bD[oa]\s+([\s\S]{3,120}?)\s+(?:Ao\b|A\s+Sr|À)/gi;

    for (const match of textoSolicitacao.matchAll(regex)) {
        const bloco = normalizarTexto(match[1]);
        if (/(comandante|chefe|diretor|diretora|chefia|dire[çc][ãa]o)/i.test(bloco)) {
            rastreio?.nota(`Bloco do remetente localizado: "${bloco}".`);
            return bloco;
        }
    }
    return "";
}

function extrairOMSolicitante(textoSolicitacao) {
    const match = textoSolicitacao.match(
        /(?:Do|Da|Ao)\s+(?:\S*comandante|Chefe|diretor)\s+(?:do|da|ao)\s+(.*?)\s+(?:Ao|À)/i
    );
    if (!match) return "";
    return normalizarTexto(match[1]);
}

function extrairTipoOM(textoSolicitacao, rastreio = null) {
    const bloco = extrairBlocoRemetente(textoSolicitacao);
    if (!bloco) return "Comando";

    const cargo = bloco.toUpperCase();
    for (const chave in cargosConhecidos) {
        if (cargo.includes(chave.toUpperCase())) {
            return cargosConhecidos[chave];
        }
    }
    return "Comando";
}

function extrairDadosCompletos(texto, textoSolicitacao) {
    if (!texto) return null;

    let paciente = normalizarTexto(
        extrair(texto, /Paciente:\s*\d+\s*-\s*(.*?)\s*Médico\(a\)\/Profissional:/i)
    ).replace(/\s{2,}/g, " ").trim();

    const rastreio = criarRastreio("RASTREIO DA EXTRAÇÃO (Marcação + Solicitação)");
    let regraPaciente = "Paciente: <cód> - <nome> ... Médico(a)/Profissional:";

    if (!paciente) {
        regraPaciente = "ALTERNATIVO: Especialidade: <nome> Agendamento:";
        paciente = normalizarTexto(
            extrair(texto, /Especialidade:\s*([A-ZÀ-Ú\s]+?)\s*Agendamento:/i)
        );
    }
    rastreio.registrar("paciente", paciente, paciente, regraPaciente);

    let medico = normalizarTexto(
        extrair(texto, /Médico\(a\)\/Profissional:\s*([A-ZÀ-Ú]+)/i)
    );
    let regraMedico = "Médico(a)/Profissional: <nome>";

    if (!medico) {
        regraMedico = "ALTERNATIVO: Usuário Marcação: ... Médico/Prof.:";
        const match = texto.match(
            /Usuário Marcação:\s*[A-ZÀ-Ú]+\s*([A-ZÀ-Ú]+)\s*Médico\/Prof\.:/i
        );
        if (match) medico = normalizarTexto(match[1]);
    }
    rastreio.registrar("medico", medico, medico, regraMedico);

    let dataHora = extrair(
        texto, /Dia da Consulta:\s*([0-9\/]{10}\s*-\s*[0-9:]{5})/i
    );
    let regraDataHora = "Dia da Consulta: dd/mm/aaaa - hh:mm";

    if (!dataHora) {
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

    rastreio.registrar("local", localBruto, local, regraLocal);

    let numeroDIEx = "";
    if (textoSolicitacao) {
        const matchNum = textoSolicitacao.match(/DIEx\s*n[º°]?\s*(\d+)/i);
        if (matchNum) numeroDIEx = matchNum[1];
        rastreio.registrar("numeroDIEx", matchNum?.[0], numeroDIEx, "DIEx nº <número>");
    }

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
            regraDataDIEx = "1º) data por extenso: <dia> de <mês> de <ano>";
            brutoDataDIEx = matchDataExtenso[0];
            const dia = matchDataExtenso[1].padStart(2, '0');
            const mesNome = matchDataExtenso[2].toLowerCase();
            const ano = matchDataExtenso[3].length === 2 ? `20${matchDataExtenso[3]}` : matchDataExtenso[3];
            const mes = mesesNum[mesNome] || "01";
            dataDIEx = `${dia}/${mes}/${ano}`;
        } else if (matchDataMilitar) {
            regraDataDIEx = "2º) data militar: de <dia> <MES> <ano>";
            brutoDataDIEx = matchDataMilitar[0];
            const dia = matchDataMilitar[1].padStart(2, '0');
            const mesNome = matchDataMilitar[2].toLowerCase();
            const ano = matchDataMilitar[3].length === 2 ? `20${matchDataMilitar[3]}` : matchDataMilitar[3];
            const mes = mesesNum[mesNome] || "01";
            dataDIEx = `${dia}/${mes}/${ano}`;
        } else if (matchDataAssinatura) {
            regraDataDIEx = "3º) data da assinatura eletrônica: em <dd/mm/aaaa>, às";
            brutoDataDIEx = matchDataAssinatura[0];
            dataDIEx = formatarData(matchDataAssinatura[1]);
        } else {
            regraDataDIEx = "4º) ÚLTIMO RECURSO: primeira data solta do texto";
            const matchDataSeparador = textoSolicitacao.match(/(?<!Nascimento:\s*)\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/i);
            if (matchDataSeparador) {
                brutoDataDIEx = matchDataSeparador[0];
                dataDIEx = formatarData(matchDataSeparador[1]);
            }
        }
        rastreio.registrar("dataDIEx", brutoDataDIEx, dataDIEx, regraDataDIEx);
    }

    const especialidade = formatarEspecialidade(texto);
    const especialidadeCrua = extrairEspecialidadeCrua(texto);
    rastreio.registrar("especialidade", especialidadeCrua, especialidade, "lista 'especialidadesConhecidas'");

    const om = extrairOMSolicitante(textoSolicitacao, rastreio);
    const omAbr = abreviarOM(om, rastreio);
    const tipoOM = extrairTipoOM(textoSolicitacao, rastreio);
    const { cargo: cargoOM, pronome } = tratamentoDoTipoOM(tipoOM);

    rastreio.registrar("om", om, omAbr, "bloco 'Do <cargo> do <OM>'");
    rastreio.registrar("tipoOM", om ? "cargo do remetente" : "", tipoOM, "cargosConhecidos");

    const dataMilitar = formatarDataMilitar(data);
    const dataNomeArquivo = formatarDataNomeArquivo(data);

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

function extrairDadosComissaoEtica(texto) {
    if (!texto) return null;

    const textoNormalizado = normalizarTexto(texto);
    const matchSessao = textoNormalizado.match(/Sess[ãa]o[s]?:?\s*(\d{1,3}\s*\/\s*\d{4})/i);
    const sessao = matchSessao ? matchSessao[1].replace(/\s+/g, "") : "";

    const matchPaciente = textoNormalizado.match(/Paciente:?\s*(.*?)\s*Solicitante/i);
    const paciente = matchPaciente ? matchPaciente[1].toUpperCase() : "";

    const matchData = textoNormalizado.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
    const data = matchData ? matchData[1] : "";
    const dataFormatada = data ? formatarDataAbreviada(data) : "";

    const assinatura = `etica|${texto.length}|${paciente}|${sessao}`;
    if (assinatura !== ultimaAssinaturaExtracao) {
        ultimaAssinaturaExtracao = assinatura;
        const rastreio = criarRastreio("RASTREIO DA EXTRAÇÃO (Comissão de Ética)");
        rastreio.registrar("sessao", matchSessao?.[1], sessao, "Sessão: <n>/<ano>");
        rastreio.registrar("paciente", matchPaciente?.[1], paciente, "Paciente: <nome>");
        rastreio.registrar("data", data, dataFormatada, "primeira data dd/mm/aaaa");
        rastreio.imprimir();
    }

    return { sessao, paciente, data, dataFormatada };
}

/* ============================================================
   MÓDULO 8 — LEITURA DE ARQUIVOS PDF
   ============================================================ */
function rotuloDoPDF(idElementoNome) {
    if (/Solicitacao/i.test(idElementoNome)) return "solicitacao";
    if (/ComissaoEtica/i.test(idElementoNome)) return "comissao-etica";
    if (/Agendamento|Consulta/i.test(idElementoNome)) return "agendamento";
    return "outro";
}

function lerTextoDePDF(file, idElementoNome, aoConcluir, mensagemErro, aoCapturarBytes) {
    document.getElementById(idElementoNome).textContent = file.name;
    const reader = new FileReader();

    reader.onload = async function () {
        try {
            if (typeof aoCapturarBytes === "function") {
                aoCapturarBytes({ nome: file.name, bytes: this.result.slice(0) });
            }

            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let texto = "";

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                texto += content.items.map(item => item.str).join(" ") + " ";
            }

            logTextoBrutoPDF(rotuloDoPDF(idElementoNome), file.name, texto, pdf.numPages);
            aoConcluir(texto);
        } catch (erro) {
            console.error("Falha ao ler o PDF:", file.name, erro);
            mostrarToast(mensagemErro, "erro");
        }
    };

    reader.onerror = function () {
        console.error("Erro ao carregar o arquivo:", reader.error);
        mostrarToast(mensagemErro, "erro");
    };

    reader.readAsArrayBuffer(file);
}

function lerPDF(file) {
    arquivoAgendamentoObj = null;
    dadosBancoCarregados = null;
    lerTextoDePDF(
        file, "nomeArquivoAgendamento",
        texto => { textoPDF = texto; atualizarPainelLME(); },
        "Erro ao ler o PDF.",
        conteudo => { arquivoAgendamentoObj = conteudo; }
    );
}

function lerPDFSolicitacao(file) {
    arquivoSolicitacaoObj = null;
    dadosBancoCarregados = null;
    lerTextoDePDF(
        file, "nomeArquivoSolicitacao",
        texto => { textoPDFSolicitacao = texto; atualizarPainelLME(); },
        "Erro ao ler PDF de solicitação.",
        conteudo => { arquivoSolicitacaoObj = conteudo; }
    );
}

function lerConsultaDoc(file) {
    lerTextoDePDF(file, "nomeArquivoConsultaDoc", texto => { textoConsultaDoc = texto; atualizarPainelDocLmeScan(); }, "Erro ao ler o PDF de Marcação.");
}

function lerSolicitacaoDoc(file) {
    lerTextoDePDF(file, "nomeArquivoSolicitacaoDoc", texto => { textoSolicitacaoDoc = texto; atualizarPainelDocLmeScan(); }, "Erro ao ler o PDF de Solicitação.");
}

function capturarArquivoRenomear(file) {
    arquivoRenomear = file;
    document.getElementById("nomeArquivoRenomear").textContent = file.name;
}

function lerComissaoEtica(file) {
    arquivoRenomear = file;
    lerTextoDePDF(file, "nomeArquivoComissaoEtica", texto => { textoComissaoEtica = texto; atualizarPainelComissaoEtica(); }, "Erro ao ler o PDF da Comissão de Ética.");
}

function lerExcelAgendamento(file) {
    lerTextoDePDF(file, "nomeArquivoExcelAgendamento", texto => { textoPDFExcelAgendamento = texto; dadosBancoCarregados = null; atualizarLinhaExcel(); }, "Erro ao ler PDF de Agendamento.");
}

function lerExcelSolicitacao(file) {
    lerTextoDePDF(file, "nomeArquivoExcelSolicitacao", texto => { textoPDFExcelSolicitacao = texto; dadosBancoCarregados = null; atualizarLinhaExcel(); }, "Erro ao ler PDF de Solicitação.");
}

/* ============================================================
   MÓDULO 9 — DROPZONES E BOTÕES DE RECOLHER
   ============================================================ */
function configurarDropZone(dropZone, inputFile, callback) {
    dropZone.addEventListener("click", () => { inputFile.click(); });
    dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("hover"); });
    dropZone.addEventListener("dragleave", () => { dropZone.classList.remove("hover"); });
    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.classList.remove("hover");
        const file = e.dataTransfer.files[0];
        if (file) callback(file);
    });
    inputFile.addEventListener("change", e => {
        const file = e.target.files[0];
        if (file) callback(file);
    });

    if (!dropZone.hasAttribute("tabindex")) dropZone.setAttribute("tabindex", "0");
    if (!dropZone.hasAttribute("role")) dropZone.setAttribute("role", "button");

    dropZone.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputFile.click();
        }
    });
}

configurarDropZone(dropZone, pdfFile, lerPDF);
configurarDropZone(dropZoneSolicitacao, pdfSolicitacao, lerPDFSolicitacao);
configurarDropZone(dropZoneDocConsulta, pdfConsultaDoc, lerConsultaDoc);
configurarDropZone(dropZoneDocSolicitacao, pdfSolicitacaoDoc, lerSolicitacaoDoc);
configurarDropZone(dropZoneDocArquivo, pdfRenomear, capturarArquivoRenomear);
configurarDropZone(dropZoneComissaoEtica, pdfComissaoEtica, lerComissaoEtica);
configurarDropZone(dropZoneExcelAgendamento, pdfExcelAgendamento, lerExcelAgendamento);
configurarDropZone(dropZoneExcelSolicitacao, pdfExcelSolicitacao, lerExcelSolicitacao);

function configurarToggleDropzone(headerId, containerId, storageKey) {
    const header = document.getElementById(headerId);
    const container = document.getElementById(containerId);
    if (!header || !container) return;

    function aplicarEstadoDropzone(recolher) {
        if (recolher) container.classList.add("recolhido");
        else container.classList.remove("recolhido");
    }

    const estaRecolhido = localStorage.getItem(storageKey) === "true";
    if (estaRecolhido) aplicarEstadoDropzone(true);

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
   ============================================================ */
function atualizarPainelLME() {
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

function atualizarPainelDocLmeScan() {
    const dados = extrairDadosCompletos(textoConsultaDoc, textoSolicitacaoDoc);
    if (!dados) return;

    const dbgPacienteDoc = document.getElementById("dbgPacienteDoc");
    const dbgEspecialidadeDoc = document.getElementById("dbgEspecialidadeDoc");

    if (dbgPacienteDoc) dbgPacienteDoc.textContent = dados.paciente || "-";
    if (dbgEspecialidadeDoc) dbgEspecialidadeDoc.textContent = dados.especialidade || "-";

    if (textoSolicitacaoDoc) {
        const dbgOMAbrDoc = document.getElementById("dbgOMAbrDoc");
        const dbgDataDoc = document.getElementById("dbgDataDoc");

        if (dbgOMAbrDoc) dbgOMAbrDoc.textContent = dados.omAbr || "-";
        if (dbgDataDoc) dbgDataDoc.textContent = dados.data || "-";

        const campoNome = document.getElementById("nomeArquivoGerado");
        if (campoNome && !campoNome.value) {
            campoNome.value = `${dados.paciente} - ${dados.omAbr} - ${dados.dataNomeArquivo} - ${dados.especialidade}.pdf`;
        }
    }
}

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

function formatarDataAno2Digitos(textoData) {
    if (!textoData) return "";
    return textoData.replace(/\b(\d{1,2}\/\d{1,2}\/)\d{2}(\d{2})\b/g, "$1$2");
}

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
    const dataHoraBruta = (dados.dataHora || "").replace(/\s*-\s*/, " ");
    const dataHora = formatarDataAno2Digitos(dataHoraBruta);
    const nao1 = "Não";
    const nao2 = "Não";
    const numDIEx = dados.numeroDIEx || "";
    const dataDIEx = formatarDataAno2Digitos(dados.dataDIEx || "");
    const omAbr = dados.omAbr || "";
    const especialidadeExcel = (dados.especialidadeCrua || dados.especialidade || "").toUpperCase();
    const medico = formatarMedico(dados.medico) || "";
    const sim = "Sim";

    campoResultado.value = `${nome} - ${agendado} - ${dataHora} - ${nao1} - ${nao2} - ${numDIEx} - ${dataDIEx} - ${omAbr} - ${especialidadeExcel} - ${medico} - ${sim}`;
}

/* ============================================================
   MÓDULO 11 — GERADOR DE DIEx (PÁGINA LME)
   ============================================================ */
if (localStorage.getItem("automed_modeloSelect")) {
    modeloSelect.value = localStorage.getItem("automed_modeloSelect");
}
if (localStorage.getItem("automed_pronomePaciente")) {
    pronomePaciente.value = localStorage.getItem("automed_pronomePaciente");
}
if (localStorage.getItem("automed_tipoLaudoConferenciaSelect") && tipoLaudoConferenciaSelect) {
    tipoLaudoConferenciaSelect.value = localStorage.getItem("automed_tipoLaudoConferenciaSelect");
}

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

function alternarModeloTexto() {
    localStorage.setItem("automed_modeloSelect", modeloSelect.value);

    document.querySelectorAll(".modeloTexto")
        .forEach(t => t.style.display = "none");

    if (modeloSelect.value === "agendamento") {
        document.getElementById("modelo_agendamento").style.display = "block";
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
alternarModeloTexto();

function converterNegritos(texto) {
    if (!texto) return "";
    return texto
        .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
        .replace(/\*(.*?)\*/g, "<b>$1</b>");
}

document.getElementById("gerarBtn").addEventListener("click", () => {
    if (!textoPDF && !dadosBancoCarregados) {
        mostrarToast("Carregue um PDF ou selecione um paciente do Banco de Dados primeiro.", "aviso");
        return;
    }

    const dados = dadosBancoCarregados || extrairDadosCompletos(textoPDF, textoPDFSolicitacao);
    if (!dados) return;

    atualizarPainelLME();

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
    document.getElementById("resultado").innerHTML = resultado;
});

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
        .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>");

    try {
        if (navigator.clipboard && window.ClipboardItem) {
            const blobHtml = new Blob([htmlParaWord], { type: "text/html" });
            const blobText = new Blob([plainText], { type: "text/plain" });
            const item = new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText });
            await navigator.clipboard.write([item]);
            mostrarToast("Texto copiado com sucesso!", "sucesso");
        } else {
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
   ============================================================ */
if (localStorage.getItem("automed_tipoDocumento")) {
    tipoDocumentoSelect.value = localStorage.getItem("automed_tipoDocumento");
}

function alternarTipoDocumento() {
    localStorage.setItem("automed_tipoDocumento", tipoDocumentoSelect.value);

    const comissaoSelecionada = tipoDocumentoSelect.value === "a";
    const inputPesquisaDoc = document.getElementById("inputPesquisaDoc");

    if (inputPesquisaDoc) {
        inputPesquisaDoc.classList.toggle("oculto", comissaoSelecionada);
        if (comissaoSelecionada) inputPesquisaDoc.value = "";
    }

    document.getElementById("btnAbrirNoBancoDoc")?.classList.toggle("oculto", comissaoSelecionada);

    blocoLmeScan.classList.toggle("oculto", comissaoSelecionada);
    blocoComissaoEtica.classList.toggle("oculto", !comissaoSelecionada);
    painelExtraidosLmeScan.classList.toggle("oculto", comissaoSelecionada);
    painelExtraidosComissao.classList.toggle("oculto", !comissaoSelecionada);

    document.getElementById("nomeArquivoGerado").value = "";
    arquivoRenomear = null;
}

tipoDocumentoSelect.addEventListener("change", alternarTipoDocumento);
alternarTipoDocumento();

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

document.getElementById("gerarNomeBtn").addEventListener("click", () => {
    if (tipoDocumentoSelect.value === "a") {
        gerarNomeArquivoComissaoEtica();
    } else {
        gerarNomeArquivoLmeScan();
    }
});

function sanitizarNomeArquivo(nome) {
    return nome.replace(/[\/\\:*?"<>|]/g, "_").trim();
}

function baixarArquivoComNome(arquivo, nome) {
    const url = URL.createObjectURL(arquivo);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

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
   ============================================================ */
const abas = document.querySelectorAll(".aba");
const paginas = document.querySelectorAll(".pagina");
const ordemPaginas = ["banco", "lme", "excel", "doc"];
let abaAtualNome = "banco";

function ativarAba(nomeAba) {
    const abaAlvo = document.querySelector(`.aba[data-aba="${nomeAba}"]`);
    const paginaAlvo = document.getElementById("pagina-" + nomeAba);

    if (abaAlvo && paginaAlvo) {
        const indexAtual = ordemPaginas.indexOf(abaAtualNome);
        const indexNova = ordemPaginas.indexOf(nomeAba);

        abas.forEach(a => a.classList.remove("ativa"));
        paginas.forEach(p => {
            p.classList.remove("ativa", "slide-direita", "slide-esquerda");
        });

        abaAlvo.classList.add("ativa");
        paginaAlvo.classList.add("ativa");

        if (indexNova > indexAtual) {
            paginaAlvo.classList.add("slide-direita");
        } else if (indexNova < indexAtual) {
            paginaAlvo.classList.add("slide-esquerda");
        }

        abaAtualNome = nomeAba;
        sincronizarTravaDeRolagem();
    }
}

ativarAba("banco");

abas.forEach(botao => {
    botao.addEventListener("click", () => {
        const nomeAba = botao.dataset.aba;
        ativarAba(nomeAba);
        localStorage.setItem("automed_abaAtiva", nomeAba);
    });
});

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
        ajustarAlturaListaRegistros();
    });
}

/* ============================================================
   MÓDULO 14 — BANCO DE DADOS LOCAL, CONEXÃO E MODAIS
   ============================================================ */
let pacienteExistenteModal = null;
let pacienteNovoModal = null;
let pacienteExcluirModal = null;

/* Quais PDFs acompanham o paciente que está no modal de duplicidade.
   Antes o modal ia buscar os arquivos direto nas variáveis do LME; com
   a página BANCO também salvando pacientes (v1.6.2), quem abre o modal
   é que diz quais são os anexos daquele salvamento. */
let anexosPendentesModal = [];

async function conectarPastaDoBanco(mensagemSucesso) {
    if (dirHandleBanco && !podeDescartarEdicaoAberta()) return;

    try {
        const novaPasta = await window.showDirectoryPicker({ mode: 'readwrite' });
        const statusPermissao = await novaPasta.requestPermission({ mode: 'readwrite' });

        if (statusPermissao !== 'granted') {
            mostrarToast("Você precisa permitir o acesso para o banco funcionar.", "aviso");
            return;
        }

        fecharRegistroAberto();
        dirHandleBanco = novaPasta;

        try {
            await atualizarListaPacientesBanco();
            mostrarToast(mensagemSucesso, "sucesso");
        } catch (e) {
            console.warn("Conectado, mas houve erro ao listar pastas:", e);
        }

    } catch (erro) {
        if (erro.name === 'AbortError') return;
        console.error("Erro na conexão:", erro);
        mostrarToast("Erro técnico ao conectar.", "erro");
    }
}

document.getElementById("btnConectarBanco")?.addEventListener("click", () => {
    conectarPastaDoBanco("Banco de dados conectado com sucesso!");
});

document.getElementById("btnReconectarBanco")?.addEventListener("click", () => {
    conectarPastaDoBanco("Pasta do banco trocada com sucesso!");
});

async function atualizarListaPacientesBanco() {
    if (!dirHandleBanco) return;

    const datalist = document.getElementById("listaPacientesBanco");
    if (!datalist) return;

    datalist.innerHTML = "";
    mapaPacientesBanco.clear();

    try {
        for await (const entry of dirHandleBanco.values()) {
            if (entry.kind !== 'directory') continue;

            try {
                const pastaHandle = entry;
                const jsonFileHandle = await pastaHandle.getFileHandle("dados.json");
                const file = await jsonFileHandle.getFile();
                const textoJson = await file.text();
                const dados = JSON.parse(textoJson);

                dados._nomePasta = entry.name;
                const identificador = `${dados.paciente} - ${dados.omAbr} (${dados.data})`;
                mapaPacientesBanco.set(identificador, dados);

                const option = document.createElement("option");
                option.value = identificador;
                datalist.appendChild(option);
            } catch (err) {
                continue;
            }
        }
    } catch (erro) {
        console.error("Erro ao varrer a pasta principal:", erro);
    }

    atualizarEstatisticasBanco();
    renderizarRegistrosBanco();
}

document.getElementById("inputPesquisaBanco")?.addEventListener("input", (e) => {
    const valorDigitado = e.target.value;

    if (mapaPacientesBanco.has(valorDigitado)) {
        dadosBancoCarregados = mapaPacientesBanco.get(valorDigitado);
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

function normalizarParaComparacao(texto) {
    if (!texto) return "";
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
}

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

function abrirModalDuplicidade(existente, novo, anexos = []) {
    pacienteExistenteModal = existente;
    pacienteNovoModal = novo;
    anexosPendentesModal = anexos;

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
    anexosPendentesModal = [];
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

function sanitizarNomePasta(texto, alternativo = "Sem nome") {
    let limpo = String(texto ?? "")
        .replace(/[\/\\:*?"<>|]/g, "_")
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .replace(/[.\s]+$/g, "");

    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i.test(limpo)) {
        limpo = `_${limpo}`;
    }

    if (!limpo || limpo === "." || limpo === "..") {
        limpo = alternativo;
    }

    return limpo.slice(0, 150).trim().replace(/[.\s]+$/g, "") || alternativo;
}

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

async function arquivoExisteNaPasta(pastaHandle, nomeArquivo) {
    try {
        await pastaHandle.getFileHandle(nomeArquivo);
        return true;
    } catch {
        return false;
    }
}

async function gravarArquivoNaPasta(pastaHandle, nomeArquivo, conteudo) {
    const jaExistia = await arquivoExisteNaPasta(pastaHandle, nomeArquivo);
    const fileHandle = await pastaHandle.getFileHandle(nomeArquivo, { create: true });
    const writer = await fileHandle.createWritable();

    try {
        await writer.write(conteudo);
        await writer.close();
    } catch (erro) {
        try { await writer.abort(); } catch { }
        if (!jaExistia) {
            try { await pastaHandle.removeEntry(nomeArquivo); } catch { }
        }
        throw erro;
    }
}

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

function limparCamposInternos(dados) {
    const copia = { ...dados };
    for (const chave of Object.keys(copia)) {
        if (chave.startsWith("_")) delete copia[chave];
    }
    return copia;
}

/* Os PDFs anexados viram dois arquivos com nome padronizado dentro da
   pasta do paciente. Recebe os arquivos por parâmetro (e não direto das
   variáveis globais) porque na v1.6.2 existem DUAS telas que salvam
   paciente: a barra do LME e a nova faixa da página BANCO. */
function montarAnexosDePDFs(dados, objAgendamento, objSolicitacao) {
    const pacienteLimpo = sanitizarNomePasta(dados.paciente);
    const lista = [];

    if (objAgendamento && objAgendamento.bytes) {
        lista.push({ nome: `Marcação - ${pacienteLimpo}.pdf`, bytes: objAgendamento.bytes });
    }
    if (objSolicitacao && objSolicitacao.bytes) {
        lista.push({ nome: `Solicitação - ${pacienteLimpo}.pdf`, bytes: objSolicitacao.bytes });
    }
    return lista;
}

function anexosDaPaginaLME(dados) {
    return montarAnexosDePDFs(dados, arquivoAgendamentoObj, arquivoSolicitacaoObj);
}

async function executarSalvamentoBanco(dados, sufixoPasta = "", opcoes = {}) {
    const { avisar = true, atualizarLista = true, arquivos = null } = opcoes;

    const nomePasta = montarNomePastaPaciente(dados, sufixoPasta);
    const anexos = arquivos !== null ? arquivos : anexosDaPaginaLME(dados);

    let pastaHandle;

    try {
        pastaHandle = await dirHandleBanco.getDirectoryHandle(nomePasta, { create: true });
    } catch (erro) {
        console.error("Erro ao criar a pasta do paciente:", erro);
        if (avisar) mostrarToast(`Não foi possível criar a pasta do paciente (${erro.name || "erro"}).`, "erro");
        return { ok: false, nomePasta, motivo: `não foi possível criar a pasta (${erro.name || "erro"})` };
    }

    try {
        await gravarArquivoNaPasta(pastaHandle, "dados.json", JSON.stringify(limparCamposInternos(dados), null, 4));
    } catch (erro) {
        console.error("Erro ao gravar o dados.json:", erro);
        if (avisar) mostrarToast(`Não foi possível gravar o dados.json (${erro.name || "erro"}).`, "erro");
        return { ok: false, nomePasta, motivo: `falha ao gravar o dados.json (${erro.name || "erro"})` };
    }

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

/* v1.6.3: os botões EXCLUIR e SALVAR saíram da barra de pesquisa do LME —
   cadastrar e excluir paciente agora só acontece pela página BANCO (ver
   MÓDULO 22 e MÓDULO 23). A busca aqui continua só carregando o paciente
   no painel do LME (ver listener de "inputPesquisaBanco" acima). */

document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    if (btn.id === "btnModalCancelar") {
        fecharModalDuplicidade();
    } else if (btn.id === "btnModalSubstituir") {
        if (!pacienteExistenteModal || !pacienteNovoModal) return;

        const existente = pacienteExistenteModal;
        const novo = pacienteNovoModal;
        const anexos = anexosPendentesModal;
        fecharModalDuplicidade();

        const nomePastaNova = montarNomePastaPaciente(novo);
        registroReabrirPasta = nomePastaNova;
        const resultado = await executarSalvamentoBanco(novo, "", { avisar: false, atualizarLista: false, arquivos: anexos });

        if (!resultado.ok) {
            registroReabrirPasta = null;
            await atualizarListaPacientesBanco();
            mostrarToast(`Nada foi substituído: ${resultado.motivo}.`, "erro");
            return;
        }

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
    } else if (btn.id === "btnModalSalvarAmbos") {
        if (!pacienteNovoModal) return;
        const dadosParaSalvar = pacienteNovoModal;
        const anexos = anexosPendentesModal;
        fecharModalDuplicidade();
        const idUnico = new Date().getTime().toString().slice(-4);
        registroReabrirPasta = montarNomePastaPaciente(dadosParaSalvar, `(Cópia ${idUnico})`);
        const resultado = await executarSalvamentoBanco(dadosParaSalvar, `(Cópia ${idUnico})`, { arquivos: anexos });
        if (!resultado.ok) registroReabrirPasta = null;
    } else if (btn.id === "btnModalCancelarExclusao") {
        fecharModalExcluir();
    } else if (btn.id === "btnModalConfirmarExclusao") {
        if (!pacienteExcluirModal || !pacienteExcluirModal._nomePasta) return;

        try {
            await dirHandleBanco.removeEntry(pacienteExcluirModal._nomePasta, { recursive: true });
            fecharModalExcluir();
            mostrarToast("Registro excluído com sucesso!", "sucesso");

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
    let partes = textoVisual.split(/\s*-\s*/);
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
   ============================================================ */
window.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => {
        document.body.classList.add("carregado");
    });
});

/* ============================================================
   MÓDULO 17 — ATALHOS DE TECLADO
   ============================================================ */
document.addEventListener("keydown", (e) => {
    // O ESC fecha o paciente aberto no banco. A checagem é feita pelo
    // registroAbertoPasta (quem sabe se há alguém aberto) — antes olhava
    // uma classe "foco-registro" no <body> que deixou de existir, então
    // na prática o atalho estava morto.
    if (e.key === "Escape" && registroAbertoPasta) {
        e.preventDefault();
        if (podeDescartarEdicaoAberta()) fecharRegistroAberto();
        return;
    }

    if (e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const nomeAba = ordemPaginas[parseInt(e.key, 10) - 1];
        ativarAba(nomeAba);
        localStorage.setItem("automed_abaAtiva", nomeAba);
        return;
    }

    if (e.ctrlKey && e.key === "Enter" && abaAtualNome === "lme") {
        e.preventDefault();
        document.getElementById("gerarBtn")?.click();
        return;
    }

    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c" && abaAtualNome === "lme") {
        e.preventDefault();
        document.getElementById("copiarBtn")?.click();
    }
});

/* ============================================================
   MÓDULO 18 — NOVA CONSULTA (BOTÃO "LIMPAR" DAS DROPZONES)
   ============================================================ */
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

document.getElementById("btnLimparLme")?.addEventListener("click", () => {
    textoPDF = "";
    textoPDFSolicitacao = "";
    arquivoAgendamentoObj = null;
    arquivoSolicitacaoObj = null;
    dadosBancoCarregados = null;

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
    localStorage.removeItem("automed_rascunhoResultado");

    mostrarToast("Campos limpos. Pronto para uma nova consulta.", "sucesso");
});

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

    atualizarLinhaExcel();
    mostrarToast("Campos limpos. Pronto para uma nova consulta.", "sucesso");
});

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
   ============================================================ */
function atualizarPainelInicialBanco() {
    const conectado = !!dirHandleBanco;

    const cartaoConexao = document.getElementById("cartaoStatusConexao");
    const textoConexao = document.getElementById("statusConexaoTopo");
    const acaoConectar = document.getElementById("acaoConectarTopo");
    const btnReconectar = document.getElementById("btnReconectarBanco");

    if (textoConexao) textoConexao.textContent = conectado ? "CONECTADO" : "DESCONECTADO";
    cartaoConexao?.classList.toggle("conectado", conectado);

    acaoConectar?.classList.toggle("recolhido", conectado);
    btnReconectar?.classList.toggle("oculto", !conectado);

    // Com o banco conectado a lista ganha altura fixa (vira uma caixa com
    // rolagem própria); qual altura exatamente, quem decide é
    // ajustarAlturaListaRegistros, medindo o que sobra até o rodapé.
    document.getElementById("listaRegistrosBanco")?.classList.toggle("conectado", conectado);
    ajustarAlturaListaRegistros();

    const total = document.getElementById("statusTotalTopo");
    if (total) total.textContent = conectado ? mapaPacientesBanco.size : "—";
}

function atualizarEstatisticasBanco() {
    // O antigo cartão RESUMO DO BANCO (totais de OMs e especialidades) foi
    // retirado na v1.6.2; na v1.6.3 os cartões de "com pendências" e
    // "concluídos" também saíram, para deixar o cabeçalho só com o status
    // da pasta e o total de pacientes — montados por atualizarPainelInicialBanco.
    atualizarPainelInicialBanco();
}

/* ============================================================
   MÓDULO 20 — BACKUP DO BANCO DE DADOS (EXPORTAR / IMPORTAR)
   ============================================================ */
document.getElementById("btnExportarBackup")?.addEventListener("click", () => {
    if (!dirHandleBanco || mapaPacientesBanco.size === 0) {
        mostrarToast("Conecte o banco e certifique-se de que há pacientes salvos.", "aviso");
        return;
    }

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

        for (const dados of lista) {
            if (!dados || !dados.paciente) { ignorados++; continue; }

            if (buscarPacienteExistentePorNome(dados.paciente)) {
                ignorados++;
                continue;
            }

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
   ============================================================ */
const campoResultadoLme = document.getElementById("resultado");

if (campoResultadoLme) {
    campoResultadoLme.addEventListener("input", () => {
        localStorage.setItem("automed_rascunhoResultado", campoResultadoLme.innerHTML);
    });

    document.getElementById("gerarBtn")?.addEventListener("click", () => {
        setTimeout(() => {
            if (campoResultadoLme.innerHTML.trim()) {
                localStorage.setItem("automed_rascunhoResultado", campoResultadoLme.innerHTML);
            }
        }, 0);
    });

    const rascunhoSalvo = localStorage.getItem("automed_rascunhoResultado");
    if (rascunhoSalvo && rascunhoSalvo.trim() && !campoResultadoLme.innerHTML.trim()) {
        campoResultadoLme.innerHTML = rascunhoSalvo;
    }
}

/* ============================================================
   MÓDULO 22 — VISUALIZADOR DE REGISTROS DO BANCO (PÁGINA BANCO)
   ============================================================ */
const LOTE_REGISTROS = 50;

let mapaRegistrosPorPasta = new Map();
let filtroRegistros = "";
let quantidadeVisivelRegistros = LOTE_REGISTROS;

let registroAbertoPasta = null;
let registroReabrirPasta = null;
let registroTemAlteracao = false;
let registroAvisouDescarte = false;
let anexosPendentesRegistro = [];
let urlsTemporariasRegistro = [];
let posicaoRolagemAntesDoFoco = null;
let posicaoScrollListaAntesDoFoco = null;

// Índice do item destacado pela navegação de teclado (setas ↑/↓ + Enter)
// — ver MÓDULO 25. Fica aqui, junto do resto do estado da lista, porque
// renderizarRegistrosBanco (mais abaixo) já o zera na primeira renderização.
let indiceRegistroSelecionado = -1;

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

/* ------------------------------------------------------------------
   As etapas de DIEx levam "emFila: true" (v1.6.2): elas se revelam uma
   de cada vez, na ordem em que estão aqui — AGENDAMENTO libera REMESSA
   PARA OM, que libera ENVIO PARA S2. Enquanto trancada, a etiqueta não
   some do DOM: ela encolhe (classe .etapa-trancada no style.css), e é
   por isso que aparecer e desaparecer tem transição.
   EXCEL e DOC não têm "emFila" e continuam sempre visíveis — a fila é
   só dos DIEx. A contagem do cabeçalho (x/5) segue somando TODAS as
   etapas, inclusive as ainda trancadas: elas continuam sendo trabalho
   a fazer, apenas não estão na vez.
   ------------------------------------------------------------------ */
const ITENS_CHECKLIST = [
    { chave: "diexAgendamento", rotulo: "DIEx de Agendamento",    dica: "LME — modelo de agendamento", pagina: "lme", modelo: "agendamento", emFila: true },
    { chave: "diexRemessaOM",   rotulo: "DIEx de Remessa para OM", dica: "LME — modelo de remessa",     pagina: "lme", modelo: "remessa",     emFila: true },
    { chave: "diexS2",          rotulo: "DIEx de Envio para S2",   dica: "LME — modelo da S2",          pagina: "lme", modelo: "s2",          emFila: true },
    { chave: "excel",           rotulo: "Linha do Excel",          dica: "Linha copiada para a planilha", pagina: "excel" },
    { chave: "doc",             rotulo: "PDF renomeado (DOC)",     dica: "Documento renomeado e salvo",   pagina: "doc" }
];

const ITENS_CHECKLIST_EM_FILA = ITENS_CHECKLIST.filter(item => item.emFila);

/* Devolve as etapas que devem estar à mostra para este paciente.
   Uma etapa em fila aparece quando todas as anteriores da fila já
   estiverem feitas — ou quando ela mesma já estiver feita, para que
   desmarcar uma etapa antiga não faça sumir uma que já foi cumprida. */
function etapasVisiveisDoChecklist(dados) {
    const checklist = lerChecklist(dados);
    const visiveis = new Set(
        ITENS_CHECKLIST.filter(item => !item.emFila).map(item => item.chave)
    );

    let anterioresFeitas = true;
    for (const item of ITENS_CHECKLIST_EM_FILA) {
        if (anterioresFeitas || checklist[item.chave]) visiveis.add(item.chave);
        if (!checklist[item.chave]) anterioresFeitas = false;
    }

    return visiveis;
}

function lerChecklist(dados) {
    const guardado = (dados && typeof dados.checklist === "object" && dados.checklist) ? dados.checklist : {};
    const completo = {};

    for (const item of ITENS_CHECKLIST) {
        completo[item.chave] = guardado[item.chave] === true;
    }
    return completo;
}

function progressoChecklist(dados) {
    const checklist = lerChecklist(dados);
    const feitos = ITENS_CHECKLIST.filter(item => checklist[item.chave]).length;

    return {
        feitos,
        total: ITENS_CHECKLIST.length,
        completo: feitos === ITENS_CHECKLIST.length,
        vazio: feitos === 0
    };
}

async function salvarChecklistNoDisco(dados) {
    if (!dirHandleBanco) {
        mostrarToast("Conecte a pasta do banco para registrar o andamento.", "aviso");
        return false;
    }

    try {
        const pasta = await dirHandleBanco.getDirectoryHandle(dados._nomePasta, { create: true });
        await gravarArquivoNaPasta(pasta, "dados.json", JSON.stringify(limparCamposInternos(dados), null, 4));
        return true;
    } catch (erro) {
        console.error("Erro ao gravar o checklist:", erro);
        mostrarToast(`Não foi possível gravar o andamento (${erro.name || "erro"}).`, "erro");
        return false;
    }
}

async function definirItemChecklist(dados, chave, feito) {
    const checklist = lerChecklist(dados);
    checklist[chave] = feito === true;
    dados.checklist = checklist;

    const gravou = await salvarChecklistNoDisco(dados);
    if (!gravou) {
        checklist[chave] = !feito;
        dados.checklist = checklist;
    }

    atualizarProgressoNaLista(dados);
    atualizarPainelInicialBanco();
    return checklist[chave];
}

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
    preencherListaSugestao("listaTiposOMRegistro", Object.keys(tratamentoPorTipoOM));
    preencherListaSugestao(
        "listaEspecialidadesRegistro",
        especialidadesConhecidas.map(esp => esp.toLowerCase().replace(/\b\w/g, letra => letra.toUpperCase()))
    );
}

function normalizarParaBusca(texto) {
    return (texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
}

function textoBuscavelDoRegistro(dados) {
    return normalizarParaBusca([
        dados.paciente, dados.omAbr, dados.om, dados.especialidade,
        dados.medico, dados.data, dados.dataMilitar, dados.numeroDIEx
    ].join(" "));
}

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

function criarColunaRegistro(texto, classeExtra) {
    const span = document.createElement("span");
    span.className = "registro-col " + classeExtra;
    span.textContent = texto || "-";
    return span;
}

function aplicarProgressoNaColuna(span, dados) {
    const { feitos, total, completo, vazio } = progressoChecklist(dados);

    span.textContent = `${feitos}/${total}`;
    span.classList.remove("pendente", "andamento", "completo");
    span.classList.add(completo ? "completo" : vazio ? "pendente" : "andamento");
    span.title = completo
        ? "Todas as etapas deste paciente estão concluídas."
        : `Faltam ${total - feitos} etapa(s) para concluir este paciente.`;
}

function atualizarProgressoNaLista(dados) {
    const item = document.querySelector(`.registro-item[data-pasta="${CSS.escape(dados._nomePasta)}"]`);
    const span = item?.querySelector(".registro-col-progresso");
    if (span) aplicarProgressoNaColuna(span, dados);
}

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

    const progresso = document.createElement("span");
    progresso.className = "registro-col registro-col-progresso";
    aplicarProgressoNaColuna(progresso, dados);
    cabecalho.appendChild(progresso);

    const dicaFechar = document.createElement("span");
    dicaFechar.className = "registro-dica-fechar";
    dicaFechar.textContent = "clique para voltar à lista";
    cabecalho.appendChild(dicaFechar);

    const seta = document.createElement("span");
    seta.className = "registro-seta";
    seta.textContent = "▼";
    cabecalho.appendChild(seta);

    cabecalho.addEventListener("click", () => alternarRegistro(item));

    item.appendChild(cabecalho);
    return item;
}

function mostrarMensagemNaLista(container, mensagem) {
    const aviso = document.createElement("div");
    aviso.className = "lista-registros-vazia";
    aviso.textContent = mensagem;
    container.appendChild(aviso);
}

function renderizarRegistrosBanco() {
    const container = document.getElementById("listaRegistrosBanco");
    if (!container) return;

    mapaRegistrosPorPasta = new Map();
    for (const dados of mapaPacientesBanco.values()) {
        if (dados && dados._nomePasta) mapaRegistrosPorPasta.set(dados._nomePasta, dados);
    }

    container.innerHTML = "";
    ativarModoFoco(false);
    registroAbertoPasta = null;
    registroTemAlteracao = false;
    indiceRegistroSelecionado = -1;
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

    if (registroReabrirPasta) {
        const item = container.querySelector(`.registro-item[data-pasta="${CSS.escape(registroReabrirPasta)}"]`);
        registroReabrirPasta = null;
        if (item) abrirRegistro(item);
    }

    ajustarAlturaListaRegistros();
}

function preferirMenosMovimento() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function abrirSanfona(el) {
    if (!el) return;
    clearTimeout(el._timerSanfona);

    if (preferirMenosMovimento()) {
        el.style.maxHeight = "";
        el.style.opacity = "";
        return;
    }

    el.classList.remove("sanfona-fechada", "sanfona-animando");
    el.style.maxHeight = "none";
    el.style.overflow = "visible";
    const alturaFinal = el.scrollHeight;

    el.style.maxHeight = "0px";
    el.style.overflow = "hidden";
    el.classList.add("sanfona-fechada", "sanfona-animando");

    void el.offsetHeight;

    requestAnimationFrame(() => {
        el.classList.remove("sanfona-fechada");
        el.style.maxHeight = `${alturaFinal}px`;
    });

    el._timerSanfona = setTimeout(() => {
        clearTimeout(el._timerSanfona);
        el.style.maxHeight = "";
        el.style.overflow = "";
        el.classList.remove("sanfona-animando");
    }, 300);
}

function sincronizarSanfona(el) {
    if (!el) return;
    if (el.classList.contains("sanfona-animando")) {
        el.style.maxHeight = `${el.scrollHeight}px`;
    }
    // O conteúdo do cartão mudou de tamanho (anexo novo, arquivos que
    // acabaram de ser lidos): a caixa em modo foco acompanha.
    ajustarAlturaListaRegistros();
}

function fecharSanfona(el, aoTerminar) {
    const concluir = () => { if (typeof aoTerminar === "function") aoTerminar(); };
    if (!el) { concluir(); return; }

    clearTimeout(el._timerSanfona);

    if (preferirMenosMovimento()) {
        concluir();
        return;
    }

    const alturaAtual = el.offsetHeight;
    el.classList.remove("sanfona-fechada", "sanfona-animando");
    el.style.maxHeight = `${alturaAtual}px`;
    el.style.overflow = "hidden";

    void el.offsetHeight;

    el.classList.add("sanfona-animando");

    requestAnimationFrame(() => {
        el.classList.add("sanfona-fechada");
        el.style.maxHeight = "0px";
    });

    el._timerSanfona = setTimeout(() => {
        el.classList.remove("sanfona-animando", "sanfona-fechada");
        el.style.maxHeight = "";
        el.style.overflow = "";
        concluir();
    }, 240);
}

function liberarUrlsTemporarias() {
    for (const url of urlsTemporariasRegistro) {
        try { URL.revokeObjectURL(url); } catch { }
    }
    urlsTemporariasRegistro = [];
}

function podeDescartarEdicaoAberta() {
    if (!registroTemAlteracao) return true;

    if (!registroAvisouDescarte) {
        registroAvisouDescarte = true;
        mostrarToast("Há alterações não salvas neste registro. Clique de novo para descartá-las.", "aviso");
        return false;
    }
    return true;
}

/* ==================================================================
   MODO FOCO ANIMADO (v1.6.2)
   ------------------------------------------------------------------
   Abrir um paciente esconde os outros; fechar traz todos de volta. O
   que mudou na v1.6.2 é COMO isso acontece: antes as outras linhas
   davam um corte seco (display: none), o que deixava a caixa com um
   vazio verde e denunciava que existe um "modo foco" por baixo. Agora
   elas encolhem e voltam a crescer na mesma sanfona do corpo do
   paciente — abrir parece afastar a lista, fechar parece trazê-la de
   volta, e no fim o usuário só vê o banco de sempre.

   Todas as linhas escondidas têm exatamente a mesma altura (só o
   cabeçalho: o corpo pertence a quem está aberto), então basta medir
   UM cabeçalho para saber a altura de destino de todas — daí
   alturaDeUmaLinhaDoBanco.
   ================================================================== */
const DURACAO_FOCO_MS = 320;

function alturaDeUmaLinhaDoBanco(lista) {
    const cabecalho = lista.querySelector(".registro-cabecalho");
    return cabecalho ? cabecalho.offsetHeight : 40;
}

function limparAnimacaoDeFoco(item) {
    clearTimeout(item._timerFoco);
    item.classList.remove("registro-item-animando", "registro-item-colapsado");
    item.style.maxHeight = "";
}

function esconderIrmaosDoFoco(lista) {
    const irmaos = [...lista.children].filter(el =>
        el.classList.contains("registro-item") && !el.classList.contains("aberto")
    );

    for (const item of irmaos) {
        clearTimeout(item._timerFoco);

        if (preferirMenosMovimento()) {
            item.classList.remove("registro-item-animando");
            item.classList.add("registro-item-colapsado");
            item.style.maxHeight = "";
            continue;
        }

        // Já colapsado (trocou de paciente sem fechar): nada a animar.
        if (item.classList.contains("registro-item-colapsado")) continue;

        item.style.maxHeight = `${item.offsetHeight}px`;
        item.classList.add("registro-item-animando");
        void item.offsetHeight;

        requestAnimationFrame(() => {
            item.classList.add("registro-item-colapsado");
            item.style.maxHeight = "0px";
        });

        item._timerFoco = setTimeout(() => {
            item.classList.remove("registro-item-animando");
            item.style.maxHeight = "";
        }, DURACAO_FOCO_MS);
    }
}

function revelarIrmaosDoFoco(lista) {
    const colapsados = [...lista.children].filter(el =>
        el.classList.contains("registro-item-colapsado")
    );
    if (colapsados.length === 0) return false;

    if (preferirMenosMovimento()) {
        colapsados.forEach(limparAnimacaoDeFoco);
        return false;
    }

    const alturaAlvo = alturaDeUmaLinhaDoBanco(lista);

    for (const item of colapsados) {
        clearTimeout(item._timerFoco);

        item.classList.add("registro-item-animando");
        item.style.maxHeight = "0px";
        void item.offsetHeight;

        requestAnimationFrame(() => {
            item.classList.remove("registro-item-colapsado");
            item.style.maxHeight = `${alturaAlvo}px`;
        });

        item._timerFoco = setTimeout(() => {
            item.classList.remove("registro-item-animando");
            item.style.maxHeight = "";
        }, DURACAO_FOCO_MS);
    }

    return true;
}

/* Enquanto as linhas voltam a crescer, a altura útil da caixa muda a
   cada quadro e o navegador vai grudando a rolagem no fim do conteúdo.
   Reafirmar a posição salva em todo quadro faz a lista reaparecer
   exatamente onde estava, em vez de dar um pulo no último quadro. */
function segurarRolagemDaLista(lista, alvo, duracao) {
    const inicio = performance.now();

    function passo() {
        lista.scrollTop = alvo;
        if (performance.now() - inicio < duracao) requestAnimationFrame(passo);
    }

    requestAnimationFrame(passo);
}

function ativarModoFoco(ativo) {
    const lista = document.getElementById("listaRegistrosBanco");
    if (!lista) return;

    if (ativo) {
        // Guarda onde a rolagem da lista estava antes de abrir o paciente
        if (!lista.classList.contains("modo-foco")) {
            posicaoScrollListaAntesDoFoco = lista.scrollTop;
        }

        lista.classList.add("modo-foco");
        esconderIrmaosDoFoco(lista);
        lista.scrollTop = 0;
        return;
    }

    lista.classList.remove("modo-foco");

    const alvo = posicaoScrollListaAntesDoFoco;
    posicaoScrollListaAntesDoFoco = null;

    const animou = revelarIrmaosDoFoco(lista);
    ajustarAlturaListaRegistros();

    if (alvo === null) return;
    if (animou) segurarRolagemDaLista(lista, alvo, DURACAO_FOCO_MS);
    else lista.scrollTop = alvo;
}

/* ==================================================================
   ALTURA DA LISTA (v1.6.2)
   ------------------------------------------------------------------
   A página BANCO deve caber inteira na tela — sem rolagem da janela.
   Como o que fica acima da lista muda de tamanho (cartões de status,
   backup aberto ou fechado, painel de dados extraídos aberto ou
   fechado, rodapé recolhido ou não), a altura da lista não pode ser um
   número fixo no CSS: ela é o que sobra.

   O detalhe chato: o <body> usa "zoom", então o que se escreve em
   height NÃO é o que a tela mede. A razão entre getBoundingClientRect
   (medida da tela) e offsetHeight (medida do layout) devolve esse fator
   sem precisar chutar o valor do zoom.
   ================================================================== */
function ajustarAlturaListaRegistros() {
    const lista = document.getElementById("listaRegistrosBanco");
    const pagina = document.getElementById("pagina-banco");
    if (!lista || !pagina) return;

    if (!lista.classList.contains("conectado")) {
        lista.style.removeProperty("--altura-lista");
        return;
    }

    if (!pagina.classList.contains("ativa")) return;

    const caixa = lista.getBoundingClientRect();
    const escala = lista.offsetHeight > 0 ? caixa.height / lista.offsetHeight : 0;
    if (!escala) return;

    const topo = caixa.top + window.scrollY;

    const rodapeRegistros = document.querySelector("#pagina-banco .rodape-registros");
    const alturaRodapeRegistros = rodapeRegistros
        ? rodapeRegistros.getBoundingClientRect().height + 10 * escala
        : 0;

    const footer = document.getElementById("footerSistema");
    const alturaFooter = (footer && !footer.classList.contains("recolhido"))
        ? footer.getBoundingClientRect().height
        : 0;

    const folga = 14 * escala;
    const disponivel = window.innerHeight - topo - alturaRodapeRegistros - alturaFooter - folga;

    const alturaCalculada = Math.round(disponivel / escala);
    
    // Trava a altura em no máximo 645px (nunca aumenta além disso, apenas reduz se a tela for menor)
    const alturaFinal = Math.min(645, Math.max(200, alturaCalculada));

    lista.style.setProperty("--altura-lista", `${alturaFinal}px`);
}

function alturaDoCartaoEmFoco(lista) {
    return null;
}

function sincronizarTravaDeRolagem() {
    ajustarAlturaListaRegistros();
}

let timerAlturaLista = null;
window.addEventListener("resize", () => {
    clearTimeout(timerAlturaLista);
    timerAlturaLista = setTimeout(ajustarAlturaListaRegistros, 120);
});

function fecharRegistroAberto(aoConcluir = null) {
    const container = document.getElementById("listaRegistrosBanco");
    const aberto = container?.querySelector(".registro-item.aberto");

    // Trocar de paciente NÃO é o mesmo que voltar para a lista: ali o
    // modo foco continua valendo (só muda quem está aberto), então nem
    // as outras linhas reaparecem nem faz sentido gastar animação
    // fechando um corpo que some no mesmo instante em que outro abre.
    const vaiAbrirOutro = typeof aoConcluir === "function";

    if (aberto) {
        aberto.classList.remove("aberto");
        const corpo = aberto.querySelector(".registro-corpo");

        if (corpo) {
            if (vaiAbrirOutro) corpo.remove();
            else fecharSanfona(corpo, () => corpo.remove());
        }
    }

    if (!vaiAbrirOutro) ativarModoFoco(false);

    registroAbertoPasta = null;
    registroTemAlteracao = false;
    registroAvisouDescarte = false;
    anexosPendentesRegistro = [];
    liberarUrlsTemporarias();

    if (vaiAbrirOutro) aoConcluir();
}

function alternarRegistro(item) {
    // Se o cartão clicado já está aberto, fecha no primeiro clique diretamente
    if (item.classList.contains("aberto") || registroAbertoPasta === item.dataset.pasta) {
        fecharRegistroAberto();
        return;
    }

    // Se outro cartão estava aberto, fecha o anterior e abre o novo
    fecharRegistroAberto(() => {
        abrirRegistro(item);
    });
}

function marcarRegistroEditado(corpo) {
    registroTemAlteracao = true;
    registroAvisouDescarte = false;

    const btnSalvar = corpo.querySelector(".btn-salvar-registro");
    if (btnSalvar) btnSalvar.disabled = false;
}

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
        if (campo.chave === "om" && omsConhecidas[input.value]) {
            const campoAbr = corpo.querySelector('[data-campo="omAbr"]');
            if (campoAbr) campoAbr.value = omsConhecidas[input.value];
        }
    });

    caixa.appendChild(label);
    caixa.appendChild(input);
    return caixa;
}

function criarChecklistRegistro(dados) {
    const grade = document.createElement("div");
    grade.className = "registro-checklist";

    const checklist = lerChecklist(dados);

    for (const item of ITENS_CHECKLIST) {
        const etiqueta = document.createElement("label");
        etiqueta.className = "item-checklist" + (checklist[item.chave] ? " feito" : "");
        etiqueta.dataset.item = item.chave;
        etiqueta.title = item.dica;

        const caixa = document.createElement("input");
        caixa.type = "checkbox";
        caixa.checked = checklist[item.chave];

        const texto = document.createElement("span");
        texto.className = "item-checklist-texto";
        texto.textContent = item.rotulo;

        caixa.addEventListener("change", async () => {
            caixa.disabled = true;
            const estadoFinal = await definirItemChecklist(dados, item.chave, caixa.checked);

            caixa.checked = estadoFinal;
            etiqueta.classList.toggle("feito", estadoFinal);
            caixa.disabled = false;

            marcarProximoPassoNoChecklist(grade, dados);
        });

        etiqueta.appendChild(caixa);
        etiqueta.appendChild(texto);
        grade.appendChild(etiqueta);
    }

    marcarProximoPassoNoChecklist(grade, dados);
    return grade;
}

function marcarProximoPassoNoChecklist(grade, dados) {
    const proximo = proximoItemPendente(dados);
    const visiveis = etapasVisiveisDoChecklist(dados);

    for (const etiqueta of grade.querySelectorAll(".item-checklist")) {
        const chave = etiqueta.dataset.item;
        etiqueta.classList.toggle("proximo", !!proximo && chave === proximo.chave);
        etiqueta.classList.toggle("etapa-trancada", !visiveis.has(chave));

        const caixa = etiqueta.querySelector('input[type="checkbox"]');
        // Etapa trancada sai também da navegação por Tab: se não dá para
        // ver, não deveria dar para marcar sem querer.
        if (caixa) caixa.tabIndex = visiveis.has(chave) ? 0 : -1;
    }

    ajustarAlturaListaRegistros();
}

function proximoItemPendente(dados) {
    const checklist = lerChecklist(dados);
    return ITENS_CHECKLIST.find(item => !checklist[item.chave]) || null;
}

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

async function visualizarArquivoDoRegistro(nomePasta, nomeArquivo) {
    try {
        const pasta = await dirHandleBanco.getDirectoryHandle(nomePasta);
        const handle = await pasta.getFileHandle(nomeArquivo);
        const arquivo = await handle.getFile();

        const url = URL.createObjectURL(arquivo);
        urlsTemporariasRegistro.push(url);

        const janela = window.open(url, "_blank");
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

    configurarDropZone(dropzone, input, async (file) => {
        try {
            anexosPendentesRegistro.push({
                nomeOriginal: file.name,
                destino: select.value,
                bytes: await file.arrayBuffer()
            });

            marcarRegistroEditado(corpo);
            await carregarArquivosDoRegistro(dados, areaArquivos);
            sincronizarSanfona(corpo);
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

function criarAcoesRegistro(dados, corpo) {
    const acoes = document.createElement("div");
    acoes.className = "registro-acoes";

    const btnSalvar = document.createElement("button");
    btnSalvar.type = "button";
    btnSalvar.className = "btn-registro btn-salvar-registro";
    btnSalvar.textContent = "SALVAR ALTERAÇÕES";
    btnSalvar.disabled = true;
    btnSalvar.addEventListener("click", () => salvarAlteracoesRegistro(dados, corpo));

    const selectUsar = document.createElement("select");
    selectUsar.className = "select-usar-registro";

    const passoLme = passoDoLME(dados);
    for (const opcao of [
        { valor: "lme", texto: `USAR NO LME (${passoLme.item.rotulo.toUpperCase()})` },
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
    btnUsar.className = "btn-registro btn-usar-registro";
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

function abrirRegistro(item) {
    const dados = mapaRegistrosPorPasta.get(item.dataset.pasta);
    if (!dados) return;

    const corpo = document.createElement("div");
    corpo.className = "registro-corpo";

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

    const tituloArquivos = document.createElement("div");
    tituloArquivos.className = "registro-subtitulo";
    tituloArquivos.textContent = "ARQUIVOS NA PASTA";
    corpo.appendChild(tituloArquivos);

    const areaArquivos = document.createElement("div");
    areaArquivos.className = "registro-arquivos";
    corpo.appendChild(areaArquivos);

    corpo.appendChild(criarAreaAnexoRegistro(dados, corpo, areaArquivos));

    const tituloChecklist = document.createElement("div");
    tituloChecklist.className = "registro-subtitulo";
    tituloChecklist.textContent = "ANDAMENTO DO PACIENTE (grava ao marcar)";
    corpo.appendChild(tituloChecklist);

    corpo.appendChild(criarChecklistRegistro(dados));
    corpo.appendChild(criarAcoesRegistro(dados, corpo));

    item.querySelector(".registro-corpo")?.remove();
    item.appendChild(corpo);

    // Se este cartão estava encolhido pelo modo foco (troca de paciente
    // sem passar pela lista), desfaz o encolhimento antes de abrir.
    limparAnimacaoDeFoco(item);
    item.classList.add("aberto");

    ativarModoFoco(true);
    abrirSanfona(corpo);
    ajustarAlturaListaRegistros();

    registroAbertoPasta = item.dataset.pasta;
    registroTemAlteracao = false;
    registroAvisouDescarte = false;
    anexosPendentesRegistro = [];

    carregarArquivosDoRegistro(dados, areaArquivos).then(() => {
        sincronizarSanfona(corpo);
    });
}

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

function dataValidaParaBanco(texto) {
    return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test((texto || "").trim());
}

function nomeFinalDoAnexo(anexo, dados) {
    const pacienteLimpo = sanitizarNomePasta(dados.paciente);
    if (anexo.destino === "marcacao") return `Marcação - ${pacienteLimpo}.pdf`;
    if (anexo.destino === "solicitacao") return `Solicitação - ${pacienteLimpo}.pdf`;
    return sanitizarNomePasta(anexo.nomeOriginal);
}

async function salvarAlteracoesRegistro(dadosOriginais, corpo) {
    if (!dirHandleBanco) {
        mostrarToast("Conecte a pasta do banco antes de salvar.", "aviso");
        return;
    }

    const editado = { ...dadosOriginais };
    for (const campo of CAMPOS_EDITAVEIS_REGISTRO) {
        const input = corpo.querySelector(`[data-campo="${campo.chave}"]`);
        if (input) editado[campo.chave] = input.value.trim();
    }

    if (!editado.paciente || !editado.omAbr) {
        mostrarToast("Paciente e OM abreviada não podem ficar em branco.", "aviso");
        return;
    }
    if (!dataValidaParaBanco(editado.data)) {
        mostrarToast("A data da consulta precisa estar no formato dd/mm/aaaa.", "aviso");
        return;
    }

    recalcularCamposDerivados(editado);

    const pastaAtual = dadosOriginais._nomePasta;
    const pastaNova = montarNomePastaPaciente(editado);
    const vaiRenomear = pastaNova !== pastaAtual;

    const btnSalvar = corpo.querySelector(".btn-salvar-registro");
    if (btnSalvar) btnSalvar.disabled = true;

    try {
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

        registroTemAlteracao = false;
        anexosPendentesRegistro = [];
        registroReabrirPasta = pastaNova;
        await atualizarListaPacientesBanco();

    } catch (erro) {
        console.error("Erro ao salvar as alterações do registro:", erro);
        mostrarToast(`Não foi possível salvar (${erro.name || "erro"}).`, "erro");
        if (btnSalvar) btnSalvar.disabled = false;
    }
}

async function pastaJaExisteNoBanco(nomePasta) {
    try {
        await dirHandleBanco.getDirectoryHandle(nomePasta);
        return true;
    } catch {
        return false;
    }
}

async function gravarAnexosPendentes(pastaHandle, dados) {
    for (const anexo of anexosPendentesRegistro) {
        await gravarArquivoNaPasta(pastaHandle, nomeFinalDoAnexo(anexo, dados), anexo.bytes);
    }
}

function renomearAnexoPadrao(nomeArquivo, pacienteAntigo, pacienteNovo) {
    if (pacienteAntigo === pacienteNovo) return nomeArquivo;
    const antigo = sanitizarNomePasta(pacienteAntigo);
    const novo = sanitizarNomePasta(pacienteNovo);

    if (nomeArquivo === `Marcação - ${antigo}.pdf`) return `Marcação - ${novo}.pdf`;
    if (nomeArquivo === `Solicitação - ${antigo}.pdf`) return `Solicitação - ${novo}.pdf`;
    return nomeArquivo;
}

function passoDoLME(dados) {
    const doLme = ITENS_CHECKLIST.filter(item => item.pagina === "lme");
    const checklist = lerChecklist(dados);

    const pendente = doLme.find(item => !checklist[item.chave]);
    return { item: pendente || doLme[doLme.length - 1], tudoFeito: !pendente };
}

async function copiarTextoSimples(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch {
        return false;
    }
}

function sincronizarChecklistNaTela(dados) {
    const item = document.querySelector(`.registro-item[data-pasta="${CSS.escape(dados._nomePasta)}"]`);
    const grade = item?.querySelector(".registro-checklist");
    if (!grade) return;

    const checklist = lerChecklist(dados);

    for (const etiqueta of grade.querySelectorAll(".item-checklist")) {
        const marcado = checklist[etiqueta.dataset.item] === true;
        etiqueta.classList.toggle("feito", marcado);
        const caixa = etiqueta.querySelector('input[type="checkbox"]');
        if (caixa) caixa.checked = marcado;
    }

    marcarProximoPassoNoChecklist(grade, dados);
}

async function usarRegistroNaPagina(destino, dados) {
    const identificador = `${dados.paciente} - ${dados.omAbr} (${dados.data})`;

    if (!mapaPacientesBanco.has(identificador)) {
        mostrarToast("Não foi possível carregar este paciente. Clique em ATUALIZAR e tente de novo.", "erro");
        return;
    }

    const paginas = { lme: "inputPesquisaBanco", excel: "inputPesquisaExcel", doc: "inputPesquisaDoc" };
    const campo = document.getElementById(paginas[destino]);
    if (!campo) return;

    if (destino === "doc" && tipoDocumentoSelect) {
        tipoDocumentoSelect.value = "o";
        tipoDocumentoSelect.dispatchEvent(new Event("change"));
    }

    campo.value = identificador;
    campo.dispatchEvent(new Event("input"));

    ativarAba(destino);
    localStorage.setItem("automed_abaAtiva", destino);

    let itemEtapa = null;
    let avisoExtra = "";

    if (destino === "lme") {
        const passo = passoDoLME(dados);
        itemEtapa = passo.item;

        if (modeloSelect) {
            modeloSelect.value = passo.item.modelo;
            modeloSelect.dispatchEvent(new Event("change"));
            localStorage.setItem("automed_modeloSelect", modeloSelect.value);
        }

        if (passo.tudoFeito) {
            avisoExtra = " Todos os DIEx deste paciente já estavam marcados como feitos.";
        }

        document.getElementById("gerarBtn")?.click();
        document.getElementById("copiarBtn")?.click();

    } else if (destino === "excel") {
        itemEtapa = ITENS_CHECKLIST.find(item => item.pagina === "excel");
        atualizarLinhaExcel();
        document.getElementById("copiarExcelBtn")?.click();

    } else if (destino === "doc") {
        itemEtapa = ITENS_CHECKLIST.find(item => item.pagina === "doc");
        const nomeGerado = document.getElementById("nomeArquivoGerado")?.value.trim();
        if (nomeGerado) {
            const copiou = await copiarTextoSimples(nomeGerado);
            mostrarToast(
                copiou ? "Nome do arquivo gerado e copiado!" : "Nome gerado. Não foi possível copiar automaticamente.",
                copiou ? "sucesso" : "aviso"
            );
        } else {
            mostrarToast("Paciente carregado, mas não deu para montar o nome do arquivo.", "aviso");
        }
    }

    if (itemEtapa && !lerChecklist(dados)[itemEtapa.chave]) {
        mostrarToast(
            `${dados.paciente}: pronto na página ${destino.toUpperCase()}.${avisoExtra} Marcar "${itemEtapa.rotulo}" como feito?`,
            "sucesso",
            {
                texto: "MARCAR",
                aoClicar: async () => {
                    await definirItemChecklist(dados, itemEtapa.chave, true);
                    sincronizarChecklistNaTela(dados);
                    mostrarToast(`${dados.paciente}: "${itemEtapa.rotulo}" marcado como feito.`, "sucesso");
                }
            }
        );
    } else {
        mostrarToast(`${dados.paciente} carregado na página ${destino.toUpperCase()}.${avisoExtra}`, "sucesso");
    }
}

document.getElementById("inputBuscaRegistros")?.addEventListener("input", (e) => {
    if (registroTemAlteracao) {
        mostrarToast("As alterações não salvas do registro aberto foram descartadas.", "aviso");
    }
    filtroRegistros = e.target.value;
    quantidadeVisivelRegistros = LOTE_REGISTROS;
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

function alternarBackupBanco(abrir) {
    const area = document.getElementById("areaBackupBanco");
    const botao = document.getElementById("btnToggleBackupBanco");
    if (!area || !botao) return;

    botao.classList.toggle("aberto", abrir);
    area.classList.toggle("aberto", abrir);
    area.classList.remove("oculto");
    botao.setAttribute("aria-expanded", String(abrir));
    localStorage.setItem("automed_backupBancoAberto", String(abrir));

    // A faixa de backup empurra a lista para baixo: remede o que sobrou.
    ajustarAlturaListaRegistros();
    setTimeout(ajustarAlturaListaRegistros, 320);
}

document.getElementById("btnToggleBackupBanco")?.addEventListener("click", () => {
    const estaAberto = document.getElementById("btnToggleBackupBanco")?.classList.contains("aberto");
    alternarBackupBanco(!estaAberto);
});

alternarBackupBanco(localStorage.getItem("automed_backupBancoAberto") === "true");

prepararListasDeSugestaoRegistros();
renderizarRegistrosBanco();
atualizarPainelInicialBanco();


/* ============================================================
   MÓDULO 23 — ADICIONAR PACIENTE PELA PÁGINA BANCO (v1.6.2)
   ------------------------------------------------------------
   Cadastrar um paciente novo exigia sair da página inicial, ir até o
   LME, anexar os dois PDFs e voltar. Aqui as mesmas duas dropzones
   ficam na própria página do banco, com botão próprio de gravar.

   O estado é SEPARADO do estado da página LME de propósito: soltar um
   PDF aqui não pode mexer no que já estiver montado lá (nem o
   contrário), senão um cadastro rápido no banco apagaria o DIEx que a
   pessoa estava escrevendo.
   ============================================================ */
let textoPDFBancoAgendamento = "";
let textoPDFBancoSolicitacao = "";
let arquivoBancoAgendamentoObj = null;
let arquivoBancoSolicitacaoObj = null;

const dropZoneBancoAgendamento = document.getElementById("dropZoneBancoAgendamento");
const pdfBancoAgendamento = document.getElementById("pdfBancoAgendamento");
const dropZoneBancoSolicitacao = document.getElementById("dropZoneBancoSolicitacao");
const pdfBancoSolicitacao = document.getElementById("pdfBancoSolicitacao");

const CAMPOS_EXTRAIDOS_BANCO = [
    { id: "dbgPacienteBanco",      chave: "paciente" },
    { id: "dbgMedicoBanco",        chave: "medico", formatar: formatarMedico },
    { id: "dbgEspecialidadeBanco", chave: "especialidade" },
    { id: "dbgDataHoraBanco",      chave: "dataHora" },
    { id: "dbgLocalBanco",         chave: "local" },
    { id: "dbgOMBanco",            chave: "om" },
    { id: "dbgOMAbrBanco",         chave: "omAbr" },
    { id: "dbgTipoOMBanco",        chave: "tipoOM" },
    { id: "dbgNumeroDIExBanco",    chave: "numeroDIEx" },
    { id: "dbgDataDIExBanco",      chave: "dataDIEx" }
];

function dadosDaFaixaAdicionarBanco() {
    if (!textoPDFBancoAgendamento) return null;
    return extrairDadosCompletos(textoPDFBancoAgendamento, textoPDFBancoSolicitacao);
}

function atualizarPainelExtraidosBanco() {
    const dados = dadosDaFaixaAdicionarBanco();

    for (const campo of CAMPOS_EXTRAIDOS_BANCO) {
        const el = document.getElementById(campo.id);
        if (!el) continue;

        const valor = dados ? dados[campo.chave] : "";
        el.textContent = (campo.formatar ? campo.formatar(valor) : valor) || "-";
    }
}

function lerBancoAgendamento(file) {
    arquivoBancoAgendamentoObj = null;
    lerTextoDePDF(
        file, "nomeArquivoBancoAgendamento",
        texto => { textoPDFBancoAgendamento = texto; atualizarPainelExtraidosBanco(); },
        "Erro ao ler o PDF de Agendamento.",
        conteudo => { arquivoBancoAgendamentoObj = conteudo; }
    );
}

function lerBancoSolicitacao(file) {
    arquivoBancoSolicitacaoObj = null;
    lerTextoDePDF(
        file, "nomeArquivoBancoSolicitacao",
        texto => { textoPDFBancoSolicitacao = texto; atualizarPainelExtraidosBanco(); },
        "Erro ao ler o PDF de Solicitação.",
        conteudo => { arquivoBancoSolicitacaoObj = conteudo; }
    );
}

if (dropZoneBancoAgendamento && pdfBancoAgendamento) {
    configurarDropZone(dropZoneBancoAgendamento, pdfBancoAgendamento, lerBancoAgendamento);
}
if (dropZoneBancoSolicitacao && pdfBancoSolicitacao) {
    configurarDropZone(dropZoneBancoSolicitacao, pdfBancoSolicitacao, lerBancoSolicitacao);
}

function limparFaixaAdicionarBanco(avisar = true) {
    textoPDFBancoAgendamento = "";
    textoPDFBancoSolicitacao = "";
    arquivoBancoAgendamentoObj = null;
    arquivoBancoSolicitacaoObj = null;

    if (pdfBancoAgendamento) pdfBancoAgendamento.value = "";
    if (pdfBancoSolicitacao) pdfBancoSolicitacao.value = "";

    for (const id of ["nomeArquivoBancoAgendamento", "nomeArquivoBancoSolicitacao"]) {
        const el = document.getElementById(id);
        if (el) el.textContent = "";
    }

    atualizarPainelExtraidosBanco();
    if (avisar) mostrarToast("PDFs descartados. Pronto para cadastrar outro paciente.", "sucesso");
}

document.getElementById("btnLimparAdicionarBanco")?.addEventListener("click", () => {
    limparFaixaAdicionarBanco();
});

document.getElementById("btnAdicionarPacienteBanco")?.addEventListener("click", async () => {
    if (!dirHandleBanco) {
        mostrarToast("Primeiro clique em 'CONECTAR PASTA DO BANCO'.", "aviso");
        return;
    }

    const dadosNovos = dadosDaFaixaAdicionarBanco();
    if (!dadosNovos || !dadosNovos.paciente) {
        mostrarToast("Anexe pelo menos o PDF de Agendamento antes de adicionar.", "aviso");
        return;
    }

    const anexos = montarAnexosDePDFs(dadosNovos, arquivoBancoAgendamentoObj, arquivoBancoSolicitacaoObj);

    // Mesmo tratamento de duplicidade da barra do LME: se já existe
    // alguém com este nome, quem decide o que fazer é o usuário.
    const existente = buscarPacienteExistentePorNome(dadosNovos.paciente);
    if (existente) {
        abrirModalDuplicidade(existente, dadosNovos, anexos);
        return;
    }

    // v1.6.3: os PDFs anexados aqui só saem com um clique em LIMPAR — não
    // mais sozinhos ao salvar. E o paciente recém-criado já abre direto
    // na caixa do banco (mesmo mecanismo de registroReabrirPasta usado ao
    // editar um registro existente).
    registroReabrirPasta = montarNomePastaPaciente(dadosNovos);
    const resultado = await executarSalvamentoBanco(dadosNovos, "", { arquivos: anexos });
    if (!resultado.ok) registroReabrirPasta = null;
});

/* Painel retrátil de conferência: mesma sanfona da faixa de backup. */
function alternarExtraidosBanco(abrir) {
    const area = document.getElementById("areaExtraidosBanco");
    const botao = document.getElementById("btnToggleExtraidosBanco");
    if (!area || !botao) return;

    botao.classList.toggle("aberto", abrir);
    area.classList.toggle("aberto", abrir);
    botao.setAttribute("aria-expanded", String(abrir));
    localStorage.setItem("automed_extraidosBancoAberto", String(abrir));

    // O painel empurra a lista para baixo: remede o espaço que sobrou,
    // agora e de novo quando a transição terminar.
    ajustarAlturaListaRegistros();
    setTimeout(ajustarAlturaListaRegistros, 340);
}

document.getElementById("btnToggleExtraidosBanco")?.addEventListener("click", () => {
    const estaAberto = document.getElementById("btnToggleExtraidosBanco")?.classList.contains("aberto");
    alternarExtraidosBanco(!estaAberto);
});

alternarExtraidosBanco(localStorage.getItem("automed_extraidosBancoAberto") === "true");
atualizarPainelExtraidosBanco();

/* ============================================================
   MÓDULO 24 — "ABRIR NO BANCO" NAS BARRAS DE PESQUISA (v1.6.3)
   ------------------------------------------------------------
   As barras de pesquisa do LME, EXCEL e DOC perderam os botões
   EXCLUIR/SALVAR (MÓDULO 14): no lugar, cada uma ganhou este botão, que
   leva direto para a página BANCO já com o registro do paciente
   digitado na pesquisa aberto na caixa — mesmo mecanismo de
   registroReabrirPasta usado ao salvar/editar um registro (MÓDULO 22).
   ============================================================ */
function abrirPacienteNoBancoAPartirDaPesquisa(idCampoPesquisa) {
    const campo = document.getElementById(idCampoPesquisa);
    const dados = campo ? mapaPacientesBanco.get(campo.value) : null;

    if (!dados || !dados._nomePasta) {
        mostrarToast("Selecione um paciente salvo na pesquisa antes de abrir no banco.", "aviso");
        return;
    }

    ativarAba("banco");
    localStorage.setItem("automed_abaAtiva", "banco");

    const campoBusca = document.getElementById("inputBuscaRegistros");
    if (campoBusca) campoBusca.value = dados.paciente;
    filtroRegistros = dados.paciente;
    quantidadeVisivelRegistros = LOTE_REGISTROS;

    registroReabrirPasta = dados._nomePasta;
    renderizarRegistrosBanco();
}

document.getElementById("btnAbrirNoBancoLme")?.addEventListener("click", () => {
    abrirPacienteNoBancoAPartirDaPesquisa("inputPesquisaBanco");
});
document.getElementById("btnAbrirNoBancoExcel")?.addEventListener("click", () => {
    abrirPacienteNoBancoAPartirDaPesquisa("inputPesquisaExcel");
});
document.getElementById("btnAbrirNoBancoDoc")?.addEventListener("click", () => {
    abrirPacienteNoBancoAPartirDaPesquisa("inputPesquisaDoc");
});

/* ============================================================
   MÓDULO 25 — NAVEGAÇÃO POR TECLADO NA LISTA DE REGISTROS (BANCO)
   ------------------------------------------------------------
   Com a página BANCO ativa, as setas ↑/↓ percorrem os pacientes visíveis
   na caixa (a primeira seta pressionada sempre pousa no primeiro da
   lista) e Enter abre/fecha o paciente destacado — dá para navegar o
   banco inteiro sem tocar no mouse. Fica desligado enquanto um registro
   já está aberto (ali as setas/Enter pertencem à edição dos campos) ou
   enquanto um modal está por cima da tela.
   ============================================================ */
function itensRegistroVisiveis() {
    const container = document.getElementById("listaRegistrosBanco");
    return container ? [...container.querySelectorAll(".registro-item")] : [];
}

function marcarRegistroSelecionadoPorTeclado(indice) {
    const itens = itensRegistroVisiveis();
    for (const item of itens) item.classList.remove("registro-selecionado-teclado");

    const item = itens[indice];
    if (!item) return;

    item.classList.add("registro-selecionado-teclado");
    item.scrollIntoView({ block: "nearest" });
}

function existeModalAberto() {
    return !!document.querySelector(".modal-overlay:not(.oculto)");
}

document.addEventListener("keydown", (e) => {
    if (abaAtualNome !== "banco" || registroAbertoPasta || existeModalAberto()) return;
    if (!["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;

    const alvo = e.target;
    const emOutroCampo = alvo instanceof HTMLElement
        && (alvo.isContentEditable || (alvo.tagName === "INPUT" && alvo.id !== "inputBuscaRegistros"));
    if (emOutroCampo) return;

    const itens = itensRegistroVisiveis();
    if (itens.length === 0) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();

        indiceRegistroSelecionado = indiceRegistroSelecionado === -1
            ? 0
            : Math.min(itens.length - 1, Math.max(0, indiceRegistroSelecionado + (e.key === "ArrowDown" ? 1 : -1)));

        marcarRegistroSelecionadoPorTeclado(indiceRegistroSelecionado);
    } else if (e.key === "Enter" && indiceRegistroSelecionado !== -1) {
        e.preventDefault();
        const item = itens[indiceRegistroSelecionado];
        if (item) alternarRegistro(item);
    }
});
