export type FilmViewport = { width: number; height: number };

/** Preserve the initial card; finish at 7/8 former expanded width and 5/16 height. */
export function getFilmWindowLayout(viewport: FilmViewport, expansion: number) {
  const progress = Math.min(1, Math.max(0, expansion));
  const mobile = viewport.width <= 820;
  const aspect = viewport.width <= 600 ? 1 : mobile ? 1.35 : 2.1;
  const headingHeight = Math.min(60, Math.max(32, viewport.width * .04)) * 1.12;
  const headingTop = viewport.height < 420 ? 20 : mobile ? 48 : 44;
  const frameTop = headingTop + headingHeight + (mobile ? 18 : 24);
  const horizontalMargin = mobile ? 12 : Math.max(24, Math.min(48, viewport.width * .025));
  const scaleLimit = 1.08;
  const maxHeight = Math.max(1, viewport.height - frameTop - 24);
  const initialWidth = Math.max(1, Math.min(
    viewport.width * (mobile ? .92 : .88),
    mobile ? 760 : 1440,
    (viewport.width - 2 * horizontalMargin) / scaleLimit,
    maxHeight * aspect / scaleLimit,
  ));
  const formerExpandedWidth = initialWidth * scaleLimit;
  const formerExpandedHeight = formerExpandedWidth / aspect;
  const finalWidth = formerExpandedWidth * 7 / 8;
  const finalHeight = formerExpandedHeight * 5 / 16;
  const width = initialWidth + (finalWidth - initialWidth) * progress;
  const height = initialWidth / aspect + (finalHeight - initialWidth / aspect) * progress;

  return { width, height, top: frameTop + height / 2, headingTop };
}

/** Reserve only the short active animation plus the actual card height. */
export function getFilmSceneLayout(viewport: FilmViewport, expansion = 0) {
  const end = getFilmWindowLayout(viewport, expansion);
  const stickyHeight = Math.ceil(end.top + end.height / 2) + 12;
  const scrollDistance = viewport.width <= 820 ? 80 : 120;
  return { stickyHeight, scrollDistance, height: stickyHeight + scrollDistance };
}
/** Show the mascot first, enlarge it, then crossfade to moving type. */
export function getFilmSequence(scrollProgress: number) {
  const progress = Math.min(1, Math.max(0, scrollProgress));
  const smoothstep = (value: number) => value * value * (3 - 2 * value);
  const expansion = smoothstep(Math.min(1, progress / .5));
  const letters = smoothstep(Math.min(1, Math.max(0, (progress - .5) / .4)));
  return { expansion, letters, mascot: 1 - letters };
}
