let adlistsInstanceId = '';

async function loadAdlistsInstances() {
    const data = await apiGet('/api/instances');
    const sel = document.getElementById('adlists-instance-select');
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
    adlistsInstanceId = data[0].id;
    sel.value = adlistsInstanceId;
    loadAdlists();

    sel.addEventListener('change', () => {
        adlistsInstanceId = sel.value;
        loadAdlists();
    });
}

async function loadAdlists() {
    if (!adlistsInstanceId) return;
    const tbody = document.getElementById('adlists-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading...</td></tr>';
    try {
        const data = await apiGet('/api/settings/' + adlistsInstanceId + '/adlists');
        tbody.innerHTML = '';
        const lists = data && data.lists ? data.lists : [];
        if (lists.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No adlists configured.</td></tr>';
            return;
        }
        lists.forEach(l => {
            const statusIcon = l.status === 1 ? '<i class="bi bi-check-circle-fill text-success"></i>' :
                               l.status === 2 ? '<i class="bi bi-check-circle text-info"></i>' :
                               l.status === 3 ? '<i class="bi bi-exclamation-triangle-fill text-warning"></i>' :
                               '<i class="bi bi-x-circle-fill text-danger"></i>';
            const typeBadge = l.type === 'allow'
                ? '<span class="badge bg-success">Allow</span>'
                : '<span class="badge bg-danger">Block</span>';
            const enabledBadge = l.enabled
                ? '<span class="badge bg-success">Yes</span>'
                : '<span class="badge bg-secondary">No</span>';
            const groups = l.groups ? l.groups.join(', ') : '--';
            const address = escapeHtml(l.address || '');
            const addrDisplay = address.length > 50 ? address.substring(0, 47) + '...' : address;

            tbody.innerHTML += `<tr>
                <td>${statusIcon}</td>
                <td>${typeBadge}</td>
                <td><small title="${escapeHtml(address)}">${addrDisplay}</small></td>
                <td><small>${escapeHtml(l.comment || '')}</small></td>
                <td>${formatNumber(l.number || 0)}</td>
                <td><small>${groups}</small></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editAdlist('${encodeURIComponent(l.address)}', '${l.type}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteAdlist('${encodeURIComponent(l.address)}', '${l.type}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>`;
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading data</td></tr>';
    }
}

async function saveAdlist() {
    if (!adlistsInstanceId) { alert('Select an instance first'); return; }
    const form = document.getElementById('add-adlist-form');
    const type = form.elements['type'].value;
    const addresses = form.elements['address'].value.split('\n').map(s => s.trim()).filter(s => s);
    const comment = form.elements['comment'].value;

    if (addresses.length === 0) { alert('Enter at least one URL'); return; }

    try {
        const data = await apiPost('/api/settings/' + adlistsInstanceId + '/adlists?type=' + type, {
            address: addresses,
            comment: comment,
            groups: [0]
        });
        if (data && data.processed && data.processed.errors && data.processed.errors.length > 0) {
            alert('Some adlists failed to add:\n' + data.processed.errors.map(e => e.item + ': ' + e.error).join('\n'));
        }
        bootstrap.Modal.getInstance(document.getElementById('addAdlistModal')).hide();
        form.reset();
        loadAdlists();
    } catch (err) { alert('Error: ' + err.message); }
}

function editAdlist(encodedAddress, type) {
    const address = decodeURIComponent(encodedAddress);
    const form = document.getElementById('edit-adlist-form');
    form.elements['address'].value = address;
    form.elements['type'].value = type;
    form.elements['enabled'].value = 'true';
    form.elements['comment'].value = '';
    new bootstrap.Modal(document.getElementById('editAdlistModal')).show();
}

async function updateAdlist() {
    const form = document.getElementById('edit-adlist-form');
    const address = form.elements['address'].value;
    const type = form.elements['type'].value;
    const enabled = form.elements['enabled'].value === 'true';
    const comment = form.elements['comment'].value;

    try {
        await apiPut('/api/settings/' + adlistsInstanceId + '/adlists/' + encodeURIComponent(address) + '?type=' + type, {
            enabled: enabled,
            comment: comment,
            type: type,
            groups: [0]
        });
        bootstrap.Modal.getInstance(document.getElementById('editAdlistModal')).hide();
        loadAdlists();
    } catch (err) { alert('Error: ' + err.message); }
}

async function deleteAdlist(encodedAddress, type) {
    if (!confirm('Delete this adlist?')) return;
    const address = decodeURIComponent(encodedAddress);
    try {
        await apiDelete('/api/settings/' + adlistsInstanceId + '/adlists/' + encodeURIComponent(address) + '?type=' + type);
        loadAdlists();
    } catch (err) { alert('Error: ' + err.message); }
}

document.addEventListener('DOMContentLoaded', () => {
    loadAdlistsInstances();
});
