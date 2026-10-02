/* Sizes are written in px and served in rem, so the whole design scales with the root font size, which grows on
   large monitors (see `html` in src/styles/base.css). At the default 16px root the conversion is exact, so nothing
   moves on phones, tablets or laptops. Left in px: hairlines under 2px, text inside SVGs (the viewBox already scales
   it), and the root rule itself. Media query parameters are at-rule params, so breakpoints stay in CSS px. */
const PX = /(-?\d*\.?\d+)px\b/g;
const SVG_TEXT = /(^|[\s,>+~])(text|textPath|tspan)\b/;

function pxToRem() {
  return {
    postcssPlugin: 'trulinq-px-to-rem',
    Declaration(decl) {
      if (!decl.value.includes('px') || decl.value.includes('url(')) return;
      const rule = decl.parent;
      if (rule && rule.type === 'rule' && (rule.selector.trim() === 'html' || SVG_TEXT.test(rule.selector))) return;
      decl.value = decl.value.replace(PX, (whole, n) => {
        const v = parseFloat(n);
        return Math.abs(v) < 2 ? whole : `${+(v / 16).toFixed(5)}rem`;
      });
    }
  };
}
pxToRem.postcss = true;

export default { plugins: [pxToRem()] };
