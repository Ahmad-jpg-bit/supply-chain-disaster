import math
import random
import unittest

import bayes_inventory as bi


class CleanDemand(unittest.TestCase):
    def test_missing_dropped_zero_kept(self):
        self.assertEqual(bi.clean_demand([0, None, float("nan"), 5]), [0.0, 5.0])

    def test_empty_and_all_missing_raise(self):
        with self.assertRaises(ValueError):
            bi.clean_demand([])
        with self.assertRaises(ValueError):
            bi.clean_demand([None, float("nan")])

    def test_invalid_values_raise(self):
        for bad in (-1, float("inf")):
            with self.assertRaises(ValueError):
                bi.clean_demand([10, bad])


class Posterior(unittest.TestCase):
    # Hand calculation: n=4, mean 100, sum of squares 200, prior (100, 1, 2, 100)
    # kappa=5, mu=100, alpha=4, beta=100 + 0.5*200 + 0 = 200
    post = bi.update(bi.DEFAULT_PRIOR, [90, 110, 100, 100])

    def test_update_matches_hand_calculation(self):
        self.assertAlmostEqual(self.post.mu, 100.0)
        self.assertAlmostEqual(self.post.kappa, 5.0)
        self.assertAlmostEqual(self.post.alpha, 4.0)
        self.assertAlmostEqual(self.post.beta, 200.0)

    def test_expected_variance(self):
        self.assertAlmostEqual(bi.expected_variance(self.post), 200 / 3)

    def test_parameter_uncertainty_is_narrower_than_predictive(self):
        self.assertAlmostEqual(bi.mean_scale2(self.post), 10.0)        # 200 / (4 * 5)
        df, loc, scale2 = bi.predictive_params(self.post, 1)
        self.assertAlmostEqual(scale2, 60.0)                          # (200 / 4) * (1 + 1/5)
        self.assertEqual((df, loc), (8.0, 100.0))
        self.assertGreater(scale2, bi.mean_scale2(self.post))

    def test_missing_values_do_not_change_the_posterior(self):
        with_gaps = bi.update(bi.DEFAULT_PRIOR, [90, None, 110, 100, float("nan"), 100])
        self.assertEqual(with_gaps, self.post)

    def test_sampled_predictive_matches_student_t_quantile(self):
        # Lead time 2 -> 3 periods: loc 300, scale^2 = 50 * (3 + 9/5) = 240.
        # t(8) 0.90 quantile = 1.3968 (standard table) -> 300 + 1.3968 * sqrt(240) = 321.64
        s = bi.base_stock_level(self.post, lead_time=2, holding_cost=1.0, shortage_cost=9.0)
        self.assertAlmostEqual(s, 300 + 1.3968 * math.sqrt(240), delta=0.5)

    def test_base_stock_is_repeatable_and_validates_inputs(self):
        a = bi.base_stock_level(self.post, 1, 1.0, 4.0, n=5000, seed=7)
        b = bi.base_stock_level(self.post, 1, 1.0, 4.0, n=5000, seed=7)
        self.assertEqual(a, b)
        for args in ((-1, 1.0, 4.0), (1.5, 1.0, 4.0), (1, 0.0, 4.0), (1, 1.0, -1.0)):
            with self.assertRaises(ValueError):
                bi.base_stock_level(self.post, *args)


class Simulation(unittest.TestCase):
    def test_exact_cover_has_no_shortage(self):
        # Demand 10 per period, lead time 2, S = 30 = 3 periods of demand.
        rows, totals = bi.simulate(30, [10] * 5, 2, 30, holding_cost=1.0, shortage_cost=5.0)
        self.assertEqual([r["end"] for r in rows], [20, 10, 0, 0, 0])
        self.assertEqual(totals, {"holding": 30.0, "shortage": 0.0, "total": 30.0})

    def test_too_low_base_stock_creates_backorders(self):
        rows, totals = bi.simulate(20, [10] * 5, 2, 20, holding_cost=1.0, shortage_cost=5.0)
        self.assertEqual([r["end"] for r in rows], [10, 0, -10, -10, -10])
        self.assertEqual(totals, {"holding": 10.0, "shortage": 150.0, "total": 160.0})

    def test_inventory_balance_and_unit_conservation(self):
        rng = random.Random(3)
        demands = [max(0.0, rng.gauss(100, 20)) for _ in range(200)]
        for lead_time in (0, 1, 3):
            rows, _ = bi.simulate(350, demands, lead_time, 350, 1.0, 5.0)
            for r in rows:
                placed_now = r["order"] if lead_time == 0 else 0.0
                self.assertAlmostEqual(r["end"], r["start"] + r["received"] + placed_now - r["demand"])
            ordered = sum(r["order"] for r in rows)
            received = sum(r["received"] for r in rows) + (ordered if lead_time == 0 else 0.0)
            in_pipeline = ordered - received
            self.assertGreaterEqual(in_pipeline, -1e-9)
            self.assertAlmostEqual(rows[-1]["end"], 350 + received - sum(demands))

    def test_empty_demand_gives_empty_result(self):
        rows, totals = bi.simulate(10, [], 1, 5, 1.0, 1.0)
        self.assertEqual((rows, totals["total"]), ([], 0.0))


if __name__ == "__main__":
    unittest.main()
