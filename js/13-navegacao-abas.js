/* ============================================================
   MÓDULO 13 — NAVEGAÇÃO ENTRE ABAS/PÁGINAS E MENU DO RODAPÉ
   O que este arquivo faz: troca a página visível (LME/DOC/EXCEL/
   BANCO) quando uma aba é clicada, decidindo a direção da animação,
   e controla o botão que recolhe o rodapé inteiro.
   ============================================================ */

const abas = document.querySelectorAll(".aba");
const paginas = document.querySelectorAll(".pagina");
const ordemPaginas = ["lme", "doc", "excel", "banco"];   // ordem usada para decidir a direção do slide
let abaAtualNome = "lme";

/** Ativa a página "nomeAba", aplicando a animação de slide na direção correta. */
function ativarAba(nomeAba) {
    const abaAlvo = document.querySelector(`.aba[data-aba="${nomeAba}"]`);
    const paginaAlvo = document.getElementById("pagina-" + nomeAba);

    if (abaAlvo && paginaAlvo) {
        const indexAtual = ordemPaginas.indexOf(abaAtualNome);
        const indexNova = ordemPaginas.indexOf(nomeAba);

        // Desativa tudo antes de ativar a nova aba/página.
        abas.forEach(a => a.classList.remove("ativa"));
        paginas.forEach(p => {
            p.classList.remove("ativa", "slide-direita", "slide-esquerda");
        });

        abaAlvo.classList.add("ativa");
        paginaAlvo.classList.add("ativa");

        // Página mais à direita na ordem: desliza entrando pela direita.
        // Página mais à esquerda: desliza entrando pela esquerda.
        if (indexNova > indexAtual) {
            paginaAlvo.classList.add("slide-direita");
        } else if (indexNova < indexAtual) {
            paginaAlvo.classList.add("slide-esquerda");
        }

        abaAtualNome = nomeAba;
    }
}

// Ao carregar a página, retoma a última aba usada (se houver uma salva).
const abaSalva = localStorage.getItem("automed_abaAtiva");
if (abaSalva && ordemPaginas.includes(abaSalva)) {
    abaAtualNome = abaSalva;
    ativarAba(abaSalva);
}

abas.forEach(botao => {
    botao.addEventListener("click", () => {
        const nomeAba = botao.dataset.aba;
        ativarAba(nomeAba);
        localStorage.setItem("automed_abaAtiva", nomeAba);
    });
});

// Botão "▼" do rodapé: recolhe/expande o menu de abas, lembrando a
// preferência do usuário.
const btnAbas = document.getElementById("toggleAbas");
const footerSistema = document.getElementById("footerSistema");

if (btnAbas && footerSistema) {
    if (localStorage.getItem("automed_footerRecolhido") === "true") {
        footerSistema.classList.add("recolhido");
    }

    btnAbas.addEventListener("click", () => {
        footerSistema.classList.toggle("recolhido");
        const estaRecolhido = footerSistema.classList.contains("recolhido");
        localStorage.setItem("automed_footerRecolhido", estaRecolhido);
    });
}
