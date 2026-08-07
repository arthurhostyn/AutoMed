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
