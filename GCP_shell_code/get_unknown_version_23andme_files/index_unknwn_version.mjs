import { Storage } from "@google-cloud/storage";

import {
  fetch23andMeParticipants,
  load23andMeFileCloud_unknwn
} from "personal_genomes_project_sdk/cloud_sdk.mjs";

const BUCKET_NAME = process.env.BUCKET_NAME || "all_23_v2_unknwn";
const LIMIT = Number(process.env.LIMIT || 1100);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 10);

const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

async function main() {
  console.log("Starting unknown-version 23andMe import...");
  console.log({ BUCKET_NAME, LIMIT, BATCH_SIZE });

  const participants = await fetch23andMeParticipants(LIMIT, {
    batchSize: BATCH_SIZE
  });

  console.log(`Participants found: ${participants.length}`);

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

      console.log(`Processing ${participant.id}`);
      console.log(`Download URL: ${participant.downloadUrl}`);

      const loaded = await load23andMeFileCloud_unknwn(
        participant.downloadUrl,
        participant.id
      );

      if (!loaded?.txt || !loaded.txt.trim()) {
        throw new Error("Downloaded TXT is empty");
      }

      const safeFilename = loaded.filename || `${participant.id}.txt`;
      const outputPath = `pgp/23andme_txt_unknown/${loaded.id}_${safeFilename}`;

      await bucket.file(outputPath).save(loaded.txt, {
        contentType: "text/plain"
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
