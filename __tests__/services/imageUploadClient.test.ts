import {
  postImageMultipart,
  postPayloadWithImages,
} from '../../src/services/api/imageUploadClient';
import { localApiFetch } from '../../src/services/local/localApi';

jest.mock('../../src/services/local/localApi', () => ({
  localApiFetch: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));
const mockCopies = jest.fn();
const mockDeletes = jest.fn();
jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documents' },
  Directory: class {
    uri: string;
    constructor(base: string, name: string) {
      this.uri = base + '/' + name;
    }
    create() {}
  },
  File: class {
    uri: string;
    extension = '.jpg';
    exists = true;
    constructor(base: string | { uri: string }, name?: string) {
      this.uri = typeof base === 'string' ? base : base.uri + '/' + name;
    }
    copy(target: { uri: string }) {
      mockCopies(this.uri, target.uri);
    }
    delete() {
      mockDeletes(this.uri);
    }
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(localApiFetch).mockResolvedValue({ id: 'entry-1' });
});

const input = {
  endpoint: '/api/food-entries/e1/image',
  serviceName: 'Test',
  operation: 'save image',
  order: ['file:///existing.jpg', '__new__0', '__new__1'],
  newUris: ['file:///picked-a.jpg', 'file:///picked-b.jpg'],
};

test('copies new files and preserves their order alongside existing images', async () => {
  const previousFetch = global.fetch;
  const fetchSpy = jest.fn();
  global.fetch = fetchSpy;
  try {
    expect(await postImageMultipart(input)).toEqual({ id: 'entry-1' });
    expect(mockCopies).toHaveBeenCalledTimes(2);
    const copiedUris = mockCopies.mock.calls.map((call: string[]) => call[1]);
    expect(
      copiedUris.every((uri: string) =>
        uri.startsWith('file:///documents/fitness-images/')
      )
    ).toBe(true);
    expect(localApiFetch).toHaveBeenCalledWith({
      endpoint: input.endpoint,
      method: 'POST',
      body: { images: ['file:///existing.jpg', ...copiedUris] },
    });
    expect(mockDeletes).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    global.fetch = previousFetch;
  }
});

test('removes copied files when saving the diary row fails', async () => {
  jest.mocked(localApiFetch).mockRejectedValue(new Error('Storage full'));
  await expect(postImageMultipart(input)).rejects.toThrow('Storage full');
  expect(mockDeletes.mock.calls.map((call: string[]) => call[0])).toEqual(
    mockCopies.mock.calls.map((call: string[]) => call[1])
  );
});

test('rejects a missing placeholder and removes copied files', async () => {
  await expect(
    postImageMultipart({ ...input, order: ['__new__2'] })
  ).rejects.toThrow('Missing local image');
  expect(localApiFetch).not.toHaveBeenCalled();
  expect(mockDeletes).toHaveBeenCalledTimes(2);
});

test('saves the payload and image URIs together for food/meal writes', async () => {
  const sendJson = jest.fn();
  await postPayloadWithImages({
    ...input,
    payload: { name: 'Meal' },
    wrapperField: 'mealData',
    sendJson,
  });
  expect(localApiFetch).toHaveBeenCalledWith(
    expect.objectContaining({
      body: {
        name: 'Meal',
        images: [
          'file:///existing.jpg',
          ...mockCopies.mock.calls.map((call: string[]) => call[1]),
        ],
      },
    })
  );
  expect(sendJson).not.toHaveBeenCalled();
});

test('retains the JSON save path when there are no new files', async () => {
  const sendJson = jest.fn().mockResolvedValue({ id: 'food-1' });
  await expect(
    postPayloadWithImages({
      ...input,
      payload: { name: 'Meal' },
      wrapperField: 'mealData',
      newUris: [],
      order: ['file:///existing.jpg'],
      sendJson,
    })
  ).resolves.toEqual({ id: 'food-1' });
  expect(sendJson).toHaveBeenCalledWith({
    name: 'Meal',
    images: ['file:///existing.jpg'],
  });
  expect(mockCopies).not.toHaveBeenCalled();
  expect(localApiFetch).not.toHaveBeenCalled();
});
