import type { CreativeProject } from "./creative/types";

export interface Artwork {
  id: string;
  name: string;
  updated: number;
  image: Blob;
  thumbnail: string;
  theme: string;
  width?: number;
  height?: number;
  referenceImage?: Blob;
  tracing?: boolean;
  creative?: CreativeProject;
}

let database: Promise<IDBDatabase> | undefined;

function openDatabase() {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("little-art-planet", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("artworks", { keyPath: "id" });
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          database = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        database = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        database = undefined;
        reject(new Error("请关闭其他画画星球页面后再试"));
      };
    });
  }
  return database;
}

export async function listArtworks(): Promise<Artwork[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("artworks", "readonly");
    const request = transaction.objectStore("artworks").getAll();
    transaction.oncomplete = () =>
      resolve(
        (request.result as Artwork[]).sort((a, b) => b.updated - a.updated),
      );
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("读取作品失败"));
  });
}

export async function saveArtwork(artwork: Artwork): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("artworks", "readwrite");
    transaction.objectStore("artworks").put(artwork);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("作品未保存"));
  });
}

export async function deleteArtwork(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("artworks", "readwrite");
    transaction.objectStore("artworks").delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("删除失败"));
  });
}
