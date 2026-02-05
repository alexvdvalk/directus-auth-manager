# Directus Auth Manager

A CLI tool and library for managing multiple Directus credential sets. Use it standalone to manage credentials, or import it as a dependency in your own CLI tools.

## Installation

### As a CLI tool

```bash
npm install -g directus-auth-manager
```

### As a dependency

```bash
npm install directus-auth-manager
```

## CLI Usage

Run the CLI to open the interactive menu:

```bash
directus-auth
```

### Interactive Menu

Use the arrow keys to navigate and Enter to select:

```
  Directus Auth Manager

  Active: production (https://directus.example.com)

? What would you like to do? (Use arrow keys)
❯ ➕  Add credentials
  📋  List all credentials
  🔄  Switch active credentials
  👁️   View current credentials
  ✅  Validate specific credentials
  ✅  Validate all credentials
  🗑️   Remove credentials
  ──────────────
  🚪  Exit
```

### JSON Output

Get active credentials as JSON for scripting:

```bash
directus-auth --json
# {"name":"production","url":"https://directus.example.com","token":"your-token"}

# Use with jq
directus-auth --json | jq -r '.url'
directus-auth --json | jq -r '.token'
```

## Library Usage

Import and use in your own CLI tools:

### promptForCredentials()

The main function - prompts the user to select saved credentials or enter them manually.

```typescript
import { promptForCredentials } from 'directus-auth-manager';

// Basic usage - shows list of saved credentials + manual entry option
const creds = await promptForCredentials();
console.log(creds.url, creds.token);

// With options
const creds = await promptForCredentials({
  message: 'Select Directus instance:',    // Custom prompt message
  allowManual: true,                        // Allow manual entry (default: true)
  saveManual: true,                         // Offer to save manual entries (default: true)
  useActiveIfAvailable: true,               // Skip prompt if active credentials exist
});
```

**Returns:**
```typescript
interface CredentialSelection {
  name: string;      // Credential name (e.g., "production")
  url: string;       // Directus server URL
  token: string;     // Access token
  source: 'saved' | 'manual';  // Where the credentials came from
}
```

### getActive()

Get active credentials with a confirmation prompt (returns null if none set or user declines).

```typescript
import { getActive } from 'directus-auth-manager';

// Shows confirmation prompt (default):
//   Active Directus Credentials
//   Name:   production
//   Server: https://directus.example.com
//   ? Use these credentials? (Y/n)

const creds = await getActive();
if (creds) {
  console.log(`Using ${creds.name}: ${creds.url}`);
} else {
  console.log('No active credentials or user declined');
}

// Skip confirmation prompt
const creds = await getActive({ skipConfirmation: true });
```

### getByName()

Get specific credentials by name.

```typescript
import { getByName } from 'directus-auth-manager';

const prod = getByName('production');
if (prod) {
  console.log(prod.url, prod.token);
}
```

### listSaved()

Get list of all saved credential names.

```typescript
import { listSaved } from 'directus-auth-manager';

const names = listSaved();
console.log('Saved credentials:', names);
// ['production', 'staging', 'local']
```

### validateCredentials()

Validate credentials by calling the Directus API.

```typescript
import { promptForCredentials, validateCredentials } from 'directus-auth-manager';

const creds = await promptForCredentials();
const result = await validateCredentials(creds.name, { url: creds.url, token: creds.token });

if (result.success) {
  console.log('Valid!', result.user?.email);
} else {
  console.log('Invalid:', result.message);
}
```

### Complete Example

Here's how another CLI might use this library:

```typescript
#!/usr/bin/env node
import { promptForCredentials, getActive } from 'directus-auth-manager';

async function main() {
  // Try to use active credentials (shows confirmation), prompt if none or declined
  let creds = await getActive();
  
  if (!creds) {
    creds = await promptForCredentials({
      message: 'Select or enter Directus credentials:',
    });
  }
  
  console.log(`\nConnecting to ${creds.url}...`);
  
  // Use the credentials
  const response = await fetch(`${creds.url}/items/posts`, {
    headers: { Authorization: `Bearer ${creds.token}` },
  });
  
  const data = await response.json();
  console.log('Posts:', data);
}

main();
```

## Configuration

Credentials are stored in `~/.config/directus-auth-manager/config.json`.

```json
{
  "active": "production",
  "credentials": {
    "production": {
      "url": "https://directus.example.com",
      "token": "your-static-token"
    },
    "staging": {
      "url": "https://staging.directus.example.com",
      "token": "another-token"
    }
  }
}
```

## API Reference

### Types

```typescript
interface Credentials {
  url: string;
  token: string;
}

interface CredentialSelection {
  name: string;
  url: string;
  token: string;
  source: 'saved' | 'manual';
}

interface PromptOptions {
  message?: string;
  allowManual?: boolean;
  saveManual?: boolean;
  useActiveIfAvailable?: boolean;
}

interface GetActiveOptions {
  skipConfirmation?: boolean;  // Skip confirmation prompt (default: false)
}

interface ValidationResult {
  name: string;
  success: boolean;
  message: string;
  user?: { id: string; email: string; first_name?: string; last_name?: string };
}
```

### Functions

| Function | Description |
|----------|-------------|
| `promptForCredentials(options?)` | Interactive prompt to select/enter credentials |
| `getActive(options?)` | Get active credentials with confirmation prompt |
| `getByName(name)` | Get credentials by name (sync, no prompt) |
| `listSaved()` | List all saved credential names (sync) |
| `validateCredentials(name, creds)` | Validate credentials against Directus API |
| `validateAllCredentials(credsMap)` | Validate multiple credential sets |

## Requirements

- Node.js 18 or higher

## License

MIT
