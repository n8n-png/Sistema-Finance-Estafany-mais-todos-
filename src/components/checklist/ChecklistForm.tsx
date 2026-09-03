import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { ChecklistType } from "@/utils/checklistSchema";
import { AsForm } from "./AsForm";
import { CdtForm } from "./CdtForm";
import { OutorgaForm } from "./OutorgaForm";
import { CartaBacenForm } from "./CartaBacenForm";

interface Props {
  cnpj: string;
  operacaoId?: string | null;
  operacaoLabel?: string;
  defaultType?: ChecklistType;
}

export const ChecklistForm = ({ cnpj, operacaoId, operacaoLabel, defaultType = "as" }: Props) => {
  const [tab, setTab] = useState<ChecklistType>(defaultType);
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as ChecklistType)} className="space-y-4">
      <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto">
        <TabsTrigger value="as">Checklist AS</TabsTrigger>
        <TabsTrigger value="cdt">Checklist CDT</TabsTrigger>
        <TabsTrigger value="outorga">Outorga Uxória</TabsTrigger>
        <TabsTrigger value="bacen">Carta Bacen</TabsTrigger>
      </TabsList>
      <TabsContent value="as" className="mt-2">
        <AsForm cnpj={cnpj} operacaoId={operacaoId} razaoSocial={operacaoLabel} />
      </TabsContent>
      <TabsContent value="cdt" className="mt-2">
        <CdtForm cnpj={cnpj} operacaoId={operacaoId} razaoSocial={operacaoLabel} />
      </TabsContent>
      <TabsContent value="outorga" className="mt-2">
        <OutorgaForm cnpj={cnpj} operacaoId={operacaoId} razaoSocial={operacaoLabel} />
      </TabsContent>
      <TabsContent value="bacen" className="mt-2">
        <CartaBacenForm cnpj={cnpj} operacaoId={operacaoId} razaoSocial={operacaoLabel} />
      </TabsContent>
    </Tabs>
  );
};
