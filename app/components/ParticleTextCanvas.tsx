"use client";

import { useEffect, useRef } from "react";

type ParticleTextCanvasProps = {
  progress?: number;
};

type Particle = {
  tx: number;
  ty: number;
  seed: number;
  glyphIndex: number;
};

const WORD = "UESTC AI";
const LETTERS = "UESTCAI";

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp(value), 3);
}

function createParticles(width: number, height: number, image: HTMLImageElement) {
  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const context = mask.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  const inset = Math.round(width * .04);
  context.drawImage(image, inset, inset, width - inset * 2, height - inset * 2);
  const pixels = context.getImageData(0, 0, width, height).data;
  const spacing = Math.max(7, Math.round(width / 90));
  const particles: Particle[] = [];
  let index = 0;
  for (let y = spacing; y < height - spacing; y += spacing) {
    for (let x = spacing; x < width - spacing; x += spacing) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha < 110 || ((x / spacing + y / spacing) % 3 === 0)) continue;
      const seed = ((x * 13 + y * 7) % 997) / 997;
      particles.push({ tx: x / width, ty: y / height, seed, glyphIndex: index++ % LETTERS.length });
    }
  }
  return particles;
}
export function ParticleTextCanvas({ progress = 1 }: ParticleTextCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    progressRef.current = progress;
    redrawRef.current?.();
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const field = document.createElement("canvas");
    const fieldContext = field.getContext("2d");
    if (!fieldContext) return;
    let particles: Particle[] = [];
    const maskImage = new window.Image();
    let frame = 0;
    let lastFrame = 0;
    let active = false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let fieldPhase = -1;

    const paintField = (phase: number) => {
      fieldPhase = phase;
      fieldContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      const background = fieldContext.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, "#dce6ce");
      background.addColorStop(.58, "#f3ecdd");
      background.addColorStop(1, "#dce8dc");
      fieldContext.fillStyle = background;
      fieldContext.fillRect(0, 0, width, height);
      const light = fieldContext.createRadialGradient(width * .78, height * .18, 0, width * .78, height * .18, width * .65);
      light.addColorStop(0, "rgba(255, 255, 255, .2)");
      light.addColorStop(1, "rgba(255, 255, 255, 0)");
      fieldContext.fillStyle = light;
      fieldContext.fillRect(0, 0, width, height);
      fieldContext.font = `${Math.max(7, Math.min(11, width / 145))}px ui-monospace, Consolas, monospace`;
      fieldContext.textAlign = "center";
      fieldContext.textBaseline = "middle";
      const fieldStep = Math.max(12, width / 92);
      const scanRow = phase % (Math.ceil(height / fieldStep) + 6);
      for (let row = 0, y = 10; y < height; y += fieldStep, row += 1) {
        const rowPhase = phase + Math.floor(row * .55);
        const highlight = reducedMotion.matches ? 0 : Math.max(0, 1 - Math.abs(row - scanRow) / 3);
        fieldContext.fillStyle = `rgba(70, 91, 68, ${.3 + highlight * .3})`;
        for (let column = 0, x = 8; x < width; x += fieldStep, column += 1) {
          const glyph = WORD[(column + rowPhase) % WORD.length];
          if (glyph === " ") continue;
          const fall = reducedMotion.matches ? 0 : ((phase + column * 2) % 7) * fieldStep / 10;
          fieldContext.fillText(glyph, x, y + fall);
        }
      }
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(bounds.width));
      const nextHeight = Math.max(1, Math.round(bounds.height));
      const nextDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      if (width === nextWidth && height === nextHeight && dpr === nextDpr) return;
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      canvas.width = field.width = Math.round(width * dpr);
      canvas.height = field.height = Math.round(height * dpr);
      paintField(0);
    };

    const draw = (time: number) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const phase = reducedMotion.matches ? 0 : Math.floor(time / 170);
      if (phase !== fieldPhase) paintField(phase);
      context.drawImage(field, 0, 0, width, height);
      context.font = `${Math.max(7, Math.min(11, width / 145))}px ui-monospace, Consolas, monospace`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = "rgba(88, 116, 80, .65)";
      const formation = easeOutCubic(progressRef.current);
      const mobile = width <= 700;
      const mascotSize = Math.min(width * (mobile ? .92 : .74), height * (mobile ? .72 : .86));
      const mascotCenterY = height * (mobile ? .46 : .48);
      for (const particle of particles) {
        const targetX = width / 2 + (particle.tx - .5) * mascotSize;
        const targetY = mascotCenterY + (particle.ty - .5) * mascotSize;
        const angle = particle.seed * Math.PI * 2;
        const radius = Math.max(width, height) * (.16 + particle.seed * .55);
        const scatteredX = width / 2 + Math.cos(angle) * radius;
        const scatteredY = height / 2 + Math.sin(angle) * radius * .58;
        const breathe = reducedMotion.matches ? 0 : Math.sin(time * .00065 + particle.seed * 12) * 1.8 * formation;
        const x = scatteredX + (targetX - scatteredX) * formation + breathe;
        const y = scatteredY + (targetY - scatteredY) * formation + breathe * .4;
        context.globalAlpha = .18 + formation * (.58 + particle.seed * .22);
        const glyph = LETTERS[(particle.glyphIndex + phase + Math.floor(particle.ty * 9)) % LETTERS.length];
        context.fillText(glyph, x, y);
      }
      context.globalAlpha = 1;
    };

    const animate = (time: number) => {
      frame = window.requestAnimationFrame(animate);
      if (time - lastFrame < 1000 / 30) return;
      lastFrame = time;
      draw(time);
    };
    const syncAnimation = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
      if (!active || document.hidden) return;
      draw(reducedMotion.matches ? 0 : performance.now());
      if (!reducedMotion.matches) frame = window.requestAnimationFrame(animate);
    };
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      active = entry.isIntersecting;
      syncAnimation();
    }, { rootMargin: "100px" });
    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (active) draw(performance.now());
    });
    const loadMask = () => {
      particles = createParticles(640, 640, maskImage);
      if (active) draw(performance.now());
    };
    maskImage.onload = loadMask;
    maskImage.src = "/ai-mascot.webp";
    if (maskImage.complete && maskImage.naturalWidth) loadMask();
    redrawRef.current = () => {
      if (active && reducedMotion.matches) draw(0);
    };
    resize();
    visibilityObserver.observe(canvas);
    resizeObserver.observe(canvas);
    reducedMotion.addEventListener("change", syncAnimation);
    document.addEventListener("visibilitychange", syncAnimation);
    return () => {
      redrawRef.current = null;
      maskImage.onload = null;
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      reducedMotion.removeEventListener("change", syncAnimation);
      document.removeEventListener("visibilitychange", syncAnimation);
      window.cancelAnimationFrame(frame);
    };
  }, []);
  return <canvas ref={canvasRef} className="kinetic-type-backdrop__canvas" aria-hidden="true" />;
}
