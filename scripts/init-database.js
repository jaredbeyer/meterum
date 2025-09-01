#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');

async function initDatabase() {
  console.log('🚀 Initializing Meterum database...');
  
  if (!process.env.POSTGRES_URL) {
    console.error('❌ Error: POSTGRES_URL environment variable not set');
    console.log('Please set up your .env file with database credentials');
    process.exit(1);
  }
  
  try {
    // Read schema file
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    console.log('✅ Schema file loaded');

    // Use 'pg' for local PostgreSQL
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.POSTGRES_URL });
    await client.connect();

    // Parse and execute SQL statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length > 0) {
        try {
          await client.query(statement + ';');
          console.log('✅ Executed:', statement.substring(0, 50) + '...');
        } catch (error) {
          console.warn('⚠️  Warning:', error.message);
          // Continue with other statements
        }
      }
    }

    await client.end();

    console.log('✅ Database initialization complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run "npm run dev" to start development server');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };