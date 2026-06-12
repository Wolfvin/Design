import * as cheerio from "cheerio";
import csstree from "css-tree";
import type { DesignCategory } from "../db/database.js";

export interface ExtractedElement {
  name: string;
  category: DesignCategory;
  code: string;
  framework: string[];
  mood: string[];
  context: string[];
  tags: string[];
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchUrl(url: string): Promise<{
  html: string;
  cssFiles: string[];
  inlineStyles: string[];
  scripts: string[];
}> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; DesignLibraryBot/1.0)",
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // inline <style> blocks
  const inlineStyles: string[] = [];
  $("style").each((_, el) => {
    const css = $(el).html();
    if (css) inlineStyles.push(css);
  });

  // external CSS links
  const cssFiles: string[] = [];
  const base = new URL(url);
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      try {
        cssFiles.push(new URL(href, base).toString());
      } catch {}
    }
  });

  // script tags (for Framer Motion / React patterns)
  const scripts: string[] = [];
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) {
      try {
        scripts.push(new URL(src, base).toString());
      } catch {}
    }
  });

  return { html, cssFiles, inlineStyles, scripts };
}

export async function fetchCssFile(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

// ── CSS Extractor ─────────────────────────────────────────────────────────────

export function extractCssElements(css: string): ExtractedElement[] {
  const elements: ExtractedElement[] = [];

  let ast: csstree.CssNode;
  try {
    ast = csstree.parse(css, { parseValue: false, onParseError: () => {} });
  } catch {
    return elements;
  }

  // ── 1. CSS Custom Properties (design tokens) ──
  const tokens: string[] = [];
  csstree.walk(ast, (node) => {
    if (
      node.type === "Declaration" &&
      node.property.startsWith("--")
    ) {
      tokens.push(csstree.generate(node));
    }
  });
  if (tokens.length > 0) {
    elements.push({
      name: "css-design-tokens",
      category: "design-system",
      code: `:root {\n  ${tokens.join(";\n  ")};\n}`,
      framework: ["css"],
      mood: inferMoodFromTokens(tokens),
      context: ["any"],
      tags: ["tokens", "variables", "design-system"],
    });
  }

  // ── 2. @keyframes (animations) ──
  csstree.walk(ast, (node) => {
    if (node.type === "Atrule" && node.name === "keyframes") {
      const name = node.prelude
        ? csstree.generate(node.prelude).trim()
        : "unknown";
      const code = csstree.generate(node);
      elements.push({
        name: `animation-${toKebab(name)}`,
        category: "animation",
        code,
        framework: ["css"],
        mood: inferMoodFromName(name),
        context: inferContext(name),
        tags: ["animation", "keyframe", name],
      });
    }
  });

  // ── 3. :hover / :focus rules ──
  csstree.walk(ast, (node) => {
    if (node.type === "Rule") {
      const selector = node.prelude
        ? csstree.generate(node.prelude)
        : "";
      if (selector.includes(":hover") || selector.includes(":focus")) {
        const code = csstree.generate(node);
        const slug = toKebab(selector.split(":")[0].trim().replace(/[^a-zA-Z0-9-_]/g, "-"));
        elements.push({
          name: `hover-${slug || "effect"}`,
          category: "hover-effect",
          code,
          framework: ["css"],
          mood: inferMoodFromCode(code),
          context: inferContext(selector),
          tags: ["hover", "interaction", "css"],
        });
      }
    }
  });

  // ── 4. Gradients ──
  const gradientRules: string[] = [];
  csstree.walk(ast, (node) => {
    if (node.type === "Rule") {
      const code = csstree.generate(node);
      if (
        code.includes("linear-gradient") ||
        code.includes("radial-gradient") ||
        code.includes("conic-gradient")
      ) {
        gradientRules.push(code);
      }
    }
  });
  if (gradientRules.length > 0) {
    elements.push({
      name: "gradient-collection",
      category: "gradient",
      code: gradientRules.join("\n\n"),
      framework: ["css"],
      mood: ["any"],
      context: ["hero", "background", "any"],
      tags: ["gradient", "background", "color"],
    });
  }

  return elements;
}

// ── Tailwind Extractor ─────────────────────────────────────────────────────────

export function extractTailwindClasses(html: string): ExtractedElement[] {
  const elements: ExtractedElement[] = [];
  const $ = cheerio.load(html);

  // collect all class attributes
  const classMap: Record<string, string[]> = {};
  $("[class]").each((_, el) => {
    const tag = el.type === "tag" ? el.name : "div";
    const classes = ($(el).attr("class") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .filter((c) => isTailwindClass(c));

    if (classes.length > 3) {
      classMap[tag] = [...(classMap[tag] ?? []), ...classes];
    }
  });

  for (const [tag, classes] of Object.entries(classMap)) {
    const unique = [...new Set(classes)];
    if (unique.length < 3) continue;

    const animClasses = unique.filter(
      (c) => c.startsWith("animate-") || c.startsWith("transition") || c.startsWith("duration-")
    );
    const hoverClasses = unique.filter((c) => c.startsWith("hover:"));

    if (animClasses.length > 0) {
      elements.push({
        name: `tailwind-animation-${tag}`,
        category: "tailwind",
        code: animClasses.join(" "),
        framework: ["tailwind"],
        mood: ["any"],
        context: inferContext(tag),
        tags: ["tailwind", "animation", tag],
      });
    }

    if (hoverClasses.length > 0) {
      elements.push({
        name: `tailwind-hover-${tag}`,
        category: "hover-effect",
        code: hoverClasses.join(" "),
        framework: ["tailwind"],
        mood: ["any"],
        context: inferContext(tag),
        tags: ["tailwind", "hover", tag],
      });
    }
  }

  return elements;
}

// ── React / Next.js / TypeScript / Framer Motion pattern detector ─────────────

export function detectFrameworkPatterns(html: string): ExtractedElement[] {
  const elements: ExtractedElement[] = [];

  // Framer Motion — detect via motion. attributes or data-framer
  if (
    html.includes("motion.") ||
    html.includes("framer-motion") ||
    html.includes("data-framer")
  ) {
    elements.push({
      name: "framer-motion-detected",
      category: "framer-motion",
      code: "// Site uses Framer Motion — use web fetcher with JS rendering for full extraction",
      framework: ["framer-motion", "react"],
      mood: ["any"],
      context: ["any"],
      tags: ["framer-motion", "animation", "react"],
    });
  }

  // Next.js — detect via __NEXT_DATA__ or next/ imports
  if (html.includes("__NEXT_DATA__") || html.includes("/_next/")) {
    elements.push({
      name: "nextjs-app-detected",
      category: "nextjs-pattern",
      code: "// Site is built with Next.js — patterns extracted from HTML structure",
      framework: ["nextjs", "react"],
      mood: ["any"],
      context: ["any"],
      tags: ["nextjs", "app-router", "react"],
    });
  }

  // Tailwind — detect via standard utility class patterns
  if (
    html.includes("class=\"flex") ||
    html.includes('class="grid') ||
    html.includes("tailwind")
  ) {
    elements.push({
      name: "tailwind-detected",
      category: "tailwind",
      code: "// Site uses Tailwind CSS — classes extracted from HTML",
      framework: ["tailwind"],
      mood: ["any"],
      context: ["any"],
      tags: ["tailwind"],
    });
  }

  return elements;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toKebab(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function isTailwindClass(cls: string): boolean {
  const patterns = [
    /^(flex|grid|block|inline|hidden)/,
    /^(p|m|px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr)-/,
    /^(text|font|leading|tracking)-/,
    /^(bg|border|ring|shadow|rounded)-/,
    /^(w|h|min|max)-/,
    /^(hover:|focus:|active:|group-hover:)/,
    /^(transition|duration|ease|delay|animate)-/,
    /^(opacity|scale|rotate|translate|skew)-/,
    /^(gap|space)-/,
    /^(items|justify|content|self)-/,
  ];
  return patterns.some((p) => p.test(cls));
}

function inferMoodFromName(name: string): string[] {
  const lower = name.toLowerCase();
  if (/fade|soft|gentle|smooth/.test(lower)) return ["elegant", "minimal"];
  if (/bounce|pop|jump|spring/.test(lower)) return ["playful"];
  if (/slide|glide|sweep/.test(lower)) return ["minimal"];
  if (/shake|jitter|vibrate/.test(lower)) return ["brutal", "experimental"];
  if (/reveal|unveil|wipe/.test(lower)) return ["editorial"];
  if (/float|drift|pulse/.test(lower)) return ["organic"];
  if (/flash|blink|flicker/.test(lower)) return ["experimental", "futuristic"];
  return ["any"];
}

function inferMoodFromTokens(tokens: string[]): string[] {
  const combined = tokens.join(" ").toLowerCase();
  if (/gold|#[c-f][a-f0-9]{4}[0-3]/.test(combined)) return ["luxury"];
  if (/#(0a|0b|0c|0d|0e|0f|1[0-9])/.test(combined)) return ["minimal", "editorial"];
  if (/neon|#[0-9a-f]{2}ff[0-9a-f]{2}/.test(combined)) return ["futuristic"];
  return ["any"];
}

function inferMoodFromCode(code: string): string[] {
  const lower = code.toLowerCase();
  if (/box-shadow.*0px.*0px/.test(lower)) return ["brutal"];
  if (/scale\(1\.[0-9]\)/.test(lower)) return ["playful"];
  if (/opacity.*0\.[0-9]/.test(lower)) return ["elegant", "minimal"];
  if (/cubic-bezier/.test(lower)) return ["elegant"];
  if (/steps\(/.test(lower)) return ["experimental", "brutal"];
  return ["any"];
}

function inferContext(str: string): string[] {
  const lower = str.toLowerCase();
  const ctx: string[] = [];
  if (/hero|banner|splash/.test(lower)) ctx.push("hero");
  if (/nav|header|menu/.test(lower)) ctx.push("navbar");
  if (/card|tile|item/.test(lower)) ctx.push("card");
  if (/btn|button|cta/.test(lower)) ctx.push("button");
  if (/footer/.test(lower)) ctx.push("footer");
  if (/modal|dialog|overlay/.test(lower)) ctx.push("modal");
  if (/form|input|field/.test(lower)) ctx.push("form");
  return ctx.length > 0 ? ctx : ["any"];
}
