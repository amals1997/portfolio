# Amal Sunny — Portfolio

Hand-written HTML, CSS and JavaScript. No framework, no build step, so it runs as-is on GitHub Pages.

```
index.html
assets/css/style.css     design tokens, layout, light/dark themes
assets/js/hero.js        WebGL portrait that "diffuses" in from noise (hover to re-noise)
assets/js/sketches.js    the nine live project sketches (canvas, drawn only while on screen)
assets/js/main.js        intro, nav, cursor, scroll choreography, theme wipe
assets/img/              portrait cut-out, avatar, social preview image
```

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy on GitHub Pages

1. Push this folder to `main` on `github.com/amals1997/portfolio`.
2. In the repo, open **Settings → Pages**, set **Source** to *Deploy from a branch*, then pick `main` and `/ (root)`.
3. The site goes live at `https://amals1997.github.io/portfolio/`.

## Editing

- Contact email and LinkedIn: search `index.html` for `mailto:` and `linkedin`. The copy-email button reads its address from `data-email`.
- Projects: each `<article class="wcard">` in the Work section. The `data-sketch` attribute on its canvas picks the live visual.
- After changing CSS or JS, bump the `?v=` number on the asset links at the bottom of `index.html` so browsers fetch the new files.
