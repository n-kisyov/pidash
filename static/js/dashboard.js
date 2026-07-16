let queriesOverTimeChart = null;
let queryTypesChart = null;
let upstreamsChart = null;
let clientsChart = null;
let selectedInstance = '';
let selectedTimeRange = 6;

const CHART_COLORS = [
    '#0d6efd', '#dc3545', '#198754', '#ffc107', '#0dcaf0',
    '#6f42c1', '#fd7e14', '#20c997', '#d63384', '#6610f2',
    '#e83e8c', '#17a2b8', '#28a745', '#ffc107', '#6c757d',
    '#007bff', '#e74c3c', '#2ecc71', '#9b59b6', '#1abc9c',
];

const CACHED_COLOR = '#0d6efd';
const BLOCKED_COLOR = '#dc3545';
const FORWARDED_COLOR = '#0dcaf0';
const OTHER_COLOR = '#6c757d';

function apiUrl(path) {
    if (selectedInstance) {
        const sep = path.includes('?') ? '&' : '?';
        return path + sep + 'instance=' + encodeURIComponent(selectedInstance);
    }
    return path;
}

async function loadDashboardInstances() {
    const data = await apiGet('/api/instances');
    const sel = document.getElementById('instance-filter');
    if (!data || data.length === 0) return;
    sel.innerHTML = '<option value="">All Instances</option>';
    data.forEach(inst => {
        const opt = document.createElement('option');
        opt.value = inst.id;
        opt.textContent = inst.name;
        sel.appendChild(opt);
    });
}

function onInstanceFilterChange() {
    selectedInstance = document.getElementById('instance-filter').value;
    destroyCharts();
    refreshAll();
}

function onTimeRangeChange() {
    selectedTimeRange = parseInt(document.getElementById('time-range').value, 10);
    if (queriesOverTimeChart) { queriesOverTimeChart.destroy(); queriesOverTimeChart = null; }
    if (clientsChart) { clientsChart.destroy(); clientsChart = null; }
    updateQueriesOverTime();
    updateClientsOverTime();
}

function destroyCharts() {
    [queriesOverTimeChart, queryTypesChart, upstreamsChart, clientsChart].forEach(c => {
        if (c) { c.destroy(); }
    });
    queriesOverTimeChart = null;
    queryTypesChart = null;
    upstreamsChart = null;
    clientsChart = null;
}

async function updateSummary() {
    const data = await apiGet(apiUrl('/api/summary'));
    if (!data) return;
    document.getElementById('total-queries').textContent = formatNumber(data.queries.total);
    document.getElementById('blocked-queries').textContent = formatNumber(data.queries.blocked);
    document.getElementById('percent-blocked').textContent = formatPercent(data.queries.percent_blocked);
    document.getElementById('active-clients').textContent = formatNumber(data.clients.active);
    document.getElementById('gravity-size').textContent = formatNumber(data.gravity.domains_being_blocked);
    document.getElementById('gravity-updated').textContent = timeAgo(data.gravity.last_update);
}

async function updateBlockingStatus() {
    const data = await apiGet(apiUrl('/api/blocking'));
    if (!data) return;
    let html = '<div class="row">';
    let hasErrors = false;
    for (const [id, info] of Object.entries(data)) {
        let statusClass = 'text-success';
        let statusIcon = 'bi-check-circle-fill';
        let statusText = 'Active';
        if (info.error) {
            hasErrors = true;
            statusClass = 'text-danger';
            statusIcon = 'bi-exclamation-triangle-fill';
            statusText = 'Error';
        } else if (info.blocking === 'disabled') {
            statusClass = 'text-danger';
            statusIcon = 'bi-x-circle-fill';
            statusText = 'Disabled';
        } else if (info.blocking === 'failure') {
            hasErrors = true;
            statusClass = 'text-warning';
            statusIcon = 'bi-exclamation-triangle-fill';
            statusText = 'DNS Failure';
        }
        html += `
            <div class="col-md-4 mb-2">
                <div class="d-flex justify-content-between align-items-center p-2 border rounded">
                    <strong>${escapeHtml(info.name || id)}</strong>
                    <span class="${statusClass}"><i class="bi ${statusIcon}"></i> ${statusText}</span>
                    <div>
                        <button class="btn btn-outline-success btn-sm" title="Enable" onclick="setBlocking('${id}', true, null)"><i class="bi bi-play-fill"></i></button>
                        <button class="btn btn-outline-danger btn-sm" title="Disable" onclick="setBlocking('${id}', false, null)"><i class="bi bi-stop-fill"></i></button>
                    </div>
                </div>
            </div>`;
    }
    html += '</div>';
    document.getElementById('blocking-status').innerHTML = html;
    if (hasErrors) {
        showToast('Instance Warning', 'One or more Pi-hole instances are unreachable or have errors.', 'warning');
    }
}

async function setBlocking(instanceId, blocking, timer) {
    await apiPost(`/api/blocking/${instanceId}`, { blocking, timer });
    updateBlockingStatus();
}

async function setBlockingAll(blocking) {
    const data = await apiGet(apiUrl('/api/blocking'));
    if (!data) return;
    for (const id of Object.keys(data)) {
        await apiPost(`/api/blocking/${id}`, { blocking, timer: null });
    }
    updateBlockingStatus();
}

async function updateQueriesOverTime() {
    const data = await apiGet(apiUrl('/api/history'));
    if (!data || !data.history || data.history.length === 0) return;

    let history = data.history;
    if (selectedTimeRange > 0) {
        const cutoff = Math.floor(Date.now() / 1000) - selectedTimeRange * 3600;
        history = history.filter(item => item.timestamp >= cutoff);
    }

    const labels = [];
    const blocked = [];
    const cached = [];
    const forwarded = [];
    const other = [];

    for (const item of history) {
        labels.push(new Date(item.timestamp * 1000));
        blocked.push(item.blocked);
        cached.push(item.cached);
        forwarded.push(item.forwarded);
        other.push(item.total - item.blocked - item.cached - item.forwarded);
    }

    if (!queriesOverTimeChart) {
        const ctx = document.getElementById('queriesOverTimeChart').getContext('2d');
        queriesOverTimeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Other', data: other, backgroundColor: OTHER_COLOR, stack: 'queries' },
                    { label: 'Blocked', data: blocked, backgroundColor: BLOCKED_COLOR, stack: 'queries' },
                    { label: 'Cached', data: cached, backgroundColor: CACHED_COLOR, stack: 'queries' },
                    { label: 'Forwarded', data: forwarded, backgroundColor: FORWARDED_COLOR, stack: 'queries' },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', stacked: true, time: { unit: 'hour' } },
                    y: { stacked: true, beginAtZero: true },
                },
                plugins: { legend: { position: 'bottom' } },
            },
        });
    } else {
        queriesOverTimeChart.data.labels = labels;
        queriesOverTimeChart.data.datasets[0].data = other;
        queriesOverTimeChart.data.datasets[1].data = blocked;
        queriesOverTimeChart.data.datasets[2].data = cached;
        queriesOverTimeChart.data.datasets[3].data = forwarded;
        queriesOverTimeChart.update();
    }
}

async function updateQueryTypes() {
    const data = await apiGet(apiUrl('/api/query-types'));
    if (!data || !data.types) return;

    const labels = [];
    const values = [];
    let total = 0;
    for (const [type, count] of Object.entries(data.types)) {
        if (count > 0) {
            labels.push(type);
            values.push(count);
            total += count;
        }
    }

    if (!queryTypesChart) {
        const ctx = document.getElementById('queryTypesChart').getContext('2d');
        queryTypesChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: values, backgroundColor: CHART_COLORS }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
            },
        });
    } else {
        queryTypesChart.data.labels = labels;
        queryTypesChart.data.datasets[0].data = values;
        queryTypesChart.update();
    }
}

async function updateUpstreams() {
    const data = await apiGet(apiUrl('/api/upstreams'));
    if (!data || !data.upstreams) return;

    const labels = [];
    const values = [];
    const colors = [];

    data.upstreams.forEach((item, i) => {
        let label = item.name || item.ip || 'Unknown';
        if (item.port > 0) label += '#' + item.port;
        labels.push(label);
        values.push(item.count);
        colors.push(CHART_COLORS[i % CHART_COLORS.length]);
    });

    if (!upstreamsChart) {
        const ctx = document.getElementById('upstreamsChart').getContext('2d');
        upstreamsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: values, backgroundColor: colors }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
            },
        });
    } else {
        upstreamsChart.data.labels = labels;
        upstreamsChart.data.datasets[0].data = values;
        upstreamsChart.data.datasets[0].backgroundColor = colors;
        upstreamsChart.update();
    }
}

async function updateClientsOverTime() {
    const data = await apiGet(apiUrl('/api/history/clients'));
    if (!data || !data.history || data.history.length === 0) return;

    let history = data.history;
    if (selectedTimeRange > 0) {
        const cutoff = Math.floor(Date.now() / 1000) - selectedTimeRange * 3600;
        history = history.filter(item => item.timestamp >= cutoff);
    }

    let numClients = 0;
    const clientIdx = {};
    const labels = [];

    for (const [ip, clientData] of Object.entries(data.clients)) {
        clientIdx[ip] = numClients++;
        const name = clientData.name ? escapeHtml(clientData.name) : ip;
        labels.push(name);
    }

    if (!clientsChart) {
        const ctx = document.getElementById('clientsChart').getContext('2d');
        clientsChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', stacked: true, time: { unit: 'hour' } },
                    y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
                },
                plugins: { legend: { position: 'bottom' } },
            },
        });
    }

    clientsChart.data.labels = [];
    const datasets = [];
    for (let i = 0; i < numClients; i++) {
        datasets.push({
            label: labels[i],
            data: [],
            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
            stack: 'clients',
        });
    }
    clientsChart.data.datasets = datasets;

    for (const item of history) {
        const ts = new Date(item.timestamp * 1000);
        clientsChart.data.labels.push(ts);
        for (let i = 0; i < numClients; i++) {
            datasets[i].data.push(0);
        }
        for (const [ip, count] of Object.entries(item.data || {})) {
            const idx = clientIdx[ip];
            if (idx !== undefined) {
                datasets[idx].data[datasets[idx].data.length - 1] = count;
            }
        }
    }

    clientsChart.update();
}

function populateTopTable(tableId, items, total, key) {
    const tbody = tableId.querySelector('tbody');
    tbody.innerHTML = '';
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No data</td></tr>';
        return;
    }
    for (const item of items.slice(0, 10)) {
        const label = item[key] || item.ip || item.name || 'N/A';
        const count = item.count;
        const pct = total > 0 ? (count / total * 100).toFixed(1) : 0;
        tbody.innerHTML += `
            <tr>
                <td>${escapeHtml(label)}</td>
                <td>${formatNumber(count)}</td>
                <td>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar" style="width: ${pct}%"></div>
                    </div>
                </td>
            </tr>`;
    }
}

async function updateTopDomains() {
    const permitted = await apiGet(apiUrl('/api/top-domains'));
    const blocked = await apiGet(apiUrl('/api/top-domains?blocked=true'));

    if (permitted) {
        populateTopTable(
            document.getElementById('top-permitted-domains-table'),
            permitted.domains, permitted.total_queries, 'domain'
        );
    }
    if (blocked) {
        populateTopTable(
            document.getElementById('top-blocked-domains-table'),
            blocked.domains, blocked.total_queries || blocked.blocked_queries, 'domain'
        );
    }
}

async function updateTopClients() {
    const permitted = await apiGet(apiUrl('/api/top-clients'));
    const blocked = await apiGet(apiUrl('/api/top-clients?blocked=true'));

    if (permitted) {
        populateTopTable(
            document.getElementById('top-permitted-clients-table'),
            permitted.clients, permitted.total_queries, 'ip'
        );
    }
    if (blocked) {
        populateTopTable(
            document.getElementById('top-blocked-clients-table'),
            blocked.clients, blocked.total_queries || blocked.blocked_queries, 'ip'
        );
    }
}

async function refreshAll() {
    await Promise.all([
        updateSummary(),
        updateBlockingStatus(),
        updateQueriesOverTime(),
        updateQueryTypes(),
        updateUpstreams(),
        updateTopDomains(),
        updateTopClients(),
        updateClientsOverTime(),
    ]);
}

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardInstances();
    refreshAll();
    setInterval(refreshAll, 10000);
});
