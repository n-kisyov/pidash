async function loadInstancesList() {
    const data = await apiGet('/api/instances');
    const tbody = document.getElementById('instances-tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No instances configured. Click "Add Instance" to get started.</td></tr>';
        return;
    }

    for (const inst of data) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="status-indicator" id="status-${inst.id}"><i class="bi bi-hourglass-split"></i></span></td>
            <td><strong>${escapeHtml(inst.name)}</strong></td>
            <td><code>${escapeHtml(inst.url)}</code></td>
            <td>${inst.api_key ? '<span class="badge bg-success">Set</span>' : '<span class="badge bg-secondary">None</span>'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editInstance('${inst.id}')" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="removeInstance('${inst.id}')" title="Remove">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    }

    for (const inst of data) {
        checkInstanceStatus(inst.id);
    }
}

async function checkInstanceStatus(instanceId) {
    const el = document.getElementById('status-' + instanceId);
    if (!el) return;

    try {
        const data = await apiGet('/api/instance-status/' + instanceId);
        if (data && data.online) {
            el.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i>';
        } else {
            el.innerHTML = '<i class="bi bi-x-circle-fill text-danger"></i>';
        }
    } catch {
        el.innerHTML = '<i class="bi bi-question-circle-fill text-warning"></i>';
    }
}

function validateInstanceId(id) {
    if (!id || id.length === 0) return false;
    return /^[\w-]+$/.test(id);
}

async function saveInstance() {
    const form = document.getElementById('add-instance-form');
    const data = Object.fromEntries(new FormData(form));
    data.api_key = data.api_key || null;

    if (!data.id || !data.name || !data.url) {
        alert('Please fill all required fields');
        return;
    }

    if (!validateInstanceId(data.id)) {
        alert('ID can only contain letters, numbers, hyphens, and underscores');
        return;
    }

    try {
        const resp = await apiPost('/api/instances', data);
        if (resp && resp.error) {
            alert('Error: ' + JSON.stringify(resp.error));
        } else if (resp) {
            bootstrap.Modal.getInstance(document.getElementById('addInstanceModal')).hide();
            form.reset();
            loadInstancesList();
        } else {
            alert('Failed to add instance. Check the browser console for details.');
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function editInstance(instanceId) {
    apiGet('/api/instances').then(data => {
        if (!data) return;
        const inst = data.find(i => i.id === instanceId);
        if (!inst) return;

        const form = document.getElementById('edit-instance-form');
        form.elements['id'].value = inst.id;
        form.elements['name'].value = inst.name;
        form.elements['url'].value = inst.url;
        form.elements['api_key'].value = inst.api_key || '';

        new bootstrap.Modal(document.getElementById('editInstanceModal')).show();
    });
}

async function updateInstance() {
    const form = document.getElementById('edit-instance-form');
    const id = form.elements['id'].value;
    const data = {
        name: form.elements['name'].value,
        url: form.elements['url'].value,
        api_key: form.elements['api_key'].value || null,
    };

    if (!data.name || !data.url) {
        alert('Please fill all required fields');
        return;
    }

    try {
        const resp = await apiPut('/api/instances/' + id, data);
        if (resp.error) {
            alert('Error: ' + JSON.stringify(resp.error));
        } else {
            bootstrap.Modal.getInstance(document.getElementById('editInstanceModal')).hide();
            loadInstancesList();
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function removeInstance(instanceId) {
    if (!confirm('Are you sure you want to remove this instance? This cannot be undone.')) return;

    try {
        const resp = await apiDelete('/api/instances/' + instanceId);
        if (resp.error) {
            alert('Error: ' + JSON.stringify(resp.error));
        } else {
            loadInstancesList();
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadInstancesList();
});
