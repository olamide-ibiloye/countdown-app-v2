import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ...nextVitals,
  {
    // Keep existing hydration effects visible during the lint migration.
    files: [
      "app/(root)/pages/*.tsx",
      "components/modeToggle/ModeToggle.tsx",
      "components/schedule/ScheduleModal.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
];

export default config;
