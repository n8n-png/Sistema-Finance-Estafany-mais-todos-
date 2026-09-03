import { ReactNode, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

interface Props {
  numero: number;
  titulo: string;
  complete: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Cartão-acordeão para as etapas do checklist.
 *  Header fica verde e minimizável quando `complete` = true. */
export const SectionCard = ({ numero, titulo, complete, defaultOpen = true, children }: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = complete ? open : true; // seções incompletas ficam sempre abertas

  return (
    <div
      className={`rounded-md border transition-colors ${
        complete
          ? "border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/20"
          : "border-border bg-card"
      }`}
    >
      <button
        type="button"
        onClick={() => complete && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-left ${
          complete ? "cursor-pointer" : "cursor-default"
        }`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0 ${
              complete
                ? "bg-emerald-600 text-white"
                : "bg-primary/10 text-primary"
            }`}
          >
            {complete ? <Check className="h-3.5 w-3.5" /> : numero}
          </span>
          <h4
            className={`text-sm font-semibold truncate ${
              complete ? "text-emerald-800 dark:text-emerald-200" : "text-primary"
            }`}
          >
            {titulo}
          </h4>
        </div>
        {complete && (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-emerald-700 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>}
    </div>
  );
};
