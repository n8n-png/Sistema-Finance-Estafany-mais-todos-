import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/maistodos-logo.png";
import { REQUISITOS_SENHA, validarNovaSenha } from "@/utils/passwordPolicy";

/** Extrai a mensagem de um erro desconhecido sem recorrer a `any`. */
const mensagemErro = (err: unknown, padrao: string) =>
  err instanceof Error && err.message ? err.message : padrao;

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  // No login não se valida força de senha — só que algo foi digitado. A política
  // vale na definição da senha (ver passwordPolicy.ts), não na conferência.
  password: z.string().min(1, "Informe a senha").max(72),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Modo de redefinição de senha — Story 2.4.
   *
   * A falha corrigida aqui: o link enviado por "Esqueci minha senha" volta para
   * /auth já com uma sessão válida no fragmento da URL. O código anterior via
   * `user` preenchido e redirecionava direto para a home — ou seja, o link do
   * e-mail funcionava como login automático e a senha nunca era trocada.
   * Qualquer pessoa com acesso à caixa de entrada entrava na conta, e o link
   * continuava valendo.
   *
   * Agora, ao chegar por um link de recuperação, a navegação fica bloqueada até
   * que uma nova senha seja efetivamente definida.
   */
  const [modoRecuperacao, setModoRecuperacao] = useState(
    () => typeof window !== "undefined" && window.location.hash.includes("type=recovery"),
  );
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setModoRecuperacao(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && user && !modoRecuperacao) navigate("/", { replace: true });
  }, [user, loading, modoRecuperacao, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast({ title: "Dados inválidos", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) throw error;
      navigate("/", { replace: true });
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: mensagemErro(err, "Falha na autenticação"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDefinirNovaSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    const problema = validarNovaSenha(novaSenha, confirmaSenha);
    if (problema) {
      toast({ title: "Senha inválida", description: problema, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;

      // Encerra a sessão aberta pelo link e exige login com a senha nova. Assim
      // o acesso passa a depender de saber a senha, não de ter recebido o e-mail.
      await supabase.auth.signOut();
      setModoRecuperacao(false);
      setNovaSenha("");
      setConfirmaSenha("");
      setPassword("");
      toast({
        title: "Senha redefinida",
        description: "Entre novamente usando a nova senha.",
      });
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: mensagemErro(err, "Falha ao redefinir a senha"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) {
      toast({
        title: "Informe seu e-mail",
        description: "Digite o e-mail cadastrado para receber o link de redefinição.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) {
      console.error("[auth] falha ao solicitar redefinição", error);
    }
    // Resposta idêntica com ou sem erro: revelar que o e-mail não existe
    // entregaria a lista de quem tem conta no sistema.
    toast({
      title: "Se o e-mail estiver cadastrado, o link foi enviado",
      description: "Verifique sua caixa de entrada e o spam.",
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 grid lg:grid-cols-2">
        {/* Coluna esquerda — formulário */}
        <div className="flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-sm">
            <div className="flex justify-center mb-10">
              <img src={logo} alt="MaisTODOS" className="h-12 w-auto" />
            </div>

            <h1 className="text-2xl font-display font-extrabold text-primary text-center mb-8">
              Painel de Crédito PJ
            </h1>

            {modoRecuperacao ? (
              <form onSubmit={handleDefinirNovaSenha} className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Defina uma nova senha para concluir a redefinição. Você entrará novamente
                  usando ela.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="nova-senha">Nova senha</Label>
                  <Input
                    id="nova-senha"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">{REQUISITOS_SENHA}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirma-senha">Confirmar nova senha</Label>
                  <Input
                    id="confirma-senha"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmaSenha}
                    onChange={(e) => setConfirmaSenha(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
                  {submitting ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
                  {submitting ? "Aguarde..." : "Entrar"}
                </Button>
              </form>
            )}

            <p className="text-xs text-muted-foreground text-center mt-8">
              Acesso restrito. Solicite credenciais ao administrador.
            </p>
          </div>
        </div>

        {/* Coluna direita — chamada da marca */}
        <div className="hidden lg:flex items-center justify-center bg-primary px-14">
          <p className="max-w-md text-4xl xl:text-5xl font-display font-extrabold leading-tight text-primary-foreground">
            Todo o crédito PJ em um só lugar.{" "}
            <span className="text-secondary">Mais controle, mais resultado.</span>
          </p>
        </div>
      </div>

      <footer className="border-t border-border bg-card py-5 text-center">
        <p className="text-xs text-muted-foreground">
          Painel de Crédito PJ · © {new Date().getFullYear()} MaisTODOS
        </p>
      </footer>
    </div>
  );
};

export default Auth;
