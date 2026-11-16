"""Ephemeral K-Means over three aggregate ratings. No identities, files or model pickles."""
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
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

MIN_TUTORS = 6
MAX_TUTORS = 500
MIN_SILHOUETTE = 0.15  # Prototype structure threshold, not a measure of educational effectiveness.
MODEL_VERSION = "kmeans-ratings-v1"
_cache = OrderedDict()
_lock = threading.Lock()


def validate_features(payload):
    if not isinstance(payload, dict) or set(payload) != {"features"}:
        raise ValueError("Expected only a feature matrix")
    rows = payload["features"]
    if not isinstance(rows, list) or len(rows) > MAX_TUTORS:
        raise ValueError("Invalid population size")
    for row in rows:
        if not isinstance(row, list) or len(row) != 3:
            raise ValueError("Expected three scores")
        for value in row:
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 1 <= value <= 10:
                raise ValueError("Invalid score")
    return rows


def _empty(status, count, silhouette=None):
    return {"status": status, "labels": [], "centroids": [], "k": 0,
            "silhouette": silhouette, "trainingCount": count,
            "modelVersion": MODEL_VERSION, "libraryVersion": sklearn.__version__}


def cluster(payload):
    rows = validate_features(payload)
    if len(rows) < MIN_TUTORS:
        return _empty("insufficient_data", len(rows))
    key = hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()
    with _lock:
        previous = _cache.get(key)
        if previous and time.monotonic() - previous[0] < 300:
            _cache.move_to_end(key)
            return copy.deepcopy(previous[1])
        values = np.asarray(rows, dtype=float)
        unique = len(np.unique(values, axis=0))
        if unique < 2:
            return _empty("homogeneous_data", len(rows))
        scaler = StandardScaler()
        scaled = scaler.fit_transform(values)
        best = None
        with threadpool_limits(limits=1):
            for k in range(2, min(4, unique, len(rows) - 1) + 1):
                model = KMeans(n_clusters=k, random_state=42, n_init=20, max_iter=200)
                labels = model.fit_predict(scaled)
                if len(set(labels)) < 2 or min(np.bincount(labels)) < 2:
                    continue  # Avoid creating a profile around a single outlier.
                score = float(silhouette_score(scaled, labels))
                if best is None or score > best[0] + 1e-9:
                    best = (score, labels, scaler.inverse_transform(model.cluster_centers_))
        if best is None or best[0] < MIN_SILHOUETTE:
            result = _empty("weak_structure", len(rows), round(best[0], 6) if best else None)
        else:
            score, labels, centers = best
            # Canonical ordering makes group IDs reproducible; IDs do not mean quality levels.
            order = sorted(range(len(centers)), key=lambda i: tuple(np.round(centers[i], 8)))
            remap = {old: new for new, old in enumerate(order)}
            result = {"status": "ready", "labels": [remap[int(label)] for label in labels],
                      "centroids": [[round(float(x), 6) for x in centers[i]] for i in order],
                      "k": len(centers), "silhouette": round(score, 6), "trainingCount": len(rows),
                      "modelVersion": MODEL_VERSION, "libraryVersion": sklearn.__version__}
        _cache[key] = (time.monotonic(), result)
        _cache.move_to_end(key)
        while len(_cache) > 8:
            _cache.popitem(last=False)
        return copy.deepcopy(result)
