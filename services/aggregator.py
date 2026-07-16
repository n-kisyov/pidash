import time
from collections import defaultdict
from typing import Optional, Dict, Any, List
from models.pihole import PiholeApiClient


def _fetch_json(client: PiholeApiClient, path: str) -> Optional[dict]:
    try:
        resp = client.get(path)
        if resp.status_code == 200:
            return resp.json()
        return None
    except Exception:
        return None


def _fetch_all(clients: List[PiholeApiClient], path: str) -> List[tuple]:
    results = []
    for client in clients:
        data = _fetch_json(client, path)
        if data is not None:
            results.append((client, data))
    return results


def aggregate_summary(manager) -> Optional[dict]:
    clients = manager.get_all_clients()
    results = _fetch_all(clients, "/stats/summary")
    if not results:
        return None

    total_queries = 0
    blocked_queries = 0
    total_clients = 0
    active_clients = 0
    gravity_domains = 0
    gravity_last_update = 0

    for _, data in results:
        total_queries += data.get("queries", {}).get("total", 0)
        blocked_queries += data.get("queries", {}).get("blocked", 0)
        total_clients += data.get("clients", {}).get("total", 0)
        active_clients += data.get("clients", {}).get("active", 0)
        gravity_domains += max(0, data.get("gravity", {}).get("domains_being_blocked", 0))
        lu = data.get("gravity", {}).get("last_update", 0)
        if lu > gravity_last_update:
            gravity_last_update = lu

    pct_blocked = (blocked_queries / total_queries * 100) if total_queries > 0 else 0

    return {
        "queries": {
            "total": total_queries,
            "blocked": blocked_queries,
            "percent_blocked": round(pct_blocked, 2),
        },
        "clients": {
            "total": total_clients,
            "active": active_clients,
        },
        "gravity": {
            "domains_being_blocked": gravity_domains,
            "last_update": gravity_last_update,
        },
        "instance_count": len(results),
    }


def aggregate_history(manager) -> Optional[dict]:
    clients = manager.get_all_clients()
    results = _fetch_all(clients, "/history")
    if not results:
        return None

    merged = defaultdict(lambda: {"total": 0, "blocked": 0, "cached": 0, "forwarded": 0})

    for _, data in results:
        for entry in data.get("history", []):
            ts = entry["timestamp"]
            merged[ts]["total"] += entry.get("total", 0)
            merged[ts]["blocked"] += entry.get("blocked", 0)
            merged[ts]["cached"] += entry.get("cached", 0)
            merged[ts]["forwarded"] += entry.get("forwarded", 0)

    history = []
    for ts in sorted(merged.keys()):
        history.append({
            "timestamp": ts,
            "total": merged[ts]["total"],
            "blocked": merged[ts]["blocked"],
            "cached": merged[ts]["cached"],
            "forwarded": merged[ts]["forwarded"],
        })

    return {"history": history}


def aggregate_history_clients(manager) -> Optional[dict]:
    clients = manager.get_all_clients()
    results = _fetch_all(clients, "/history/clients")
    if not results:
        return None

    merged_clients = {}
    merged_history = defaultdict(lambda: defaultdict(int))

    for _, data in results:
        for ip, info in data.get("clients", {}).items():
            merged_clients[ip] = info
        for entry in data.get("history", []):
            ts = entry["timestamp"]
            for ip, count in entry.get("data", {}).items():
                merged_history[ts][ip] += count

    history = []
    for ts in sorted(merged_history.keys()):
        history.append({
            "timestamp": ts,
            "data": dict(merged_history[ts]),
        })

    return {"clients": merged_clients, "history": history}


def aggregate_query_types(manager) -> Optional[dict]:
    clients = manager.get_all_clients()
    results = _fetch_all(clients, "/stats/query_types")
    if not results:
        return None

    merged_types = defaultdict(int)
    for _, data in results:
        for qtype, count in data.get("types", {}).items():
            merged_types[qtype] += count

    return {"types": dict(merged_types)}


def aggregate_upstreams(manager) -> Optional[dict]:
    clients = manager.get_all_clients()
    results = _fetch_all(clients, "/stats/upstreams")
    if not results:
        return None

    merged = {}
    for _, data in results:
        for item in data.get("upstreams", []):
            key = f"{item.get('ip', '')}#{item.get('port', 0)}"
            if key not in merged:
                merged[key] = {
                    "ip": item.get("ip", ""),
                    "port": item.get("port", 0),
                    "name": item.get("name"),
                    "count": 0,
                }
            merged[key]["count"] += item.get("count", 0)

    upstreams = sorted(merged.values(), key=lambda x: x["count"], reverse=True)
    return {"upstreams": upstreams}


def aggregate_top_items(manager, path: str, key: str) -> Optional[dict]:
    clients = manager.get_all_clients()
    results = _fetch_all(clients, path)
    if not results:
        return None

    total_queries = 0
    merged = defaultdict(lambda: {"count": 0, "ip": "", "name": ""})

    for _, data in results:
        for item in data.get(key, []):
            k = item.get("domain") or item.get("ip") or item.get("name", "")
            merged[k]["count"] += item.get("count", 0)
            merged[k]["ip"] = item.get("ip", k)
            merged[k]["name"] = item.get("name", k)
        total_queries += data.get("total_queries", 0) or data.get("blocked_queries", 0)

    items = []
    for k, v in merged.items():
        item = {"count": v["count"]}
        if "domain" in [it.get("domain") for it in results[0][1].get(key, [{"domain": None}])]:
            item["domain"] = k
        else:
            item["ip"] = v["ip"]
            item["name"] = v["name"]
        items.append(item)

    items.sort(key=lambda x: x["count"], reverse=True)
    return {"total_queries": total_queries, key: items[:10]}


def aggregate_ftl_info(manager) -> Optional[dict]:
    clients = manager.get_all_clients()
    results = _fetch_all(clients, "/info/ftl")
    if not results:
        return None

    merged = {
        "database": {
            "groups": 0,
            "clients": 0,
            "lists": 0,
            "gravity": 0,
            "domains": {"allowed": {"enabled": 0}, "denied": {"enabled": 0}},
            "regex": {"allowed": {"enabled": 0}, "denied": {"enabled": 0}},
        },
        "query_frequency": 0.0,
        "privacy_level": 0,
        "uptime": 0,
        "pid": 0,
        "allow_destructive": True,
    }

    for _, data in results:
        ftl = data.get("ftl", {})
        db = ftl.get("database", {})
        merged["database"]["groups"] += db.get("groups", 0)
        merged["database"]["clients"] += db.get("clients", 0)
        merged["database"]["lists"] += db.get("lists", 0)
        merged["database"]["gravity"] += db.get("gravity", 0)
        merged["database"]["domains"]["allowed"]["enabled"] += (
            db.get("domains", {}).get("allowed", {}).get("enabled", 0)
        )
        merged["database"]["domains"]["denied"]["enabled"] += (
            db.get("domains", {}).get("denied", {}).get("enabled", 0)
        )
        merged["database"]["regex"]["allowed"]["enabled"] += (
            db.get("regex", {}).get("allowed", {}).get("enabled", 0)
        )
        merged["database"]["regex"]["denied"]["enabled"] += (
            db.get("regex", {}).get("denied", {}).get("enabled", 0)
        )
        merged["query_frequency"] += ftl.get("query_frequency", 0)
        merged["privacy_level"] = max(merged["privacy_level"], ftl.get("privacy_level", 0))
        merged["uptime"] = max(merged["uptime"], ftl.get("uptime", 0))
        merged["pid"] = ftl.get("pid", 0)
        if not ftl.get("allow_destructive", True):
            merged["allow_destructive"] = False

    return {"ftl": merged}
