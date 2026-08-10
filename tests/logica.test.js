/* ============================================================
   TESTES AUTOMATIZADOS — logica.js
   ------------------------------------------------------------
   Roda com o test runner nativo do Node (sem instalar nada extra):

       node --test tests/
       npm test

   Cobre os formatadores e extratores de logica.js (a parte do
   AutoMed mais frágil, porque é baseada em expressões regulares
   ajustadas ao formato exato dos PDFs exportados pelo sistema de
   agendamento do Exército). Os textos de exemplo abaixo imitam o
   formato real desses PDFs (visto no próprio código dos extratores),
   só para servir de "PDF de teste" sem precisar de um arquivo .pdf.
   ============================================================ */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    formatarMedico, abreviarOM, formatarEspecialidade, extrairEspecialidadeCrua,
    formatarData, formatarDataAbreviada, formatarLocal, diaSemana,
    normalizarTexto, capitalizarPalavras, adicionarNumeroLocal,
    extrairOMSolicitante, extrairTipoOM,
    extrairDadosCompletos, extrairDadosComissaoEtica
} = require("../logica.js");

// ------------------------------------------------------------
// MÓDULO 5 — Utilitários de texto
// ------------------------------------------------------------

test("normalizarTexto: colapsa espaços/quebras de linha e arruma pontuação", () => {
    assert.equal(
        normalizarTexto("  Sala   de\nEspera ,  2º Andar  "),
        "Sala de Espera, 2º Andar"
    );
});

test("normalizarTexto: texto vazio/nulo devolve string vazia", () => {
    assert.equal(normalizarTexto(""), "");
    assert.equal(normalizarTexto(null), "");
    assert.equal(normalizarTexto(undefined), "");
});

test("capitalizarPalavras: primeira letra maiúscula em cada palavra", () => {
    assert.equal(capitalizarPalavras("SALA DE ESPERA"), "Sala De Espera");
});

test("adicionarNumeroLocal: número solto e já formatado", () => {
    assert.equal(adicionarNumeroLocal("Sala 12"), "Sala nº12");
    assert.equal(adicionarNumeroLocal("Sala N° 12"), "Sala nº12");
    assert.equal(adicionarNumeroLocal("Sala Nº12"), "Sala nº12");
});

// ------------------------------------------------------------
// MÓDULO 6 — Formatadores
// ------------------------------------------------------------

test("formatarMedico: nome cadastrado na base de conhecimento (de-para exato)", () => {
    assert.equal(formatarMedico("MAJFRANCISCOBRAGA"), "Maj FRANCISCO BRAGA");
    assert.equal(formatarMedico("tenEVERTON"), "Ten EVERTON");
});

test("formatarMedico: posto conhecido mas nome fora do dicionário", () => {
    assert.equal(formatarMedico("MAJJOAOPEREIRA"), "Maj JOAOPEREIRA");
    assert.equal(formatarMedico("CELMARIA"), "Cel MARIA");
});

test("formatarMedico: sem posto reconhecido cai para capitalização simples", () => {
    assert.equal(formatarMedico("JOAOPEREIRA"), "Joaopereira");
});

test("formatarMedico: vazio devolve vazio", () => {
    assert.equal(formatarMedico(""), "");
    assert.equal(formatarMedico(null), "");
});

test("abreviarOM: OM cadastrada devolve a sigla; desconhecida devolve o nome original", () => {
    assert.equal(abreviarOM("3º Regimento de Cavalaria de Guarda"), "3º RCG");
    assert.equal(abreviarOM("Unidade Que Não Existe No Dicionário"), "Unidade Que Não Existe No Dicionário");
    assert.equal(abreviarOM(""), "");
});

test("formatarEspecialidade: reconhece especialidade dentro de um texto maior", () => {
    assert.equal(formatarEspecialidade("CONSULTA DE TRAUMATOLOGIA MARCADA"), "Traumatologia");
    assert.equal(formatarEspecialidade("NEUROLOGIA CLINICA"), "Neurologia");
    assert.equal(formatarEspecialidade("SEM ESPECIALIDADE RECONHECIDA"), "");
});

test("extrairEspecialidadeCrua: mesma busca, mas em maiúsculas 'cru'", () => {
    assert.equal(extrairEspecialidadeCrua("consulta de urologia"), "UROLOGIA");
    assert.equal(extrairEspecialidadeCrua(""), "");
});

test("formatarData: 'dd/mm/aaaa' vira 'dd/mm/aa'", () => {
    assert.equal(formatarData("05/06/2026"), "05/06/26");
});

test("formatarData: formato inesperado devolve como veio", () => {
    assert.equal(formatarData("data-invalida"), "data-invalida");
    assert.equal(formatarData(""), "");
});

test("formatarDataAbreviada: formato militar 'd MES aa'", () => {
    assert.equal(formatarDataAbreviada("5/6/2026"), "5 JUN 26");
    assert.equal(formatarDataAbreviada("25/12/2026"), "25 DEZ 26");
});

test("formatarLocal: remove lixo de 'Usuário Marcação' e troca hífen por vírgula", () => {
    assert.equal(
        formatarLocal("Hospital Geral - Sala 12 Usuário Marcação: FULANO"),
        "Hospital Geral, Sala 12"
    );
});

test("formatarLocal: separa 'Nº Andar' do resto com vírgula", () => {
    assert.equal(formatarLocal("2º Andar Consultório 3"), "2º Andar, Consultório 3");
});

test("diaSemana: dia da semana por extenso em português", () => {
    // 05/06/2026 cai numa sexta-feira.
    assert.equal(diaSemana("05/06/2026"), "Sexta-feira");
});

// ------------------------------------------------------------
// MÓDULO 7 — Extratores de dados do PDF
// ------------------------------------------------------------

test("extrairOMSolicitante: acha a OM entre 'Comandante do' e 'Ao'", () => {
    const texto = "Do Comandante do 3º Regimento de Cavalaria de Guarda Ao Comandante da 3ª Região Militar";
    assert.equal(extrairOMSolicitante(texto), "3º Regimento de Cavalaria de Guarda");
});

test("extrairOMSolicitante: sem o padrão esperado devolve vazio", () => {
    assert.equal(extrairOMSolicitante("texto qualquer sem o padrão"), "");
});

test("extrairTipoOM: 'Comandante'/'Subcomandante'/'Diretor' viram Comando", () => {
    assert.equal(extrairTipoOM("Do Comandante do 3º RCG Ao Comandante da 3ª RM"), "Comando");
    assert.equal(extrairTipoOM("Do Subcomandante do 3º RCG Ao Comandante da 3ª RM"), "Comando");
    assert.equal(extrairTipoOM("Do Diretor do HMAPA Ao Comandante da 3ª RM"), "Comando");
});

test("extrairTipoOM: 'Chefe' isolado vira Chefia", () => {
    assert.equal(extrairTipoOM("Do Chefe da 1ª Cia Intlg Ao Comandante da 3ª RM"), "Chefia");
});

test("extrairTipoOM: 'Chefe ao Escalão' — limitação conhecida (ver avaliação)", () => {
    // O dicionário tem uma entrada específica para "Chefe ao Escalão" ->
    // "Grande Comando", mas o regex que isola o cargo (/Do\s+(.*?)\s+Ao/i)
    // para de capturar no primeiro "ao" que encontra — e o próprio "ao"
    // minúsculo dentro de "Chefe AO Escalão" já serve de delimitador,
    // porque a busca é case-insensitive. Resultado: só "Chefe" chega ao
    // dicionário, e cai em "Chefia" em vez de "Grande Comando".
    //
    // A ordenação por chave mais específica (ver extrairTipoOM) já
    // protege contra esse tipo de "sombreamento" caso o regex um dia
    // capture o cargo completo corretamente — mas reescrever o regex em
    // si fica de fora desta rodada por falta de uma amostra real de PDF
    // com esse cargo específico para validar a mudança sem risco de
    // quebrar o caso muito mais comum ("Comandante"/"Chefe").
    assert.equal(extrairTipoOM("Do Chefe ao Escalão Ao Comandante da 3ª RM"), "Chefia");
});

test("extrairTipoOM: sem cargo reconhecido/sem padrão usa 'Comando' como padrão seguro", () => {
    assert.equal(extrairTipoOM("texto qualquer sem o padrão"), "Comando");
});

test("extrairDadosCompletos: texto principal vazio devolve null", () => {
    assert.equal(extrairDadosCompletos("", ""), null);
    assert.equal(extrairDadosCompletos(null, ""), null);
});

test("extrairDadosCompletos: extrai todos os campos de um PDF de agendamento típico", () => {
    const textoAgendamento =
        "Paciente: 12345 - JOAO DA SILVA " +
        "Médico(a)/Profissional: MAJFRANCISCOBRAGA " +
        "Especialidade: TRAUMATOLOGIA " +
        "Dia da Consulta: 05/06/2026 - 08:00 " +
        "Local da Consulta: Hospital Geral - Sala 12 Usuário da Marcação: FULANO";

    const textoSolicitacao =
        "Do Comandante do 3º Regimento de Cavalaria de Guarda " +
        "Ao Comandante da 3ª Região Militar, solicito a marcação de consulta, " +
        "conforme DIEx nº 456/2026, em Porto Alegre, 5 de junho de 2026.";

    const dados = extrairDadosCompletos(textoAgendamento, textoSolicitacao);

    assert.ok(dados, "extrairDadosCompletos não deveria devolver null com PDFs válidos");
    assert.equal(dados.paciente, "JOAO DA SILVA");
    assert.equal(dados.medico, "MAJFRANCISCOBRAGA");
    assert.equal(formatarMedico(dados.medico), "Maj FRANCISCO BRAGA");
    assert.equal(dados.especialidade, "Traumatologia");
    assert.equal(dados.data, "05/06/2026");
    assert.equal(dados.horario, "08:00");
    assert.equal(dados.local, "Hospital Geral, Sala nº12");
    assert.equal(dados.om, "3º Regimento de Cavalaria de Guarda");
    assert.equal(dados.omAbr, "3º RCG");
    assert.equal(dados.tipoOM, "Comando");
    assert.equal(dados.cargoOM, "Comandante");
    assert.equal(dados.pronome, "esse");
    assert.equal(dados.numeroDIEx, "456");
    assert.equal(dados.dataDIEx, "05/06/2026");
    assert.equal(dados.dataMilitar, "5 JUN 26");
});

test("extrairDadosCompletos: sem PDF de solicitação, campos derivados dele ficam vazios/padrão", () => {
    const textoAgendamento =
        "Paciente: 12345 - MARIA SOUZA " +
        "Médico(a)/Profissional: TENEVERTON " +
        "Especialidade: PSIQUIATRIA " +
        "Dia da Consulta: 10/03/2026 - 14:30 " +
        "Local da Consulta: Policlinica - Sala 5 Usuário da Marcação: FULANO";

    const dados = extrairDadosCompletos(textoAgendamento, "");

    assert.ok(dados);
    assert.equal(dados.paciente, "MARIA SOUZA");
    assert.equal(dados.om, "");
    assert.equal(dados.omAbr, "");
    assert.equal(dados.tipoOM, "Comando");   // padrão quando não há solicitação
    assert.equal(dados.numeroDIEx, "");
    assert.equal(dados.dataDIEx, "");
});

test("extrairDadosComissaoEtica: extrai sessão, paciente e data de um parecer típico", () => {
    const texto =
        "Sessão: 12/2026 " +
        "Paciente: JOAO DA SILVA " +
        "Solicitante: FULANO DE TAL, em 05/06/2026.";

    const dados = extrairDadosComissaoEtica(texto);

    assert.ok(dados);
    assert.equal(dados.sessao, "12/2026");
    assert.equal(dados.paciente, "JOAO DA SILVA");
    assert.equal(dados.data, "05/06/2026");
    assert.equal(dados.dataFormatada, "5 JUN 26");
});

test("extrairDadosComissaoEtica: texto vazio devolve null", () => {
    assert.equal(extrairDadosComissaoEtica(""), null);
    assert.equal(extrairDadosComissaoEtica(null), null);
});
