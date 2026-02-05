import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import type { Config, Credentials } from './types.js';

export const CONFIG_DIR = join(homedir(), '.config', 'directus-auth-manager');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Ensures the config directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Gets the default empty config
 */
function getDefaultConfig(): Config {
  return {
    active: null,
    credentials: {},
  };
}

/**
 * Reads the current config from disk
 */
export function readConfig(): Config {
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    return getDefaultConfig();
  }

  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as Config;
  } catch {
    return getDefaultConfig();
  }
}

/**
 * Writes the config to disk
 */
export function writeConfig(config: Config): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Gets all stored credentials
 */
export function getAllCredentials(): Record<string, Credentials> {
  return readConfig().credentials;
}

/**
 * Gets a specific credential set by name
 */
export function getCredentials(name: string): Credentials | null {
  const config = readConfig();
  return config.credentials[name] || null;
}

/**
 * Adds or updates a credential set
 */
export function addCredentials(name: string, credentials: Credentials): void {
  const config = readConfig();
  config.credentials[name] = credentials;

  // If this is the first credential, set it as active
  if (Object.keys(config.credentials).length === 1) {
    config.active = name;
  }

  writeConfig(config);
}

/**
 * Removes a credential set by name
 */
export function removeCredentials(name: string): boolean {
  const config = readConfig();

  if (!config.credentials[name]) {
    return false;
  }

  delete config.credentials[name];

  // If the removed credential was active, clear the active setting
  if (config.active === name) {
    const remaining = Object.keys(config.credentials);
    config.active = remaining.length > 0 ? remaining[0] : null;
  }

  writeConfig(config);
  return true;
}

/**
 * Sets the active credential set
 */
export function setActive(name: string): boolean {
  const config = readConfig();

  if (!config.credentials[name]) {
    return false;
  }

  config.active = name;
  writeConfig(config);
  return true;
}

/**
 * Gets the currently active credential name
 */
export function getActiveName(): string | null {
  return readConfig().active;
}

/**
 * Gets the currently active credentials
 */
export function getActiveCredentials(): { name: string; credentials: Credentials } | null {
  const config = readConfig();

  if (!config.active || !config.credentials[config.active]) {
    return null;
  }

  return {
    name: config.active,
    credentials: config.credentials[config.active],
  };
}

/**
 * Checks if a credential set exists
 */
export function hasCredentials(name: string): boolean {
  const config = readConfig();
  return name in config.credentials;
}
