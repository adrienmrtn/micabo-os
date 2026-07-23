import * as React from "react";
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** Styles appliqués au contenu riche (édition ET lecture) : titres, listes, gras. */
export const richTextClass =
  "text-sm leading-relaxed [&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:text-xl [&_h1]:font-semibold " +
  "[&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-2 " +
  "[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_a]:underline [&_a]:underline-offset-2";

const POLICES = [
  { label: "Sans", valeur: "" },
  { label: "Serif", valeur: "Georgia, serif" },
  { label: "Mono", valeur: "ui-monospace, monospace" },
];

function BoutonBarre({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      // onMouseDown + preventDefault : garde la sélection dans l'éditeur au clic.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

/**
 * Éditeur de texte riche minimal (gras, italique, souligné, barré, titres, listes,
 * police), sans dépendance : contenteditable + document.execCommand. Le contenu
 * est du HTML, stocké tel quel et réaffiché avec `richTextClass`.
 */
export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Contenu initial posé une seule fois : re-poser innerHTML à chaque frappe
  // ferait sauter le curseur.
  React.useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (commande: string, arg?: string) => {
    document.execCommand(commande, false, arg);
    onChange(ref.current?.innerHTML ?? "");
  };

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
        <BoutonBarre onClick={() => exec("bold")}>
          <Bold className="size-4" />
        </BoutonBarre>
        <BoutonBarre onClick={() => exec("italic")}>
          <Italic className="size-4" />
        </BoutonBarre>
        <BoutonBarre onClick={() => exec("underline")}>
          <Underline className="size-4" />
        </BoutonBarre>
        <BoutonBarre onClick={() => exec("strikeThrough")}>
          <Strikethrough className="size-4" />
        </BoutonBarre>
        <span className="mx-1 h-5 w-px bg-border" />
        <BoutonBarre onClick={() => exec("formatBlock", "H1")}>
          <Heading1 className="size-4" />
        </BoutonBarre>
        <BoutonBarre onClick={() => exec("formatBlock", "H2")}>
          <Heading2 className="size-4" />
        </BoutonBarre>
        <BoutonBarre onClick={() => exec("formatBlock", "P")}>
          <span className="px-0.5 text-xs font-medium">P</span>
        </BoutonBarre>
        <span className="mx-1 h-5 w-px bg-border" />
        <BoutonBarre onClick={() => exec("insertUnorderedList")}>
          <List className="size-4" />
        </BoutonBarre>
        <BoutonBarre onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="size-4" />
        </BoutonBarre>
        <span className="mx-1 h-5 w-px bg-border" />
        <select
          aria-label="police"
          className="h-7 rounded border border-input bg-background px-1 text-xs"
          defaultValue=""
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => exec("fontName", e.target.value)}
        >
          {POLICES.map((p) => (
            <option key={p.label} value={p.valeur}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        className={cn("min-h-52 px-3 py-2 focus:outline-none", richTextClass)}
      />
    </div>
  );
}
