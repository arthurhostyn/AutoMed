/* ============================================================
   MÓDULO 14 — BANCO DE DADOS LOCAL, CONEXÃO E MODAIS
   O que este arquivo faz: usa a File System Access API do navegador
   para ler/gravar uma pasta escolhida pelo usuário no próprio
   computador, guardando um subdiretório por paciente com um
   "dados.json" e os PDFs originais. Também controla os modais de
   "paciente duplicado" e "confirmar exclusão".
   ============================================================ */

// Guardam temporariamente os dados envolvidos em cada modal aberto,
// para os botões de confirmação saberem em cima de qual registro agir.
let pacienteExistenteModal = null;
let pacienteNovoModal = null;
let pacienteExcluirModal = null;

// 1. CONEXÃO COM A PASTA DO BANCO DE DADOS
document.getElementById("btnConectarBanco")?.addEventListener("click", async () => {
    try {
        // Abre o seletor de pastas nativo do sistema operacional.
        dirHandleBanco = await window.showDirectoryPicker({ mode: 'readwrite' });
        const statusPermissao = await dirHandleBanco.requestPermission({ mode: 'readwrite' });

        if (statusPermissao !== 'granted') {
            mostrarToast("Você precisa permitir o acesso para o banco funcionar.", "aviso");
            return;
        }

        const statusEl = document.getElementById("statusBanco");
        if (statusEl) {
            statusEl.textContent = `CONECTADO`;
            statusEl.style.color = "#c7d59f";
        }

        try {
            await atualizarListaPacientesBanco();
            mostrarToast("Banco de dados conectado com sucesso!", "sucesso");
        } catch (e) {
            console.warn("Conectado, mas houve erro ao listar pastas:", e);
        }

    } catch (erro) {
        if (erro.name === 'AbortError') return;   // usuário cancelou a janela: não é erro
        console.error("Erro na conexão:", erro);
        mostrarToast("Erro técnico ao conectar.", "erro");
    }
});

// 2. ATUALIZAÇÃO DA LISTA DE PACIENTES SALVOS NA PASTA
/** Varre todas as subpastas do banco, lê o "dados.json" de cada uma e monta a lista de sugestões da busca. */
async function atualizarListaPacientesBanco() {
    if (!dirHandleBanco) return;

    const datalist = document.getElementById("listaPacientesBanco");
    if (!datalist) return;

    datalist.innerHTML = "";
    mapaPacientesBanco.clear();

    try {
        for await (const entry of dirHandleBanco.values()) {
            if (entry.kind !== 'directory') continue;   // ignora arquivos soltos na raiz

            try {
                const pastaHandle = entry;
                const jsonFileHandle = await pastaHandle.getFileHandle("dados.json");
                const file = await jsonFileHandle.getFile();
                const textoJson = await file.text();
                const dados = JSON.parse(textoJson);

                dados._nomePasta = entry.name;   // guarda o nome da pasta para permitir excluir depois

                const identificador = `${dados.paciente} - ${dados.omAbr} (${dados.data})`;
                mapaPacientesBanco.set(identificador, dados);

                const option = document.createElement("option");
                option.value = identificador;
                datalist.appendChild(option);
            } catch (err) {
                continue;   // pasta sem "dados.json" válido: ignora e segue para a próxima
            }
        }
    } catch (erro) {
        console.error("Erro ao varrer a pasta principal:", erro);
    }
}

// 3. SELEÇÃO DE PACIENTE PELA BARRA DE PESQUISA DO BANCO (página LME)
document.getElementById("inputPesquisaBanco")?.addEventListener("input", (e) => {
    const valorDigitado = e.target.value;

    if (mapaPacientesBanco.has(valorDigitado)) {
        dadosBancoCarregados = mapaPacientesBanco.get(valorDigitado);

        // Um paciente vindo do banco substitui os PDFs recém-anexados.
        textoPDF = "";
        textoPDFSolicitacao = "";
        arquivoAgendamentoObj = null;
        arquivoSolicitacaoObj = null;

        atualizarPainelLME();
    } else if (valorDigitado === "") {
        dadosBancoCarregados = null;
        atualizarPainelLME();
    }
});

// 4. FUNÇÃO AUXILIAR DE NORMALIZAÇÃO DE NOME PARA COMPARAR
/** Remove acentos, deixa maiúsculo e tira tudo que não for letra/número — usado só para COMPARAR nomes, não para exibir. */
function normalizarParaComparacao(texto) {
    if (!texto) return "";
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")   // remove os acentos (separados pelo normalize NFD)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
}

// 5. BUSCA DUPLICATA DE PACIENTE
/** Procura, no mapa de pacientes já carregados, alguém com o mesmo nome (ignorando acentos/maiúsculas). */
function buscarPacienteExistentePorNome(nomePaciente) {
    if (!nomePaciente) return null;
    const nomeAlvo = normalizarParaComparacao(nomePaciente);

    for (const [chave, dados] of mapaPacientesBanco.entries()) {
        if (dados && dados.paciente && normalizarParaComparacao(dados.paciente) === nomeAlvo) {
            return dados;
        }
    }
    return null;
}

// 6. CONTROLADORES DOS MODAIS

/** Abre o modal comparando o registro já salvo com o novo que está prestes a ser gravado. */
function abrirModalDuplicidade(existente, novo) {
    pacienteExistenteModal = existente;
    pacienteNovoModal = novo;

    document.getElementById("compExistentePaciente").textContent = existente.paciente || "-";
    document.getElementById("compExistenteOM").textContent = existente.omAbr || "-";
    document.getElementById("compExistenteData").textContent = existente.data || "-";
    document.getElementById("compExistenteEspecialidade").textContent = existente.especialidade || "-";
    document.getElementById("compExistenteMedico").textContent = formatarMedico(existente.medico) || "-";

    document.getElementById("compNovoPaciente").textContent = novo.paciente || "-";
    document.getElementById("compNovoOM").textContent = novo.omAbr || "-";
    document.getElementById("compNovoData").textContent = novo.data || "-";
    document.getElementById("compNovoEspecialidade").textContent = novo.especialidade || "-";
    document.getElementById("compNovoMedico").textContent = formatarMedico(novo.medico) || "-";

    document.getElementById("modalDuplicidade")?.classList.remove("oculto");
}

function fecharModalDuplicidade() {
    document.getElementById("modalDuplicidade")?.classList.add("oculto");
    pacienteExistenteModal = null;
    pacienteNovoModal = null;
}

function abrirModalExcluir(dados) {
    pacienteExcluirModal = dados;

    document.getElementById("excluirNomePaciente").textContent = dados.paciente || "-";
    document.getElementById("excluirOMPaciente").textContent = dados.omAbr || "-";
    document.getElementById("excluirDataPaciente").textContent = dados.data || "-";

    document.getElementById("modalExcluir")?.classList.remove("oculto");
}

function fecharModalExcluir() {
    document.getElementById("modalExcluir")?.classList.add("oculto");
    pacienteExcluirModal = null;
}

// 7. SALVAMENTO DE DADOS NA PASTA LOCAL
/**
 * Cria (ou reutiliza) uma subpasta para o paciente e grava dentro dela
 * o "dados.json" e os PDFs originais anexados nesta sessão.
 * @param {string} sufixoPasta - texto extra no nome da pasta, usado para não colidir ao "Salvar Ambos".
 */
async function executarSalvamentoBanco(dados, sufixoPasta = "") {
    try {
        // Remove caracteres proibidos em nomes de pasta/arquivo do sistema operacional.
        const pacienteLimpo = dados.paciente.replace(/[\/\\:*?"<>|]/g, "_");
        let nomePasta = `${pacienteLimpo} - ${dados.omAbr} - ${dados.dataNomeArquivo}`;

        if (sufixoPasta) {
            nomePasta += ` ${sufixoPasta}`;
        }

        const pastaHandle = await dirHandleBanco.getDirectoryHandle(nomePasta, { create: true });

        const fileJson = await pastaHandle.getFileHandle("dados.json", { create: true });
        const writerJson = await fileJson.createWritable();
        await writerJson.write(JSON.stringify(dados, null, 4));
        await writerJson.close();

        if (arquivoAgendamentoObj) {
            const f = await pastaHandle.getFileHandle(`Marcação - ${pacienteLimpo}.pdf`, { create: true });
            const w = await f.createWritable();
            await w.write(arquivoAgendamentoObj);
            await w.close();
        }
        if (arquivoSolicitacaoObj) {
            const f = await pastaHandle.getFileHandle(`Solicitação - ${pacienteLimpo}.pdf`, { create: true });
            const w = await f.createWritable();
            await w.write(arquivoSolicitacaoObj);
            await w.close();
        }

        mostrarToast("Dados salvos no banco com sucesso!", "sucesso");
        await atualizarListaPacientesBanco();   // recarrega a lista para incluir o registro recém-salvo
        return true;
    } catch (e) {
        console.error(e);
        mostrarToast("Erro ao salvar. Verifique as permissões da pasta.", "erro");
        return false;
    }
}

// 8. DISPARADORES DOS BOTÕES PRINCIPAIS

document.getElementById("btnInserirBanco")?.addEventListener("click", async () => {
    if (!dirHandleBanco) {
        mostrarToast("Primeiro clique em 'CONECTAR PASTA DO BANCO'.", "aviso");
        return;
    }

    const dadosNovos = dadosBancoCarregados || extrairDadosCompletos(textoPDF, textoPDFSolicitacao);

    if (!dadosNovos || !dadosNovos.paciente) {
        mostrarToast("Anexe os PDFs antes de salvar.", "aviso");
        return;
    }

    const existente = buscarPacienteExistentePorNome(dadosNovos.paciente);

    if (existente) {
        // Já existe alguém com esse nome: pede confirmação em vez de sobrescrever direto.
        abrirModalDuplicidade(existente, dadosNovos);
    } else {
        await executarSalvamentoBanco(dadosNovos);
    }
});

document.getElementById("btnExcluirBanco")?.addEventListener("click", () => {
    if (!dirHandleBanco) {
        mostrarToast("Conecte a pasta do banco de dados primeiro.", "aviso");
        return;
    }

    if (!dadosBancoCarregados || !dadosBancoCarregados._nomePasta) {
        mostrarToast("Selecione um paciente salvo na barra de pesquisa para excluir.", "aviso");
        return;
    }

    abrirModalExcluir(dadosBancoCarregados);
});

// 9. DELEGAÇÃO DE EVENTOS GLOBAL PARA OS BOTÕES DOS MODAIS
// Em vez de um listener por botão, um único listener no "document"
// identifica qual botão foi clicado pelo seu id (delegação de eventos).
document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    // Modal Duplicidade - Cancelar
    if (btn.id === "btnModalCancelar") {
        fecharModalDuplicidade();
    }

    // Modal Duplicidade - Substituir (apaga o registro antigo e grava o novo no lugar)
    else if (btn.id === "btnModalSubstituir") {
        if (!pacienteExistenteModal || !pacienteNovoModal) return;

        try {
            if (pacienteExistenteModal._nomePasta) {
                await dirHandleBanco.removeEntry(pacienteExistenteModal._nomePasta, { recursive: true });
            }

            const dadosParaSalvar = pacienteNovoModal;
            fecharModalDuplicidade();
            await executarSalvamentoBanco(dadosParaSalvar);
            mostrarToast("Registro antigo substituído com sucesso!", "sucesso");
        } catch (erro) {
            console.error("Erro ao substituir paciente:", erro);
            mostrarToast("Erro ao excluir o paciente antigo para substituição.", "erro");
        }
    }

    // Modal Duplicidade - Salvar Ambos (mantém o antigo e cria uma pasta nova com sufixo "(Cópia NNNN)")
    else if (btn.id === "btnModalSalvarAmbos") {
        if (!pacienteNovoModal) return;

        const dadosParaSalvar = pacienteNovoModal;
        fecharModalDuplicidade();

        const idUnico = new Date().getTime().toString().slice(-4);
        await executarSalvamentoBanco(dadosParaSalvar, `(Cópia ${idUnico})`);
    }

    // Modal Excluir - Cancelar
    else if (btn.id === "btnModalCancelarExclusao") {
        fecharModalExcluir();
    }

    // Modal Excluir - Confirmar Exclusão
    else if (btn.id === "btnModalConfirmarExclusao") {
        if (!pacienteExcluirModal || !pacienteExcluirModal._nomePasta) return;

        try {
            await dirHandleBanco.removeEntry(pacienteExcluirModal._nomePasta, { recursive: true });

            fecharModalExcluir();
            mostrarToast("Registro excluído com sucesso!", "sucesso");

            dadosBancoCarregados = null;

            const inputPesquisa = document.getElementById("inputPesquisaBanco");
            if (inputPesquisa) inputPesquisa.value = "";

            await atualizarListaPacientesBanco();
            atualizarPainelLME();

        } catch (erro) {
            console.error("Erro ao excluir pasta:", erro);
            mostrarToast("Erro ao excluir o registro do computador.", "erro");
        }
    }
});
