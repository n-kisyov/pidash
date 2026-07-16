from flask import Blueprint, jsonify, request, current_app
from models.pihole import PiholeApiClient

api_domains_bp = Blueprint("api_domains", __name__, url_prefix="/api")


@api_domains_bp.route("/domains/<instance_id>/<list_type>")
def get_domains(instance_id, list_type):
    if list_type not in ("allow", "deny"):
        return jsonify({"error": "Invalid list type"}), 400

    manager = current_app.config["INSTANCE_MANAGER"]
    client = manager.get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    kind = request.args.get("kind", "exact")
    try:
        resp = client.get(f"/domains/{list_type}/{kind}")
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_domains_bp.route("/domains/<instance_id>/<list_type>", methods=["POST"])
def add_domain(instance_id, list_type):
    if list_type not in ("allow", "deny"):
        return jsonify({"error": "Invalid list type"}), 400

    manager = current_app.config["INSTANCE_MANAGER"]
    client = manager.get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    data = request.get_json()
    if not data or "domain" not in data:
        return jsonify({"error": "Missing domain field"}), 400

    kind = data.get("kind", "exact")
    payload = {
        "domain": data["domain"],
        "type": list_type,
        "kind": kind,
        "comment": data.get("comment", "Added from pidash"),
        "enabled": data.get("enabled", True),
    }

    try:
        resp = client.post(f"/domains/{list_type}/{kind}", json=payload)
        if resp.status_code in (200, 201):
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_domains_bp.route("/domains/<instance_id>/<list_type>/<int:domain_id>", methods=["DELETE"])
def delete_domain(instance_id, list_type, domain_id):
    if list_type not in ("allow", "deny"):
        return jsonify({"error": "Invalid list type"}), 400

    manager = current_app.config["INSTANCE_MANAGER"]
    client = manager.get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    try:
        resp = client.delete(f"/domains/{list_type}/{domain_id}")
        if resp.status_code in (200, 204):
            return jsonify({"success": True})
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503
