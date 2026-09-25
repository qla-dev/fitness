import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import RouteMap from '../../src/components/RouteMap';

const mockSetCamera = jest.fn();
jest.mock('expo-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = React.forwardRef((props: object, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({
      setCameraPosition: mockSetCamera,
    }));
    return <View testID="map" {...props} />;
  });
  return {
    AppleMaps: { View: MapView, MapColorScheme: {} },
    GoogleMaps: { View: MapView, MapColorScheme: {} },
  };
});

it('follows position above centre, releases on map interaction, and resumes on recenter', () => {
  Platform.OS = 'ios';
  const first = { latitude: 43, longitude: 18 };
  const second = { latitude: 43.001, longitude: 18.001 };
  const screen = render(
    <RouteMap center={first} navigationMode showsUserLocation />
  );
  expect(mockSetCamera).toHaveBeenLastCalledWith({
    coordinates: { latitude: expect.any(Number), longitude: 18 },
    zoom: 17,
    tilt: 60,
    bearing: 0,
  });
  expect(mockSetCamera.mock.calls.at(-1)[0].coordinates.latitude).toBeLessThan(
    first.latitude
  );
  fireEvent(screen.getByTestId('map'), 'startShouldSetResponderCapture');
  mockSetCamera.mockClear();
  screen.rerender(
    <RouteMap center={second} navigationMode showsUserLocation />
  );
  expect(mockSetCamera).not.toHaveBeenCalled();
  expect(screen.getByTestId('map').props.cameraPosition.coordinates).toEqual(
    first
  );
  fireEvent.press(screen.getByLabelText('Follow my position'));
  expect(mockSetCamera).toHaveBeenCalledTimes(1);
  expect(mockSetCamera.mock.calls[0][0].bearing).toBe(0);
  fireEvent(screen.getByTestId('map'), 'startShouldSetResponderCapture');
  fireEvent(screen.getByTestId('map'), 'cameraMove', {
    zoom: 16,
    tilt: 45,
    bearing: 120,
  });
  fireEvent.press(screen.getByLabelText('Follow my position'));
  screen.rerender(
    <RouteMap
      center={{ latitude: 43.002, longitude: 18.002 }}
      navigationMode
      showsUserLocation
    />
  );
  expect(mockSetCamera).toHaveBeenLastCalledWith(
    expect.objectContaining({
      zoom: 16,
      tilt: 45,
      bearing: 120,
    })
  );
});
