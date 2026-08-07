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
