import { createHmac, randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { supabaseAdmin } from './supabase';

interface NodeApiKey {
  id: number;
  node_id: number;
  key_hash: string;
  key_prefix: string;
  created_at: string;
  last_used: string | null;
  is_active: boolean;
}

/**
 * Generate a new API key for a node
 */
export async function generateNodeApiKey(nodeId: number): Promise<{ key: string; keyId: number }> {
  // Generate a secure random key
  const keyBytes = randomBytes(32);
  const key = keyBytes.toString('base64url');
  
  // Create a prefix for easy identification (first 8 chars)
  const prefix = key.substring(0, 8);
  
  // Hash the key for storage
  const saltRounds = 10;
  const keyHash = await bcrypt.hash(key, saltRounds);
  
  // Store in database
  const { data, error } = await supabaseAdmin
    .from('node_api_keys')
    .insert({
      node_id: nodeId,
      key_hash: keyHash,
      key_prefix: prefix,
      is_active: true,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to generate API key: ${error.message}`);
  }
  
  return { key, keyId: data.id };
}

/**
 * Verify a node API key
 */
export async function verifyNodeApiKey(key: string): Promise<{ valid: boolean; nodeId?: number }> {
  try {
    // Get the prefix to find potential matches
    const prefix = key.substring(0, 8);
    
    // Find active keys with matching prefix
    const { data: keys, error } = await supabaseAdmin
      .from('node_api_keys')
      .select('*')
      .eq('key_prefix', prefix)
      .eq('is_active', true);
    
    if (error || !keys || keys.length === 0) {
      return { valid: false };
    }
    
    // Check each potential match
    for (const keyRecord of keys) {
      const isValid = await bcrypt.compare(key, keyRecord.key_hash);
      if (isValid) {
        // Update last used timestamp
        await supabaseAdmin
          .from('node_api_keys')
          .update({ last_used: new Date().toISOString() })
          .eq('id', keyRecord.id);
        
        return { valid: true, nodeId: keyRecord.node_id };
      }
    }
    
    return { valid: false };
  } catch (error) {
    console.error('Error verifying node API key:', error);
    return { valid: false };
  }
}

/**
 * Rotate API key for a node
 */
export async function rotateNodeApiKey(nodeId: number): Promise<{ key: string; keyId: number }> {
  // Deactivate old keys
  await supabaseAdmin
    .from('node_api_keys')
    .update({ is_active: false })
    .eq('node_id', nodeId)
    .eq('is_active', true);
  
  // Generate new key
  return generateNodeApiKey(nodeId);
}

/**
 * Create HMAC signature for request body
 */
export function createHmacSignature(
  body: string,
  secret: string,
  timestamp: number
): string {
  const message = `${timestamp}.${body}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(message);
  return hmac.digest('hex');
}

/**
 * Verify HMAC signature
 */
export function verifyHmacSignature(
  body: string,
  signature: string,
  secret: string,
  timestamp: number,
  maxAgeSeconds: number = 300 // 5 minutes
): boolean {
  // Check timestamp is within acceptable range
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > maxAgeSeconds) {
    return false;
  }
  
  // Verify signature
  const expectedSignature = createHmacSignature(body, secret, timestamp);
  
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Middleware to verify node requests with HMAC
 */
export async function verifyNodeRequest(
  request: Request,
  body: string
): Promise<{ valid: boolean; nodeId?: number; error?: string }> {
  // Get headers
  const apiKey = request.headers.get('x-api-key');
  const signature = request.headers.get('x-signature');
  const timestamp = request.headers.get('x-timestamp');
  
  if (!apiKey) {
    return { valid: false, error: 'Missing API key' };
  }
  
  // Verify API key
  const keyResult = await verifyNodeApiKey(apiKey);
  if (!keyResult.valid) {
    return { valid: false, error: 'Invalid API key' };
  }
  
  // If signature is provided, verify it
  if (signature && timestamp) {
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) {
      return { valid: false, error: 'Invalid timestamp' };
    }
    
    const isValidSignature = verifyHmacSignature(
      body,
      signature,
      apiKey,
      ts
    );
    
    if (!isValidSignature) {
      return { valid: false, error: 'Invalid signature' };
    }
  }
  
  return { valid: true, nodeId: keyResult.nodeId };
}

/**
 * Create migration to add node_api_keys table
 */
export const nodeApiKeysMigration = `
CREATE TABLE IF NOT EXISTS node_api_keys (
  id SERIAL PRIMARY KEY,
  node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  INDEX idx_node_api_keys_prefix (key_prefix),
  INDEX idx_node_api_keys_node_active (node_id, is_active)
);

-- Add command to track API key usage
CREATE TABLE IF NOT EXISTS node_api_key_usage (
  id SERIAL PRIMARY KEY,
  key_id INTEGER NOT NULL REFERENCES node_api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_api_key_usage_key (key_id),
  INDEX idx_api_key_usage_time (created_at)
);
`;