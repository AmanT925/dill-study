// Local PDF storage utilities using IndexedDB via localforage
// This stores each PDF (metadata + extracted text + base64 of original file) under a namespaced key.

import localforage from 'localforage';

interface StoredPDFRecord {
  id: string;
  fileName: string;
  savedAt: string; // ISO date
  totalPages: number;
  extractedText: string;
  fileBase64: string; // data:application/pdf;base64,...
  textLength: number;
}

const INDEX_KEY = 'pdf_index_v1';

localforage.config({
  name: 'guide-grok',
  storeName: 'pdf_store'
});

async function readIndex(): Promise<string[]> {
  return (await localforage.getItem<string[]>(INDEX_KEY)) || [];
}

async function writeIndex(ids: string[]) {
  await localforage.setItem(INDEX_KEY, ids);
}

export async function savePDFRecord(params: {
  id: string;
  file: File;
  extractedText: string;
  totalPages: number;
}): Promise<StoredPDFRecord> {
  const { id, file, extractedText, totalPages } = params;
  const fileBase64 = await fileToDataURL(file);
  const record: StoredPDFRecord = {
    id,
    fileName: file.name,
    savedAt: new Date().toISOString(),
    totalPages,
    extractedText,
    fileBase64,
    textLength: extractedText.length,
  };
  await localforage.setItem(`pdf:${id}`, record);
  const index = await readIndex();
  if (!index.includes(id)) {
    index.unshift(id);
    await writeIndex(index.slice(0, 50)); // keep only most recent 50
  }
  return record;
}

export async function loadAllPDFRecords(): Promise<StoredPDFRecord[]> {
  const index = await readIndex();
  const records: StoredPDFRecord[] = [];
  for (const id of index) {
    const rec = await localforage.getItem<StoredPDFRecord>(`pdf:${id}`);
    if (rec) records.push(rec);
  }
  return records;
}

export async function deletePDFRecord(id: string): Promise<void> {
  await localforage.removeItem(`pdf:${id}`);
  const index = await readIndex();
  await writeIndex(index.filter(i => i !== id));
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
