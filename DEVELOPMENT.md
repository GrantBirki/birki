# Development Server Issue and Workaround

## Issue
Due to the security fix for webpack-dev-server (upgraded to 5.2.1 to resolve CVE), the development server (`npm start`) is incompatible with react-scripts@5.0.1 due to API changes in webpack-dev-server 5.x.

## Security Fix
The security vulnerability (webpack-dev-server <= 5.2.0) allowed source code theft when accessing malicious websites with non-Chromium browsers during development. This has been resolved by forcing webpack-dev-server@5.2.1 via npm overrides.

## Production Build
✅ **The production build (`npm run build`) works perfectly and is secure.**

## Development Workaround
If you need to run the development server, you have a few options:

### Option 1: Use a static server for development
```bash
# Build the project
npm run build

# Serve the build directory
npx serve -s build -p 3000
```

### Option 2: Temporarily downgrade for development only
```bash
# Only do this in a separate branch for development
npm install webpack-dev-server@4.15.2 --save-dev --legacy-peer-deps
npm start
# Then remove before committing
```

### Option 3: Use the production build workflow
The production build is fast and can be used for most development needs:
```bash
npm run build && npx serve -s build -p 3000
```

## Security Note
The webpack-dev-server vulnerability only affects the development environment and does not impact the production deployment, which remains fully secure.