import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

/** Strip leftover `@tailwind` HMR shims after Tailwind expands them. */
function postcssStripTailwindShim() {
  return {
    postcssPlugin: 'postcss-strip-tailwind-shim',
    Once(root) {
      root.walkAtRules('tailwind', (rule) => {
        rule.remove()
      })
    },
  }
}
postcssStripTailwindShim.postcss = true

export default {
  plugins: [tailwindcss, autoprefixer, postcssStripTailwindShim()],
}
