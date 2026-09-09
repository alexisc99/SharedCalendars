import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "hiddenFileIds";

/**
 * Liste — uniquement locale à cet appareil — des pièces jointes qu'un
 * utilisateur a choisi de ne plus voir dans son app (ex: une photo postée
 * par un autre membre qu'il juge inappropriée). Ça ne supprime rien côté
 * serveur ni pour les autres membres : ça filtre juste l'affichage côté
 * client, sur cet appareil.
 */
async function readAll(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function writeAll(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // best-effort : si l'écriture échoue, le filtrage ne persistera
    // simplement pas — pas bloquant pour l'utilisateur.
  }
}

export async function getHiddenFileIds(): Promise<Set<string>> {
  return readAll();
}

export async function hideFile(fileId: string): Promise<Set<string>> {
  const ids = await readAll();
  ids.add(fileId);
  await writeAll(ids);
  return ids;
}

export async function unhideFiles(fileIds: string[]): Promise<Set<string>> {
  const ids = await readAll();
  for (const id of fileIds) ids.delete(id);
  await writeAll(ids);
  return ids;
}
