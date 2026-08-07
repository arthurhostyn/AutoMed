/* ============================================================
   MÓDULO 16 — REVELAÇÃO SUAVE DA PÁGINA (ANTI-FLICKER)
   O que este arquivo faz: é o último a rodar. Ele espera o HTML
   terminar de montar e então libera a opacidade do body (ver
   css/01-base.css), evitando o "flash" de conteúdo desalinhado que
   apareceria por uma fração de segundo antes do CSS/JS aplicarem
   os estados iniciais (aba ativa, dropzones recolhidas, etc.).
   ============================================================ */

window.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => {
        document.body.classList.add("carregado");
    });
});
