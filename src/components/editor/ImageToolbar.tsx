import { Editor } from "@tiptap/react";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useState } from "react";

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
  const [width, setWidth] = useState(attrs.width ? String(attrs.width) : "");
  const [height, setHeight] = useState(attrs.height ? String(attrs.height) : "");

  useEffect(() => {
    setWidth(attrs.width ? String(attrs.width) : "");
    setHeight(attrs.height ? String(attrs.height) : "");
  }, [attrs.width, attrs.height]);

  const applySize = useCallback(() => {
    const w = parseInt(width);
    const h = parseInt(height);
    if (w > 0 || h > 0) {
      (editor.commands as any).setImageSize(w || undefined, h || undefined);
    }
  }, [editor, width, height]);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-popover p-1.5 shadow-lg flex-wrap">
      {/* Alignment */}
      <div className="flex items-center gap-0.5">
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
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Manual dimensions */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>L</span>
        <Input
          type="number"
          min={30}
          value={width}
          onChange={(e) => setWidth(e.target.value)}
          onBlur={applySize}
          onKeyDown={(e) => e.key === "Enter" && applySize()}
          className="h-6 w-16 text-xs px-1.5 py-0"
        />
        <span>×</span>
        <span>H</span>
        <Input
          type="number"
          min={30}
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          onBlur={applySize}
          onKeyDown={(e) => e.key === "Enter" && applySize()}
          className="h-6 w-16 text-xs px-1.5 py-0"
        />
        <span className="text-[10px]">px</span>
      </div>

      <div className="w-px h-5 bg-border" />

      <span className="text-[11px] text-muted-foreground px-1">
        Glissez les poignées · Shift = ratio libre
      </span>
    </div>
  );
}
