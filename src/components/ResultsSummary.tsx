import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface SummaryItem {
  label: string;
  value: string;
  tooltip?: string;
}

interface ResultsSummaryProps {
  title: string;
  items: SummaryItem[];
}

export const ResultsSummary = ({ title, items }: ResultsSummaryProps) => {
  return (
    <Card className="bg-gradient-subtle border-l-4 border-l-secondary p-6 w-full max-w-4xl mx-auto">
      <h3 className="text-xl font-bold text-primary mb-4">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item, index) => (
          <div key={index} className="flex items-center py-2 border-b border-border/30 last:border-b-0">
            <span className="font-medium text-foreground w-1/2 flex items-center gap-1.5">
              {item.label}:
              {item.tooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </span>
            <span className="font-bold text-primary w-1/2">{item.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};