const BACnetScanner = require('./bacnet-scanner');
const axios = require('axios');
const winston = require('winston');

class BACnetController {
  constructor(nodeId, serverUrl, apiKey, logger) {
    this.nodeId = nodeId;
    this.serverUrl = serverUrl;
    this.apiKey = apiKey;
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()]
    });
    
    this.scanner = null;
    this.discoveredDevices = new Map();
    this.controlQueue = [];
    this.isProcessingQueue = false;
  }
  
  // Initialize BACnet scanner
  initialize() {
    this.scanner = new BACnetScanner({
      logger: this.logger
    });
    
    // Set up event handlers
    this.scanner.on('deviceDiscovered', (device) => {
      this.handleDeviceDiscovered(device);
    });
    
    this.scanner.on('pointDiscovered', (point) => {
      this.handlePointDiscovered(point);
    });
    
    this.scanner.on('error', (error) => {
      this.logger.error('BACnet scanner error:', error);
    });
    
    return this.scanner.initialize();
  }
  
  // Perform network discovery
  async discoverNetwork(options = {}) {
    this.logger.info('Starting BACnet network discovery...');
    
    try {
      const result = await this.scanner.scanNetwork(options);
      
      // Send results to server
      await this.sendDiscoveryResults(result);
      
      return result;
    } catch (error) {
      this.logger.error('Network discovery failed:', error);
      throw error;
    }
  }
  
  // Handle discovered device
  async handleDeviceDiscovered(device) {
    const deviceKey = `${device.address}:${device.deviceId}`;
    this.discoveredDevices.set(deviceKey, device);
    
    // Send device to server
    try {
      await this.sendToServer('/api/bacnet/devices', {
        nodeId: this.nodeId,
        device: {
          device_instance: device.deviceId,
          ip_address: device.address,
          vendor_id: device.vendorId,
          max_apdu: device.maxApdu,
          segmentation_support: device.segmentation,
          properties: device.properties || {}
        }
      });
    } catch (error) {
      this.logger.error('Failed to send device to server:', error);
    }
  }
  
  // Handle discovered point
  async handlePointDiscovered(point) {
    // Send point to server
    try {
      await this.sendToServer('/api/bacnet/points', {
        nodeId: this.nodeId,
        point: {
          device_address: point.deviceAddress,
          device_id: point.deviceId,
          object_type: point.objectType,
          object_instance: point.objectInstance,
          object_name: point.name,
          description: point.description,
          present_value: point.presentValue,
          units: point.units,
          is_writable: point.isWritable,
          min_value: point.minValue,
          max_value: point.maxValue
        }
      });
    } catch (error) {
      this.logger.error('Failed to send point to server:', error);
    }
  }
  
  // Send discovery results to server
  async sendDiscoveryResults(results) {
    try {
      const response = await this.sendToServer('/api/bacnet/discovery-results', {
        nodeId: this.nodeId,
        timestamp: new Date().toISOString(),
        devices: results.devices,
        points: results.points
      });
      
      this.logger.info('Discovery results sent to server');
      return response;
    } catch (error) {
      this.logger.error('Failed to send discovery results:', error);
      throw error;
    }
  }
  
  // Fetch control commands from server
  async fetchControlCommands() {
    try {
      const response = await axios.get(
        `${this.serverUrl}/api/nodes/${this.nodeId}/control-commands`,
        {
          headers: {
            'x-api-key': this.apiKey
          }
        }
      );
      
      if (response.data && response.data.commands) {
        this.controlQueue.push(...response.data.commands);
        this.logger.info(`Fetched ${response.data.commands.length} control commands`);
      }
    } catch (error) {
      this.logger.error('Failed to fetch control commands:', error.message);
    }
  }
  
  // Process control command queue
  async processControlQueue() {
    if (this.isProcessingQueue || this.controlQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.controlQueue.length > 0) {
      const command = this.controlQueue.shift();
      
      try {
        await this.executeControlCommand(command);
        
        // Report success to server
        await this.reportCommandResult(command.id, 'completed', command.response_value);
      } catch (error) {
        this.logger.error(`Failed to execute command ${command.id}:`, error);
        
        // Report failure to server
        await this.reportCommandResult(command.id, 'failed', null, error.message);
      }
    }
    
    this.isProcessingQueue = false;
  }
  
  // Execute a control command
  async executeControlCommand(command) {
    this.logger.info(`Executing command: ${command.command_type} for point ${command.point_id}`);
    
    switch (command.command_type) {
      case 'READ':
        return await this.readPoint(command);
        
      case 'WRITE':
        return await this.writePoint(command);
        
      case 'RELEASE':
        return await this.releasePoint(command);
        
      case 'SUBSCRIBE':
        return await this.subscribeToPoint(command);
        
      case 'BACNET_DISCOVER':
        return await this.discoverNetwork(command.command_data.scanOptions);
        
      default:
        throw new Error(`Unknown command type: ${command.command_type}`);
    }
  }
  
  // Read a BACnet point
  async readPoint(command) {
    const point = command.point_data;
    const value = await this.scanner.readProperty(
      point.device_address,
      {
        type: point.object_type,
        instance: point.object_instance
      },
      85 // Present Value property
    );
    
    command.response_value = value;
    
    // Update point value in database
    await this.sendToServer('/api/bacnet/points/update', {
      pointId: command.point_id,
      presentValue: value,
      lastRead: new Date().toISOString()
    });
    
    return value;
  }
  
  // Write to a BACnet point
  async writePoint(command) {
    const point = command.point_data;
    const value = this.parseValue(command.target_value, point.object_type);
    
    await this.scanner.writePoint(
      point.device_address,
      {
        type: point.object_type,
        instance: point.object_instance
      },
      value,
      command.priority || 16
    );
    
    command.response_value = value;
    
    // Update point value in database
    await this.sendToServer('/api/bacnet/points/update', {
      pointId: command.point_id,
      presentValue: value,
      lastWrite: new Date().toISOString()
    });
    
    this.logger.info(`Successfully wrote ${value} to point ${point.object_name}`);
  }
  
  // Release control of a point
  async releasePoint(command) {
    const point = command.point_data;
    
    // Write null to release at the specified priority
    await this.scanner.writePoint(
      point.device_address,
      {
        type: point.object_type,
        instance: point.object_instance
      },
      null,
      command.priority || 16
    );
    
    this.logger.info(`Released control of point ${point.object_name} at priority ${command.priority}`);
  }
  
  // Subscribe to point changes
  async subscribeToPoint(command) {
    const point = command.point_data;
    
    const subscriptionId = this.scanner.subscribeCOV(
      point.device_address,
      {
        type: point.object_type,
        instance: point.object_instance
      },
      async (notification) => {
        // Send COV notification to server
        await this.sendToServer('/api/bacnet/points/cov', {
          pointId: command.point_id,
          value: notification.values[0].value,
          timestamp: new Date().toISOString()
        });
      }
    );
    
    this.logger.info(`Subscribed to COV for point ${point.object_name}`);
    return subscriptionId;
  }
  
  // Parse value based on object type
  parseValue(value, objectType) {
    if (objectType >= 3 && objectType <= 5) {
      // Binary types
      return value === 'true' || value === '1' || value === 1 ? 1 : 0;
    } else if (objectType >= 13 && objectType <= 19) {
      // Multi-state types
      return parseInt(value);
    } else {
      // Analog types
      return parseFloat(value);
    }
  }
  
  // Report command result to server
  async reportCommandResult(commandId, status, responseValue, errorMessage = null) {
    try {
      await this.sendToServer('/api/bacnet/commands/result', {
        commandId,
        status,
        responseValue,
        errorMessage,
        executedAt: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to report command result:', error);
    }
  }
  
  // Send data to server
  async sendToServer(endpoint, data) {
    const response = await axios.post(
      `${this.serverUrl}${endpoint}`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        }
      }
    );
    
    return response.data;
  }
  
  // Start periodic operations
  startPeriodicOperations() {
    // Fetch control commands every 5 seconds
    setInterval(() => {
      this.fetchControlCommands();
      this.processControlQueue();
    }, 5000);
    
    // Periodic discovery every hour
    setInterval(() => {
      this.discoverNetwork();
    }, 3600000);
    
    this.logger.info('Started periodic BACnet operations');
  }
  
  // Stop operations
  stop() {
    if (this.scanner) {
      this.scanner.close();
    }
  }
}

module.exports = BACnetController;