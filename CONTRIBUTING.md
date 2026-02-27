# Contributing

Contributions are always welcome, no matter how large or small!

We want this community to be friendly and respectful to each other. Please follow it in all your interactions with the project. Before contributing, please read the [code of conduct](./CODE_OF_CONDUCT.md).

## Development workflow

To get started with the project, run `pnpm install` in the root directory to install the required dependencies for each package:

```sh
pnpm install
```

> While it's possible to use [`npm`](https://github.com/npm/cli), the tooling is built around [`pnpm`](https://pnpm.io/), so you'll have an easier time if you use `pnpm` for development.

While developing, you can run the [example app](/example/) to test your changes.

To have package changes automatically reflected in the example app, run the package build watcher and Expo together:

```sh
pnpm dev
```

This runs `rollup -w` for `packages/react-native-boost` and `expo start` for `apps/example` in parallel.

If you change native code, you'll still need to rebuild the example app.

To start only the example app packager:

```sh
pnpm example start
```

To run the example app on Android:

```sh
pnpm example android
```

To run the example app on iOS:

```sh
pnpm example ios
```

Make sure your code passes TypeScript and Oxlint. Run the following to verify:

```sh
pnpm typecheck
pnpm lint
```

To fix formatting errors, run the following:

```sh
pnpm lint -- --fix
```

Remember to add tests for your change if possible. Run the unit tests by:

```sh
pnpm test
```

### Commit message convention

We follow the [conventional commits specification](https://www.conventionalcommits.org/en) for our commit messages:

- `fix`: bug fixes, e.g. fix crash due to deprecated method.
- `feat`: new features, e.g. add new method to the module.
- `refactor`: code refactor, e.g. migrate from class components to hooks.
- `docs`: changes into documentation, e.g. add usage example for the module..
- `test`: adding or updating tests, e.g. add integration tests using detox.
- `chore`: tooling changes, e.g. change CI config.

Our pre-commit hooks verify that your commit message matches this format when committing.

### Linting and tests

[Oxlint](https://oxc.rs/docs/guide/usage/linter), [Oxfmt](https://oxc.rs/docs/guide/usage/formatter), [TypeScript](https://www.typescriptlang.org/)

We use [TypeScript](https://www.typescriptlang.org/) for type checking, and [Oxlint](https://oxc.rs/docs/guide/usage/linter) with [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) for linting and formatting the code.

Our pre-commit hooks verify that the linter and tests pass when committing.

### Publishing to npm

We use [release-it](https://github.com/release-it/release-it) to make it easier to publish new versions. It handles common tasks like bumping version based on semver, creating tags and releases etc.

To publish new versions, run the following:

```sh
pnpm package release
```

### Scripts

The `package.json` file contains various scripts for common tasks:

- `pnpm install`: install all workspace dependencies.
- `pnpm typecheck`: type-check files with TypeScript.
- `pnpm lint`: lint files with Oxlint.
- `pnpm example start`: start the Metro server for the example app.
- `pnpm dev`: start the example app and watch/rebuild `react-native-boost` package changes.
- `pnpm example android`: run the example app on Android.
- `pnpm example ios`: run the example app on iOS.

### Sending a pull request

> **Working on your first pull request?** You can learn how from this _free_ series: [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

When you're sending a pull request:

- Prefer small pull requests focused on one change.
- Verify that linters and tests are passing.
- Review the documentation to make sure it looks good.
- Follow the pull request template when opening a pull request.
- For pull requests that change the API or implementation, discuss with maintainers first by opening an issue.
