import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Paperclip, Upload, Download, FileArchive, Send, Mail, Search, X, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import { ExportButtons } from "@/components/checklist/ExportButtons";
import { PeopleCards } from "@/components/checklist/PeopleCards";
import type { Pessoa } from "@/utils/docFormats";
import { emptyAs, emptyCdt, type AsState, type CdtState } from "@/utils/checklistSchema";
import { exportAsPDF, exportCdtPDF } from "@/utils/checklistExport";
import { exportAsDOCX, exportCdtDOCX } from "@/utils/checklistDocx";
import {
  anexarComprovante,
  baixarAnexo,
  baixarDocumentacaoZip,
  moverEtapa,
  type Operacao,
} from "@/services/operacoes";
import { listarUsuariosCadastrados, type UsuarioCadastrado } from "@/services/usuarios";
import { enviarEmailTeste } from "@/services/notificacoes";
import { useAuth } from "@/hooks/useAuth";
import { usePreAprovado } from "@/hooks/usePreAprovados";
import { usePageAccess } from "@/hooks/usePageAccess";
import { toast } from "@/hooks/use-toast";


interface Props {
  op: Operacao | null;
  onClose: () => void;
  onChange: (op: Operacao) => void;
  onDecisao: (op: Operacao, decisao: "aprovado" | "falta_doc" | "reprovado", texto?: string) => void;
  onAssinaturasConcluidas: (op: Operacao) => void;
  onContratoEmitido: (op: Operacao) => void;
  onEnviarAnalise: (op: Operacao) => void;
  onDesembolso: (op: Operacao, comprovante: string) => void;
}

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const OperacaoModal = ({
  op,
  onClose,
  onChange,
  onDecisao,
  onAssinaturasConcluidas,
  onContratoEmitido,
  onEnviarAnalise,
  onDesembolso,
}: Props) => {
  const [modo, setModo] = useState<null | "falta_doc" | "reprovado">(null);
  const [texto, setTexto] = useState("");
  const [usuarios, setUsuarios] = useState<UsuarioCadastrado[]>([]);
  const [erroUsuarios, setErroUsuarios] = useState(false);
  const [buscaEmail, setBuscaEmail] = useState("");
  const [editandoDestinatarios, setEditandoDestinatarios] = useState(false);
  const [checklistAberta, setChecklistAberta] = useState(false);
  const [pessoasAberta, setPessoasAberta] = useState(false);
  const { user } = useAuth();
  const { hasAccess: podeEditarRecolhimento } = usePageAccess("operacoes_valora_editar");
  const preAprovado = usePreAprovado(op?.cnpj);



  useEffect(() => {
    if (!op) return;
    setBuscaEmail("");
    setEditandoDestinatarios(op.etapa === "recolhimento");
    setChecklistAberta(op.etapa === "recolhimento" || op.etapa === "analise");
    setPessoasAberta(op.etapa === "recolhimento");
    listarUsuariosCadastrados()
      .then(setUsuarios)
      .catch(() => setErroUsuarios(true));
  }, [op?.id]);


  const termo = buscaEmail.trim().toLowerCase();
  const usuariosFiltrados = termo
    ? usuarios.filter((u) => u.email.toLowerCase().includes(termo))
    : usuarios;


  if (!op) return null;

  const somenteLeituraAnexos = op.etapa === "analise";


  const fechar = () => {
    setModo(null);
    setTexto("");
    onClose();
  };

  const toggleItem = (id: string, campo: "checked" | "pendente") =>
    onChange({
      ...op,
      checklist: op.checklist.map((c) => (c.id === id ? { ...c, [campo]: !c[campo] } : c)),
    });

  const anexarMock = (id: string) =>
    // TODO: integração real aqui — abrir picker do Drive/SharePoint e salvar a referência do arquivo.
    onChange({
      ...op,
      checklist: op.checklist.map((c) => (c.id === id ? { ...c, anexoNome: `anexo-${id}.pdf` } : c)),
    });

  const baixarItem = async (id: string) => {
    // TODO: integração real aqui — baixar o arquivo do storage.
    const nome = await baixarAnexo(op, id);
    console.info("[mock] download", nome);
  };

  const baixarTudo = async () => {
    // TODO: integração real aqui — gerar e baixar o .zip da documentação.
    const nome = await baixarDocumentacaoZip(op);
    console.info("[mock] download zip", nome);
  };

  const simularAssinatura = (sigId: string) => {
    const signatarios = op.signatarios.map((s) =>
      s.id === sigId ? { ...s, status: s.status === "Assinado" ? ("Pendente" as const) : ("Assinado" as const) } : s
    );
    const atualizado = { ...op, signatarios };
    if (signatarios.every((s) => s.status === "Assinado")) {
      onAssinaturasConcluidas(moverEtapa(atualizado, "contrato_assinado"));
      fechar();
      return;
    }
    onChange(atualizado);
  };

  const uploadComprovante = async () => {
    const nome = `comprovante-${op.id}.pdf`;
    const salvo = await anexarComprovante(op, nome);
    onDesembolso(op, salvo);
    fechar();
  };

  const destinatarios = op.destinatarios ?? [];

  const toggleDestinatario = (email: string) =>
    onChange({
      ...op,
      destinatarios: destinatarios.includes(email)
        ? destinatarios.filter((e) => e !== email)
        : [...destinatarios, email],
    });

  const testarEmail = () => {
    if (!user?.email) {
      toast({ title: "Nenhum usuário logado", variant: "destructive" });
      return;
    }
    void enviarEmailTeste(op);
  };

  const confirmarDecisao = (decisao: "falta_doc" | "reprovado") => {
    if (!texto.trim()) return;
    onDecisao(op, decisao, texto.trim());
    fechar();
  };

  /** Dados editáveis apenas na coluna "Recolhimento de documentos" e com sub-permissão. */
  const editavel = op.etapa === "recolhimento" && podeEditarRecolhimento;
  const setCampo = (patch: Partial<Operacao>) => onChange({ ...op, ...patch });

  /** Mapeia a Operação para o shape esperado pelos exports da Central de Documentos. */
  const isQia = op.linha === "QIA";
  const mapBase = () => {
    const total = op.carenciaTotalMeses ?? 0;
    const principal = op.carenciaPrincipalMeses ?? 0;
    const carencia =
      total > 0 && principal > 0
        ? {
            opCarenciaTipo: "total_e_principal" as const,
            opCarencia: "",
            opCarenciaTotalMeses: String(total),
            opCarenciaPrincipalMeses: String(principal),
          }
        : total > 0
          ? { opCarenciaTipo: "total" as const, opCarencia: String(total) }
          : principal > 0
            ? { opCarenciaTipo: "principal" as const, opCarencia: String(principal) }
            : { opCarenciaTipo: "total" as const, opCarencia: "" };

    return {
      razaoSocial: op.unidade,
      cnpj: op.cnpj ?? "",
      regional: "",
      representantes: (op.dadosRepresentantes ?? []).map((p) => ({
        nome: p.nome,
        cpf: p.cpf,
        email: p.email,
      })),
      avalistas: (op.dadosAvalistas ?? []).map((p) => ({
        nome: p.nome,
        cpf: p.cpf,
        email: p.email,
        regime: p.regime ?? "",
      })),
      dadosBancarios: op.contaDeposito ?? "",
      opValor: formatCurrency(op.valor),
      opTaxa: (op.taxa.match(/[\d.,]+/)?.[0] ?? "").trim(),
      opPrazo: String(op.prazoMeses),
      ...carencia,
    };
  };

  const cdtState = (): CdtState => ({
    ...emptyCdt(),
    ...mapBase(),
    docs: Object.fromEntries(op.checklist.map((c, i) => [String(i), c.checked])),
  });

  const asState = (): AsState => ({
    ...emptyAs(),
    ...mapBase(),
    fielDepositario: "",
    fielNA: true,
    docs: Object.fromEntries(op.checklist.map((c, i) => [String(i + 1), c.checked])),
  });

  const baixarChecklistPdf = () =>
    isQia ? exportCdtPDF(cdtState(), op.unidade) : exportAsPDF(asState(), op.unidade);
  const baixarChecklistDocx = () =>
    isQia ? exportCdtDOCX(cdtState(), op.unidade) : exportAsDOCX(asState(), op.unidade);



  return (
    <Dialog open={!!op} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary">{op.unidade}</DialogTitle>
          {/* CNPJ presente na base de pré-aprovados. */}
          {preAprovado && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="crm-pill bg-sla-ok text-primary-foreground">MVP</span>
              <span className="text-xs font-medium text-foreground">
                Limite: {formatCurrency(preAprovado.limite)}
              </span>
            </div>
          )}
        </DialogHeader>


        {/* Seção 1 — Dados da operação */}
        <section className="space-y-2">
          <h3 className="text-sm font-display font-extrabold text-primary">Dados da operação</h3>

          {editavel ? (
            /* Em "Recolhimento de documentos" os dados podem ser editados. */
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <Label htmlFor="op-unidade" className="text-brand-gray">Unidade</Label>
                <Input id="op-unidade" value={op.unidade} onChange={(e) => setCampo({ unidade: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="op-cnpj" className="text-brand-gray">CNPJ</Label>
                <Input
                  id="op-cnpj"
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  value={op.cnpj ?? ""}
                  onChange={(e) => setCampo({ cnpj: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="op-linha" className="text-brand-gray">Linha de crédito</Label>
                <select
                  id="op-linha"
                  value={op.linha}
                  onChange={(e) => setCampo({ linha: e.target.value as Operacao["linha"] })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="QIA">QIA</option>
                  <option value="Amor Saúde">Amor Saúde</option>
                  <option value="Visão de Todos">Visão de Todos</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-brand-gray">Fundo responsável</Label>
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm font-bold">
                  FIDC MaisTODOS
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="op-valor" className="text-brand-gray">Valor (R$)</Label>
                <Input
                  id="op-valor"
                  type="number"
                  min={0}
                  value={op.valor}
                  onChange={(e) => setCampo({ valor: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="op-taxa" className="text-brand-gray">Taxa</Label>
                <Input id="op-taxa" value={op.taxa} onChange={(e) => setCampo({ taxa: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="op-prazo" className="text-brand-gray">Prazo (meses)</Label>
                <Input
                  id="op-prazo"
                  type="number"
                  min={1}
                  value={op.prazoMeses}
                  onChange={(e) => setCampo({ prazoMeses: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="op-car-total" className="text-brand-gray">Carência total (meses)</Label>
                <Input
                  id="op-car-total"
                  type="number"
                  min={0}
                  value={op.carenciaTotalMeses ?? 0}
                  onChange={(e) => setCampo({ carenciaTotalMeses: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="op-car-principal" className="text-brand-gray">
                  Carência do principal (meses)
                </Label>
                <Input
                  id="op-car-principal"
                  type="number"
                  min={0}
                  value={op.carenciaPrincipalMeses ?? 0}
                  onChange={(e) => setCampo({ carenciaPrincipalMeses: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="op-conta" className="text-brand-gray">
                  Número da conta para depósito
                </Label>
                <Input
                  id="op-conta"
                  placeholder="Banco / Agência / Conta"
                  value={op.contaDeposito ?? ""}
                  onChange={(e) => setCampo({ contaDeposito: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-brand-gray">Unidade</dt><dd className="font-bold">{op.unidade}</dd></div>
              <div><dt className="text-brand-gray">CNPJ</dt><dd className="font-bold">{op.cnpj ?? "—"}</dd></div>
              <div><dt className="text-brand-gray">Linha de crédito</dt><dd className="font-bold">{op.linha}</dd></div>
              {/* TODO: integração real com HubSpot aqui. */}
              <div><dt className="text-brand-gray">Fundo responsável</dt><dd className="font-bold">{op.fundo}</dd></div>
              <div><dt className="text-brand-gray">Valor</dt><dd className="font-bold">{formatCurrency(op.valor)}</dd></div>
              <div><dt className="text-brand-gray">Taxa</dt><dd className="font-bold">{op.taxa}</dd></div>
              <div><dt className="text-brand-gray">Prazo</dt><dd className="font-bold">{op.prazoMeses}x</dd></div>
              <div>
                <dt className="text-brand-gray">Carência total</dt>
                <dd className="font-bold">{op.carenciaTotalMeses ?? 0} meses</dd>
              </div>
              <div>
                <dt className="text-brand-gray">Carência do principal</dt>
                <dd className="font-bold">{op.carenciaPrincipalMeses ?? 0} meses</dd>
              </div>
            </dl>
          )}

          {op.alerta && (
            <p className="rounded-md border border-brand-magenta p-2 text-xs text-brand-magenta">
              <strong>{op.alerta.tipo}:</strong> {op.alerta.mensagem}
            </p>
          )}
        </section>

        {/* Seção 2 — Checklist (mesma lista da Central de Documentos) */}
        <Collapsible
          open={checklistAberta}
          onOpenChange={setChecklistAberta}
          className="space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-display font-extrabold text-primary">
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  checklistAberta ? "" : "-rotate-90"
                }`}
              />
              Checklist de documentação — {op.linha}
            </CollapsibleTrigger>
            {somenteLeituraAnexos && (
              <Button size="sm" variant="outline" onClick={baixarTudo}>
                <FileArchive className="mr-2 h-4 w-4" />
                Baixar tudo (.zip)
              </Button>
            )}
          </div>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <ul className="space-y-1.5">

            {op.checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-sm">
                <Checkbox
                  id={item.id}
                  checked={item.checked}
                  onCheckedChange={() => toggleItem(item.id, "checked")}
                  className="mt-0.5"
                />
                <Label htmlFor={item.id} className="flex-1 font-normal leading-snug">
                  {item.label}
                  {item.pendente && (
                    <span className="ml-2 rounded-full bg-brand-magenta px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      Pendente
                    </span>
                  )}
                </Label>
                {somenteLeituraAnexos ? (
                  <button
                    type="button"
                    onClick={() => baixarItem(item.id)}
                    className="flex shrink-0 items-center gap-1 text-xs text-primary underline"
                  >
                    <Download className="h-3 w-3" />
                    Baixar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => anexarMock(item.id)}
                    className="flex shrink-0 items-center gap-1 text-xs text-primary underline"
                  >
                    <Paperclip className="h-3 w-3" />
                    {item.anexoNome ?? "Anexar"}
                  </button>
                )}
                {modo === "falta_doc" && (
                  <label className="flex shrink-0 items-center gap-1 text-xs text-brand-gray">
                    <Checkbox
                      checked={!!item.pendente}
                      onCheckedChange={() => toggleItem(item.id, "pendente")}
                    />
                    pendente
                  </label>
                )}
              </li>
            ))}
          </ul>
          </CollapsibleContent>
        </Collapsible>

        {/* Seção 2a — Dados do representante legal e avalista */}
        <Collapsible open={pessoasAberta} onOpenChange={setPessoasAberta} className="space-y-2">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-display font-extrabold text-primary">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                pessoasAberta ? "" : "-rotate-90"
              }`}
            />
            Dados do representante legal e avalista
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            {editavel ? (
              <div className="space-y-6">
                <PeopleCards
                  titulo="Representante Legal"
                  pessoas={op.dadosRepresentantes ?? []}
                  onChange={(next) => setCampo({ dadosRepresentantes: next })}
                />
                <PeopleCards
                  titulo="Avalista"
                  pessoas={op.dadosAvalistas ?? []}
                  comRegime
                  sourcePessoas={op.dadosRepresentantes ?? []}
                  sourceLabel="Representante Legal"
                  onChange={(next) => setCampo({ dadosAvalistas: next })}
                />
              </div>
            ) : (
              <div className="space-y-6 text-sm">
                {(
                  [
                    ["Representante Legal", op.dadosRepresentantes ?? []],
                    ["Avalista", op.dadosAvalistas ?? []],
                  ] as [string, Pessoa[]][]
                ).map(([titulo, lista]) => (
                  <div key={titulo} className="space-y-1">
                    <p className="crm-field-label">{titulo}</p>
                    {lista.length === 0 ? (
                      <p className="text-muted-foreground">Não informado</p>
                    ) : (
                      <ul className="space-y-1">
                        {lista.map((p, i) => (
                          <li key={i} className="leading-snug">
                            {[p.nome, p.cpf, p.email, p.regime]
                              .filter(Boolean)
                              .join(" — ") || "—"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>


        {/* Baixar checklist — mesmo formato da Central de Documentos */}
        <div className="space-y-2">
          <h3 className="text-sm font-display font-extrabold text-primary">Baixar checklist</h3>
          <ExportButtons onPdf={baixarChecklistPdf} onDocx={baixarChecklistDocx} />
        </div>



        {/* Seção 2b — Destinatários das notificações */}
        <section className="space-y-2 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-display font-extrabold text-primary">
              Destinatários dos e-mails <span className="text-destructive">*</span>
            </h3>
            <div className="flex gap-2">
              {!editandoDestinatarios && (
                <Button size="sm" variant="ghost" onClick={() => setEditandoDestinatarios(true)}>
                  Alterar
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={testarEmail}>
                <Mail className="mr-2 h-4 w-4" />
                Testar e-mail
              </Button>
            </div>
          </div>

          {/* Selecionados (sempre visíveis) */}
          {destinatarios.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {destinatarios.map((email) => (
                <li
                  key={email}
                  className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
                >
                  {email}
                  <button
                    type="button"
                    aria-label={`Remover ${email}`}
                    onClick={() => toggleDestinatario(email)}
                    className="text-brand-gray hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {editandoDestinatarios && (
            erroUsuarios ? (
              <p className="text-xs text-brand-gray">
                Não foi possível carregar os usuários cadastrados (acesso restrito a administradores).
              </p>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-gray" />
                  <Input
                    value={buscaEmail}
                    onChange={(e) => setBuscaEmail(e.target.value)}
                    placeholder="Buscar e-mail cadastrado…"
                    className="h-9 pl-7 text-sm"
                  />
                </div>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {usuariosFiltrados.map((u) => (
                    <li key={u.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={`dest-${u.id}`}
                        checked={destinatarios.includes(u.email)}
                        onCheckedChange={() => toggleDestinatario(u.email)}
                      />
                      <Label htmlFor={`dest-${u.id}`} className="font-normal">{u.email}</Label>
                    </li>
                  ))}
                  {usuarios.length === 0 && (
                    <li className="text-xs text-brand-gray">Carregando usuários cadastrados…</li>
                  )}
                  {usuarios.length > 0 && usuariosFiltrados.length === 0 && (
                    <li className="text-xs text-brand-gray">Nenhum e-mail encontrado.</li>
                  )}
                </ul>
                {op.etapa !== "recolhimento" && (
                  <Button size="sm" variant="ghost" onClick={() => setEditandoDestinatarios(false)}>
                    Concluir
                  </Button>
                )}
              </div>
            )
          )}

          {destinatarios.length === 0 && (
            <p className="text-xs text-destructive">Selecione ao menos um destinatário.</p>
          )}
        </section>


        {/* Seção 2c — Avançar etapa a partir do recolhimento */}
        {op.etapa === "recolhimento" && (
          <section className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-display font-extrabold text-primary">Próxima etapa</h3>
            <Button
              disabled={destinatarios.length === 0}
              onClick={() => {
                onEnviarAnalise(op);
                fechar();
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar para análise do fornecedor
            </Button>
            <p className="text-xs text-brand-gray">
              O envio não depende da checklist estar 100% preenchida.
            </p>
          </section>
        )}

        {/* Seção 3 — Decisão (somente Análise fornecedor) */}
        {op.etapa === "analise" && (
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-display font-extrabold text-primary">Decisão</h3>
            {modo === null && (
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-secondary text-secondary-foreground hover:bg-secondary"
                  onClick={() => {
                    onDecisao(op, "aprovado");
                    fechar();
                  }}
                >
                  Aprovado
                </Button>
                <Button variant="outline" onClick={() => setModo("falta_doc")}>
                  Falta documentação
                </Button>
                <Button
                  className="bg-brand-magenta text-primary-foreground hover:bg-brand-magenta"
                  onClick={() => setModo("reprovado")}
                >
                  Reprovado
                </Button>
              </div>
            )}
            {modo && (
              <div className="space-y-2">
                <Label htmlFor="decisao-texto">
                  {modo === "falta_doc" ? "O que está faltando?" : "Motivo da reprovação"}
                </Label>
                <Textarea
                  id="decisao-texto"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={modo === "falta_doc" ? "Descreva os documentos pendentes" : "Descreva o motivo"}
                />
                <div className="flex gap-2">
                  <Button disabled={!texto.trim()} onClick={() => confirmarDecisao(modo)}>
                    Confirmar
                  </Button>
                  <Button variant="ghost" onClick={() => { setModo(null); setTexto(""); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Seção 3b — Aguardando emissão de contrato */}
        {op.etapa === "aguardando_contrato" && (
          <section className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-display font-extrabold text-primary">Emissão de contrato</h3>
            <Button
              onClick={() => {
                onContratoEmitido(moverEtapa(op, "contrato_emitido"));
                fechar();
              }}
            >
              Contrato emitido
            </Button>
          </section>
        )}

        {/* Seção 4 — Assinaturas (somente Contrato emitido) */}
        {op.etapa === "contrato_emitido" && (
          <section className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-display font-extrabold text-primary">Assinaturas</h3>
            <ul className="space-y-2">
              {op.signatarios.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <strong>{s.nome}</strong> <span className="text-brand-gray">— {s.papel}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        s.status === "Assinado"
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.status}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => simularAssinatura(s.id)}>
                      Simular assinatura
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-brand-gray">
              Status das assinaturas será atualizado automaticamente na integração com DocuSign.
            </p>
          </section>
        )}

        {/* Seção 5 — Desembolso (na etapa "Contrato assinado — pronto para desembolso") */}
        {(op.etapa === "contrato_assinado" || op.etapa === "desembolsado") && (
          <section className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-display font-extrabold text-primary">Desembolso</h3>
            {op.etapa === "contrato_assinado" && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={uploadComprovante}>
                  <Upload className="mr-2 h-4 w-4" />
                  Anexar comprovante de pagamento
                </Button>
                <Button onClick={uploadComprovante}>Pago</Button>
              </div>
            )}

            {op.comprovanteDesembolso && (
              <p className="text-xs text-brand-gray">Anexado (mock): {op.comprovanteDesembolso}</p>
            )}
          </section>
        )}

        {/* Seção 6 — Histórico de movimentações (discreto, recolhido) */}
        <details className="border-t border-border pt-3">
          <summary className="cursor-pointer text-xs text-brand-gray">
            Histórico de movimentações ({op.historico.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {op.historico
              .slice()
              .reverse()
              .map((h) => (
                <li key={h.id} className="text-xs leading-snug text-muted-foreground">
                  {fmtDataHora(h.data)} · {h.autor} · {h.descricao}
                </li>
              ))}
            {op.historico.length === 0 && (
              <li className="text-xs text-muted-foreground">Nenhuma movimentação registrada</li>
            )}
          </ul>
        </details>
      </DialogContent>
    </Dialog>
  );
};
