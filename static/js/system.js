let systemCurrentInstance = '';

async function loadSystemInstances() {
    const data = await apiGet('/api/instances');
    const sel = document.getElementById('system-instance-select');
    if (!data || data.length === 0) {
        sel.innerHTML = '<option value="">No instances configured</option>';
        return;
    }
    sel.innerHTML = '';
    data.forEach(inst => {
        const opt = document.createElement('option');
        opt.value = inst.id;
        opt.textContent = inst.name;
        sel.appendChild(opt);
    });
    systemCurrentInstance = data[0].id;
    sel.value = systemCurrentInstance;
    loadSystemInfo();

    sel.addEventListener('change', () => {
        systemCurrentInstance = sel.value;
        loadSystemInfo();
    });
}

async function loadSystemInfo() {
    if (!systemCurrentInstance) return;

    const container = document.getElementById('system-content');
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

    try {
        const [sysData, ftlData, verData] = await Promise.all([
            apiGet('/api/system/' + systemCurrentInstance),
            apiGet('/api/info/ftl/' + systemCurrentInstance),
            apiGet('/api/info/version/' + systemCurrentInstance),
        ]);

        renderSystemInfo(sysData, ftlData, verData);
    } catch (err) {
        container.innerHTML = '<div class="alert alert-danger">Error loading system information: ' + err.message + '</div>';
    }
}

function renderSystemInfo(sysData, ftlData, verData) {
    const container = document.getElementById('system-content');
    let html = '';

    if (sysData && sysData.system) {
        const sys = sysData.system;
        html += renderSysCard(sys, ftlData, verData);
    } else if (sysData && sysData.error) {
        html += '<div class="alert alert-warning">System info unavailable: ' + escapeHtml(String(sysData.error)) + '</div>';
    }

    if (ftlData && ftlData.ftl) {
        html += renderFtlCard(ftlData.ftl);
    }

    if (verData && verData.version) {
        html += renderVersionCard(verData.version);
    }

    container.innerHTML = html || '<div class="alert alert-danger">No data available from this instance.</div>';
}

function renderSysCard(sys, ftlData, verData) {
    const percentRAM = sys.memory.ram['%used'] || 0;
    const totalRAM = (sys.memory.ram.total / (1024 * 1024 * 1024)).toFixed(1);
    const percentSwap = sys.memory.swap.total > 0
        ? ((sys.memory.swap.used / sys.memory.swap.total) * 100).toFixed(1)
        : null;

    const cpuColor = sys.cpu.load.raw[0] > sys.cpu.nprocs ? 'text-danger' : 'text-success';
    const ramColor = percentRAM > 75 ? 'text-danger' : 'text-success';

    return `
    <div class="card mb-4">
        <div class="card-header"><h5 class="mb-0"><i class="bi bi-cpu"></i> System Resources</h5></div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-3">
                    <div class="border rounded p-3 text-center mb-2">
                        <h6 class="text-muted">CPU</h6>
                        <h3 class="${cpuColor} mb-0">${sys.cpu['%cpu'].toFixed(1)}%</h3>
                        <small class="text-muted">${sys.cpu.nprocs} core${sys.cpu.nprocs > 1 ? 's' : ''}</small>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="border rounded p-3 text-center mb-2">
                        <h6 class="text-muted">Load Average</h6>
                        <h3 class="${cpuColor} mb-0">${sys.cpu.load.raw[0].toFixed(2)}</h3>
                        <small class="text-muted">1m / ${sys.cpu.load.raw[1].toFixed(2)} / ${sys.cpu.load.raw[2].toFixed(2)}</small>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="border rounded p-3 text-center mb-2">
                        <h6 class="text-muted">Memory</h6>
                        <h3 class="${ramColor} mb-0">${percentRAM.toFixed(1)}%</h3>
                        <small class="text-muted">${totalRAM} GB total</small>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="border rounded p-3 text-center mb-2">
                        <h6 class="text-muted">Swap</h6>
                        <h3 class="mb-0">${percentSwap != null ? percentSwap + '%' : 'N/A'}</h3>
                        <small class="text-muted">${(sys.memory.swap.total / 1024).toFixed(0)} MB total</small>
                    </div>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-md-3">
                    <small class="text-muted">Processes: ${formatNumber(sys.procs)}</small><br>
                    <small class="text-muted">FTL PID: ${ftlData && ftlData.ftl ? ftlData.ftl.pid : '--'}</small>
                </div>
                <div class="col-md-3">
                    <small class="text-muted">FTL CPU: ${sys.ftl['%cpu'].toFixed(1)}%</small><br>
                    <small class="text-muted">FTL Memory: ${sys.ftl['%mem'].toFixed(1)}%</small>
                </div>
                <div class="col-md-6">
                    <small class="text-muted">System Uptime: ${formatDuration(sys.uptime)}</small>
                </div>
            </div>
        </div>
    </div>`;
}

function renderFtlCard(ftl) {
    const db = ftl.database;
    const allowedTotal = (db.domains.allowed.enabled || 0) + (db.regex.allowed.enabled || 0);
    const deniedTotal = (db.domains.denied.enabled || 0) + (db.regex.denied.enabled || 0);

    return `
    <div class="card mb-4">
        <div class="card-header"><h5 class="mb-0"><i class="bi bi-database"></i> FTL Database</h5></div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-2">
                    <div class="border rounded p-3 text-center mb-2">
                        <h6 class="text-muted">Gravity</h6>
                        <h3 class="text-primary mb-0">${formatNumber(db.gravity)}</h3>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="border rounded p-3 text-center mb-2">
                        <h6 class="text-muted">Groups</h6>
                        <h3 class="mb-0">${formatNumber(db.groups)}</h3>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="border rounded p-3 text-center mb-2">
                        <h6 class="text-muted">Clients</h6>
                        <h3 class="mb-0">${formatNumber(db.clients)}</h3>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="border rounded p-3 text-center mb-2">
                        <h6 class="text-muted">Lists</h6>
                        <h3 class="mb-0">${formatNumber(db.lists)}</h3>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="border rounded p-3 text-center mb-2">
                        <h6 class="text-muted">Allowed</h6>
                        <h3 class="text-success mb-0">${formatNumber(allowedTotal)}</h3>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="border rounded p-3 text-center mb-2">
                        <h6 class="text-muted">Denied</h6>
                        <h3 class="text-danger mb-0">${formatNumber(deniedTotal)}</h3>
                    </div>
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-md-6">
                    <small class="text-muted">Query Frequency: ${ftl.query_frequency.toFixed(2)} q/s</small><br>
                    <small class="text-muted">Privacy Level: ${ftl.privacy_level}</small>
                </div>
                <div class="col-md-6">
                    <small class="text-muted">FTL Uptime: ${formatDuration(ftl.uptime / 1000)}</small>
                </div>
            </div>
        </div>
    </div>`;
}

function renderVersionCard(version) {
    const items = [
        { name: 'Docker Tag', v: version.docker },
        { name: 'Core', v: version.core },
        { name: 'FTL', v: version.ftl },
        { name: 'Web Interface', v: version.web },
    ];

    const rows = items.map(item => {
        const local = item.v.local;
        const remote = item.v.remote;
        let localStr = '';
        let updateBadge = '';

        if (local === null) return '';

        if (typeof local === 'object') {
            localStr = local.version || local.hash || JSON.stringify(local);
        } else {
            localStr = local;
        }

        if (remote && remote.version && localStr !== remote.version) {
            updateBadge = ' <span class="badge bg-warning text-dark">Update: ' + escapeHtml(remote.version) + '</span>';
        }

        return `<tr><td><strong>${item.name}</strong></td><td><code>${escapeHtml(localStr)}</code>${updateBadge}</td></tr>`;
    }).join('');

    return `
    <div class="card mb-4">
        <div class="card-header"><h5 class="mb-0"><i class="bi bi-tag"></i> Versions</h5></div>
        <div class="card-body p-0">
            <table class="table table-sm mb-0">
                <tbody>${rows}</tbody>
            </table>
        </div>
    </div>`;
}

function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '--';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(d + 'd');
    if (h > 0) parts.push(h + 'h');
    if (m > 0) parts.push(m + 'm');
    return parts.join(' ') || '<1m';
}

document.addEventListener('DOMContentLoaded', () => {
    loadSystemInstances();
    setInterval(() => {
        if (systemCurrentInstance) loadSystemInfo();
    }, 30000);
});
