import { useState } from "react";
import { CreditHeader } from "@/components/CreditHeader";
import { EstabelecimentosList, EstabelecimentoGroup } from "@/components/ativos/EstabelecimentosList";
import { EstabelecimentoOperacoes } from "@/components/ativos/EstabelecimentoOperacoes";
import { AtivoDetalhes } from "@/components/ativos/AtivoDetalhes";
import { OperacaoAtiva } from "@/hooks/useOperacoesAtivas";
import { HomeFooter } from "@/components/home/HomeFooter";

const Ativos = () => {
  const [estabelecimento, setEstabelecimento] = useState<EstabelecimentoGroup | null>(null);
  const [operacao, setOperacao] = useState<OperacaoAtiva | null>(null);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <CreditHeader title="Operações Ativas" />
      <div className="container mx-auto px-4 py-6 max-w-4xl flex-1">
        {!estabelecimento && !operacao && (
          <EstabelecimentosList onSelect={setEstabelecimento} />
        )}
        {estabelecimento && !operacao && (
          <EstabelecimentoOperacoes
            grupo={estabelecimento}
            onSelectOperacao={setOperacao}
            onBack={() => setEstabelecimento(null)}
          />
        )}
        {operacao && (
          <AtivoDetalhes operacao={operacao} onBack={() => setOperacao(null)} />
        )}
      </div>
      <HomeFooter />
    </div>
  );
};

export default Ativos;
