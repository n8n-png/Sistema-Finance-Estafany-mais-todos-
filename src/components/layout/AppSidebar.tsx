import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import {
  CreditCard as CreditCardIcon,
  Eye,
  HeartPulse,
  Sprout,
  ListChecks,
  Briefcase,
  ClipboardList,
  Landmark,
  Settings,
  LogOut,
  Store,
  Wrench,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useMyPageAccess } from "@/hooks/usePageAccess";
import { ChangePasswordButton } from "@/components/ChangePasswordButton";
import logo from "@/assets/maistodos-logo.png";

const comercial = [
  { key: "qia", label: "QIA", to: "/?calc=qia", icon: CreditCardIcon },
  { key: "recebiveis", label: "Visão de Todos", to: "/?calc=recebiveis", icon: Eye },
  { key: "amor_saude", label: "Amor Saúde", to: "/?calc=amorSaude", icon: HeartPulse },
  { key: "expansao_amor_saude", label: "Expansão", to: "/?calc=expansaoAmorSaude", icon: Sprout },
  { key: "limites", label: "Consultar Limites", to: "/?calc=limitesList", icon: ListChecks },
];

const operacional = [
  { key: "ativos", label: "Operações Ativas", to: "/ativos", icon: Briefcase },
  { key: "central_documentos", label: "Central de Documentos", to: "/central-documentos", icon: ClipboardList },
];

type Item = { key: string; label: string; to: string; icon: typeof Eye };

export const AppSidebar = () => {
  const collapsed = false;
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAdmin, signOut } = useAuth();
  const { keys } = useMyPageAccess();
  const can = (k: string) => keys.has(k);
  const [openFlyout, setOpenFlyout] = useState<string | null>(null);

  const currentCalc = pathname === "/" ? searchParams.get("calc") : null;
  const isActiveLink = (to: string) => {
    if (to.startsWith("/?calc=")) return currentCalc === to.split("=")[1];
    return pathname === to;
  };

  const Flyout = ({
    id,
    label,
    icon: Icon,
    items,
  }: {
    id: string;
    label: string;
    icon: typeof Eye;
    items: Item[];
  }) => {
    const visible = items.filter((i) => can(i.key));
    if (visible.length === 0) return null;
    const groupActive = visible.some((i) => isActiveLink(i.to));
    const open = openFlyout === id || groupActive;

    return (
      <div className="space-y-1">
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={groupActive}
            tooltip={collapsed ? label : undefined}
            onClick={() => setOpenFlyout(openFlyout === id ? null : id)}
            className="h-11 rounded-lg px-4 font-body text-sm font-medium text-sidebar-foreground/80 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
          >
            <Icon className="h-[18px] w-[18px]" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{label}</span>
                <ChevronRight
                  className={`h-4 w-4 opacity-60 transition-transform ${open ? "rotate-90" : ""}`}
                />
              </>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>

        {open && !collapsed && (
          <div className="mb-1 ml-6 space-y-1 border-l border-sidebar-foreground/25 pl-2">
            {visible.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                className={`flex min-h-8 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-body font-medium transition-colors ${
                  isActiveLink(item.to)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );

  };

  return (
    <Sidebar collapsible="none" className="min-h-screen border-r-0">
      <SidebarHeader className="border-b border-sidebar-foreground/15 p-6">
        <NavLink to="/" className="flex items-center justify-center rounded-lg">
          <img
            src={logo}
            alt="MaisTODOS"
            className={`${collapsed ? "h-6" : "h-20"} w-auto brightness-0 invert`}
          />
        </NavLink>
        {!collapsed && (
          <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/50">
            Painel de Crédito PJ
          </p>
        )}
      </SidebarHeader>


      <SidebarContent className="no-scrollbar px-4 py-4">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              <Flyout id="comercial" label="Rotina Comercial" icon={Store} items={comercial} />
              <Flyout id="operacional" label="Rotina Operacional" icon={Wrench} items={operacional} />

              {can("operacoes_valora") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/operacoes-valora"}
                    tooltip="Operações em Formalização"
                    className="h-11 rounded-lg px-4 font-body text-sm font-medium text-sidebar-foreground/80 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                  >
                    <NavLink to="/operacoes-valora" className="flex items-center gap-2 font-body">
                      <Landmark className="h-[18px] w-[18px]" />
                      {!collapsed && <span>Operações em Formalização</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin")}
                    tooltip="Admin"
                    className="h-11 rounded-lg px-4 font-body text-sm font-medium text-sidebar-foreground/80 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                  >
                    <NavLink to="/admin/limites" className="flex items-center gap-2 font-body">
                      <Settings className="h-[18px] w-[18px]" />
                      {!collapsed && <span>Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              <SidebarMenuItem>
                <ChangePasswordButton
                  variant="ghost"
                  size="sm"
                  className={
                    collapsed
                      ? "h-8 w-8 justify-center p-0 text-sidebar-foreground"
                      : "h-11 w-full justify-start gap-3 rounded-lg px-4 font-body text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                  }
                  iconOnly={collapsed}
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-foreground/15 p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sair"
              className="h-11 rounded-lg px-4 font-body text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
              onClick={() => signOut().then(() => navigate("/auth"))}
            >
              <LogOut className="h-[18px] w-[18px]" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
