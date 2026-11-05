const config = {
  test: {
    include: ["src/**/*.{test,spec}.{js,ts,tsx}"],
    globals: true,
    environment: "jsdom",
  },
};

export default config;