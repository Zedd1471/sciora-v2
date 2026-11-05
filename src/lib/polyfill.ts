/**
 * Polyfill browser-only canvas/geometry globals for Node.js / Vercel Serverless runtimes.
 * Prevents `ReferenceError: DOMMatrix is not defined` when libraries (such as pdfjs-dist)
 * load in server-side environments.
 */

if (typeof globalThis.DOMMatrix === "undefined") {
  class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    multiply() { return this; }
    inverse() { return this; }
    transformPoint(point?: { x?: number; y?: number }) {
      return { x: point?.x || 0, y: point?.y || 0, z: 0, w: 1 };
    }
  }
  (globalThis as any).DOMMatrix = DOMMatrix;
  (globalThis as any).DOMMatrixReadOnly = DOMMatrix;
}

if (typeof globalThis.Path2D === "undefined") {
  class Path2D {
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
  }
  (globalThis as any).Path2D = Path2D;
}

if (typeof globalThis.ImageData === "undefined") {
  class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
      this.data = new Uint8ClampedArray(w * h * 4);
    }
  }
  (globalThis as any).ImageData = ImageData;
}

export {};

