from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash

auth_bp = Blueprint("auth", __name__)


class User:
    def __init__(self, user_id):
        self.id = user_id
        self.is_authenticated = True
        self.is_active = True
        self.is_anonymous = False

    def get_id(self):
        return self.id


def get_anonymous_user():
    return User("anonymous")


def init_auth(login_manager, app):

    @login_manager.user_loader
    def load_user(user_id):
        return User(user_id)

    @login_manager.unauthorized_handler
    def unauthorized():
        if request.blueprint and request.blueprint.startswith("api_"):
            return {"error": "Unauthorized"}, 401
        return redirect(url_for("auth.login"))

    @app.before_request
    def check_auth():
        if request.path.startswith("/static/"):
            return
        auth_enabled = app.config.get("PIDASH_AUTH_ENABLED", False)
        if not auth_enabled and not current_user.is_authenticated:
            from flask_login import login_user
            login_user(get_anonymous_user())


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    from flask import current_app

    auth_enabled = current_app.config.get("PIDASH_AUTH_ENABLED", False)
    if not auth_enabled:
        return redirect(url_for("pages.dashboard"))

    if current_user.is_authenticated:
        return redirect(url_for("pages.dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        cfg_username = current_app.config.get("PIDASH_USERNAME", "")
        cfg_password_hash = current_app.config.get("PIDASH_PASSWORD_HASH", "")

        if username == cfg_username and check_password_hash(cfg_password_hash, password):
            login_user(User(username))
            return redirect(url_for("pages.dashboard"))
        flash("Invalid username or password", "error")

    return render_template("login.html")


@auth_bp.route("/logout")
def logout():
    logout_user()
    return redirect(url_for("auth.login"))
