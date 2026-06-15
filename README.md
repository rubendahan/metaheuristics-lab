<div align="center">

# 🐝 metaheuristics-lab

**Seven black-box optimisers, the theory behind each one, and the city traffic problem that started it all.**

**[→ Open the explainer](https://rubendahan.github.io/metaheuristics-lab/)** · **[→ Try the interactive Delta demo](https://rubendahan.github.io/metaheuristics-lab/delta/)**

![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)
![NumPy](https://img.shields.io/badge/NumPy-only-013243?logo=numpy&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

## What this is

This started at the **Delta 2026 hackathon**, set by **Mireo**: retime a whole
city's traffic signals so a fleet of vehicles loses as little total time as
possible over four hours. You submit a full plan, a simulator runs the city, and
you get back a single number. We threw every metaheuristic we knew at it, and the
most useful result was realising the problem barely needed optimising at all.

We kept the toolbox. This repository is the cleaned-up version of it, bundled as
one pack:

- **an explainer site** that teaches each optimiser with live, in-browser demos,
- **a small NumPy library** of the optimisers behind one consistent API,
- **the Delta traffic application**, with an interactive page and an honest
  stand-in for Mireo's simulator so the methods can be run on the real problem.

## The explainer site

The [`web/`](web/) folder is a static, zero-build page that explains every method
with typeset maths, hand-drawn figures, and demos that run the real algorithm on a
canvas: drag the inertia weight and watch a swarm converge, cool a simulated
annealing walker, evolve a population, watch a CMA-ES ellipse learn a valley, or
trace a Gaussian process as Bayesian optimisation picks its next point.

**[Open it live →](https://rubendahan.github.io/metaheuristics-lab/)**

## The library

Every optimiser minimises a scalar objective `f: ℝᵈ → ℝ` over a box and returns
the same `Result`, so swapping one for another is a one-line change.

```python
from metaheuristics import ParticleSwarm, CMAES, Bounds
from metaheuristics.benchmarks import rastrigin

bounds = Bounds(-5.12, 5.12, dim=10)

res = ParticleSwarm().minimize(rastrigin, bounds, seed=0)
print(res)            # Result(name='PSO', best_f=..., best_x=[...], n_evals=...)

res = CMAES().minimize(rastrigin, bounds, seed=0)   # same call, different engine
```

| Algorithm | Class | Family | Shines on |
|---|---|---|---|
| Particle Swarm | `ParticleSwarm`, `MultiSwarm` | swarm | multimodal, low effort |
| Genetic Algorithm | `GeneticAlgorithm` | evolutionary | rugged, multimodal |
| Differential Evolution | `DifferentialEvolution` | evolutionary | robust continuous default |
| Simulated Annealing | `SimulatedAnnealing` | single-point | escaping local minima cheaply |
| Hill Climbing (+ restarts) | `HillClimbing` | single-point | the honest baseline |
| CMA-ES | `CMAES` | evolution strategy | ill-conditioned, smooth (d ≲ 100) |
| Bayesian Optimisation | `BayesianOptimization` | surrogate | expensive objectives, few evals |

No optimiser wins everywhere, which is the No Free Lunch theorem in action. CMA-ES
dominates smooth, ill-conditioned valleys; the population methods dominate rugged
multimodal landscapes; Bayesian optimisation wins when each evaluation is
expensive and you only get a few dozen.

## The Delta application

[`delta/`](delta/) is the traffic-signal problem itself, packaged so it is useful
on its own. It contains the road-network model, the demand-proportional and
all-green baselines, a multi-population PSO wired to the library, the
flat-ceiling diagnostic, and an interactive page.

**The finding.** For the demand we were handed, the network was so far from
saturation that a sensible plan written in five minutes was within 1% of anything
our optimisers found. The lesson worth keeping is to characterise the objective
before optimising it. The interactive page lets you sweep the demand and watch
the optimiser's gain stay near zero until the city approaches capacity.

**[Try the interactive Delta demo →](https://rubendahan.github.io/metaheuristics-lab/delta/)**

**For Mireo.** The real objective is Mireo's mesoscopic simulator, which we do not
have, so the application ships a transparent Webster and HCM delay model with the
same query interface. To run on the real engine, implement one method,
`evaluate(plan_vector) -> float`, and pass it to the solver. Nothing else changes.
See [`delta/README.md`](delta/README.md).

## Repository layout

```
metaheuristics-lab/
  web/             the explainer site (vanilla HTML/CSS/canvas, hosted root)
  metaheuristics/  the optimiser library (NumPy only)
  examples/        leaderboard and convergence scripts
  tests/           39 tests for the library
  docs/            algorithm notes, API reference, benchmark results
  delta/           the Delta traffic application
    delta/         the Python package (network, plan, delay proxy, solver)
    web/           the interactive Delta page (React + Vite)
    tests/         19 tests for the application
```

## Running locally

```bash
# the library
pip install -e ".[dev]"
pytest -q                                 # 39 tests
python examples/compare_optimizers.py     # leaderboard on every benchmark

# the Delta application
cd delta
pip install -e ..                          # the library, then the app
pip install -e .
python -m delta                            # build a city, optimise, diagnose
pytest -q                                  # 19 tests

# the explainer site
#   just open web/index.html, or serve it: npm --prefix . run dev  (see package.json)

# the interactive Delta page
cd delta/web
npm install
npm run dev
```

## License

MIT. See [`LICENSE`](LICENSE).
