import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFilePath(collection: string): string {
  return path.join(DATA_DIR, `${collection}.json`);
}

export function readCollection(collection: string): any[] {
  ensureDataDir();
  const filePath = getFilePath(collection);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeCollection(collection: string, data: any[]): void {
  ensureDataDir();
  fs.writeFileSync(getFilePath(collection), JSON.stringify(data, null, 2), 'utf-8');
}

function nextId(items: any[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((i: any) => i.id)) + 1;
}

export function findAll(collection: string): any[] {
  return readCollection(collection).filter((i: any) => i.ativo !== false);
}

export function findById(collection: string, id: number): any | undefined {
  return readCollection(collection).find((i: any) => i.id === id);
}

export function create(collection: string, item: any): any {
  const items = readCollection(collection);
  const newItem = { ...item, id: nextId(items), criadoEm: new Date().toISOString() };
  items.push(newItem);
  writeCollection(collection, items);
  return newItem;
}

export function update(collection: string, id: number, data: any): any | null {
  const items = readCollection(collection);
  const index = items.findIndex((i: any) => i.id === id);
  if (index === -1) return null;
  items[index] = { ...items[index], ...data };
  writeCollection(collection, items);
  return items[index];
}

export function softDelete(collection: string, id: number): boolean {
  const items = readCollection(collection);
  const index = items.findIndex((i: any) => i.id === id);
  if (index === -1) return false;
  items[index].ativo = false;
  writeCollection(collection, items);
  return true;
}
