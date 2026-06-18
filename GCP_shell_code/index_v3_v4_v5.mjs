//a one-file Cloud Run / Cloud Shell test. It does this:

// 1. Import Google Cloud Storage
// 2. Import fetch23andMeParticipants() and load23andMeFileCloud()
// 3. Fetch 1 PGP 23andMe participant
// 4. Download that participant’s 23andMe file
// 5. Save the raw txt into a GCS bucket

// That matches the cloud SDK flow from your uploaded code: participant list → downloadUrl → load23andMeFileCloud() → save loaded.txt


import { Storage } from "@google-cloud/storage";

//since the package has a cloud entry, I recommend using the npm package import

import {
  fetch23andMeParticipants,
  load23andMeFileCloud
} from "personal_genomes_project_sdk/cloud_sdk.mjs";

// then run in the shell: 
// npm install @google-cloud/storage jszip personal_genomes_project_sdk@latest

// Build the container
// gcloud builds submit --tag gcr.io/personalgenomes/pgp-23andme-txt-1100

//Create the Cloud Run Job (create or update)
// gcloud run jobs create pgp-23andme-txt-1100 \
//   --image gcr.io/personalgenomes/pgp-23andme-txt-1100 \
//   --region us-east4 \
//   --memory 4Gi \
//   --cpu 2 \
//   --task-timeout 3600 \
//   --set-env-vars BUCKET_NAME=all_23_v2,LIMIT=1100,BATCH_SIZE=10

// Deploy the container
// gcloud run jobs create pgp-23andme-txt-1100 \
//   --image gcr.io/personalgenomes/pgp-23andme-txt-1100 \
//   --region us-east4 \
//   --memory 4Gi \
//   --cpu 2 \
//   --task-timeout 3600 \
//   --set-env-vars BUCKET_NAME=all_23_v2,LIMIT=1100,BATCH_SIZE=10

const BUCKET_NAME = process.env.BUCKET_NAME || "all_23_v2";
const LIMIT = Number(process.env.LIMIT || 5);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 10);

const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);


async function main() {
  console.log("Fetching participant list...");

  const participants = await fetch23andMeParticipants(LIMIT, {
    batchSize: BATCH_SIZE
  });

  console.log("Participants found:", participants.length);
  console.log("First participant:");
  console.log(JSON.stringify(participants[0], null, 2));

  let savedCount = 0;
  let failedCount = 0;

  for (const participant of participants) {
    try {
      if (!participant?.downloadUrl) {
        console.warn(`Skipping ${participant?.id}: no downloadUrl`);
        continue;
      }

      console.log("Downloading 23andMe file for:", participant.id);
      console.log("Download URL:", participant.downloadUrl);

      const loaded = await load23andMeFileCloud(
        participant.downloadUrl,
        participant.id
      );

      if (!loaded?.txt || !loaded.txt.trim()) {
        throw new Error(`Downloaded text is empty for ${participant.id}`);
      }

      console.log("Loaded file:");
      console.log({
        id: loaded.id,
        filename: loaded.filename,
        url: loaded.url,
        txtLength: loaded.txt.length
      });

      const safeFilename = loaded.filename || `${participant.id}.txt`;
      const outputPath = `pgp/${loaded.id}_${safeFilename}`;

      await bucket.file(outputPath).save(loaded.txt, {
        contentType: "text/plain"
      });

      savedCount++;

      console.log(`Saved to gs://${BUCKET_NAME}/${outputPath}`);
    } catch (err) {
      failedCount++;
      console.error(`FAILED ${participant?.id}:`, err.message);
    }
  }

  console.log("Test complete.");
  console.log({
    requested: LIMIT,
    found: participants.length,
    saved: savedCount,
    failed: failedCount
  });
}

main().catch(err => {
  console.error("TEST FAILED:");
  console.error(err);
  process.exit(1);
});
