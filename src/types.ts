/**
 * Represents a single set of Directus credentials
 */
export interface Credentials {
  url: string;
  token: string;
}

/**
 * The full configuration stored in the config file
 */
export interface Config {
  active: string | null;
  credentials: Record<string, Credentials>;
}

/**
 * Result of validating credentials against the Directus API
 */
export interface ValidationResult {
  name: string;
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}
