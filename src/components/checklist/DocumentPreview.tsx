import { CL_OBSERVACOES } from "@/utils/checklistSchema";

interface Props {
  titulo: string;
  subtitulo: string;
  identificacao: [string, string][];
  itens: [string, string][];
  docs: { label: string; status: string }[];
}

// Reproduz visualmente a tabela impressa (borda dupla dourada + tabelas grid),
// para que o usuário veja o mesmo layout do PDF antes de gerar.
export const DocumentPreview = ({ titulo, subtitulo, identificacao, itens, docs }: Props) => (
  <div>
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
      Pré-visualização do documento
    </p>
    <div className="relative bg-[hsl(38,50%,97%)] text-[hsl(45,10%,15%)] shadow-card rounded-md p-6 border border-border">
      <div className="absolute inset-3 border border-primary/30 pointer-events-none rounded-sm" />
      <div className="relative">
        <h3 className="text-center text-sm font-bold uppercase tracking-wide">{titulo}</h3>
        <p className="text-center italic text-xs text-muted-foreground mb-4">{subtitulo}</p>

        <table className="w-full text-[10px] border-collapse mb-3">
          <tbody>
            {identificacao.map(([k, v]) => (
              <tr key={k}>
                <td className="border border-foreground/50 p-1.5 font-semibold w-[46%] align-top">
                  {k}
                </td>
                <td className="border border-foreground/50 p-1.5 align-top">
                  {v || <span className="text-destructive font-semibold">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="border border-foreground/50 bg-primary/10 p-1.5 text-left w-[46%] font-bold">
                ITENS VERIFICADOS
              </th>
              <th className="border border-foreground/50 bg-primary/10 p-1.5 text-left font-bold">
                PREENCHER INFORMAÇÕES
              </th>
            </tr>
          </thead>
          <tbody>
            {itens.map(([k, v]) => (
              <tr key={k}>
                <td className="border border-foreground/50 p-1.5 font-semibold align-top whitespace-pre-line">
                  {k}
                </td>
                <td className="border border-foreground/50 p-1.5 align-top whitespace-pre-line">
                  {v ? (
                    v.includes("CRÉDITO GARANTIA DE RECEBÍVEIS") ? (
                      <>
                        {v.split("\n").map((line, i) => (
                          <div key={i}>
                            {line === "CRÉDITO GARANTIA DE RECEBÍVEIS" ? (
                              <strong>{line}</strong>
                            ) : (
                              line
                            )}
                          </div>
                        ))}
                      </>
                    ) : (
                      v
                    )
                  ) : (
                    <span className="text-destructive font-semibold">—</span>
                  )}
                </td>
              </tr>
            ))}
            {docs.map((d) => (
              <tr key={d.label}>
                <td className="border border-foreground/50 p-1.5 font-semibold align-top">
                  {d.label}
                </td>
                <td className="border border-foreground/50 p-1.5 align-top">
                  {d.status === "PENDENTE" ? (
                    <span className="text-destructive font-bold">PENDENTE</span>
                  ) : (
                    <span className="font-semibold">{d.status}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="font-bold text-[10px] mt-3 mb-1">OBSERVAÇÕES:</p>
        <ul className="list-disc list-inside space-y-1 text-[9.5px] leading-relaxed">
          {CL_OBSERVACOES.map((o) => (
            <li key={o} className="underline font-semibold">
              {o}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);
