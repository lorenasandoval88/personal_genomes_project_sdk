const PARTICIPANTS_URL = "./src/js/data/participant_list_1017.json";

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[ch]));
}

function renderProfilesTable(participants) {
    const container = document.getElementById('profilesTable');
    if (!container) return;

    if (!participants || participants.length === 0) {
        container.innerHTML = '<p class="text-muted">No participants loaded</p>';
        return;
    }

    let html = `
        <table class="table table-striped table-hover" style="table-layout:fixed; width:100%;">
            <thead class="table-dark">
                <tr>
                    <th style="width:110px;">ID</th>
                    <th style="width:140px;">Name</th>
                    <th style="width:110px;">Published</th>
                    <th style="width:220px;">File</th>
                    <th style="width:80px;">Type</th>
                    <th style="width:80px;">Profile</th>
                </tr>
            </thead>
            <tbody>
    `;

    const truncateStyle = 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';

    for (const p of participants) {
        const id = escapeHtml(p.id);
        const name = escapeHtml(p.name || 'N/A');
        const published = escapeHtml(p.publishedDate || '');
        const profileUrl = p.profileUrl || `https://my.pgp-hms.org/profile/${p.id}`;
        const fileUrl = p.finalUrl || p.downloadUrl || null;
        const fileName = escapeHtml(p.fileName || (fileUrl ? 'Download' : 'N/A'));
        const ext = escapeHtml(p.fileExtension || '');
        const fileCell = fileUrl
            ? `<a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer">${fileName}</a>`
            : 'N/A';

        html += `
            <tr>
                <td><code>${id}</code></td>
                <td style="${truncateStyle}" title="${name}">${name}</td>
                <td>${published}</td>
                <td style="${truncateStyle}" title="${fileName}">${fileCell}</td>
                <td>${ext}</td>
                <td><a href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">View</a></td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function displayProfiles() {
    const container = document.getElementById('profilesTable');
    const sourceStatusEl = document.getElementById('profilesSourceStatus');
    if (container) container.innerHTML = 'Loading participants...';
    if (sourceStatusEl) sourceStatusEl.textContent = 'Source: loading...';

    try {
        const response = await fetch(PARTICIPANTS_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} for ${PARTICIPANTS_URL}`);
        }
        const participants = await response.json();

        if (sourceStatusEl) {
            sourceStatusEl.textContent = `Source: participant_list_1017.json, updated 06-23-2026 in GCP`;
        }

        renderProfilesTable(participants);

        return { participants, source: 'static-json' };
    } catch (error) {
        if (sourceStatusEl) sourceStatusEl.textContent = 'Source: unavailable';
        if (container) container.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
        return { participants: [], source: 'unavailable', error: error.message };
    }
}

// Expose for dev console
if (typeof window !== "undefined") {
    window.displayProfiles = displayProfiles;
    window.renderProfilesTable = renderProfilesTable;
}

export {
    displayProfiles,
    renderProfilesTable
};
