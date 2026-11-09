import path from "path";

const config = {
  test: {
    include: ["src/**/*.{test,spec}.{js,ts,tsx}"],
    globals: true,
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};

export default config;
