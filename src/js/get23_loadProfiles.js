import {
    allUsersMetaDataByType_fast,
    fetchProfile,
    getLastAllUsersSource,
    getLastProfileSource
} from './get23_allUsers.js';

function renderProfilesTable(profiles) {
    const container = document.getElementById('profilesTable');
    if (!container) return;

    const validProfiles = profiles.filter(p => p.profile);

    if (validProfiles.length === 0) {
        container.innerHTML = '<p class="text-muted">No profiles loaded</p>';
        return;
    }

    let html = `
        <table class="table table-striped table-hover">
            <thead class="table-dark">
                <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>State</th>
                    <th>Sex</th>
                    <th>Profile</th>
                    <th>23andMe File</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const { id, profile } of validProfiles) {
        const name = profile.real_name || profile.username || 'N/A';
        const state = profile.state || 'N/A';
        const sex = profile.sex || 'N/A';
        const profileUrl = `https://my.pgp-hms.org/profile/${id}`;

        const files = profile.files || [];
        const file23andMe = files.find(f =>
            (f.data_type && f.data_type.toLowerCase().includes('23andme')) ||
            (f.name && f.name.toLowerCase().includes('23andme'))
        );
        const fileLink = file23andMe && file23andMe.download_url ?
            `<a href=${file23andMe.download_url} target="_blank">Download</a>` :
            'N/A';

        html += `
            <tr>
                <td><code>${id}</code></td>
                <td>${name}</td>
                <td>${state}</td>
                <td>${sex}</td>
                <td><a href="${profileUrl}" target="_blank">View</a></td>
                <td>${fileLink}</td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function displayProfiles() {
    const container = document.getElementById('profilesTable');
    const sourceStatusEl = document.getElementById('profilesSourceStatus');
    if (container) container.innerHTML = 'Loading profiles...';
    if (sourceStatusEl) sourceStatusEl.textContent = 'Source: checking...';

    try {
        const participants = await allUsersMetaDataByType_fast();
        const participantsSource = getLastAllUsersSource();
        const participants_ids = [...new Set(participants.map(p => p.id))].slice(0, 10);

        let cachedCount = 0;
        let fetchedCount = 0;
        const fetchedProfileSources = new Set();

        const profiles = await Promise.all(
            participants_ids.map(async (id) => {
                try {
                    const profile = await fetchProfile(id);
                    const profileSource = getLastProfileSource(id);

                    if (profileSource === "cache") {
                        cachedCount++;
                    } else {
                        if (profileSource) fetchedProfileSources.add(profileSource);
                        fetchedCount++;
                    }
                    return {
                        id,
                        profile,
                        error: null
                    };
                } catch (error) {
                    return {
                        id,
                        profile: null,
                        error: error.message
                    };
                }
            })
        );

        const source = cachedCount > 0 && fetchedCount === 0 ?
            'cache' :
            cachedCount > 0 ?
            `${cachedCount} cached, ${fetchedCount} fetched` :
            'fresh';
        const participantsSourceLabel = participantsSource || "unknown";
        const profilesSourceLabel = fetchedProfileSources.size > 0 ? Array.from(fetchedProfileSources).join(", ") : "cache";
        if (sourceStatusEl) sourceStatusEl.textContent = `Source: ${source} (participants: ${participantsSourceLabel}; profiles: ${profilesSourceLabel})`;

        renderProfilesTable(profiles);

        return {
            profiles,
            source,
            participantsSource: participantsSourceLabel,
            profilesSource: profilesSourceLabel,
            cachedCount,
            fetchedCount
        };
    } catch (error) {
        if (sourceStatusEl) sourceStatusEl.textContent = 'Source: unavailable';
        if (container) container.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
        return {
            profiles: [],
            source: 'unavailable',
            error: error.message
        };
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
