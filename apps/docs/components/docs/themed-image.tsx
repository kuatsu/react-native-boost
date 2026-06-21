import { Image } from 'fumadocs-core/framework';
import type { StaticImageData } from 'next/image';
import type { ReactElement } from 'react';

type Props = {
  light: StaticImageData;
  dark: StaticImageData;
  alt: string;
};

/**
 * Renders both theme variants of an image and lets CSS reveal the one matching the active docs theme
 * (the `.dark` class fumadocs sets on `<html>`). We swap on that class rather than a `<picture>` with
 * `prefers-color-scheme` because the docs theme is a user toggle independent of the OS color scheme.
 */
export function ThemedImage({ light, dark, alt }: Props): ReactElement {
  return (
    <>
      <Image src={light} alt={alt} className="rounded-lg dark:hidden" />
      <Image src={dark} alt={alt} className="hidden rounded-lg dark:block" />
    </>
  );
}
