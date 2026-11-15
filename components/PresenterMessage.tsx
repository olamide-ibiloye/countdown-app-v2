import parse, { domToReact, Element, type DOMNode } from "html-react-parser";

// Stage and crew views deliberately share this allowlist. Discard attributes and
// unsupported elements so a message cannot run scripts, fetch media or add links.
const tags = new Set([
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "hr",
]);
const options = {
  replace(node: DOMNode) {
    if (!(node instanceof Element)) return;
    if (!tags.has(node.name)) return <></>;
    const Tag = node.name as "p";
    if (node.name === "br" || node.name === "hr") return <Tag />;
    return <Tag>{domToReact(node.children as DOMNode[], options)}</Tag>;
  },
};
export function PresenterMessage({ html }: { html: string }) {
  return <>{parse(html, options)}</>;
}
