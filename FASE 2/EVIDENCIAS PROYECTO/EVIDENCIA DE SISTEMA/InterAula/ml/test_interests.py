import copy
import json
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer
from interests import cluster_interests
from server import Handler


def public_profiles():
    return [[int(j // 3 == group and (i % 3 != 0 or j % 3 != 2)) for j in range(9)]
            for group in range(3) for i in range(6)]


class InterestTests(unittest.TestCase):
    def test_public_interest_vectors_form_three_groups(self):
        result = cluster_interests({'features': public_profiles()})
        self.assertEqual(result['status'], 'ready')
        self.assertTrue(2 <= result['k'] <= 4)
        self.assertGreater(result['silhouette'], .7)
        self.assertEqual(result['trainingCount'], 18)
        self.assertTrue(all(len(row) == 9 for row in result['centroids']))
        families = {max(range(3), key=lambda i: sum(row[i*3:i*3+3])) for row in result['centroids']}
        self.assertEqual(families, {0, 1, 2})

    def test_reproducible_and_cache_cannot_be_mutated(self):
        data = {'features': public_profiles()}
        first = cluster_interests(data)
        expected = copy.deepcopy(first)
        first['centroids'][0][0] = 99
        self.assertEqual(cluster_interests(data), expected)

    def test_sparse_small_and_homogeneous_populations(self):
        self.assertEqual(cluster_interests({'features': []})['status'], 'insufficient_data')
        self.assertEqual(cluster_interests({'features': public_profiles()[:5]})['status'], 'insufficient_data')
        self.assertEqual(cluster_interests({'features': [[1, 0]] * 6})['status'], 'homogeneous_data')

    def test_rejects_private_fields_nonbinary_scores_and_unbounded_dimensions(self):
        for payload in [None, {'features': [], 'location': 'private'}, {'features': [[1, 0], [1]]},
                        {'features': [[0, 0]]}, {'features': [[1, True]]}, {'features': [[1, .5]]},
                        {'features': [[1, float('nan')]]}, {'features': [[1] * 129]},
                        {'features': [[1, 0]] * 151}]:
            with self.subTest(payload=str(payload)[:80]), self.assertRaises(ValueError):
                cluster_interests(payload)

    def test_single_outlier_does_not_create_an_interest_group(self):
        self.assertEqual(cluster_interests({'features': [[1, 0]] * 8 + [[0, 1]]})['status'], 'weak_structure')

    def test_real_http_interest_endpoint_preserves_rating_endpoint(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            request = urllib.request.Request(f'http://127.0.0.1:{server.server_port}/interests',
                data=json.dumps({'features': public_profiles()}).encode(), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=10) as response:
                result = json.load(response)
            self.assertEqual(result['modelVersion'], 'interests-kmeans-v1')
            self.assertTrue(2 <= result['k'] <= 4)
            self.assertNotIn('labels', result)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
