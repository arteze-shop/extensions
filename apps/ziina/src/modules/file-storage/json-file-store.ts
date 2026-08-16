import fs from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";
import { BaseError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

export const JsonFileStoreError = {
  CorruptFileError: BaseError.subclass("JsonFileStoreError.CorruptFileError", {
    props: {
      _internalName: "JsonFileStoreError.CorruptFileError" as const,
    },
  }),
};

/**
 * Stores arbitrary JSON-shaped values under top-level keys in a single companion file.
 *
 * All operations are serialized through a single in-memory promise chain (mutex), so
 * concurrent read-modify-write operations from different repos never lose updates.
 * Writes are atomic: the file is written to a temp path and renamed over the target.
 */
export class JsonFileStore {
  private logger = createLogger("JsonFileStore");

  private readonly filePath: string;

  private chain: Promise<unknown> = Promise.resolve();

  constructor(filePath?: string) {
    this.filePath = path.resolve(filePath ?? env.CONFIG_STORAGE_FILE_PATH ?? ".ziina-config.json");
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.chain.then(operation, operation);

    this.chain = result.catch(() => undefined);

    return result;
  }

  private async readFile(): Promise<Record<string, unknown>> {
    let raw: string;

    try {
      raw = await fs.readFile(this.filePath, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return {};
      }

      throw e;
    }

    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      throw new JsonFileStoreError.CorruptFileError(
        `Failed to parse JSON file at path ${this.filePath}`,
        {
          cause: e,
        },
      );
    }
  }

  private async writeFile(data: Record<string, unknown>): Promise<void> {
    const tmpPath = `${this.filePath}.tmp`;

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmpPath, this.filePath);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.enqueue(async () => {
      const data = await this.readFile();

      return data[key] as T | undefined;
    });
  }

  async update<T>(key: string, updater: (prev: T | undefined) => T | Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      const data = await this.readFile();
      const prev = data[key] as T | undefined;
      const next = await updater(prev);

      data[key] = next;

      await this.writeFile(data);

      this.logger.debug(`Updated key "${key}" in ${this.filePath}`);

      return next;
    });
  }

  async remove(key: string): Promise<void> {
    return this.enqueue(async () => {
      const data = await this.readFile();

      delete data[key];

      await this.writeFile(data);

      this.logger.debug(`Removed key "${key}" from ${this.filePath}`);
    });
  }
}
