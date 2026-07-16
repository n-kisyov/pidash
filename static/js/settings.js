let settingsInstanceId = '';
let activeTab = 'dns';
let configMetadata = {};

async function loadSettingsInstances() {
    const data = await apiGet('/api/instances');
    const sel = document.getElementById('settings-instance-select');
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
    settingsInstanceId = data[0].id;
    sel.value = settingsInstanceId;
    loadActiveTab();

    sel.addEventListener('change', () => {
        settingsInstanceId = sel.value;
        loadActiveTab();
    });
}

async function loadActiveTab() {
    if (!settingsInstanceId) return;

    const tab = document.getElementById('tab-' + activeTab);
    const hasFields = tab ? tab.querySelectorAll('[data-key]').length > 0 : false;
    const saveBtn = document.querySelector('button[onclick="saveCurrentTab()"]');
    if (saveBtn) {
        saveBtn.disabled = !hasFields;
        saveBtn.title = hasFields ? 'Save Settings' : 'No configurable fields on this tab';
    }

    switch (activeTab) {
        case 'dns': await loadDnsTab(); break;
        case 'dhcp': await loadDhcpTab(); break;
        case 'privacy': await loadPrivacyTab(); break;
        case 'records': await loadRecordsTab(); break;
        case 'system': await loadSystemTab(); break;
        case 'teleporter': break;
    }
}

async function loadConfigSection(topic, cb) {
    setStatus('Loading...', 'text-muted');
    try {
        const data = await apiGet('/api/settings/' + settingsInstanceId + '/config/' + topic);
        if (data && data.config) {
            configMetadata = data.config;
            cb(data.config);
            setStatus('', '');
        } else if (data && data.error) {
            setStatus('Error: ' + escapeHtml(data.error), 'text-danger');
        }
    } catch (err) {
        setStatus('Error: ' + err.message, 'text-danger');
    }
}

function getConfigValue(obj, path) {
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
    }
    if (cur && typeof cur === 'object' && 'value' in cur) return cur.value;
    return cur;
}

function getMetadata(path) {
    let cur = configMetadata;
    const parts = path.split('.');
    for (const p of parts) {
        if (cur == null) return {};
        cur = cur[p];
    }
    if (cur && typeof cur === 'object' && 'type' in cur) return cur;
    return {};
}

function populateFields(config) {
    const tab = document.getElementById('tab-' + activeTab);
    if (!tab) return;

    const elements = tab.querySelectorAll('[data-key]');
    elements.forEach(el => {
        const key = el.dataset.key;
        const value = getConfigValue(config, key);

        if (el.type === 'checkbox') {
            el.checked = !!value;
        } else if (el.tagName === 'SELECT') {
            if (el.dataset.enum === 'true') {
                const meta = getMetadata(key);
                el.innerHTML = '';
                if (meta.allowed && Array.isArray(meta.allowed)) {
                    meta.allowed.forEach(opt => {
                        const option = document.createElement('option');
                        const optVal = typeof opt === 'object' ? (opt.item || opt.value) : opt;
                        option.value = optVal;
                        option.textContent = typeof opt === 'object' ? (opt.label || opt.description || optVal) : opt;
                        if (String(option.value) === String(value)) option.selected = true;
                        el.appendChild(option);
                    });
                }
            } else {
                el.value = value != null ? value : '';
            }
        } else if (el.tagName === 'TEXTAREA') {
            if (Array.isArray(value)) {
                el.value = value.join('\n');
            } else {
                el.value = value != null ? String(value) : '';
            }
        } else {
            el.value = value != null ? value : '';
        }
    });
}

async function loadDnsTab() {
    await loadConfigSection('dns', config => {
        populateFields(config);
    });
}

async function loadDhcpTab() {
    await loadConfigSection('dhcp', config => {
        populateFields(config);
    });
    loadDhcpLeases();
}

async function loadPrivacyTab() {
    setStatus('Loading...', 'text-muted');
    try {
        const data = await apiGet('/api/settings/' + settingsInstanceId + '/config');
        if (data && data.config) {
            configMetadata = data.config;
            populateFields(data.config);
            setStatus('', '');
        } else if (data && data.error) {
            setStatus('Error: ' + escapeHtml(data.error), 'text-danger');
        }
    } catch (err) {
        setStatus('Error: ' + err.message, 'text-danger');
    }
}

async function loadRecordsTab() {
    loadDnsHosts();
    loadDnsCnames();
}

async function loadSystemTab() {
    setStatus('', '');
    document.getElementById('action-output').textContent = '';
}

async function saveCurrentTab() {
    if (!settingsInstanceId) { alert('Select an instance first'); return; }

    const tab = document.getElementById('tab-' + activeTab);
    if (!tab) return;

    const tabMessages = {
        'system': 'Use the action buttons on this tab for system operations.',
        'teleporter': 'Use the Export / Import buttons on this tab to manage backups.',
        'records': 'Use the Add Record / Delete buttons on this tab to manage DNS records.',
    };

    const elements = tab.querySelectorAll('[data-key]');
    if (elements.length === 0) {
        const msg = tabMessages[activeTab] || 'Nothing to save on this tab.';
        setStatus(msg, 'text-muted');
        return;
    }

    const config = {};
    elements.forEach(el => {
        const key = el.dataset.key;
        let value;
        if (el.type === 'checkbox') {
            value = el.checked;
        } else if (el.tagName === 'TEXTAREA') {
            const lines = el.value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
            const meta = getMetadata(key);
            const isArrayType = meta.type === 'string array';
            if (isArrayType || (lines.length > 0 && !meta.type)) {
                value = lines;
            } else {
                value = el.value;
            }
        } else if (el.tagName === 'SELECT') {
            const selValue = el.value;
            const meta = getMetadata(key);
            if (meta.type && meta.type.includes('integer')) {
                value = parseInt(selValue, 10);
            } else {
                value = selValue;
            }
        } else {
            const rawValue = el.value;
            const meta = getMetadata(key);
            if (el.type === 'number') {
                value = parseInt(rawValue, 10) || 0;
            } else if (meta.type && (meta.type.includes('integer') || meta.type.includes('unsigned'))) {
                value = parseInt(rawValue, 10) || 0;
            } else if (meta.type === 'double') {
                value = parseFloat(rawValue) || 0;
            } else {
                value = rawValue;
            }
        }
        setNestedValue(config, key.split('.'), value);
    });

    setStatus('Saving...', 'text-warning');
    try {
        const payload = { config };
        console.log('Settings save payload:', JSON.stringify(payload, null, 2));
        const data = await apiPatch('/api/settings/' + settingsInstanceId + '/config', payload);
        if (data && data.error) {
            setStatus('Error: ' + escapeHtml(data.error), 'text-danger');
        } else {
            setStatus('Settings saved successfully.', 'text-success');
            setTimeout(() => setStatus('', ''), 3000);
            loadActiveTab();
        }
    } catch (err) {
        setStatus('Error: ' + err.message, 'text-danger');
    }
}

function setNestedValue(obj, parts, value) {
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
}

function setStatus(msg, cls) {
    const el = document.getElementById('settings-status');
    el.textContent = msg;
    el.className = 'small mt-2 ' + (cls || '');
}

async function loadDnsHosts() {
    const tbody = document.getElementById('dns-hosts-tbody');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Loading...</td></tr>';
    try {
        const data = await apiGet('/api/settings/' + settingsInstanceId + '/dns/hosts');
        tbody.innerHTML = '';
        const hosts = (data && data.config && data.config.dns && data.config.dns.hosts)
            || [];
        if (!hosts || hosts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No records</td></tr>';
            return;
        }
        hosts.forEach(item => {
            const parts = String(item).split(/\s+/);
            const ip = parts[0] || '';
            const name = parts.slice(1).join(' ') || '';
            tbody.innerHTML += `<tr>
                <td><code>${escapeHtml(ip)}</code></td>
                <td>${escapeHtml(name)}</td>
                <td><button class="btn btn-sm btn-outline-danger" onclick="deleteDnsHost('${encodeURIComponent(item)}')"><i class="bi bi-trash"></i></button></td>
            </tr>`;
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Error</td></tr>';
    }
}

async function addDnsHost() {
    if (!settingsInstanceId) { alert('Select an instance first'); return; }
    const ip = document.getElementById('hosts-ip').value.trim();
    const hostname = document.getElementById('hosts-name').value.trim();
    if (!ip || !hostname) { alert('Enter both IP and hostname'); return; }
    try {
        const data = await apiPost('/api/settings/' + settingsInstanceId + '/dns/hosts', { ip, hostname });
        if (data && data.success) {
            document.getElementById('hosts-ip').value = '';
            document.getElementById('hosts-name').value = '';
            loadDnsHosts();
        } else {
            alert('Error: ' + (data && data.error ? JSON.stringify(data.error) : 'unknown'));
        }
    } catch (err) { alert('Error: ' + err.message); }
}

async function deleteDnsHost(encodedItem) {
    if (!confirm('Delete this record?')) return;
    try {
        await apiDelete('/api/settings/' + settingsInstanceId + '/dns/hosts/' + encodedItem);
        loadDnsHosts();
    } catch (err) { alert('Error: ' + err.message); }
}

async function loadDnsCnames() {
    const tbody = document.getElementById('dns-cname-tbody');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Loading...</td></tr>';
    try {
        const data = await apiGet('/api/settings/' + settingsInstanceId + '/dns/cnameRecords');
        tbody.innerHTML = '';
        const cnames = (data && data.config && data.config.dns && data.config.dns.cnameRecords)
            || [];
        if (!cnames || cnames.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No records</td></tr>';
            return;
        }
        cnames.forEach(item => {
            const parts = String(item).split(',');
            const cname = parts[0] || '';
            const target = parts[1] || '';
            tbody.innerHTML += `<tr>
                <td>${escapeHtml(cname)}</td>
                <td>${escapeHtml(target)}</td>
                <td><button class="btn btn-sm btn-outline-danger" onclick="deleteDnsCname('${encodeURIComponent(item)}')"><i class="bi bi-trash"></i></button></td>
            </tr>`;
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Error</td></tr>';
    }
}

async function addDnsCname() {
    if (!settingsInstanceId) { alert('Select an instance first'); return; }
    const cname = document.getElementById('cname-alias').value.trim();
    const target = document.getElementById('cname-target').value.trim();
    if (!cname || !target) { alert('Enter both CNAME and target'); return; }
    try {
        const data = await apiPost('/api/settings/' + settingsInstanceId + '/dns/cnameRecords', { cname, target });
        if (data && data.success) {
            document.getElementById('cname-alias').value = '';
            document.getElementById('cname-target').value = '';
            loadDnsCnames();
        } else {
            alert('Error: ' + (data && data.error ? JSON.stringify(data.error) : 'unknown'));
        }
    } catch (err) { alert('Error: ' + err.message); }
}

async function deleteDnsCname(encodedItem) {
    if (!confirm('Delete this CNAME record?')) return;
    try {
        await apiDelete('/api/settings/' + settingsInstanceId + '/dns/cnameRecords/' + encodedItem);
        loadDnsCnames();
    } catch (err) { alert('Error: ' + err.message); }
}

async function loadDhcpLeases() {
    const tbody = document.getElementById('dhcp-leases-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading...</td></tr>';
    try {
        const data = await apiGet('/api/settings/' + settingsInstanceId + '/dhcp/leases');
        tbody.innerHTML = '';
        const leases = data && data.leases ? data.leases : (data && data.config && data.config.dhcp && data.config.dhcp.leases ? data.config.dhcp.leases : []);
        if (!leases || leases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No active leases</td></tr>';
            return;
        }
        leases.forEach(l => {
            const expires = l.expires ? new Date(l.expires * 1000).toLocaleString() : '--';
            tbody.innerHTML += `<tr>
                <td><code>${escapeHtml(l.ip || '')}</code></td>
                <td><small>${escapeHtml(l.hwaddr || l.mac || '')}</small></td>
                <td>${escapeHtml(l.name || l.hostname || '')}</td>
                <td><small>${expires}</small></td>
                <td><button class="btn btn-sm btn-outline-danger" onclick="deleteDhcpLease('${encodeURIComponent(l.ip)}')"><i class="bi bi-trash"></i></button></td>
            </tr>`;
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error</td></tr>';
    }
}

async function deleteDhcpLease(ip) {
    if (!confirm('Delete DHCP lease for ' + decodeURIComponent(ip) + '?')) return;
    try {
        await apiDelete('/api/settings/' + settingsInstanceId + '/dhcp/leases/' + ip);
        loadDhcpLeases();
    } catch (err) { alert('Error: ' + err.message); }
}

async function runAction(action) {
    if (!settingsInstanceId) { alert('Select an instance first'); return; }

    const output = document.getElementById('action-output');
    output.textContent = 'Running ' + action + '...\n';

    const btnMap = {
        'gravity': 'btn-gravity',
        'restartdns': 'btn-restartdns',
        'flush/logs': 'btn-flushlogs',
        'flush/arp': 'btn-flusharp',
    };
    const btn = document.getElementById(btnMap[action]);
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Running...'; }

    try {
        const resp = await fetch('/api/settings/' + settingsInstanceId + '/action/' + action, { method: 'POST' });
        if (resp.ok) {
            const text = await resp.text();
            output.textContent += text;
            if (action === 'restartdns') {
                output.textContent += '\n\nDNS restart triggered. FTL will reload.\nReload this page after a few seconds to see updated data.';
            }
        } else {
            const data = await resp.json().catch(() => null);
            output.textContent += '\nError: ' + (data && data.error ? JSON.stringify(data.error) : resp.statusText);
        }
    } catch (err) {
        output.textContent += '\nError: ' + err.message;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = btn.getAttribute('data-orig'); }
    }
}

document.querySelectorAll('#settingsTabs button[data-tab]').forEach(btn => {
    const origText = btn.textContent;
    btn.setAttribute('data-orig', origText);
});

function teleporterExport() {
    if (!settingsInstanceId) { alert('Select an instance first'); return; }
    window.open('/api/settings/' + settingsInstanceId + '/teleporter/export', '_blank');
}

async function teleporterImport() {
    if (!settingsInstanceId) { alert('Select an instance first'); return; }

    const form = document.getElementById('teleporter-import-form');
    const fileInput = form.querySelector('input[name="file"]');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Select a backup file first');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('import', JSON.stringify({
        config: true,
        dhcp_leases: true,
        gravity: {
            group: true,
            adlist: true,
            adlist_by_group: true,
            domainlist: true,
            domainlist_by_group: true,
            client: true,
            client_by_group: true,
        }
    }));

    setStatus('Importing... This may take a minute.', 'text-warning');
    try {
        const resp = await fetch('/api/settings/' + settingsInstanceId + '/teleporter/import', {
            method: 'POST',
            body: formData,
        });
        const data = await resp.json();
        if (data && data.error) {
            setStatus('Import failed: ' + escapeHtml(data.error), 'text-danger');
        } else {
            setStatus('Import successful! Pi-hole will restart to apply changes.', 'text-success');
            fileInput.value = '';
        }
    } catch (err) {
        setStatus('Error: ' + err.message, 'text-danger');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSettingsInstances();

    document.querySelectorAll('#settingsTabs button[data-tab]').forEach(btn => {
        btn.addEventListener('shown.bs.tab', (e) => {
            activeTab = e.target.dataset.tab;
            window.location.hash = 'tab-' + activeTab;
            loadActiveTab();
        });
    });

    const hash = window.location.hash;
    if (hash) {
        const triggerBtn = document.querySelector('#settingsTabs button[data-bs-target="' + hash + '"]');
        if (triggerBtn) {
            const tab = new bootstrap.Tab(triggerBtn);
            tab.show();
        }
    }
});
