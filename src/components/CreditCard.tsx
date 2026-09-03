import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface CreditCardProps {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  description?: string;
  badge?: string;
}

export const CreditCard = ({ title, onClick, disabled = false, icon: Icon, description, badge }: CreditCardProps) => {
  return (
    <Card
      className={`relative overflow-hidden bg-card border border-border p-6 min-h-[220px]
                  flex flex-col items-center justify-center text-center shadow-card transition-all duration-300
                  ${disabled
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:-translate-y-1 hover:shadow-card-hover hover:border-primary group"
                  }`}
      onClick={disabled ? undefined : onClick}
    >
      {/* Barra superior roxa - estrutura institucional */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-secondary" />
      {/* "Sorriso" verde - acento pontual que aparece no hover */}
      <div
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-1 bg-secondary transition-all duration-300
                    ${disabled ? "w-0" : "w-0 group-hover:w-16"}`}
      />

      {badge && (
        <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
          {badge}
        </span>
      )}

      {Icon && (
        <div className="mb-4 w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center transition-all duration-300 group-hover:bg-primary/10 group-hover:scale-110">
          <Icon size={28} className={disabled ? "text-muted-foreground" : "text-primary"} strokeWidth={2} />
        </div>
      )}

      <h2
        className={`text-base md:text-lg font-display font-bold leading-tight transition-colors
                   ${disabled ? "text-muted-foreground" : "text-primary"}`}
      >
        {title}
      </h2>
      {description && !disabled && (
        <p className="text-xs text-muted-foreground mt-2 max-w-[220px]">{description}</p>
      )}
      {disabled && <p className="text-sm text-muted-foreground mt-2">Em breve</p>}
    </Card>
  );
};
