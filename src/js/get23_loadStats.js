import localforage from "localforage";
import Plotly from "plotly.js-dist-min";

const CACHE_KEY = "Genome:23andme-stats";

function getStorage() {
    return localforage;
}

function isCacheWithinMonths(savedAt, months = 3) {
    if (!savedAt) return false;
    const savedDate = new Date(savedAt);
    if (Number.isNaN(savedDate.getTime())) return false;

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return savedDate >= cutoff;
}

async function getCachedStats() {

    const storage = getStorage();
    if (!storage) return null;
    try {
        const cached = await storage.getItem(CACHE_KEY);
        if (!cached) return null;
        console.log("getCachedStats(): Checking local cache for stats summary...", cached);

        const { savedAt, stats, source } = cached;

        if (isCacheWithinMonths(savedAt)) {
            const age = Date.now() - new Date(savedAt).getTime();
            console.log(`getCachedStats(): Using cached stats summary (${Math.round(age / (24 * 60 * 60 * 1000))} days old)`);
            return { stats, source: `${source} (cached)` };
        }
        console.log("getCachedStats(): Failed to read stats cache: expired or missing, fetching fresh data");
        return null;
    } catch (e) {
        console.warn("getCachedStats(): stats cache read error:", e);
        return null;
    }
}

async function setCachedStats(stats, source) {
    const storage = getStorage();
    if (!storage) return;
    await storage.setItem(CACHE_KEY, {
        savedAt: new Date().toISOString(),
        stats,
        source
    });
}

async function displayStats(options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const sourceStatusEl = document.getElementById("sourceStatus");
    const forceRefreshBtn = document.getElementById("forceRefreshStatsBtn");
    const outputEl = document.getElementById("output");
    const chartEl = document.getElementById("chart");
    if (sourceStatusEl) sourceStatusEl.textContent = "Source: checking...";
    if (forceRefreshBtn) forceRefreshBtn.disabled = true;

    const WORKER_BASE = "https://lorena-api.lorenasandoval88.workers.dev/?url=";
    // If you added a token:
    // const WORKER_BASE = "https://YOUR-WORKER.workers.dev/?token=MYSECRET123&url=";

    try {
        // Check cache first
        const cached = forceRefresh ? null : await getCachedStats();
        if (cached) {
            //console.log("Using cached stats:", cached);
            if (sourceStatusEl) sourceStatusEl.textContent = `Source: ${cached.source}`;
            if (outputEl) {
                outputEl.textContent = `${JSON.stringify(cached.stats, null, 2)}\n\nSource: ${cached.source}`;
            }
            
            const data = [{
                x: ["Datasets", "Participants", "Positions"],
                y: [cached.stats.datasets, cached.stats.participants, cached.stats.positions],
                type: "bar"
            }];
            if (chartEl) {
                Plotly.newPlot("chart", data, { title: "PGP 23andMe Data Statistics" });
            }
            return cached.stats;
        }
        if (forceRefresh) {
            console.log("Force refresh requested: bypassing cache");
        }
        // If no valid cache, try fetching from multiple sources with fallbacks
        const target = "https://my.pgp-hms.org/public_genetic_data/statistics";
        const candidates = [
             // ✅ your Cloudflare Worker (put near the top)
            { name: "cf-worker", url: `${WORKER_BASE}${encodeURIComponent(target)}` },
            { name: "local-proxy", url: "http://localhost:3000/pgp-stats" },
            // { name: "powershell-proxy", url: "http://localhost:3000/pgp-stats" },
            { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}` },
            { name: "corsproxy", url: `https://corsproxy.io/?${target}` },
            { name: "github-pages-proxy", url: "https://lorenasandoval88.github.io/get-23andme-data/pgp-stats" }
        ];

        let html = null;
        let source = null;
        const failures = [];

        for (const candidate of candidates) {
            try {
                const response = await fetch(candidate.url);
                //console.log(`Trying ${candidate.name}: HTTP ${response.status}`);
                if (!response.ok) {
                    failures.push(`${candidate.name}: HTTP ${response.status}`);
                    continue;
                }

                html = await response.text();
                source = candidate.name;
                break;
            } catch (error) {
                failures.push(`${candidate.name}: ${error.message}`);
            }
        }

        if (!html) {
            throw new Error(`Unable to fetch stats (${failures.join(" | ")}).`);
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        //23andme data is in a table, so we look for rows
        const rows = [...doc.querySelectorAll("table tbody tr")];
        let stats = null;
        console.log("rows",rows)
        for (const row of rows) {
            const cols = row.querySelectorAll("td");
            if (cols.length === 0) continue;

            const type = cols[0].innerText.toLowerCase();
            if (!type.includes("23and")) continue;

            stats = {
                dataType: cols[0].innerText.trim(),
                datasets: parseInt(cols[1].innerText.replace(/,/g, ""), 10),
                participants: parseInt(cols[2].innerText.replace(/,/g, ""), 10),
                positions: parseInt(cols[3].innerText.replace(/,/g, ""), 10)
            };
            //console.log("Extracted stats:", stats);
            break;
        }

        if (!stats) {
            if (sourceStatusEl) sourceStatusEl.textContent = `Source: ${source}`;
            if (outputEl) outputEl.textContent = "No data found";
            return null;
        }

        // Cache the fresh data
        await setCachedStats(stats, source);

        if (sourceStatusEl) sourceStatusEl.textContent = `Source: ${source}`;
        if (outputEl) {
            outputEl.textContent = `${JSON.stringify(stats, null, 2)}\n\nSource: ${source}`;
        }

        const data = [{
            x: ["Datasets", "Participants", "Positions"],
            y: [stats.datasets, stats.participants, stats.positions],
            type: "bar"
        }];

        const layout = {
            title: "PGP 23andMe Data Statistics"
        };

        if (chartEl) {
            Plotly.newPlot("chart", data, layout);
        }
        return stats;
    } catch (error) {
        if (sourceStatusEl) sourceStatusEl.textContent = "Source: unavailable";
        if (outputEl) outputEl.textContent = `Error: ${error.message}`;
        return null;
    } finally {
        if (forceRefreshBtn) forceRefreshBtn.disabled = false;
    }
}

const forceRefreshBtn = document.getElementById("forceRefreshStatsBtn");
if (forceRefreshBtn) {
    forceRefreshBtn.addEventListener("click", () => displayStats({ forceRefresh: true }));
}

// Expose for dev console
if (typeof window !== "undefined") {
    window.displayStats = displayStats;
    window.getCachedStats = getCachedStats;
    window.setCachedStats = setCachedStats;
}

export { displayStats }