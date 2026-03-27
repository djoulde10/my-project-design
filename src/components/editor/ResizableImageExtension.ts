import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/react";

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const w = element.getAttribute("width") || element.style.width?.replace("px", "");
          return w ? Number(w) : null;
        },
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.width) return {};
          return { width: attributes.width, style: `width: ${attributes.width}px` };
        },
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const h = element.getAttribute("height") || element.style.height?.replace("px", "");
          return h ? Number(h) : null;
        },
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
      alignment: {
        default: "center",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-alignment") || "center",
        renderHTML: (attributes: Record<string, any>) => {
          return { "data-alignment": attributes.alignment || "center" };
        },
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const alignment = HTMLAttributes["data-alignment"] || "center";
    const wrapperStyle =
      alignment === "left"
        ? "text-align: left;"
        : alignment === "right"
        ? "text-align: right;"
        : "text-align: center;";

    return [
      "figure",
      { style: wrapperStyle, class: "tiptap-image-wrapper" },
      [
        "img",
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          class: "tiptap-image",
          draggable: "false",
        }),
      ],
    ];
  },

  parseHTML() {
    return [
      { tag: "figure.tiptap-image-wrapper img" },
      { tag: "img[src]" },
    ];
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlignment:
        (alignment: string) =>
        ({ commands }: any) => {
          return commands.updateAttributes(this.name, { alignment });
        },
      setImageSize:
        (width: number, height?: number) =>
        ({ commands }: any) => {
          const attrs: Record<string, any> = { width };
          if (height) attrs.height = height;
          return commands.updateAttributes(this.name, attrs);
        },
    };
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      // -- Figure wrapper (alignment) --
      const figure = document.createElement("figure");
      figure.classList.add("tiptap-image-wrapper");
      const applyAlignment = (a: string) => {
        figure.style.textAlign = a;
        figure.setAttribute("data-alignment", a);
      };
      applyAlignment(node.attrs.alignment || "center");

      // -- Resize container --
      const container = document.createElement("div");
      container.classList.add("tiptap-image-resize-container");

      // -- Image --
      const img = document.createElement("img");
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || "";
      img.classList.add("tiptap-image");
      img.draggable = false;
      if (node.attrs.width) img.style.width = `${node.attrs.width}px`;
      if (node.attrs.height) img.style.height = `${node.attrs.height}px`;
      else img.style.height = "auto";
      container.appendChild(img);

      // -- Dimension tooltip --
      const tooltip = document.createElement("div");
      tooltip.classList.add("image-resize-tooltip");
      tooltip.style.display = "none";
      container.appendChild(tooltip);

      // -- Resize handles --
      const handlePositions = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
      const handleElements: HTMLElement[] = [];
      handlePositions.forEach((h) => {
        const handle = document.createElement("div");
        handle.classList.add("image-resize-handle", `handle-${h}`);
        handle.dataset.handle = h;
        handle.contentEditable = "false";
        handleElements.push(handle);
        container.appendChild(handle);
      });

      const showHandles = () => handleElements.forEach((h) => (h.style.display = "block"));
      const hideHandles = () => handleElements.forEach((h) => (h.style.display = "none"));
      hideHandles();

      // -- Click to select --
      container.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof getPos === "function") {
          const pos = getPos();
          if (pos != null) editor.commands.setNodeSelection(pos);
        }
      });

      // -- Resize logic --
      handleElements.forEach((handle) => {
        handle.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const h = handle.dataset.handle!;
          const startX = event.clientX;
          const startY = event.clientY;
          const rect = img.getBoundingClientRect();
          const startWidth = rect.width;
          const startHeight = rect.height;
          const aspectRatio = startWidth / startHeight;
          const isCorner = h.length === 2;

          tooltip.style.display = "block";
          const updateTooltip = (w: number, h: number) => {
            tooltip.textContent = `${Math.round(w)} × ${Math.round(h)}`;
          };
          updateTooltip(startWidth, startHeight);

          const onMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            let newWidth = startWidth;
            let newHeight = startHeight;

            // Calculate based on handle direction
            if (h.includes("e")) newWidth = startWidth + dx;
            else if (h.includes("w")) newWidth = startWidth - dx;

            if (h.includes("s")) newHeight = startHeight + dy;
            else if (h.includes("n")) newHeight = startHeight - dy;

            // Proportional resize: corners lock ratio by default, Shift unlocks
            // Side handles: free by default, Shift locks ratio
            if (isCorner) {
              if (!e.shiftKey) {
                // Lock aspect ratio (default for corners)
                const dominant = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
                if (dominant === "x") {
                  newHeight = newWidth / aspectRatio;
                } else {
                  newWidth = newHeight * aspectRatio;
                }
              }
            } else {
              if (e.shiftKey) {
                // Lock aspect ratio when Shift is held for side handles
                if (h === "e" || h === "w") {
                  newHeight = newWidth / aspectRatio;
                } else {
                  newWidth = newHeight * aspectRatio;
                }
              }
            }

            // Enforce minimums
            newWidth = Math.max(30, newWidth);
            newHeight = Math.max(30, newHeight);

            img.style.width = `${Math.round(newWidth)}px`;
            img.style.height = `${Math.round(newHeight)}px`;
            updateTooltip(newWidth, newHeight);
          };

          const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            tooltip.style.display = "none";

            const finalWidth = Math.round(img.getBoundingClientRect().width);
            const finalHeight = Math.round(img.getBoundingClientRect().height);

            if (typeof getPos === "function") {
              const pos = getPos();
              if (pos != null) {
                editor.view.dispatch(
                  editor.state.tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    width: finalWidth,
                    height: finalHeight,
                  })
                );
              }
            }
          };

          document.body.style.cursor = getComputedStyle(handle).cursor;
          document.body.style.userSelect = "none";
          document.addEventListener("mousemove", onMouseMove);
          document.addEventListener("mouseup", onMouseUp);
        });
      });

      figure.appendChild(container);

      return {
        dom: figure,
        contentDOM: null,
        update(updatedNode) {
          if (updatedNode.type.name !== "image") return false;
          img.src = updatedNode.attrs.src;
          img.alt = updatedNode.attrs.alt || "";
          if (updatedNode.attrs.width) {
            img.style.width = `${updatedNode.attrs.width}px`;
          } else {
            img.style.width = "";
          }
          if (updatedNode.attrs.height) {
            img.style.height = `${updatedNode.attrs.height}px`;
          } else {
            img.style.height = "auto";
          }
          applyAlignment(updatedNode.attrs.alignment || "center");
          // Keep node.attrs in sync for future resize operations
          (node as any).attrs = updatedNode.attrs;
          return true;
        },
        selectNode() {
          container.classList.add("ProseMirror-selectednode");
          showHandles();
        },
        deselectNode() {
          container.classList.remove("ProseMirror-selectednode");
          hideHandles();
          tooltip.style.display = "none";
        },
        destroy() {},
      };
    };
  },
});
