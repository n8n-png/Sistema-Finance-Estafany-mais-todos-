import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, FileText, Loader2 } from "lucide-react";

interface Props {
  onPdf: () => Promise<void> | void;
  onDocx: () => Promise<void> | void;
  pdfLabel?: string;
  docxLabel?: string;
}

export const ExportButtons = ({
  onPdf,
  onDocx,
  pdfLabel = "Baixar PDF",
  docxLabel = "Baixar Word (DOCX)",
}: Props) => {
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);

  const run = async (kind: "pdf" | "docx", fn: () => Promise<void> | void) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button
        onClick={() => run("pdf", onPdf)}
        disabled={busy !== null}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {busy === "pdf" ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4 mr-2" />
        )}
        {pdfLabel}
      </Button>
      <Button
        variant="outline"
        onClick={() => run("docx", onDocx)}
        disabled={busy !== null}
        className="w-full"
      >
        {busy === "docx" ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileText className="h-4 w-4 mr-2" />
        )}
        {docxLabel}
      </Button>
    </div>
  );
};
