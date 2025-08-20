const axios = require('axios');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const cron = require('node-cron');
const { execSync } = require('child_process');
require('dotenv').config();

// BACnet library (optional - install if available)
let bacnet;
try {
  bacnet = require('node-bacnet');
} catch (error) {
  console.warn('BACnet library not available. Install with: npm install node-bacnet');
}

// Configuration
const CONFIG = {
  SERVER_URL: process.env.SERVER_URL || 'https://meterum.vercel.app',
  NODE_ID: process.env.NODE_ID || 'AUTO',
  POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL) || 15, // minutes
  API_KEY: process.env.NODE_API_KEY || 'default-key',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  CONFIG_CHECK_INTERVAL: 5, // minutes
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 5000 // ms
};

// Logger setup
const logger = winston.createLogger({
  level: CONFIG.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, 'logs', 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Create logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Application state
let nodeConfig = null;
let nodeId = null;
let bacnetClient = null;
let isRegistered = false;

// Get unique node ID from CPU serial
function getNodeId() {
  if (CONFIG.NODE_ID !== 'AUTO') {
    return CONFIG.NODE_ID;
  }
  
  try {
    const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    const serialMatch = cpuInfo.match(/Serial\s*:\s*([a-f0-9]+)/i);
    if (serialMatch) {
      return serialMatch[1].toUpperCase();
    }
  } catch (error) {
    logger.warn('Could not read CPU serial, using MAC address');
  }
  
  try {
    const macAddress = execSync('cat /sys/class/net/eth0/address', { encoding: 'utf8' }).trim();
    return macAddress.replace(/:/g, '').toUpperCase();
  } catch (error) {
    logger.error('Could not determine unique node ID', error);
    return 'UNKNOWN_' + Date.now();
  }
}

// Get MAC address for UUID generation
function getMacAddress() {
  try {
    // Try to get primary network interface MAC
    const macAddress = execSync('cat /sys/class/net/eth0/address', { encoding: 'utf8' }).trim();
    return macAddress.toUpperCase();
  } catch (error) {
    // Fallback to any available interface
    try {
      const { networkInterfaces } = require('os');
      const nets = networkInterfaces();
      
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal && net.mac !== '00:00:00:00:00:00') {
            return net.mac.toUpperCase();
          }
        }
      }
    } catch (fallbackError) {
      logger.warn('Could not determine MAC address', fallbackError);
    }
  }
  return null;
}

// Get local IP address
function getLocalIpAddress() {
  try {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  } catch (error) {
    logger.warn('Could not determine IP address', error);
  }
  return null;
}

// HTTP request with retry logic
async function makeRequest(method, url, data = null, retries = CONFIG.RETRY_ATTEMPTS) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': CONFIG.API_KEY
  };
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const config = {
        method,
        url: `${CONFIG.SERVER_URL}${url}`,
        headers,
        timeout: 30000
      };
      
      if (data) {
        config.data = data;
      }
      
      const response = await axios(config);
      return response.data;
    } catch (error) {
      logger.warn(`Request attempt ${attempt} failed:`, {
        url,
        error: error.message,
        status: error.response?.status
      });
      
      if (attempt === retries) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
    }
  }
}

// Register node with server
async function registerNode() {
  try {
    nodeId = getNodeId();
    const ipAddress = getLocalIpAddress();
    const macAddress = getMacAddress();
    
    logger.info('Registering node:', { nodeId, ipAddress, macAddress });
    
    const response = await makeRequest('POST', '/api/nodes/register', {
      nodeId,
      version: '1.0.0',
      ipAddress,
      macAddress
    });
    
    logger.info('Node registration response:', response);
    isRegistered = true;
    
    return response;
  } catch (error) {
    logger.error('Node registration failed:', error.message);
    isRegistered = false;
    throw error;
  }
}

// Fetch node configuration
async function fetchConfig() {
  try {
    if (!nodeId) {
      throw new Error('Node ID not available');
    }
    
    const config = await makeRequest('GET', `/api/nodes/${nodeId}/config`);
    nodeConfig = config;
    
    logger.info('Configuration updated:', {
      meters: config.meters?.length || 0,
      pendingCommands: config.pendingCommands?.length || 0
    });
    
    return config;
  } catch (error) {
    logger.error('Failed to fetch configuration:', error.message);
    throw error;
  }
}

// Initialize BACnet client
function initializeBACnet() {
  if (!bacnet) {
    logger.warn('BACnet library not available');
    return null;
  }
  
  try {
    const client = new bacnet();
    
    client.on('iAm', (device) => {
      logger.debug('BACnet device discovered:', device);
    });
    
    client.on('error', (error) => {
      logger.error('BACnet error:', error);
    });
    
    logger.info('BACnet client initialized');
    return client;
  } catch (error) {
    logger.error('Failed to initialize BACnet client:', error);
    return null;
  }
}

// Simulate reading meter data (replace with actual BACnet implementation)
async function readMeterData(meterIp, channelNumber) {
  // This is a simulation - replace with actual BACnet reading
  return {
    meterIp,
    channelNumber,
    kwhTotal: Math.random() * 1000,
    kwDemand: Math.random() * 100,
    voltage: 120 + Math.random() * 5,
    current: Math.random() * 50,
    powerFactor: 0.8 + Math.random() * 0.2,
    frequency: 59.9 + Math.random() * 0.2
  };
}

// Collect data from all configured meters
async function collectData() {
  if (!nodeConfig || !nodeConfig.meters) {
    logger.warn('No meter configuration available');
    return;
  }
  
  logger.info(`Starting data collection from ${nodeConfig.meters.length} meters`);
  
  const allReadings = [];
  const timestamp = new Date().toISOString();
  
  for (const meter of nodeConfig.meters) {
    try {
      // For demo, collect from channels 1-6
      const channels = [1, 2, 3, 4, 5, 6];
      
      for (const channel of channels) {
        const reading = await readMeterData(meter.ip_address, channel);
        if (reading) {
          allReadings.push(reading);
        }
      }
    } catch (error) {
      logger.error(`Failed to collect data from meter ${meter.ip_address}:`, error.message);
    }
  }
  
  if (allReadings.length > 0) {
    await submitData(timestamp, allReadings);
  } else {
    logger.warn('No readings collected');
  }
}

// Submit data to server
async function submitData(timestamp, readings) {
  try {
    const response = await makeRequest('POST', `/api/nodes/${nodeId}/data`, {
      timestamp,
      readings
    });
    
    logger.info(`Data submitted successfully: ${readings.length} readings`, {
      insertedReadings: response.insertedReadings
    });
  } catch (error) {
    logger.error('Failed to submit data:', error.message);
    throw error;
  }
}

// Main application loop
async function main() {
  logger.info('Meterum Node starting up');
  
  try {
    // Initialize BACnet if available
    bacnetClient = initializeBACnet();
    
    // Register with server
    await registerNode();
    
    // Fetch initial configuration
    await fetchConfig();
    
    logger.info('Node initialization completed successfully');
    
  } catch (error) {
    logger.error('Failed to initialize node:', error.message);
    // Continue running to retry later
  }
}

// Schedule periodic tasks
function scheduleJobs() {
  // Data collection every X minutes
  const dataCollectionInterval = `*/${CONFIG.POLL_INTERVAL} * * * *`;
  cron.schedule(dataCollectionInterval, async () => {
    if (isRegistered) {
      try {
        await collectData();
      } catch (error) {
        logger.error('Data collection failed:', error.message);
      }
    }
  });
  
  // Configuration check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    if (isRegistered) {
      try {
        await fetchConfig();
      } catch (error) {
        logger.error('Configuration update failed:', error.message);
      }
    }
  });
  
  // Re-registration attempt every hour if not registered
  cron.schedule('0 * * * *', async () => {
    if (!isRegistered) {
      try {
        await registerNode();
        await fetchConfig();
      } catch (error) {
        logger.error('Re-registration failed:', error.message);
      }
    }
  });
  
  logger.info('Periodic jobs scheduled');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Start the application
main()
  .then(() => {
    scheduleJobs();
    logger.info('Meterum Node is running');
  })
  .catch((error) => {
    logger.error('Failed to start application:', error);
    // Continue running for retry attempts
    scheduleJobs();
  });