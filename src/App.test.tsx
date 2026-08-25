import { render } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { useDiagramStore } from './store/diagramStore';

describe('App — ?frame= deep link', () => {
  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
    window.history.pushState({}, '', '/');
  });

  it('applies a valid ?frame= param from the URL on mount', () => {
    const frameId = useDiagramStore.getState().diagram.frames[1].id;
    window.history.pushState({}, '', `/?frame=${frameId}`);

    render(<App />);

    expect(useDiagramStore.getState().currentFrameId).toBe(frameId);
  });

  it('ignores an unknown ?frame= id rather than throwing', () => {
    window.history.pushState({}, '', '/?frame=not-a-real-frame');

    render(<App />);

    expect(useDiagramStore.getState().currentFrameId).toBeNull();
  });

  it('mirrors the current frame back into the URL as it changes, and clears the param once currentFrameId goes back to null', () => {
    render(<App />);
    const frameId = useDiagramStore.getState().diagram.frames[0].id;

    act(() => {
      useDiagramStore.getState().gotoFrame(frameId);
    });
    expect(new URLSearchParams(window.location.search).get('frame')).toBe(frameId);

    act(() => {
      useDiagramStore.getState().loadSeed(); // resets currentFrameId to null
    });
    expect(new URLSearchParams(window.location.search).get('frame')).toBeNull();
  });
});
