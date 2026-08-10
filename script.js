/* ============================================================
   AUTOMED - GERADOR DE DIEx
   ============================================================ */

let textoPDF = "";

const dropZone = document.getElementById("dropZone");
const pdfFile = document.getElementById("pdfFile");
const modeloSelect = document.getElementById("modeloSelect");
const pronomePaciente = document.getElementById("pronomePaciente");
const inputSenha = document.getElementById("inputSenha");

// Garantia de inicialização das variáveis globais
if (!window.bancoMedicosJSON) {
    window.bancoMedicosJSON = { postos: {}, medicosFixos: {} };
}
if (!window.especialidadesConhecidas) {
    window.especialidadesConhecidas = [];
}

/* ============================================================
   UTILITÁRIOS E FORMATADORES
   ============================================================ */

function capitalizarPalavras(texto) {
    if (!texto) return "";
    const minusculas = ["de", "da", "do", "dos", "das", "e"];
    return texto
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map((palavra, index) => {
            if (/^\d+º$/i.test(palavra)) return palavra;
            if (/^nº\d+$/i.test(palavra)) return palavra.toLowerCase();
            if (index > 0 && minusculas.includes(palavra)) return palavra;
            return palavra.charAt(0).toUpperCase() + palavra.slice(1);
        })
        .join(" ");
}

function formatarLocal(local) {
    if (!local) return "";

    local = local.replace(/Usuário Marcação.*$/i, "").trim();

    const blocos = local.split(/\s*-\s*/);

    const blocosFormatados = blocos.map(bloco => {
        if (!bloco.trim()) return "";

        let texto = bloco.replace(/\b(\d+)\s*º?\s*andar\b/gi, "$1º Andar");

        texto = texto
            .replace(/\bN[º°]\s*(\d+)/gi, "nº$1")
            .replace(/\b(?<![º°\d])(\d+)\b(?!\s*º|\s*ª|\s*Andar)/gi, "nº$1");

        return capitalizarPalavras(texto);
    }).filter(b => b.length > 0);

    return blocosFormatados.join(" - ");
}

function normalizarTexto(texto) {
    if (!texto) return "";
    return texto
        .replace(/[\r\n]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function formatarMedico(nomeBruto) {
    if (!nomeBruto) return "";

    // 1. Limpa rótulos de campos adjacentes do SIGH Web
    let nomeLimpo = nomeBruto
        .replace(/\s*Especialidade.*$/i, "")
        .replace(/\s*Agendamento.*$/i, "")
        .replace(/\s*Dia.*$/i, "")
        .replace(/\s*Local.*$/i, "")
        .trim();

    // 2. Se houver hífen (ex: "MEDLUCAS - INTERVCOR SERVIÇOS MÉDICOS LTDA"), 
    // isola apenas a primeira parte ("MEDLUCAS")
    if (nomeLimpo.includes("-")) {
        nomeLimpo = nomeLimpo.split("-")[0].trim();
    }

    const chaveSemEspaco = nomeLimpo.toUpperCase().replace(/\s+/g, "");
    const banco = window.bancoMedicosJSON || {};

    // 3. Busca no dicionário de médicos fixos (ex: "MEDLUCAS" -> "Med LUCAS")
    if (banco.medicosFixos && banco.medicosFixos[chaveSemEspaco]) {
        return banco.medicosFixos[chaveSemEspaco];
    }

    // 4. Busca por postos/patentes caso não esteja no dicionário fixo
    if (banco.postos) {
        for (let postoKey in banco.postos) {
            if (chaveSemEspaco.startsWith(postoKey)) {
                const rotuloPosto = banco.postos[postoKey];
                const nomeRestante = chaveSemEspaco.substring(postoKey.length).trim();
                return `${rotuloPosto} ${capitalizarPalavras(nomeRestante.toLowerCase())}`;
            }
        }
    }

    return capitalizarPalavras(nomeLimpo.toLowerCase());
}

function formatarEspecialidade(texto) {
    if (!texto) return "";
    const textoUpper = texto.toUpperCase();
    const lista = window.especialidadesConhecidas || [];

    for (let esp of lista) {
        if (textoUpper.includes(esp.toUpperCase())) {
            return capitalizarPalavras(esp);
        }
    }

    if (texto.length < 60) {
        return capitalizarPalavras(texto);
    }

    return "";
}

/* ============================================================
   EXTRAÇÃO DE DADOS DO PDF
   ============================================================ */

function extrairDadosCompletos(texto) {
    if (!texto) return null;

    // PACIENTE
    let paciente = "";
    let matchPac = texto.match(/para\s+o\s+(?:Sra\.|Sr\.)?\s*([A-ZÀ-Ú\s]+?)\s*\(/i) ||
                   texto.match(/Especialidade:\s*([A-ZÀ-Ú\s]+?)\s*Agendamento:/i) ||
                   texto.match(/Paciente:\s*\d*\s*-\s*([A-ZÀ-Ú\s]+?)(?=\s*Médico|\s*Especialidade|\s*$)/i);
    if (matchPac) paciente = normalizarTexto(matchPac[1]);

    // PRONTUÁRIO
    let prontuario = "";
    let matchPront = texto.match(/prontu[áa]rio:?\s*(\d+)/i) || 
                     texto.match(/\(prontu[áa]rio\s*(\d+)\)/i) ||
                     texto.match(/Paciente:\s*(\d+)/i);
    if (matchPront) prontuario = matchPront[1];

    // SENHA SIGH-WEB
    let senha = "";
    let matchSenha = texto.match(/Senha\s*(?:\(do paciente\))?:?\s*(\w+)/i);
    if (matchSenha) senha = matchSenha[1];

    // MÉDICO
    let medico = "";
    let m1 = texto.match(/\((MED\s+[A-Z]+|TEN\s+[A-Z]+|MAJ\s+[A-Z]+|CAP\s+[A-Z]+|TC\s+[A-Z]+|CEL\s+[A-Z]+)\)/i);
    if (m1) {
        medico = m1[1]; // Correção: m1[1] já contém todo o grupo capturado
    }
    if (!medico) {
        // Captura o texto corrido entre "Médico" e os rótulos seguintes
        let m2 = texto.match(/(?:Médico\(a\)\/Profissional|Médico\/Prof\.?|Médico:?)\s*:?\s*([^:\n\r]+?)(?=\s+Especialidade|\s+Dia|\s+Local|\s+Usuário|\s*Agendamento|\s*$)/i);
        if (m2 && m2[1].trim().length > 2) {
            medico = m2[1];
        }
    }
    if (!medico) {
        let m3 = texto.match(/(?:Usuário\s+Marcação:\s*\S+\s+)?([A-Z0-9\s]+?)\s*Médico(?:\(a\))?\/Prof/i);
        if (m3) {
            let partes = m3[1].trim().split(/\s+/);
            medico = partes.pop();
        }
    }

    // ESPECIALIDADE
    let especialidade = formatarEspecialidade(texto);

    if (!especialidade) {
        let e1 = texto.match(/Dia\s+da\s+Consulta:\s*([A-ZÀ-Ú\s]+?)(?=\s+Paciente|\s+Agendamento|\s+Data|\s*$)/i);
        if (e1 && e1[1].trim().length > 3 && !e1[1].includes("/")) {
            especialidade = capitalizarPalavras(e1[1]);
        }
    }

    if (!especialidade) {
        let e2 = texto.match(/(?:consulta|teleconsulta)\s+com\s+(?:o|a)?\s*([A-ZÀ-Ú\s]+?)\s*\(/i);
        if (e2 && e2[1].trim().length > 3) {
            especialidade = capitalizarPalavras(e2[1]);
        }
    }

    // DATA E HORÁRIO
    let data = "";
    let horario = "";

    let matchDataHora = texto.match(/em\s+(\d{2}\s+de\s+[a-z]+\s+de\s+\d{4}),?\s+às\s+([\d{2}h\d{2}||\d{2}:?\d{2}||\d{2}\s+horas]+)/i) ||
                        texto.match(/Dia da Consulta:\s*([\d\/]{10})\s*-\s*([\d:]{5})/i);

    if (matchDataHora) {
        data = matchDataHora[1];
        horario = matchDataHora[2];
    } else {
        let mData = texto.match(/Agendamento:\s*([\d\/]{10})/i) || texto.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
        if (mData) data = mData[1];
        let mHora = texto.match(/\b(\d{2}:\d{2})\b/);
        if (mHora) horario = mHora[1];
    }

    // LOCAL
    let local = "";
    let matchLocalOld = texto.match(/(?:manh[aã]|tarde)\s+(.*?)\s+Local\s+Consulta:\s*(.*?)\s*Usuário\s+Marcação:/i);
    
    if (matchLocalOld) {
        local = `${matchLocalOld[1]} - ${matchLocalOld[2]}`;
    } else {
        let matchLocal = texto.match(/no\s+(.*?)\s+desta\s+OMS/i) ||
                         texto.match(/Local da Consulta:\s*(.*?)Usuário/i);
        if (matchLocal) local = normalizarTexto(matchLocal[1]);
    }

    return {
        paciente,
        prontuario,
        senha,
        medico: formatarMedico(medico),
        especialidade,
        data,
        horario,
        local: formatarLocal(local)
    };
}

/* ============================================================
   LEITURA DO PDF (pdf.js)
   ============================================================ */

function lerTextoDePDF(file, idElementoNome, aoConcluir) {
    document.getElementById(idElementoNome).textContent = file.name;
    const reader = new FileReader();

    reader.onload = async function () {
        try {
            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let texto = "";

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                texto += content.items.map(item => item.str).join(" ") + " ";
            }

            aoConcluir(texto);
            console.log(texto);
            (erro);
        } catch (erro) {
            console.error(erro);
            alert("Erro ao ler o arquivo PDF.");
        }
    };

    reader.readAsArrayBuffer(file);
}

if (dropZone && pdfFile) {
    dropZone.addEventListener("click", () => pdfFile.click());
    dropZone.addEventListener("dragover", e => {
        e.preventDefault();
        dropZone.classList.add("hover");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("hover"));
    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.classList.remove("hover");
        if (e.dataTransfer.files[0]) processarArquivo(e.dataTransfer.files[0]);
    });
    pdfFile.addEventListener("change", e => {
        if (e.target.files[0]) processarArquivo(e.target.files[0]);
    });
}

function processarArquivo(file) {
    lerTextoDePDF(file, "nomeArquivoAgendamento", texto => {
        textoPDF = texto;
        atualizarPainel();
    });
}

/* ============================================================
   ATUALIZAÇÃO DA INTERFACE E GERAÇÃO
   ============================================================ */

function atualizarPainel() {
    const dados = extrairDadosCompletos(textoPDF);
    if (!dados) return;

    document.getElementById("dbgPaciente").textContent = dados.paciente || "-";
    document.getElementById("dbgProntuario").textContent = dados.prontuario || "-";
    document.getElementById("dbgMedico").textContent = dados.medico || "-";
    document.getElementById("dbgEspecialidade").textContent = dados.especialidade || "-";
    document.getElementById("dbgDataHora").textContent = (dados.data || "-") + (dados.horario ? ` às ${dados.horario}` : "");
    document.getElementById("dbgLocal").textContent = dados.local || "-";

    if (inputSenha && dados.senha) {
        inputSenha.value = dados.senha;
    }
}

function alternarModelo() {
    document.querySelectorAll(".modeloTexto").forEach(el => el.style.display = "none");
    const selecionado = modeloSelect.value;
    const modeloEl = document.getElementById(`modelo_${selecionado}`);
    if (modeloEl) {
        modeloEl.style.display = "block";
    }
}

if (modeloSelect) {
    modeloSelect.addEventListener("change", alternarModelo);
}

alternarModelo();

const gerarBtn = document.getElementById("gerarBtn");
if (gerarBtn) {
    gerarBtn.addEventListener("click", () => {
        if (!textoPDF) {
            alert("Por favor, anexe o PDF de agendamento primeiro.");
            return;
        }

        const dados = extrairDadosCompletos(textoPDF);
        if (!dados) return;

        const modeloId = `modelo_${modeloSelect.value}`;
        const modeloEl = document.getElementById(modeloId);

        if (!modeloEl) {
            alert("Modelo de texto não encontrado.");
            return;
        }

        const senhaUsada = inputSenha ? inputSenha.value.trim() : (dados.senha || "");
        
        // Pega o conteúdo HTML formatado diretamente da div do modelo ativo
        let modeloTexto = modeloEl.innerHTML;

        const resultadoHtml = modeloTexto
            .replace(/{PACIENTE}/g, dados.paciente || "")
            .replace(/{PRONTUARIO}/g, dados.prontuario || "")
            .replace(/{SENHA}/g, senhaUsada)
            .replace(/{MEDICO}/g, dados.medico || "")
            .replace(/{ESPECIALIDADE}/g, dados.especialidade || "")
            .replace(/{DATA}/g, dados.data || "")
            .replace(/{HORARIO}/g, dados.horario || "")
            .replace(/{LOCAL}/g, dados.local || "")
            .replace(/{PRONOMEPACIENTE}/g, pronomePaciente ? pronomePaciente.value : "");

        document.getElementById("resultado").innerHTML = resultadoHtml;
    });
}

// CÓPIA COM SUPORTE A PARÁGRAFOS NATIVOS E TAB DO WORD / DIEx
const copiarBtn = document.getElementById("copiarBtn");
if (copiarBtn) {
    copiarBtn.addEventListener("click", async () => {
        const el = document.getElementById("resultado");
        if (!el.innerText.trim()) {
            alert("Gere o texto antes de copiar.");
            return;
        }

        try {
            // Monta o texto puro mantendo a tabulação \t no início de cada parágrafo
            let textoPuro = "";
            const paragrafos = el.querySelectorAll("p");
            if (paragrafos.length > 0) {
                paragrafos.forEach(p => {
                    textoPuro += p.innerText + "\n\n";
                });
            } else {
                textoPuro = el.innerText;
            }

            const blobHtml = new Blob([el.innerHTML], { type: "text/html" });
            const blobText = new Blob([textoPuro.trim()], { type: "text/plain" });

            const data = [new ClipboardItem({
                "text/html": blobHtml,
                "text/plain": blobText
            })];

            await navigator.clipboard.write(data);
            alert("Texto copiado com sucesso! (Parágrafos e TABs formatados para o Word/DIEx)");
        } catch {
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand("copy");
            alert("Texto copiado!");
        }
    });
}