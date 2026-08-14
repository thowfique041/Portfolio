# Thowfiqur Bari Chowdhury — Portfolio

A dependency-free, responsive portfolio for an AI/ML and Generative AI student. It highlights verified projects, research interests, technical skills, and public profiles in a dark, research-oriented interface.

The project showcase is led by NexusRAG, with its implementation details verified against the public repository's ingestion, hybrid retrieval, reranking, multimodal, memory, FastAPI, and React code.

## Run locally

No build step or package installation is required.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## CV

Add the CV file at `public/Thowfiqur_CV.pdf`. The navigation and hero download buttons already point to that path.

## Structure

- `index.html` — semantic page content and metadata
- `style.css` — responsive design and reduced-motion support
- `script.js` — mobile navigation, sticky-header state, scroll reveals, and current year
- `favicon.svg` — site icon
- `images.png` — original avatar retained from the previous version
