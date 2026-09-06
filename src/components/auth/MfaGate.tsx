import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";
import { estadoMfa, verificarCodigo, type EstadoMfa } from "@/services/mfa";

/**
 * Barreira do segundo fator — Story 2.3.
 *
 * Fica entre a sessão autenticada e o conteúdo: se a conta tem segundo fator
 * cadastrado e a sessão ainda não passou por ele, nada do painel é exibido até
 * o código ser digitado.
 *
 * Por que aqui e não dentro de cada tela: a proteção precisa valer para todas as
 * rotas, inclusive as que forem criadas depois. Deixar a verificação por tela é
 * garantir que uma tela nova nasça desprotegida.
 *
 * Vale dizer o que este componente **não** faz: ele esconde a interface, não os
 * dados. Quem já tem um token de sessão consegue chamar a API mesmo sem passar
 * daqui. A proteção real do dado é a RLS no banco — esta camada existe para o
 * fluxo de uso normal, não para conter quem manipula requisições.
 */
export const MfaGate = ({ children }: { children: React.ReactNode }) => {
  const { toast } = useToast();
  const [estado, setEstado] = useState<EstadoMfa | null>(null);
  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    void estadoMfa().then(setEstado);
  }, []);

  // Enquanto não se sabe o estado, não libera nem bloqueia — evita o piscar de
  // conteúdo protegido enquanto a verificação acontece.
  if (!estado) return null;

  if (!estado.precisaVerificar || !estado.factorId) return <>{children}</>;

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = codigo.replace(/\D/g, "");
    if (limpo.length !== 6) {
      toast({ title: "Digite os 6 dígitos do código", variant: "destructive" });
      return;
    }
    setVerificando(true);
    try {
      await verificarCodigo(estado.factorId!, limpo);
      setEstado(await estadoMfa());
    } catch (err: unknown) {
      toast({
        title: "Código inválido",
        description:
          err instanceof Error && err.message
            ? err.message
            : "Confira o código no aplicativo e tente de novo.",
        variant: "destructive",
      });
      setCodigo("");
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center">
          <ShieldCheck className="mb-3 h-10 w-10 text-primary" />
          <h1 className="text-xl font-display font-extrabold text-primary">
            Verificação em duas etapas
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Abra seu aplicativo autenticador e digite o código de 6 dígitos.
          </p>
        </div>

        <form onSubmit={confirmar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-codigo">Código</Label>
            <Input
              id="mfa-codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-[0.5em]"
              placeholder="000000"
              autoFocus
            />
          </div>
          <Button type="submit" variant="gradient" className="w-full" disabled={verificando}>
            {verificando ? "Verificando..." : "Confirmar"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Perdeu o acesso ao aplicativo? Fale com o administrador do painel.
        </p>
      </div>
    </div>
  );
};
