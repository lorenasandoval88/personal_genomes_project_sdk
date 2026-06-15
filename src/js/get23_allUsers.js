/**
 * Fetches 23andMe participant data from Personal Genome Project (PGP) and Openhumans with a cache-first strategy and multi-proxy fallback to bypass CORS restrictions.
 * 
 * Features:
 * - Cache-first loading: Checks local cache before making network requests, and caches successful responses for future use.
 * - Multi-proxy fallback: Tries multiple proxy endpoints (Cloudflare Worker, local proxy, AllOrigins, CORSProxy) to fetch data, increasing chances of success despite CORS issues.
 * - HTML parsing: Parses HTML responses from PGP to extract structured participant data, including IDs, profile URLs, published dates, data types, sources, names, and download links.
 * - Source tracking: Keeps track of where data was loaded from (cache or which proxy) for debugging and transparency.
 */

import localforage from "localforage";
import JSZip from "jszip";

// Helper to check for supported genome version labels (v3, v4, v5)
function hasSupportedGenomeVersionLabel(value = "") {
  return /(^|[^a-z0-9])v(?:3|4|5)(?=[^a-z0-9]|$)/i.test(String(value));
}

//PGP search results page (HTML) for 23andMe datasets—not an API endpoint
const dataType = "23andMe";
const PGP_BASE_URL = "https://my.pgp-hms.org";
const PGP_23ANDME_URL = `${PGP_BASE_URL}/public_genetic_data?utf8=%E2%9C%93&data_type=${dataType}&commit=Search`;
const OPENHUMANS_23ANDME_URL = `https://www.openhumans.org/api/public-data/?data_type=${dataType}`; //TODO: add this 23andm data (not the original filename with chip version)

const WORKER_BASE = "https://lorena-api.lorenasandoval88.workers.dev/?url=";
const PARTICIPANT_CACHE_PREFIX = `Genome:${dataType}-participant-`; // per-participant cache (full metadata + resolved filename)
const PROFILE_CACHE_PREFIX = `Genome:${dataType}-profile-`;
const ALL_PARTICIPANT_CACHE_PREFIX = `Genome:${dataType}-allParticipants-`; // per-participant cache (full metadata + resolved filename)
const ALL_PARTICIPANT_CACHE_FAST_KEY = `${ALL_PARTICIPANT_CACHE_PREFIX}fast`;
const ALL_PARTICIPANT_CACHE_STANDARD_KEY = `${ALL_PARTICIPANT_CACHE_PREFIX}standard`;



let lastAllUsersSource = null;
const lastProfileSourceById = new Map();


// begin data types
async function fetchAvailableDataTypes({
  base_url = `${PGP_BASE_URL}/public_genetic_data`,
      url = `${WORKER_BASE}${encodeURIComponent(base_url)}`,

  fetchImpl = fetch
} = {}) {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch PGP data types: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  // 1) Best case: actual <select name="data_type"> options
  const selectOptions = [
    ...doc.querySelectorAll('select[name="data_type"] option')
  ]
    .map(opt => ({
      value: (opt.getAttribute("value") || "").trim(),
      label: (opt.textContent || "").trim()
    }))
    .filter(d => d.label && d.value);

  if (selectOptions.length) {
    return dedupeByValue(selectOptions);
  }

  // 2) Fallback: links containing ?data_type=...
  const linkOptions = [
    ...doc.querySelectorAll('a[href*="data_type="]')
  ]
    .map(a => {
      try {
        const href = a.getAttribute("href");
        const full = new URL(href, url);
        const value = (full.searchParams.get("data_type") || "").trim();
        const label = (a.textContent || "").trim();
        return { value, label: label || value };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter(d => d.value);

  if (linkOptions.length) {
    return dedupeByValue(linkOptions);
  }

  // 3) Last resort: parse visible text labels
  const text = doc.body?.textContent || "";
  const start = text.indexOf("All data types");
  const end = text.indexOf("Participant Published Data type Source Name Download Report");

  if (start !== -1 && end !== -1 && end > start) {
    const block = text
      .slice(start + "All data types".length, end)
      .replace(/\s+/g, " ")
      .trim();

    const labels = splitDatatypeBlock(block);

    return labels.map(label => ({
      label,
      value: normalizeDataTypeValue(label)
    }));
  }

  return [];
}

function dedupeByValue(items) {
  const seen = new Map();

  for (const item of items) {
    const key = item.value;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }

  return [...seen.values()];
}

function splitDatatypeBlock(block) {
  const knownPrefixes = [
    "biometric data - ",
    "genetic data - ",
    "health records - ",
    "image - ",
    "microbiome data",
    "other"
  ];

  const labels = [];
  let i = 0;

  while (i < block.length) {
    let nextPrefix = null;
    let nextIndex = Infinity;

    for (const prefix of knownPrefixes) {
      const idx = block.indexOf(prefix, i);
      if (idx !== -1 && idx < nextIndex) {
        nextIndex = idx;
        nextPrefix = prefix;
      }
    }

    if (nextPrefix == null) break;

    let followingIndex = Infinity;
    for (const prefix of knownPrefixes) {
      const idx = block.indexOf(prefix, nextIndex + nextPrefix.length);
      if (idx !== -1 && idx < followingIndex) {
        followingIndex = idx;
      }
    }

    const label = block
      .slice(nextIndex, followingIndex === Infinity ? block.length : followingIndex)
      .trim();

    if (label) labels.push(label);
    i = nextIndex + label.length;
  }

  return [...new Set(labels)];
}

function normalizeDataTypeValue(label) {
  // Converts visible labels into likely query values.
  // You can expand this map if PGP uses different internal values.
  const explicitMap = {
    "genetic data - 23andMe": "23andMe",
    "genetic data - Complete Genomics": "Complete Genomics",
    "genetic data - Counsyl": "Counsyl",
    "genetic data - DeCode": "DeCode",
    "genetic data - Family Tree DNA": "Family Tree DNA",
    "genetic data - Gencove low-pass": "Gencove low-pass",
    "genetic data - Illumina": "Illumina",
    "genetic data - Knome": "Knome",
    "genetic data - Navigenics": "Navigenics",
    "genetic data - Pathway Genomics": "Pathway Genomics",
    "genetic data - Veritas Genetics": "Veritas Genetics",
    "biometric data - CSV or similar": "CSV or similar",
    "health records - CCR XML": "CCR XML",
    "health records - PDF or text": "PDF or text",
    "image - PNG or JPEG or similar": "PNG or JPEG or similar",
    "microbiome data": "microbiome data",
    "other": "other"
  };

  if (explicitMap[label]) return explicitMap[label];

  // Generic fallback: remove category prefix
  return label
    .replace(/^genetic data - /i, "")
    .replace(/^biometric data - /i, "")
    .replace(/^health records - /i, "")
    .replace(/^image - /i, "")
    .trim();
}
//   end data types


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

// Per-participant cache helpers
async function getCachedParticipant(id) {
    if (!id) return null;
    const storage = getStorage();
    if (!storage) return null;
    try {
        const cached = await storage.getItem(PARTICIPANT_CACHE_PREFIX + id);
        return cached || null;
    } catch (error) {
        return null;
    }
}

async function setCachedParticipant(id, participant) {
    if (!id) return;
    const storage = getStorage();
    if (!storage) return;
    try {
        await storage.setItem(PARTICIPANT_CACHE_PREFIX + id, {
            ...participant,
            cachedAt: Date.now()
        });
    } catch (error) {
        console.warn(`Failed to cache participant ${id}:`, error);
    }
}

// Bulk cache helpers for fast version (all participants under one key)
async function getCachedAllParticipants_fast(key = ALL_PARTICIPANT_CACHE_FAST_KEY) {
    const storage = getStorage();
    if (!storage) return null;
    try {
        const cached = await storage.getItem(key);
        if (!cached || !Array.isArray(cached.participants)) return null;
        // console.log(`getCachedAllParticipants: found ${cached.participants.length} cached participants`);
        return cached.participants;
    } catch (error) {
        console.warn("Failed to read bulk participants cache:", error);
        return null;
    }
}

async function setCachedAllParticipants(participants, key = ALL_PARTICIPANT_CACHE_FAST_KEY) {
    const storage = getStorage();
    if (!storage) return;
    try {
        await storage.setItem(key, {
            participants,
            cachedAt: Date.now()
        });
        // console.log(`setCachedAllParticipants: saved ${participants.length} participants`);
    } catch (error) {
        console.warn("Failed to save bulk participants cache:", error);
    }
}

// Bulk cache helpers for standard version (all participants under one key)
async function getCachedAllParticipantsStandard(limit) {
    const storage = getStorage();
    if (!storage) return null;
    try {
        const cached = await storage.getItem(ALL_PARTICIPANT_CACHE_STANDARD_KEY);
        if (!cached || !Array.isArray(cached.participants)) return null;
        // console.log(`getCachedAllParticipantsStandard: found ${cached.participants.length} cached participants`);
        return cached.participants.slice(0, limit);
    } catch (error) {
        console.warn("Failed to read standard bulk participants cache:", error);
        return null;
    }
}

async function setCachedAllParticipantsStandard(participants) {
    const storage = getStorage();
    if (!storage) return;
    try {
        await storage.setItem(ALL_PARTICIPANT_CACHE_STANDARD_KEY, {
            participants,
            cachedAt: Date.now()
        });
        // console.log(`setCachedAllParticipantsStandard: saved ${participants.length} participants`);
    } catch (error) {
        console.warn("Failed to save standard bulk participants cache:", error);
    }
}

/**
 * Parse HTML to extract participant data with per-participant caching
 * @param {string} html - HTML content from PGP
 * @param {number} limit - Number of participants to return
 * @param {string} source - Source identifier
 * @param {Object} options - Options for callbacks
 * @param {number} options.batchSize - Log progress every N participants (default: 10)
 * @param {Function} options.onBatchComplete - Callback when a batch is processed
 * @returns {Promise<Array>} Array of participant objects
 */
async function parseParticipants(html, limit, source = "unknown", options = {}) {
    const { batchSize = 10, onBatchComplete = null } = options;
    
    //console.log("parseParticipants(html): Parsing participants from HTML source:", source);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    let rows = [...doc.querySelectorAll("tr[data-file-row]")];
    if (rows.length === 0) {
        rows = [...doc.querySelectorAll("table tr")];
    }

    // console.log(`parseParticipants(html): Parsing participants from HTML source: ${source}. Found ${rows.length} participant rows, first 5 rows:`, rows.slice(0, 5));

    const participants = [];
    let resolvedFromCache = 0;
    let resolvedFromNetwork = 0;

    for (const row of rows) {
        if (participants.length >= limit) break;

        const cells = row.querySelectorAll("td");
        if (cells.length < 7) continue;

        const participantLink = cells[1].querySelector("a");
        const downloadLink = cells[6].querySelector("a");

        if (!participantLink) continue;

        const id = participantLink.textContent.trim();
        const downloadUrl = downloadLink ? `https://my.pgp-hms.org${downloadLink.getAttribute("href")}` : null;
        
        // Check per-participant cache first
        const cachedParticipant = await getCachedParticipant(id);
        
        if (cachedParticipant) {
            participants.push(cachedParticipant);
            resolvedFromCache++;
            // console.log(`parseParticipants(html): [CACHE HIT] id: ${id}, filename: ${cachedParticipant.fileName}`,cachedParticipant);
        } else {
            // Resolve actual filename from download URL
            const resolved = await resolveDownloadFilename(downloadUrl);
            resolvedFromNetwork++;
            
            const participant = {
                id,
                profileUrl: `https://my.pgp-hms.org${participantLink.getAttribute("href")}`,
                publishedDate: cells[2].textContent.trim(),
                dataType: cells[3].textContent.trim(),
                dataSource: source,
                name: cells[5].textContent.trim(),
                fileName: resolved.fileName,
                fileExtension: resolved.fileExtension,
                finalUrl: resolved.finalUrl,
                downloadUrl
            };
            
            // Cache the participant
            await setCachedParticipant(id, participant);
            participants.push(participant);
            // console.log(`parseParticipants [NETWORK] id: ${id}, filename: ${resolved.fileName}`);
        }
        
        // Progress callback every batchSize participants
        if (participants.length % batchSize === 0) {
            // console.log(`parseParticipants: Progress ${participants.length}/${limit} (cache: ${resolvedFromCache}, network: ${resolvedFromNetwork})`);
            if (onBatchComplete) {
                await onBatchComplete([...participants]);
            }
        }
    }
    
    // console.log(`Parsed ${participants.length} participants (cache: ${resolvedFromCache}, network: ${resolvedFromNetwork}):`);
 
    return participants;
}

/**
 * Parse HTML to extract participant data (fast version - no network calls per participant)
 * @param {string} html - HTML content from PGP
 * @param {number} limit - Number of participants to return
 * @returns {Array} Array of participant objects
 */
function parseParticipants_fast(html, source = "unknown") {
    // console.log("***************Parsing participants (fast) from HTML source:", source);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    let rows = [...doc.querySelectorAll("tr[data-file-row]")];
    if (rows.length === 0) {
        rows = [...doc.querySelectorAll("table tr")];
    }

    // console.log("Found rows:", rows.length);

    const participants = [];

    for (const row of rows) {

        const cells = row.querySelectorAll("td");
        if (cells.length < 7) continue;

        const participantLink = cells[1].querySelector("a");
        const downloadLink = cells[6].querySelector("a");

        if (!participantLink) continue;

        const fileName = cells[5].textContent.trim();
        const fileExtension = fileName.match(/\.(txt|zip)$/i)?.[1]?.toLowerCase() || null;
        // console.log(`parseParticipants_fast  filename: ${fileName} (download URL: ${downloadLink ? `https://my.pgp-hms.org${downloadLink.getAttribute("href")}` : "no download link"})`);
        const participant = {
            id: participantLink.textContent.trim(),
            profileUrl: `https://my.pgp-hms.org${participantLink.getAttribute("href")}`,
            publishedDate: cells[2].textContent.trim(),
            dataType: cells[3].textContent.trim(),
            dataSource: source,
            name: fileName,
            fileName,
            fileExtension,
            finalUrl: null, // Not resolved in fast version
            downloadUrl: downloadLink ? `https://my.pgp-hms.org${downloadLink.getAttribute("href")}` : null
        };
        participants.push(participant);
    }
    // console.log(`Parsed ${participants.length} participants (fast):`, participants[0]);
    return participants;
}

/**
 * Fetch a list of PGP 23andMe participants (fast version - no filename resolution)
 * Uses bulk cache under ALL_PARTICIPANT_CACHE_PREFIX - all participants stored under one key.
 * Returns cached data if available and sufficient, otherwise fetches fresh HTML.
 * @param {number} limit - Number of participants to return (default: 1100)
 * @returns {Promise<Array>} Array of participant objects
 */
async function allUsersMetaDataByType_fast(dataType = "23andMe") {
/**
 * Fetch a list of PGP 23andMe participants (fast version - no filename resolution)
 * Uses bulk cache under ALL_PARTICIPANT_CACHE_PREFIX - all participants stored under one key.
 * Returns cached data if available and sufficient, otherwise fetches fresh HTML.
 * @param {number} limit - Number of participants to return (default: 1100)
 * @returns {Promise<Array>} Array of participant objects
 */
    const pgpUrl = `${PGP_BASE_URL}/public_genetic_data?utf8=%E2%9C%93&data_type=${encodeURIComponent(dataType)}&commit=Search`;
    const cacheKey = `Genome:${dataType}-allParticipants-fast`;

    // Check bulk cache first
    const cached = await getCachedAllParticipants_fast(cacheKey);
    if (cached && cached.length > 0) {
        lastAllUsersSource = "cache";
        // console.log(`fetch23andMeParticipants_fast(): Found ${cached.length} participants from bulk cache:`, cached);
        return cached;
    }

    const candidates = [
        { name: "cf-worker", url: `${WORKER_BASE}${encodeURIComponent(pgpUrl)}` },
        { name: "local-proxy", url: "http://localhost:3000/pgp-participants" },
        { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(pgpUrl)}` },
        { name: "corsproxy", url: `https://corsproxy.io/?${pgpUrl}` }
    ];
    let html = null;
    let usedSource = null;
    const errors = [];

    for (const candidate of candidates) {
        try {
            // console.log(`fetch23andMeParticipants_fast(): Trying to fetch participants from ${candidate.name}...`);
            const response = await fetch(candidate.url);
            if (response.ok) {
                // console.log(`fetch23andMeParticipants_fast(): Successfully fetched from ${candidate.name}`);
                html = await response.text();
                usedSource = candidate.name;
                break;
            }
            errors.push(`${candidate.name}: HTTP ${response.status}`);
        } catch (error) {
            errors.push(`${candidate.name}: ${error.message}`);
        }
    }
    if (!html) {
        throw new Error(`Failed to fetch PGP data: ${errors.join(", ")}`);
    }
    lastAllUsersSource = usedSource;
    
    const participants = parseParticipants_fast(html, lastAllUsersSource);
    
    // Save to bulk cache
    await setCachedAllParticipants(participants, cacheKey);
    
    return participants;
}

/**
 * Fetch a list of PGP 23andMe participants with per-participant caching.
 * Uses cache-first loading from a standard bulk cache and falls back to HTML fetching.
 * Parsed participants are cached in bulk and also cached individually for filename resolution.
 * Each participant is cached individually - "Load more" naturally works.
 * @param {number} limit - Number of participants to return (default: 10)
 * @param {Object} options - Options
 * @param {number} options.batchSize - Log progress every N participants (default: 10)
 * @returns {Promise<Array>} Array of participant objects
 */
async function fetch23andMeParticipants(limit = 10, options = {}) {
    // const types = await fetchAvailableDataTypes();
    // console.log("types-------------------:", types);


    const { batchSize = 10 } = options;

    const cached = await getCachedAllParticipantsStandard(limit);
    if (cached && cached.length >= limit) {
        lastAllUsersSource = "cache";
        // console.log(`fetch23andMeParticipants(): Found ${cached.length} participants from standard bulk cache`);
        return cached;
    }
    
    //console.log("fetch23andMeParticipants-------------------")

    const candidates = [
        { name: "cf-worker", url: `${WORKER_BASE}${encodeURIComponent(PGP_23ANDME_URL)}` },
        { name: "local-proxy", url: "http://localhost:3000/pgp-participants" },
        { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(PGP_23ANDME_URL)}` },
        { name: "corsproxy", url: `https://corsproxy.io/?${PGP_23ANDME_URL}` }
    ];
    let html = null;
    let usedSource = null;
    const errors = [];

    for (const candidate of candidates) {
        try {
            // console.log(`fetch23andMeParticipants(): Trying to fetch participants from ${candidate.name}...`);
            const response = await fetch(candidate.url);
            if (response.ok) {
                html = await response.text();
                // console.log(`fetch23andMeParticipants(): Successfully fetched participants from ${candidate.name},`, `response.text()...:`, html.slice(0, 500));

                usedSource = candidate.name;
                break;
            }
            errors.push(`${candidate.name}: HTTP ${response.status}`);
        } catch (error) {
            errors.push(`${candidate.name}: ${error.message}`);
        }
    }

    if (!html) {
        throw new Error(`Failed to fetch PGP data: ${errors.join(", ")}`);
    }

    lastAllUsersSource = usedSource;
    
    // Parse - each participant is cached individually
    const participants = await parseParticipants(html, limit, lastAllUsersSource, { batchSize });
    await setCachedAllParticipantsStandard(participants);
    return participants;
}

// Fetch a PGP profile by ID using cache if available, otherwise try multiple proxy endpoints until successful, then cache and return the result.
// 1. Cache-first strategy 2. Multi-proxy fallback 3. Source tracking
// Example: fetchProfile("hu416394").then(console.log);
async function fetchProfile(id) {
    console.log(`fetchProfile(): Fetching profile for ID: ${id}...`);
    const resolvedId = typeof id === "string" && id.trim() ? id.trim() : "hu09B28E";

    const cachedProfile = await getCachedProfile(resolvedId);
    if (cachedProfile) {
        console.log(`fetchProfile(): Cache hit for ID: ${resolvedId}`)//, profile:`, cachedProfile);
        lastProfileSourceById.set(resolvedId, "cache");
        return cachedProfile;
    }
    console.log(`fetchProfile(): Cache miss for ID: ${resolvedId}, trying network...`);
    const profileUrl = `https://my.pgp-hms.org/profile/${resolvedId}.json`;
    const candidates = [
        { name: "cf-worker", url: `${WORKER_BASE}${encodeURIComponent(profileUrl)}` },
        { name: "local-proxy", url: `http://localhost:3000/pgp-profile/${resolvedId}` },
        { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(profileUrl)}` },
        { name: "corsproxy", url: `https://corsproxy.io/?${profileUrl}` }
    ];

    const errors = [];
    for (const candidate of candidates) {
        // console.log(`fetchProfile(): Trying to fetch profile ${resolvedId} from ${candidate.name}...`);

        try {
            const res = await fetch(candidate.url, {
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!res.ok) {
                errors.push(`${candidate.name}: HTTP ${res.status}`);
                continue;
            }
            const data = await res.json();
            console.log(`fetchProfile(): Successfully fetched profile ${resolvedId} from ${candidate.name}`,data);

            lastProfileSourceById.set(resolvedId, candidate.name);
            await setCachedProfile(resolvedId, data);
            //console.log(`fetchProfile(): Saving profile cache in localforage: ${resolvedId}`);

            return data;
        } catch (error) {
            errors.push(`${candidate.name}: ${error.message}`);
        }
    }

    throw new Error(`Failed to fetch profile ${resolvedId}: ${errors.join(", ")}`);
}

// Helper functions for fetchProfile(id) cache management
async function getCachedProfile(id) {
    const storage = getStorage();
    if (!storage) return null;

    try {
        const cached = await storage.getItem(PROFILE_CACHE_PREFIX + id);
        if (!cached) return null;

        const { savedAt, profile } = cached;
        if (isCacheWithinMonths(savedAt)) {
            return profile;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Helper functions for fetchProfile(id) cache management
async function setCachedProfile(id, profile) {
    const storage = getStorage();
    if (!storage) return;
    await storage.setItem(PROFILE_CACHE_PREFIX + id, {
        savedAt: new Date().toISOString(),
        profile
    });
}
function getLastAllUsersSource() {
    // console.log("getLastAllUsersSource:", lastAllUsersSource);
    return lastAllUsersSource;
}

function getLastProfileSource(id) {
    // console.log("getLastProfileSource:", lastProfileSourceById.get(id));
    return lastProfileSourceById.get(id) || null;
}


/**
 * Resolve the actual filename from a PGP download URL by following redirects.
 * Uses multi-proxy fallback to bypass CORS, similar to loadTxts.js.
 * @param {string} downloadUrl - The download URL (e.g., https://my.pgp-hms.org/user_file/download/4187)
 * @returns {Promise<{finalUrl: string, fileName: string, fileExtension: string|null}>}
 */
async function resolveDownloadFilename(downloadUrl) {
    if (!downloadUrl) {
        return { finalUrl: null, fileName: null, fileExtension: null };
    }

    const candidates = [
        { name: "cf-worker", url: `${WORKER_BASE}${encodeURIComponent(downloadUrl)}` },
        { name: "local-proxy", url: `http://localhost:3000/pgp-resolve?url=${encodeURIComponent(downloadUrl)}` },
        { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(downloadUrl)}` },
        { name: "corsproxy", url: `https://corsproxy.io/?${downloadUrl}` }
    ];

    let finalUrl = null;
    let finalResponse = null;
    let successSource = null;
    let lastError = null;

    for (const candidate of candidates) {
        try {
            // console.log(`resolveDownloadFilename(): Trying ${candidate.name}...from url ${candidate.url}`);
            const response = await fetch(candidate.url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Get final URL from header or response.url
            finalUrl =
                response.headers.get("x-final-url") ||
                response.headers.get("X-Final-URL") ||
                response.url;

            finalResponse = response;
            successSource = candidate.name;
            // console.log(`resolveDownloadFilename(): Success with ${candidate.name}. Final URL: ${finalUrl}`);
            break;
        } catch (err) {
            console.warn(`resolveDownloadFilename(): ${candidate.name} failed: ${err.message}`);
            lastError = err;
        }
    }

    if (!finalUrl || !finalResponse) {
        console.warn(`resolveDownloadFilename(): All proxies failed for ${downloadUrl}: ${lastError?.message}`);
        return { finalUrl: null, fileName: null, fileExtension: null };
    }

    // ------------------------------------------------------------
    // Route by final URL type
    // ------------------------------------------------------------

    // 1) Direct TXT
    if (finalUrl.endsWith(".txt")) {
        const fileName = finalUrl.split("/").pop()?.split("?")[0] || null;
        const fileExtension = "txt";
        // console.log(`resolveDownloadFilename(): Direct TXT - filename: ${fileName}`);
        return { finalUrl, fileName, fileExtension };
    }

    // 2) Direct ZIP - extract inner TXT filename
    else if (finalUrl.endsWith(".zip")) {
        try {
            const buffer = await finalResponse.arrayBuffer();

            if (!buffer || buffer.byteLength === 0) {
                throw new Error(`ZIP response from ${successSource} is empty`);
            }

            const bytes = new Uint8Array(buffer);
            const isZipBuffer = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;

            if (!isZipBuffer) {
                const preview = new TextDecoder("utf-8").decode(bytes.slice(0, 300));
                console.error("resolveDownloadFilename(): Response is not a ZIP file. Preview:", preview);
                throw new Error(`Response from ${successSource} is not a ZIP archive`);
            }

            const zip = await JSZip.loadAsync(buffer);
            const zipNames = Object.keys(zip.files);
            // console.log("resolveDownloadFilename(): ZIP entries:", zipNames);

            const targetFile = zipNames
                .map(name => zip.files[name])
                .find(file => !file.dir && file.name.toLowerCase().endsWith(".txt") && hasSupportedGenomeVersionLabel(file.name));

            if (!targetFile) {
                // Fallback to ZIP filename itself
                const zipFileName = finalUrl.split("/").pop()?.split("?")[0] || null;
                // console.log(`resolveDownloadFilename(): No v3/v4/v5 .txt found in ZIP, using ZIP filename: ${zipFileName}`);
                return { finalUrl, fileName: zipFileName, fileExtension: "zip" };
            }

            // console.log(`resolveDownloadFilename(): Found TXT inside ZIP: ${targetFile.name}`);
            return { finalUrl, fileName: targetFile.name, fileExtension: "txt" };
        } catch (err) {
            console.warn(`resolveDownloadFilename(): Failed to parse ZIP: ${err.message}`);
            const zipFileName = finalUrl.split("/").pop()?.split("?")[0] || null;
            return { finalUrl, fileName: zipFileName, fileExtension: "zip" };
        }
    }

    // 3) Directory listing / collection root
    else if (finalUrl.endsWith("/_/")) {
        try {
            const html = await finalResponse.text();

            if (!html || !html.trim()) {
                throw new Error(`Directory listing from ${successSource} is empty`);
            }

            // Extract hrefs from HTML listing
            const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map(m => m[1]);

            // Prefer .zip first, then .txt
            const preferredHref =
                hrefs.find(h => /\.zip$/i.test(h) && hasSupportedGenomeVersionLabel(h)) ||
                hrefs.find(h => /\.txt$/i.test(h) && hasSupportedGenomeVersionLabel(h));

            if (!preferredHref) {
                console.warn("resolveDownloadFilename(): No v3/v4/v5 .zip or .txt found in directory listing");
                return { finalUrl, fileName: null, fileExtension: null };
            }

            const resolvedFileUrl = new URL(preferredHref, finalUrl).href;
            const fileName = resolvedFileUrl.split("/").pop()?.split("?")[0] || null;
            const fileExtension = fileName?.match(/\.(txt|zip)$/i)?.[1]?.toLowerCase() || null;

            // console.log(`resolveDownloadFilename(): Directory listing resolved to: ${fileName}`);
            return { finalUrl: resolvedFileUrl, fileName, fileExtension };
        } catch (err) {
            console.warn(`resolveDownloadFilename(): Failed to parse directory listing: ${err.message}`);
            return { finalUrl, fileName: null, fileExtension: null };
        }
    }

    // 4) Fallback - extract filename from URL
    const fileName = finalUrl.split("/").pop()?.split("?")[0] || null;
    const fileExtension = fileName?.match(/\.(txt|zip)$/i)?.[1]?.toLowerCase() || null;

    // console.log(`resolveDownloadFilename(): Fallback - extracted filename: ${fileName}, extension: ${fileExtension}`);
    return { finalUrl, fileName, fileExtension };
}



// Expose for dev console
if (typeof window !== "undefined") {
    window.fetchAvailableDataTypes = fetchAvailableDataTypes;
    window.fetch23andMeParticipants = fetch23andMeParticipants;
    window.allUsersMetaDataByType_fast = allUsersMetaDataByType_fast;
    window.parseParticipants = parseParticipants;
    window.parseParticipants_fast = parseParticipants_fast;
    window.fetchProfile = fetchProfile;
    window.getLastAllUsersSource = getLastAllUsersSource;
    window.getLastProfileSource = getLastProfileSource;
    window.resolveDownloadFilename = resolveDownloadFilename;
}

// Export for use as ES module
export {
    fetchAvailableDataTypes,
    fetch23andMeParticipants,
    allUsersMetaDataByType_fast,
    parseParticipants,
    parseParticipants_fast,
    fetchProfile,
    getLastAllUsersSource,
    getLastProfileSource,
    resolveDownloadFilename
};


// ALL USERS ENDPOINT (VCF 23ANDME ETC METADATA, WITHOUT FILES) - PAGINATED JSON (NO HTML PARSING, MORE STABLE)
// without web crawling, so we dont rely on the HTML structure of the page, which can change 
// and break our code. Instead, we can use the JSON endpoint that provides structured data about 
// users. This endpoint is paginated, so we can fetch all pages to get the complete list of 
// participants.
// Get all 6214 users: paginate the JSON endpoint
// https://my.pgp-hms.org/users.json?page=1
// https://my.pgp-hms.org/users.json?page=2
// https://my.pgp-hms.org/users.json?page=3
// ...

// async function fetchAllUsersJson() {
//   const all = [];
//   let page = 1;
//   let total = Infinity;

//   while (all.length < total) {
//     const url = `https://my.pgp-hms.org/users.json?page=${page}`;
//     const res = await fetch(url);
//     const json = await res.json();

//     const chunk = json.aaData || [];

//     if (total === Infinity) {
//       total = json.iTotalRecords || Infinity;
//       console.log("Total records:", total);
//     }

//     if (!chunk.length) break;

//     all.push(...chunk);

//     page++;
//     await new Promise(r => setTimeout(r, 150));
//   }

//   return all;
// }
