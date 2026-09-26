import { Directory, File, Paths } from 'expo-file-system';

export function localProgressPhotoFile(id: string) {
  if (!/^[a-f0-9-]+$/i.test(id)) throw new Error('Invalid photo id');
  return new File(
    new Directory(Paths.document, 'progress-photos'),
    `${id}.jpg`
  );
}

export function copyProgressPhoto(uri: string, id: string) {
  new Directory(Paths.document, 'progress-photos').create({
    intermediates: true,
    idempotent: true,
  });
  new File(uri).copy(localProgressPhotoFile(id));
}

export function removeProgressPhoto(id: string) {
  try {
    const file = localProgressPhotoFile(id);
    if (file.exists) file.delete();
  } catch {
    /* Metadata is authoritative; an unused file can be cleaned later. */
  }
}
