import { useEffect, useRef } from "react";
import * as THREE from "three";
import { convertFileSrc } from "@tauri-apps/api/core";

export type ScreenCaptureImage = {
  path: string;
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

type Props = {
  image: ScreenCaptureImage | null;
  className?: string;
};

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform sampler2D uTexture;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(uTexture, vUv);
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(vec3(gray), color.a);
}
`;

export default function ScreenCaptureCanvas({ image, className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !image) return;

    let disposed = false;
    let texture: THREE.Texture | null = null;

    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    root.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(
      0,
      image.sourceWidth,
      image.sourceHeight,
      0,
      -1000,
      1000
    );
    camera.position.z = 1;

    const geometry = new THREE.PlaneGeometry(1, 1);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: null },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    mesh.position.set(
      image.cropX + image.cropWidth / 2,
      image.cropY + image.cropHeight / 2,
      0
    );
    mesh.scale.set(image.cropWidth, image.cropHeight, 1);

    const updateRendererSize = () => {
      const w = root.clientWidth || 1;
      const h = root.clientHeight || 1;
      renderer.setSize(w, h);

      const sourceAspect = image.sourceWidth / image.sourceHeight;
      const rootAspect = w / h;

      if (rootAspect > sourceAspect) {
        const viewWidth = image.sourceHeight * rootAspect;
        camera.left = 0;
        camera.right = viewWidth;
        camera.top = image.sourceHeight;
        camera.bottom = 0;
      } else {
        const viewHeight = image.sourceWidth / rootAspect;
        camera.left = 0;
        camera.right = image.sourceWidth;
        camera.top = viewHeight;
        camera.bottom = 0;
      }

      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const loader = new THREE.TextureLoader();
    loader.load(
      convertFileSrc(image.path),
      (loadedTexture) => {
        if (disposed) {
          loadedTexture.dispose();
          return;
        }

        texture = loadedTexture;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = THREE.SRGBColorSpace;

        material.uniforms.uTexture.value = texture;
        updateRendererSize();
      },
      undefined,
      (err) => {
        console.error(err);
      }
    );

    const onResize = () => updateRendererSize();
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      texture?.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === root) {
        root.removeChild(renderer.domElement);
      }
    };
  }, [image]);

  return (<div ref={rootRef} className={className ?? "w-full h-full"} ></div>);
}