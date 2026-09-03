import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search } from "lucide-react";
import { OperacaoCard } from "@/components/valora/OperacaoCard";
import { OperacaoModal } from "@/components/valora/OperacaoModal";
import {
  ETAPAS,
  criarPastaDocumentos,
  listarOperacoes,
  moverEtapa,
  registrarMovimentacao,
  salvarOperacao,
  type Operacao,
} from "@/services/operacoes";
import { notificar, type EventoNotificacao } from "@/services/notificacoes";
import { toast } from "@/hooks/use-toast";

const OperacoesValora = () => {
  const navigate = useNavigate();
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<"3" | "6" | "12" | "tudo">("tudo");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    // TODO: integração real aqui — trocar o mock por fetch no backend/HubSpot.
    listarOperacoes().then(setOperacoes);
  }, []);

  const selecionada = operacoes.find((o) => o.id === selecionadaId) ?? null;

  /** Aplica a alteração na tela e persiste. Erro de gravação vira aviso visível. */
  const atualizar = async (op: Operacao) => {
    setOperacoes((prev) => prev.map((o) => (o.id === op.id ? op : o)));
    try {
      await salvarOperacao(op);
      return true;
    } catch (err: unknown) {
      console.error("[operacoes] falha ao salvar", err);
      toast({
        title: "Não foi possível salvar a operação",
        description:
          err instanceof Error && err.message ? err.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Salva e só então notifica.
   *
   * A ordem importa por dois motivos: a edge function de e-mail lê a operação
   * do banco (se notificasse antes, o e-mail sairia com a etapa anterior), e um
   * e-mail avisando de uma mudança que não chegou a ser gravada seria pior do
   * que nenhum e-mail.
   */
  const salvarENotificar = async (
    op: Operacao,
    evento: EventoNotificacao,
    detalhe?: string,
  ) => {
    const salvou = await atualizar(op);
    if (!salvou) return;
    await notificar(evento, op, detalhe);
  };

  const handleDecisao = (
    op: Operacao,
    decisao: "aprovado" | "falta_doc" | "reprovado",
    texto?: string
  ) => {
    if (decisao === "aprovado") {
      const novo = registrarMovimentacao(
        { ...moverEtapa(op, "aguardando_contrato"), alerta: null },
        "Operação aprovada — aguardando emissão de contrato"
      );
      void salvarENotificar(novo, "aprovado");
      return;
    }
    if (decisao === "falta_doc") {
      const novo = registrarMovimentacao(
        {
          ...moverEtapa(op, "recolhimento"),
          alerta: { tipo: "Pendência" as const, mensagem: texto ?? "" },
        },
        `Falta documentação — devolvido para recolhimento: ${texto ?? ""}`
      );
      void criarPastaDocumentos(novo);
      void salvarENotificar(novo, "falta_documentacao", texto);
      return;
    }
    const novo = registrarMovimentacao(
      {
        ...moverEtapa(op, "recolhimento"),
        alerta: { tipo: "Reprovado" as const, mensagem: texto ?? "" },
      },
      `Operação reprovada — devolvido para recolhimento: ${texto ?? ""}`
    );
    void salvarENotificar(novo, "reprovado", texto);
  };

  const handleEnviarAnalise = (op: Operacao) => {
    const novo = registrarMovimentacao(
      { ...moverEtapa(op, "analise"), alerta: null },
      "Enviado para análise do fornecedor"
    );
    void salvarENotificar(novo, "enviado_analise");
  };

  const handleDesembolso = (op: Operacao, comprovante: string) => {
    const novo = registrarMovimentacao(
      { ...moverEtapa(op, "desembolsado"), comprovanteDesembolso: comprovante, alerta: null },
      `Comprovante de pagamento anexado (${comprovante}) — operação desembolsada`
    );
    void salvarENotificar(novo, "desembolsado");
  };

  const handleAssinaturasConcluidas = (op: Operacao) => {
    const novo = registrarMovimentacao(op, "Todas as assinaturas concluídas");
    void salvarENotificar(novo, "assinaturas_concluidas");
  };

  const handleContratoEmitido = (op: Operacao) => {
    const novo = registrarMovimentacao(op, "Contrato emitido");
    void salvarENotificar(novo, "contrato_emitido");
  };

  const colunas = ETAPAS.filter((e) => !e.oculta);

  // Filtro de data (visual) — recorta por data de entrada no funil.
  const limiteMs = (() => {
    if (periodo === "tudo") return null;
    const d = new Date();
    d.setMonth(d.getMonth() - Number(periodo));
    return d.getTime();
  })();

  const termo = busca.trim().toLowerCase();
  const termoDigitos = termo.replace(/\D/g, "");

  const visiveis = operacoes.filter((o) => {
    const t = new Date(o.dataEntradaFunil).getTime();
    if (limiteMs !== null && t < limiteMs) return false;
    if (de && t < new Date(de).getTime()) return false;
    if (ate && t > new Date(ate).getTime() + 86_400_000) return false;
    if (termo) {
      const nomeOk = (o.unidade ?? "").toLowerCase().includes(termo);
      const cnpjDigitos = (o.cnpj ?? "").replace(/\D/g, "");
      const cnpjOk = termoDigitos.length > 0 && cnpjDigitos.includes(termoDigitos);
      if (!nomeOk && !cnpjOk) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-[1800px] px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-4 h-8 text-xs">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Operações em Formalização</h1>
            <p className="text-sm text-muted-foreground">Quadro Kanban de operações de crédito PJ</p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <p className="crm-field-label">Buscar</p>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome ou CNPJ..."
                  className="h-9 w-[210px] pl-8 text-xs"
                />
              </div>
            </div>
            <div>
              <p className="crm-field-label">Período</p>
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
                <SelectTrigger className="h-9 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Últimos 3 meses</SelectItem>
                  <SelectItem value="6">Últimos 6 meses</SelectItem>
                  <SelectItem value="12">Últimos 12 meses</SelectItem>
                  <SelectItem value="tudo">Tudo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="crm-field-label">De</p>
              <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 w-[150px] text-xs" />
            </div>
            <div>
              <p className="crm-field-label">Até</p>
              <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 w-[150px] text-xs" />
            </div>
            {(de || ate || busca || periodo !== "tudo") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => {
                  setPeriodo("tudo");
                  setDe("");
                  setAte("");
                  setBusca("");
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {colunas.map((etapa) => {
            const cards = visiveis.filter((o) => o.etapa === etapa.id);
            return (
              <section key={etapa.id} className="flex min-w-0 flex-col rounded-lg border border-border bg-muted/40 p-3">

                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{etapa.titulo}</h2>
                    <p className="text-xs text-muted-foreground">SLA {etapa.slaDias}d</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground ring-1 ring-border">
                    {cards.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2">
                  {cards.map((op) => (
                    <OperacaoCard key={op.id} op={op} onClick={() => setSelecionadaId(op.id)} />
                  ))}
                  {cards.length === 0 && (
                    <p className="rounded border border-dashed py-6 text-center text-xs text-muted-foreground">
                      Vazio
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <OperacaoModal
        op={selecionada}
        onClose={() => setSelecionadaId(null)}
        onChange={atualizar}
        onDecisao={handleDecisao}
        onAssinaturasConcluidas={handleAssinaturasConcluidas}
        onContratoEmitido={handleContratoEmitido}
        onEnviarAnalise={handleEnviarAnalise}
        onDesembolso={handleDesembolso}
      />
    </div>
  );
};

export default OperacoesValora;
