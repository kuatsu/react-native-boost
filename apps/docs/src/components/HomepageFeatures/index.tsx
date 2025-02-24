import type { ReactNode } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';
import OptionsSvg from '@site/static/img/undraw_options.svg';
import SecureSvg from '@site/static/img/undraw_secure.svg';
import SuperWomanSvg from '@site/static/img/undraw_super_woman.svg';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Lightning Fast Optimization',
    Svg: SuperWomanSvg,
    description: (
      <>
        React Native Boost analyzes your source code to detect and apply micro-optimizations. By replacing redundant
        wrapper components with their native counterparts, it flattens the component tree and drastically improves
        render times.
      </>
    ),
  },
  {
    title: 'Safety-First Enhancements',
    Svg: SecureSvg,
    description: (
      <>
        Only safe optimizations that won't break your code are applied. With built-in safeguards and the ability to skip
        optimization on specific files or even single components, you can boost performance without compromising
        reliability.
      </>
    ),
  },
  {
    title: 'Seamless Configuration',
    Svg: OptionsSvg,
    description: (
      <>
        Integrating React Native Boost requires just one line in your Babel config. Whether using plain React Native or
        Expo, it fits seamlessly into your workflow. Flexible configuration options let you fine-tune behavior by
        ignoring paths or disabling optimizations.
      </>
    ),
  },
];

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, index) => (
            <Feature key={index} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
