import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const resizableImagePluginKey = new PluginKey("resizableImage");

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("width") || element.style.width || null,
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.width) return {};
          return { width: attributes.width, style: `width: ${attributes.width}px` };
        },
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("height") || element.style.height || null,
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.height) return {};
          return { height: attributes.height, style: `height: ${attributes.height}px` };
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
      {
        tag: "figure.tiptap-image-wrapper img",
        getAttrs: (node: string | HTMLElement) => {
          if (typeof node === "string") return false;
          return {};
        },
      },
      {
        tag: "img[src]",
      },
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

  addProseMirrorPlugins() {
    const extensionThis = this;
    return [
      new Plugin({
        key: resizableImagePluginKey,
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              const target = event.target as HTMLElement;
              if (!target.classList.contains("image-resize-handle")) return false;

              event.preventDefault();
              event.stopPropagation();

              const handle = target.dataset.handle as string;
              const wrapper = target.closest(".tiptap-image-resize-container") as HTMLElement;
              if (!wrapper) return false;

              const img = wrapper.querySelector("img") as HTMLImageElement;
              if (!img) return false;

              const startX = event.clientX;
              const startY = event.clientY;
              const startWidth = img.getBoundingClientRect().width;
              const startHeight = img.getBoundingClientRect().height;
              const aspectRatio = startWidth / startHeight;

              const onMouseMove = (e: MouseEvent) => {
                let newWidth = startWidth;
                let newHeight = startHeight;

                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                if (handle.includes("right")) {
                  newWidth = Math.max(50, startWidth + dx);
                } else if (handle.includes("left")) {
                  newWidth = Math.max(50, startWidth - dx);
                }

                if (handle.includes("bottom")) {
                  newHeight = Math.max(50, startHeight + dy);
                } else if (handle.includes("top")) {
                  newHeight = Math.max(50, startHeight - dy);
                }

                // Corner handles maintain aspect ratio
                if (handle.length > 2) {
                  // e.g. "se", "nw"
                  if (Math.abs(dx) > Math.abs(dy)) {
                    newHeight = newWidth / aspectRatio;
                  } else {
                    newWidth = newHeight * aspectRatio;
                  }
                }

                img.style.width = `${Math.round(newWidth)}px`;
                img.style.height = `${Math.round(newHeight)}px`;
              };

              const onMouseUp = (e: MouseEvent) => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                document.body.style.cursor = "";
                document.body.style.userSelect = "";

                const finalWidth = Math.round(img.getBoundingClientRect().width);
                const finalHeight = Math.round(img.getBoundingClientRect().height);

                // Find the node position and update attributes
                const { state } = view;
                const { selection } = state;
                const pos = selection.from;

                view.dispatch(
                  state.tr.setNodeMarkup(pos, undefined, {
                    ...state.doc.nodeAt(pos)?.attrs,
                    width: finalWidth,
                    height: finalHeight,
                  })
                );
              };

              document.body.style.cursor = target.style.cursor;
              document.body.style.userSelect = "none";
              document.addEventListener("mousemove", onMouseMove);
              document.addEventListener("mouseup", onMouseUp);

              return true;
            },
          },
          decorations(state) {
            const { doc, selection } = state;
            const decorations: Decoration[] = [];

            doc.descendants((node, pos) => {
              if (node.type.name === extensionThis.name && selection.from === pos) {
                decorations.push(
                  Decoration.widget(pos + 1, () => {
                    // We don't use widget here, we use node decoration
                    return document.createElement("span");
                  })
                );
              }
            });

            return DecorationSet.empty;
          },
        },
      }),
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement("div");
      container.classList.add("tiptap-image-resize-container");
      container.style.display = "inline-block";
      container.style.position = "relative";
      container.style.lineHeight = "0";

      const img = document.createElement("img");
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || "";
      img.classList.add("tiptap-image");
      img.draggable = false;

      if (node.attrs.width) {
        img.style.width = `${node.attrs.width}px`;
      }
      if (node.attrs.height) {
        img.style.height = `${node.attrs.height}px`;
      } else {
        img.style.height = "auto";
      }

      container.appendChild(img);

      // Create resize handles
      const handles = ["nw", "ne", "sw", "se", "n", "s", "e", "w"];
      const handleElements: HTMLElement[] = [];

      handles.forEach((h) => {
        const handle = document.createElement("div");
        handle.classList.add("image-resize-handle", `handle-${h}`);
        handle.dataset.handle = h;
        handle.contentEditable = "false";
        handleElements.push(handle);
        container.appendChild(handle);
      });

      // Show/hide handles on selection
      const showHandles = () =>
        handleElements.forEach((h) => (h.style.display = "block"));
      const hideHandles = () =>
        handleElements.forEach((h) => (h.style.display = "none"));
      hideHandles();

      // Click to select
      container.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof getPos === "function") {
          const pos = getPos();
          if (pos != null) {
            editor.commands.setNodeSelection(pos);
          }
        }
      });

      // Resize via handles
      handleElements.forEach((handle) => {
        handle.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const h = handle.dataset.handle!;
          const startX = event.clientX;
          const startY = event.clientY;
          const startWidth = img.getBoundingClientRect().width;
          const startHeight = img.getBoundingClientRect().height;
          const aspectRatio = startWidth / startHeight;

          const onMouseMove = (e: MouseEvent) => {
            let newWidth = startWidth;
            let newHeight = startHeight;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            const isCorner = h.length === 2;

            if (h.includes("e")) newWidth = Math.max(50, startWidth + dx);
            else if (h.includes("w")) newWidth = Math.max(50, startWidth - dx);

            if (h.includes("s")) newHeight = Math.max(50, startHeight + dy);
            else if (h.includes("n")) newHeight = Math.max(50, startHeight - dy);

            if (isCorner) {
              // Maintain aspect ratio for corners
              newHeight = newWidth / aspectRatio;
            }

            img.style.width = `${Math.round(newWidth)}px`;
            img.style.height = `${Math.round(newHeight)}px`;
          };

          const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";

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

      // Wrapper for alignment
      const figure = document.createElement("figure");
      figure.classList.add("tiptap-image-wrapper");
      const alignment = node.attrs.alignment || "center";
      figure.style.textAlign = alignment;
      figure.setAttribute("data-alignment", alignment);
      figure.appendChild(container);

      return {
        dom: figure,
        contentDOM: null,
        update(updatedNode) {
          if (updatedNode.type.name !== "image") return false;

          img.src = updatedNode.attrs.src;
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

          const newAlignment = updatedNode.attrs.alignment || "center";
          figure.style.textAlign = newAlignment;
          figure.setAttribute("data-alignment", newAlignment);

          return true;
        },
        selectNode() {
          container.classList.add("ProseMirror-selectednode");
          showHandles();
        },
        deselectNode() {
          container.classList.remove("ProseMirror-selectednode");
          hideHandles();
        },
        destroy() {
          // cleanup
        },
      };
    };
  },
});
