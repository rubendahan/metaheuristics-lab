"""Reproduce the Delta "all-green is near-optimal" finding.

Run with::

    python examples/flat_ceiling.py

Runs the flat-ceiling diagnostic across a sweep of network loads. At low load
the network is undersaturated and the optimiser barely beats the do-nothing
all-green plan (a flat ceiling). As load approaches capacity, timing starts to
matter and the gap opens up, demonstrating both the finding and its boundary.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Allow running straight from a checkout without installing the package first.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from delta import build_example_city, characterize


def main() -> None:
    print("Flat-ceiling sweep: how much does optimisation buy vs. load?")
    print("=" * 64)
    print(f"{'load':>6} {'mean sat':>9} {'sane plan':>14} "
          f"{'optimised':>14} {'gain %':>8}  verdict")
    print("-" * 64)

    # The landscape gets steeper near capacity, so the optimiser needs a bigger
    # budget there to exploit it; give it one and let the gap speak for itself.
    for load in (0.40, 0.55, 0.70, 0.95, 1.10, 1.30):
        city = build_example_city(n_intersections=40, seed=0, load=load)
        budget = 80 if load < 0.8 else 250
        rep = characterize(city, max_iter=budget, seed=0)
        verdict = "flat ceiling" if rep.is_flat_ceiling() else "TIMING MATTERS"
        print(
            f"{load:>6.2f} {rep.mean_saturation:>9.3f} "
            f"{rep.sane_delay:>14.1f} {rep.optimized_delay:>14.1f} "
            f"{rep.gap_fraction * 100:>8.3f}  {verdict}"
        )

    print("-" * 64)
    print(
        "Undersaturated (mean sat < ~0.85) -> flat ceiling: a sane,\n"
        "demand-proportional plan ('give each movement its fair share of green,\n"
        "never needlessly stop anyone') is essentially optimal and the optimiser\n"
        "buys nothing. Only once the network is pushed to/over capacity does\n"
        "timing start to matter. The real Delta network lived in the flat regime,\n"
        "which is why the key deliverable was characterising the objective, not\n"
        "out-optimising it."
    )


if __name__ == "__main__":
    main()
