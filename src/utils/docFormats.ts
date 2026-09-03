// Máscaras e formatadores usados nos formulários da Central de Documentos.
// Reproduz o comportamento do HTML original (outorga_uxoria_5.html).

const PARTICULAS = ["da", "de", "do", "das", "dos", "e"];

export const nomeProprio = (str: string) =>
  str
    .toLowerCase()
    .split(" ")
    .map((palavra, i) => {
      if (!palavra) return palavra;
      if (i > 0 && PARTICULAS.indexOf(palavra) !== -1) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(" ");

export const mascaraCPF = (str: string) => {
  const dig = str.replace(/\D/g, "").slice(0, 11);
  if (dig.length > 9) return `${dig.slice(0, 3)}.${dig.slice(3, 6)}.${dig.slice(6, 9)}-${dig.slice(9)}`;
  if (dig.length > 6) return `${dig.slice(0, 3)}.${dig.slice(3, 6)}.${dig.slice(6)}`;
  if (dig.length > 3) return `${dig.slice(0, 3)}.${dig.slice(3)}`;
  return dig;
};

export const mascaraRG = (str: string) => {
  const raw = str.toUpperCase().replace(/[^0-9X]/g, "").slice(0, 10);
  if (raw.length > 8) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}-${raw.slice(8)}`;
  if (raw.length > 5) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
  if (raw.length > 2) return `${raw.slice(0, 2)}.${raw.slice(2)}`;
  return raw;
};

export const mascaraCNPJ = (str: string) => {
  const dig = str.replace(/\D/g, "").slice(0, 14);
  if (dig.length > 12)
    return `${dig.slice(0, 2)}.${dig.slice(2, 5)}.${dig.slice(5, 8)}/${dig.slice(8, 12)}-${dig.slice(12)}`;
  if (dig.length > 8) return `${dig.slice(0, 2)}.${dig.slice(2, 5)}.${dig.slice(5, 8)}/${dig.slice(8)}`;
  if (dig.length > 5) return `${dig.slice(0, 2)}.${dig.slice(2, 5)}.${dig.slice(5)}`;
  if (dig.length > 2) return `${dig.slice(0, 2)}.${dig.slice(2)}`;
  return dig;
};

export const mascaraMoeda = (str: string) => {
  const dig = str.replace(/\D/g, "").slice(0, 15);
  if (!dig) return "";
  const num = parseInt(dig, 10);
  const cents = (num % 100).toString().padStart(2, "0");
  const int = Math.floor(num / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${int},${cents}`;
};

export const mascaraTaxa = (str: string) => {
  let s = str.replace(/\./g, ",").replace(/[^0-9,]/g, "");
  const i = s.indexOf(",");
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, "");
  return s.slice(0, 6);
};

export const mascaraMeses = (str: string) => str.replace(/\D/g, "").slice(0, 3);

const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
export const dataPorExtenso = (d = new Date()) =>
  `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`;

export interface Pessoa {
  nome: string;
  cpf: string;
  email: string;
  regime?: string;
}

export const pessoaEmpty = (comRegime = false): Pessoa =>
  comRegime ? { nome: "", cpf: "", email: "", regime: "" } : { nome: "", cpf: "", email: "" };
