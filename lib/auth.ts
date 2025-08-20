import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sql } from '@vercel/postgres';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const NODE_API_KEY = process.env.NODE_API_KEY || 'node-secret-key';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export async function authenticateUser(username: string, password: string): Promise<AuthResult> {
  try {
    const { rows } = await sql`
      SELECT id, username, email, password_hash, role 
      FROM users 
      WHERE username = ${username} OR email = ${username}
    `;
    
    if (rows.length === 0) {
      return { success: false, error: 'User not found' };
    }
    
    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return { success: false, error: 'Invalid password' };
    }
    
    // Update last login
    await sql`
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = ${user.id}
    `;
    
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function verifyNodeApiKey(apiKey: string): boolean {
  return apiKey === NODE_API_KEY;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}