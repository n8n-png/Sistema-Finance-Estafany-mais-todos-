import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditHeader } from "@/components/CreditHeader";
import { useToast } from "@/hooks/use-toast";
import { Upload, LogOut, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { UsersManagement } from "@/components/admin/UsersManagement";
import { ChangePasswordButton } from "@/components/ChangePasswordButton";
import { AdminAtivosUpload } from "@/components/admin/AdminAtivosUpload";


const rowSchema = z.object({
  socios: z.string().nullable(),
  cnpj: z.string().min(1, "CNPJ obrigatório"),
  unidade: z.string().nullable(),
  grupo: z.string().nullable(),
  status_operacoes: z.string().nullable(),
  total_com_carencia: z.number(),
  total_sem_carencia: z.number(),
});

type Row = z.infer<typeof rowSchema>;

const COLUMN_MAP: Record<string, keyof Row | "cnpj_unidade"> = {
  "sócios": "socios",
  socios: "socios",
  cnpj: "cnpj",
  unidade: "unidade",
  "cnpj | unidade": "cnpj_unidade",
  "cnpj|unidade": "cnpj_unidade",
  "cnpj e unidade": "cnpj_unidade",
  grupo: "grupo",
  "status das operações": "status_operacoes",
  "status das operacoes": "status_operacoes",
  "total com carência": "total_com_carencia",
  "total com carencia": "total_com_carencia",
  "total sem carência": "total_sem_carencia",
  "total sem carencia": "total_sem_carencia",
};

const splitCnpjUnidade = (val: unknown): { cnpj: string; unidade: string | null } => {
  const raw = String(val ?? "").trim();
  if (!raw) return { cnpj: "", unidade: null };
  const idx = raw.indexOf(" - ");
  if (idx === -1) return { cnpj: raw, unidade: null };
  return { cnpj: raw.slice(0, idx).trim(), unidade: raw.slice(idx + 3).trim() || null };
};

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const AdminLimites = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [creatingUser, setCreatingUser] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newPassword.length < 6) {
      toast({ title: "Dados inválidos", description: "Email e senha (mín. 6) obrigatórios", variant: "destructive" });
      return;
    }
    setCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: newEmail, password: newPassword, role: newRole },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Usuário criado", description: `${newEmail} pode acessar agora.` });
      setNewEmail("");
      setNewPassword("");
      setNewRole("user");
    } catch (err: any) {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleFile = async (file: File) => {
    setErrors([]);
    setRows([]);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const parsed: Row[] = [];
      const errs: string[] = [];
      raw.forEach((r, idx) => {
        const mapped: Record<string, unknown> = {};
        for (const key of Object.keys(r)) {
          const target = COLUMN_MAP[key.trim().toLowerCase()];
          if (target) mapped[target] = r[key];
        }
        let cnpjVal = mapped.cnpj ? String(mapped.cnpj).trim() : "";
        let unidadeVal = mapped.unidade ? String(mapped.unidade).trim() : null;
        if (mapped.cnpj_unidade) {
          const split = splitCnpjUnidade(mapped.cnpj_unidade);
          if (!cnpjVal) cnpjVal = split.cnpj;
          if (!unidadeVal) unidadeVal = split.unidade;
        }
        const candidate = {
          socios: mapped.socios ? String(mapped.socios).trim() : null,
          cnpj: cnpjVal,
          unidade: unidadeVal,
          grupo: mapped.grupo ? String(mapped.grupo).trim() : null,
          status_operacoes: mapped.status_operacoes ? String(mapped.status_operacoes).trim() : null,
          total_com_carencia: toNumber(mapped.total_com_carencia),
          total_sem_carencia: toNumber(mapped.total_sem_carencia),
        };
        const result = rowSchema.safeParse(candidate);
        if (result.success) parsed.push(result.data);
        else errs.push(`Linha ${idx + 2}: ${result.error.issues[0].message}`);
      });

      setRows(parsed);
      setErrors(errs);
      toast({ title: "Arquivo lido", description: `${parsed.length} linhas válidas, ${errs.length} com erro.` });
    } catch (err: any) {
      toast({ title: "Erro ao ler arquivo", description: err.message, variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const { error: delErr } = await supabase.from("clientes_limites").delete().not("id", "is", null);
      if (delErr) throw delErr;

      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase.from("clientes_limites").insert(chunk as any);
        if (error) throw error;
      }

      await supabase.from("import_history").insert({
        imported_by: user!.id,
        imported_by_email: user!.email,
        row_count: rows.length,
      });

      qc.invalidateQueries({ queryKey: ["clientes_limites"] });
      toast({ title: "Importação concluída", description: `${rows.length} clientes carregados.` });
      setRows([]);
      setFileName("");
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <CreditHeader title="Admin - Limites" />
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/")} className="text-primary hover:text-primary/80 font-semibold">
            ← Voltar para o app
          </button>
          <div className="flex gap-2">
            <ChangePasswordButton />
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/auth"))}>
              <LogOut size={16} className="mr-2" /> Sair
            </Button>
          </div>
        </div>

        <UsersManagement />



        <Card className="p-6 border-2 border-secondary">
          <h2 className="text-xl font-semibold text-primary mb-2">Atualizar planilha de limites</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Envie um arquivo XLSX ou CSV com as colunas: <strong>Sócios, CNPJ, Unidade, Grupo, Status das operações, Total com carência, Total sem carência</strong>. Os dados existentes serão substituídos.
          </p>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-secondary rounded-lg p-8 cursor-pointer hover:border-primary transition-colors">
            <Upload size={32} className="text-primary mb-2" />
            <span className="text-sm font-medium text-foreground">
              {fileName || "Clique para escolher um arquivo"}
            </span>
            <span className="text-xs text-muted-foreground mt-1">XLSX, XLS ou CSV</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>

          {errors.length > 0 && (
            <div className="mt-4 p-3 bg-destructive/10 rounded text-sm text-destructive max-h-40 overflow-auto">
              <p className="font-semibold mb-1">{errors.length} linha(s) com erro:</p>
              <ul className="list-disc list-inside">
                {errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                {errors.length > 10 && <li>... e mais {errors.length - 10}</li>}
              </ul>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="mt-4 max-h-64 overflow-auto border border-border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">CNPJ</th>
                      <th className="p-2 text-left">Unidade</th>
                      <th className="p-2 text-left">Sócios</th>
                      <th className="p-2 text-right">Com carência</th>
                      <th className="p-2 text-right">Sem carência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{r.cnpj}</td>
                        <td className="p-2">{r.unidade}</td>
                        <td className="p-2 truncate max-w-[200px]">{r.socios}</td>
                        <td className="p-2 text-right">{r.total_com_carencia.toLocaleString("pt-BR")}</td>
                        <td className="p-2 text-right">{r.total_sem_carencia.toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 10 && (
                  <p className="text-xs text-muted-foreground p-2">+ {rows.length - 10} linhas</p>
                )}
              </div>
              <Button
                variant="gradient"
                size="lg"
                className="w-full mt-4"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? "Importando..." : `Substituir dados (${rows.length} linhas)`}
              </Button>
            </>
          )}
        </Card>
        <AdminAtivosUpload />

        



        <Card className="p-6 border-2 border-secondary">
          <h2 className="text-xl font-semibold text-primary mb-2 flex items-center gap-2">
            <UserPlus size={20} /> Autorizar novo usuário
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            O cadastro público está desativado. Crie aqui os acessos autorizados.
          </p>
          <form onSubmit={handleCreateUser} className="space-y-3">
            <div>
              <Label htmlFor="new-email">Email</Label>
              <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="new-password">Senha provisória (mín. 6)</Label>
              <Input id="new-password" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div>
              <Label htmlFor="new-role">Papel</Label>
              <select
                id="new-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "user" | "admin")}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="user">Usuário (consulta)</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <Button type="submit" variant="gradient" className="w-full" disabled={creatingUser}>
              {creatingUser ? "Criando..." : "Criar acesso"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default AdminLimites;
