import { describe, expect, it } from "vitest";
import { formatarTamanho, nomeSeguro, TAMANHO_MAXIMO, TIPOS_ACEITOS } from "./documentos";

describe("nome de arquivo no Storage", () => {
  /**
   * O caso real: três outorgas saídas do mesmo scanner, todas chamadas
   * `documento.pdf`. Sem unicidade, uma sobrescreve a outra em silêncio — e a
   * operação fica com dois documentos onde deveria ter três.
   */
  it("gera nomes diferentes para arquivos de mesmo nome", () => {
    const nomes = new Set(Array.from({ length: 50 }, () => nomeSeguro("documento.pdf")));
    expect(nomes.size).toBe(50);
  });

  it("remove acento e caractere especial", () => {
    const nome = nomeSeguro("Certidão de Casamento (cópia).pdf");
    expect(nome).not.toMatch(/[çãõáéíóú()]/i);
    expect(nome).toMatch(/\.pdf$/);
  });

  it("preserva a extensão", () => {
    expect(nomeSeguro("contrato.PDF")).toMatch(/\.PDF$/);
    expect(nomeSeguro("planilha.xlsx")).toMatch(/\.xlsx$/);
  });

  it("limita o comprimento", () => {
    const gigante = `${"a".repeat(500)}.pdf`;
    expect(nomeSeguro(gigante).length).toBeLessThan(160);
  });

  it("não gera caminho que escape da pasta da operação", () => {
    // O primeiro segmento do caminho é o que define a permissão do arquivo —
    // barra no nome quebraria essa garantia.
    const nome = nomeSeguro("../../../etc/passwd");
    expect(nome).not.toContain("/");
    expect(nome).not.toContain("..");
  });

  it("torna visível a extensão dupla", () => {
    // "boleto.pdf.exe" não pode se passar por PDF na listagem.
    expect(nomeSeguro("boleto.pdf.exe")).toMatch(/boleto-pdf\.exe$/);
  });

  it("não produz nome vazio", () => {
    expect(nomeSeguro("...")).toMatch(/documento/);
    expect(nomeSeguro("")).toMatch(/documento/);
  });
});

describe("formatação de tamanho", () => {
  it.each([
    [null, ""],
    [512, "512 B"],
    [2048, "2 KB"],
    [1_572_864, "1.5 MB"],
  ])("%s vira %s", (bytes, esperado) => {
    expect(formatarTamanho(bytes as number | null)).toBe(esperado);
  });
});

describe("limites de upload", () => {
  it("o limite bate com o declarado no bucket", () => {
    // 50 MB. Se divergir do valor em 20260906120000_storage_documentos.sql, o
    // usuário recebe erro do servidor em vez da mensagem amigável do cliente.
    expect(TAMANHO_MAXIMO).toBe(52_428_800);
  });

  it("aceita os formatos que a área usa", () => {
    expect(TIPOS_ACEITOS).toContain("application/pdf");
    expect(TIPOS_ACEITOS).toContain("image/jpeg");
    expect(TIPOS_ACEITOS).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("não aceita executável", () => {
    expect(TIPOS_ACEITOS).not.toContain("application/x-msdownload");
    expect(TIPOS_ACEITOS).not.toContain("application/x-sh");
  });
});
