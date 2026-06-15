"""Tests for the decision-vector <-> signal-plan encoding (delta.plan)."""
from __future__ import annotations

import numpy as np

from delta.network import build_example_city
from delta.plan import SignalPlan


def test_dim_matches_layout():
    """Vector dimension = sum of (phases + 1 offset) per intersection."""
    city = build_example_city(n_intersections=10, seed=0)
    plan = SignalPlan(city)
    expected = sum(i.n_phases + 1 for i in city.intersections)
    assert plan.dim == expected


def test_splits_sum_to_one_and_respect_min_green():
    """Every decoded intersection has splits summing to 1 and >= min-green floor."""
    city = build_example_city(n_intersections=20, seed=3)
    plan = SignalPlan(city)
    rng = np.random.default_rng(0)
    x = plan.bounds().sample(1, rng)[0]
    timings = plan.from_vector(x)
    for inter, t in zip(city.intersections, timings):
        assert np.isclose(t.splits.sum(), 1.0)
        min_frac = min(inter.min_green / t.cycle_length, 1.0 / inter.n_phases)
        assert np.all(t.splits >= min_frac - 1e-9)


def test_offset_within_cycle():
    """Offsets always fall in [0, cycle)."""
    city = build_example_city(n_intersections=15, seed=1)
    plan = SignalPlan(city)
    rng = np.random.default_rng(2)
    for x in plan.bounds().sample(5, rng):
        for t in plan.from_vector(x):
            assert 0.0 <= t.offset < t.cycle_length + 1e-9


def test_round_trip_recovers_timings():
    """to_vector(from_vector(x)) decodes to the same timings (encode is inverse)."""
    city = build_example_city(n_intersections=12, seed=5)
    plan = SignalPlan(city)
    rng = np.random.default_rng(7)
    x = plan.bounds().sample(1, rng)[0]
    timings = plan.from_vector(x)
    x2 = plan.to_vector(timings)
    timings2 = plan.from_vector(x2)
    for a, b in zip(timings, timings2):
        assert np.allclose(a.splits, b.splits, atol=1e-9)
        assert np.isclose(a.offset, b.offset, atol=1e-6)
        assert np.isclose(a.cycle_length, b.cycle_length)


def test_all_green_is_equal_split_zero_offset():
    """The all-green baseline is equal splits with zero offset everywhere."""
    city = build_example_city(n_intersections=8, seed=0)
    plan = SignalPlan(city)
    timings = plan.from_vector(plan.all_green())
    for inter, t in zip(city.intersections, timings):
        assert np.allclose(t.splits, 1.0 / inter.n_phases)
        assert np.isclose(t.offset, 0.0)


def test_bounds_are_unit_cube():
    """The search box is [0, 1]^dim."""
    city = build_example_city(n_intersections=6, seed=0)
    plan = SignalPlan(city)
    b = plan.bounds()
    assert np.allclose(b.lower, 0.0)
    assert np.allclose(b.upper, 1.0)
    assert b.dim == plan.dim


def test_optimize_cycle_adds_a_gene_per_intersection():
    """Enabling cycle optimisation grows the vector by one gene per junction."""
    city = build_example_city(n_intersections=10, seed=0)
    fixed = SignalPlan(city, optimize_cycle=False)
    variable = SignalPlan(city, optimize_cycle=True)
    assert variable.dim == fixed.dim + city.n_intersections
    rng = np.random.default_rng(0)
    x = variable.bounds().sample(1, rng)[0]
    for inter, t in zip(city.intersections, variable.from_vector(x)):
        lo, hi = inter.cycle_bounds
        assert lo - 1e-9 <= t.cycle_length <= hi + 1e-9
