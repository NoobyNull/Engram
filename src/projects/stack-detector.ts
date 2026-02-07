import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '../shared/logger.js';

const log = createLogger('stack-detector');

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** Known framework/library indicators found in package.json dependencies. */
const NPM_FRAMEWORK_INDICATORS: Record<string, string> = {
  react: 'React',
  'react-dom': 'React',
  vue: 'Vue',
  '@angular/core': 'Angular',
  svelte: 'Svelte',
  next: 'Next.js',
  nuxt: 'Nuxt',
  express: 'Express',
  fastify: 'Fastify',
  '@nestjs/core': 'NestJS',
  koa: 'Koa',
  hono: 'Hono',
  tailwindcss: 'Tailwind CSS',
  prisma: 'Prisma',
  drizzle: 'Drizzle',
  electron: 'Electron',
  'react-native': 'React Native',
  jest: 'Jest',
  vitest: 'Vitest',
  mocha: 'Mocha',
  webpack: 'Webpack',
  vite: 'Vite',
  esbuild: 'esbuild',
  rollup: 'Rollup',
};

/**
 * Detects the tech stack of a project by scanning for indicator files
 * and reading dependency manifests at the given project root.
 *
 * Returns a deduplicated, sorted array of technology names.
 */
export function detectStack(projectRoot: string): string[] {
  const stack = new Set<string>();

  try {
    // --- Node / JavaScript / TypeScript ---
    if (fileExists(projectRoot, 'package.json')) {
      stack.add('Node.js');
      detectNpmFrameworks(projectRoot, stack);
    }

    if (fileExists(projectRoot, 'tsconfig.json')) {
      stack.add('TypeScript');
    }

    // --- Rust ---
    if (fileExists(projectRoot, 'Cargo.toml')) {
      stack.add('Rust');
    }

    // --- Python ---
    if (fileExists(projectRoot, 'requirements.txt') || fileExists(projectRoot, 'pyproject.toml')) {
      stack.add('Python');
    }
    if (fileExists(projectRoot, 'setup.py')) {
      stack.add('Python');
    }

    // --- Go ---
    if (fileExists(projectRoot, 'go.mod')) {
      stack.add('Go');
    }

    // --- Java ---
    if (fileExists(projectRoot, 'pom.xml')) {
      stack.add('Java');
      stack.add('Maven');
    }
    if (fileExists(projectRoot, 'build.gradle') || fileExists(projectRoot, 'build.gradle.kts')) {
      stack.add('Java');
      stack.add('Gradle');
    }

    // --- Docker ---
    if (fileExists(projectRoot, 'Dockerfile') || fileExists(projectRoot, 'docker-compose.yml') || fileExists(projectRoot, 'docker-compose.yaml')) {
      stack.add('Docker');
    }

    // --- CI/CD ---
    if (dirExists(projectRoot, '.github', 'workflows')) {
      stack.add('GitHub Actions');
    }

    // --- .NET ---
    if (hasFileWithExtension(projectRoot, '.csproj') || hasFileWithExtension(projectRoot, '.sln')) {
      stack.add('.NET');
    }

  } catch (err) {
    log.warn('Error during stack detection', { projectRoot, error: String(err) });
  }

  const result = Array.from(stack).sort();
  log.debug('Detected stack', { projectRoot, stack: result });
  return result;
}

/**
 * Reads package.json and checks dependencies against known framework indicators.
 */
function detectNpmFrameworks(projectRoot: string, stack: Set<string>): void {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg: PackageJson = JSON.parse(raw);

    const allDeps: Record<string, string> = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    for (const dep of Object.keys(allDeps)) {
      const framework = NPM_FRAMEWORK_INDICATORS[dep];
      if (framework) {
        stack.add(framework);
      }
    }
  } catch (err) {
    log.debug('Could not read package.json for framework detection', { error: String(err) });
  }
}

/** Returns true if a file exists at `path.join(root, ...segments)`. */
function fileExists(root: string, ...segments: string[]): boolean {
  try {
    const fullPath = path.join(root, ...segments);
    return fs.statSync(fullPath).isFile();
  } catch {
    return false;
  }
}

/** Returns true if a directory exists at `path.join(root, ...segments)`. */
function dirExists(root: string, ...segments: string[]): boolean {
  try {
    const fullPath = path.join(root, ...segments);
    return fs.statSync(fullPath).isDirectory();
  } catch {
    return false;
  }
}

/** Returns true if the root directory contains at least one file with the given extension. */
function hasFileWithExtension(root: string, ext: string): boolean {
  try {
    const entries = fs.readdirSync(root);
    return entries.some((entry) => entry.endsWith(ext));
  } catch {
    return false;
  }
}
