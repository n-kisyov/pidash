from flask import Blueprint, render_template, current_app, redirect, url_for

pages_bp = Blueprint("pages", __name__)


@pages_bp.route("/")
def dashboard():
    return render_template("dashboard.html")


@pages_bp.route("/queries")
def queries():
    return render_template("queries.html")


@pages_bp.route("/domains")
def domains():
    return render_template("domains.html")


@pages_bp.route("/instances")
def instances():
    return render_template("instances.html")


@pages_bp.route("/settings")
def settings():
    return render_template("settings.html")


@pages_bp.route("/adlists")
def adlists():
    return render_template("adlists.html")


@pages_bp.route("/groups")
def groups():
    return render_template("groups.html")


@pages_bp.route("/search")
def search():
    return render_template("search.html")


@pages_bp.route("/system")
def system():
    return render_template("system.html")
