const bcrypt = require('bcryptjs');

// Default password to hash
const password = process.argv[2] || 'admin123';

// Generate hash
bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  
  console.log('\n=== Password Hash Generator ===');
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nSQL Update Command:');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'admin';`);
  console.log('\n=== End ===\n');
});