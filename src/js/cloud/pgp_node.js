import JSZip from "jszip";

const PGP_BASE_URL = "https://my.pgp-hms.org";

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
  const { acceptJson = false, fetchImpl = fetch } = options;

  const response = await fetchImpl(target, {
    redirect: "follow",
    headers: acceptJson ? { Accept: "application/json" } : undefined
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
        return { value, label: label || value };
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

  const { response, source } = await fetchDirect(pgpUrl);

  const html = await response.text();
  return parseParticipantsFast(html, source);
}

async function fetchProfile(id) {
  const resolvedId = typeof id === "string" && id.trim() ? id.trim() : "hu09B28E";
  const profileUrl = `https://my.pgp-hms.org/profile/${resolvedId}.json`;

  const { response } = await fetchDirect(profileUrl, { acceptJson: true });

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

  const { response: finalResponse, finalUrl, source } = await fetchDirect(path);

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

export {
  JSZip,
  fetchAvailableDataTypes,
  allUsersMetaDataByType_fast,
  fetchProfile,
  load23andMeFile,
  parse23Txt
};
