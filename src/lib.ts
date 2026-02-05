/**
 * Library exports for use as a dependency in other CLIs
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  getAllCredentials,
  getCredentials,
  getActiveName,
  getActiveCredentials,
  addCredentials,
  hasCredentials,
} from './config.js';
import type { Credentials } from './types.js';

export type { Credentials } from './types.js';

export interface CredentialSelection {
  name: string;
  url: string;
  token: string;
  source: 'saved' | 'manual';
}

export interface PromptOptions {
  /** Message to display when prompting */
  message?: string;
  /** Allow manual entry option */
  allowManual?: boolean;
  /** Save manually entered credentials */
  saveManual?: boolean;
  /** Only show the prompt if no active credentials (skip if active exists) */
  useActiveIfAvailable?: boolean;
}

/**
 * Prompts the user to select saved credentials or enter them manually.
 * This is the main function for other CLIs to import and use.
 * 
 * @example
 * ```typescript
 * import { promptForCredentials } from 'directus-auth-manager';
 * 
 * const creds = await promptForCredentials();
 * console.log(creds.url, creds.token);
 * ```
 */
export async function promptForCredentials(
  options: PromptOptions = {}
): Promise<CredentialSelection> {
  const {
    message = 'Select Directus credentials:',
    allowManual = true,
    saveManual = true,
    useActiveIfAvailable = false,
  } = options;

  // If useActiveIfAvailable is true and we have active credentials, return them
  if (useActiveIfAvailable) {
    const active = getActiveCredentials();
    if (active) {
      return {
        name: active.name,
        url: active.credentials.url,
        token: active.credentials.token,
        source: 'saved',
      };
    }
  }

  const savedCreds = getAllCredentials();
  const savedNames = Object.keys(savedCreds);
  const activeName = getActiveName();

  // If no saved credentials and manual is allowed, go straight to manual entry
  if (savedNames.length === 0 && allowManual) {
    console.log(chalk.dim('No saved credentials found. Please enter credentials manually.\n'));
    return promptManualEntry(saveManual);
  }

  // If no saved credentials and manual is not allowed, throw error
  if (savedNames.length === 0) {
    throw new Error('No saved credentials available. Run "directus-auth" to add credentials.');
  }

  // Build choices
  const choices: Array<{ name: string; value: string } | inquirer.Separator> = savedNames.map(
    (name) => ({
      name: name === activeName ? `${name} ${chalk.green('(active)')}` : name,
      value: name,
    })
  );

  if (allowManual) {
    choices.push(new inquirer.Separator());
    choices.push({ name: chalk.cyan('Enter credentials manually...'), value: '__manual__' });
  }

  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message,
      choices,
    },
  ]);

  if (selected === '__manual__') {
    return promptManualEntry(saveManual);
  }

  const creds = savedCreds[selected];
  return {
    name: selected,
    url: creds.url,
    token: creds.token,
    source: 'saved',
  };
}

/**
 * Prompts for manual credential entry
 */
async function promptManualEntry(save: boolean): Promise<CredentialSelection> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Directus server URL:',
      validate: (input: string) => {
        if (!input.trim()) return 'URL is required';
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
    {
      type: 'password',
      name: 'token',
      message: 'Static access token:',
      mask: '*',
      validate: (input: string) => {
        if (!input.trim()) return 'Token is required';
        return true;
      },
    },
  ]);

  let name = 'manual';

  if (save) {
    const { shouldSave } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldSave',
        message: 'Save these credentials for future use?',
        default: true,
      },
    ]);

    if (shouldSave) {
      const { credName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'credName',
          message: 'Name for these credentials:',
          default: new URL(answers.url).hostname.split('.')[0],
          validate: (input: string) => {
            if (!input.trim()) return 'Name is required';
            if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
              return 'Name can only contain letters, numbers, underscores, and hyphens';
            }
            return true;
          },
        },
      ]);

      name = credName;

      if (hasCredentials(name)) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `Credentials "${name}" already exist. Overwrite?`,
            default: false,
          },
        ]);

        if (overwrite) {
          addCredentials(name, { url: answers.url, token: answers.token });
          console.log(chalk.green(`✓ Credentials saved as "${name}"`));
        }
      } else {
        addCredentials(name, { url: answers.url, token: answers.token });
        console.log(chalk.green(`✓ Credentials saved as "${name}"`));
      }
    }
  }

  return {
    name,
    url: answers.url,
    token: answers.token,
    source: 'manual',
  };
}

/**
 * Gets the active credentials without prompting.
 * Returns null if no active credentials are set.
 * 
 * @example
 * ```typescript
 * import { getActive } from 'directus-auth-manager';
 * 
 * const creds = getActive();
 * if (creds) {
 *   console.log(creds.url, creds.token);
 * }
 * ```
 */
export function getActive(): CredentialSelection | null {
  const active = getActiveCredentials();
  if (!active) return null;

  return {
    name: active.name,
    url: active.credentials.url,
    token: active.credentials.token,
    source: 'saved',
  };
}

/**
 * Gets credentials by name without prompting.
 * Returns null if the named credentials don't exist.
 */
export function getByName(name: string): CredentialSelection | null {
  const creds = getCredentials(name);
  if (!creds) return null;

  return {
    name,
    url: creds.url,
    token: creds.token,
    source: 'saved',
  };
}

/**
 * Lists all saved credential names.
 */
export function listSaved(): string[] {
  return Object.keys(getAllCredentials());
}

// Re-export validation functions
export { validateCredentials, validateAllCredentials } from './validator.js';
