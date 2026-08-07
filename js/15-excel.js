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
