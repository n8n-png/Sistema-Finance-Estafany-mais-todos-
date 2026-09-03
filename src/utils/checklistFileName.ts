// Nomenclatura padronizada dos arquivos exportados dos documentos.
// Padrão default: "0. Check-list - FIDC MAIS TODOS - [nome]"
export const checklistFileName = (
  razaoSocial?: string | null,
  ext: "pdf" | "docx" = "pdf",
  prefixo = "0. Check-list - FIDC MAIS TODOS",
) => {
  const clean = (v: string) => v.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ");
  const nome = clean(razaoSocial || "");
  const base = `${clean(prefixo)}${nome ? ` - ${nome}` : ""}`;
  return `${base}.${ext}`;
};

