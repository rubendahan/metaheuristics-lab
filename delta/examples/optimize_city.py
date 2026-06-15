"""End-to-end optimisation run on the example city.

Run with::

    python examples/optimize_city.py

Shows the multi-population PSO improving over the all-green baseline and over a
random search on the delay proxy, and prints a couple of decoded intersection
timings so you can see the structured plan the optimiser produced.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Allow running straight from a checkout (``python examples/optimize_city.py``)
# without installing the package first.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np

from delta import build_example_city, solve
from delta.plan import SignalPlan
from delta.simulator import DelayProxy
from delta.solver import random_baseline


def main() -> None:
    city = build_example_city(n_intersections=40, seed=0)
    plan = SignalPlan(city)
    sim = DelayProxy(city, plan)

    all_green = sim.evaluate(plan.all_green())
    rand_best = random_baseline(city, sim, plan, n=100, seed=1)

    outcome = solve(city, simulator=sim, max_iter=60, seed=0)
    best = outcome.result.best_f

    print("Optimisation on the delay proxy")
    print("-------------------------------")
    print(f"decision-vector dimension : {plan.dim}")
    print(f"all-green baseline delay  : {all_green:14.1f} veh-s")
    print(f"random-search best delay  : {rand_best:14.1f} veh-s")
    print(f"PSO optimised delay       : {best:14.1f} veh-s")
    print(f"evaluations used          : {outcome.result.n_evals}")

    # Decode and show the first two intersections' timings.
    timings = plan.from_vector(outcome.result.best_x)
    print("\nSample optimised timings:")
    for inter, t in list(zip(city.intersections, timings))[:2]:
        splits = np.array2string(t.splits, precision=3, suppress_small=True)
        print(
            f"  {inter.name}: splits={splits}, "
            f"offset={t.offset:5.1f}s, cycle={t.cycle_length:.0f}s"
        )


if __name__ == "__main__":
    main()
