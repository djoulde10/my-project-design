import { Editor } from "@tiptap/react";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { cn } from "@/lib/utils";

const alignments = [
  { icon: AlignLeft, value: "left", label: "Gauche" },
  { icon: AlignCenter, value: "center", label: "Centre" },
  { icon: AlignRight, value: "right", label: "Droite" },
];

interface ImageToolbarProps {
  editor: Editor;
}

export default function ImageToolbar({ editor }: ImageToolbarProps) {
  const attrs = editor.getAttributes("image");
  const currentAlignment = attrs.alignment || "center";

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-lg">
      {alignments.map(({ icon: Icon, value, label }) => (
        <button
          key={value}
          type="button"
          title={label}
          className={cn(
            "inline-flex items-center justify-center rounded h-7 w-7 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
            currentAlignment === value && "bg-accent text-accent-foreground"
          )}
          onClick={() => (editor.commands as any).setImageAlignment(value)}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
      <div className="w-px h-5 bg-border mx-0.5" />
      <span className="text-[11px] text-muted-foreground px-1">
        Glissez les poignées pour redimensionner
      </span>
    </div>
  );
}
