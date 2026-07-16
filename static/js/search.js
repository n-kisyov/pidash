async function searchDomain() {
    const input = document.getElementById('search-input');
    const domain = input.value.trim();
    if (!domain) return;

    const loading = document.getElementById('search-loading');
    const results = document.getElementById('search-results');
    loading.classList.remove('d-none');
    results.innerHTML = '';

    try {
        const data = await apiGet('/api/search?domain=' + encodeURIComponent(domain));
        loading.classList.add('d-none');
        renderSearchResults(data, domain);
    } catch (err) {
        loading.classList.add('d-none');
        results.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>';
    }
}

function renderSearchResults(data, query) {
    const results = document.getElementById('search-results');
    if (!data || !data.search) {
        results.innerHTML = '<div class="alert alert-warning">No results found.</div>';
        return;
    }

    const s = data.search;
    const total = s.results.total || 0;

    let html = '<h5 class="mb-3">Results for <code>' + escapeHtml(query) + '</code> (' + formatNumber(total) + ' matches)</h5>';

    if (data.errors && data.errors.length > 0) {
        html += '<div class="alert alert-warning small">Some instances returned errors: ' +
            data.errors.map(e => e.instance).join(', ') + '</div>';
    }

    if (s.domains && s.domains.length > 0) {
        html += '<div class="card mb-3"><div class="card-header"><strong>Domain Lists</strong> (' + s.domains.length + ')</div>';
        html += '<div class="card-body p-0"><table class="table table-sm mb-0">';
        html += '<thead><tr><th>Domain</th><th>Type</th><th>Kind</th><th>Instance</th><th>Comment</th></tr></thead><tbody>';
        s.domains.forEach(d => {
            const typeBadge = d.type === 'allow'
                ? '<span class="badge bg-success">Allow</span>'
                : '<span class="badge bg-danger">Deny</span>';
            const kindBadge = d.kind === 'regex'
                ? '<span class="badge bg-info text-dark">Regex</span>'
                : '<span class="badge bg-light text-dark">Exact</span>';
            html += `<tr>
                <td><code>${escapeHtml(d.domain)}</code></td>
                <td>${typeBadge}</td>
                <td>${kindBadge}</td>
                <td><small class="text-muted">${escapeHtml(d._instance_name || d._instance_id)}</small></td>
                <td><small>${escapeHtml(d.comment || '')}</small></td>
            </tr>`;
        });
        html += '</tbody></table></div></div>';
    }

    if (s.gravity && s.gravity.length > 0) {
        html += '<div class="card mb-3"><div class="card-header"><strong>Gravity (Adlists)</strong> (' + s.gravity.length + ')</div>';
        html += '<div class="card-body p-0"><table class="table table-sm mb-0">';
        html += '<thead><tr><th>Domain</th><th>Source</th><th>Type</th><th>Instance</th></tr></thead><tbody>';
        s.gravity.forEach(g => {
            const typeBadge = g.type === 'allow'
                ? '<span class="badge bg-success">Allow</span>'
                : '<span class="badge bg-danger">Block</span>';
            const addrDisplay = g.address && g.address.length > 60
                ? g.address.substring(0, 57) + '...' : g.address;
            html += `<tr>
                <td><code>${escapeHtml(g.domain)}</code></td>
                <td><small title="${escapeHtml(g.address || '')}">${escapeHtml(addrDisplay || '')}</small></td>
                <td>${typeBadge}</td>
                <td><small class="text-muted">${escapeHtml(g._instance_name || g._instance_id)}</small></td>
            </tr>`;
        });
        html += '</tbody></table></div></div>';
    }

    if (total === 0) {
        html += '<div class="alert alert-info">No matches found for <code>' + escapeHtml(query) + '</code> across any instance.</div>';
    }

    results.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-input').focus();
});
