import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { localTransaction } from './database';

export async function exportLocalData(): Promise<void> {
  const snapshot = await localTransaction((database) =>
    JSON.stringify(
      {
        format: 'fitness-local-export',
        exportedAt: new Date().toISOString(),
        database,
      },
      null,
      2
    )
  );
  const file = new File(Paths.cache, `fitness-local-${Date.now()}.json`);
  try {
    file.write(snapshot);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
    });
  } finally {
    if (file.exists) file.delete();
  }
}
