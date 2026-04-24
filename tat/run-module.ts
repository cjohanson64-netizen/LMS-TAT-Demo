import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { executeTat, parseTat } from "./tat-library/runtime/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveModulePath(inputPath?: string): string {
  if (!inputPath) {
    return path.resolve(__dirname, "modules", "lms-submission.tat");
  }

  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(process.cwd(), inputPath);
}

function main() {
  const modulePath = resolveModulePath(process.argv[2]);
  const jsonOnly = process.argv.includes("--json-only");
  const source = fs.readFileSync(modulePath, "utf8");

  try {
    if (!jsonOnly) {
      console.log(`\n[TAT] Loading module: ${modulePath}\n`);
      const parsed = parseTat(source);
      console.log("[TAT] Parse successful");
      console.log("[TAT] Printed AST:\n");
      console.log(parsed.printedAst);
    }

    const result = executeTat(source);

    if (jsonOnly) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log("\n[TAT] Execution successful");
    console.log("\n[TAT] Validation:");
    console.log(JSON.stringify(result.validation, null, 2));

    console.log("\n[TAT] Debug output:");
    console.log(JSON.stringify(result.debug, null, 2));
  } catch (error: unknown) {
    if (jsonOnly) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ error: message }));
      process.exit(1);
    }

    console.error("\n[TAT] Failed to run module\n");

    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error("\nStack:\n");
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

main();