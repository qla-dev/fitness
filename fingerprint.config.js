/** @type {import('expo/fingerprint').Config} */
module.exports = {
  extraSources: [
    {
      // Only each target's expo-target.config.js is picked up on its own (as a
      // config plugin), not the Swift beside it. That Swift is real native
      // input: the watch app and the phone's WatchConnectivity module duplicate
      // their message keys by hand, because a watchOS target and an iOS pod
      // cannot import from each other. Without this, changing a key on the
      // watch side would leave the runtime version untouched and let a JS
      // update land on a build that no longer speaks the same protocol.
      type: 'dir',
      filePath: 'targets',
      reasons: ['appleTargetSources'],
    },
  ],
};
