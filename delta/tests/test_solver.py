"""Tests for the solver glue (delta.solver) and the diagnostic (delta.analysis)."""
from __future__ import annotations

from delta.analysis import characterize
from delta.network import build_example_city
from delta.plan import SignalPlan
from delta.simulator import DelayProxy
from delta.solver import random_baseline, solve


def test_optimizer_beats_random_baseline():
    """The PSO should do at least as well as the best of many random plans."""
    city = build_example_city(n_intersections=20, seed=0, load=0.8)
    plan = SignalPlan(city)
    sim = DelayProxy(city, plan)

    rand_best = random_baseline(city, sim, plan, n=100, seed=1)
    outcome = solve(city, simulator=sim, max_iter=40, seed=0)

    assert outcome.result.best_f <= rand_best


def test_optimizer_not_worse_than_all_green():
    """Optimisation never ends up worse than the do-nothing baseline."""
    city = build_example_city(n_intersections=20, seed=0, load=0.8)
    plan = SignalPlan(city)
    sim = DelayProxy(city, plan)

    all_green = sim.evaluate(plan.all_green())
    outcome = solve(city, simulator=sim, max_iter=40, seed=0)
    # Allow a hair of slack for the stochastic optimiser.
    assert outcome.result.best_f <= all_green * 1.001


def test_solve_returns_consistent_outcome():
    """SolveOutcome carries a usable result and a matching encoder."""
    city = build_example_city(n_intersections=12, seed=0)
    outcome = solve(city, max_iter=10, seed=0)
    assert outcome.result.best_x.shape[0] == outcome.plan.dim
    # Decoding the best vector must yield one timing per intersection.
    timings = outcome.plan.from_vector(outcome.result.best_x)
    assert len(timings) == city.n_intersections


def test_flat_ceiling_at_low_load():
    """Undersaturated network -> optimiser buys < 1% over all-green."""
    city = build_example_city(n_intersections=30, seed=0, load=0.45)
    rep = characterize(city, max_iter=40, n_random=50, seed=0)
    assert rep.mean_saturation < 0.85
    assert rep.is_flat_ceiling(threshold=0.01)


def test_delay_grows_steeply_with_load():
    """Near capacity the objective is steep: total delay is far larger.

    This is the other half of the finding. At low load the delay is small and
    the ceiling is flat (nothing to optimise); as load rises toward capacity the
    delay, and hence the stakes of getting timing right, grows sharply.
    """
    low = characterize(
        build_example_city(n_intersections=30, seed=0, load=0.45),
        max_iter=40, n_random=50, seed=0,
    )
    high = characterize(
        build_example_city(n_intersections=30, seed=0, load=0.95),
        max_iter=40, n_random=50, seed=0,
    )
    # Delay rises super-linearly: the high-load network is far more expensive.
    assert high.sane_delay > 3.0 * low.sane_delay


def test_low_load_ceiling_stays_flat_with_budget():
    """At low load, extra optimiser budget does NOT open a gap (true flat ceiling).

    Even a generous budget cannot beat the sane demand-proportional plan by 1%
    when the network is undersaturated, the defining property of the finding.
    """
    city = build_example_city(n_intersections=30, seed=0, load=0.45)
    rep = characterize(city, max_iter=120, n_random=50, seed=0)
    assert rep.gap_fraction < 0.01
