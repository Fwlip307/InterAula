import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from engine import cluster, validate_features
from server import Handler


def samples():
    return [[round(base[j] + ((i+j) % 3 - 1) * .12, 2) for j in range(3)]
            for base in [[9.3, 6.5, 6.2], [6.3, 9.4, 6.4], [6.5, 6.3, 9.5]] for i in range(6)]


class EngineTests(unittest.TestCase):
    def test_real_kmeans_finds_three_distinct_profiles(self):
        result = cluster({"features": samples()})
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["k"], 3)
        self.assertGreater(result["silhouette"], .8)
        self.assertEqual(len(result["labels"]), 18)
        for start in [0, 6, 12]:
            self.assertEqual(len(set(result["labels"][start:start+6])), 1)
        self.assertEqual(len(set(result["labels"])), 3)
        self.assertEqual(result["centroids"], sorted(result["centroids"]))

    def test_small_population_stays_unclustered(self):
        result = cluster({"features": samples()[:5]})
        self.assertEqual(result["status"], "insufficient_data")
        self.assertEqual(result["labels"], [])

    def test_homogeneous_data_does_not_invent_groups(self):
        self.assertEqual(cluster({"features": [[8, 8, 8]] * 12})["status"], "homogeneous_data")

    def test_single_outlier_is_not_a_group(self):
        self.assertEqual(cluster({"features": [[8, 8, 8]] * 7 + [[2, 2, 2]]})["status"], "weak_structure")

    def test_cache_is_reproducible_and_cannot_be_modified_by_a_caller(self):
        first = cluster({"features": samples()})
        expected = json.loads(json.dumps(first))
        first["labels"][0] = 999
        first["centroids"][0][0] = -1
        self.assertEqual(cluster({"features": samples()}), expected)

    def test_invalid_features_and_identity_fields_are_rejected(self):
        for payload in [None, {"features": [], "email": "private@example.test"},
                        {"features": [[True, 5, 5]]}, {"features": [[float("nan"), 5, 5]]},
                        {"features": [[float("inf"), 5, 5]]}, {"features": [[11, 5, 5]]},
                        {"features": [[0, 5, 5]]}, {"features": [[5, 5]]},
                        {"features": [[5, 5, 5]] * 501}, {"features": "invalid"}]:
            with self.subTest(payload=str(payload)[:80]), self.assertRaises(ValueError):
                validate_features(payload)


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = "http://127.0.0.1:" + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(self, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.url + path, data=data, headers={"Content-Type": "application/json"})
        return urllib.request.urlopen(req, timeout=5)

    def test_health_and_real_http_prediction(self):
        with self.request("/health") as response:
            self.assertEqual(json.load(response)["status"], "ok")
        with self.request("/cluster", {"features": samples()}) as response:
            self.assertEqual(json.load(response)["k"], 3)

    def test_http_rejects_invalid_or_large_bodies(self):
        for payload, status in [({"features": [], "diagnosis": "not accepted"}, 400),
                                ({"features": "x" * 65536}, 413)]:
            with self.subTest(status=status), self.assertRaises(urllib.error.HTTPError) as error:
                self.request("/cluster", payload)
            self.assertEqual(error.exception.code, status)

    def test_unknown_routes_are_not_exposed(self):
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.request("/admin")
        self.assertEqual(error.exception.code, 404)


if __name__ == "__main__":
    unittest.main()
