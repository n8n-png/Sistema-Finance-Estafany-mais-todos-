import { formatCurrency } from './currency';

export const shareViaWhatsApp = (valor: number, prazo: number, taxa: number) => {
  const valorFormatado = formatCurrency(valor);
  const taxaFormatada = taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const mensagem = `Olá! Segue a simulação de crédito solicitada:

- Valor: ${valorFormatado}
- Prazo: ${prazo} meses
- Taxa: ${taxaFormatada}% a.m.

Acabei de gerar o PDF detalhado com o cronograma de parcelas. Posso te enviar por aqui?`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
  window.open(url, '_blank');
};
