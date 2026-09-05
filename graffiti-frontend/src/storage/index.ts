import { IndexedDbStorageAdapter } from "./IndexedDbStorageAdapter";
import { StorageAdapter } from "./types";

let adapterInstance: StorageAdapter | null = null;

export async function getStorageAdapter(): Promise<StorageAdapter> {
  if (!adapterInstance) {
    const adapter = new IndexedDbStorageAdapter();
    await adapter.init();
    adapterInstance = adapter;
  }
  return adapterInstance;
}

export * from "./types";
