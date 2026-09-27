"use client";

import Image from "next/image";
import { ParticleTextCanvas } from "./ParticleTextCanvas";
import "./kinetic-type-backdrop.css";

export function KineticTypeBackdrop({ progress = 1 }: { progress?: number }) {
  return (
    <div className="kinetic-type-backdrop" aria-hidden="true">
      <ParticleTextCanvas progress={progress} />
      <div className="kinetic-type-backdrop__mascot">
        <Image src="/ai-mascot.webp" alt="" fill style={{ objectFit: "contain" }} sizes="(max-width: 700px) 96vw, 920px" unoptimized priority />
      </div>
      <span className="kinetic-type-backdrop__label kinetic-type-backdrop__label--top">UE / AI / 2026</span>
    </div>
  );
}
