# build-cache-warmer

Pre-fetches frequently used npm and pip packages on CI runners so the first build is faster. Works with GitHub Actions, GitLab CI and Buildkite.

```
npm install --save-dev build-cache-warmer
npx build-cache-warmer --plan
```
