interface Window {
  EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
  desktop?: {
    getFullscreen(): Promise<boolean>;
    toggleFullscreen(): Promise<void>;
    onFullscreenChange(callback: (fullscreen: boolean) => void): () => void;
  };
}
