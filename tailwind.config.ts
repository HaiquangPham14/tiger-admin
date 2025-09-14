// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: "class", // <- BẮT BUỘC để toggle bằng .dark
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
