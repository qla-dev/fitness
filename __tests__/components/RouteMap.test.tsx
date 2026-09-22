import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';

import RouteMap from '../../src/components/RouteMap';

const mockAppleProps = jest.fn();
const mockGoogleProps = jest.fn();

jest.mock('expo-maps', () => {
  const { View } = require('react-native');
  return {
    AppleMaps: {
      View: (props: Record<string, unknown>) => {
        mockAppleProps(props);
        return <View testID="apple-map" />;
      },
      MapColorScheme: { DARK: 'DARK' },
    },
    GoogleMaps: {
      View: (props: Record<string, unknown>) => {
        mockGoogleProps(props);
        return <View testID="google-map" />;
      },
      MapColorScheme: { DARK: 'DARK' },
    },
  };
});

jest.mock('uniwind', () => ({ useCSSVariable: () => '#3B82F6' }));

// Google Maps needs a manifest API key; RouteMap reads its presence from the
// embedded config. Most tests run with one set so the map branch is exercised.
const mockExpoConfig: {
  android?: { config?: { googleMaps?: { apiKey?: string } } };
} = {};
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConfig;
    },
  },
}));

const setGoogleMapsApiKey = (apiKey: string | undefined) => {
  mockExpoConfig.android = apiKey ? { config: { googleMaps: { apiKey } } } : {};
};

const A = { latitude: 1, longitude: 2 };
const B = { latitude: 3, longitude: 4 };

describe('RouteMap', () => {
  const originalOS = Platform.OS;

  beforeEach(() => setGoogleMapsApiKey('test-key'));

  afterEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  const setOS = (os: string) =>
    Object.defineProperty(Platform, 'OS', { value: os });

  it('renders Apple Maps on iOS and Google Maps on Android', () => {
    setOS('ios');
    expect(render(<RouteMap />).getByTestId('apple-map')).toBeTruthy();

    setOS('android');
    expect(render(<RouteMap />).getByTestId('google-map')).toBeTruthy();
  });

  /**
   * Without com.google.android.geo.API_KEY the native Google Maps view throws
   * from native code and takes the process down — no error boundary catches
   * it. The Android branch must not mount the view when the build has no key.
   */
  it('shows a placeholder instead of Google Maps when the build has no API key', () => {
    setOS('android');
    setGoogleMapsApiKey(undefined);
    const screen = render(<RouteMap />);
    expect(screen.queryByTestId('google-map')).toBeNull();
    expect(mockGoogleProps).not.toHaveBeenCalled();
    expect(screen.getByText(/no Google Maps API key/)).toBeTruthy();

    // iOS uses Apple Maps and needs no key.
    setOS('ios');
    expect(render(<RouteMap />).getByTestId('apple-map')).toBeTruthy();
  });

  /**
   * A one-point line renders nothing and a zero-length one is rejected, so the
   * layer must not exist until the route actually has a segment to draw.
   */
  it('draws no polyline until the route has two points', () => {
    setOS('ios');

    render(<RouteMap route={[]} />);
    expect(mockAppleProps.mock.calls[0][0].polylines).toEqual([]);

    jest.clearAllMocks();
    render(<RouteMap route={[A]} />);
    expect(mockAppleProps.mock.calls[0][0].polylines).toEqual([]);

    jest.clearAllMocks();
    render(<RouteMap route={[A, B]} />);
    expect(mockAppleProps.mock.calls[0][0].polylines).toEqual([
      expect.objectContaining({ coordinates: [A, B], color: '#3B82F6' }),
    ]);
  });

  it('zooms out when there is nothing to centre on, and in when there is', () => {
    setOS('ios');

    render(<RouteMap />);
    const wide = mockAppleProps.mock.calls[0][0].cameraPosition;
    expect(wide.coordinates).toBeUndefined();

    jest.clearAllMocks();
    render(<RouteMap center={A} />);
    const close = mockAppleProps.mock.calls[0][0].cameraPosition;
    expect(close.coordinates).toEqual(A);
    expect(close.zoom).toBeGreaterThan(wide.zoom);
  });

  /**
   * The blue dot and the recentre button both need an OS location permission,
   * so they stay off unless the caller says the app has one.
   */
  it('keeps the user location off by default', () => {
    setOS('android');

    render(<RouteMap />);
    expect(mockGoogleProps.mock.calls[0][0].properties).toEqual(
      expect.objectContaining({ isMyLocationEnabled: false })
    );

    jest.clearAllMocks();
    render(<RouteMap showsUserLocation />);
    expect(mockGoogleProps.mock.calls[0][0].properties).toEqual(
      expect.objectContaining({ isMyLocationEnabled: true })
    );
  });

  /**
   * Under content the notice has nowhere to sit that the readings or the
   * control panel over the map have not already claimed, so there is nothing
   * to render rather than a block behind one of them.
   */
  it('renders no keyless notice when the map is a background layer', () => {
    const { queryByText } = render(<RouteMap appearance="dark" />);

    expect(
      queryByText(
        'The map is unavailable: this build has no Google Maps API key.'
      )
    ).toBeNull();
  });
});
