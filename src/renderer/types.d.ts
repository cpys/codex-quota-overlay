export {};

declare global {
  interface Window {
    quotaOverlay: {
      measured(size: {width: number; height: number}): void;
      onState(callback: (state: {accent?: string; locale?: string; text: string}) => void): void;
    };
  }
}
