let queryOffset = 0;
const QUERY_LIMIT = 50;

function statusBadge(status) {
    const map = {
        '1': { class: 'bg-danger', text: 'Blocked' },
        '2': { class: 'bg-warning text-dark', text: 'Permitted (blocklist)' },
        '3': { class: 'bg-success', text: 'Cached' },
        '4': { class: 'bg-info text-dark', text: 'Forwarded' },
        '5': { class: 'bg-secondary', text: 'Retried' },
        '6': { class: 'bg-secondary', text: 'Retried' },
        blocked: { class: 'bg-danger', text: 'Blocked' },
        permitted: { class: 'bg-success', text: 'Permitted' },
        cached: { class: 'bg-primary', text: 'Cached' },
        forwarded: { class: 'bg-info text-dark', text: 'Forwarded' },
    };
    const s = map[String(status)] || { class: 'bg-secondary', text: String(status) };
    return `<span class="badge ${s.class}">${s.text}</span>`;
}

function formatTimestamp(ts) {
    if (!ts) return '--';
    return new Date(ts * 1000).toLocaleString();
}

async function loadQueries(reset = true) {
    if (reset) {
        queryOffset = 0;
        document.getElementById('queries-tbody').innerHTML = '';
    }

    const loading = document.getElementById('queries-loading');
    loading.classList.remove('d-none');

    const params = new URLSearchParams();
    params.set('limit', QUERY_LIMIT);
    params.set('offset', queryOffset);

    const domain = document.getElementById('filter-domain').value.trim();
    const client = document.getElementById('filter-client').value.trim();
    const status = document.getElementById('filter-status').value;
    const type = document.getElementById('filter-type').value;

    if (domain) params.set('domain', domain);
    if (client) params.set('client', client);
    if (status) params.set('status', status);
    if (type) params.set('type', type);

    try {
        const data = await apiGet('/api/queries?' + params.toString());
        loading.classList.add('d-none');

        if (!data || !data.queries) {
            document.getElementById('queries-count').textContent = 'Error loading data';
            return;
        }

        const tbody = document.getElementById('queries-tbody');
        for (const q of data.queries) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="white-space: nowrap;">${formatTimestamp(q.timestamp)}</td>
                <td><small class="text-muted">${escapeHtml(q._instance_name || q._instance_id || '')}</small></td>
                <td><span class="badge bg-light text-dark">${escapeHtml(String(q.type))}</span></td>
                <td><a href="#" class="query-filter-link" data-filter="domain" data-value="${escapeHtml(String(q.domain || '.'))}">${escapeHtml(String(q.domain || '.'))}</a></td>
                <td><a href="#" class="query-filter-link" data-filter="client" data-value="${escapeHtml(String(q.client || '--'))}">${escapeHtml(String(q.client || '--'))}</a></td>
                <td>${statusBadge(q.status)}</td>
                <td><small class="text-muted">${escapeHtml(String(q.upstream || '--'))}</small></td>
            `;
            tbody.appendChild(row);
        }

        queryOffset += data.queries.length;
        document.getElementById('queries-count').textContent =
            `${queryOffset} of ${formatNumber(data.total)} results${data.errors ? ' (some instances failed)' : ''}`;

        const loadMoreBtn = document.getElementById('load-more-btn');
        loadMoreBtn.classList.toggle('d-none', queryOffset >= data.total);
    } catch (err) {
        loading.classList.add('d-none');
        document.getElementById('queries-count').textContent = 'Error: ' + err.message;
    }
}

function loadMoreQueries() {
    loadQueries(false);
}

document.addEventListener('DOMContentLoaded', () => {
    loadQueries();
    setInterval(() => {
        if (document.getElementById('live-toggle')?.checked) {
            loadQueries();
        }
    }, 30000);

    document.getElementById('queries-tbody').addEventListener('click', (e) => {
        const link = e.target.closest('.query-filter-link');
        if (!link) return;
        e.preventDefault();
        const filter = link.dataset.filter;
        const value = link.dataset.value;
        if (filter === 'domain') {
            document.getElementById('filter-domain').value = value;
        } else if (filter === 'client') {
            document.getElementById('filter-client').value = value;
        }
        loadQueries();
    });
});
