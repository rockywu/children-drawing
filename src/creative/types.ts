export type CreativeKind = "symmetry" | "pixel" | "animation";
export type SymmetryMode = "mirror" | "four" | "six" | "eight";
export type CreativeBrush = "plain" | "rainbow" | "stars";
export interface CreativePoint { x: number; y: number }
export interface SymmetryStroke {
  points: CreativePoint[];
  color: string;
  opacity: number;
  size: number;
  eraser: boolean;
  mode: SymmetryMode;
  brush: CreativeBrush;
}
export interface SymmetryProject {
  version: 1;
  kind: "symmetry";
  width: 800;
  height: 800;
  mode: SymmetryMode;
  brush: CreativeBrush;
  strokes: SymmetryStroke[];
}
export interface PixelFrame { id: string; pixels: string[] }
export interface PixelProject {
  version: 1;
  kind: "pixel" | "animation";
  size: 16 | 32 | 64;
  frames: PixelFrame[];
  fps: number;
}
export type CreativeProject = SymmetryProject | PixelProject;
export interface CreativeHistory { canUndo: boolean; canRedo: boolean }
export interface CreativePick { color: string; opacity: number }

// A shared boundary for the independent editors; saving belongs to the parent.
export interface CreativeEditorHandle {
  exportPng(): Promise<Blob>;
  exportGif?(): Promise<Blob>;
  exportSpriteSheet?(): Promise<Blob>;
  undo(): void;
  redo(): void;
  cancelActive(): void;
}

export const creativeNames: Record<CreativeKind, string> = {
  symmetry: "对称万花筒",
  pixel: "像素创作",
  animation: "翻页动画",
};
export const creativeKinds: CreativeKind[] = ["symmetry", "pixel", "animation"];
