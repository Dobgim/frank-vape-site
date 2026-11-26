// One-off converter: turns a mirrored page's <main> into a typed React page component.
// Usage: node tools/html-to-tsx.mjs <mirror-site-dir>
import fs from "node:fs";
import path from "node:path";
import { parse, NodeType } from "node-html-parser";

const siteDir = process.argv[2];
if (!siteDir) throw new Error("pass the mirrored site directory");

const PAGES = [
  { file: "about.html", component: "AboutPage" },
  { file: "washington/index.html", component: "WashingtonPage" },
  { file: "kiss-labs/index.html", component: "KissLabsPage" },
  { file: "kiss-labs/what-is-a-pennifer.html", component: "PenniferPage" },
  { file: "terms.html", component: "TermsPage" },
  { file: "privacy.html", component: "PrivacyPage" },
  // 404.html is maintained by hand in src/pages/content/NotFoundPage.tsx (Tailwind version of its inline <style>).
];

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const BLOCKY = new Set(["main", "section", "div", "ul", "ol", "dl", "picture", "figure", "nav", "header", "footer",
  "article", "aside", "details", "table", "thead", "tbody", "tr", "fieldset", "select", "svg", "g"]);
const RENAME = {
  class: "className", for: "htmlFor", tabindex: "tabIndex", srcset: "srcSet", datetime: "dateTime",
  colspan: "colSpan", rowspan: "rowSpan", autocomplete: "autoComplete", inputmode: "inputMode",
  maxlength: "maxLength", readonly: "readOnly", crossorigin: "crossOrigin", viewbox: "viewBox",
  "xlink:href": "xlinkHref", referrerpolicy: "referrerPolicy", allowfullscreen: "allowFullScreen",
};
const KEEP_LOWER = new Set(["fetchpriority"]); // React 18 has no camelCase prop for this.

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function attrName(name) {
  const n = name.toLowerCase();
  if (RENAME[n]) return RENAME[n];
  if (KEEP_LOWER.has(n)) return "__spread__" + n; // emitted as {...{ name: value }}
  if (n.startsWith("aria-") || n.startsWith("data-")) return n;
  if (n.includes("-")) return camel(n);
  return name;
}

function styleObject(css) {
  const parts = css.split(";").map((s) => s.trim()).filter(Boolean).map((decl) => {
    const i = decl.indexOf(":");
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    const key = k.startsWith("--") ? JSON.stringify(k) : camel(k);
    return `${key}: ${JSON.stringify(v)}`;
  });
  return `{{ ${parts.join(", ")} }}`;
}

function decodeAttr(v) {
  return v.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function attrsToJsx(el, tagOut) {
  const out = [];
  for (const [rawName, rawValue] of Object.entries(el.rawAttrs ? el.attributes : {})) {
    const name = attrName(rawName);
    if (name.startsWith("__spread__")) { out.push(`{...{ ${name.slice(10)}: ${JSON.stringify(decodeAttr(rawValue))} }}`); continue; }
    if (name === "style") { out.push(`style=${styleObject(rawValue)}`); continue; }
    if (tagOut === "Link" && rawName === "href") { out.push(`to=${JSON.stringify(decodeAttr(rawValue))}`); continue; }
    if (rawValue === "" && ["open", "hidden", "disabled", "required", "checked", "inert", "defer", "async", "allowFullScreen"].includes(name)) {
      out.push(name === "inert" ? `inert=""` : name);
      continue;
    }
    if (name === "tabIndex") { out.push(`tabIndex={${Number(rawValue)}}`); continue; }
    if (["width", "height"].includes(name) && /^\d+$/.test(rawValue)) { out.push(`${name}={${rawValue}}`); continue; }
    out.push(`${name}=${JSON.stringify(decodeAttr(rawValue))}`);
  }
  return out.length ? " " + out.join(" ") : "";
}

function escapeText(t) {
  return t.replace(/[{}]/g, (c) => `{"${c}"}`).replace(/>/g, "&gt;");
}

let usesLink = false;

function convert(node, parentTag, depth) {
  const pad = "  ".repeat(depth);
  if (node.nodeType === NodeType.COMMENT_NODE) return "";
  if (node.nodeType === NodeType.TEXT_NODE) {
    const raw = node.rawText;
    if (!raw.trim()) {
      if (BLOCKY.has(parentTag)) return "";
      return `{" "}`;
    }
    let t = raw.replace(/\s+/g, " ");
    const lead = t.startsWith(" ") ? `{" "}` : "";
    const trail = t.endsWith(" ") ? `{" "}` : "";
    return lead + escapeText(t.trim()) + trail;
  }
  const tag = node.rawTagName.toLowerCase();
  if (tag === "script" || tag === "noscript") return "";
  let tagOut = tag;
  if (tag === "a") {
    const href = node.getAttribute("href") || "";
    if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/cdn-cgi/")) { tagOut = "Link"; usesLink = true; }
  }
  const attrs = attrsToJsx(node, tagOut);
  if (VOID.has(tag)) return `<${tagOut}${attrs} />`;
  const kids = node.childNodes.map((c) => convert(c, tag, depth + 1)).filter((s) => s !== "");
  if (!kids.length) return `<${tagOut}${attrs}></${tagOut}>`;
  const isBlock = BLOCKY.has(tag);
  if (isBlock) {
    return `<${tagOut}${attrs}>\n${kids.map((k) => pad + "  " + k).join("\n")}\n${pad}</${tagOut}>`;
  }
  return `<${tagOut}${attrs}>${kids.join("")}</${tagOut}>`;
}

fs.mkdirSync("src/pages/content", { recursive: true });
for (const page of PAGES) {
  const html = fs.readFileSync(path.join(siteDir, page.file), "utf8");
  // Cloudflare email obfuscation: restore the plain address the page displays.
  const cleaned = html.replace(/<a href="\/cdn-cgi\/l\/email-protection#([0-9a-f]+)"[^>]*>[\s\S]*?<\/a>/g, (_, hex) => {
    const key = parseInt(hex.slice(0, 2), 16);
    let email = "";
    for (let i = 2; i < hex.length; i += 2) email += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return `<a href="mailto:${email}">${email}</a>`;
  }).replace(/<span class="__cf_email__"[^>]*data-cfemail="([0-9a-f]+)"[^>]*>[\s\S]*?<\/span>/g, (_, hex) => {
    const key = parseInt(hex.slice(0, 2), 16);
    let email = "";
    for (let i = 2; i < hex.length; i += 2) email += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return email;
  });
  const doc = parse(cleaned, { comment: false });
  const main = doc.querySelector("main");
  const title = doc.querySelector("title").text;
  const descEl = doc.querySelector('meta[name="description"]');
  const description = descEl ? descEl.getAttribute("content") : "";
  const bodyType = doc.querySelector("body").getAttribute("data-page-type") || "";
  const cssLinks = doc.querySelectorAll('link[rel="stylesheet"]').map((l) => l.getAttribute("href"))
    .filter((h) => h.startsWith("/assets/css/")).map((h) => h.split("?")[0].replace("/assets/css/", ""));
  usesLink = false;
  const jsx = convert(main, "", 2);
  const decode = (s) => parse(`<p>${s}</p>`).text;
  const file = `// Generated by tools/html-to-tsx.mjs from gimmemwah.com/${page.file.replace(/index\.html$/, "").replace(/\.html$/, "")}
// Page stylesheets on the source site: ${cssLinks.join(", ")}
${usesLink ? 'import { Link } from "react-router-dom";\n' : ""}import { usePageMeta } from "../../hooks/usePageMeta";

export default function ${page.component}() {
  usePageMeta(${JSON.stringify(decode(title))}, ${JSON.stringify(decode(description))}${bodyType ? `, { pageType: ${JSON.stringify(bodyType)} }` : ""});
  return (
    ${jsx}
  );
}
`;
  fs.writeFileSync(`src/pages/content/${page.component}.tsx`, file);
  console.log(page.component, jsx.length, "chars");
}
