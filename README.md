# Thowfiqur Bari Chowdhury — Portfolio

Personal portfolio of **Thowfiqur Bari Chowdhury (MTBC)** — Full-Stack Developer | AI/ML Engineer.
Production web apps with React, Next.js, NestJS, Express, FastAPI, PostgreSQL and MongoDB, plus RAG, agentic AI and machine-learning work.

**Live:** [thowfique041.github.io/Portfolio](https://thowfique041.github.io/Portfolio/) · hosted on GitHub Pages

![Portfolio preview](assets/og-image.png)

## Highlights

- **Midnight Blue design system** — dark (default) and a dedicated light theme, toggled from the navigation, saved in `localStorage`, following the OS preference until the visitor chooses, and applied before first paint (no theme flash).
- **Interactive 3D background** (`bg3d.js`, Three.js) — the camera glides through the page as you scroll, anchored to each section: lit geometric solids, a self-typing NestJS controller, a live system architecture with request packets, a tech-stack orbit, a deploy terminal and git graph, a neural network, and a globe.
- **Hero** — identity, headline, three CTAs (Explore My Work / Download CV / Contact Me), floating tech badges, mouse-parallax portrait card and a scroll cue.
- **Projects** — four featured case studies (HalkaBite, NexusRAG, LateGenues, DentalFlow) with problem, key features, architecture and stack; six more projects; All / Full-stack / AI-ML filters.
- **Experience timeline**, four skill groups (no fake percentages), research interests kept separate from ongoing work and competitions, education card, contact section with copy-to-clipboard.
- **Scroll animations** with GSAP + ScrollTrigger (section reveals, staggered cards, timeline fill, subtle media parallax, scroll-progress bar) — with an IntersectionObserver fallback.

## Performance, accessibility & robustness

- No build step; plain HTML/CSS/JS. Three.js and GSAP are loaded from CDNs; three.js is lazy-loaded only on devices with WebGL and without Data Saver.
- 3D: device-pixel-ratio capped, fewer particles + 30 fps cap on phones, heavy panels skipped on phones, rendering paused while the tab is hidden, only nearby objects animate, all GPU resources disposed on theme change, context-loss handled.
- Fallbacks: no WebGL → animated CSS gradient background; CDN unavailable → IntersectionObserver reveals; JavaScript disabled → all content visible.
- `prefers-reduced-motion`: no entrance/scroll animations, still 3D frame.
- Semantic landmarks, one `h1`, ordered headings, skip link, visible focus states, accessible theme toggle and mobile menu (Esc closes, focus management), alt text, AA colour contrast in both themes, ≥ 40 px touch targets.
- SEO: title, description, canonical, Open Graph + Twitter card (`assets/og-image.png`), JSON-LD `Person`, SVG favicon + Apple touch icon.

## Project structure

```text
Portfolio/
├── index.html                 # all content and markup
├── style.css                  # design tokens (dark + light), layout, components
├── script.js                  # theme, navigation, filters, animations, lazy 3D loader
├── bg3d.js                    # Three.js scene (ES module)
├── favicon.svg
├── images.png                 # previous avatar (no longer used on the page)
├── assets/
│   ├── og-image.png           # social preview 1200×630
│   ├── apple-touch-icon.png
│   └── projects/              # project screenshots (WebP)
└── public/
    └── Thowfiqur_CV.pdf       # served by every "Download CV" button
```

All paths are relative, so the site works under the GitHub Pages sub-path `/Portfolio/`.

## Customising

- **Profile photo:** add the image (for example `assets/profile.webp`, portrait ~800×1000) and set `data-photo="assets/profile.webp"` on the `.portrait` element in `index.html`. The MTBC monogram is replaced automatically.
- **Project screenshots:** each mockup in `index.html` has a comment marking where to swap in an `<img>`; DentalFlow already uses a real screenshot from its repository.
- **CV:** replace `public/Thowfiqur_CV.pdf` (keep the file name).
- **Colours:** edit the tokens at the top of `style.css`; the 3D scene reads the same variables.

## Run locally

```bash
git clone https://github.com/thowfique041/Portfolio.git
cd Portfolio
python3 -m http.server 8000
```

Open <http://localhost:8000>. (Opening `index.html` directly from disk will not load the 3D module, because browsers block ES-module imports from `file://`.)

## Deploy (GitHub Pages)

The site deploys from the `main` branch root.

```bash
git checkout main
git merge redesign          # or open a pull request from `redesign` and merge it on GitHub
git push origin main
```

Then check **Settings → Pages**: *Source: Deploy from a branch*, *Branch: `main` / `(root)`*. The new version is live within a few minutes; use a hard refresh (`Ctrl + Shift + R`) if the old one is cached.

## Connect

- Email: [thowfiqurbarrychowdhury@gmail.com](mailto:thowfiqurbarrychowdhury@gmail.com)
- GitHub: [github.com/thowfique041](https://github.com/thowfique041)
- LinkedIn: [thowfiqur-bary-chowdhury](https://www.linkedin.com/in/thowfiqur-bary-chowdhury-06b75b339/)
- Kaggle: [kaggle.com/thowfiq041](https://www.kaggle.com/thowfiq041)

## License

Not specified.
