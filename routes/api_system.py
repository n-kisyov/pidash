import json
from flask import Blueprint, jsonify, request, current_app
from models.pihole import PiholeApiClient

api_system_bp = Blueprint("api_system", __name__, url_prefix="/api")


@api_system_bp.route("/blocking")
def get_blocking():
    manager = current_app.config["INSTANCE_MANAGER"]
    instance_id = request.args.get("instance")
    instances = (
        [manager.instances[instance_id]]
        if instance_id and instance_id in manager.instances
        else manager.get_all_instances()
    )
    results = {}
    for inst in instances:
        client = manager.get_client(inst["id"])
        if not client:
            results[inst["id"]] = {"error": "Connection failed", "name": inst["name"]}
            continue
        try:
            resp = client.get("/dns/blocking")
            if resp.status_code == 200:
                data = resp.json()
                results[inst["id"]] = {
                    "name": inst["name"],
                    "blocking": data.get("blocking", "unknown"),
                    "timer": data.get("timer", None),
                }
            else:
                results[inst["id"]] = {"error": resp.text, "name": inst["name"]}
        except Exception as e:
            results[inst["id"]] = {"error": str(e), "name": inst["name"]}
    return jsonify(results)


@api_system_bp.route("/blocking/<instance_id>", methods=["POST", "PATCH"])
def set_blocking(instance_id):
    manager = current_app.config["INSTANCE_MANAGER"]
    client = manager.get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    data = request.get_json() or {}

    if request.method == "POST":
        blocking = data.get("blocking", False)
        timer = data.get("timer")
        payload = {"blocking": blocking, "timer": timer}
    else:
        payload = data

    try:
        resp = client.post("/dns/blocking", json=payload)
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_system_bp.route("/system/<instance_id>")
def get_system(instance_id):
    manager = current_app.config["INSTANCE_MANAGER"]
    client = manager.get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    try:
        resp = client.get("/info/system")
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_system_bp.route("/info/ftl/<instance_id>")
def get_ftl_info(instance_id):
    manager = current_app.config["INSTANCE_MANAGER"]
    client = manager.get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    try:
        resp = client.get("/info/ftl")
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_system_bp.route("/info/version/<instance_id>")
def get_version(instance_id):
    manager = current_app.config["INSTANCE_MANAGER"]
    client = manager.get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    try:
        resp = client.get("/info/version")
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_system_bp.route("/instance-status/<instance_id>")
def instance_status(instance_id):
    manager = current_app.config["INSTANCE_MANAGER"]
    client = manager.get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    try:
        resp = client.get("/dns/blocking", timeout=5)
        online = resp.status_code == 200
        return jsonify({
            "online": online,
            "instance_id": instance_id,
            "status_code": resp.status_code,
        })
    except Exception as e:
        return jsonify({
            "online": False,
            "instance_id": instance_id,
            "error": str(e),
        })


@api_system_bp.route("/instances")
def list_instances():
    manager = current_app.config["INSTANCE_MANAGER"]
    return jsonify(manager.get_all_instances())


@api_system_bp.route("/instances", methods=["POST"])
def add_instance():
    manager = current_app.config["INSTANCE_MANAGER"]
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request body"}), 400

    required = ["id", "name", "url"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    inst = {
        "id": data["id"],
        "name": data["name"],
        "url": data["url"].rstrip("/"),
        "api_key": data.get("api_key"),
    }
    manager.add_instance(inst)
    return jsonify(inst), 201


@api_system_bp.route("/instances/<instance_id>", methods=["PUT"])
def update_instance(instance_id):
    manager = current_app.config["INSTANCE_MANAGER"]
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request body"}), 400

    success = manager.update_instance(instance_id, data)
    if not success:
        return jsonify({"error": "Instance not found"}), 404
    return jsonify(manager.instances.get(instance_id, {}))


@api_system_bp.route("/instances/<instance_id>", methods=["DELETE"])
def delete_instance(instance_id):
    manager = current_app.config["INSTANCE_MANAGER"]
    success = manager.remove_instance(instance_id)
    if not success:
        return jsonify({"error": "Instance not found"}), 404
    return jsonify({"success": True})
