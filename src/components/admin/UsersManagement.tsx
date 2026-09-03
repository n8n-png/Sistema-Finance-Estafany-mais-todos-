import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield, ShieldOff, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PAGE_KEYS } from "@/hooks/usePageAccess";

interface ManagedUser {
  id: string;
  email: string;
  role: "admin" | "user" | "moderator";
  banned_until: string | null;
  last_sign_in_at: string | null;
}

const isActive = (u: ManagedUser) => {
  if (!u.banned_until) return true;
  return new Date(u.banned_until).getTime() < Date.now();
};

export const UsersManagement = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAccess, setBusyAccess] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "list" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as { users: ManagedUser[] }).users;
    },
  });

  const accessQuery = useQuery({
    queryKey: ["all-page-access"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_page_access").select("user_id, page_key");
      if (error) throw error;
      const map = new Map<string, Set<string>>();
      (data ?? []).forEach((r) => {
        if (!map.has(r.user_id)) map.set(r.user_id, new Set());
        map.get(r.user_id)!.add(r.page_key);
      });
      return map;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const toggleAccess = async (userId: string, pageKey: string, next: boolean) => {
    setBusyAccess(`${userId}:${pageKey}`);
    try {
      if (next) {
        const { error } = await supabase
          .from("user_page_access")
          .insert({ user_id: userId, page_key: pageKey, granted_by: currentUser?.id ?? null });
        if (error) throw error;
      } else {
        // Ao remover um item pai, as sub-permissões dependentes saem junto.
        const filhos = PAGE_KEYS.filter(
          (p) => "parent" in p && (p as { parent?: string }).parent === pageKey
        ).map((p) => p.key);
        const { error } = await supabase
          .from("user_page_access")
          .delete()
          .eq("user_id", userId)
          .in("page_key", [pageKey, ...filhos]);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["all-page-access"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBusyAccess(null);
    }
  };

  const setAllAccess = async (userId: string, next: boolean) => {
    const granted = accessQuery.data?.get(userId) ?? new Set<string>();
    setBusyAccess(`${userId}:*`);
    try {
      if (next) {
        const missing = PAGE_KEYS.filter((p) => !granted.has(p.key));
        if (missing.length) {
          const { error } = await supabase.from("user_page_access").insert(
            missing.map((p) => ({
              user_id: userId,
              page_key: p.key,
              granted_by: currentUser?.id ?? null,
            }))
          );
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("user_page_access").delete().eq("user_id", userId);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["all-page-access"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBusyAccess(null);
    }
  };

  const updateRole = async (user_id: string, role: string) => {
    setBusyId(user_id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "update_role", user_id, role },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Permissão atualizada" });
      refresh();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (user_id: string, active: boolean) => {
    setBusyId(user_id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "set_active", user_id, active },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: active ? "Usuário ativado" : "Usuário desativado" });
      refresh();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="p-6 border-2 border-secondary">
      <h2 className="text-xl font-semibold text-primary mb-2 flex items-center gap-2 font-display">
        <Users size={20} /> Usuários cadastrados
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Gerencie permissões, acesso por aba e desative acessos quando necessário.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {data && (
        <div className="overflow-auto border border-border rounded">
          <table className="w-full text-sm" style={{ fontFamily: "Arial, sans-serif" }}>
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Permissão</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Abas</th>
                <th className="p-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => {
                const active = isActive(u);
                const isSelf = u.id === currentUser?.id;
                const busy = busyId === u.id;
                const admin = u.role === "admin";
                const granted = accessQuery.data?.get(u.id) ?? new Set<string>();
                const count = admin ? PAGE_KEYS.length : granted.size;
                return (
                  <tr key={u.id} className="border-t">
                    <td className="p-2 break-all">{u.email}</td>
                    <td className="p-2">
                      <select
                        value={u.role}
                        disabled={busy || isSelf}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="user">Usuário</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          active
                            ? "bg-secondary/30 text-foreground"
                            : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {active ? "Ativo" : "Desativado"}
                      </span>
                    </td>
                    <td className="p-2">
                      <Badge variant={count > 0 ? "default" : "outline"}>
                        {count}/{PAGE_KEYS.length} abas
                      </Badge>
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="mr-2">
                            <ShieldCheck size={14} className="mr-1" /> Permissões
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-80 max-h-[70vh] overflow-auto">
                          <p className="text-sm font-medium mb-1 break-all">{u.email}</p>
                          {admin ? (
                            <p className="text-sm text-muted-foreground">
                              Administrador — acesso total a todas as abas.
                            </p>
                          ) : (
                            <>
                              <div className="flex gap-2 my-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busyAccess === `${u.id}:*`}
                                  onClick={() => setAllAccess(u.id, true)}
                                >
                                  Liberar todas
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busyAccess === `${u.id}:*`}
                                  onClick={() => setAllAccess(u.id, false)}
                                >
                                  Remover todas
                                </Button>
                              </div>
                              <div className="grid gap-2">
                                {PAGE_KEYS.map((p) => {
                                  const parent = (p as { parent?: string }).parent;
                                  const parentOff = !!parent && !granted.has(parent);
                                  return (
                                    <label
                                      key={p.key}
                                      className={`flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 cursor-pointer ${
                                        parent ? "ml-5 border-l-2 border-l-primary/40" : ""
                                      } ${parentOff ? "opacity-50" : ""}`}
                                    >
                                      <span className="text-sm text-foreground">
                                        {parent && (
                                          <span className="text-muted-foreground mr-1">—</span>
                                        )}
                                        {p.label}
                                      </span>
                                      <Switch
                                        checked={granted.has(p.key) && !parentOff}
                                        disabled={
                                          parentOff ||
                                          busyAccess === `${u.id}:${p.key}` ||
                                          busyAccess === `${u.id}:*`
                                        }
                                        onCheckedChange={(v) => toggleAccess(u.id, p.key, v)}
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </PopoverContent>
                      </Popover>
                      <Button
                        size="sm"
                        variant={active ? "outline" : "gradient"}
                        disabled={busy || isSelf}
                        onClick={() => toggleActive(u.id, !active)}
                      >
                        {active ? (
                          <>
                            <ShieldOff size={14} className="mr-1" /> Desativar
                          </>
                        ) : (
                          <>
                            <Shield size={14} className="mr-1" /> Ativar
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
