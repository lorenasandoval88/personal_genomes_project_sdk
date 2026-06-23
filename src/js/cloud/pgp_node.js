import JSZip from "jszip";

const PGP_BASE_URL = "https://my.pgp-hms.org";
const PGP_23ANDME_URL = `${PGP_BASE_URL}/public_genetic_data?utf8=%E2%9C%93&data_type=23andMe&commit=Search`;

function hasSupportedGenomeVersionLabel(value = "") {
  return /(^|[^a-z0-9])v(?:3|4|5)(?=[^a-z0-9]|$)/i.test(String(value));
}

function assertSupportedGenomeVersionLabel(value, sourceType = "file") {
  if (!hasSupportedGenomeVersionLabel(value)) {
    throw new Error(`Unsupported ${sourceType}: must include v3, v4, or v5 in name or href (${value})`);
  }
}

function decodeHtmlEntities(text = "") {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function stripTags(html = "") {
  return decodeHtmlEntities(String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeDataTypeValue(label) {
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

  return label
    .replace(/^genetic data - /i, "")
    .replace(/^biometric data - /i, "")
    .replace(/^health records - /i, "")
    .replace(/^image - /i, "")
    .trim();
}

function dedupeByValue(items) {
  const seen = new Map();
  for (const item of items) {
    if (item?.value && !seen.has(item.value)) {
      seen.set(item.value, item);
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

async function fetchDirect(target, options = {}) {
  const {
    acceptJson = false, fetchImpl = fetch
  } = options;

  const response = await fetchImpl(target, {
    redirect: "follow",
    headers: acceptJson ? {
      Accept: "application/json"
    } : undefined
  });

  if (!response.ok) {
    throw new Error(`Direct fetch failed for ${target}: HTTP ${response.status}`);
  }

  return {
    response,
    finalUrl: response.url || target,
    source: "direct"
  };
}

function parseParticipantsFast(html, source = "unknown") {
  const rows = String(html).match(/<tr[^>]*data-file-row[^>]*>[\s\S]*?<\/tr>/gi) ||
    String(html).match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  const participants = [];

  for (const rowHtml of rows) {
    const cells = rowHtml.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
    if (cells.length < 7) continue;

    const participantLinkMatch = cells[1].match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!participantLinkMatch) continue;

    const id = stripTags(participantLinkMatch[2]);
    if (!id) continue;

    const dataType = stripTags(cells[3]);
    if (!/23andme/i.test(dataType)) continue;

    const downloadLinkMatch = cells[6].match(/<a[^>]*href=["']([^"']+)["']/i);
    const relativeDownload = downloadLinkMatch?.[1] || null;
    const downloadUrl = relativeDownload ? new URL(relativeDownload, PGP_BASE_URL).href : null;

    participants.push({
      id,
      participant: id,
      published: stripTags(cells[2]),
      dataType,
      dataSource: source,
      name: stripTags(cells[5]) || null,
      fileName: stripTags(cells[5]) || null,
      fileExtension: null,
      finalUrl: null,
      downloadUrl
    });
  }

  return participants;
}

async function fetchAvailableDataTypes({
  base_url = `${PGP_BASE_URL}/public_genetic_data`,
  url = base_url,
  fetchImpl = fetch
} = {}) {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch PGP data types: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const selectOptions = [...html.matchAll(/<select[^>]*name=["']data_type["'][^>]*>[\s\S]*?<\/select>/gi)]
    .flatMap(match => [...match[0].matchAll(/<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi)])
    .map(match => ({
      value: decodeHtmlEntities((match[1] || "").trim()),
      label: stripTags(match[2])
    }))
    .filter(item => item.value && item.label);

  if (selectOptions.length) {
    return dedupeByValue(selectOptions);
  }

  const linkOptions = [...html.matchAll(/<a[^>]*href=["']([^"']*data_type=[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => {
      try {
        const full = new URL(decodeHtmlEntities(match[1]), url);
        const value = (full.searchParams.get("data_type") || "").trim();
        const label = stripTags(match[2]);
        return {
          value,
          label: label || value
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter(item => item.value);

  if (linkOptions.length) {
    return dedupeByValue(linkOptions);
  }

  const text = stripTags(html);
  const start = text.indexOf("All data types");
  const end = text.indexOf("Participant Published Data type Source Name Download Report");

  if (start !== -1 && end !== -1 && end > start) {
    const block = text
      .slice(start + "All data types".length, end)
      .replace(/\s+/g, " ")
      .trim();

    return splitDatatypeBlock(block).map(label => ({
      label,
      value: normalizeDataTypeValue(label)
    }));
  }

  return [];
}

async function allUsersMetaDataByType_fast(dataType = "23andMe") {
  const pgpUrl = `${PGP_BASE_URL}/public_genetic_data?utf8=%E2%9C%93&data_type=${encodeURIComponent(dataType)}&commit=Search`;

  const {
    response,
    source
  } = await fetchDirect(pgpUrl);

  const html = await response.text();
  return parseParticipantsFast(html, source);
}

async function fetchProfile(id) {
  const resolvedId = typeof id === "string" && id.trim() ? id.trim() : "hu09B28E";
  const profileUrl = `https://my.pgp-hms.org/profile/${resolvedId}.json`;

  const {
    response
  } = await fetchDirect(profileUrl, {
    acceptJson: true
  });

  return response.json();
}

async function parse23Txt(txt, url) {
  const obj = {};
  const rows = String(txt ?? "").split(/[\r\n]+/g).filter(Boolean);
  obj.txt = txt;
  obj.url = url || "no url";

  const n = rows.filter(row => row && row[0] === "#").length;
  if (n === 0) {
    throw new Error(`Invalid 23andMe file format: missing header in ${url}`);
  }

  obj.filename = String(url || "").split("/").pop() || "unknown_filename";
  obj.meta = rows.slice(0, n - 1).join("\r\n");
  obj.cols = rows[n - 1].replace(/^#\s*/, "").split(/\t/);
  obj.dt = rows.slice(n).map((row, index) => {
    const parts = row.split("\t");
    parts[2] = parseInt(parts[2], 10);
    parts[4] = index;
    return parts;
  });

  return obj;
}
//fetches and parses a 23andMe genome file from a URL or local path. It handles four cases:

// Local or plain .txt URL — fetches directly, validates the genome version label (v3/v4/v5), parses via parse23Txt
// Remote .txt — same as above but after a redirected fetch
// Remote .zip — downloads, validates ZIP magic bytes, finds the versioned .txt inside, extracts and parses it
// Directory listing (/_/) — fetches the HTML listing, finds a versioned .zip or .txt link, then falls into case 2 or 3
// All paths return the result of parse23Txt, which produces { txt, url, filename, meta, cols, dt }.

async function load23andMeFile(path, id = null) {
  if (typeof path !== "string") {
    throw new TypeError("load23andMeFile expects a URL/path string in the Node-safe SDK");
  }

  if (!id) {
    const idMatch = path.match(/hu[A-Z0-9]+/i) || path.match(/\/([^\/]+)\/?$/);
    id = idMatch ? idMatch[0] : path;
  }

  const isRemote = /^https?:\/\//.test(path);
  const isTxtFile = path.toLowerCase().endsWith(".txt");
  const isZipLike = path.toLowerCase().includes("pgp-hms.org") || path.toLowerCase().endsWith(".zip");

  if (!isRemote || (isTxtFile && !isZipLike)) {
    if (!isRemote) {
      assertSupportedGenomeVersionLabel(path, "upload file");
    }

    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status}`);
    }

    const txt = await response.text();
    return parse23Txt(txt, path);
  }

  const {
    response: finalResponse,
    finalUrl,
    source
  } = await fetchDirect(path);

  if (finalUrl.endsWith(".txt")) {
    assertSupportedGenomeVersionLabel(finalUrl, "href");
    const txt = await finalResponse.text();
    if (!txt || !txt.trim()) {
      throw new Error(`TXT response from ${source} is empty`);
    }
    return parse23Txt(txt, finalUrl);
  }

  if (finalUrl.endsWith(".zip")) {
    const buffer = await finalResponse.arrayBuffer();
    if (!buffer || buffer.byteLength === 0) {
      throw new Error(`ZIP response from ${source} is empty`);
    }

    const bytes = new Uint8Array(buffer);
    const isZipBuffer = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (!isZipBuffer) {
      throw new Error(`Response from ${source} is not a ZIP archive`);
    }

    const zip = await JSZip.loadAsync(buffer);
    const zipNames = Object.keys(zip.files);
    const targetFile = zipNames
      .map(name => zip.files[name])
      .find(file => !file.dir && file.name.toLowerCase().endsWith(".txt") && hasSupportedGenomeVersionLabel(file.name));

    if (!targetFile) {
      throw new Error(`No .txt file containing v3, v4, or v5 found inside ZIP from ${path}`);
    }

    const txt = await targetFile.async("string");
    if (!txt || !txt.trim()) {
      throw new Error(`Extracted text file is empty: ${targetFile.name}`);
    }
    return parse23Txt(txt, targetFile.name);
  }

  if (finalUrl.endsWith("/_/")) {
    const html = await finalResponse.text();
    if (!html || !html.trim()) {
      throw new Error(`Directory listing from ${source} is empty`);
    }

    const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map(match => match[1]);
    const preferredHref =
      hrefs.find(href => /\.zip$/i.test(href) && hasSupportedGenomeVersionLabel(href)) ||
      hrefs.find(href => /\.txt$/i.test(href) && hasSupportedGenomeVersionLabel(href));

    if (!preferredHref) {
      throw new Error(`No .zip or .txt file containing v3, v4, or v5 found in directory listing for ${path}`);
    }

    const resolvedFileUrl = new URL(preferredHref, finalUrl).href;
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
      return parse23Txt(txt, resolvedFileUrl);
    }

    if (resolvedFileUrl.toLowerCase().endsWith(".zip")) {
      const nestedBuffer = await nestedResponse.arrayBuffer();
      if (!nestedBuffer || nestedBuffer.byteLength === 0) {
        throw new Error(`Directory ZIP file is empty: ${resolvedFileUrl}`);
      }

      const nestedBytes = new Uint8Array(nestedBuffer);
      const isZipBuffer = nestedBytes.length >= 2 && nestedBytes[0] === 0x50 && nestedBytes[1] === 0x4b;
      if (!isZipBuffer) {
        throw new Error(`Directory file is not a ZIP archive: ${resolvedFileUrl}`);
      }

      const zip = await JSZip.loadAsync(nestedBuffer);
      const zipNames = Object.keys(zip.files);
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
      return parse23Txt(txt, targetFile.name);
    }

    throw new Error(`Unsupported file type found in directory: ${resolvedFileUrl}`);
  }

  throw new Error(`Unsupported final URL type from ${source}: ${finalUrl}`);
}




//NEW CODE 06/17 ---------------------------------------/////////////////////////////////////////////////////////////

//fetch23andMeParticipants() gets the PGP page, 
// parseParticipantsCloud() extracts rows, 
// resolveDownloadFilenameCloud() follows redirects to get the real URL/filename, and 
// load23andMeFileCloud() downloads the actual 23andMe text from direct .txt, .zip, or /_/ directory links.

// PGP 23andMe HTML page → participant list. Uses parseParticipants() and resolveDownloadFilename() to get actual filenames, limit - Number of participants to return (default: 10)

async function fetch23andMeParticipants(limit = 10, options = {}) {

   const { batchSize = 10, peekInsideZip = false } = options;

// batchSize is only used for a progress console.log. So passing batchSize: 10 does not parallelize HEAD requests — it just controls log frequency.
// If you want real batching, parse all rows first, then run HEAD requests with Promise.all over chunks of batchSize.
// peekInsideZip: when true, ZIP entries also fetch and unzip the file to record the inner txt filename as innerFileName. Slow (downloads each zip), so default off.
  const response = await fetch(PGP_23ANDME_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch PGP 23andMe page: HTTP ${response.status}`);
  }
  const html = await response.text();
  const participants = await parseParticipantsCloud(html, limit, { batchSize, peekInsideZip });
  return participants;
}



//Parse HTML to extract participant data - used in fetch23andMeParticipants()
async function parseParticipantsCloud(html, limit = 10, options = {}) {

  const { batchSize = 10, peekInsideZip = false } = options;
  const participants = [];

  // Match table rows
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];


  // Only keep rows that look like real file rows
  for (const rowHtml of rowMatches) {
    if (participants.length >= limit) break;
    if (!rowHtml.includes("user_file") && !rowHtml.includes("profile")) continue;

    // Extract table cells
    const cells = [...rowHtml.matchAll(/<td[\s\S]*?<\/td>/gi)].map(m => m[0]);

    if (cells.length < 7) continue;

    // Participant link is usually in cells[1]
    const participantHrefMatch = cells[1].match(/href="([^"]+)"/i);
    const participantTextMatch = cells[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    if (!participantHrefMatch || !participantTextMatch) continue;

    const dataType = stripTags(cells[3]);
    if (!/23andme/i.test(dataType)) continue;

    const id = stripTags(participantTextMatch[1]);
    const profileUrl = new URL(decodeHtmlEntities(participantHrefMatch[1]), PGP_BASE_URL).href;

    // Download link is usually in cells[6]
    const downloadHrefMatch = cells[6].match(/href=["']([^"']+)["']/i);
    const downloadUrl = downloadHrefMatch
      ? new URL(decodeHtmlEntities(downloadHrefMatch[1]), PGP_BASE_URL).href
      : null;

    const publishedDate = stripTags(cells[2]);
    const name = stripTags(cells[5]);

    // Resolve actual file URL and filename
    let resolved = { finalUrl: null, fileName: null, fileExtension: null };
      try {
        resolved = await resolveDownloadFilenameCloud(downloadUrl);
      } catch (err) {
        console.warn(`parseParticipantsCloud: resolve failed for ${id}: ${err.message}`);
      }

    // Opt-in: for ZIPs, download and unzip to find the inner .txt filename.
    let innerFileName = null;
    if (peekInsideZip && resolved.fileExtension === "zip") {
      const zipUrl = resolved.finalUrl || downloadUrl;
      try {
        innerFileName = await getInnerTxtNameFromZipUrl(zipUrl);
      } catch (err) {
        console.warn(`parseParticipantsCloud: zip peek failed for ${id}: ${err.message}`);
      }
    }

    participants.push({
      id,
      profileUrl,
      publishedDate,
      dataType,
      name,
      downloadUrl,
      finalUrl: resolved.finalUrl,
      fileName: resolved.fileName,
      fileExtension: resolved.fileExtension,
      innerFileName
    });

    if (participants.length % batchSize === 0) {
      console.log(`parseParticipantsCloud: parsed ${participants.length}/${limit}`);
    }
  }

  return participants;
}


//follows redirects to get the real URL/filename - used in parseParticipantsCloud() 
//participant row → metadata + downloadUrl + finalUrl + fileName
async function resolveDownloadFilenameCloud(downloadUrl) {
  if (!downloadUrl) {
    return {
      finalUrl: null,
      fileName: null,
      fileExtension: null
    };
  }

  const extPattern = /(?:_|\.)(vcf\.txt)$|\.(vcf\.gz|vcf|txt|zip)$/i;
  const parseExt = (name) => {
    const m = name?.match(extPattern);
    return m?.slice(1).find(Boolean)?.toLowerCase() || null;
  };

  // HEAD avoids downloading the (potentially large) file body just to read redirects.
  let response = await fetch(downloadUrl, {
    method: "HEAD",
    redirect: "follow"
  });

  if (!response.ok) {
    console.warn(`resolveDownloadFilenameCloud: HTTP ${response.status} for ${downloadUrl}`);
    return {
      finalUrl: null,
      fileName: null,
      fileExtension: null
    };
  }

  let finalUrl = response.url || downloadUrl;
  let cleanUrl = finalUrl.split("?")[0];

  // Prefer Content-Disposition filename over the URL's last segment, because some PGP
  // endpoints (e.g. /user_file/download/N) serve the file directly without redirecting
  // and the URL contains only a numeric id.
  let dispositionName = getFilenameFromContentDisposition(response.headers.get("content-disposition"));
  let fileName = dispositionName || (cleanUrl.split("/").pop() || null);
  let fileExtension = parseExt(fileName);

  // Fallback: some servers don't redirect or send Content-Disposition on HEAD.
  // If we still don't know the file type and we're not at a directory listing, retry with GET
  // and cancel the body so we never download the file itself.
  if (!fileExtension && !finalUrl.endsWith("/_/")) {
    try {
      const getResp = await fetch(downloadUrl, {
        method: "GET",
        redirect: "follow"
      });
      if (getResp.body && typeof getResp.body.cancel === "function") {
        getResp.body.cancel().catch(() => {});
      }
      if (getResp.ok) {
        response = getResp;
        finalUrl = getResp.url || finalUrl;
        cleanUrl = finalUrl.split("?")[0];
        dispositionName = getFilenameFromContentDisposition(getResp.headers.get("content-disposition")) || dispositionName;
        fileName = dispositionName || (cleanUrl.split("/").pop() || fileName);
        fileExtension = parseExt(fileName);
      }
    } catch (err) {
      console.warn(`resolveDownloadFilenameCloud: GET fallback failed for ${downloadUrl}: ${err.message}`);
    }
  }

  // If final URL is a directory listing like /_/, we need the HTML body, so do a GET now.
  if (finalUrl.endsWith("/_/")) {
    response = await fetch(finalUrl, {
      redirect: "follow"
    });
    if (!response.ok) {
      console.warn(`resolveDownloadFilenameCloud: directory GET HTTP ${response.status} for ${finalUrl}`);
      return {
        finalUrl,
        fileName: null,
        fileExtension: null
      };
    }
    const html = await response.text();

    const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map(m => m[1]);

    const preferredHref =
      hrefs.find(h => /\.txt$/i.test(h) && hasSupportedGenomeVersionLabel(h)) ||
      hrefs.find(h => /\.zip$/i.test(h) && hasSupportedGenomeVersionLabel(h)) ||
      hrefs.find(h => /\.vcf\.gz$/i.test(h)) ||
      hrefs.find(h => /\.vcf$/i.test(h)) ||
      hrefs.find(h => /(?:_vcf|\.vcf)\.txt$/i.test(h)) ||
      hrefs.find(h => /\.txt$/i.test(h)) ||
      hrefs.find(h => /\.zip$/i.test(h));

    if (!preferredHref) {
      return {
        finalUrl,
        fileName: null,
        fileExtension: null
      };
    }

    const resolvedFileUrl = new URL(preferredHref, finalUrl).href;
    const resolvedFileName = resolvedFileUrl.split("?")[0].split("/").pop();

    const resolvedMatch = resolvedFileName?.match(/(?:_|\.)(vcf\.txt)$|\.(vcf\.gz|vcf|txt|zip)$/i);
    const resolvedExtension =  resolvedMatch?.slice(1).find(Boolean)?.toLowerCase() || null;
  
    return {
      finalUrl: resolvedFileUrl,
      fileName: resolvedFileName,
      fileExtension: resolvedExtension
    };
  }

  return {
    finalUrl,
    fileName,
    fileExtension
  };
}


// Downloads a ZIP from zipUrl, opens it with JSZip, and returns the inner .txt entry's filename
// (last path segment). Used by parseParticipantsCloud when peekInsideZip is true.
async function getInnerTxtNameFromZipUrl(zipUrl) {
  if (!zipUrl) throw new Error("getInnerTxtNameFromZipUrl: missing zipUrl");

  const response = await fetch(zipUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${zipUrl}`);
  }

  const buffer = await response.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) {
    throw new Error(`empty body from ${zipUrl}`);
  }

  const bytes = new Uint8Array(buffer);
  const isZipBuffer = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZipBuffer) {
    const ct = response.headers.get("content-type") || "unknown";
    throw new Error(`not a ZIP (content-type=${ct}, bytes=${buffer.byteLength}) from ${zipUrl}`);
  }

  const zip = await JSZip.loadAsync(buffer);
  const entry = Object.keys(zip.files)
    .map(name => zip.files[name])
    .find(file => !file.dir && file.name.toLowerCase().endsWith(".txt"));

  if (!entry) {
    throw new Error(`no .txt entry inside ZIP at ${zipUrl}`);
  }

  return entry.name.split("/").pop();
}


// This is the main txt downloader
//downloads the actual 23andMe text from direct .txt, .zip, or /_/ directory
// a v3/v4/v5 genome-version label in the filename or zip entry.
// One warning
// This function will accept any .txt, not just confirmed 23andMe genotype TXT.
async function load23andMeFileCloud_unknwn(path, id = null) {
  if (typeof path !== "string") {
    throw new TypeError("load23andMeFileCloud_unknwn expects a URL string");
  }

  if (!/^https?:\/\//i.test(path)) {
    throw new Error(`Cloud version expects a remote URL, got: ${path}`);
  }

  if (!id) {
    const idMatch = path.match(/hu[A-Z0-9]+/i);
    id = idMatch ? idMatch[0] : null;
  }

  const {
    response: finalResponse,
    finalUrl,
    source
  } = await fetchDirect(path);

  if (!finalResponse.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${finalResponse.status}`);
  }

  const lowerFinalUrl = finalUrl.toLowerCase().split("?")[0];

  // Case 1: direct TXT (no version check)
  if (lowerFinalUrl.endsWith(".txt")) {
    const txt = await finalResponse.text();

    if (!txt || !txt.trim()) {
      throw new Error(`TXT response from ${source} is empty`);
    }

    return {
      id,
      txt,
      url: finalUrl,
      filename: getFilenameFromUrl(finalUrl),
      fileExtension: "txt",
      innerFileName: null
    };
  }

  // Case 2: direct ZIP (no version check on entries)
  if (lowerFinalUrl.endsWith(".zip")) {
    return await extractTxtFromZipResponse(
      finalResponse,
      finalUrl,
      source,
      id, {
        requireVersionLabel: false
      }
    );
  }

  // Case 3: directory listing /_/ — pick first .txt or .zip (no version filter)
  if (lowerFinalUrl.endsWith("/_/")) {
    const html = await finalResponse.text();

    if (!html || !html.trim()) {
      throw new Error(`Directory listing from ${source} is empty`);
    }

    const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map(match => match[1]);

    const preferredHref =
      hrefs.find(href => /\.vcf\.gz$/i.test(href)) ||
      hrefs.find(href => /\.vcf$/i.test(href)) ||
      hrefs.find(href => /(?:_vcf|\.vcf)\.txt$/i.test(href)) ||
      hrefs.find(href => /\.txt$/i.test(href)) ||
      hrefs.find(href => /\.zip$/i.test(href));

    if (!preferredHref) {
      throw new Error(`No .txt or .zip file found in directory listing for ${path}`);
    }

    const resolvedFileUrl = new URL(preferredHref, finalUrl).href;
    const nestedResponse = await fetch(resolvedFileUrl, {
      redirect: "follow"
    });

    if (!nestedResponse.ok) {
      throw new Error(`Failed to fetch file from directory: HTTP ${nestedResponse.status}`);
    }

    const lowerResolvedUrl = resolvedFileUrl.toLowerCase().split("?")[0];


    // VCF.GZ file: save as binary gzip
if (lowerResolvedUrl.endsWith(".vcf.gz")) {
  const buffer = Buffer.from(await nestedResponse.arrayBuffer());

  if (!buffer || buffer.length === 0) {
    throw new Error(`Directory VCF.GZ file is empty: ${resolvedFileUrl}`);
  }

  return {
    id,
    buffer,
    url: resolvedFileUrl,
    filename: getFilenameFromUrl(resolvedFileUrl),
    fileExtension: "vcf.gz",
    innerFileName: null
  };
}

// VCF file: save as text
if (lowerResolvedUrl.endsWith(".vcf")) {
  const txt = await nestedResponse.text();

  if (!txt || !txt.trim()) {
    throw new Error(`Directory VCF file is empty: ${resolvedFileUrl}`);
  }

  return {
    id,
    txt,
    url: resolvedFileUrl,
    filename: getFilenameFromUrl(resolvedFileUrl),
    fileExtension: "vcf",
    innerFileName: null
  };
}

// VCF stored as .txt, for example *_vcf.txt
if (lowerResolvedUrl.endsWith("_vcf.txt") || lowerResolvedUrl.endsWith(".vcf.txt")) {
  const txt = await nestedResponse.text();

  if (!txt || !txt.trim()) {
    throw new Error(`Directory VCF TXT file is empty: ${resolvedFileUrl}`);
  }

  const originalName = getFilenameFromUrl(resolvedFileUrl);
  const vcfName = originalName.replace(/(?:_vcf|\.vcf)\.txt$/i, ".vcf");

  return {
    id,
    txt,
    url: resolvedFileUrl,
    filename: vcfName,
    fileExtension: "vcf.txt",
    innerFileName: null
  };
}

    if (lowerResolvedUrl.endsWith(".txt")) {
      const txt = await nestedResponse.text();

      if (!txt || !txt.trim()) {
        throw new Error(`Directory TXT file is empty: ${resolvedFileUrl}`);
      }

      return {
        id,
        txt,
        url: resolvedFileUrl,
        filename: getFilenameFromUrl(resolvedFileUrl),
        fileExtension: "txt",
        innerFileName: null
      };
    }

    if (lowerResolvedUrl.endsWith(".zip")) {
      return await extractTxtFromZipResponse(
        nestedResponse,
        resolvedFileUrl,
        "directory",
        id, {
          requireVersionLabel: false
        }
      );
    }

    throw new Error(`Unsupported file type found in directory: ${resolvedFileUrl}`);
  }

  // Case 4: URL has no .txt / .zip / /_/ suffix (e.g. /user_file/download/N).
  // Sniff Content-Disposition, Content-Type and body magic bytes to decide.
  return await extractFromUnknownResponse(finalResponse, finalUrl, source, id, {
    requireVersionLabel: false
  });
}

// Extracts the filename from a URL, ignoring query parameters
function getFilenameFromUrl(url) {
  return url.split("?")[0].split("/").pop() || "unknown_23andme.txt";
}

// Pulls a filename out of a Content-Disposition header, if present.
function getFilenameFromContentDisposition(header) {
  if (!header) return null;
  const starMatch = header.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i);
  if (starMatch) {
    try {
      return decodeURIComponent(starMatch[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* fall through */ }
  }
  const plainMatch = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  return plainMatch ? plainMatch[1].trim() : null;
}

// Handles responses where the URL extension is unknown (e.g. /user_file/download/N).
// Decides between ZIP and plain TXT using headers + ZIP magic bytes.
async function extractFromUnknownResponse(response, finalUrl, source, id = null, options = {}) {
  const {
    requireVersionLabel = true
  } = options;

  const dispositionName = getFilenameFromContentDisposition(response.headers.get("content-disposition"));
  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  const buffer = await response.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) {
    throw new Error(`Response from ${source} is empty`);
  }

  const bytes = new Uint8Array(buffer);
  const isZipBuffer = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;

  const looksZip =
    isZipBuffer ||
    contentType.includes("zip") ||
    (dispositionName && /\.zip$/i.test(dispositionName));

  if (looksZip) {
    // Re-wrap the already-read buffer as a Response so extractTxtFromZipResponse can consume it.
    const zipResponse = new Response(buffer);
    const zipUrl = dispositionName ?
      new URL(dispositionName, finalUrl).href :
      finalUrl;
    return await extractTxtFromZipResponse(zipResponse, zipUrl, source, id, {
      requireVersionLabel
    });
  }

  // Treat as plain text.
  const txt = new TextDecoder("utf-8").decode(buffer);
  if (!txt || !txt.trim()) {
    throw new Error(`TXT response from ${source} is empty`);
  }

  const filename = dispositionName || getFilenameFromUrl(finalUrl);
  if (requireVersionLabel) {
    assertSupportedGenomeVersionLabel(filename, "filename");
  }

  return {
    id,
    txt,
    url: finalUrl,
    filename,
    fileExtension: "txt",
    innerFileName: null
  };
}

// Extracts a .txt file from a ZIP response. By default requires the entry's name
// to include a supported genome version label (v3/v4/v5); pass
// { requireVersionLabel: false } to accept any .txt entry.
async function extractTxtFromZipResponse(response, zipUrl, source, id = null, options = {}) {
  const {
    requireVersionLabel = true
  } = options;
  const buffer = await response.arrayBuffer();

  if (!buffer || buffer.byteLength === 0) {
    throw new Error(`ZIP response from ${source} is empty`);
  }

  const bytes = new Uint8Array(buffer);
  const isZipBuffer =
    bytes.length >= 2 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b;

  if (!isZipBuffer) {
    throw new Error(`Response from ${source} is not a ZIP archive`);
  }

  const zip = await JSZip.loadAsync(buffer);

  const targetFile = Object.keys(zip.files)
    .map(name => zip.files[name])
    .find(file =>
      !file.dir &&
      file.name.toLowerCase().endsWith(".txt") &&
      (!requireVersionLabel || hasSupportedGenomeVersionLabel(file.name))
    );

  if (!targetFile) {
    throw new Error(
      requireVersionLabel ?
      `No .txt file containing v3, v4, or v5 found inside ZIP from ${zipUrl}` :
      `No .txt file found inside ZIP from ${zipUrl}`
    );
  }

  const txt = await targetFile.async("string");

  if (!txt || !txt.trim()) {
    throw new Error(`Extracted text file is empty: ${targetFile.name}`);
  }

  return {
    id,
    txt,
    url: zipUrl,
    filename: targetFile.name.split("/").pop(),
    fileExtension: "txt",
    sourceZip: getFilenameFromUrl(zipUrl),
    innerFileName: targetFile.name.split("/").pop()
  };
}

export {
  JSZip,
  fetchAvailableDataTypes,
  allUsersMetaDataByType_fast,
  fetchProfile,
  load23andMeFile,
  parse23Txt,
  fetch23andMeParticipants,
  parseParticipantsCloud,
  resolveDownloadFilenameCloud,
  getInnerTxtNameFromZipUrl,
  load23andMeFileCloud_unknwn
};
