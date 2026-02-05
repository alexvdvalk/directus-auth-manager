#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  getAllCredentials,
  getCredentials,
  addCredentials,
  removeCredentials,
  setActive,
  getActiveName,
  getActiveCredentials,
  hasCredentials,
} from './config.js';
import { validateCredentials, validateAllCredentials } from './validator.js';

/**
 * Outputs active credentials as JSON (for other CLI tools)
 */
function outputJson(): void {
  const active = getActiveCredentials();
  
  if (!active) {
    console.error('No active credentials set');
    process.exit(1);
  }
  
  const output = {
    name: active.name,
    url: active.credentials.url,
    token: active.credentials.token,
  };
  
  console.log(JSON.stringify(output));
}

/**
 * Handles CLI arguments before entering interactive mode
 * Returns true if an argument was handled (exit early)
 */
function handleCliArgs(): boolean {
  const args = process.argv.slice(2);
  
  if (args.includes('--json') || args.includes('-j')) {
    outputJson();
    return true;
  }
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${chalk.bold('Directus Auth Manager')}

${chalk.dim('Usage:')}
  directus-auth              Open interactive menu
  directus-auth --json       Output active credentials as JSON
  directus-auth --help       Show this help message

${chalk.dim('JSON Output:')}
  Other CLI tools can get the active credentials:
  
    ${chalk.cyan('directus-auth --json')}
  
  Returns: {"name":"...","url":"...","token":"..."}

${chalk.dim('Examples:')}
  # Get just the URL
  directus-auth --json | jq -r '.url'
  
  # Get just the token
  directus-auth --json | jq -r '.token'
  
  # Use in a curl command
  curl -H "Authorization: Bearer $(directus-auth --json | jq -r '.token')" \\
       "$(directus-auth --json | jq -r '.url')/items/posts"
`);
    return true;
  }
  
  return false;
}

/**
 * Masks a token for display, showing only first and last 4 characters
 */
function maskToken(token: string): string {
  if (token.length <= 12) {
    return '****';
  }
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

/**
 * Displays the header with current active credentials
 */
function displayHeader(): void {
  console.clear();
  console.log(chalk.bold.cyan('\n  Directus Auth Manager\n'));
  
  const active = getActiveCredentials();
  if (active) {
    console.log(chalk.dim(`  Active: ${chalk.green(active.name)} (${active.credentials.url})\n`));
  } else {
    console.log(chalk.dim('  Active: None\n'));
  }
}

/**
 * Pauses and waits for user to press enter
 */
async function pressEnterToContinue(): Promise<void> {
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: chalk.dim('Press Enter to continue...'),
    },
  ]);
}

/**
 * Main menu options
 */
type MenuAction = 'add' | 'remove' | 'list' | 'use' | 'current' | 'validate' | 'validate-all' | 'exit';

/**
 * Displays the main menu and returns the selected action
 */
async function showMainMenu(): Promise<MenuAction> {
  displayHeader();

  const choices = [
    { name: '➕  Add credentials', value: 'add' },
    { name: '📋  List all credentials', value: 'list' },
    { name: '🔄  Switch active credentials', value: 'use' },
    { name: '👁️   View current credentials', value: 'current' },
    { name: '✅  Validate specific credentials', value: 'validate' },
    { name: '✅  Validate all credentials', value: 'validate-all' },
    { name: '🗑️   Remove credentials', value: 'remove' },
    new inquirer.Separator(),
    { name: '🚪  Exit', value: 'exit' },
  ];

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices,
      pageSize: 10,
    },
  ]);

  return action;
}

/**
 * Prompts user to select from existing credentials
 */
async function selectCredentials(message: string): Promise<string | null> {
  const credentials = getAllCredentials();
  const names = Object.keys(credentials);
  const activeName = getActiveName();

  if (names.length === 0) {
    console.log(chalk.yellow('\nNo credentials saved yet.'));
    return null;
  }

  const choices: Array<{ name: string; value: string } | inquirer.Separator> = names.map((name) => ({
    name: name === activeName ? `${name} ${chalk.green('(active)')}` : name,
    value: name,
  }));

  choices.push(new inquirer.Separator());
  choices.push({ name: chalk.dim('Cancel'), value: '__cancel__' });

  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message,
      choices,
    },
  ]);

  return selected === '__cancel__' ? null : selected;
}

/**
 * Add credentials action
 */
async function handleAdd(): Promise<void> {
  console.log(chalk.bold('\n  Add New Credentials\n'));

  const { name } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Credential name (e.g., production, staging):',
      validate: (input: string) => {
        if (!input.trim()) return 'Name is required';
        if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
          return 'Name can only contain letters, numbers, underscores, and hyphens';
        }
        return true;
      },
    },
  ]);

  if (hasCredentials(name)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Credentials "${name}" already exist. Overwrite?`,
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('Operation cancelled.'));
      return;
    }
  }

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

  addCredentials(name, { url: answers.url, token: answers.token });
  console.log(chalk.green(`\n✓ Credentials "${name}" saved successfully.`));

  const activeName = getActiveName();
  if (activeName === name) {
    console.log(chalk.blue('  (set as active)'));
  }
}

/**
 * Remove credentials action
 */
async function handleRemove(): Promise<void> {
  console.log(chalk.bold('\n  Remove Credentials\n'));

  const name = await selectCredentials('Select credentials to remove:');
  if (!name) return;

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to remove "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow('Operation cancelled.'));
    return;
  }

  removeCredentials(name);
  console.log(chalk.green(`\n✓ Credentials "${name}" removed.`));
}

/**
 * List credentials action
 */
async function handleList(): Promise<void> {
  console.log(chalk.bold('\n  Saved Credentials\n'));

  const credentials = getAllCredentials();
  const activeName = getActiveName();
  const names = Object.keys(credentials);

  if (names.length === 0) {
    console.log(chalk.yellow('No credentials saved.'));
    return;
  }

  for (const name of names) {
    const creds = credentials[name];
    const isActive = name === activeName;
    const prefix = isActive ? chalk.green('● ') : '  ';
    const nameDisplay = isActive ? chalk.green.bold(name) : name;
    const activeLabel = isActive ? chalk.green(' (active)') : '';

    console.log(`${prefix}${nameDisplay}${activeLabel}`);
    console.log(chalk.dim(`    URL:   ${creds.url}`));
    console.log(chalk.dim(`    Token: ${maskToken(creds.token)}`));
    console.log();
  }
}

/**
 * Switch active credentials action
 */
async function handleUse(): Promise<void> {
  console.log(chalk.bold('\n  Switch Active Credentials\n'));

  const name = await selectCredentials('Select credentials to activate:');
  if (!name) return;

  setActive(name);
  console.log(chalk.green(`\n✓ Now using "${name}" as active credentials.`));
}

/**
 * View current credentials action
 */
async function handleCurrent(): Promise<void> {
  console.log(chalk.bold('\n  Current Active Credentials\n'));

  const active = getActiveCredentials();

  if (!active) {
    console.log(chalk.yellow('No active credentials set.'));
    return;
  }

  console.log(`  Name:  ${chalk.green.bold(active.name)}`);
  console.log(`  URL:   ${active.credentials.url}`);
  console.log(`  Token: ${maskToken(active.credentials.token)}`);
  console.log();
}

/**
 * Validate specific credentials action
 */
async function handleValidate(): Promise<void> {
  console.log(chalk.bold('\n  Validate Credentials\n'));

  const name = await selectCredentials('Select credentials to validate:');
  if (!name) return;

  const creds = getCredentials(name);
  if (!creds) return;

  console.log(chalk.dim(`\nValidating "${name}"...`));
  const result = await validateCredentials(name, creds);

  if (result.success) {
    console.log(chalk.green(`\n✓ ${name}: Valid`));
    if (result.user) {
      const displayName = [result.user.first_name, result.user.last_name]
        .filter(Boolean)
        .join(' ');
      console.log(chalk.dim(`  User: ${displayName || result.user.email} (${result.user.id})`));
    }
  } else {
    console.log(chalk.red(`\n✗ ${name}: ${result.message}`));
  }
}

/**
 * Validate all credentials action
 */
async function handleValidateAll(): Promise<void> {
  console.log(chalk.bold('\n  Validate All Credentials\n'));

  const allCreds = getAllCredentials();
  const names = Object.keys(allCreds);

  if (names.length === 0) {
    console.log(chalk.yellow('No credentials to validate.'));
    return;
  }

  console.log(chalk.dim(`Validating ${names.length} credential set(s)...\n`));
  const results = await validateAllCredentials(allCreds);

  for (const result of results) {
    if (result.success) {
      console.log(chalk.green(`✓ ${result.name}: Valid`));
      if (result.user) {
        const displayName = [result.user.first_name, result.user.last_name]
          .filter(Boolean)
          .join(' ');
        console.log(chalk.dim(`  User: ${displayName || result.user.email} (${result.user.id})`));
      }
    } else {
      console.log(chalk.red(`✗ ${result.name}: ${result.message}`));
    }
  }
}

/**
 * Main application loop
 */
async function main(): Promise<void> {
  // Handle CLI arguments first (--json, --help)
  if (handleCliArgs()) {
    return;
  }

  // Enter interactive mode
  while (true) {
    const action = await showMainMenu();

    switch (action) {
      case 'add':
        await handleAdd();
        await pressEnterToContinue();
        break;
      case 'remove':
        await handleRemove();
        await pressEnterToContinue();
        break;
      case 'list':
        await handleList();
        await pressEnterToContinue();
        break;
      case 'use':
        await handleUse();
        await pressEnterToContinue();
        break;
      case 'current':
        await handleCurrent();
        await pressEnterToContinue();
        break;
      case 'validate':
        await handleValidate();
        await pressEnterToContinue();
        break;
      case 'validate-all':
        await handleValidateAll();
        await pressEnterToContinue();
        break;
      case 'exit':
        console.log(chalk.dim('\nGoodbye!\n'));
        process.exit(0);
    }
  }
}

// Run the application
main().catch((error) => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});
