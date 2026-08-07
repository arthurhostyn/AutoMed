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

    const novoNome = document.getElementById("nomeArquivoGerado").value.trim();

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
