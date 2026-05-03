import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  insertElement,
  queryElements,
  updateElementStatus,
  updateElementName,
  deleteElement,
  incrementUsed,
  getStats,
  type DesignCategory,
  type DesignSource,
} from "./db/database.js";

import {
  fetchUrl,
  fetchCssFile,
  extractCssElements,
  extractTailwindClasses,
  detectFrameworkPatterns,
} from "./extractors/web-extractor.js";

import {
  generateFromClaude,
  type GenerateRequest,
} from "./extractors/claude-generator.js";

// ── Server ────────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "design-library-tools",
  version: "1.0.0",
});

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 1 — fetch_web_design
// Fetches a URL and extracts all design elements (CSS, Tailwind, React, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  "fetch_web_design",
  "Fetch a website URL and extract all design elements into the library. Extracts CSS animations, hover effects, gradients, Tailwind classes, design tokens, and detects React/Next.js/Framer Motion patterns.",
  {
    url: z.string().url().describe("The website URL to fetch and extract design from"),
    auto_save: z.boolean().default(false).describe("If true, save all extracted elements as 'pending'. If false, return them for review first."),
  },
  async ({ url, auto_save }) => {
    try {
      const { html, cssFiles, inlineStyles } = await fetchUrl(url);

      const allElements: ReturnType<typeof extractCssElements> = [];

      // inline styles
      for (const css of inlineStyles) {
        allElements.push(...extractCssElements(css));
      }

      // external CSS files (max 5 to avoid slow fetches)
      for (const cssUrl of cssFiles.slice(0, 5)) {
        const css = await fetchCssFile(cssUrl);
        if (css) allElements.push(...extractCssElements(css));
      }

      // Tailwind classes from HTML
      allElements.push(...extractTailwindClasses(html));

      // Framework detection
      allElements.push(...detectFrameworkPatterns(html));

      if (allElements.length === 0) {
        return {
          content: [{
            type: "text",
            text: `⚠️ No design elements found at ${url}.\n\nThe site may be heavily JavaScript-rendered. Try pasting the CSS directly, or use the generate_from_claude tool to create elements manually.`,
          }],
        };
      }

      if (auto_save) {
        const ids: number[] = [];
        for (const el of allElements) {
          const id = insertElement({
            ...el,
            source: "web" as DesignSource,
            source_url: url,
            mood: JSON.stringify(el.mood),
            context: JSON.stringify(el.context),
            compatible_with: "[]",
            clash_with: "[]",
            tags: JSON.stringify(el.tags),
            framework: JSON.stringify(el.framework),
            status: "pending",
            rating: null,
          });
          ids.push(id);
        }

        const summary = allElements.reduce<Record<string, number>>((acc, el) => {
          acc[el.category] = (acc[el.category] ?? 0) + 1;
          return acc;
        }, {});

        return {
          content: [{
            type: "text",
            text: [
              `✅ Extracted ${allElements.length} design elements from ${url}`,
              ``,
              `📁 Saved to library (status: pending — review with review_library):`,
              ...Object.entries(summary).map(([cat, count]) => `  ${cat}: ${count} elements`),
              ``,
              `IDs saved: ${ids.join(", ")}`,
              ``,
              `Run review_library to approve or reject each element.`,
            ].join("\n"),
          }],
        };
      }

      // Return for review (don't save yet)
      const preview = allElements.slice(0, 10).map((el, i) =>
        `[${i + 1}] ${el.category} › ${el.name}\n    mood: ${el.mood.join(", ")} | framework: ${el.framework.join(", ")}\n    preview: ${el.code.slice(0, 80).replace(/\n/g, " ")}...`
      ).join("\n\n");

      return {
        content: [{
          type: "text",
          text: [
            `🔍 Found ${allElements.length} design elements at ${url}`,
            `(showing first 10 — use auto_save: true to save all)`,
            ``,
            preview,
            ``,
            `To save all: call fetch_web_design again with auto_save: true`,
            `To save specific elements: call save_design_element for each.`,
          ].join("\n"),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text",
          text: `❌ Error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`,
        }],
      };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 2 — generate_from_claude
// Generates a design element from Claude's built-in design knowledge
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  "generate_from_claude",
  "Generate a design element from Claude's built-in knowledge. Use this when you want Claude to create CSS, Tailwind classes, React components, Framer Motion variants, or design tokens based on a mood and context — without fetching from the web.",
  {
    category: z.enum([
      "css", "tailwind", "react-component", "nextjs-pattern",
      "typescript", "framer-motion", "animation", "hover-effect",
      "gradient", "design-system", "micro-interaction",
    ]).describe("The type of design element to generate"),
    mood: z.enum(["elegant", "playful", "brutal", "minimal", "luxury", "editorial", "futuristic", "organic", "corporate", "experimental"])
      .describe("The visual mood/personality of the element"),
    context: z.string().default("any").describe("Where this element will be used: hero, card, button, navbar, footer, any"),
    framework: z.string().default("css").describe("Target framework: css, tailwind, react, typescript, framer-motion"),
    auto_save: z.boolean().default(true).describe("If true, automatically save the generated element to the library"),
  },
  async ({ category, mood, context, framework, auto_save }) => {
    const req: GenerateRequest = { category: category as DesignCategory, mood, context, framework };
    const el = generateFromClaude(req);

    if (auto_save) {
      const id = insertElement({
        ...el,
        source: "claude" as DesignSource,
        source_url: null,
        mood: JSON.stringify(el.mood),
        context: JSON.stringify(el.context),
        compatible_with: "[]",
        clash_with: "[]",
        tags: JSON.stringify(el.tags),
        framework: JSON.stringify(el.framework),
        status: "approved", // claude-generated = auto-approved
        rating: null,
      });

      return {
        content: [{
          type: "text",
          text: [
            `✅ Generated and saved: ${el.name} (ID: ${id})`,
            `Category: ${el.category} | Mood: ${el.mood.join(", ")} | Framework: ${el.framework.join(", ")}`,
            `Status: approved (Claude-generated elements are auto-approved)`,
            ``,
            `Code preview:`,
            el.code.slice(0, 300),
            el.code.length > 300 ? "\n... (truncated)" : "",
          ].join("\n"),
        }],
      };
    }

    return {
      content: [{
        type: "text",
        text: [
          `🎨 Generated: ${el.name}`,
          ``,
          el.code,
          ``,
          `Call again with auto_save: true to save to library.`,
        ].join("\n"),
      }],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 3 — save_design_element
// Manually save a design element with full metadata
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  "save_design_element",
  "Manually save a design element to the library with full metadata. Use this to add custom or hand-picked design code.",
  {
    name: z.string().describe("Descriptive name in kebab-case, e.g. elegant-fade-up"),
    category: z.enum([
      "css", "tailwind", "react-component", "nextjs-pattern",
      "typescript", "framer-motion", "animation", "hover-effect",
      "gradient", "design-system", "micro-interaction",
    ]),
    code: z.string().describe("The actual CSS/JS/TSX code of the design element"),
    mood: z.array(z.string()).default([]).describe("Mood tags: elegant, minimal, brutal, playful, futuristic, etc."),
    context: z.array(z.string()).default(["any"]).describe("Where to use: hero, card, button, navbar, footer, any"),
    framework: z.array(z.string()).default(["css"]).describe("Frameworks: css, tailwind, react, typescript, framer-motion"),
    tags: z.array(z.string()).default([]).describe("Free-form tags for searching"),
    source_url: z.string().optional().describe("Original URL if taken from web"),
  },
  async ({ name, category, code, mood, context, framework, tags, source_url }) => {
    const id = insertElement({
      name,
      category: category as DesignCategory,
      source: source_url ? "web" : "claude",
      source_url: source_url ?? null,
      code,
      mood: JSON.stringify(mood),
      context: JSON.stringify(context),
      compatible_with: "[]",
      clash_with: "[]",
      tags: JSON.stringify(tags),
      framework: JSON.stringify(framework),
      status: "pending",
      rating: null,
    });

    return {
      content: [{
        type: "text",
        text: `✅ Saved: ${name} (ID: ${id}) — status: pending\nUse review_library to approve it.`,
      }],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 4 — review_library
// Show pending elements for user approval
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  "review_library",
  "Show pending design elements one by one for approval. Returns elements waiting for review.",
  {
    category: z.string().optional().describe("Filter by category (optional)"),
    limit: z.number().default(5).describe("How many elements to show at once"),
  },
  async ({ category, limit }) => {
    const elements = queryElements({
      status: "pending",
      category: category as DesignCategory | undefined,
      limit,
    });

    if (elements.length === 0) {
      return {
        content: [{
          type: "text",
          text: "✅ No pending elements — library is clean!",
        }],
      };
    }

    const text = elements.map((el) => [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `ID: ${el.id} | ${el.category} › ${el.name}`,
      `Mood: ${el.mood} | Framework: ${el.framework}`,
      `Context: ${el.context}`,
      el.source_url ? `Source: ${el.source_url}` : `Source: Claude`,
      ``,
      `Code preview:`,
      el.code.slice(0, 200) + (el.code.length > 200 ? "\n..." : ""),
      ``,
      `→ approve_element(${el.id}) | reject_element(${el.id}) | rename_element(${el.id}, "new-name")`,
    ].join("\n")).join("\n\n");

    return {
      content: [{
        type: "text",
        text: `📋 ${elements.length} pending elements (showing ${Math.min(limit, elements.length)}):\n\n${text}`,
      }],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 5 — approve_element / reject_element / rename_element
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  "approve_element",
  "Approve a pending design element — moves it to the active library.",
  { id: z.number().describe("Element ID to approve") },
  async ({ id }) => {
    updateElementStatus(id, "approved");
    return { content: [{ type: "text", text: `✅ Element ${id} approved and added to library.` }] };
  }
);

server.tool(
  "reject_element",
  "Reject and delete a design element from the library.",
  { id: z.number().describe("Element ID to reject/delete") },
  async ({ id }) => {
    deleteElement(id);
    return { content: [{ type: "text", text: `🗑️ Element ${id} deleted.` }] };
  }
);

server.tool(
  "rename_element",
  "Rename a design element in the library.",
  {
    id: z.number().describe("Element ID to rename"),
    name: z.string().describe("New name in kebab-case"),
  },
  async ({ id, name }) => {
    updateElementName(id, name);
    return { content: [{ type: "text", text: `✏️ Element ${id} renamed to: ${name}` }] };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 6 — query_library
// Search and filter the design library
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  "query_library",
  "Search and filter design elements from the library. Use this to find elements by category, mood, framework, or keyword before generating a frontend.",
  {
    category: z.string().optional().describe("Filter by category: animation, hover-effect, gradient, design-system, tailwind, react-component, framer-motion, etc."),
    search: z.string().optional().describe("Search by name, mood, or tags"),
    source: z.enum(["web", "claude"]).optional().describe("Filter by source"),
    status: z.enum(["pending", "approved", "rejected"]).default("approved"),
    limit: z.number().default(20),
  },
  async ({ category, search, source, status, limit }) => {
    const elements = queryElements({
      category: category as DesignCategory | undefined,
      search,
      source: source as DesignSource | undefined,
      status,
      limit,
    });

    if (elements.length === 0) {
      return {
        content: [{ type: "text", text: "📭 No elements found matching your filters." }],
      };
    }

    const text = elements.map((el) =>
      `[${el.id}] ${el.category} › ${el.name} | mood: ${el.mood} | used: ${el.used_count}x | src: ${el.source}`
    ).join("\n");

    return {
      content: [{
        type: "text",
        text: `📚 Found ${elements.length} elements:\n\n${text}`,
      }],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 7 — get_element_code
// Get the full code of a specific element
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  "get_element_code",
  "Get the full code of a design element by ID. Use before generating to retrieve the exact code to integrate.",
  { id: z.number().describe("Element ID") },
  async ({ id }) => {
    const elements = queryElements({ limit: 1 });
    const db = (await import("./db/database.js")).getDb();
    const el = db.prepare("SELECT * FROM design_elements WHERE id = ?").get(id) as any;

    if (!el) {
      return { content: [{ type: "text", text: `❌ Element ${id} not found.` }] };
    }

    incrementUsed(id);

    return {
      content: [{
        type: "text",
        text: [
          `📦 ${el.category} › ${el.name} (ID: ${id})`,
          `Mood: ${el.mood} | Framework: ${el.framework} | Context: ${el.context}`,
          el.source_url ? `Source: ${el.source_url}` : `Source: Claude`,
          ``,
          `--- CODE ---`,
          el.code,
        ].join("\n"),
      }],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 8 — library_stats
// Show library statistics
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  "library_stats",
  "Show statistics of the design library — how many elements per category, most used, etc.",
  {},
  async () => {
    const stats = getStats();
    const total = Object.values(stats).reduce((a, b) => a + b, 0);

    const text = [
      `📊 Design Library Stats`,
      `Total approved: ${total} elements`,
      ``,
      ...Object.entries(stats).map(([cat, count]) =>
        `  ${cat.padEnd(20)} ${count} elements`
      ),
    ].join("\n");

    return { content: [{ type: "text", text }] };
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✅ design-library-tools MCP server running");
