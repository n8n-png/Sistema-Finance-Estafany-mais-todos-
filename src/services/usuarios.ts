import { supabase } from "@/integrations/supabase/client";

export interface UsuarioCadastrado {
  id: string;
  email: string;
}

/**
 * Lista os usuários cadastrados em Admin > Usuários cadastrados.
 * Usa a mesma edge function do painel de administração.
 */
export const listarUsuariosCadastrados = async (): Promise<UsuarioCadastrado[]> => {
  const { data, error } = await supabase.functions.invoke("admin-manage-users", {
    body: { action: "list" },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return ((data as { users: { id: string; email: string }[] }).users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
  }));
};
