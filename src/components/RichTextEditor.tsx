import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { useEffect, useCallback } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Link as LinkIcon, Unlink, RemoveFormatting, Heading1, Heading2, Heading3,
  Pilcrow, Undo2, Redo2, Quote, TableIcon, Plus, Minus, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  className?: string;
  placeholder?: string;
  minHeight?: string;
}

export default function RichTextEditor({
  content,
  onChange,
  className,
  placeholder = "Commencez à rédiger...",
  minHeight = "200px",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ] as any,
    content: content || "",
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none px-4 py-3",
          "prose-headings:font-semibold prose-headings:text-foreground",
          "prose-h1:text-xl prose-h1:mb-3 prose-h1:mt-4",
          "prose-h2:text-lg prose-h2:mb-2 prose-h2:mt-3",
          "prose-h3:text-base prose-h3:mb-2 prose-h3:mt-3",
          "prose-p:my-1.5 prose-p:leading-relaxed",
          "prose-ul:my-2 prose-ul:pl-6 prose-ol:my-2 prose-ol:pl-6",
          "prose-li:my-0.5",
          "prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground",
          "prose-a:text-primary prose-a:underline",
          "prose-table:border-collapse prose-td:border prose-td:border-border prose-td:p-2 prose-th:border prose-th:border-border prose-th:p-2 prose-th:bg-muted prose-th:font-semibold",
        ),
        style: `min-height: ${minHeight}`,
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [content]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL du lien", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-lg border border-input bg-background overflow-hidden shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/30", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1.5 py-1 bg-muted/40">
        <ToolbarButton active={editor.isActive("paragraph") && !editor.isActive("heading")} onClick={() => editor.chain().focus().setParagraph().run()} icon={<Pilcrow className="w-4 h-4" />} label="Paragraphe" />
        <ToolbarButton active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} icon={<Heading1 className="w-4 h-4" />} label="Titre 1" />
        <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} icon={<Heading2 className="w-4 h-4" />} label="Titre 2" />
        <ToolbarButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} icon={<Heading3 className="w-4 h-4" />} label="Titre 3" />

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} icon={<Bold className="w-4 h-4" />} label="Gras (Ctrl+B)" />
        <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} icon={<Italic className="w-4 h-4" />} label="Italique (Ctrl+I)" />
        <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} icon={<UnderlineIcon className="w-4 h-4" />} label="Souligné (Ctrl+U)" />

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} icon={<List className="w-4 h-4" />} label="Liste à puces" />
        <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={<ListOrdered className="w-4 h-4" />} label="Liste numérotée" />
        <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} icon={<Quote className="w-4 h-4" />} label="Citation" />

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <ToolbarButton active={editor.isActive("link")} onClick={setLink} icon={<LinkIcon className="w-4 h-4" />} label="Insérer un lien" />
        <ToolbarButton active={false} onClick={() => editor.chain().focus().unsetLink().run()} icon={<Unlink className="w-4 h-4" />} label="Supprimer le lien" disabled={!editor.isActive("link")} />

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        {/* Table dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn(
              "inline-flex items-center justify-center rounded-md h-8 w-8 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              editor.isActive("table") && "bg-accent text-accent-foreground shadow-sm"
            )}>
              <TableIcon className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
              <Plus className="w-4 h-4 mr-2" /> Insérer un tableau (3×3)
            </DropdownMenuItem>
            {editor.isActive("table") && (
              <>
                <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>
                  <Plus className="w-4 h-4 mr-2" /> Ajouter une colonne
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                  <Plus className="w-4 h-4 mr-2" /> Ajouter une ligne
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>
                  <Minus className="w-4 h-4 mr-2" /> Supprimer la colonne
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                  <Minus className="w-4 h-4 mr-2" /> Supprimer la ligne
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().deleteTable().run()} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Supprimer le tableau
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <ToolbarButton active={false} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} icon={<RemoveFormatting className="w-4 h-4" />} label="Supprimer le formatage" />

        <div className="flex-1" />

        <ToolbarButton active={false} onClick={() => editor.chain().focus().undo().run()} icon={<Undo2 className="w-4 h-4" />} label="Annuler (Ctrl+Z)" disabled={!editor.can().undo()} />
        <ToolbarButton active={false} onClick={() => editor.chain().focus().redo().run()} icon={<Redo2 className="w-4 h-4" />} label="Rétablir (Ctrl+Y)" disabled={!editor.can().redo()} />
      </div>

      {/* Bubble Menu */}
      <BubbleMenu editor={editor} className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg">
        <BubbleButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} icon={<Bold className="w-3.5 h-3.5" />} />
        <BubbleButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} icon={<Italic className="w-3.5 h-3.5" />} />
        <BubbleButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} icon={<UnderlineIcon className="w-3.5 h-3.5" />} />
        <BubbleButton active={editor.isActive("link")} onClick={setLink} icon={<LinkIcon className="w-3.5 h-3.5" />} />
      </BubbleMenu>

      <EditorContent editor={editor} />

      <div className="flex items-center justify-end border-t border-input px-3 py-1 bg-muted/20">
        <span className="text-[11px] text-muted-foreground">
          {editor.storage.characterCount?.characters?.() ?? editor.getText().length} caractères
        </span>
      </div>
    </div>
  );
}

function ToolbarButton({ active, onClick, icon, label, disabled = false }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={cn("inline-flex items-center justify-center rounded-md h-8 w-8 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40 disabled:pointer-events-none", active && "bg-accent text-accent-foreground shadow-sm")} onClick={onClick} disabled={disabled}>
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

function BubbleButton({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button type="button" className={cn("inline-flex items-center justify-center rounded h-7 w-7 text-sm transition-colors hover:bg-accent hover:text-accent-foreground", active && "bg-accent text-accent-foreground")} onClick={onClick}>
      {icon}
    </button>
  );
}
