let groupsInstanceId = '';

async function loadGroupsInstances() {
    const data = await apiGet('/api/instances');
    const sel = document.getElementById('groups-instance-select');
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
    groupsInstanceId = data[0].id;
    sel.value = groupsInstanceId;
    loadGroups();

    sel.addEventListener('change', () => {
        groupsInstanceId = sel.value;
        loadGroups();
    });
}

async function loadGroups() {
    if (!groupsInstanceId) return;
    const tbody = document.getElementById('groups-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading...</td></tr>';
    try {
        const data = await apiGet('/api/settings/' + groupsInstanceId + '/groups');
        tbody.innerHTML = '';
        const groups = data && data.groups ? data.groups : [];
        if (groups.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No groups configured.</td></tr>';
            return;
        }
        groups.forEach(g => {
            const enabledBadge = g.enabled
                ? '<span class="badge bg-success">Yes</span>'
                : '<span class="badge bg-secondary">No</span>';
            const dateAdded = g.date_added ? new Date(g.date_added * 1000).toLocaleDateString() : '--';
            const isDefault = g.id === 0;
            tbody.innerHTML += `<tr>
                <td><strong>${escapeHtml(g.name)}</strong>${isDefault ? ' <span class="badge bg-info">Default</span>' : ''}</td>
                <td>${enabledBadge}</td>
                <td><small>${escapeHtml(g.comment || '')}</small></td>
                <td><small>${dateAdded}</small></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editGroup('${encodeURIComponent(g.name)}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    ${!isDefault ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteGroup('${encodeURIComponent(g.name)}')">
                        <i class="bi bi-trash"></i>
                    </button>` : ''}
                </td>
            </tr>`;
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading data</td></tr>';
    }
}

async function saveGroup() {
    if (!groupsInstanceId) { alert('Select an instance first'); return; }
    const form = document.getElementById('add-group-form');
    const names = form.elements['name'].value.split(',').map(s => s.trim()).filter(s => s);
    const comment = form.elements['comment'].value;
    const enabled = form.elements['enabled'].checked;

    if (names.length === 0) { alert('Enter at least one group name'); return; }

    try {
        const data = await apiPost('/api/settings/' + groupsInstanceId + '/groups', {
            name: names,
            comment: comment,
            enabled: enabled
        });
        if (data && data.processed && data.processed.errors && data.processed.errors.length > 0) {
            alert('Some groups failed to add:\n' + data.processed.errors.map(e => e.item + ': ' + e.error).join('\n'));
        }
        bootstrap.Modal.getInstance(document.getElementById('addGroupModal')).hide();
        form.reset();
        form.elements['enabled'].checked = true;
        loadGroups();
    } catch (err) { alert('Error: ' + err.message); }
}

function editGroup(encodedName) {
    const name = decodeURIComponent(encodedName);
    const form = document.getElementById('edit-group-form');
    form.elements['name'].value = name;
    form.elements['new_name'].value = name;
    form.elements['comment'].value = '';
    form.elements['enabled'].checked = true;
    new bootstrap.Modal(document.getElementById('editGroupModal')).show();
}

async function updateGroup() {
    const form = document.getElementById('edit-group-form');
    const oldName = form.elements['name'].value;
    const newName = form.elements['new_name'].value;
    const comment = form.elements['comment'].value;
    const enabled = form.elements['enabled'].checked;

    try {
        await apiPut('/api/settings/' + groupsInstanceId + '/groups/' + encodeURIComponent(oldName), {
            name: newName,
            comment: comment,
            enabled: enabled
        });
        bootstrap.Modal.getInstance(document.getElementById('editGroupModal')).hide();
        loadGroups();
    } catch (err) { alert('Error: ' + err.message); }
}

async function deleteGroup(encodedName) {
    if (!confirm('Delete this group?')) return;
    const name = decodeURIComponent(encodedName);
    try {
        await apiDelete('/api/settings/' + groupsInstanceId + '/groups/' + encodeURIComponent(name));
        loadGroups();
    } catch (err) { alert('Error: ' + err.message); }
}

document.addEventListener('DOMContentLoaded', () => {
    loadGroupsInstances();
});
