import { Editor } from "@tiptap/react";
import { AlignLeft, AlignCenter, AlignRight, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = [
  { label: "25%", value: "25%" },
  { label: "50%", value: "50%" },
  { label: "75%", value: "75%" },
  { label: "100%", value: "100%" },
];

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
  const currentWidth = attrs.width || "100%";

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-lg">
      {/* Alignment */}
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

      {/* Size presets */}
      {sizes.map(({ label, value }) => (
        <button
          key={value}
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded h-7 px-1.5 text-[11px] font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
            currentWidth === value && "bg-accent text-accent-foreground"
          )}
          onClick={() => (editor.commands as any).setImageSize(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
