/**
 * Documentos da operação — Stories 3.4 e 3.9.
 *
 * O painel passou a ser o armazenador (decisão de 04/09). O SharePoint continua
 * existindo com o histórico antigo, sem integração: é coexistência, não sincronia.
 *
 * Cada item de checklist aceita **vários** documentos (Story 3.9): uma operação
 * com 3 representantes legais tem 3 identificações no mesmo item, cada uma com
 * sua descrição.
 *
 * O caminho do arquivo segue sempre `{operacao_id}/{arquivo}`. Essa convenção não
 * é organização — é o que faz a permissão do arquivo herdar automaticamente a
 * matriz de acesso por etapa da operação (ver a policy em
 * `20260906120000_storage_documentos.sql`). Alterar o formato do caminho quebra
 * o controle de acesso.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbFunil } from "@/integrations/supabase/funil";

export const BUCKET_DOCUMENTOS = "operacoes-documentos";

/** 50 MB — mesmo limite declarado no bucket. */
export const TAMANHO_MAXIMO = 52_428_800;

export const TIPOS_ACEITOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
] as const;

export interface Anexo {
  id: string;
  descricao: string | null;
  nomeArquivo: string;
  path: string;
  tamanho: number | null;
  tipo: string | null;
  enviadoEm: string;
}

/**
 * Normaliza o nome do arquivo para uso no Storage.
 *
 * Três problemas resolvidos aqui:
 *
 * 1. **Acento e espaço** atrapalham na geração e no consumo da URL assinada.
 * 2. **Colisão**: o prefixo de tempo e o sufixo aleatório garantem caminho único
 *    mesmo quando a mesma pessoa envia dois arquivos de mesmo nome — que é o
 *    caso das "3 outorgas" saídas do mesmo scanner, todas `documento.pdf`.
 *    Sem isso, uma sobrescreveria a outra em silêncio.
 * 3. **Ponto no meio do nome**: a extensão é separada antes da limpeza e todo o
 *    resto perde os pontos. Isso elimina `..` no nome (que não chega a ser
 *    travessia de diretório, já que as barras viram hífen, mas é fraqueza sem
 *    motivo) e torna visível a extensão dupla: `boleto.pdf.exe` vira
 *    `boleto-pdf.exe`, e o que é executável parece executável.
 */
export const nomeSeguro = (nomeOriginal: string): string => {
  const extensao = nomeOriginal.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0] ?? "";
  const base = nomeOriginal
    .slice(0, nomeOriginal.length - extensao.length)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-100);
  const aleatorio = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${aleatorio}-${base || "documento"}${extensao}`;
};

const validar = (arquivo: File) => {
  if (arquivo.size > TAMANHO_MAXIMO) {
    throw new Error(
      `Arquivo muito grande (${(arquivo.size / 1_048_576).toFixed(1)} MB). O limite é 50 MB.`,
    );
  }
  if (arquivo.type && !TIPOS_ACEITOS.includes(arquivo.type as (typeof TIPOS_ACEITOS)[number])) {
    throw new Error("Tipo de arquivo não aceito. Envie PDF, imagem, Word ou Excel.");
  }
};

/** Lista os anexos de uma operação, agrupados por item de checklist. */
export const listarAnexos = async (operacaoId: string): Promise<Map<string, Anexo[]>> => {
  const { data, error } = await dbFunil
    .from("operacoes_formalizacao_anexos")
    .select("*")
    .eq("operacao_id", operacaoId)
    .order("enviado_em", { ascending: true });

  if (error) throw error;

  const porItem = new Map<string, Anexo[]>();
  for (const linha of data ?? []) {
    const anexo: Anexo = {
      id: linha.id,
      descricao: linha.descricao,
      nomeArquivo: linha.nome_arquivo,
      path: linha.path,
      tamanho: linha.tamanho,
      tipo: linha.tipo,
      enviadoEm: linha.enviado_em,
    };
    const lista = porItem.get(linha.item_checklist_id);
    if (lista) lista.push(anexo);
    else porItem.set(linha.item_checklist_id, [anexo]);
  }
  return porItem;
};

/**
 * Envia um documento e vincula ao item de checklist.
 *
 * A `descricao` é o que permite distinguir três arquivos no mesmo item — sem
 * ela, "3 outorgas" viram três linhas indistinguíveis.
 */
export const anexarDocumento = async (
  operacaoId: string,
  itemChecklistId: string,
  arquivo: File,
  descricao?: string,
): Promise<Anexo> => {
  validar(arquivo);

  const path = `${operacaoId}/${nomeSeguro(arquivo.name)}`;

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(path, arquivo, {
      contentType: arquivo.type || "application/octet-stream",
      upsert: false,
    });

  if (erroUpload) throw erroUpload;

  const { data: sessao } = await supabase.auth.getUser();

  // O registro é criado depois do envio: se o upload falhar, não fica linha
  // apontando para arquivo inexistente.
  const { data, error: erroRegistro } = await dbFunil
    .from("operacoes_formalizacao_anexos")
    .insert({
      operacao_id: operacaoId,
      item_checklist_id: itemChecklistId,
      descricao: descricao?.trim() || null,
      nome_arquivo: arquivo.name,
      path,
      tamanho: arquivo.size,
      tipo: arquivo.type || null,
      enviado_por: sessao.user?.id ?? null,
    })
    .select("*")
    .single();

  if (erroRegistro) {
    // Registro falhou: remove o arquivo para não deixar órfão ocupando espaço
    // sem nenhuma referência que permita encontrá-lo depois.
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove([path]);
    throw erroRegistro;
  }

  return {
    id: data.id,
    descricao: data.descricao,
    nomeArquivo: data.nome_arquivo,
    path: data.path,
    tamanho: data.tamanho,
    tipo: data.tipo,
    enviadoEm: data.enviado_em,
  };
};

/**
 * Gera uma URL temporária para abrir o documento.
 *
 * O bucket é privado, então não existe URL permanente — e é assim que deve ser:
 * link permanente de documento de crédito é link que vaza. A URL expira em uma
 * hora, tempo de sobra para abrir ou baixar.
 */
export const urlDocumento = async (path: string, segundos = 3600): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(path, segundos);
  if (error) throw error;
  return data.signedUrl;
};

/** Corrige a descrição de um anexo já enviado. */
export const renomearAnexo = async (anexoId: string, descricao: string): Promise<void> => {
  const { error } = await dbFunil
    .from("operacoes_formalizacao_anexos")
    .update({ descricao: descricao.trim() || null })
    .eq("id", anexoId);
  if (error) throw error;
};

/**
 * Remove um anexo.
 *
 * A ordem importa: o registro sai primeiro. Se a remoção do arquivo falhar,
 * sobra um arquivo órfão no Storage — desperdício de espaço, mas inofensivo. Na
 * ordem inversa, uma falha deixaria o checklist apontando para um arquivo que
 * não existe mais, e aí a operação parece documentada quando não está.
 */
export const removerAnexo = async (anexoId: string, path: string): Promise<void> => {
  const { error } = await dbFunil
    .from("operacoes_formalizacao_anexos")
    .delete()
    .eq("id", anexoId);
  if (error) throw error;

  const { error: erroArquivo } = await supabase.storage.from(BUCKET_DOCUMENTOS).remove([path]);
  if (erroArquivo) {
    console.warn("[documentos] registro removido, arquivo permaneceu no storage", erroArquivo);
  }
};

/** Formata o tamanho para exibição. */
export const formatarTamanho = (bytes: number | null): string => {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
};

/**
 * Baixa todos os documentos da operação num único .zip.
 *
 * O zip é montado **no navegador**, não no servidor: os arquivos já vêm de URLs
 * assinadas que o usuário tem permissão de acessar, então não há razão para
 * fazer o dado passar por uma função de servidor só para ser reempacotado.
 *
 * Cada arquivo entra com o nome que a pessoa deu ("Outorga da Maria.pdf"), e não
 * com o nome técnico do Storage — quem recebe o pacote precisa entender o que
 * está abrindo.
 */
export const baixarTudoZip = async (
  nomeOperacao: string,
  anexos: { descricao: string | null; nomeArquivo: string; path: string }[],
): Promise<void> => {
  if (anexos.length === 0) {
    throw new Error("Não há documentos anexados nesta operação.");
  }

  // Import dinâmico: a biblioteca de zip só é baixada por quem clica no botão,
  // e não entra no carregamento inicial do painel.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const usados = new Set<string>();

  for (const anexo of anexos) {
    const url = await urlDocumento(anexo.path, 300);
    const resposta = await fetch(url);
    if (!resposta.ok) {
      throw new Error(`Falha ao baixar "${anexo.descricao ?? anexo.nomeArquivo}".`);
    }

    const extensao = anexo.nomeArquivo.match(/\.[^.]+$/)?.[0] ?? "";
    const base = (anexo.descricao ?? anexo.nomeArquivo.replace(/\.[^.]+$/, ""))
      .replace(/[/\:*?"<>|]/g, "-")
      .slice(0, 120);

    // Dois documentos com a mesma descrição sobrescreveriam um ao outro dentro
    // do zip — silenciosamente, e o pacote sairia incompleto.
    let nome = `${base}${extensao}`;
    let n = 2;
    while (usados.has(nome)) {
      nome = `${base} (${n})${extensao}`;
      n++;
    }
    usados.add(nome);

    zip.file(nome, await resposta.blob());
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `documentos-${nomeOperacao.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 60)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

/**
 * Envia o comprovante de pagamento do desembolso.
 *
 * Vai para a mesma pasta da operação, sob o prefixo `comprovante-`, porque a
 * permissão do arquivo é definida pelo primeiro segmento do caminho — o
 * comprovante precisa seguir exatamente as mesmas regras de acesso do resto da
 * documentação da operação.
 *
 * Não entra na tabela de anexos: comprovante não é item de checklist, é prova de
 * que o dinheiro saiu. Fica no campo próprio da operação.
 */
export const anexarComprovanteDesembolso = async (
  operacaoId: string,
  arquivo: File,
): Promise<{ path: string; nome: string }> => {
  validar(arquivo);

  const path = `${operacaoId}/comprovante-${nomeSeguro(arquivo.name)}`;

  const { error } = await supabase.storage.from(BUCKET_DOCUMENTOS).upload(path, arquivo, {
    contentType: arquivo.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;

  return { path, nome: arquivo.name };
};
