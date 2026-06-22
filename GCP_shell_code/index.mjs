import { Storage } from "@google-cloud/storage";

import {
  fetch23andMeParticipants,
  load23andMeFileCloud_unknwn
} from "personal_genomes_project_sdk/cloud_sdk.mjs";

const BUCKET_NAME = process.env.BUCKET_NAME || "all23_files";
const LIMIT = Number(process.env.LIMIT || 6); // change to 1100 later
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 10);

const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

async function main() {
  console.log("Starting unknown-version genetic file import...");
  console.log({ BUCKET_NAME, LIMIT, BATCH_SIZE });

  const participants = await fetch23andMeParticipants(LIMIT, {
    batchSize: BATCH_SIZE
  });

  console.log(`Participants found: ${participants.length}`);

  // Save participant metadata JSON first
  const participantOutputPath = `pgp/participants/fetch23andMeParticipants_${LIMIT}.json`;

  await bucket.file(participantOutputPath).save(
    JSON.stringify(participants, null, 2),
    {
      contentType: "application/json"
    }
  );

  console.log(`Saved participant JSON to gs://${BUCKET_NAME}/${participantOutputPath}`);

  let savedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const participant of participants) {
    try {
      if (!participant?.downloadUrl) {
        skippedCount++;
        console.warn(`Skipping ${participant?.id}: no downloadUrl`);
        continue;
      }


    const allowedExtensions = ["txt", "zip"];

    //toLowerCase() protects you if the extension comes back as "TXT" or "ZIP".
   if (!allowedExtensions.includes(String(participant.fileExtension).toLowerCase())) {
        skippedCount++;
        console.warn(
          `Skipping ${participant.id}: unsupported fileExtension=${participant.fileExtension}`
        );
        continue;
      }


      console.log(`Processing ${participant.id}`);
      console.log(`Download URL: ${participant.downloadUrl}`);
      console.log(`File extension: ${participant.fileExtension}`);

      const loaded = await load23andMeFileCloud_unknwn(
        participant.downloadUrl,
        participant.id
      );

      console.log(loaded);

    //   Because loaded.buffer is for binary files like .vcf.gz, and you do not want those.
      const dataToSave = loaded.txt// loaded.buffer || loaded.txt;

   
    if (!dataToSave || !dataToSave.trim()) {
    throw new Error("Downloaded TXT is empty or unsupported");
    }

const safeFilename = (
  loaded.filename || `${participant.id}.${loaded.fileExtension || "txt"}`
).replace(/[\/\\?%*:|"<>]/g, "_");

      const outputPath = `pgp/genetic_files/${loaded.id}_${safeFilename}`;

      await bucket.file(outputPath).save(dataToSave, {
        contentType: loaded.contentType || "text/plain"
      });

      savedCount++;

      console.log(`Saved ${savedCount}: gs://${BUCKET_NAME}/${outputPath}`);
    } catch (err) {
      failedCount++;
      console.error(`FAILED ${participant?.id}: ${err.message}`);
    }
  }

  console.log("Import complete.");
  console.log({
    requested: LIMIT,
    found: participants.length,
    saved: savedCount,
    failed: failedCount,
    skipped: skippedCount
  });
}

main().catch(err => {
  console.error("FATAL ERROR:");
  console.error(err);
  process.exit(1);
});