/**
 * Documentos da operação — Story 3.4.
 *
 * O painel passou a ser o armazenador (decisão de 04/09). O SharePoint continua
 * existindo com o histórico antigo, sem integração: é coexistência, não sincronia.
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

/**
 * Normaliza o nome do arquivo.
 *
 * Acento e espaço em nome de objeto do Storage causam problema na hora de gerar
 * e consumir a URL. O prefixo de tempo evita que dois envios do mesmo documento
 * se sobrescrevam silenciosamente — no lugar disso, ficam os dois e a área
 * decide qual vale.
 */
export const nomeSeguro = (nomeOriginal: string): string => {
  const limpo = nomeOriginal
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
  return `${Date.now()}-${limpo}`;
};

export interface ResultadoUpload {
  path: string;
  nome: string;
  tamanho: number;
  tipo: string;
}

const validar = (arquivo: File) => {
  if (arquivo.size > TAMANHO_MAXIMO) {
    throw new Error(
      `Arquivo muito grande (${(arquivo.size / 1_048_576).toFixed(1)} MB). O limite é 50 MB.`,
    );
  }
  if (arquivo.type && !TIPOS_ACEITOS.includes(arquivo.type as (typeof TIPOS_ACEITOS)[number])) {
    throw new Error(
      "Tipo de arquivo não aceito. Envie PDF, imagem, Word ou Excel.",
    );
  }
};

/** Envia um documento e vincula ao item de checklist. */
export const anexarDocumento = async (
  operacaoId: string,
  itemChecklistId: string,
  arquivo: File,
): Promise<ResultadoUpload> => {
  validar(arquivo);

  const nome = nomeSeguro(arquivo.name);
  const path = `${operacaoId}/${nome}`;

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(path, arquivo, {
      contentType: arquivo.type || "application/octet-stream",
      upsert: false,
    });

  if (erroUpload) throw erroUpload;

  const { data: sessao } = await supabase.auth.getUser();

  // O item de checklist é atualizado depois do envio, e não antes: se o upload
  // falhar, o checklist não fica apontando para um arquivo que não existe.
  const { error: erroVinculo } = await dbFunil
    .from("operacoes_formalizacao_checklist")
    .update({
      anexo_nome: arquivo.name,
      anexo_path: path,
      anexo_tamanho: arquivo.size,
      anexo_tipo: arquivo.type || null,
      anexo_enviado_em: new Date().toISOString(),
      anexo_enviado_por: sessao.user?.id ?? null,
      checked: true,
    })
    .eq("id", itemChecklistId);

  if (erroVinculo) {
    // Vínculo falhou: remove o arquivo para não deixar órfão ocupando espaço
    // sem nenhuma referência que permita encontrá-lo depois.
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove([path]);
    throw erroVinculo;
  }

  return { path, nome: arquivo.name, tamanho: arquivo.size, tipo: arquivo.type };
};

/**
 * Gera uma URL temporária para download.
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

/** Remove o anexo de um item de checklist. Só administradores conseguem. */
export const removerDocumento = async (path: string, itemChecklistId: string): Promise<void> => {
  const { error } = await supabase.storage.from(BUCKET_DOCUMENTOS).remove([path]);
  if (error) throw error;

  const { error: erroVinculo } = await dbFunil
    .from("operacoes_formalizacao_checklist")
    .update({
      anexo_nome: null,
      anexo_path: null,
      anexo_tamanho: null,
      anexo_tipo: null,
      anexo_enviado_em: null,
      anexo_enviado_por: null,
      checked: false,
    })
    .eq("id", itemChecklistId);

  if (erroVinculo) throw erroVinculo;
};

/** Lista os arquivos de uma operação, direto do Storage. */
export const listarDocumentos = async (operacaoId: string) => {
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .list(operacaoId, { sortBy: { column: "created_at", order: "desc" } });
  if (error) throw error;
  return data ?? [];
};
