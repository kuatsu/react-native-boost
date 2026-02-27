import Link from 'next/link';
import { Rocket, ShieldCheck, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col justify-start gap-5 px-4 py-6 md:min-h-[90vh] md:justify-center md:py-10">
      <section className="rounded-2xl border border-fd-border bg-linear-to-br from-fd-primary/15 via-fd-background to-fd-background p-6 md:p-8">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-fd-primary/12 px-3 py-1 text-sm font-medium text-fd-primary">
          <Rocket className="size-4" />
          React Native Boost
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Improve your app performance with one line of code.
        </h1>
        <p className="mt-3 max-w-3xl text-fd-muted-foreground md:text-base">
          A Babel plugin that replaces analyzes your code and performs safe optimizations to reduce unnecessary runtime
          overhead in React Native apps.
        </p>

        <div className="mt-5 flex items-center">
          <Link
            href="/docs"
            className="inline-flex items-center rounded-xl bg-fd-primary px-5 py-2.5 text-base font-medium text-fd-primary-foreground transition-colors hover:opacity-90">
            Read docs
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-fd-border bg-fd-card p-4">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <Zap className="size-4 text-fd-primary" />
            Faster renders
          </p>
          <p className="text-sm text-fd-muted-foreground">
            Removes runtime overhead from wrapper components to improve UI-heavy screens.
          </p>
        </article>
        <article className="rounded-xl border border-fd-border bg-fd-card p-4">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-fd-primary" />
            Safety first
          </p>
          <p className="text-sm text-fd-muted-foreground">
            Conservative analysis skips uncertain optimizations to reduce behavioral risk.
          </p>
        </article>
        <article className="rounded-xl border border-fd-border bg-fd-card p-4">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <Rocket className="size-4 text-fd-primary" />
            Minimal setup
          </p>
          <p className="text-sm text-fd-muted-foreground">
            Install, add the Babel plugin, get instant improvements. No code changes required.
          </p>
        </article>
      </section>
    </div>
  );
}
