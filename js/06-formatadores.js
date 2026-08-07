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
