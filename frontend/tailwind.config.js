/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        space: "#05060B",   // page/panel background — deep space
        panel: "#0F1220",   // card backing, opaque enough for dense data to stay legible
        accent: "#7C8CFF",  // indigo-violet glow — primary interactive color
        gold: "#F2B23D",    // blocked-query status (warm, not alarm-red)
        aqua: "#4FD8C4",    // third nebula hue, keeps the glow from reading as one flat neon
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(24px, -18px)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(124,140,255,0.45)" },
          "50%": { boxShadow: "0 0 0 5px rgba(124,140,255,0)" },
        },
        popUp: {
          "0%": { opacity: "0", transform: "scale(0.92) translateY(16px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        slideUpPopUp: {
          "0%": { opacity: "0", transform: "translateY(100px) scale(0.88)" },
          "65%": { opacity: "0.95", transform: "translateY(-8px) scale(1.015)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        slideUpPop: {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        backdropFade: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        drift: "drift 20s ease-in-out infinite",
        "glow-pulse": "glowPulse 2.2s ease-in-out infinite",
        "pop-up": "popUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-up-pop-delayed": "slideUpPopUp 0.75s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both",
        "slide-up-pop": "slideUpPop 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "backdrop-fade": "backdropFade 0.25s ease-out forwards",
      },
    },
  },
  plugins: [],
};
