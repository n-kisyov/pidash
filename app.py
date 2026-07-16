import json
import os
from flask import Flask
from flask_login import LoginManager
from models.pihole import InstanceManager
from routes.auth import auth_bp, init_auth
from routes.api_stats import api_stats_bp
from routes.api_queries import api_queries_bp
from routes.api_domains import api_domains_bp
from routes.api_system import api_system_bp
from routes.pages import pages_bp
from routes.api_settings import api_settings_bp


def create_app(config_path=None):
    basedir = os.path.abspath(os.path.dirname(__file__))
    app = Flask(
        __name__,
        static_folder=os.path.join(basedir, "static"),
        template_folder=os.path.join(basedir, "templates"),
    )

    if config_path is None:
        config_path = os.environ.get(
            "PIDASH_CONFIG", os.path.join(basedir, "config.json")
        )

    with open(config_path, "r") as f:
        config = json.load(f)

    app.config["SECRET_KEY"] = config.get("secret_key", os.urandom(24).hex())
    app.config["PIDASH_AUTH_ENABLED"] = config.get("auth_enabled", False)
    app.config["PIDASH_USERNAME"] = config.get("username", "admin")
    app.config["PIDASH_PASSWORD_HASH"] = config.get("password_hash", "")
    app.config["CONFIG_PATH"] = config_path

    instance_manager = InstanceManager(config_path)
    app.config["INSTANCE_MANAGER"] = instance_manager

    login_manager = LoginManager()
    login_manager.init_app(app)
    init_auth(login_manager, app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(api_stats_bp)
    app.register_blueprint(api_queries_bp)
    app.register_blueprint(api_domains_bp)
    app.register_blueprint(api_system_bp)
    app.register_blueprint(pages_bp)
    app.register_blueprint(api_settings_bp)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=8080, debug=True)
