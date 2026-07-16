function escapeHtml(text) {
    if (text == null) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, function (ch) { return map[ch]; });
}

function formatNumber(n) {
    return new Intl.NumberFormat().format(n);
}

function formatPercent(n) {
    return Number(n).toFixed(1) + '%';
}

function timeAgo(unixSeconds) {
    if (!unixSeconds || unixSeconds <= 0) return 'Never';
    const now = Math.floor(Date.now() / 1000);
    const diff = now - unixSeconds;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
}

async function apiGet(path) {
    const resp = await fetch(path);
    if (!resp.ok) {
        if (resp.status === 401) {
            window.location.reload();
            return null;
        }
        console.error('apiGet failed:', resp.status, path);
        try { return await resp.json(); } catch { return null; }
    }
    return resp.json();
}

async function apiPost(path, data) {
    const resp = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!resp.ok) {
        console.error('apiPost failed:', resp.status, path);
    }
    try { return await resp.json(); } catch { return { error: 'Invalid server response' }; }
}

async function apiDelete(path) {
    const resp = await fetch(path, { method: 'DELETE' });
    if (!resp.ok) {
        console.error('apiDelete failed:', resp.status, path);
    }
    try { return await resp.json(); } catch { return { error: 'Invalid server response' }; }
}

async function apiPut(path, data) {
    const resp = await fetch(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!resp.ok) {
        console.error('apiPut failed:', resp.status, path);
    }
    try { return await resp.json(); } catch { return { error: 'Invalid server response' }; }
}

async function apiPatch(path, data) {
    const resp = await fetch(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!resp.ok) {
        console.error('apiPatch failed:', resp.status, path);
    }
    try { return await resp.json(); } catch { return { error: 'Invalid server response' }; }
}

(function initTheme() {
    const stored = localStorage.getItem('pidash-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-bs-theme', theme);
    updateThemeIcon(theme);

    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('theme-toggle');
        if (btn) {
            btn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-bs-theme');
                const next = current === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-bs-theme', next);
                localStorage.setItem('pidash-theme', next);
                updateThemeIcon(next);
            });
        }
    });
})();

function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.innerHTML = theme === 'dark'
        ? '<i class="bi bi-sun-fill"></i>'
        : '<i class="bi bi-moon-stars-fill"></i>';
}

function showToast(title, message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const id = 'toast-' + Date.now();
    const bgClass = type === 'error' ? 'bg-danger text-white' :
                    type === 'warning' ? 'bg-warning text-dark' :
                    'bg-info text-white';

    const html = `
        <div id="${id}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header ${bgClass}">
                <strong class="me-auto">${escapeHtml(title)}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">${escapeHtml(message)}</div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);

    const toastEl = document.getElementById(id);
    const toast = new bootstrap.Toast(toastEl, { delay: 8000 });
    toast.show();

    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}
