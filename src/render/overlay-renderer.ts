import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import type { InsectRig } from "../insects/types";

export class OverlayRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: OrthographicCamera;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.camera = new OrthographicCamera(-1, 1, 1, -1, -200, 200);
    this.camera.position.set(0, 0, 80);

    const hemi = new HemisphereLight(0xfff1dd, 0x3a2a1c, 1.05);
    this.scene.add(hemi);
    const key = new DirectionalLight(0xfff6e8, 1.35);
    key.position.set(-40, 80, 60);
    this.scene.add(key);
    const rim = new DirectionalLight(0x9ecbff, 0.35);
    rim.position.set(-50, -20, 40);
    this.scene.add(rim);
    const fill = new AmbientLight(new Color("#ffd8b0"), 0.22);
    this.scene.add(fill);
  }

  attach(rig: InsectRig): void {
    this.scene.add(rig.group);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
