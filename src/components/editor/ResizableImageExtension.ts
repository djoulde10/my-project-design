import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/react";

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width") || element.style.width || null,
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width, style: `width: ${attributes.width}` };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => element.getAttribute("height") || element.style.height || null,
        renderHTML: (attributes) => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
      alignment: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-alignment") || "center",
        renderHTML: (attributes) => {
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
          draggable: "true",
        }),
      ],
    ];
  },

  parseHTML() {
    return [
      {
        tag: "figure.tiptap-image-wrapper img",
        getAttrs: (node) => {
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
        (width: string) =>
        ({ commands }: any) => {
          return commands.updateAttributes(this.name, { width });
        },
    };
  },
});
