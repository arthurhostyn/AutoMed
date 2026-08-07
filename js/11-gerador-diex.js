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
