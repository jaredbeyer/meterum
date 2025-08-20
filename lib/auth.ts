import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from './supabase';

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
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, email, password_hash, role')
      .or(`username.eq.${username},email.eq.${username}`)
      .single();
    
    if (error || !data) {
      return { success: false, error: 'User not found' };
    }
    
    const isValid = await bcrypt.compare(password, data.password_hash);
    
    if (!isValid) {
      return { success: false, error: 'Invalid password' };
    }
    
    // Update last login
    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', data.id);
    
    const token = jwt.sign(
      { userId: data.id, username: data.username, role: data.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return {
      success: true,
      user: {
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role
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