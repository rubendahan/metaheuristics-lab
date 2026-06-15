"""Encoding between a structured signal plan and a flat decision vector.

The optimiser in :mod:`metaheuristics` works on a plain ``numpy`` vector
``x in [lower, upper]^d`` (a :class:`metaheuristics.Bounds` box). The simulator,
on the other hand, wants a *structured* plan: per intersection, a set of green
splits that sum to 1, plus an offset. This module is the bridge.

Layout of the decision vector
-----------------------------
For each intersection (in network order) we store, contiguously:

* ``n_phases`` **raw split weights** in ``[0, 1]``. These are *not* the splits
  themselves, they are normalised (and floored at ``min_green``) inside
  :meth:`SignalPlan.from_vector` so that the splits always sum to 1 and always
  respect the minimum-green constraint. Optimising *unconstrained* weights and
  normalising afterward is far friendlier to a box-constrained metaheuristic
  than trying to enforce a sum-to-one equality constraint directly.
* one **offset** in ``[0, 1]``, later scaled to ``[0, cycle_length)`` seconds.
* optionally one **cycle-length** value in ``[0, 1]``, scaled to
  ``[C_min, C_max]`` seconds, when ``optimize_cycle`` is set.

Keeping the whole vector in ``[0, 1]`` (a unit hypercube) means a single, clean
:class:`metaheuristics.Bounds` describes the search space and every coordinate
has the same scale, which helps the swarm move sensibly in all 300+ dimensions.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np
from metaheuristics import Bounds

from .network import RoadNetwork


@dataclass
class IntersectionTiming:
    """The decoded, physical timing of one intersection.

    Attributes
    ----------
    splits:
        Green split per phase, summing to 1, each ``>= min_green / cycle``.
    offset:
        Offset in seconds, in ``[0, cycle_length)``.
    cycle_length:
        Cycle length in seconds.
    """

    splits: np.ndarray
    offset: float
    cycle_length: float


class SignalPlan:
    """A full city signal plan and its mapping to/from the decision vector.

    A :class:`SignalPlan` is built for a given :class:`RoadNetwork`; it knows the
    network's phase counts and bounds, so it can translate any unit-cube vector
    into physically valid intersection timings and back.
    """

    def __init__(self, network: RoadNetwork, optimize_cycle: bool = False):
        self.network = network
        self.optimize_cycle = optimize_cycle
        # Per-intersection block size: one weight per phase, one offset,
        # plus (optionally) one cycle-length gene.
        self._block_sizes = [
            inter.n_phases + 1 + (1 if optimize_cycle else 0)
            for inter in network.intersections
        ]
        self._offsets = np.cumsum([0] + self._block_sizes)  # block start indices

    @property
    def dim(self) -> int:
        """Dimensionality of the decision vector (the search space)."""
        return int(self._offsets[-1])

    def bounds(self) -> Bounds:
        """The search box: a unit hypercube ``[0, 1]^dim``.

        Every gene lives in ``[0, 1]``; the physical meaning (split fraction,
        offset, cycle) is recovered in :meth:`from_vector`. A unit cube keeps all
        coordinates on the same scale, which is what the swarm expects.
        """
        return Bounds(0.0, 1.0, dim=self.dim)

    def from_vector(self, x: np.ndarray) -> List[IntersectionTiming]:
        """Decode a unit-cube vector into valid per-intersection timings.

        The two physical constraints are enforced here, not by the optimiser:

        1. **Splits sum to 1.** Raw weights are normalised. If every weight for
           an intersection is ~0 we fall back to an equal split.
        2. **Minimum green.** Each split is floored at ``min_green / cycle`` and
           the result re-normalised, so no phase is starved below its safety
           minimum.
        """
        x = np.asarray(x, dtype=float)
        timings: List[IntersectionTiming] = []

        for k, inter in enumerate(self.network.intersections):
            start = int(self._offsets[k])
            n = inter.n_phases
            weights = x[start:start + n]

            # Cycle length: either a decoded gene or the fixed nominal value.
            if self.optimize_cycle:
                c_gene = x[start + n + 1]
                c_min, c_max = inter.cycle_bounds
                cycle = c_min + c_gene * (c_max - c_min)
            else:
                cycle = inter.cycle_length

            # --- splits sum to 1 ---
            total = weights.sum()
            if total <= 1e-9:
                splits = np.full(n, 1.0 / n)
            else:
                splits = weights / total

            # --- minimum green floor ---
            # Reserve the minimum green for every phase first, then distribute
            # the *remaining* fraction in proportion to the weights. This makes
            # the constraint exact (every split >= min_frac, splits sum to 1)
            # and idempotent, so encode->decode round-trips cleanly. The floor
            # is capped at 1/n so n phases can always fit.
            min_frac = min(inter.min_green / cycle, 1.0 / n)
            free = 1.0 - n * min_frac          # fraction left to allocate
            splits = min_frac + free * splits  # splits still sum to 1

            # Offset gene -> seconds in [0, cycle).
            offset_gene = x[start + n]
            offset = float(offset_gene * cycle)

            timings.append(
                IntersectionTiming(splits=splits, offset=offset, cycle_length=cycle)
            )

        return timings

    def to_vector(self, timings: List[IntersectionTiming]) -> np.ndarray:
        """Encode explicit timings back into a unit-cube vector.

        Exact inverse of :meth:`from_vector`: it strips the reserved minimum
        green back out of each split to recover the raw, sum-to-one weights, so
        ``from_vector(to_vector(t)) == t``.
        """
        x = np.zeros(self.dim)
        for k, (inter, t) in enumerate(zip(self.network.intersections, timings)):
            start = int(self._offsets[k])
            n = inter.n_phases
            cycle = t.cycle_length
            # Undo the min-green allocation to get the underlying weights.
            min_frac = min(inter.min_green / cycle, 1.0 / n)
            free = 1.0 - n * min_frac
            if free > 1e-12:
                weights = (t.splits - min_frac) / free
            else:
                weights = np.full(n, 1.0 / n)
            x[start:start + n] = np.clip(weights, 0.0, 1.0)
            x[start + n] = (t.offset / t.cycle_length) % 1.0
            if self.optimize_cycle:
                c_min, c_max = inter.cycle_bounds
                span = max(c_max - c_min, 1e-9)
                x[start + n + 1] = np.clip((t.cycle_length - c_min) / span, 0.0, 1.0)
        return x

    def all_green(self) -> np.ndarray:
        """The literal "all-green / never stop anyone" baseline as a vector.

        Give every phase an *equal* share of the cycle and a zero offset, i.e.
        make no attempt to favour any movement, the simplest possible plan. It
        is the naive do-nothing reference. See also :meth:`proportional`.
        """
        timings = [
            IntersectionTiming(
                splits=np.full(inter.n_phases, 1.0 / inter.n_phases),
                offset=0.0,
                cycle_length=inter.cycle_length,
            )
            for inter in self.network.intersections
        ]
        return self.to_vector(timings)

    def proportional(self) -> np.ndarray:
        """The "sane plan" baseline: green split proportional to demand.

        This is Webster's textbook rule of thumb, give each phase a share of
        the cycle proportional to its critical flow ratio ``q/s``, with zero
        offset. It is what a traffic engineer writes down in five minutes
        **without any optimisation at all**. The Delta finding is that on an
        undersaturated network this sane plan is already within <1% of what an
        expensive optimiser can achieve (see :mod:`delta.analysis`): the
        "never stop anyone" idea, expressed as a fair share of green per
        movement, is essentially the answer.
        """
        timings = []
        for inter in self.network.intersections:
            y = np.array([p.max_flow_ratio for p in inter.phases], dtype=float)
            y = np.where(y <= 0.0, 1e-6, y)  # avoid a zero-demand division
            splits = y / y.sum()
            timings.append(
                IntersectionTiming(
                    splits=splits, offset=0.0, cycle_length=inter.cycle_length
                )
            )
        return self.to_vector(timings)
