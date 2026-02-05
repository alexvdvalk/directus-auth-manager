import type { Credentials, ValidationResult } from './types.js';

/**
 * Validates a set of credentials by calling the Directus /users/me endpoint
 */
export async function validateCredentials(
  name: string,
  credentials: Credentials
): Promise<ValidationResult> {
  const { url, token } = credentials;

  // Normalize URL (remove trailing slash)
  const baseUrl = url.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/users/me`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const status = response.status;
      let message = `HTTP ${status}`;

      if (status === 401) {
        message = 'Unauthorized - Invalid or expired token';
      } else if (status === 403) {
        message = 'Forbidden - Token lacks required permissions';
      } else if (status === 404) {
        message = 'Not found - Check if the URL is correct';
      }

      return {
        name,
        success: false,
        message,
      };
    }

    const data = await response.json();
    const user = data.data;

    return {
      name,
      success: true,
      message: 'Valid',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    };
  } catch (error) {
    let message = 'Unknown error';

    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        message = 'Connection refused - Server may be down';
      } else if (error.message.includes('ENOTFOUND')) {
        message = 'Host not found - Check the URL';
      } else if (error.message.includes('ETIMEDOUT')) {
        message = 'Connection timed out';
      } else if (error.message.includes('certificate')) {
        message = 'SSL certificate error';
      } else {
        message = error.message;
      }
    }

    return {
      name,
      success: false,
      message,
    };
  }
}

/**
 * Validates multiple credential sets in parallel
 */
export async function validateAllCredentials(
  credentialsMap: Record<string, Credentials>
): Promise<ValidationResult[]> {
  const entries = Object.entries(credentialsMap);

  const results = await Promise.all(
    entries.map(([name, creds]) => validateCredentials(name, creds))
  );

  return results;
}
