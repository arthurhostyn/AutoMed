/* ============================================================
   MÓDULO 8 — LEITURA DE ARQUIVOS PDF
   O que este arquivo faz: usa a biblioteca pdf.js (carregada via
   CDN no HTML) para ler um arquivo PDF escolhido pelo usuário e
   transformar seu conteúdo em texto puro, que depois é passado para
   os extratores do MÓDULO 7.
   ============================================================ */

/**
 * Lê um arquivo PDF e devolve seu texto através do callback "aoConcluir".
 * @param {File} file - arquivo selecionado/arrastado pelo usuário.
 * @param {string} idElementoNome - id do elemento onde exibir o nome do arquivo.
 * @param {(texto:string)=>void} aoConcluir - chamado com o texto lido, quando pronto.
 * @param {string} mensagemErro - mensagem exibida em um toast caso a leitura falhe.
 */
function lerTextoDePDF(file, idElementoNome, aoConcluir, mensagemErro) {
    // Mostra o nome do arquivo imediatamente, antes mesmo da leitura terminar
    // (feedback visual rápido para o usuário).
    document.getElementById(idElementoNome).textContent = file.name;

    const reader = new FileReader();

    // Executa quando o arquivo termina de ser carregado em memória.
    reader.onload = async function () {
        try {
            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let texto = "";

            // Percorre cada página do PDF e concatena o texto de todas elas.
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                texto += content.items.map(item => item.str).join(" ") + " ";
            }

            aoConcluir(texto);

        } catch (erro) {
            console.error(erro);
            mostrarToast(mensagemErro, "erro");
        }
    };

    // REVISÃO: a versão original não tratava falha de LEITURA do arquivo
    // (por exemplo, arquivo corrompido, removido do disco durante a
    // leitura, ou sem permissão do sistema operacional) — nesse caso o
    // usuário não via nenhum aviso e o campo simplesmente nunca era
    // preenchido. Este "onerror" fecha essa lacuna com o mesmo padrão de
    // aviso usado no resto do sistema.
    reader.onerror = function () {
        console.error("Erro ao carregar o arquivo:", reader.error);
        mostrarToast(mensagemErro, "erro");
    };

    reader.readAsArrayBuffer(file);
}

// --- Página LME ---

function lerPDF(file) {
    arquivoAgendamentoObj = file;
    dadosBancoCarregados = null;   // um novo PDF anexado invalida o paciente carregado do banco

    lerTextoDePDF(
        file,
        "nomeArquivoAgendamento",
        texto => {
            textoPDF = texto;
            atualizarPainelLME();
        },
        "Erro ao ler o PDF."
    );
}

function lerPDFSolicitacao(file) {
    arquivoSolicitacaoObj = file;
    dadosBancoCarregados = null;

    lerTextoDePDF(
        file,
        "nomeArquivoSolicitacao",
        texto => {
            textoPDFSolicitacao = texto;
            atualizarPainelLME();
        },
        "Erro ao ler PDF de solicitação."
    );
}

// --- Página DOC (modo LME SCAN) ---

function lerConsultaDoc(file) {
    lerTextoDePDF(
        file,
        "nomeArquivoConsultaDoc",
        texto => {
            textoConsultaDoc = texto;
            atualizarPainelDocLmeScan();
        },
        "Erro ao ler o PDF de Marcação."
    );
}

function lerSolicitacaoDoc(file) {
    lerTextoDePDF(
        file,
        "nomeArquivoSolicitacaoDoc",
        texto => {
            textoSolicitacaoDoc = texto;
            atualizarPainelDocLmeScan();
        },
        "Erro ao ler o PDF de Solicitação."
    );
}

/** Guarda o arquivo que será renomeado/baixado — não precisa ler o conteúdo, só o nome. */
function capturarArquivoRenomear(file) {
    arquivoRenomear = file;
    document.getElementById("nomeArquivoRenomear").textContent = file.name;
}

// --- Página DOC (modo COMISSÃO DE ÉTICA) ---

function lerComissaoEtica(file) {
    arquivoRenomear = file;   // aqui o próprio PDF anexado já é o arquivo a ser renomeado

    lerTextoDePDF(
        file,
        "nomeArquivoComissaoEtica",
        texto => {
            textoComissaoEtica = texto;
            atualizarPainelComissaoEtica();
        },
        "Erro ao ler o PDF da Comissão de Ética."
    );
}

// --- Página EXCEL ---

function lerExcelAgendamento(file) {
    lerTextoDePDF(
        file,
        "nomeArquivoExcelAgendamento",
        texto => {
            textoPDFExcelAgendamento = texto;
            dadosBancoCarregados = null;
            atualizarLinhaExcel();
        },
        "Erro ao ler PDF de Agendamento."
    );
}

function lerExcelSolicitacao(file) {
    lerTextoDePDF(
        file,
        "nomeArquivoExcelSolicitacao",
        texto => {
            textoPDFExcelSolicitacao = texto;
            dadosBancoCarregados = null;
            atualizarLinhaExcel();
        },
        "Erro ao ler PDF de Solicitação."
    );
}
