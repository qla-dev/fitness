import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { localApiFetch } from '../local/localApi';

/** Copies images into app storage and saves their ordered URIs with the diary row. */
export async function postImageMultipart<T>(params: {
  endpoint: string;
  serviceName: string;
  operation: string;
  method?: 'POST' | 'PUT';
  /** Ordered `images` array with `__new__<n>` placeholders for uploads. */
  order: string[];
  /** Local URIs to upload, in placeholder order. */
  newUris: string[];
  /** Optional JSON payload, sent under `wrapperField` (e.g. `foodData`). */
  payload?: unknown;
  wrapperField?: string;
}): Promise<T> {
  const { endpoint, method = 'POST', order, newUris, payload } = params;

  const directory = new Directory(Paths.document, 'fitness-images');
  directory.create({ idempotent: true, intermediates: true });
  const copied: File[] = [];
  try {
    const uris = newUris.map((uri) => {
      const source = new File(uri);
      const target = new File(
        directory,
        `${randomUUID()}${source.extension || '.jpg'}`
      );
      source.copy(target);
      copied.push(target);
      return target.uri;
    });
    const images = order.map((item) => {
      if (!item.startsWith('__new__')) return item;
      const uri = uris[Number(item.slice('__new__'.length))];
      if (!uri) throw new Error('Missing local image.');
      return uri;
    });
    return await localApiFetch<T>({
      endpoint,
      method,
      body: { ...((payload as object) ?? {}), images },
    });
  } catch (error) {
    copied.forEach((file) => {
      if (file.exists) file.delete();
    });
    throw error;
  }
}

/** Saves an image payload, copying newly picked files into app storage first. */
export async function postPayloadWithImages<T>(params: {
  endpoint: string;
  serviceName: string;
  operation: string;
  method?: 'POST' | 'PUT';
  payload: Record<string, unknown>;
  wrapperField: string;
  order: string[];
  newUris: string[];
  /** Used when no files need uploading. */
  sendJson: (payload: Record<string, unknown>) => Promise<T>;
}): Promise<T> {
  const { payload, order, newUris, sendJson, ...rest } = params;

  if (newUris.length === 0) {
    return sendJson({ ...payload, images: order });
  }

  return postImageMultipart<T>({
    ...rest,
    payload,
    order,
    newUris,
  });
}
