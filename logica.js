/* ============================================================
   AUTOMED - LÓGICA PURA DE EXTRAÇÃO E FORMATAÇÃO (logica.js)
   ------------------------------------------------------------
   ÍNDICE DE MÓDULOS:
    4. Base de conhecimento (dicionários fixos)
    5. Utilitários de texto
    6. Formatadores
    7. Extratores de dados do PDF

   Estes módulos eram, originalmente, parte de script.js (Módulos 4
   a 7). Foram movidos para este arquivo à parte porque NENHUM deles
   toca no DOM/navegador — só recebem texto e devolvem texto/objetos.
   Isso permite:

    1) Testar esta lógica automaticamente com Node.js puro (ver
       tests/logica.test.js), sem precisar simular um navegador —
       é justamente a parte mais frágil do sistema (baseada em
       expressões regulares ajustadas ao formato exato dos PDFs do
       Exército), então é a que mais vale a pena testar.
    2) Deixar claro, só de olhar o nome dos arquivos, o que é "dado
       + regra de negócio" (logica.js) e o que é "tela" (script.js).

   Carregado, no AutoMed.html, como um <script> comum ANTES do
   script.js — os dois continuam dividindo o mesmo escopo global,
   exatamente como já acontecia quando estava tudo em um arquivo só
   (o projeto não usa bundler nem type="module" de propósito: assim
   continua funcionando ao abrir o AutoMed.html direto do disco, sem
   servidor).
   ============================================================ */

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

    // REVISÃO: percorre as chaves da mais específica (mais longa) para a
    // mais genérica. Antes, a ordem era a de inserção no dicionário, e
    // "CHEFE" (mais curta) vinha antes de "Chefe ao Escalão" — como
    // "CHEFE" também é substring de "CHEFE AO ESCALÃO", a chave mais
    // específica nunca era alcançada e sempre devolvia "Chefia" em vez
    // de "Grande Comando".
    const chaves = Object.keys(cargosConhecidos).sort((a, b) => b.length - a.length);

    for (const chave of chaves) {
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
   EXPORTAÇÃO CONDICIONAL PARA NODE.JS (só para os testes)
   O bloco abaixo NÃO roda no navegador: "module" só existe no Node
   (CommonJS). No navegador este "if" é simplesmente ignorado e todas
   as funções/dicionários acima continuam disponíveis como variáveis
   globais comuns, exatamente como antes — nada muda para o AutoMed
   em uso normal. Serve apenas para tests/logica.test.js poder fazer
   "require('../logica.js')" e testar estas funções com Node puro.
   ============================================================ */
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        medicosConhecidos, postosMilitares, omsConhecidas, cargosConhecidos,
        especialidadesConhecidas, mesesAbreviados,
        normalizarTexto, capitalizarPalavras, adicionarNumeroLocal,
        formatarMedico, abreviarOM, formatarEspecialidade, extrairEspecialidadeCrua,
        formatarData, formatarDataAbreviada, formatarDataMilitar, formatarDataNomeArquivo,
        formatarLocal, diaSemana,
        extrair, extrairOMSolicitante, extrairTipoOM,
        extrairDadosCompletos, extrairDadosComissaoEtica
    };
}
