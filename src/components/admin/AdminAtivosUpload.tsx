import { useState } from "react";
import * as XLSX from "xlsx";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const rowSchema = z.object({
  franquia: z.string().nullable(),
  cnpj: z.string().min(1, "CNPJ obrigatório"),
  data_aquisicao: z.string().nullable(),
  data_emissao: z.string().nullable(),
  valor_operacao: z.number(),
  primeiro_vencimento: z.string().nullable(),
  ultimo_vencimento: z.string().nullable(),
  total_parcelas: z.number().nullable(),
  parcela_atual: z.number().nullable(),
  valor_parcela: z.number(),
  data_vencimento_atual: z.string().nullable(),
  total_pago: z.number(),
  saldo_devedor: z.number(),
  seu_numero: z.string().nullable(),
  id_valora: z.string().nullable(),
  nosso_numero: z.string().nullable(),
  tipo_op: z.string().nullable(),
  taxa_op: z.number().nullable(),
  taxa_op_raw: z.string().nullable(),
  refin_aditivo: z.string().nullable(),
  carencia_principal: z.number().nullable(),
});

type Row = z.infer<typeof rowSchema>;

const COLUMN_MAP: Record<string, keyof Row> = {
  franquia: "franquia",
  cnpj: "cnpj",
  "data de aquisição": "data_aquisicao",
  "data de aquisicao": "data_aquisicao",
  "data de emissão": "data_emissao",
  "data de emissao": "data_emissao",
  "valor da operação": "valor_operacao",
  "valor da operacao": "valor_operacao",
  "1º vencimento": "primeiro_vencimento",
  "1 vencimento": "primeiro_vencimento",
  "primeiro vencimento": "primeiro_vencimento",
  "ultimo vencimento": "ultimo_vencimento",
  "último vencimento": "ultimo_vencimento",
  "total de parcelas": "total_parcelas",
  "parcela a ser paga": "parcela_atual",
  "valor da parcela": "valor_parcela",
  "data de vencimento": "data_vencimento_atual",
  "data de vencimento atual": "data_vencimento_atual",
  "total pago (parcelas)": "total_pago",
  "total pago": "total_pago",
  "saldo devedor (d-1)": "saldo_devedor",
  "saldo devedor": "saldo_devedor",
  "seu numero": "seu_numero",
  "seu número": "seu_numero",
  id: "id_valora",
  "nosso numero": "nosso_numero",
  "nosso número": "nosso_numero",
  "tipo op": "tipo_op",
  "tipo da operação": "tipo_op",
  "tx op": "taxa_op",
  "taxa op": "taxa_op",
  "refin/aditivo": "refin_aditivo",
  "refin / aditivo": "refin_aditivo",
  "refin aditivo": "refin_aditivo",
  "carência principal": "carencia_principal",
  "carencia principal": "carencia_principal",
};

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const toNumberOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = toNumber(v);
  return n === 0 && v !== 0 && v !== "0" ? null : n;
};

// Converte diferentes formatos de data (JS Date, número serial XLSX, string dd/mm/yyyy ou yyyy-mm-dd) para ISO yyyy-mm-dd.
const toIsoDate = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number") {
    // Número serial do Excel (dias desde 1899-12-30)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return toIsoDate(d);
  }
  const s = String(v).trim();
  if (!s) return null;
  // dd/mm/yyyy
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m1) {
    const [_, d, m, y] = m1;
    const yy = y.length === 2 ? `20${y}` : y;
    return `${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
};

export const AdminAtivosUpload = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFile = async (file: File) => {
    setErrors([]);
    setRows([]);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });

      const parsed: Row[] = [];
      const errs: string[] = [];
      raw.forEach((r, idx) => {
        const mapped: Record<string, unknown> = {};
        for (const key of Object.keys(r)) {
          const target = COLUMN_MAP[key.trim().toLowerCase()];
          if (target) mapped[target] = r[key];
        }
        const candidate: Row = {
          franquia: mapped.franquia ? String(mapped.franquia).trim() : null,
          cnpj: mapped.cnpj ? String(mapped.cnpj).trim() : "",
          data_aquisicao: toIsoDate(mapped.data_aquisicao),
          data_emissao: toIsoDate(mapped.data_emissao),
          valor_operacao: toNumber(mapped.valor_operacao),
          primeiro_vencimento: toIsoDate(mapped.primeiro_vencimento),
          ultimo_vencimento: toIsoDate(mapped.ultimo_vencimento),
          total_parcelas: toNumberOrNull(mapped.total_parcelas),
          parcela_atual: toNumberOrNull(mapped.parcela_atual),
          valor_parcela: toNumber(mapped.valor_parcela),
          data_vencimento_atual: toIsoDate(mapped.data_vencimento_atual),
          total_pago: toNumber(mapped.total_pago),
          saldo_devedor: toNumber(mapped.saldo_devedor),
          seu_numero: mapped.seu_numero != null && mapped.seu_numero !== "" ? String(mapped.seu_numero).trim() : null,
          id_valora: mapped.id_valora != null && mapped.id_valora !== "" ? String(mapped.id_valora).trim() : null,
          nosso_numero: mapped.nosso_numero != null && mapped.nosso_numero !== "" ? String(mapped.nosso_numero).trim() : null,
          tipo_op: mapped.tipo_op ? String(mapped.tipo_op).trim() : null,
          taxa_op: toNumberOrNull(mapped.taxa_op),
          taxa_op_raw: mapped.taxa_op != null && mapped.taxa_op !== "" ? String(mapped.taxa_op).trim() : null,
          refin_aditivo: mapped.refin_aditivo ? String(mapped.refin_aditivo).trim() : null,
          carencia_principal: toNumberOrNull(mapped.carencia_principal),
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
      // 1. Cria registro de histórico primeiro para termos o import_id
      const { data: histRow, error: histErr } = await supabase
        .from("operacoes_import_history")
        .insert({
          imported_by: user!.id,
          imported_by_email: user!.email,
          row_count: rows.length,
        })
        .select("id")
        .single();
      if (histErr) throw histErr;
      const importId = histRow.id as string;

      // 2. Substitui operacoes_ativas (dados operacionais correntes)
      const { error: delErr } = await supabase
        .from("operacoes_ativas")
        .delete()
        .not("id", "is", null);
      if (delErr) throw delErr;

      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase.from("operacoes_ativas").insert(chunk as any);
        if (error) throw error;
      }

      // 3. Grava snapshots (backup histórico da ingestão)
      const snapshots = rows.map((r) => ({ ...r, import_id: importId, raw: r as any }));
      for (let i = 0; i < snapshots.length; i += chunkSize) {
        const chunk = snapshots.slice(i, i + chunkSize);
        const { error } = await supabase.from("operacoes_snapshots").insert(chunk as any);
        if (error) throw error;
      }

      // 4. Dispara reconciliação (projeções + divergências vs. ingestão anterior)
      const { error: recErr } = await supabase.functions.invoke("reconcile-operacoes", {
        body: { import_id: importId },
      });
      if (recErr) {
        console.error("reconcile error", recErr);
        toast({
          title: "Importação concluída",
          description: "Dados carregados, mas houve erro ao gerar projeções/divergências.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Importação concluída",
          description: `${rows.length} operações carregadas e histórico gerado.`,
        });
      }

      qc.invalidateQueries({ queryKey: ["operacoes_ativas"] });
      qc.invalidateQueries({ queryKey: ["last_import_ativos"] });
      qc.invalidateQueries({ queryKey: ["operacao_historico"] });
      setRows([]);
      setFileName("");
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="p-6 border-2 border-secondary">
      <h2 className="text-xl font-semibold text-primary mb-2">Atualizar planilha de operações ativas</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Envie o arquivo mensal (XLSX/CSV) com as colunas: <strong>Franquia, CNPJ, Data de Aquisição, Data de Emissão, Valor da Operação, 1º Vencimento, Último Vencimento, Total de Parcelas, Parcela a ser Paga, Valor da Parcela, Data de Vencimento, Total Pago, Saldo Devedor (D-1), Seu Número, ID, Nosso Número, Tipo Op, TX Op, Refin/Aditivo, Carência Principal</strong>. Os dados atuais serão substituídos por esta carga (backlog + mês corrente na mesma planilha).
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
                  <th className="p-2 text-left">Franquia</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-right">Parcela</th>
                  <th className="p-2 text-right">Valor parcela</th>
                  <th className="p-2 text-left">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{r.cnpj}</td>
                    <td className="p-2 truncate max-w-[180px]">{r.franquia}</td>
                    <td className="p-2">{r.tipo_op}</td>
                    <td className="p-2 text-right">{r.parcela_atual}/{r.total_parcelas}</td>
                    <td className="p-2 text-right">{r.valor_parcela.toLocaleString("pt-BR")}</td>
                    <td className="p-2">{r.data_vencimento_atual ?? "—"}</td>
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
  );
};
