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
