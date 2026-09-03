import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";
import { REQUISITOS_SENHA, SENHA_MINIMA, validarNovaSenha } from "@/utils/passwordPolicy";

type BtnVariant = "default" | "outline" | "ghost" | "secondary" | "link" | "destructive";
type BtnSize = "default" | "sm" | "lg" | "icon";

export const ChangePasswordButton = ({
  variant = "outline",
  size = "sm",
  className,
  iconOnly = false,
}: { variant?: BtnVariant; size?: BtnSize; className?: string; iconOnly?: boolean } = {}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Mesma política aplicada na redefinição por e-mail (Story 2.4).
    const problema = validarNovaSenha(password, confirm);
    if (problema) {
      toast({ title: "Senha inválida", description: problema, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Senha atualizada com sucesso" });
      setPassword("");
      setConfirm("");
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className} title="Alterar senha">
          <KeyRound size={16} className={iconOnly ? "" : "mr-2"} />
          {!iconOnly && "Alterar senha"}
        </Button>

      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary">Alterar senha</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="new-pwd">Nova senha</Label>
            <Input
              id="new-pwd"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={SENHA_MINIMA}
            />
            <p className="mt-1 text-xs text-muted-foreground">{REQUISITOS_SENHA}</p>
          </div>
          <div>
            <Label htmlFor="confirm-pwd">Confirmar nova senha</Label>
            <Input
              id="confirm-pwd"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={SENHA_MINIMA}
            />
          </div>
          <DialogFooter>
            <Button type="submit" variant="gradient" disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
