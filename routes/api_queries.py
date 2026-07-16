import json
from flask import Blueprint, jsonify, request, current_app
from models.pihole import PiholeApiClient

api_queries_bp = Blueprint("api_queries", __name__, url_prefix="/api")


def _proxy_query(api_method):
    manager = current_app.config["INSTANCE_MANAGER"]

    all_queries = []
    all_errors = []
    instance_count = 0

    for inst in manager.get_all_instances():
        client = manager.get_client(inst["id"])
        if not client:
            continue
        instance_count += 1
        try:
            resp = api_method(client, request.args)
            if resp.status_code == 200:
                data = resp.json()
                queries = data.get("queries", []) if isinstance(data, dict) else []
                for q in queries:
                    q["_instance_id"] = inst["id"]
                    q["_instance_name"] = inst["name"]
                    all_queries.append(q)
            else:
                all_errors.append({"instance": inst["name"], "error": resp.text})
        except Exception as e:
            all_errors.append({"instance": inst["name"], "error": str(e)})

    all_queries.sort(key=lambda q: q.get("timestamp", 0), reverse=True)

    limit = request.args.get("limit", type=int)
    offset = request.args.get("offset", type=int)

    total = len(all_queries)
    if limit and offset is not None:
        all_queries = all_queries[offset : offset + limit]
    elif limit:
        all_queries = all_queries[:limit]

    return {
        "queries": all_queries,
        "total": total,
        "instance_count": instance_count,
        "errors": all_errors if all_errors else None,
    }


@api_queries_bp.route("/queries")
def queries():
    def do_get(client, args):
        params = []
        for key in ["from", "until", "client", "domain", "type", "status", "limit", "cursor"]:
            if key in args:
                params.append(f"{key}={args[key]}")
        qs = "&".join(params)
        path = "/queries" + ("?" + qs if qs else "")
        return client.get(path)

    data = _proxy_query(do_get)
    return jsonify(data)
