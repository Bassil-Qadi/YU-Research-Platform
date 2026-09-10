/**
 * Bring the database's indexes in line with the schemas.
 *
 * Mongoose only ever *creates* missing indexes; it never alters one that
 * already exists. So a schema change like making universityId's unique index
 * sparse has no effect on a database that already has the non-sparse version.
 * syncIndexes drops what no longer matches and rebuilds it.
 *
 *   npm run sync-indexes
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/user";
import Project from "@/lib/db/models/Project";
import Task from "@/lib/db/models/Task";
import Message from "@/lib/db/models/Message";
import Notification from "@/lib/db/models/Notification";
import JoinRequest from "@/lib/db/models/JoinRequest";
import ProjectFile from "@/lib/db/models/ProjectFile";

loadEnvConfig(process.cwd());

const models = [User, Project, Task, Message, Notification, JoinRequest, ProjectFile];

async function main() {
  await connectDB();

  for (const model of models) {
    const dropped = await model.syncIndexes();
    console.log(
      `${model.modelName.padEnd(12)} ${
        dropped.length ? `rebuilt: ${dropped.join(", ")}` : "already in sync"
      }`
    );
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
