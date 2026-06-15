"""``python -m delta``, an end-to-end demo of the Delta deliverable.

Builds the example city, prints how loaded it is, runs the multi-population PSO
on the delay proxy, and then runs the flat-ceiling diagnostic that captures our
key finding. Everything here uses only the package's public API.
"""
from __future__ import annotations

import numpy as np

from . import build_example_city, characterize, solve
from .plan import SignalPlan
from .simulator import DelayProxy


def main() -> None:
    print("=" * 70)
    print("Delta 2026, traffic-signal retiming demo (PROXY simulator)")
    print("=" * 70)

    # 1) Build the example city.
    city = build_example_city(n_intersections=40, seed=0)
    plan = SignalPlan(city)
    print(
        f"\nCity: {city.n_intersections} signalised intersections, "
        f"{city.n_phases_total} phases, decision vector dim = {plan.dim}, "
        f"{len(city.corridors)} coordinated corridors."
    )

    # 2) Show the baseline delays: naive all-green and the sane Webster plan.
    sim = DelayProxy(city, plan)
    all_green = sim.evaluate(plan.all_green())
    sane = sim.evaluate(plan.proportional())
    print(f"\nAll-green (equal-split) total delay : {all_green:,.1f} veh-seconds")
    print(f"Sane plan (Webster split)   total   : {sane:,.1f} veh-seconds")

    # 3) Optimise with the multi-population PSO used on Delta.
    print("\nOptimising with multi-population PSO (3 sub-swarms)...")
    outcome = solve(city, simulator=sim, max_iter=40, seed=0)
    print(
        f"  best delay     : {outcome.result.best_f:,.1f} veh-seconds\n"
        f"  evaluations    : {outcome.result.n_evals}\n"
        f"  optimiser      : {outcome.result.name}"
    )

    # 4) The flat-ceiling finding.
    print("\n" + "-" * 70)
    report = characterize(city, max_iter=40, seed=0)
    print(report.summary())
    print("-" * 70)
    print(
        "\nTakeaway: characterise the objective before optimising it. Here the\n"
        "network is undersaturated, so the optimisation ceiling is flat and the\n"
        "naive all-green plan is already near-optimal. Raise `load` in\n"
        "build_example_city() to create congestion and watch the gap open up."
    )


if __name__ == "__main__":
    np.set_printoptions(precision=4, suppress=True)
    main()
