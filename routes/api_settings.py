import json
from flask import Blueprint, jsonify, request, current_app, Response
from models.pihole import PiholeApiClient

api_settings_bp = Blueprint("api_settings", __name__, url_prefix="/api/settings")


def _get_client(instance_id) -> PiholeApiClient | None:
    manager = current_app.config["INSTANCE_MANAGER"]
    return manager.get_client(instance_id)


@api_settings_bp.route("/<instance_id>/config", methods=["GET"])
@api_settings_bp.route("/<instance_id>/config/<path:subpath>", methods=["GET"])
def get_config(instance_id, subpath=None):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    pi_path = "/config/" + subpath if subpath else "/config"
    try:
        resp = client.get(pi_path + "?detailed=true")
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/config", methods=["PATCH", "POST"])
def update_config(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request body"}), 400

    try:
        resp = client.patch("/config", json=data)
        if resp.status_code == 200:
            return jsonify(resp.json())
        try:
            return jsonify(resp.json()), resp.status_code
        except Exception:
            return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/dns/hosts", methods=["GET"])
def get_dns_hosts(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.get("/config/dns/hosts")
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/dns/hosts", methods=["POST"])
def add_dns_host(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    data = request.get_json()
    if not data or "ip" not in data or "hostname" not in data:
        return jsonify({"error": "Missing 'ip' and/or 'hostname'"}), 400

    item = data["ip"] + " " + data["hostname"]
    try:
        resp = client.put("/config/dns/hosts/" + item)
        if resp.status_code in (200, 201):
            return jsonify({"success": True, "item": item})
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/dns/hosts/<path:item>", methods=["DELETE"])
def delete_dns_host(instance_id, item):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.delete("/config/dns/hosts/" + item)
        if resp.status_code in (200, 204):
            return jsonify({"success": True})
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/dns/cnameRecords", methods=["GET"])
def get_dns_cnames(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.get("/config/dns/cnameRecords")
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/dns/cnameRecords", methods=["POST"])
def add_dns_cname(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    data = request.get_json()
    if not data or "cname" not in data or "target" not in data:
        return jsonify({"error": "Missing 'cname' and/or 'target'"}), 400

    item = data["cname"] + "," + data["target"]
    try:
        resp = client.put("/config/dns/cnameRecords/" + item)
        if resp.status_code in (200, 201):
            return jsonify({"success": True, "item": item})
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/dns/cnameRecords/<path:item>", methods=["DELETE"])
def delete_dns_cname(instance_id, item):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.delete("/config/dns/cnameRecords/" + item)
        if resp.status_code in (200, 204):
            return jsonify({"success": True})
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/dhcp/leases", methods=["GET"])
def get_dhcp_leases(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.get("/dhcp/leases")
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/dhcp/leases/<ip>", methods=["DELETE"])
def delete_dhcp_lease(instance_id, ip):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.delete("/dhcp/leases/" + ip)
        if resp.status_code in (200, 204):
            return jsonify({"success": True})
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/teleporter/export", methods=["GET"])
def teleporter_export(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.get("/teleporter", timeout=60)
        if resp.status_code == 200:
            return Response(
                resp.content,
                content_type=resp.headers.get("Content-Type", "application/zip"),
                headers={
                    "Content-Disposition": resp.headers.get(
                        "Content-Disposition", "attachment; filename=pi-hole-backup.zip"
                    )
                },
            )
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/teleporter/import", methods=["POST"])
def teleporter_import(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    import_opts = request.form.get("import", "{}")

    files = {"file": (file.filename, file.stream, file.content_type)}
    data = {"import": import_opts}

    try:
        resp = client.post("/teleporter", files=files, data=data, timeout=120)
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/action/gravity", methods=["POST"])
def action_gravity(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.post("/action/gravity", timeout=300)
        return Response(resp.content, content_type="text/plain")
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/action/restartdns", methods=["POST"])
def action_restartdns(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.post("/action/restartdns", timeout=30)
        if resp.status_code in (200, 204):
            return jsonify({"success": True, "message": "DNS restart initiated"})
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/action/flush/logs", methods=["POST"])
def action_flush_logs(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.post("/action/flush/logs", timeout=30)
        if resp.status_code in (200, 204):
            return jsonify({"success": True})
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/action/flush/arp", methods=["POST"])
def action_flush_arp(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.post("/action/flush/arp", timeout=30)
        if resp.status_code in (200, 204):
            return jsonify({"success": True})
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/info/metrics", methods=["GET"])
def get_metrics(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.get("/info/metrics")
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/adlists", methods=["GET"])
def get_adlists(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.get("/lists")
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/adlists", methods=["POST"])
def add_adlist(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    data = request.get_json()
    if not data or "address" not in data:
        return jsonify({"error": "Missing 'address' field"}), 400

    list_type = request.args.get("type", "block")
    try:
        resp = client.post("/lists?type=" + list_type, json=data)
        if resp.status_code in (200, 201):
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/adlists/<path:address>", methods=["PUT"])
def update_adlist(instance_id, address):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request body"}), 400

    list_type = request.args.get("type", "block")
    try:
        resp = client.put("/lists/" + address + "?type=" + list_type, json=data)
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/adlists/<path:address>", methods=["DELETE"])
def delete_adlist(instance_id, address):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    list_type = request.args.get("type", "block")
    try:
        resp = client.post("/lists:batchDelete", json=[{"item": address, "type": list_type}])
        if resp.status_code in (200, 204):
            return jsonify({"success": True})
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/groups", methods=["GET"])
def get_groups(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404
    try:
        resp = client.get("/groups")
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/groups", methods=["POST"])
def add_group(instance_id):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    data = request.get_json()
    if not data or "name" not in data:
        return jsonify({"error": "Missing 'name' field"}), 400

    try:
        resp = client.post("/groups", json=data)
        if resp.status_code in (200, 201):
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/groups/<path:name>", methods=["PUT"])
def update_group(instance_id, name):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request body"}), 400

    try:
        resp = client.put("/groups/" + name, json=data)
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@api_settings_bp.route("/<instance_id>/groups/<path:name>", methods=["DELETE"])
def delete_group(instance_id, name):
    client = _get_client(instance_id)
    if not client:
        return jsonify({"error": "Instance not found"}), 404

    try:
        resp = client.post("/groups:batchDelete", json=[{"item": name}])
        if resp.status_code in (200, 204):
            return jsonify({"success": True})
        return jsonify({"error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503
