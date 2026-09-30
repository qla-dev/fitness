import { Directory, File, Paths } from 'expo-file-system';
import type { MarkaiMessage } from './markai';

/**
 * Photos sent to MarkAI, kept on this device under their message id.
 *
 * The server forwards a photo to the model and stores only `has_image`, so a
 * reopened conversation used to show a bare "Photo" label where the picture
 * had been. The copy lives in the document directory because the picked file
 * sits in the cache, which the system clears whenever it likes. It stays on
 * this phone: a conversation opened on another one still shows the label.
 */
const directory = () => new Directory(Paths.document, 'markai-photos');

function photoFile(messageId: string) {
  if (!/^[a-f0-9-]+$/i.test(messageId)) throw new Error('Invalid message id');
  return new File(directory(), `${messageId}.jpg`);
}

/** Keeps the sent photo; a failed copy only costs the photo on reload. */
export function saveMarkaiPhoto(messageId: string, uri: string): string {
  try {
    directory().create({ intermediates: true, idempotent: true });
    const file = photoFile(messageId);
    if (!file.exists) new File(uri).copy(file);
    return file.uri;
  } catch {
    return uri;
  }
}

/** Fills in `imageUri` for every photo message this device still has. */
export function withSavedMarkaiPhotos(
  messages: MarkaiMessage[]
): MarkaiMessage[] {
  return messages.map((message) => {
    if (!message.has_image || message.imageUri) return message;
    try {
      const file = photoFile(message.id);
      return file.exists ? { ...message, imageUri: file.uri } : message;
    } catch {
      return message;
    }
  });
}
