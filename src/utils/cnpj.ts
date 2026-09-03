// Normaliza CNPJ para 14 dígitos: remove máscara e completa zeros à esquerda.
export const normalizeCnpj = (v: string | number | null | undefined): string =>
  String(v ?? "")
    .replace(/\D/g, "")
    .padStart(14, "0");
