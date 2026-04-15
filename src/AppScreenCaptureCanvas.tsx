import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { CaptureMode } from "./state";
import { useDialog } from "./comps/utils/useDialog";
import { normalizeToBytes } from "./utils";

export type ScreenCaptureImage = {
  path?: string;
  buffer?: ArrayBuffer;
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

type Props = {
  image: ScreenCaptureImage | null | undefined;
  className?: string;
  mode: CaptureMode;
};

export type ScreenCaptureCanvasHandle = {
  getBlobFromCanvas: (
    type?: string,
    quality?: number
  ) => Promise<Blob | null>;
  getImage: () => Promise<HTMLImageElement | null>;
};

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision mediump float;

uniform sampler2D uTexture;
uniform float uMode;
varying vec2 vUv;

vec3 applyLightness(vec3 c) {
  float gray = dot(c, vec3(0.299, 0.587, 0.114));
  return vec3(gray);
}

vec3 applyProtan(vec3 c) {
  mat3 m = mat3(
    0.152, 1.053, -0.205,
    0.115, 0.786,  0.099,
   -0.004, -0.048, 1.052
  );
  return clamp(m * c, 0.0, 1.0);
}

vec3 applyDeutan(vec3 c) {
  mat3 m = mat3(
    0.367, 0.861, -0.228,
    0.280, 0.673,  0.047,
   -0.012, 0.043,  0.969
  );
  return clamp(m * c, 0.0, 1.0);
}

vec3 applyTritan(vec3 c) {
  mat3 m = mat3(
    1.255, -0.076, -0.179,
   -0.078,  0.931,  0.148,
    0.005,  0.691,  0.304
  );
  return clamp(m * c, 0.0, 1.0);
}

void main() {
  vec4 color = texture2D(uTexture, vUv);
  vec3 rgb = color.rgb;

  if (uMode < 0.5) {
  } else if (uMode < 1.5) {
    rgb = applyLightness(rgb);
  } else if (uMode < 2.5) {
    rgb = applyProtan(rgb);
  } else if (uMode < 3.5) {
    rgb = applyDeutan(rgb);
  } else {
    rgb = applyTritan(rgb);
  }

  gl_FragColor = vec4(rgb, color.a);

  #include <colorspace_fragment>
}
`;

const modeToInt = (mode: CaptureMode): number => {
  switch (mode) {
    case "lightness":
      return 1;
    case "protan":
      return 2;
    case "deutan":
      return 3;
    case "tritan":
      return 4;
    case "none":
    default:
      return 0;
  }
};

const ScreenCaptureCanvas = forwardRef<ScreenCaptureCanvasHandle, Props>(
  function ScreenCaptureCanvas({ image, mode, className }, ref) {
    const rootRef = useRef<HTMLDivElement | null>(null);

    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const materialRef = useRef<THREE.ShaderMaterial | null>(null);
    const textureRef = useRef<THREE.Texture | null>(null);
    const geometryRef = useRef<THREE.PlaneGeometry | null>(null);
    const meshRef = useRef<THREE.Mesh | null>(null);
    const blobUrlRef = useRef<string | null>(null);

    const dialog = useDialog();

    const showError = (title: string, body: string) => {
      console.error(title, body);
      dialog.showConfirmDialog({
        title,
        body,
      });
    };

    const renderNow = () => {
      try {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
          return;
        }
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      } catch (e) {
        console.log(e);
        showError(
          "render error",
          e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e)
        );
      }
    };

    const getBlobFromCanvas = async (
      type = "image/png",
      quality?: number
    ): Promise<Blob | null> => {
      const canvas = rendererRef.current?.domElement;
      if (!canvas) return null;

      renderNow();

      return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality);
      });
    };

    const getImage = async (): Promise<HTMLImageElement | null> => {
      const blob = await getBlobFromCanvas();
      if (!blob) return null;

      const url = URL.createObjectURL(blob);

      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        img.src = url;
      });
    };

    useImperativeHandle(
      ref,
      () => ({
        getBlobFromCanvas,
        getImage,
      }),
      []
    );

    useEffect(() => {
      try {
        const root = rootRef.current;
        if (!root || !image) return;

        let disposed = false;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
        });
        renderer.debug.checkShaderErrors = true;
        renderer.debug.onShaderError = (
          gl,
          program,
          glVertexShader,
          glFragmentShader
        ) => {
          const programLog = gl.getProgramInfoLog(program) || "";
          const vertexLog = gl.getShaderInfoLog(glVertexShader) || "";
          const fragmentLog = gl.getShaderInfoLog(glFragmentShader) || "";

          showError(
            "shader error",
            [
              "Program Log:",
              programLog,
              "",
              "Vertex Shader Log:",
              vertexLog,
              "",
              "Fragment Shader Log:",
              fragmentLog,
            ].join("\n")
          );
        };

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        root.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const camera = new THREE.OrthographicCamera(
          0,
          image.sourceWidth,
          image.sourceHeight,
          0,
          -1000,
          1000
        );
        camera.position.z = 1;
        cameraRef.current = camera;

        const geometry = new THREE.PlaneGeometry(1, 1);
        geometryRef.current = geometry;

        const material = new THREE.ShaderMaterial({
          uniforms: {
            uTexture: { value: null },
            uMode: { value: Number(modeToInt(mode)) },
          },
          vertexShader,
          fragmentShader,
          transparent: true,
        });
        materialRef.current = material;

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          image.cropX + image.cropWidth / 2,
          image.sourceHeight - image.cropY - image.cropHeight / 2,
          0
        );
        mesh.scale.set(image.cropWidth, image.cropHeight, 1);
        scene.add(mesh);
        meshRef.current = mesh;

        const updateRendererSize = () => {
          if (!rootRef.current || !rendererRef.current || !cameraRef.current || !image) {
            return;
          }

          const w = rootRef.current.clientWidth || 1;
          const h = rootRef.current.clientHeight || 1;
          rendererRef.current.setSize(w, h);

          const sourceAspect = image.sourceWidth / image.sourceHeight;
          const rootAspect = w / h;

          if (rootAspect > sourceAspect) {
            const viewWidth = image.sourceHeight * rootAspect;
            cameraRef.current.left = 0;
            cameraRef.current.right = viewWidth;
            cameraRef.current.top = image.sourceHeight;
            cameraRef.current.bottom = 0;
          } else {
            const viewHeight = image.sourceWidth / rootAspect;
            cameraRef.current.left = 0;
            cameraRef.current.right = image.sourceWidth;
            cameraRef.current.top = viewHeight;
            cameraRef.current.bottom = 0;
          }

          cameraRef.current.updateProjectionMatrix();
          renderNow();
        };

        const bytes = normalizeToBytes(image.buffer);
        const blob = new Blob([bytes as BlobPart], { type: "image/png" });
        const imageUrl = URL.createObjectURL(blob);
        blobUrlRef.current = imageUrl;

        createImageBitmap(blob, {
          imageOrientation: "flipY",
        })
          .then((bitmap) => {
            if (disposed) {
              bitmap.close();
              return;
            }

            const texture = new THREE.Texture(bitmap);
            texture.flipY = false;
            texture.needsUpdate = true;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            texture.colorSpace = THREE.SRGBColorSpace;

            textureRef.current = texture;

            if (materialRef.current) {
              materialRef.current.uniforms.uTexture.value = texture;
            }

            updateRendererSize();
          })
          .catch((e) => {
            showError(
              "image decode error",
              e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e)
            );
          });

        const onResize = () => updateRendererSize();
        window.addEventListener("resize", onResize);

        return () => {
          disposed = true;
          window.removeEventListener("resize", onResize);

          if (meshRef.current && sceneRef.current) {
            sceneRef.current.remove(meshRef.current);
          }

          textureRef.current?.dispose();
          geometryRef.current?.dispose();
          materialRef.current?.dispose();
          rendererRef.current?.dispose();

          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
          }

          if (renderer.domElement.parentNode === root) {
            root.removeChild(renderer.domElement);
          }

          textureRef.current = null;
          geometryRef.current = null;
          materialRef.current = null;
          meshRef.current = null;
          cameraRef.current = null;
          sceneRef.current = null;
          rendererRef.current = null;
        };
      } catch (e) {
        dialog.showConfirmDialog({
          title: "error",
          body: `${e}`,
        });
      }
    }, [image]);

    useEffect(() => {
      if (!materialRef.current) return;

      materialRef.current.uniforms.uMode.value = Number(modeToInt(mode));
      renderNow();
    }, [mode]);

    return (
      <div
        ref={rootRef}
        className={className ?? "fixed inset-0 z-0 select-none w-full h-full"}
      />
    );
  }
);

export default ScreenCaptureCanvas;