# qla.fit: iPhone Duo readiness investigation

Reviewed on 1 November 2026 against the local working tree, installed dependencies, and current Apple/Expo documentation. This is a static audit and implementation proposal. No app configuration or runtime code was changed, no builds were submitted, and no Duo runtime test was performed from this Windows workstation.

## Recommendation

Prepare a separate Expo SDK 58 / React Native 0.88 upgrade, build against iOS 27.1, and adapt shared layout primitives before adding wider-screen enhancements. Retain React Navigation and the existing native iOS navigation path initially. A navigation rewrite is not a prerequisite; the installed native tab library and native-stack integration need verification on the new SDK.

Apple describes different compatibility modes by linked SDK: iOS 26 and older builds retain a constrained app area; iOS 27 enables dynamic resizing; iOS 27.1 permits the full display and native bars that can move vertically. Layout must follow the current view/window size, and folding can resize an already-running screen. [Apple preparation guidance](https://developer.apple.com/iphone-duo/prepare/).

## Current build configuration

| Area | Observed locally | Implication |
| --- | --- | --- |
| Expo | Installed `57.0.20`; package range `~57.0.20` | Current installation predates the documented SDK 57 scene-support opt-in. |
| React Native | Installed `0.86.3` | SDK 58 upgrades this to 0.88. |
| Expo build properties | Installed `57.0.17`; config includes Android options only | No `ios.enableSceneSupport` configured. |
| EAS iOS profile | `resourceClass: medium`, no `image` | Resource class controls build resources, not the linked iOS SDK. Confirm the actual image in build logs. |
| iOS device family | `supportsTablet: false` in `app.config.ts:213` | This does not need to be switched on merely to target a foldable iPhone. Keep iPad distribution a separate product decision. |
| Orientation | `portrait` in `app.json:6` | Evaluate this preference, while making every layout resize-safe. An orientation preference is not a substitute for adaptive layout. |
| Native project generation | No local `ios/` directory | Keep native changes in Expo config/plugins and regenerate through the existing continuous native generation workflow. |
| Native update boundary | `runtimeVersion: { policy: 'appVersion' }` in `app.config.ts` | Ship SDK changes in a new native binary and bump the app version so older binaries do not receive incompatible JavaScript. |

SDK 58 supplies the scene lifecycle and newer scene-aware Expo modules. Expo documents a fallback for SDK 57 starting at `expo@57.0.23` with the build-properties scene opt-in; that is a separate compatibility path, not evidence that the installed 57.0.20 stack can safely use Xcode 27 unchanged. [SDK 58 release](https://expo.dev/changelog/sdk-58), [SDK 57 notes](https://expo.dev/changelog/sdk-57).

After the SDK upgrade and dependency alignment, an explicit candidate for the existing production iOS configuration is:

```json
{
  "ios": {
    "resourceClass": "medium",
    "image": "macos-tahoe-26.6-xcode-27.1"
  }
}
```

The current EAS infrastructure list associates this image with `sdk-58` / `latest` and labels the included Xcode as 27.1 RC. It lists SDK 57's recommended image with Xcode 26.6. Recheck the image and release status at implementation time; do not change the image alone on the current stack. [EAS infrastructure](https://docs.expo.dev/build-reference/infrastructure/).

## Layout and navigation findings

These are source-level findings and predicted failure modes, not failures reproduced on a Duo.

| Priority | Location | Finding and proposed change |
| --- | --- | --- |
| High | `src/components/ui/NativeHeaderScrollView.tsx` | Explicitly disables automatic content insets and supplies only measured top clearance. Extend the content-inset contract to account for left/right rail space while preserving the existing double-top-inset fix. |
| High | `src/screens/DiaryScreen.tsx:392`, `src/screens/DashboardScreen.tsx:358` | Content uses fixed horizontal gutters. Audit which native views already apply horizontal insets, then add missing safe-area padding once. Avoid duplicating native insets. |
| High | `src/screens/ChatScreen.tsx:784` | Root handles top/bottom safe areas, with fixed inner horizontal padding. Review the message list, composer, keyboard offset, attachment actions, and open menus for both side rails. |
| High | `src/components/RouteMap.tsx:144` | Map controls use `right: 16`. Position interactive controls relative to the applicable right/left insets. Let the map background remain full bleed. |
| High | `src/components/recording/RunRideRecorder.tsx:496` | Floating metrics use fixed positions and `right: 112`; panel padding focuses on the bottom. Measure an unobstructed content rectangle and reflow metrics within it. |
| High | `src/components/ActiveWorkoutBar.tsx:370`, `src/components/TabsLayout.tsx:114` | Workout overlay and banner placement assume native tabs contribute a bottom height. Verify side-rail behavior; avoid leaving phantom bottom clearance or putting content underneath vertical controls. |
| Medium | `src/components/CustomTabBar.tsx` | Fallback tabs remain a horizontal JS pill and prioritize bottom insets. Make the fallback safe-area aware; validate with the user's Liquid Glass preference disabled as well as enabled. |
| Medium | `src/hooks/useScreenHeader.tsx:290` | Accessories span left/right zero and custom header logic includes fixed small-header assumptions. Native action items are a useful foundation; test accessories and custom views separately when navigation becomes vertical. |
| Medium | `src/components/AnchoredMenu.tsx:79` | Uses reactive window width, which is good, but positions from an externally supplied anchor. Re-measure or dismiss an open menu on resize, and constrain it to available safe bounds including height. |
| Medium | `src/components/recording/WorkoutCamera.tsx` | Receives live viewport size, but controls depend on center and panel offsets. Verify shutter placement, preview crop, camera continuity, and exported metric overlays through folding. |
| Medium | Prompt routes, Gorhom sheets, photo viewers and carousels | Test presentation and sizing while already open, especially with the keyboard and a partial fold. Treat native sheets and custom overlays separately. |

Expo's current guide describes horizontal rail insets, floating-control positioning, and a distinction between safe areas and reserved screen regions. It also identifies hinge support and native arrangement containers as optional additions. Use the platform's current insets; do not encode an 84-point constant as app layout policy. [Expo's Duo guide](https://expo.dev/blog/supporting-iphone-duo).

### Existing strengths

- No `Dimensions.get`, `isPad`, or `isTablet` layout checks were found in the searched first-party `src/` and `App.tsx` code.
- `DiaryNutritionCard` uses `useWindowDimensions` and measures chart/card sections with `onLayout`.
- `RunRideRecorder` updates its viewport through `onLayout`, rather than keeping a startup screen size.
- `ProgramStore`, photo viewers and other components already use reactive dimensions.
- `TabsLayout` uses real native tab/stack navigators on the native iOS path. Installed `react-native-bottom-tabs` is 1.4.0; its native code contains iOS 27 handling. This is encouraging, not proof of correct 27.1 rail behavior.
- The diary and recorder store state independently of the visual layout. Folding should not require storage, API, sync, or database changes.

React Native recommends `useWindowDimensions` for component sizing because it follows changes in the window. Use container `onLayout` for panes that occupy only part of that window. [React Native dimensions documentation](https://reactnative.dev/docs/dimensions).

## Product layout proposal

First make the existing single-column experience behave correctly at every usable size. Then add the following enhancements where the available content width permits them:

| Screen | Compact layout | Wider layout candidate |
| --- | --- | --- |
| Activities | Existing card sequence | Two balanced columns of activity and health cards. |
| Tracker | Existing daily log | Diary entries alongside the nutrition/day summary. |
| Goals | Existing stacked charts | Chart and period controls alongside the selected metric's details. |
| MarkAI | Existing conversation | Comfortable centered reading width; optional history/list beside the conversation. |
| Run/Ride | Full map with safe controls | Map plus a readable metrics/control panel, keeping the same active recording. |
| Store/library | Existing list/detail navigation | Program list alongside selected program details. |
| Forms/settings | Existing form | Centered content with a maximum reading width, rather than stretched controls. |

Enable columns only when both panes can meet their minimum usable widths after safe areas and spacing. Folding, rotation and Split View can all change that calculation. Keep screen identities, selections, drafts, scroll state and recording subscriptions stable as the arrangement changes.

Avoid routing into separate "Duo screens" or keying the whole navigator by width. Those approaches risk resetting forms, conversations and ongoing activities when the device folds.

## Suggested implementation order

1. **Native foundation:** isolate the SDK 58 upgrade, align Expo-managed versions, check camera/maps/HealthKit/BLE/purchases/native-tabs dependencies, regenerate the development binary, and verify iOS scene startup and deep links. Preserve the existing Android baseline.
2. **Shared geometry:** establish a content-layout hook/container using current window/container dimensions and safe-area insets. Fix scroll views, floating controls, keyboard/composer placement, header accessories and tab-related offsets.
3. **Continuity:** fold during editing, recording and camera use. Fix remounts or stale anchors before adding additional columns.
4. **Wider layouts:** introduce the screen-specific enhancements above, starting with Activities/Tracker and Run/Ride. Keep compact layouts functional.
5. **Optional posture features:** consider a tabletop recording/camera control arrangement or a native arrangement container. Observe hinge state for interactions, rather than using hinge angles as the base responsive breakpoint.

Switching to Expo Router is a separate architectural decision. Validate the current React Navigation/native-tabs solution before considering a migration solely for Duo.

## Runtime verification still required

Use a Mac with Xcode 27.1 / Device Hub or a suitable remote Mac. Check:

- Folded and unfolded in supported orientations, then partially open and both Split View positions.
- Left and right safe areas; native bars becoming vertical and returning horizontal.
- Liquid Glass preference enabled and disabled.
- A diary entry or medication draft, an unsent chat message, a selected goal, an open sheet, and an anchored menu during a fold.
- Run/Ride while recording: uninterrupted timer, location samples, band heart rate, pause/resume, background continuation, camera capture and share output.
- Keyboard open during resize, large accessibility text, long translations, VoiceOver focus and navigation actions.
- App links / Apple sign-in return, HealthKit and BLE permissions after the scene lifecycle change.
- Standard iPhone regression coverage and Android smoke coverage after the framework upgrade.

Static inspection cannot establish that all dependencies handle the new scene lifecycle or vertical navigation correctly. No readiness claim should be made until the new binary has passed these runtime checks.
