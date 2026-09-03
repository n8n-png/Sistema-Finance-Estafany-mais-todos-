import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface AmortizationRow {
  month: number;
  dueDate?: string;
  payment: string;
  interest: string;
  principal: string;
  balance: string;
  isGracePeriod?: boolean;
  businessDays?: number;
  accumulatedBusinessDays?: number;
}

interface AmortizationTableProps {
  data: AmortizationRow[];
  totals?: {
    totalPayments: string;
    totalInterest: string;
    totalPrincipal: string;
  };
}

export const AmortizationTable = ({ data, totals }: AmortizationTableProps) => {
  const showBusinessDays = data.length > 0 && data[0]?.businessDays !== undefined;

  return (
    <Card className="w-full max-w-6xl mx-auto p-4">
      <ScrollArea className="h-[600px] w-full">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="bg-primary">
              <TableHead className="text-primary-foreground font-bold text-center">Mês</TableHead>
              <TableHead className="text-primary-foreground font-bold text-center">Vencimento</TableHead>
              <TableHead className="text-primary-foreground font-bold text-center">Parcela</TableHead>
              <TableHead className="text-primary-foreground font-bold text-center">Juros</TableHead>
              <TableHead className="text-primary-foreground font-bold text-center">Amortização</TableHead>
              <TableHead className="text-primary-foreground font-bold text-center">Saldo Devedor</TableHead>
              {showBusinessDays && (
                <>
                  <TableHead className="text-primary-foreground font-bold text-center text-xs">Dias Úteis</TableHead>
                  <TableHead className="text-primary-foreground font-bold text-center text-xs">D.U. Acum.</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow 
                key={row.month} 
                className={row.isGracePeriod ? "bg-accent/50" : ""}
              >
                <TableCell className="text-center font-medium">{row.month}</TableCell>
                <TableCell className="text-center">{row.dueDate || '-'}</TableCell>
                <TableCell className="text-center">{row.payment}</TableCell>
                <TableCell className="text-center">{row.interest}</TableCell>
                <TableCell className="text-center">{row.principal}</TableCell>
                <TableCell className="text-center font-semibold">{row.balance}</TableCell>
                {showBusinessDays && (
                  <>
                    <TableCell className="text-center text-xs text-muted-foreground">{row.businessDays}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{row.accumulatedBusinessDays}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
            
            {totals && (
              <TableRow className="bg-muted font-bold">
                <TableCell className="text-center">Total</TableCell>
                <TableCell className="text-center">-</TableCell>
                <TableCell className="text-center">{totals.totalPayments}</TableCell>
                <TableCell className="text-center">{totals.totalInterest}</TableCell>
                <TableCell className="text-center">{totals.totalPrincipal}</TableCell>
                <TableCell className="text-center">-</TableCell>
                {showBusinessDays && (
                  <>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-center">-</TableCell>
                  </>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
};