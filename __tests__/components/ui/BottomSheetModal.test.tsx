import React from 'react';
import { BackHandler, Platform, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { BottomSheetModal } from '../../../src/components/ui/BottomSheetModal';

const mockModal = {
  present: jest.fn(),
  dismiss: jest.fn(),
  props: {} as Record<string, any>,
};

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BottomSheetModal: React.forwardRef((props: any, ref: any) => {
      React.useEffect(() => {
        mockModal.props = props;
      });
      React.useImperativeHandle(ref, () => ({
        present: mockModal.present,
        dismiss: mockModal.dismiss,
      }));
      return React.createElement(View, null, props.children);
    }),
  };
});

/**
 * gorhom's modal never consumed the Android hardware Back button, so a press
 * with a sheet open switched the tab underneath it and a second press left
 * the app. The wrapper owns that: a listener only while presented, dismissing
 * on press, gone again once closed.
 */
describe('BottomSheetModal wrapper', () => {
  let listeners: (() => boolean)[];
  let remove: jest.Mock;
  let osSpy: { restore: () => void };

  beforeEach(() => {
    listeners = [];
    remove = jest.fn();
    osSpy = jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
      _event: string,
      handler: () => boolean
    ) => {
      listeners.push(handler);
      return { remove };
    }) as typeof BackHandler.addEventListener);
  });

  afterEach(() => {
    osSpy.restore();
    jest.restoreAllMocks();
    mockModal.present.mockClear();
    mockModal.dismiss.mockClear();
  });

  const renderSheet = (onChange?: jest.Mock) => {
    const ref = React.createRef<BottomSheetModal>();
    const utils = render(
      <BottomSheetModal ref={ref} onChange={onChange}>
        <Text>content</Text>
      </BottomSheetModal>
    );
    return { ref, ...utils };
  };

  const fireIndexChange = (index: number) =>
    act(() => mockModal.props.onChange?.(index, 0, 'SNAP_POINT'));

  it('exposes gorhom’s imperative surface through the forwarded ref', () => {
    const { ref } = renderSheet();
    ref.current?.present();
    ref.current?.dismiss();
    expect(mockModal.present).toHaveBeenCalledTimes(1);
    expect(mockModal.dismiss).toHaveBeenCalledTimes(1);
  });

  it('registers Back only while presented and dismisses on press', () => {
    renderSheet();
    expect(listeners).toHaveLength(0);

    fireIndexChange(0);
    expect(listeners).toHaveLength(1);

    expect(listeners[0]()).toBe(true);
    expect(mockModal.dismiss).toHaveBeenCalledTimes(1);

    fireIndexChange(-1);
    expect(remove).toHaveBeenCalled();
  });

  it('still forwards onChange to the caller', () => {
    const onChange = jest.fn();
    renderSheet(onChange);
    fireIndexChange(0);
    expect(onChange).toHaveBeenCalledWith(0, 0, 'SNAP_POINT');
  });

  it('does nothing on iOS, where the system owns dismissal', () => {
    osSpy.restore();
    osSpy = jest.replaceProperty(Platform, 'OS', 'ios');
    renderSheet();
    fireIndexChange(0);
    expect(listeners).toHaveLength(0);
  });
});
