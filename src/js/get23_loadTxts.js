import localforage from "localforage";
const dataType = "23andMe";
const MAX_GET23_CACHE_BYTES = 600 * 1024 * 1024;
const GET23_KEY_PREFIX = `Genome:${dataType}-txt-`;

import JSZip from "jszip";

// evicts in this order:First: cached pgs:id-* entries whose IDs are not in current ids.
// Then (only if still over limit): entries whose IDs are in current ids.
async function limitStorage(ids = []) {
  const entries = [];
  let totalBytes = 0;
  const requestedIds = new Set((ids || []).map(id => String(id)));

  await localforage.iterate((value, key) => {
    if (!key.startsWith(GET23_KEY_PREFIX)) {
      return;
    }
    const entryBytes = getByteSize({
      key,
      value
    });
    const createdAt = Number(value?.cachedAt) || 0;
    const id = key.slice(GET23_KEY_PREFIX.length);

    entries.push({
      key,
      id,
      entryBytes,
      createdAt
    });
    totalBytes += entryBytes;
    // console.log(`Cached genome entries: ${key}, Size: ${(entryBytes / 1024 / 1024).toFixed(2)} MB`);
  });

  if (totalBytes < MAX_GET23_CACHE_BYTES) {
    console.log(`Genomic cache limit: ${(MAX_GET23_CACHE_BYTES / 1024 / 1024).toFixed(0)} MB. Current usage: ${(totalBytes / 1024 / 1024).toFixed(2)} MB. No eviction needed.`);
    return;
  }

  const notRequestedEntries = entries
    .filter(entry => !requestedIds.has(entry.id))
    .sort((a, b) => a.createdAt - b.createdAt);

  const requestedEntries = entries
    .filter(entry => requestedIds.has(entry.id))
    .sort((a, b) => a.createdAt - b.createdAt);

  const evictionOrder = [...notRequestedEntries, ...requestedEntries];

  for (const entry of evictionOrder) {
    if (totalBytes < MAX_GET23_CACHE_BYTES) {
      break;
    }
    await localforage.removeItem(entry.key);
    totalBytes -= entry.entryBytes;
  }
  console.log(`Genomic cache size after eviction: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

}

function getByteSize(value) {
  const encoded = JSON.stringify(value) ?? "";
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(encoded).length;
  }
  return encoded.length * 2;
}

function hasSupportedGenomeVersionLabel(value = "") {
  return /(^|[^a-z0-9])v(?:3|4|5)(?=[^a-z0-9]|$)/i.test(String(value));
}

function assertSupportedGenomeVersionLabel(value, sourceType = "file") {
  if (!hasSupportedGenomeVersionLabel(value)) {
    throw new Error(`Unsupported ${sourceType}: must include v3, v4, or v5 in name or href (${value})`);
  }
}


/**
 * Parse a 23andMe genome text file into structured data.
 * @param {string} txt - Raw text content
 * @param {string} url - Source URL/path
 * @returns {Object} Parsed genome data with cols and dt arrays
 */
async function parse23Txt(txt, url) {
  const obj = {};
  const rows = String(txt ?? "").split(/[\r\n]+/g).filter(Boolean);
  obj.txt = txt;
  obj.url = url || "no url";

  const n = rows.filter(r => r && r[0] === '#').length;
  if (n === 0) {
    throw new Error(`Invalid 23andMe file format: missing header in ${url}`);
  }
  const shortUrl = `${String(url || "no url").slice(0, 20)}...`;
  console.log(`parse23Txt in get23Txt(): url ${shortUrl}`);
  obj.filename = url.split('/').pop() || "unknown_filename";
  obj.meta = rows.slice(0, n - 1).join('\r\n');
  obj.cols = rows[n - 1].replace(/^#\s*/, '').split(/\t/);
  obj.dt = rows.slice(n).map((r, i) => {
    const parts = r.split('\t');
    parts[2] = parseInt(parts[2]); // position as integer
    parts[4] = i; // row index
    return parts;
  });
  return obj;
}


/**
 * Load and parse a local 23andMe file.
 * @param {string|File|FileList} path - Path to the file (local .txt or remote PGP URL) or a File/FileList
 * @param {string} [id] - Optional ID for caching (extracted from path if not provided)
 * @param {boolean} [cache=true] - Whether to read/write local cache
 * @param {{ txt?: boolean }} [options] - `txt: true` includes the raw file contents in the return; default omits it.
 * @returns {Promise<{url:string, finalUrl:string, filename:string, meta:string, cols:string[], dt:string[][], txt?:string}>}
 */
async function get23Txt(path, id = null, cache = true, options = {}) {
  const { txt: includeTxt = false } = options;

  // Strips `txt` from the returned object when includeTxt is false and always attaches `finalUrl`.
  function shapeReturn(parsedData, finalUrl) {
    const shaped = { ...parsedData, finalUrl };
    if (!includeTxt) delete shaped.txt;
    return shaped;
  }

  // Caches the parsed data with `txt` and `finalUrl` included so later calls with
  // { txt: true } can still be served from cache. Returns the shaped view for this call.
  async function cacheAndReturn(parsedData, cacheKeyValue, idValue, finalUrl) {
    const enriched = { ...parsedData, finalUrl };
    if (cache) {
      try {
        await localforage.setItem(cacheKeyValue, {
          data: enriched,
          cachedAt: Date.now()
        });
        console.log(`get23Txt(): Successfully cached data for ${cacheKeyValue}`);
        await limitStorage([idValue]);
      } catch (err) {
        console.warn(`get23Txt(): Failed to cache ${cacheKeyValue}:`, err);
      }
    }
    return shapeReturn(enriched, finalUrl);
  }

  // ── File object / FileList branch ───────────────────────────────────────────
  const isFileInstance = typeof File !== "undefined" && path instanceof File;
  const isFileLikeObject = !!path && typeof path === "object" && typeof path.text === "function";
  const isFileListLike = !!path &&
    typeof path === "object" &&
    typeof path.length === "number" &&
    path.length > 0 &&
    typeof path[0] ?.text === "function";

  if (isFileInstance || isFileLikeObject || isFileListLike) {
    const file = isFileListLike ? path[0] : path;
    console.log(`get23Txt(): Detected file input for ${file.name}:`, file);
    //    console.log(`get23Txt(): File object received: ${file.name}`);
    assertSupportedGenomeVersionLabel(file.name, "upload file");

    const fileId = id || file.name;
    const fileCacheKey = GET23_KEY_PREFIX + fileId;

    if (cache) {
      try {
        const cached = await localforage.getItem(fileCacheKey);
        if (cached && cached.data) {
          console.log(`get23Txt(): Cache hit for ${fileCacheKey}`);
          return shapeReturn(cached.data, cached.data.finalUrl || file.name);
        }
      } catch (err) {
        console.warn(`get23Txt(): Cache read failed for ${fileCacheKey}:`, err);
      }
    }

    const txt = await file.text();
    const parsed = await parse23Txt(txt, file.name);
    return cacheAndReturn(parsed, fileCacheKey, fileId, file.name);
  }
  // ── String path / URL branch ─────────────────────────────────────────────────

  if (typeof path !== "string") {
    throw new TypeError("get23Txt expects a path/URL string or a File/FileList object");
  }

  //console.log(`get23Txt(): Loading genomic data from ${path}...`);

  // Extract ID from path if not provided (e.g., from PGP URL)
  if (!id) {
    const idMatch = path.match(/hu[A-Z0-9]+/i) || path.match(/\/([^\/]+)\/?$/);
    id = idMatch ? idMatch[0] : path;
  }

  const cacheKey = GET23_KEY_PREFIX + id;

  // Check localforage for cached data
  if (cache) {
    try {
      const cached = await localforage.getItem(cacheKey);
      if (cached && cached.data) {
        console.log(`get23Txt(): Cache hit for ${cacheKey}`);
        return shapeReturn(cached.data, cached.data.finalUrl || path);
      }
    } catch (err) {
      console.warn(`get23Txt(): Cache read failed for ${cacheKey}:`, err);
    }
  }

  console.log(`get23Txt(): Cache miss for ${cacheKey}, fetching...`);



  const isRemote = /^https?:\/\//.test(path);
  const isTxtFile = path.toLowerCase().endsWith(".txt");
  const isZipLike = path.toLowerCase().includes("pgp-hms.org") || path.toLowerCase().endsWith(".zip");
  path.toLowerCase().includes("pgp-hms.org") ||
    path.toLowerCase().endsWith(".zip");

  // Local or direct .txt files
  if (!isRemote || (isTxtFile && !isZipLike)) {
    if (!isRemote) {
      assertSupportedGenomeVersionLabel(path, "upload file");
    }

    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status}`);
    }

    const txt = await response.text();
    return cacheAndReturn(await parse23Txt(txt, path), cacheKey, id, path);
  }

  // Remote PGP / ZIP URLs
  const WORKER_BASE = "https://lorena-api.lorenasandoval88.workers.dev/?url=";
  const target = path;

  const candidates = [{
      name: "cf-worker",
      url: `${WORKER_BASE}${encodeURIComponent(target)}`
    },
    {
      name: "local-proxy",
      url: "http://localhost:3000/pgp-stats"
    },
    {
      name: "allorigins",
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`
    },
    {
      name: "corsproxy",
      url: `https://corsproxy.io/?${target}`
    },
    {
      name: "github-pages-proxy",
      url: "https://lorenasandoval88.github.io/personal_genomes_project_sdk/pgp-stats"
    }
  ];

  let buffer = null;
  let finalResponse = null;
  let finalUrl = null;
  let successSource = null;
  let lastError = null;

  for (const candidate of candidates) {
    try {
      console.log(`get23Txt(): Trying ${candidate.name}...from url ${candidate.url}`);
      const response = await fetch(candidate.url);

      console.log(
        `get23Txt(): Received response from ${candidate.name}: HTTP ${response.status}`,
        response
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const exposedFinalUrl =
        response.headers.get("x-final-url") ||
        response.headers.get("X-Final-URL") ||
        response.url;

      //   console.log(`content-type from ${candidate.name}: ${contentType}`);
      //  console.log(`finalUrl from ${candidate.name}: ${exposedFinalUrl}`);

      // 👇 get header FIRST
      finalResponse = response;
      finalUrl = exposedFinalUrl;
      console.log(`get23Txt(): Successfully fetched from ${candidate.name}. Final URL: ${finalUrl}, Content-Type: ${contentType}`);
      successSource = candidate.name;
      break;


    } catch (err) {
      console.warn(` ${candidate.name} failed: ${err.message}`);
      lastError = err;
    }
  }

  if (!finalResponse) {
    throw new Error(`All proxy candidates failed for ${path}: ${lastError?.message}`);
  }

  if (!finalUrl) {
    finalUrl = finalResponse.url;
  }

  console.log(`get23Txt(): Success with ${successSource} with final URL: ${finalUrl}`);

  // ------------------------------------------------------------
  // Route by final URL type
  // ------------------------------------------------------------

  // 1) Direct TXT
  if (finalUrl.endsWith(".txt")) {
    assertSupportedGenomeVersionLabel(finalUrl, "href");
    const txt = await finalResponse.text();

    if (!txt || !txt.trim()) {
      throw new Error(`TXT response from ${successSource} is empty`);
    }

    console.log(`get23Txt(): Loaded direct TXT from ${successSource}`);
    return cacheAndReturn(await parse23Txt(txt, finalUrl), cacheKey, id, finalUrl);
  }

  // 2) Direct ZIP
  else if (finalUrl.endsWith(".zip")) {
    const buffer = await finalResponse.arrayBuffer();

    if (!buffer || buffer.byteLength === 0) {
      throw new Error(`ZIP response from ${successSource} is empty`);
    }

    console.log(`get23Txt(): Loaded ZIP buffer from ${successSource}`, buffer);

    const bytes = new Uint8Array(buffer);
    const isZipBuffer = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;

    if (!isZipBuffer) {
      const preview = new TextDecoder("utf-8").decode(bytes.slice(0, 300));
      console.error("get23Txt(): Response is not a ZIP file. Preview:", preview);
      throw new Error(`Response from ${successSource} is not a ZIP archive`);
    }

    console.log(`get23Txt(): About to call JSZip.loadAsync, buffer size: ${buffer.byteLength}`);
    const zip = await JSZip.loadAsync(buffer);

    const zipNames = Object.keys(zip.files);
    console.log("get23Txt(): ZIP entries:", zipNames);

    const targetFile = zipNames
      .map(name => zip.files[name])
      .find(file => !file.dir && file.name.toLowerCase().endsWith(".txt") && hasSupportedGenomeVersionLabel(file.name));

    if (!targetFile) {
      throw new Error(`get23Txt(): No .txt file containing v3, v4, or v5 found inside ZIP from ${path}`);
    }

    console.log(`get23Txt(): Extracting file from ZIP: ${targetFile.name}`);

    const txt = await targetFile.async("string");

    if (!txt || !txt.trim()) {
      throw new Error(`Extracted text file is empty: ${targetFile.name}`);
    }
    return cacheAndReturn(await parse23Txt(txt, targetFile.name), cacheKey, id, finalUrl);
  }

  // 3) Directory listing / collection root
  else if (finalUrl.endsWith("/_/")) {
    const html = await finalResponse.text();
    // console.log(`get23Txt():Directory listing / collection root Loaded directory HTML from ${successSource}`, html.slice(0, 500) + "...");
    if (!html || !html.trim()) {
      throw new Error(`Directory listing from ${successSource} is empty`);
    }

    //console.log(`get23Txt(): Got directory HTML from ${successSource}`);

    // Extract hrefs from HTML listing
    const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map(m => m[1]);
    //console.log("get23Txt(): Directory hrefs:", hrefs);

    // Prefer .zip first, then .txt
    const preferredHref =
      hrefs.find(h => /\.zip$/i.test(h) && hasSupportedGenomeVersionLabel(h)) ||
      hrefs.find(h => /\.txt$/i.test(h) && hasSupportedGenomeVersionLabel(h));

    if (!preferredHref) {
      //const preview = html.slice(0, 500);
      console.error("get23Txt(): No v3/v4/v5 .zip or .txt found in directory listing. Hrefs found:", id, hrefs);
      throw new Error(`No .zip or .txt file containing v3, v4, or v5 found in directory listing for ${path}`);
    }

    const resolvedFileUrl = new URL(preferredHref, finalUrl).href;
    console.log(`get23_loadTxts.js: Resolved file from directory: ${resolvedFileUrl}`);

    const nestedResponse = await fetch(resolvedFileUrl);

    if (!nestedResponse.ok) {
      throw new Error(`Failed to fetch file from directory: HTTP ${nestedResponse.status}`);
    }

    if (resolvedFileUrl.toLowerCase().endsWith(".txt")) {
      assertSupportedGenomeVersionLabel(resolvedFileUrl, "href");
      const txt = await nestedResponse.text();

      if (!txt || !txt.trim()) {
        throw new Error(`Directory TXT file is empty: ${resolvedFileUrl}`);
      }

      return cacheAndReturn(await parse23Txt(txt, resolvedFileUrl), cacheKey, id, resolvedFileUrl);
    }

    if (resolvedFileUrl.toLowerCase().endsWith(".zip")) {
      const buffer = await nestedResponse.arrayBuffer();

      if (!buffer || buffer.byteLength === 0) {
        throw new Error(`Directory ZIP file is empty: ${resolvedFileUrl}`);
      }

      const bytes = new Uint8Array(buffer);
      const isZipBuffer = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;

      if (!isZipBuffer) {
        const preview = new TextDecoder("utf-8").decode(bytes.slice(0, 300));
        console.error("get23_loadTxts.js: Directory file is not a ZIP. Preview:", preview);
        throw new Error(`Directory file is not a ZIP archive: ${resolvedFileUrl}`);
      }

      const zip = await JSZip.loadAsync(buffer);
      const zipNames = Object.keys(zip.files);
      console.log("get23_loadTxts.js: Nested ZIP entries:", zipNames);

      const targetFile = zipNames
        .map(name => zip.files[name])
        .find(file => !file.dir && file.name.toLowerCase().endsWith(".txt") && hasSupportedGenomeVersionLabel(file.name));

      if (!targetFile) {
        throw new Error(`No .txt file containing v3, v4, or v5 found inside nested ZIP: ${resolvedFileUrl}`);
      }
      const txt = await targetFile.async("string");

      if (!txt || !txt.trim()) {
        throw new Error(`Extracted nested ZIP text file is empty: ${targetFile.name}`);
      }
      return cacheAndReturn(await parse23Txt(txt, targetFile.name), cacheKey, id, resolvedFileUrl);
    }
    throw new Error(`Unsupported file type found in directory: ${resolvedFileUrl}`);
  }
  throw new Error(`Unsupported final URL type from ${successSource}: ${finalUrl}`);
}

// Expose for dev console
if (typeof window !== "undefined") {
  window.get23Txt = get23Txt;
  window.parse23Txt = parse23Txt;
  window.limitStorage = limitStorage;
  window.GET23_KEY_PREFIX = GET23_KEY_PREFIX;
}

export {
  JSZip,
  get23Txt,
  parse23Txt,
  limitStorage,
  GET23_KEY_PREFIX
};