const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

// Configuration
const CONFIG = {
  SERVER_URL: process.env.SERVER_URL || 'https://meterum-site-monitoring.vercel.app',
  NODE_ID: process.env.NODE_ID || `VIRTUAL-${Date.now()}`,
  NODE_API_KEY: process.env.NODE_API_KEY,
  POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL) || 1, // minutes
  SIMULATE_METERS: process.env.SIMULATE_METERS === 'true',
  NUMBER_OF_METERS: parseInt(process.env.NUMBER_OF_METERS) || 3
};

// Virtual node state
let isRegistered = false;
let nodeConfig = null;
let simulatedMeters = [];
let logBuffer = [];
const MAX_LOG_BUFFER = 50;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

// Logger
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  let color = colors.reset;
  
  switch(level) {
    case 'SUCCESS': color = colors.green; break;
    case 'INFO': color = colors.blue; break;
    case 'WARN': color = colors.yellow; break;
    case 'ERROR': color = colors.red; break;
    case 'DATA': color = colors.cyan; break;
  }
  
  console.log(`${color}[${timestamp}] [${level}]${colors.reset} ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  
  // Add to log buffer for sending to server
  logBuffer.push({
    level,
    message,
    metadata: data,
    timestamp
  });
  
  // Keep buffer size limited
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift();
  }
}

// Display banner
function displayBanner() {
  console.clear();
  console.log(colors.bright + colors.blue);
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║        METERUM VIRTUAL NODE SIMULATOR               ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  console.log(`Node ID: ${colors.cyan}${CONFIG.NODE_ID}${colors.reset}`);
  console.log(`Server: ${colors.cyan}${CONFIG.SERVER_URL}${colors.reset}`);
  console.log(`Poll Interval: ${colors.cyan}${CONFIG.POLL_INTERVAL} minute(s)${colors.reset}`);
  console.log(`Simulated Meters: ${colors.cyan}${CONFIG.SIMULATE_METERS ? CONFIG.NUMBER_OF_METERS : 'Disabled'}${colors.reset}`);
  console.log('─'.repeat(56));
  console.log('');
}

// Generate a virtual MAC address for testing
function generateVirtualMacAddress() {
  // Generate a consistent MAC based on NODE_ID for testing
  const hash = CONFIG.NODE_ID.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const bytes = [];
  for (let i = 0; i < 6; i++) {
    bytes.push(((hash * (i + 1)) % 256).toString(16).padStart(2, '0').toUpperCase());
  }
  // Set the locally administered bit (second character should be 2, 6, A, or E)
  bytes[0] = '02'; // Locally administered, unicast
  return bytes.join(':');
}

// HTTP request helper
async function makeRequest(method, url, data = null) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': CONFIG.NODE_API_KEY
  };
  
  try {
    const response = await axios({
      method,
      url: `${CONFIG.SERVER_URL}${url}`,
      headers,
      data,
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`HTTP ${error.response.status}: ${error.response.data?.error || error.message}`);
    }
    throw error;
  }
}

// Register node with server
async function registerNode() {
  try {
    log('INFO', `Registering node ${CONFIG.NODE_ID} with server...`);
    
    // Generate a virtual MAC address for testing
    const virtualMac = generateVirtualMacAddress();
    
    const response = await makeRequest('POST', '/api/nodes/register', {
      nodeId: CONFIG.NODE_ID,
      version: '1.0.0-virtual',
      ipAddress: '127.0.0.1',
      macAddress: virtualMac
    });
    
    log('SUCCESS', 'Node registered successfully!', response);
    isRegistered = true;
    
    // Initialize simulated meters
    if (CONFIG.SIMULATE_METERS) {
      initializeSimulatedMeters();
    }
    
    return response;
  } catch (error) {
    log('ERROR', `Registration failed: ${error.message}`);
    isRegistered = false;
    throw error;
  }
}

// Initialize simulated meters
function initializeSimulatedMeters() {
  simulatedMeters = [];
  for (let i = 1; i <= CONFIG.NUMBER_OF_METERS; i++) {
    simulatedMeters.push({
      meterId: `VIRTUAL-E34-${String(i).padStart(3, '0')}`,
      ipAddress: `192.168.1.${100 + i}`,
      channels: 6, // Simulate 6 active channels per meter
      status: 'active'
    });
  }
  log('INFO', `Initialized ${simulatedMeters.length} virtual meters`, simulatedMeters);
}

// Fetch configuration from server
async function fetchConfig() {
  try {
    log('INFO', 'Fetching configuration from server...');
    
    const config = await makeRequest('GET', `/api/nodes/${CONFIG.NODE_ID}/config`);
    nodeConfig = config;
    
    log('SUCCESS', 'Configuration received', {
      meters: config.meters?.length || 0,
      pendingCommands: config.pendingCommands?.length || 0
    });
    
    return config;
  } catch (error) {
    log('WARN', `Failed to fetch config: ${error.message}`);
    return null;
  }
}

// Simulate meter data reading
function generateMeterReading(meterIp, channel) {
  // Generate realistic-looking energy data
  const baseLoad = 10 + (channel * 5); // Different base for each channel
  const variation = Math.sin(Date.now() / 1000 / 60 * Math.PI * 2) * 5; // Sine wave variation
  const noise = (Math.random() - 0.5) * 2; // Random noise
  
  return {
    meterIp,
    channelNumber: channel,
    kwhTotal: Math.abs(baseLoad * 24 + variation * 10 + Math.random() * 100),
    kwDemand: Math.abs(baseLoad + variation + noise),
    voltage: 120 + (Math.random() - 0.5) * 5,
    current: Math.abs(baseLoad / 1.2 + noise),
    powerFactor: 0.85 + Math.random() * 0.15,
    frequency: 59.9 + Math.random() * 0.2
  };
}

// Collect simulated data
async function collectData() {
  if (!isRegistered) {
    log('WARN', 'Node not registered, skipping data collection');
    return;
  }
  
  log('INFO', 'Starting data collection...');
  
  const readings = [];
  const timestamp = new Date().toISOString();
  
  // Generate readings for simulated meters
  if (CONFIG.SIMULATE_METERS) {
    for (const meter of simulatedMeters) {
      for (let channel = 1; channel <= meter.channels; channel++) {
        const reading = generateMeterReading(meter.ipAddress, channel);
        readings.push(reading);
      }
    }
    
    log('DATA', `Generated ${readings.length} readings from ${simulatedMeters.length} meters`);
  }
  
  // Submit data if we have readings
  if (readings.length > 0) {
    await submitData(timestamp, readings);
  }
}

// Submit logs to server
async function submitLogs() {
  if (!isRegistered || logBuffer.length === 0) {
    return;
  }
  
  const logsToSend = [...logBuffer];
  logBuffer = []; // Clear buffer
  
  try {
    await makeRequest('POST', '/api/nodes/logs', {
      nodeId: CONFIG.NODE_ID,
      logs: logsToSend
    });
    
    // Don't log this to avoid infinite loop
    console.log(`${colors.cyan}[LOG]${colors.reset} Sent ${logsToSend.length} logs to server`);
  } catch (error) {
    // Re-add logs to buffer on failure
    logBuffer = [...logsToSend, ...logBuffer].slice(-MAX_LOG_BUFFER);
    console.error(`Failed to submit logs: ${error.message}`);
  }
}

// Submit data to server
async function submitData(timestamp, readings) {
  try {
    log('INFO', `Submitting ${readings.length} readings to server...`);
    
    const response = await makeRequest('POST', `/api/nodes/${CONFIG.NODE_ID}/data`, {
      timestamp,
      readings
    });
    
    log('SUCCESS', 'Data submitted successfully', response);
  } catch (error) {
    log('ERROR', `Failed to submit data: ${error.message}`);
  }
}

// Display status
function displayStatus() {
  console.log('');
  console.log('─'.repeat(56));
  console.log(`${colors.bright}Status:${colors.reset}`);
  console.log(`  Registration: ${isRegistered ? colors.green + '✓ Registered' : colors.red + '✗ Not registered'}${colors.reset}`);
  console.log(`  Last Activity: ${colors.cyan}${new Date().toLocaleTimeString()}${colors.reset}`);
  if (simulatedMeters.length > 0) {
    console.log(`  Virtual Meters: ${colors.cyan}${simulatedMeters.length} active${colors.reset}`);
    console.log(`  Channels/Meter: ${colors.cyan}6${colors.reset}`);
    console.log(`  Total Channels: ${colors.cyan}${simulatedMeters.length * 6}${colors.reset}`);
  }
  console.log('─'.repeat(56));
}

// Main function
async function main() {
  displayBanner();
  
  try {
    // Register node
    await registerNode();
    
    // Fetch initial configuration
    await fetchConfig();
    
    // Initial data collection
    await collectData();
    
    displayStatus();
    
  } catch (error) {
    log('ERROR', `Initialization failed: ${error.message}`);
  }
}

// Schedule periodic tasks
function scheduleJobs() {
  // Data collection every X minutes
  const cronExpression = `*/${CONFIG.POLL_INTERVAL} * * * *`;
  
  log('INFO', `Scheduling data collection every ${CONFIG.POLL_INTERVAL} minute(s)`);
  
  cron.schedule(cronExpression, async () => {
    log('INFO', '⏰ Scheduled data collection triggered');
    await collectData();
    displayStatus();
  });
  
  // Send logs to server every 30 seconds
  setInterval(async () => {
    await submitLogs();
  }, 30000);
  
  // Configuration check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    if (isRegistered) {
      await fetchConfig();
    }
  });
  
  // Re-registration attempt every hour if not registered
  cron.schedule('0 * * * *', async () => {
    if (!isRegistered) {
      log('WARN', 'Attempting re-registration...');
      await registerNode();
      await fetchConfig();
    }
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  log('INFO', 'Shutting down virtual node...');
  process.exit(0);
});

// Interactive commands
process.stdin.on('data', (data) => {
  const command = data.toString().trim().toLowerCase();
  
  switch(command) {
    case 'status':
      displayStatus();
      break;
    case 'collect':
      log('INFO', 'Manual data collection triggered');
      collectData();
      break;
    case 'register':
      log('INFO', 'Manual registration triggered');
      registerNode();
      break;
    case 'config':
      log('INFO', 'Current configuration:', nodeConfig);
      break;
    case 'help':
      console.log(`
${colors.bright}Available Commands:${colors.reset}
  status   - Show current node status
  collect  - Trigger manual data collection
  register - Re-register node with server
  config   - Show current configuration
  help     - Show this help message
  exit     - Shutdown the virtual node
      `);
      break;
    case 'exit':
      process.exit(0);
      break;
    default:
      if (command) {
        log('WARN', `Unknown command: ${command}. Type 'help' for available commands.`);
      }
  }
});

// Start the virtual node
console.log(`${colors.bright}Starting Meterum Virtual Node...${colors.reset}`);
console.log('Type "help" for available commands');
console.log('');

main()
  .then(() => {
    scheduleJobs();
    log('SUCCESS', `Virtual node is running! Data collection every ${CONFIG.POLL_INTERVAL} minute(s)`);
    console.log('');
  })
  .catch((error) => {
    log('ERROR', 'Failed to start virtual node:', error);
    process.exit(1);
  });