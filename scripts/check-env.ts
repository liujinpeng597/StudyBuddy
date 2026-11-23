import "dotenv/config";
import { getServerEnv } from "@studybuddy/core";

const env = getServerEnv();
console.log(
  Object.keys(env)
    .sort()
    .join("\n")
);
