import json
import os
import tempfile
import requests
from typing import Optional, Dict, Any, List


class PiholeApiClient:
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.session = requests.Session()

    def _headers(self) -> Dict[str, str]:
        headers = {}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    def get(self, path: str, **kwargs) -> requests.Response:
        return self.session.get(
            f"{self.base_url}/api{path}",
            headers=self._headers(),
            timeout=kwargs.pop("timeout", 5),
            **kwargs,
        )

    def post(self, path: str, **kwargs) -> requests.Response:
        return self.session.post(
            f"{self.base_url}/api{path}",
            headers=self._headers(),
            timeout=kwargs.pop("timeout", 5),
            **kwargs,
        )

    def patch(self, path: str, **kwargs) -> requests.Response:
        return self.session.patch(
            f"{self.base_url}/api{path}",
            headers=self._headers(),
            timeout=kwargs.pop("timeout", 5),
            **kwargs,
        )

    def put(self, path: str, **kwargs) -> requests.Response:
        return self.session.put(
            f"{self.base_url}/api{path}",
            headers=self._headers(),
            timeout=kwargs.pop("timeout", 5),
            **kwargs,
        )

    def delete(self, path: str, **kwargs) -> requests.Response:
        return self.session.delete(
            f"{self.base_url}/api{path}",
            headers=self._headers(),
            timeout=kwargs.pop("timeout", 5),
            **kwargs,
        )

    @staticmethod
    def test_connection(base_url: str, api_key: Optional[str] = None) -> bool:
        try:
            client = PiholeApiClient(base_url, api_key)
            resp = client.get("/dns/blocking", timeout=5)
            return resp.status_code == 200
        except Exception:
            return False


class InstanceManager:
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.instances: Dict[str, Dict[str, Any]] = {}
        self._clients: Dict[str, PiholeApiClient] = {}
        self._load()

    def _load(self):
        with open(self.config_path, "r") as f:
            config = json.load(f)
        self.instances = {inst["id"]: inst for inst in config.get("instances", [])}
        self._clients = {}

    def _atomic_save(self, config: dict):
        dirname = os.path.dirname(self.config_path)
        with tempfile.NamedTemporaryFile(
            mode="w", dir=dirname, delete=False, suffix=".tmp", encoding="utf-8"
        ) as tf:
            json.dump(config, tf, indent=2)
            tmpname = tf.name
        os.replace(tmpname, self.config_path)

    def _read_full_config(self) -> dict:
        with open(self.config_path, "r") as f:
            return json.load(f)

    def _ensure_fresh(self):
        self._load()

    def get_client(self, instance_id: str) -> Optional[PiholeApiClient]:
        self._ensure_fresh()
        if instance_id not in self.instances:
            return None
        if instance_id not in self._clients:
            inst = self.instances[instance_id]
            self._clients[instance_id] = PiholeApiClient(inst["url"], inst.get("api_key"))
        return self._clients[instance_id]

    def get_all_clients(self) -> List[PiholeApiClient]:
        self._ensure_fresh()
        return [self.get_client(iid) for iid in self.instances if self.get_client(iid)]

    def get_all_instances(self) -> List[Dict[str, Any]]:
        self._ensure_fresh()
        return list(self.instances.values())

    def add_instance(self, instance: dict):
        self._ensure_fresh()
        self.instances[instance["id"]] = instance
        config = self._read_full_config()
        config["instances"] = list(self.instances.values())
        self._atomic_save(config)

    def update_instance(self, instance_id: str, data: dict):
        self._ensure_fresh()
        if instance_id in self.instances:
            self.instances[instance_id].update(data)
            if instance_id in self._clients:
                del self._clients[instance_id]
            config = self._read_full_config()
            config["instances"] = list(self.instances.values())
            self._atomic_save(config)
            return True
        return False

    def remove_instance(self, instance_id: str):
        self._ensure_fresh()
        if instance_id in self.instances:
            del self.instances[instance_id]
            self._clients.pop(instance_id, None)
            config = self._read_full_config()
            config["instances"] = list(self.instances.values())
            self._atomic_save(config)
            return True
        return False
