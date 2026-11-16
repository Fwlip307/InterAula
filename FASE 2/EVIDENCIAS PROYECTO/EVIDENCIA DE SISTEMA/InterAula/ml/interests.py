"""K-Means over public topic-presence vectors; no identities or private preferences."""
import copy
import hashlib
import json
import math
import threading
import time
from collections import OrderedDict

import numpy as np
import sklearn
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import normalize
from threadpoolctl import threadpool_limits

VERSION = 'interests-kmeans-v1'
MIN_PROFILES = 6
_cache = OrderedDict()
_lock = threading.Lock()


def cluster_interests(payload):
    if not isinstance(payload, dict) or set(payload) != {'features'}:
        raise ValueError('Only public feature vectors are accepted')
    rows = payload['features']
    if not isinstance(rows, list) or len(rows) > 150:
        raise ValueError('Invalid population')
    dimensions = len(rows[0]) if rows and isinstance(rows[0], list) else 0
    if rows and not 2 <= dimensions <= 128:
        raise ValueError('Invalid dimensions')
    for row in rows:
        if not isinstance(row, list) or len(row) != dimensions or not any(row):
            raise ValueError('Invalid vector')
        if any(isinstance(value, bool) or not isinstance(value, (int, float))
               or not math.isfinite(value) or value not in (0, 1) for value in row):
            raise ValueError('Expected binary topic presence')
    empty = {'status': 'insufficient_data', 'centroids': [], 'k': 0, 'silhouette': None,
             'trainingCount': len(rows), 'modelVersion': VERSION, 'libraryVersion': sklearn.__version__}
    if len(rows) < MIN_PROFILES:
        return empty
    key = hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()
    with _lock:
        cached = _cache.get(key)
        if cached and time.monotonic() - cached[0] < 300:
            _cache.move_to_end(key)
            return copy.deepcopy(cached[1])
        values = normalize(np.asarray(rows, dtype=float))
        distinct = len(np.unique(values, axis=0))
        if distinct < 2:
            return {**empty, 'status': 'homogeneous_data'}
        best = None
        with threadpool_limits(limits=1):
            for k in range(2, min(4, distinct, len(rows) - 1) + 1):
                model = KMeans(n_clusters=k, random_state=42, n_init=20, max_iter=200)
                labels = model.fit_predict(values)
                if len(set(labels)) < 2 or min(np.bincount(labels)) < 2:
                    continue
                silhouette = float(silhouette_score(values, labels))
                if best is None or silhouette > best[0] + 1e-9:
                    best = (silhouette, model.cluster_centers_)
        result = {**empty, 'status': 'weak_structure'}
        if best and best[0] >= .15:
            centers = sorted(best[1].tolist(), key=lambda row: tuple(round(x, 8) for x in row))
            result = {**empty, 'status': 'ready', 'centroids': [[round(x, 8) for x in row] for row in centers],
                      'k': len(centers), 'silhouette': round(best[0], 6)}
        elif best:
            result['silhouette'] = round(best[0], 6)
        _cache[key] = (time.monotonic(), result)
        _cache.move_to_end(key)
        while len(_cache) > 8:
            _cache.popitem(last=False)
        return copy.deepcopy(result)
