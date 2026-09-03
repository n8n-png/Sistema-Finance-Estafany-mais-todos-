import { z } from "zod";

/**
 * Política de senha do painel — Story 2.4.
 *
 * O protótipo exigia apenas 6 caracteres. Para um sistema exposto na internet,
 * com dado de crédito e acesso de usuário externo (time do fundo), isso é fraco
 * demais: 6 caracteres sem exigência de composição caem em ataque de dicionário.
 *
 * O limite superior de 72 não é escolha nossa — é o tamanho máximo que o bcrypt
 * considera; o que passa disso é silenciosamente ignorado.
 */
export const SENHA_MINIMA = 10;

export const passwordSchema = z
  .string()
  .min(SENHA_MINIMA, `A senha precisa ter no mínimo ${SENHA_MINIMA} caracteres`)
  .max(72, "A senha pode ter no máximo 72 caracteres")
  .regex(/[a-z]/, "Inclua ao menos uma letra minúscula")
  .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula")
  .regex(/[0-9]/, "Inclua ao menos um número");

/** Texto de apoio exibido junto aos campos de senha. */
export const REQUISITOS_SENHA =
  `Mínimo de ${SENHA_MINIMA} caracteres, com letra maiúscula, minúscula e número.`;

/**
 * Valida a nova senha e a confirmação.
 * Retorna a mensagem do primeiro problema encontrado, ou `null` se estiver tudo certo.
 */
export const validarNovaSenha = (senha: string, confirmacao: string): string | null => {
  const resultado = passwordSchema.safeParse(senha);
  if (!resultado.success) return resultado.error.issues[0].message;
  if (senha !== confirmacao) return "As senhas não coincidem";
  return null;
};
