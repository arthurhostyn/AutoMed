/* ============================================================
   MÓDULO 9 — DROPZONES E BOTÕES DE RECOLHER
   O que este arquivo faz: liga cada área de "arrastar e soltar PDF"
   ao seu input de arquivo escondido, e controla o botão que
   recolhe/expande o bloco de dropzones (lembrando o estado escolhido
   no localStorage).
   ============================================================ */

/**
 * Liga os eventos de clique/arrastar-soltar de uma dropzone ao seu
 * <input type="file"> escondido, chamando "callback(file)" sempre que
 * um arquivo é selecionado (seja por clique, seja por arraste).
 */
function configurarDropZone(dropZone, inputFile, callback) {
    // Clicar na área abre o seletor de arquivos do sistema operacional.
    dropZone.addEventListener("click", () => {
        inputFile.click();
    });

    // Feedback visual enquanto o usuário arrasta um arquivo por cima.
    dropZone.addEventListener("dragover", e => {
        e.preventDefault();   // necessário para permitir o "drop" depois
        dropZone.classList.add("hover");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("hover");
    });

    // Soltar o arquivo sobre a área: pega o primeiro arquivo arrastado.
    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.classList.remove("hover");
        const file = e.dataTransfer.files[0];
        if (file) callback(file);
    });

    // Também funciona quando o arquivo é escolhido pela janela do sistema.
    inputFile.addEventListener("change", e => {
        const file = e.target.files[0];
        if (file) callback(file);
    });

    // REVISÃO (acessibilidade): as dropzones são <div>s, que por padrão
    // não recebem foco de teclado nem são anunciadas como algo clicável
    // por leitores de tela. Isso torna a dropzone inutilizável para quem
    // navega só com o teclado. As três linhas abaixo resolvem isso sem
    // alterar a aparência: tornam a div focável (Tab), anunciam que é um
    // botão, e fazem Enter/Espaço disparar o mesmo clique do mouse.
    if (!dropZone.hasAttribute("tabindex")) {
        dropZone.setAttribute("tabindex", "0");
    }
    if (!dropZone.hasAttribute("role")) {
        dropZone.setAttribute("role", "button");
    }
    dropZone.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();   // evita rolar a página ao pressionar espaço
            inputFile.click();
        }
    });
}

// Liga cada par (dropzone, input) já existente no HTML à sua função
// de leitura correspondente (ver MÓDULO 8 — leitor-pdf.js).
configurarDropZone(dropZone, pdfFile, lerPDF);
configurarDropZone(dropZoneSolicitacao, pdfSolicitacao, lerPDFSolicitacao);
configurarDropZone(dropZoneDocConsulta, pdfConsultaDoc, lerConsultaDoc);
configurarDropZone(dropZoneDocSolicitacao, pdfSolicitacaoDoc, lerSolicitacaoDoc);
configurarDropZone(dropZoneDocArquivo, pdfRenomear, capturarArquivoRenomear);
configurarDropZone(dropZoneComissaoEtica, pdfComissaoEtica, lerComissaoEtica);
configurarDropZone(dropZoneExcelAgendamento, pdfExcelAgendamento, lerExcelAgendamento);
configurarDropZone(dropZoneExcelSolicitacao, pdfExcelSolicitacao, lerExcelSolicitacao);


/**
 * Liga o clique no cabeçalho de um bloco de dropzones ao
 * recolher/expandir do conteúdo abaixo dele, lembrando a preferência
 * do usuário no localStorage (persiste entre sessões).
 */
function configurarToggleDropzone(headerId, containerId, storageKey) {
    const header = document.getElementById(headerId);
    const container = document.getElementById(containerId);

    if (!header || !container) return;   // página sem esse bloco: não faz nada

    function aplicarEstadoDropzone(recolher) {
        if (recolher) {
            container.classList.add("recolhido");
        } else {
            container.classList.remove("recolhido");
        }
    }

    // Restaura o estado salvo da última vez que o usuário usou o sistema.
    const estaRecolhido = localStorage.getItem(storageKey) === "true";
    if (estaRecolhido) {
        aplicarEstadoDropzone(true);
    }

    header.addEventListener("click", () => {
        const recolher = !container.classList.contains("recolhido");
        aplicarEstadoDropzone(recolher);
        localStorage.setItem(storageKey, recolher);
    });
}

configurarToggleDropzone("headerDropzoneLme", "areaDropzoneLme", "automed_dropzoneLmeRecolhido");
configurarToggleDropzone("headerDropzoneExcel", "areaDropzoneExcel", "automed_dropzoneExcelRecolhido");
configurarToggleDropzone("headerDropzoneDoc", "areaDropzoneDoc", "automed_dropzoneDocRecolhido");
