"""Educational example: Bayesian demand updating, a base-stock rule and an inventory simulation.

Standard library only. It is a teaching sketch, not a production system.

Assumptions (all of them are simplifications):
  * one item, one location, periodic review, integer lead time in periods
  * per-period demand is i.i.d. Normal(mu, sigma^2) with unknown mu and sigma^2
  * unmet demand is backordered (negative on-hand stock)
  * linear costs, in currency per unit per period: holding_cost and shortage_cost
  * no fixed ordering cost, no capacity limits, no supplier failures
"""
import math
import random
from dataclasses import dataclass


@dataclass(frozen=True)
class Posterior:
    """Normal-Inverse-Gamma parameters for (mu, sigma^2)."""
    mu: float
    kappa: float
    alpha: float
    beta: float


# Hypothetical, weak prior used for illustration. Replace it with your own and test how much it matters.
DEFAULT_PRIOR = Posterior(mu=100.0, kappa=1.0, alpha=2.0, beta=100.0)


def clean_demand(observations):
    """Return usable demand values.

    None and NaN mean "not observed" and are dropped. 0 means "demand was confirmed to be zero"
    and is kept. Negative or infinite values are errors, not data.
    """
    cleaned = []
    for x in observations:
        if x is None or (isinstance(x, float) and math.isnan(x)):
            continue
        if not math.isfinite(x) or x < 0:
            raise ValueError(f"invalid demand value: {x!r}")
        cleaned.append(float(x))
    if not cleaned:
        raise ValueError("no usable demand observations")
    return cleaned


def update(prior, observations):
    """Conjugate update of the Normal-Inverse-Gamma posterior."""
    xs = clean_demand(observations)
    n = len(xs)
    x_bar = sum(xs) / n
    ss = sum((x - x_bar) ** 2 for x in xs)
    kappa_n = prior.kappa + n
    return Posterior(
        mu=(prior.kappa * prior.mu + n * x_bar) / kappa_n,
        kappa=kappa_n,
        alpha=prior.alpha + n / 2,
        beta=prior.beta + 0.5 * ss + prior.kappa * n * (x_bar - prior.mu) ** 2 / (2 * kappa_n),
    )


def expected_variance(post):
    """Posterior mean of the per-period demand variance sigma^2 (needs alpha > 1)."""
    if post.alpha <= 1:
        raise ValueError("posterior mean of the variance is undefined for alpha <= 1")
    return post.beta / (post.alpha - 1)


def mean_scale2(post):
    """Squared scale of the Student-t posterior of the demand MEAN: uncertainty about the parameter."""
    return post.beta / (post.alpha * post.kappa)


def predictive_params(post, periods=1):
    """Student-t posterior predictive of total demand over `periods` periods: (df, loc, scale^2).

    It includes both parameter uncertainty and ordinary demand noise, so it is wider than mean_scale2.
    """
    scale2 = (post.beta / post.alpha) * (periods + periods ** 2 / post.kappa)
    return 2 * post.alpha, periods * post.mu, scale2


def sample_predictive_sum(post, periods, n, rng):
    """Draw n samples of total demand over `periods` periods from the posterior predictive."""
    out = []
    for _ in range(n):
        sigma2 = post.beta / rng.gammavariate(post.alpha, 1.0)  # Inverse-Gamma(alpha, beta)
        mu = rng.gauss(post.mu, math.sqrt(sigma2 / post.kappa))
        out.append(rng.gauss(periods * mu, math.sqrt(periods * sigma2)))
    return out


def base_stock_level(post, lead_time, holding_cost, shortage_cost, n=200_000, seed=1):
    """Order-up-to level S for inventory position (on hand + on order).

    With backorders and linear costs, the classical base-stock result sets S at the critical-ratio
    quantile q = shortage_cost / (shortage_cost + holding_cost) of demand over lead_time + 1 periods.
    Here that demand is the Bayesian predictive, estimated by sampling (seeded, so it is repeatable).
    """
    if lead_time < 0 or int(lead_time) != lead_time:
        raise ValueError("lead_time must be a non-negative integer")
    if holding_cost <= 0 or shortage_cost <= 0:
        raise ValueError("costs must be positive")
    q = shortage_cost / (shortage_cost + holding_cost)
    samples = sorted(sample_predictive_sum(post, lead_time + 1, n, random.Random(seed)))
    return max(0.0, samples[min(n - 1, int(q * n))])


def simulate(base_stock, demands, lead_time, initial_on_hand, holding_cost, shortage_cost):
    """Run the base-stock policy against given demands. Returns (rows, totals).

    Each period: (1) orders due this period arrive, (2) order up to base_stock, (3) demand occurs,
    (4) costs are charged on end-of-period stock. An order placed in period t arrives in period t + lead_time.
    """
    arrivals = {}
    on_hand = float(initial_on_hand)
    on_order = 0.0
    rows = []
    total_holding = total_shortage = 0.0
    for t, d in enumerate(demands):
        start = on_hand
        received = arrivals.pop(t, 0.0)
        on_hand += received
        on_order -= received
        order = max(0.0, base_stock - (on_hand + on_order))
        if order:
            if lead_time == 0:
                on_hand += order
            else:
                arrivals[t + lead_time] = arrivals.get(t + lead_time, 0.0) + order
                on_order += order
        on_hand -= d
        holding = holding_cost * max(on_hand, 0.0)
        shortage = shortage_cost * max(-on_hand, 0.0)
        total_holding += holding
        total_shortage += shortage
        rows.append({"t": t, "start": start, "received": received, "order": order, "demand": d,
                     "end": on_hand, "holding": holding, "shortage": shortage})
    totals = {"holding": total_holding, "shortage": total_shortage, "total": total_holding + total_shortage}
    return rows, totals
