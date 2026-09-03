import { CreditHeader } from "@/components/CreditHeader";
import { HomeFooter } from "@/components/home/HomeFooter";
import { ChecklistForm } from "@/components/checklist/ChecklistForm";

const CentralDocumentos = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <CreditHeader title="Central de Documentos Operacionais" />
      <div className="container mx-auto px-4 py-6 flex-1 w-full max-w-7xl">
        <ChecklistForm cnpj="" />
      </div>
      <HomeFooter />
    </div>
  );
};

export default CentralDocumentos;
