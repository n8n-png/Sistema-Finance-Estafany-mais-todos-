
interface CreditHeaderProps {
  title: string;
  subtitle?: string;
}

export const CreditHeader = ({ title, subtitle }: CreditHeaderProps) => {
  return (
    <header className="bg-background">
      <div className="container mx-auto px-6 pt-6 pb-3">
        <h1 className="text-2xl font-display font-bold text-foreground text-left">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground font-normal">{subtitle}</p>
        )}

      </div>
      <div className="container mx-auto px-6">
        <div className="h-px w-full bg-border" />
      </div>
    </header>
  );
};
