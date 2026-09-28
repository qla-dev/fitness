import React from 'react';
import { render } from '@testing-library/react-native';
import NativePromptSheet from '../../src/components/ui/NativePromptSheet';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
jest.mock('../../src/components/CustomModal', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  return forwardRef(({ children }: any, ref: any) => {
    useImperativeHandle(ref, () => ({
      present: mockPresent,
      dismiss: mockDismiss,
    }));
    return children;
  });
});
jest.mock('../../src/components/ui/FooterCTA', () => () => null);

const sheet = (open: boolean) => (
  <NativePromptSheet
    open={open}
    onClose={jest.fn()}
    title="Title"
    footerLabel="Done"
    onFooterPress={jest.fn()}
  >
    {null}
  </NativePromptSheet>
);

it('does not dismiss a sheet that was never presented, so the first open works', () => {
  const view = render(sheet(false));
  expect(mockDismiss).not.toHaveBeenCalled();
  view.rerender(sheet(true));
  expect(mockPresent).toHaveBeenCalledTimes(1);
  view.rerender(sheet(false));
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});
