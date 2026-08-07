/* ============================================================
   MÓDULO 1 — MENSAGENS FLUTUANTES (TOASTS)
   O que este arquivo faz: mostra pequenas notificações no canto da
   tela (sucesso, erro ou aviso) que somem sozinhas depois de um
   tempo. É a primeira coisa carregada porque quase todos os outros
   módulos chamam "mostrarToast" para avisar o usuário de algo.
   ============================================================ */

/**
 * Mostra uma notificação flutuante (toast) no canto superior direito.
 * @param {string} mensagem - texto a exibir para o usuário.
 * @param {"sucesso"|"erro"|"aviso"} tipo - define cor e ícone do toast.
 */
function mostrarToast(mensagem, tipo = "aviso") {
    // Procura o container dos toasts; se ainda não existe, cria um só
    // (todos os toasts futuros reaproveitam o mesmo container).
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";

        // Atributos de acessibilidade: avisam leitores de tela que o
        // conteúdo desta região muda sozinho e deve ser anunciado.
        container.setAttribute("role", "status");
        container.setAttribute("aria-live", "polite");
        container.setAttribute("aria-atomic", "true");

        document.body.appendChild(container);
    }

    // Escolhe o ícone de acordo com o tipo da mensagem.
    let icone = "ℹ️";
    if (tipo === "sucesso") icone = "✅";
    if (tipo === "erro") icone = "❌";
    if (tipo === "aviso") icone = "⚠️";

    // Monta o toast criando elementos DOM diretamente (em vez de usar
    // innerHTML com a mensagem interpolada). Isso evita que um texto
    // com caracteres "<" ou ">" seja interpretado como HTML/script —
    // mesmo hoje todas as mensagens serem fixas no próprio código,
    // essa é a forma segura de montar conteúdo dinâmico no DOM.
    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;

    const spanIcone = document.createElement("span");
    spanIcone.className = "toast-icone";
    spanIcone.textContent = icone;

    const spanTexto = document.createElement("span");
    spanTexto.className = "toast-texto";
    spanTexto.textContent = mensagem;   // textContent nunca interpreta HTML

    toast.appendChild(spanIcone);
    toast.appendChild(spanTexto);
    container.appendChild(toast);

    // Espera o próximo frame de render para então adicionar a classe
    // "visivel" — é o que dispara a transição de entrada em CSS.
    requestAnimationFrame(() => {
        toast.classList.add("visivel");
    });

    // Depois de 3.5s, inicia a saída e remove o elemento quando a
    // transição de CSS terminar.
    setTimeout(() => {
        toast.classList.remove("visivel");
        toast.addEventListener("transitionend", () => {
            toast.remove();
        });
    }, 3500);
}
