import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { ResizableImage } from "@/components/editor/ResizableImageExtension";
import TextAlign from "@tiptap/extension-text-align";
import ImageToolbar from "@/components/editor/ImageToolbar";
import CharacterCount from "@tiptap/extension-character-count";
import { useEffect, useCallback, useRef } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Link as LinkIcon, Unlink, RemoveFormatting, Heading1, Heading2, Heading3, Heading4,
  Pilcrow, Undo2, Redo2, Quote, TableIcon, Plus, Minus, Trash2,
  ImageIcon, AlignLeft, AlignCenter, AlignRight, Eye, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Toggle } from "@/components/ui/toggle";
import { useState } from "react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  className?: string;
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
}

export default function RichTextEditor({
  content,
  onChange,
  className,
  placeholder = "Commencez à rédiger...",
  minHeight = "200px",
  readOnly = false,
}: RichTextEditorProps) {
  const [viewMode, setViewMode] = useState<"edit" | "preview">(readOnly ? "preview" : "edit");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
          HTMLAttributes: {
            class: "tiptap-bullet-list",
          },
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
          HTMLAttributes: {
            class: "tiptap-ordered-list",
          },
        },
        listItem: {
          HTMLAttributes: {
            class: "tiptap-list-item",
          },
        },
        dropcursor: {
          color: "hsl(var(--primary))",
          width: 2,
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      Placeholder.configure({ placeholder }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "tiptap-table",
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: "tiptap-table-row",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "tiptap-table-cell",
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: "tiptap-table-header",
        },
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: "tiptap-image",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph", "image"],
      }),
      CharacterCount,
    ],
    content: content || "",
    editable: viewMode === "edit" && !readOnly,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor-content",
        style: `min-height: ${minHeight}`,
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files.length > 0) {
          const files = Array.from(event.dataTransfer.files).filter(f => f.type.startsWith("image/"));
          if (files.length > 0) {
            event.preventDefault();
            files.forEach(file => insertImageFile(file));
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) insertImageFile(file);
              return true;
            }
          }
        }
        return false;
      },
    },
  });

  const insertImageFile = useCallback((file: File) => {
    if (!editor) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) {
        editor.chain().focus().setImage({ src }).run();
      }
    };
    reader.readAsDataURL(file);
  }, [editor]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [content]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(viewMode === "edit" && !readOnly);
    }
  }, [viewMode, readOnly, editor]);

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

  const insertImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !editor) return;
    Array.from(files).forEach(file => {
      if (file.type.startsWith("image/")) {
        insertImageFile(file);
      }
    });
    e.target.value = "";
  }, [editor, insertImageFile]);

  const insertImageFromUrl = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL de l'image");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const chain = () => editor.chain().focus();

  const isPreview = viewMode === "preview";

  return (
    <div className={cn(
      "tiptap-editor-wrapper rounded-lg border border-input bg-background overflow-hidden shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/30",
      className
    )}>
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1.5 py-1 bg-muted/40">
          {/* View mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center justify-center rounded-md h-8 px-2 text-xs gap-1 transition-colors",
                  isPreview
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
                onClick={() => setViewMode(isPreview ? "edit" : "preview")}
              >
                {isPreview ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                {isPreview ? "Aperçu" : "Éditer"}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isPreview ? "Passer en mode édition" : "Voir l'aperçu"}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-0.5 h-6" />

          {!isPreview && (
            <>
              {/* Block type */}
              <ToolbarButton active={editor.isActive("paragraph") && !editor.isActive("heading")} onClick={() => chain().setParagraph().run()} icon={<Pilcrow className="w-4 h-4" />} label="Paragraphe" />
              <ToolbarButton active={editor.isActive("heading", { level: 1 })} onClick={() => chain().toggleHeading({ level: 1 }).run()} icon={<Heading1 className="w-4 h-4" />} label="Titre 1" />
              <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()} icon={<Heading2 className="w-4 h-4" />} label="Titre 2" />
              <ToolbarButton active={editor.isActive("heading", { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()} icon={<Heading3 className="w-4 h-4" />} label="Titre 3" />
              <ToolbarButton active={editor.isActive("heading", { level: 4 })} onClick={() => chain().toggleHeading({ level: 4 }).run()} icon={<Heading4 className="w-4 h-4" />} label="Titre 4" />

              <Separator orientation="vertical" className="mx-0.5 h-6" />

              {/* Inline formatting */}
              <ToolbarButton active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()} icon={<Bold className="w-4 h-4" />} label="Gras (Ctrl+B)" />
              <ToolbarButton active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()} icon={<Italic className="w-4 h-4" />} label="Italique (Ctrl+I)" />
              <ToolbarButton active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()} icon={<UnderlineIcon className="w-4 h-4" />} label="Souligné (Ctrl+U)" />

              <Separator orientation="vertical" className="mx-0.5 h-6" />

              {/* Lists */}
              <ToolbarButton active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()} icon={<List className="w-4 h-4" />} label="Liste à puces" />
              <ToolbarButton active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()} icon={<ListOrdered className="w-4 h-4" />} label="Liste numérotée" />
              <ToolbarButton active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()} icon={<Quote className="w-4 h-4" />} label="Citation" />

              <Separator orientation="vertical" className="mx-0.5 h-6" />

              {/* Alignment */}
              <ToolbarButton active={editor.isActive({ textAlign: "left" })} onClick={() => chain().setTextAlign("left").run()} icon={<AlignLeft className="w-4 h-4" />} label="Aligner à gauche" />
              <ToolbarButton active={editor.isActive({ textAlign: "center" })} onClick={() => chain().setTextAlign("center").run()} icon={<AlignCenter className="w-4 h-4" />} label="Centrer" />
              <ToolbarButton active={editor.isActive({ textAlign: "right" })} onClick={() => chain().setTextAlign("right").run()} icon={<AlignRight className="w-4 h-4" />} label="Aligner à droite" />

              <Separator orientation="vertical" className="mx-0.5 h-6" />

              {/* Links */}
              <ToolbarButton active={editor.isActive("link")} onClick={setLink} icon={<LinkIcon className="w-4 h-4" />} label="Insérer un lien" />
              <ToolbarButton active={false} onClick={() => chain().unsetLink().run()} icon={<Unlink className="w-4 h-4" />} label="Supprimer le lien" disabled={!editor.isActive("link")} />

              <Separator orientation="vertical" className="mx-0.5 h-6" />

              {/* Image */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="inline-flex items-center justify-center rounded-md h-8 w-8 text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                    <ImageIcon className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={insertImage}>
                    <Plus className="w-4 h-4 mr-2" /> Télécharger une image
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={insertImageFromUrl}>
                    <LinkIcon className="w-4 h-4 mr-2" /> Image depuis une URL
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Table */}
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
                  <DropdownMenuItem onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                    <Plus className="w-4 h-4 mr-2" /> Tableau 3×3
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => chain().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()}>
                    <Plus className="w-4 h-4 mr-2" /> Tableau 2×2
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => chain().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run()}>
                    <Plus className="w-4 h-4 mr-2" /> Tableau 4×4
                  </DropdownMenuItem>
                  {editor.isActive("table") && (
                    <>
                      <Separator className="my-1" />
                      <DropdownMenuItem onClick={() => chain().addColumnAfter().run()}>
                        <Plus className="w-4 h-4 mr-2" /> Ajouter une colonne
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => chain().addRowAfter().run()}>
                        <Plus className="w-4 h-4 mr-2" /> Ajouter une ligne
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => chain().deleteColumn().run()}>
                        <Minus className="w-4 h-4 mr-2" /> Supprimer la colonne
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => chain().deleteRow().run()}>
                        <Minus className="w-4 h-4 mr-2" /> Supprimer la ligne
                      </DropdownMenuItem>
                      <Separator className="my-1" />
                      <DropdownMenuItem onClick={() => chain().deleteTable().run()} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Supprimer le tableau
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Separator orientation="vertical" className="mx-0.5 h-6" />

              <ToolbarButton active={false} onClick={() => chain().clearNodes().unsetAllMarks().run()} icon={<RemoveFormatting className="w-4 h-4" />} label="Supprimer le formatage" />

              <div className="flex-1" />

              <ToolbarButton active={false} onClick={() => chain().undo().run()} icon={<Undo2 className="w-4 h-4" />} label="Annuler (Ctrl+Z)" disabled={!editor.can().undo()} />
              <ToolbarButton active={false} onClick={() => chain().redo().run()} icon={<Redo2 className="w-4 h-4" />} label="Rétablir (Ctrl+Y)" disabled={!editor.can().redo()} />
            </>
          )}
        </div>
      )}

      {/* Bubble Menu for text - only in edit mode */}
      {!isPreview && !readOnly && (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg"
          shouldShow={({ editor }) => {
            // Don't show text bubble menu when image is selected
            if (editor.isActive("image")) return false;
            return editor.state.selection.content().size > 0;
          }}
        >
          <BubbleButton active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()} icon={<Bold className="w-3.5 h-3.5" />} />
          <BubbleButton active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()} icon={<Italic className="w-3.5 h-3.5" />} />
          <BubbleButton active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()} icon={<UnderlineIcon className="w-3.5 h-3.5" />} />
          <BubbleButton active={editor.isActive("link")} onClick={setLink} icon={<LinkIcon className="w-3.5 h-3.5" />} />
        </BubbleMenu>
      )}

      {/* Image toolbar - shows when an image is selected */}
      {!isPreview && !readOnly && editor.isActive("image") && (
        <div className="flex justify-center py-1 px-2 border-b border-input bg-muted/30">
          <ImageToolbar editor={editor} />
        </div>
      )}

      <EditorContent editor={editor} />

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-input px-3 py-1 bg-muted/20">
        <span className="text-[11px] text-muted-foreground">
          {isPreview ? "Mode lecture" : "Mode édition"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {editor.storage.characterCount?.characters() ?? 0} caractères · {editor.storage.characterCount?.words() ?? 0} mots
        </span>
      </div>
    </div>
  );
}

function ToolbarButton({ active, onClick, icon, label, disabled = false }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-md h-8 w-8 text-sm transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:opacity-40 disabled:pointer-events-none",
            active && "bg-accent text-accent-foreground shadow-sm"
          )}
          onClick={onClick}
          disabled={disabled}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

function BubbleButton({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded h-7 w-7 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground"
      )}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
