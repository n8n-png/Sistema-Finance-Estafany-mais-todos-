export const HomeFooter = () => {
  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="font-display font-extrabold text-primary text-lg">
              Mais<span className="text-secondary">TODOS</span>
            </p>

            <p className="text-xs text-muted-foreground">
              Soluções Financeiras Inteligentes
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            Painel de Crédito PJ · Uso restrito à equipe MaisTODOS
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MaisTODOS. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};
