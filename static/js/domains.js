let currentInstance = '';
let currentListType = 'allow';
let currentKind = 'exact';

async function loadInstances() {
    const data = await apiGet('/api/instances');
    if (!data || data.length === 0) {
        document.getElementById('domain-instance-select').innerHTML = '<option value="">No instances configured</option>';
        return;
    }
    const sel = document.getElementById('domain-instance-select');
    sel.innerHTML = '';
    data.forEach(inst => {
        const opt = document.createElement('option');
        opt.value = inst.id;
        opt.textContent = inst.name;
        sel.appendChild(opt);
    });
    currentInstance = data[0].id;
    sel.value = currentInstance;
    loadDomainLists();

    sel.addEventListener('change', () => {
        currentInstance = sel.value;
        loadDomainLists();
    });
}

function getActiveTabInfo() {
    const activeTab = document.querySelector('#domainTabs .nav-link.active');
    if (!activeTab) return { list: 'allow', kind: 'exact' };
    const target = activeTab.getAttribute('data-bs-target');
    if (target === '#allow-exact') return { list: 'allow', kind: 'exact' };
    if (target === '#allow-regex') return { list: 'allow', kind: 'regex' };
    if (target === '#deny-exact') return { list: 'deny', kind: 'exact' };
    if (target === '#deny-regex') return { list: 'deny', kind: 'regex' };
    return { list: 'allow', kind: 'exact' };
}

async function loadDomainLists() {
    if (!currentInstance) return;

    const tabInfo = getActiveTabInfo();
    currentListType = tabInfo.list;
    currentKind = tabInfo.kind;

    const domainFields = [
        { list: 'allow', kind: 'exact', tbody: 'allow-exact-tbody' },
        { list: 'allow', kind: 'regex', tbody: 'allow-regex-tbody' },
        { list: 'deny', kind: 'exact', tbody: 'deny-exact-tbody' },
        { list: 'deny', kind: 'regex', tbody: 'deny-regex-tbody' },
    ];

    for (const field of domainFields) {
        const tbody = document.getElementById(field.tbody);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading...</td></tr>';

        try {
            const data = await apiGet(`/api/domains/${currentInstance}/${field.list}?kind=${field.kind}`);
            tbody.innerHTML = '';

            if (!data || !data.domains) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No domains</td></tr>';
                continue;
            }

            if (data.domains.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No domains</td></tr>';
                continue;
            }

            for (const d of data.domains) {
                const groups = d.groups ? d.groups.map(g => escapeHtml(g.name || g)).join(', ') : '--';
                const enabled = d.enabled
                    ? '<span class="badge bg-success">Yes</span>'
                    : '<span class="badge bg-secondary">No</span>';
                tbody.innerHTML += `
                    <tr>
                        <td>${escapeHtml(d.domain)}</td>
                        <td>${enabled}</td>
                        <td><small>${escapeHtml(d.comment || '')}</small></td>
                        <td><small>${groups}</small></td>
                        <td>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteDomain('${field.list}', '${field.kind}', ${d.id})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>`;
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading data</td></tr>';
        }
    }
}

async function addDomain() {
    if (!currentInstance) {
        alert('Select an instance first');
        return;
    }

    const input = document.getElementById('new-domain-input');
    const domain = input.value.trim();
    if (!domain) return;

    const tabInfo = getActiveTabInfo();

    try {
        const data = await apiPost(`/api/domains/${currentInstance}/${tabInfo.list}`, {
            domain: domain,
            kind: tabInfo.kind,
            comment: 'Added from pidash',
        });
        if (data.error) {
            alert('Error: ' + JSON.stringify(data.error));
        } else {
            input.value = '';
            loadDomainLists();
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function deleteDomain(list, kind, domainId) {
    if (!currentInstance) return;
    if (!confirm('Delete this domain entry?')) return;

    try {
        await apiDelete(`/api/domains/${currentInstance}/${list}/${domainId}`);
        loadDomainLists();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadInstances();

    document.querySelectorAll('#domainTabs .nav-link').forEach(btn => {
        btn.addEventListener('shown.bs.tab', () => {
            loadDomainLists();
        });
    });

    document.getElementById('new-domain-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addDomain();
    });

    setInterval(() => {
        if (currentInstance) loadDomainLists();
    }, 60000);
});
