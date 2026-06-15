# Delta interactive page

The interactive page for the Delta traffic-signal problem: a small city you can
load up, a multi-population particle swarm that optimises the signal timings live,
and the flat-ceiling finding as a chart you can sweep. It is the React and Vite
front end that ships with the [`delta`](../) application.

Everything runs client-side. The delay model, the plan encoding, and the swarm
are ported to TypeScript under [`src/sim/`](src/sim/) from the Python package in
[`../delta/`](../delta/), so the page needs no backend.

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
```

The production build is deployed by the repository's GitHub Pages workflow and
served at `/without-a-gradient/delta/`, linked from the methods explainer.
