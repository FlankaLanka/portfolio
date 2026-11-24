module.exports = function(eleventyConfig) {
  // Pass through static assets
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/downloads");

  // Watch for changes in assets
  eleventyConfig.addWatchTarget("src/assets/");

  // Bundle the 3D world (cover/): home.js for the home page, page.js for the
  // banner on inner pages. Both share one three.js chunk.
  eleventyConfig.addWatchTarget("./cover/");
  eleventyConfig.on("eleventy.after", async () => {
    await require("esbuild").build({
      entryPoints: { home: "cover/main.js", page: "cover/page.js" },
      bundle: true,
      splitting: true,
      minify: true,
      format: "esm",
      target: "es2020",
      outdir: "_site/assets/js/cover",
      chunkNames: "world-[hash]",
      logLevel: "warning"
    });
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
