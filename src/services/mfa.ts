/**
 * Verificação em duas etapas — Story 2.3.
 *
 * Contexto da decisão (04/09): o time da Valora usa Outlook, não Google, então o
 * login pelo Google não serve para eles. A área escolheu a opção B — conta
 * criada por nós com segundo fator obrigatório — para não segurar a publicação
 * esperando o TI de outra empresa configurar o SSO.
 *
 * O método é **TOTP** (aplicativo autenticador: Google Authenticator, Microsoft
 * Authenticator, 1Password, Authy). Escolha técnica, e vale registrar o porquê:
 *
 * - **SMS** tem custo por mensagem e é vulnerável a troca de chip, que é ataque
 *   comum contra contas com valor financeiro.
 * - **E-mail** protege pouco: se a caixa de entrada for comprometida, o segundo
 *   fator cai junto com o primeiro — e a redefinição de senha também chega lá.
 * - **TOTP** funciona offline, não tem custo e o segredo nunca sai do aparelho.
 *
 * Se a área preferir outro método, a troca é localizada: só esta camada muda.
 */

import { supabase } from "@/integrations/supabase/client";

export type NivelAutenticacao = "aal1" | "aal2";

export interface EstadoMfa {
  /** O usuário já cadastrou um segundo fator? */
  temFator: boolean;
  /** A sessão atual já passou pelo segundo fator? */
  verificado: boolean;
  /** Precisa digitar o código agora para continuar. */
  precisaVerificar: boolean;
  factorId: string | null;
}

/**
 * Situação do segundo fator na sessão atual.
 *
 * `nextLevel` é o nível que a conta exige; `currentLevel` é o que a sessão tem.
 * Quando o exigido é `aal2` e o atual é `aal1`, existe fator cadastrado e ele
 * ainda não foi apresentado nesta sessão.
 */
export const estadoMfa = async (): Promise<EstadoMfa> => {
  const { data: niveis, error: erroNiveis } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (erroNiveis) {
    console.warn("[mfa] não foi possível verificar o nível de autenticação", erroNiveis);
    return { temFator: false, verificado: false, precisaVerificar: false, factorId: null };
  }

  const { data: fatores } = await supabase.auth.mfa.listFactors();
  const totp = fatores?.totp?.find((f) => f.status === "verified") ?? null;

  return {
    temFator: !!totp,
    verificado: niveis?.currentLevel === "aal2",
    precisaVerificar: niveis?.nextLevel === "aal2" && niveis?.currentLevel === "aal1",
    factorId: totp?.id ?? null,
  };
};

export interface FatorCadastrado {
  factorId: string;
  /** Imagem do QR Code, para ler no aplicativo autenticador. */
  qrCode: string;
  /** Chave em texto, para quem não consegue ler o QR. */
  segredo: string;
}

/**
 * Inicia o cadastro do segundo fator.
 *
 * O fator só passa a valer depois de confirmado em `confirmarCadastro` — isso
 * evita trancar a conta de alguém que gerou o QR e não chegou a configurar o
 * aplicativo.
 */
export const iniciarCadastro = async (nomeAmigavel = "Painel de Crédito PJ"): Promise<FatorCadastrado> => {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `${nomeAmigavel} — ${new Date().toLocaleDateString("pt-BR")}`,
  });
  if (error) throw error;
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    segredo: data.totp.secret,
  };
};

/** Confirma o cadastro com o primeiro código gerado pelo aplicativo. */
export const confirmarCadastro = async (factorId: string, codigo: string): Promise<void> => {
  const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({ factorId });
  if (erroDesafio) throw erroDesafio;

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: desafio.id,
    code: codigo.replace(/\D/g, ""),
  });
  if (error) throw error;
};

/** Verifica o código no login. */
export const verificarCodigo = async (factorId: string, codigo: string): Promise<void> => {
  const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({ factorId });
  if (erroDesafio) throw erroDesafio;

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: desafio.id,
    code: codigo.replace(/\D/g, ""),
  });
  if (error) throw error;
};

/**
 * Remove o segundo fator.
 *
 * Operação sensível: quem perde o aparelho precisa disso, mas é também o caminho
 * de quem tomou a conta. Fica registrado no histórico de autenticação do
 * Supabase e deve exigir confirmação de um administrador — a interface não
 * oferece isso para o próprio usuário.
 */
export const removerFator = async (factorId: string): Promise<void> => {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
};

/**
 * Login pelo Google — para o time interno da MaisTODOS.
 *
 * A restrição ao domínio `@maistodos.com.br` **não** é feita aqui: parâmetro de
 * cliente é sugestão, não garantia, e pode ser alterado por quem controla o
 * navegador. A imposição real fica no servidor (Auth Hook do Supabase), e o
 * `hd` abaixo serve apenas para o Google já mostrar a conta certa.
 */
export const entrarComGoogle = async (redirecionarPara = `${window.location.origin}/`) => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirecionarPara,
      queryParams: { hd: "maistodos.com.br", prompt: "select_account" },
    },
  });
  if (error) throw error;
};
