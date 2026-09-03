import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";


interface Props {
  cnpj: string;
  nomeCliente: string;
  grupo: string;
  socios: string;
  totalComCarencia: number;
  totalSemCarencia: number;
  tipoGarantia: string;
  valorSimulado: number;
  taxaJuros: number;
  numeroParcelas: number;
  carencia: number;
}

export const SolicitarAnaliseButton = ({
  cnpj,
  nomeCliente,
  grupo,
  socios,
  totalComCarencia,
  totalSemCarencia,
  tipoGarantia,
  valorSimulado,
  taxaJuros,
  numeroParcelas,
  carencia,
}: Props) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("forward-to-n8n", {
        body: {
          cnpj,
          nome_cliente: nomeCliente,
          grupo,
          socios,
          total_com_carencia: totalComCarencia,
          total_sem_carencia: totalSemCarencia,
          tipo_garantia: tipoGarantia,
          valor_simulado: valorSimulado,
          taxa_juros: taxaJuros,
          numero_parcelas: numeroParcelas,
          carencia,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Análise solicitada com sucesso! Os dados foram enviados ao CRM.");
    } catch (err) {
      console.error("Erro ao enviar para webhook:", err);
      toast.error("Não foi possível enviar a solicitação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="success" size="lg" onClick={handleClick} disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="mr-2 animate-spin" size={20} />
          Enviando...
        </>
      ) : (
        <>
          <Send className="mr-2" size={20} />
          Solicitar Análise de Crédito
        </>
      )}
    </Button>
  );
};
