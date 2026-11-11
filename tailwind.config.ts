import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        sm: "576px",
        md: "960px",
        lg: "1280px",
        xl: "1440px",
        "2xl": "1920px",
        "3xl": "2240px",
      },
    },
    extend: {
      fontFamily: {
        "presenter-mono": [
          "var(--aeon-font-mono)",
          "ui-monospace",
          "monospace",
        ],
      },
      colors: {
        "primary-contrast":
          "color-mix(in srgb, hsl(var(--primary)) 45%, hsl(var(--primary-foreground)))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        dark: {
          1: "#0A1128",
          2: "#1D2D44",
          3: "#3E5C76",
          4: "#2B4257",
        },
        light: {
          1: "#5C6784",
          2: "#8D92A8",
          3: "#E2E4ED",
          4: "#F0F2F9",
        },
        blue: {
          1: "#2563EB",
        },
        sky: {
          1: "#BAD7F2",
          2: "#E1EFFE",
          3: "#F0F9FF",
        },
        orange: {
          1: "#F97316",
        },
        purple: {
          1: "#7C3AED",
        },
        yellow: {
          1: "#FBBF24",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        blink: {
          "0%, 100%": {
            backgroundColor: "hsl(var(--destructive))",
            color: "hsl(var(--destructive-foreground))",
            transform: "scale(1.05)",
          },
          "50%": {
            backgroundColor: "transparent",
            color: "hsl(var(--destructive))",
            transform: "scale(1)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        flash: "blink 3s ease-in-out infinite",
      },
      backgroundImage: {
        hero: "url('/hero-2.jpeg')",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

export default config;
