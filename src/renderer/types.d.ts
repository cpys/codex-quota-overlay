export {};

declare global {
  interface Window {
    quotaOverlay: {
      measured(size: {width: number; height: number}): void;
      onState(
        callback: (state: {
          accent?: string;
          locale?: string;
          mode?: string;
          remaining?: number | null;
          status?: string;
          text: string;
        }) => void
      ): void;
    };
    quotaCenter: {
      clearHistory(): Promise<any>;
      copyDiagnostics(): Promise<boolean>;
      getState(): Promise<any>;
      onState(callback: (state: any) => void): () => void;
      refresh(): Promise<any>;
      updateSettings(patch: any): Promise<any>;
    };
  }
}
