// This script does 4 main things:
// Fetches PGP 23andMe participant metadata
// const participants = await fetch23andMeParticipants(LIMIT, {
//   batchSize: BATCH_SIZE,
//   peekInsideZip: true
// });
// It saves the raw participant list to:

// participantList/participants_${LIMIT}.json
// Downloads each participant’s file
// For each participant, it checks the file type and only wants TXT/ZIP:
// const allowedExtensions = ["txt", "zip"];
// Then it calls:
// load23andMeFileCloud_unknwn(participant.downloadUrl, participant.id)
// ZIP files should be extracted into TXT by the SDK.

// Scans the downloaded TXT header for genome build
// The SDK loader (load23andMeFileCloud_unknwn) inspects the first 128 KB of the
// TXT it returns and attaches:
//   loaded.genomeBuild              -> "36" | "37" | "38" | null
//   loaded.matchedLineGenomeBuild   -> the header line that produced the match
// Recognized markers: "build 36/37/38", "GRCh36/37/38", "hg18/19/38".
// This worker just copies those fields into the output JSON as:
//   "genomeBuild": "37"
// or:
//   "genomeBuild": null
// Saves the TXT file and updated participant list

// It saves TXT files to:
// geneticFiles/
// and saves updated metadata to:
// updatedParticipantsList/participants_${LIMIT}_with_build.json
// It also saves a run report to:
// runReports/


import { Storage } from "@google-cloud/storage";

import {
  fetch23andMeParticipants,
  load23andMeFileCloud_unknwn
} from "personal_genomes_project_sdk/cloud_sdk.mjs";

const BUCKET_NAME = process.env.BUCKET_NAME || "all23_06252026";
const LIMIT = Number(process.env.LIMIT || 6);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 10);

const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

function getDataToSave(loaded) {
  if (typeof loaded.txt === "string") {
    return loaded.txt;
  }

  if (Buffer.isBuffer(loaded.buffer)) {
    return loaded.buffer;
  }

  if (loaded.buffer instanceof ArrayBuffer) {
    return Buffer.from(loaded.buffer);
  }

  if (ArrayBuffer.isView(loaded.buffer)) {
    return Buffer.from(
      loaded.buffer.buffer,
      loaded.buffer.byteOffset,
      loaded.buffer.byteLength
    );
  }

  return null;
}

function getSizeMB(data) {
  const sizeBytes =
    typeof data === "string"
      ? Buffer.byteLength(data, "utf8")
      : data.length;

  return Number((sizeBytes / 1024 / 1024).toFixed(2));
}

function makeNullBuildParticipant(participant, reason) {
  return {
    ...participant,
    genomeBuild: null,
    genomeBuildFiles: [],
    processingNote: reason
  };
}

function makeSavedFilename(id, filename) {
  if (!filename) return `${id}_unknown.txt`;

  const safeFilename = filename.replace(/[\/\\?%*:|"<>]/g, "_");

  // Prevent huBB5257_huBB5257_20110420205535.txt
  if (safeFilename.toLowerCase().startsWith(`${id.toLowerCase()}_`)) {
    return safeFilename;
  }

  return `${id}_${safeFilename}`;
}

async function main() {
  console.log("Starting unknown-version genetic file import...");
  console.log({
    BUCKET_NAME,
    LIMIT,
    BATCH_SIZE
  });

  const participants = await fetch23andMeParticipants(LIMIT, {
    batchSize: BATCH_SIZE,
    peekInsideZip: true
  });

  console.log(`Participants found: ${participants.length}`);

  const participantOutputPath = `participantList/participants_${LIMIT}.json`;

  await bucket.file(participantOutputPath).save(
    JSON.stringify(participants, null, 2),
    {
      contentType: "application/json"
    }
  );

  console.log(
    `Saved raw participant JSON to gs://${BUCKET_NAME}/${participantOutputPath}`
  );

  let savedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  const updatedParticipants = [];

  for (const participant of participants) {
    try {
      if (!participant?.downloadUrl) {
        skippedCount++;

        console.warn(`Skipping ${participant?.id}: no downloadUrl`);

        updatedParticipants.push(
          makeNullBuildParticipant(participant, "no downloadUrl")
        );

        continue;
      }

      const allowedExtensions = ["txt", "zip"];
      const extension = String(participant.filenameExtension || "").toLowerCase();

      // Skip known non-TXT/ZIP files, but allow unknown/null URLs to be inspected.
      if (extension && !allowedExtensions.includes(extension)) {
        skippedCount++;

        console.warn(
          `Skipping ${participant.id}: unsupported filenameExtension=${participant.filenameExtension}`
        );

        updatedParticipants.push(
          makeNullBuildParticipant(
            participant,
            `unsupported filenameExtension=${participant.filenameExtension}`
          )
        );

        continue;
      }

      console.log(`Processing ${participant.id}`);
      console.log(`Download URL: ${participant.downloadUrl}`);
      console.log(`File extension from metadata: ${participant.filenameExtension}`);

      const loaded = await load23andMeFileCloud_unknwn(
        participant.downloadUrl,
        participant.id
      );

      const loadedExtension = String(loaded.filenameExtension || "").toLowerCase();

      // ZIP files should be extracted to TXT by the loader.
      // Therefore, the final loaded file should be txt.
      if (loadedExtension !== "txt") {
        skippedCount++;

        console.warn(
          `Skipping ${participant.id}: downloaded unsupported file=${loaded.filename}, extension=${loaded.filenameExtension}`
        );

        updatedParticipants.push(
          makeNullBuildParticipant(
            participant,
            `downloaded unsupported file=${loaded.filename}, extension=${loaded.filenameExtension}`
          )
        );

        continue;
      }

      const dataToSave = getDataToSave(loaded);

      if (!dataToSave) {
        throw new Error("Downloaded TXT is empty or unsupported");
      }

      if (typeof dataToSave === "string" && !dataToSave.trim()) {
        throw new Error("Downloaded TXT is empty");
      }

      if (Buffer.isBuffer(dataToSave) && dataToSave.length === 0) {
        throw new Error("Downloaded TXT buffer is empty");
      }

   

      // For ZIP sources, loaded.filename is the inner .txt (set by extractTxtFromZipResponse),
      // so this saves the extracted .txt under <id>_<innerFilename>.
      const savedFilename = makeSavedFilename(
        participant.id,
        loaded.filename || participant.innerFilename || participant.filename
      );

      const outputPath = `geneticFiles/${savedFilename}`;

      await bucket.file(outputPath).save(dataToSave, {
        contentType: "text/plain"
      });

      const sizeMB = getSizeMB(dataToSave);

      updatedParticipants.push({
        ...participant,
        genomeBuild: loaded.genomeBuild,
        genomeBuildFiles: [
        {
          downloadUrl: participant.downloadUrl || null,
          filename: loaded.filename || participant.innerFilename || participant.filename || null,

          // saved file in your bucket
          gcsPath: outputPath,
          gcsfilename: savedFilename,

          sizeMB,
          matchedLine: loaded.matchedLineGenomeBuild
        }
      ]
      });

      savedCount++;

      console.log(`Saved ${savedCount}: gs://${BUCKET_NAME}/${outputPath}`);
      console.log({
        id: participant.id,
        genomeBuild: loaded.genomeBuild,
        matchedLine: loaded.matchedLineGenomeBuild
      });
    } catch (err) {
      failedCount++;

      console.error(`FAILED ${participant?.id}: ${err.message}`);

      updatedParticipants.push({
        ...participant,
        genomeBuild: null,
        genomeBuildFiles: [],
        processingNote: `FAILED: ${err.message}`
      });
    }
  }

  const updatedParticipantOutputPath =
    `updatedParticipantsList/participants_${LIMIT}_with_build.json`;

  await bucket.file(updatedParticipantOutputPath).save(
    JSON.stringify(updatedParticipants, null, 2),
    {
      contentType: "application/json"
    }
  );

  console.log(
    `Saved updated participant JSON to gs://${BUCKET_NAME}/${updatedParticipantOutputPath}`
  );

  const reportOutputPath = `runReports/import_report_${LIMIT}_${Date.now()}.json`;

  const report = {
    requested: LIMIT,
    found: participants.length,
    saved: savedCount,
    failed: failedCount,
    skipped: skippedCount,
    rawParticipantJson: participantOutputPath,
    updatedParticipantJson: updatedParticipantOutputPath
  };

  await bucket.file(reportOutputPath).save(
    JSON.stringify(report, null, 2),
    {
      contentType: "application/json"
    }
  );

  console.log(`Saved report to gs://${BUCKET_NAME}/${reportOutputPath}`);

  console.log("Import complete.");
  console.log(report);
}

main().catch(err => {
  console.error("FATAL ERROR:");
  console.error(err);
  process.exit(1);
});