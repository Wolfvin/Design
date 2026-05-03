import type { DesignCategory } from "../db/database.js";
import type { ExtractedElement } from "./web-extractor.js";

// ── Claude Design Generator ───────────────────────────────────────────────────
// This tool generates design elements from Claude's own knowledge.
// Returns ready-to-save ExtractedElement objects.

export type GenerateRequest = {
  category: DesignCategory;
  mood: string;
  context: string;
  framework: string;
  description?: string;
};

export function generateFromClaude(req: GenerateRequest): ExtractedElement {
  const key = `${req.mood}-${req.category}-${req.framework}`;

  const generator = GENERATORS[req.category] ?? GENERATORS["css"];
  return generator(req);
}

// ── Built-in generators per category ─────────────────────────────────────────

const GENERATORS: Record<string, (req: GenerateRequest) => ExtractedElement> = {

  animation: (req) => ({
    name: `claude-${req.mood}-animation`,
    category: "animation",
    code: getAnimation(req.mood),
    framework: [req.framework || "css"],
    mood: [req.mood],
    context: [req.context || "any"],
    tags: ["claude-generated", "animation", req.mood],
  }),

  "hover-effect": (req) => ({
    name: `claude-${req.mood}-hover`,
    category: "hover-effect",
    code: getHover(req.mood, req.framework),
    framework: [req.framework || "css"],
    mood: [req.mood],
    context: [req.context || "any"],
    tags: ["claude-generated", "hover", req.mood],
  }),

  "design-system": (req) => ({
    name: `claude-${req.mood}-design-system`,
    category: "design-system",
    code: getDesignSystem(req.mood),
    framework: ["css"],
    mood: [req.mood],
    context: ["any"],
    tags: ["claude-generated", "design-system", "tokens", req.mood],
  }),

  gradient: (req) => ({
    name: `claude-${req.mood}-gradient`,
    category: "gradient",
    code: getGradient(req.mood),
    framework: ["css"],
    mood: [req.mood],
    context: [req.context || "hero"],
    tags: ["claude-generated", "gradient", req.mood],
  }),

  "micro-interaction": (req) => ({
    name: `claude-${req.mood}-micro`,
    category: "micro-interaction",
    code: getMicroInteraction(req.mood, req.framework),
    framework: [req.framework || "css"],
    mood: [req.mood],
    context: [req.context || "any"],
    tags: ["claude-generated", "micro-interaction", req.mood],
  }),

  tailwind: (req) => ({
    name: `claude-${req.mood}-tailwind-${req.context}`,
    category: "tailwind",
    code: getTailwind(req.mood, req.context),
    framework: ["tailwind"],
    mood: [req.mood],
    context: [req.context || "any"],
    tags: ["claude-generated", "tailwind", req.mood],
  }),

  "react-component": (req) => ({
    name: `claude-${req.mood}-${req.context}-component`,
    category: "react-component",
    code: getReactComponent(req.mood, req.context),
    framework: ["react", "typescript"],
    mood: [req.mood],
    context: [req.context || "any"],
    tags: ["claude-generated", "react", "component", req.mood],
  }),

  "framer-motion": (req) => ({
    name: `claude-${req.mood}-framer`,
    category: "framer-motion",
    code: getFramerMotion(req.mood),
    framework: ["framer-motion", "react"],
    mood: [req.mood],
    context: [req.context || "any"],
    tags: ["claude-generated", "framer-motion", req.mood],
  }),

  css: (req) => ({
    name: `claude-${req.mood}-css`,
    category: "css",
    code: getAnimation(req.mood),
    framework: ["css"],
    mood: [req.mood],
    context: [req.context || "any"],
    tags: ["claude-generated", "css", req.mood],
  }),
};

// ── Code templates ────────────────────────────────────────────────────────────

function getAnimation(mood: string): string {
  const map: Record<string, string> = {
    elegant: `@keyframes elegantFadeUp {
  from { opacity: 0; transform: translateY(24px); filter: blur(4px); }
  to   { opacity: 1; transform: translateY(0);    filter: blur(0);   }
}
.animate-elegant {
  animation: elegantFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}`,
    playful: `@keyframes playfulBounce {
  0%   { transform: scale(0.8) rotate(-3deg); opacity: 0; }
  60%  { transform: scale(1.1) rotate(2deg);  opacity: 1; }
  100% { transform: scale(1)   rotate(0deg);  opacity: 1; }
}
.animate-playful {
  animation: playfulBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}`,
    brutal: `@keyframes brutalSlam {
  0%   { transform: translateY(-40px) scaleY(1.2); opacity: 0; }
  80%  { transform: translateY(4px)   scaleY(0.96); opacity: 1; }
  100% { transform: translateY(0)     scaleY(1);    opacity: 1; }
}
.animate-brutal {
  animation: brutalSlam 0.25s steps(4) both;
}`,
    minimal: `@keyframes minimalFade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.animate-minimal {
  animation: minimalFade 0.4s ease both;
}`,
    futuristic: `@keyframes futuristicReveal {
  0%   { clip-path: inset(0 100% 0 0); opacity: 0.5; }
  100% { clip-path: inset(0 0% 0 0);   opacity: 1;   }
}
.animate-futuristic {
  animation: futuristicReveal 0.6s cubic-bezier(0.77, 0, 0.175, 1) both;
}`,
    editorial: `@keyframes editorialSplit {
  0%   { transform: translateX(-20px) skewX(-5deg); opacity: 0; }
  100% { transform: translateX(0)     skewX(0deg);  opacity: 1; }
}
.animate-editorial {
  animation: editorialSplit 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}`,
  };
  return map[mood] ?? map.elegant;
}

function getHover(mood: string, framework: string): string {
  if (framework === "tailwind") {
    const map: Record<string, string> = {
      elegant:    "transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5",
      playful:    "transition-all duration-200 hover:scale-110 hover:rotate-1 active:scale-95",
      brutal:     "transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-none",
      minimal:    "transition-opacity duration-200 hover:opacity-70",
      futuristic: "transition-all duration-300 hover:shadow-[0_0_20px_rgba(99,102,241,0.6)] hover:scale-[1.01]",
    };
    return map[mood] ?? map.elegant;
  }

  const map: Record<string, string> = {
    elegant: `.hover-elegant {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.3s ease,
              opacity 0.3s ease;
}
.hover-elegant:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
}`,
    brutal: `.hover-brutal {
  transition: none;
  border: 2px solid #000;
  box-shadow: 4px 4px 0 #000;
}
.hover-brutal:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 #000;
}`,
    futuristic: `.hover-futuristic {
  transition: box-shadow 0.3s ease, border-color 0.3s ease;
  border: 1px solid transparent;
}
.hover-futuristic:hover {
  border-color: rgba(99, 102, 241, 0.8);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.4),
              inset 0 0 20px rgba(99, 102, 241, 0.05);
}`,
    playful: `.hover-playful {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hover-playful:hover {
  transform: scale(1.08) rotate(-1deg);
}`,
  };
  return map[mood] ?? map.elegant;
}

function getDesignSystem(mood: string): string {
  const map: Record<string, string> = {
    elegant: `:root {
  --color-bg:       #fafaf8;
  --color-surface:  #ffffff;
  --color-primary:  #1a1a1a;
  --color-accent:   #c9a84c;
  --color-muted:    #6b6b6b;
  --font-display:   'Cormorant Garamond', Georgia, serif;
  --font-body:      'DM Sans', system-ui, sans-serif;
  --font-mono:      'JetBrains Mono', monospace;
  --space-unit:     8px;
  --radius-sm:      4px;
  --radius-md:      8px;
  --radius-lg:      16px;
  --shadow-sm:      0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:      0 4px 16px rgba(0,0,0,0.10);
  --shadow-lg:      0 16px 48px rgba(0,0,0,0.12);
}`,
    brutal: `:root {
  --color-bg:       #ffffff;
  --color-surface:  #f0f0f0;
  --color-primary:  #000000;
  --color-accent:   #ff0040;
  --color-muted:    #555555;
  --font-display:   'Space Grotesk', sans-serif;
  --font-body:      'Space Grotesk', sans-serif;
  --font-mono:      'Space Mono', monospace;
  --space-unit:     8px;
  --radius-sm:      0px;
  --radius-md:      0px;
  --radius-lg:      0px;
  --shadow-sm:      2px 2px 0 #000;
  --shadow-md:      4px 4px 0 #000;
  --shadow-lg:      8px 8px 0 #000;
}`,
    minimal: `:root {
  --color-bg:       #ffffff;
  --color-surface:  #f9f9f9;
  --color-primary:  #111111;
  --color-accent:   #111111;
  --color-muted:    #999999;
  --font-display:   'Inter', system-ui, sans-serif;
  --font-body:      'Inter', system-ui, sans-serif;
  --font-mono:      'Fira Code', monospace;
  --space-unit:     8px;
  --radius-sm:      2px;
  --radius-md:      4px;
  --radius-lg:      8px;
  --shadow-sm:      0 1px 2px rgba(0,0,0,0.05);
  --shadow-md:      0 2px 8px rgba(0,0,0,0.06);
  --shadow-lg:      0 8px 24px rgba(0,0,0,0.08);
}`,
    futuristic: `:root {
  --color-bg:       #050510;
  --color-surface:  #0d0d1a;
  --color-primary:  #e0e0ff;
  --color-accent:   #6366f1;
  --color-muted:    #6060a0;
  --font-display:   'Orbitron', sans-serif;
  --font-body:      'Exo 2', sans-serif;
  --font-mono:      'Share Tech Mono', monospace;
  --space-unit:     8px;
  --radius-sm:      2px;
  --radius-md:      6px;
  --radius-lg:      12px;
  --shadow-sm:      0 0 8px rgba(99,102,241,0.2);
  --shadow-md:      0 0 20px rgba(99,102,241,0.3);
  --shadow-lg:      0 0 40px rgba(99,102,241,0.4);
}`,
  };
  return map[mood] ?? map.minimal;
}

function getGradient(mood: string): string {
  const map: Record<string, string> = {
    elegant: `.gradient-elegant {
  background:
    radial-gradient(ellipse at 20% 50%, rgba(201,168,76,0.15) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, rgba(26,26,26,0.05)  0%, transparent 50%),
    linear-gradient(135deg, #fafaf8 0%, #f0ede8 100%);
}`,
    brutal: `.gradient-brutal {
  background: #ffffff;
  background-image: repeating-linear-gradient(
    45deg,
    transparent 0px, transparent 10px,
    rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 11px
  );
}`,
    futuristic: `.gradient-futuristic {
  background:
    radial-gradient(ellipse at 30% 40%, rgba(99,102,241,0.3)  0%, transparent 50%),
    radial-gradient(ellipse at 70% 60%, rgba(139,92,246,0.2)  0%, transparent 50%),
    linear-gradient(180deg, #050510 0%, #0a0a1f 100%);
}`,
    editorial: `.gradient-editorial {
  background: linear-gradient(160deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%);
}`,
    organic: `.gradient-organic {
  background:
    radial-gradient(ellipse at 10% 80%, rgba(134,196,144,0.3) 0%, transparent 40%),
    radial-gradient(ellipse at 90% 20%, rgba(255,200,120,0.25) 0%, transparent 40%),
    linear-gradient(135deg, #f8fdf8 0%, #fffdf5 100%);
}`,
  };
  return map[mood] ?? map.minimal;
}

function getMicroInteraction(mood: string, framework: string): string {
  if (framework === "react" || framework === "typescript") {
    return `// Micro-interaction: ${mood} scroll reveal
import { useEffect, useRef, useState } from 'react';

export function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}`;
  }

  return `.micro-scroll-reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1);
}
.micro-scroll-reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}`;
}

function getTailwind(mood: string, context: string): string {
  const map: Record<string, Record<string, string>> = {
    elegant: {
      hero: "flex flex-col items-center justify-center min-h-screen px-6 py-24 text-center bg-[#fafaf8]",
      card: "group bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow duration-300",
      button: "inline-flex items-center gap-2 px-6 py-3 bg-[#1a1a1a] text-white text-sm tracking-wide transition-all duration-300 hover:bg-[#c9a84c] hover:-translate-y-0.5",
    },
    brutal: {
      hero: "flex flex-col items-start justify-center min-h-screen px-8 py-16 bg-white border-b-4 border-black",
      card: "bg-white border-2 border-black p-5 shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[2px_2px_0_#000] transition-all duration-75",
      button: "px-6 py-3 bg-black text-white font-bold border-2 border-black shadow-[4px_4px_0_#ff0040] hover:translate-x-1 hover:translate-y-1 hover:shadow-[2px_2px_0_#ff0040] transition-all duration-75",
    },
    minimal: {
      hero: "flex flex-col items-center justify-center min-h-screen px-6 text-center",
      card: "p-6 hover:opacity-80 transition-opacity duration-200 cursor-pointer",
      button: "px-5 py-2.5 text-sm border border-neutral-200 hover:border-neutral-900 transition-colors duration-200",
    },
    futuristic: {
      hero: "relative flex flex-col items-center justify-center min-h-screen px-6 bg-[#050510] text-white overflow-hidden",
      card: "bg-[#0d0d1a] border border-indigo-900/50 rounded-lg p-6 hover:border-indigo-500/80 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all duration-300",
      button: "px-6 py-3 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-500 hover:shadow-[0_0_16px_rgba(99,102,241,0.5)] transition-all duration-300",
    },
  };

  const moodMap = map[mood] ?? map.minimal;
  const classes = moodMap[context] ?? moodMap.card ?? "";
  return `/* Tailwind: ${mood} ${context} */\n"${classes}"`;
}

function getReactComponent(mood: string, context: string): string {
  if (context === "card") {
    return `// React Component: ${mood} Card
import type { FC, ReactNode } from 'react';

interface CardProps {
  title: string;
  description?: string;
  children?: ReactNode;
  onClick?: () => void;
}

export const Card: FC<CardProps> = ({ title, description, children, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="${getTailwindCardClass(mood)}"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  );
};

export default Card;`;
  }

  return `// React Component: ${mood} Hero Section
import type { FC } from 'react';

interface HeroProps {
  title: string;
  subtitle?: string;
  cta?: string;
  onCtaClick?: () => void;
}

export const Hero: FC<HeroProps> = ({ title, subtitle, cta, onCtaClick }) => {
  return (
    <section className="${getTailwindHeroClass(mood)}">
      <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
        {title}
      </h1>
      {subtitle && (
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          {subtitle}
        </p>
      )}
      {cta && (
        <button onClick={onCtaClick} className="btn-primary">
          {cta}
        </button>
      )}
    </section>
  );
};

export default Hero;`;
}

function getFramerMotion(mood: string): string {
  const map: Record<string, string> = {
    elegant: `// Framer Motion: elegant fade-up variants
import { motion } from 'framer-motion';

export const fadeUpVariants = {
  hidden:  { opacity: 0, y: 24, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
  },
};

export const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

// Usage:
// <motion.div variants={staggerContainer} initial="hidden" animate="visible">
//   <motion.h1 variants={fadeUpVariants}>Title</motion.h1>
//   <motion.p  variants={fadeUpVariants}>Subtitle</motion.p>
// </motion.div>`,

    playful: `// Framer Motion: playful spring variants
import { motion } from 'framer-motion';

export const springVariants = {
  hidden:  { scale: 0.8, opacity: 0, rotate: -5 },
  visible: {
    scale: 1, opacity: 1, rotate: 0,
    transition: { type: 'spring', stiffness: 400, damping: 17 }
  },
  tap:     { scale: 0.95, rotate: 1 },
  hover:   { scale: 1.05, rotate: -1 },
};`,

    futuristic: `// Framer Motion: futuristic clip-path reveal
import { motion } from 'framer-motion';

export const revealVariants = {
  hidden:  { clipPath: 'inset(0 100% 0 0)', opacity: 0 },
  visible: {
    clipPath: 'inset(0 0% 0 0)', opacity: 1,
    transition: { duration: 0.7, ease: [0.77, 0, 0.175, 1] }
  },
};

export const glowVariants = {
  idle:  { boxShadow: '0 0 0px rgba(99,102,241,0)' },
  glow:  { boxShadow: '0 0 30px rgba(99,102,241,0.6)',
           transition: { duration: 1.5, repeat: Infinity, repeatType: 'reverse' as const } },
};`,
  };
  return map[mood] ?? map.elegant;
}

function getTailwindCardClass(mood: string): string {
  const map: Record<string, string> = {
    elegant:    "bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow duration-300 cursor-pointer",
    brutal:     "bg-white border-2 border-black p-5 shadow-[4px_4px_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 transition-all",
    minimal:    "p-6 hover:opacity-80 transition-opacity",
    futuristic: "bg-[#0d0d1a] border border-indigo-900/50 rounded-lg p-6 hover:border-indigo-500/80 transition-all",
  };
  return map[mood] ?? map.minimal;
}

function getTailwindHeroClass(mood: string): string {
  const map: Record<string, string> = {
    elegant:    "flex flex-col items-center justify-center min-h-screen px-6 py-24 text-center bg-[#fafaf8]",
    brutal:     "flex flex-col items-start justify-center min-h-screen px-8 py-16 bg-white",
    minimal:    "flex flex-col items-center justify-center min-h-screen px-6 text-center",
    futuristic: "relative flex flex-col items-center justify-center min-h-screen px-6 bg-[#050510] text-white",
  };
  return map[mood] ?? map.minimal;
}
