from flask import Blueprint, jsonify, current_app, request
from services.aggregator import (
    aggregate_summary,
    aggregate_history,
    aggregate_history_clients,
    aggregate_query_types,
    aggregate_upstreams,
    aggregate_top_items,
    aggregate_ftl_info,
)

api_stats_bp = Blueprint("api_stats", __name__, url_prefix="/api")


def _get_single_client():
    instance_id = request.args.get("instance")
    if not instance_id:
        return None
    manager = current_app.config["INSTANCE_MANAGER"]
    return manager.get_client(instance_id)


def _single_or_aggregate(pi_path, aggregate_fn):
    client = _get_single_client()
    if client:
        try:
            resp = client.get(pi_path)
            if resp.status_code == 200:
                return jsonify(resp.json())
            return jsonify({"error": resp.text}), resp.status_code
        except Exception as e:
            return jsonify({"error": str(e)}), 503

    manager = current_app.config["INSTANCE_MANAGER"]
    data = aggregate_fn(manager)
    if data is None:
        return jsonify({"error": "No data available"}), 503
    return jsonify(data)


@api_stats_bp.route("/summary")
def summary():
    return _single_or_aggregate("/stats/summary", aggregate_summary)


@api_stats_bp.route("/history")
def history():
    return _single_or_aggregate("/history", aggregate_history)


@api_stats_bp.route("/history/clients")
def history_clients():
    return _single_or_aggregate("/history/clients", aggregate_history_clients)


@api_stats_bp.route("/query-types")
def query_types():
    return _single_or_aggregate("/stats/query_types", aggregate_query_types)


@api_stats_bp.route("/upstreams")
def upstreams():
    return _single_or_aggregate("/stats/upstreams", aggregate_upstreams)


@api_stats_bp.route("/top-domains")
def top_domains():
    client = _get_single_client()
    blocked = request.args.get("blocked", "false").lower() == "true"
    pi_path = "/stats/top_domains?blocked=true" if blocked else "/stats/top_domains"

    if client:
        try:
            resp = client.get(pi_path)
            if resp.status_code == 200:
                return jsonify(resp.json())
            return jsonify({"error": resp.text}), resp.status_code
        except Exception as e:
            return jsonify({"error": str(e)}), 503

    manager = current_app.config["INSTANCE_MANAGER"]
    data = aggregate_top_items(manager, pi_path, "domains")
    if data is None:
        return jsonify({"error": "No data available"}), 503
    return jsonify(data)


@api_stats_bp.route("/top-clients")
def top_clients():
    client = _get_single_client()
    blocked = request.args.get("blocked", "false").lower() == "true"
    pi_path = "/stats/top_clients?blocked=true" if blocked else "/stats/top_clients"

    if client:
        try:
            resp = client.get(pi_path)
            if resp.status_code == 200:
                return jsonify(resp.json())
            return jsonify({"error": resp.text}), resp.status_code
        except Exception as e:
            return jsonify({"error": str(e)}), 503

    manager = current_app.config["INSTANCE_MANAGER"]
    data = aggregate_top_items(manager, pi_path, "clients")
    if data is None:
        return jsonify({"error": "No data available"}), 503
    return jsonify(data)


@api_stats_bp.route("/ftl")
def ftl():
    return _single_or_aggregate("/info/ftl", aggregate_ftl_info)


@api_stats_bp.route("/search")
def search():
    domain = request.args.get("domain", "").strip()
    if not domain:
        return jsonify({"error": "Missing 'domain' query parameter"}), 400

    manager = current_app.config["INSTANCE_MANAGER"]
    instances = manager.get_all_instances()

    all_domains = []
    all_gravity = []
    total_results = 0
    errors = []

    for inst in instances:
        client = manager.get_client(inst["id"])
        if not client:
            continue
        try:
            resp = client.get(f"/search/{domain}?partial=true")
            if resp.status_code == 200:
                data = resp.json()
                search_data = data.get("search", {})
                for d in search_data.get("domains", []):
                    d["_instance_id"] = inst["id"]
                    d["_instance_name"] = inst["name"]
                    all_domains.append(d)
                for g in search_data.get("gravity", []):
                    g["_instance_id"] = inst["id"]
                    g["_instance_name"] = inst["name"]
                    all_gravity.append(g)
                total_results += search_data.get("results", {}).get("total", 0)
            else:
                errors.append({"instance": inst["name"], "error": resp.text})
        except Exception as e:
            errors.append({"instance": inst["name"], "error": str(e)})

    return jsonify({
        "search": {
            "domains": all_domains,
            "gravity": all_gravity,
            "results": {
                "total": total_results,
                "domains_count": len(all_domains),
                "gravity_count": len(all_gravity),
            },
        },
        "instance_count": len(instances),
        "errors": errors if errors else None,
    })
