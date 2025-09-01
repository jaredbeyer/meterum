# Meterum Setup Guide - Next Steps

## ✅ What's Been Configured

1. **Local PostgreSQL Database Connection** - Your `.env.local` file is configured for local PostgreSQL
2. **Database Schema** - SQL script ready for PostgreSQL
3. **API Routes** - Use local PostgreSQL
4. **Authentication** - JWT-based auth with bcrypt password hashing

## 📋 Your Next Steps


### Step 1: Initialize Local PostgreSQL Database

1. **Run the database initialization script:**
   ```bash
   npm run db:init
   ```

2. **Verify tables were created:**
   - Connect to your PostgreSQL instance and check for tables: users, customers, sites, nodes, meters, etc.

### Step 2: Install Dependencies & Test Locally

```bash
# Install all dependencies
npm install

# Start development server
npm run dev
```

### Step 3: Test the API

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# You should see:
# {"status":"healthy","timestamp":"...","database":{"connected":true}...}
```

### Step 4: Test Authentication

```bash
# Login with default admin account
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Save the token from the response for authenticated requests
```

### Step 5: Test Node Registration

```bash
# Simulate a Raspberry Pi registering
curl -X POST http://localhost:3000/api/nodes/register \
  -H "Content-Type: application/json" \
  -H "x-api-key: meterum-node-api-key-change-this-to-secure-value" \
  -d '{"nodeId":"TEST001","version":"1.0.0","ipAddress":"192.168.1.100"}'
```


### Step 6: Start Locally

```bash
# Build and start the app on your server
npm run build
PORT=3001 npm start
```


### Step 7: Update Environment Variables

1. Edit your `.env.local` file with your local database and secrets.
2. Restart the app if you make changes.
3. Go to Settings → Environment Variables
4. Add all variables from `.env.local`

### Step 8: Test Production Deployment

```bash
# Replace with your actual Vercel URL
curl https://meterum.vercel.app/api/health
```

## 🔧 Troubleshooting

### Database Connection Issues

- Verify `.env.local` has correct credentials
- Make sure tables were created in SQL editor

### API Not Working
- Check `npm run dev` console for errors
- Verify all dependencies installed: `npm install`
- Check Node.js version: `node --version` (should be 18+)

### Vercel Deployment Issues
- Make sure environment variables are set in Vercel dashboard
- Check build logs in Vercel dashboard
- Verify all TypeScript errors are resolved

## 📊 Check Your Progress



You can see:
- Database tables and data
- API logs
- Real-time data updates

## 🚀 Next Development Tasks

1. **Build Dashboard UI** - Create frontend for meter management
2. **Implement Real BACnet** - Replace simulated meter readings
3. **Add More API Endpoints** - Customer, site, and meter management
4. **Set Up Monitoring** - Add logging and alerting

## 📝 Important Security Notes

⚠️ **Before Production:**
1. Change the default admin password
2. Generate a secure `NODE_API_KEY`
3. Use a strong `JWT_SECRET`

5. Set up proper CORS policies

## Need Help?

- Check the main README.md for architecture overview
- Review the `/docs` folder for detailed documentation

- Check Vercel docs: https://vercel.com/docs