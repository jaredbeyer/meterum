const bacnet = require('node-bacnet');
const EventEmitter = require('events');
const winston = require('winston');

// BACnet object types we're interested in
const OBJECT_TYPES = {
  ANALOG_INPUT: 0,
  ANALOG_OUTPUT: 1,
  ANALOG_VALUE: 2,
  BINARY_INPUT: 3,
  BINARY_OUTPUT: 4,
  BINARY_VALUE: 5,
  MULTI_STATE_INPUT: 13,
  MULTI_STATE_OUTPUT: 14,
  MULTI_STATE_VALUE: 19,
  DEVICE: 8
};

// Common BACnet properties
const PROPERTIES = {
  OBJECT_NAME: 77,
  PRESENT_VALUE: 85,
  DESCRIPTION: 28,
  DEVICE_TYPE: 31,
  STATUS_FLAGS: 111,
  EVENT_STATE: 36,
  UNITS: 117,
  MIN_PRESENT_VALUE: 69,
  MAX_PRESENT_VALUE: 65,
  OBJECT_LIST: 76,
  VENDOR_NAME: 121,
  MODEL_NAME: 70,
  FIRMWARE_REVISION: 44,
  APPLICATION_SOFTWARE_VERSION: 12,
  LOCATION: 58,
  PRIORITY_ARRAY: 87,
  RELINQUISH_DEFAULT: 104
};

class BACnetScanner extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || 47808,
      interface: options.interface || '0.0.0.0',
      broadcastAddress: options.broadcastAddress || '255.255.255.255',
      apduTimeout: options.apduTimeout || 6000,
      ...options
    };
    
    this.logger = options.logger || winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()]
    });
    
    this.client = null;
    this.devices = new Map();
    this.points = new Map();
    this.isScanning = false;
  }
  
  // Initialize BACnet client
  initialize() {
    try {
      this.client = new bacnet({
        port: this.options.port,
        interface: this.options.interface,
        broadcastAddress: this.options.broadcastAddress,
        apduTimeout: this.options.apduTimeout
      });
      
      // Set up event handlers
      this.client.on('iAm', (device) => {
        this.handleDeviceDiscovered(device);
      });
      
      this.client.on('error', (err) => {
        this.logger.error('BACnet client error:', err);
        this.emit('error', err);
      });
      
      this.logger.info('BACnet scanner initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize BACnet client:', error);
      return false;
    }
  }
  
  // Scan network for BACnet devices
  async scanNetwork(options = {}) {
    if (!this.client) {
      throw new Error('BACnet client not initialized');
    }
    
    if (this.isScanning) {
      this.logger.warn('Scan already in progress');
      return;
    }
    
    this.isScanning = true;
    this.devices.clear();
    this.points.clear();
    
    const scanOptions = {
      lowLimit: options.lowLimit || 0,
      highLimit: options.highLimit || 4194303,
      timeout: options.timeout || 30000,
      ...options
    };
    
    this.logger.info('Starting BACnet network scan...');
    this.emit('scanStart', scanOptions);
    
    // Send WhoIs broadcast
    this.client.whoIs(scanOptions.lowLimit, scanOptions.highLimit);
    
    // Wait for responses
    await new Promise(resolve => {
      setTimeout(() => {
        this.isScanning = false;
        resolve();
      }, scanOptions.timeout);
    });
    
    this.logger.info(`Scan complete. Found ${this.devices.size} devices`);
    this.emit('scanComplete', {
      devices: Array.from(this.devices.values()),
      points: Array.from(this.points.values())
    });
    
    return {
      devices: Array.from(this.devices.values()),
      points: Array.from(this.points.values())
    };
  }
  
  // Handle discovered device
  handleDeviceDiscovered(device) {
    const deviceKey = `${device.address}:${device.deviceId}`;
    
    if (!this.devices.has(deviceKey)) {
      const deviceInfo = {
        address: device.address,
        deviceId: device.deviceId,
        maxApdu: device.maxApdu,
        segmentation: device.segmentation,
        vendorId: device.vendorId,
        discoveredAt: new Date().toISOString(),
        points: []
      };
      
      this.devices.set(deviceKey, deviceInfo);
      this.logger.info(`Discovered device: ${deviceKey}`);
      this.emit('deviceDiscovered', deviceInfo);
      
      // Scan device for points
      this.scanDevicePoints(device.address, device.deviceId);
    }
  }
  
  // Scan a specific device for available points
  async scanDevicePoints(address, deviceId) {
    try {
      // Read device properties
      const deviceProps = await this.readDeviceProperties(address, deviceId);
      
      // Read object list
      const objectList = await this.readProperty(
        address,
        { type: OBJECT_TYPES.DEVICE, instance: deviceId },
        PROPERTIES.OBJECT_LIST
      );
      
      if (objectList && Array.isArray(objectList)) {
        this.logger.info(`Device ${deviceId} has ${objectList.length} objects`);
        
        for (const obj of objectList) {
          await this.scanPoint(address, deviceId, obj);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to scan device ${deviceId}:`, error);
    }
  }
  
  // Read device properties
  async readDeviceProperties(address, deviceId) {
    const properties = {};
    
    try {
      properties.vendorName = await this.readProperty(
        address,
        { type: OBJECT_TYPES.DEVICE, instance: deviceId },
        PROPERTIES.VENDOR_NAME
      );
      
      properties.modelName = await this.readProperty(
        address,
        { type: OBJECT_TYPES.DEVICE, instance: deviceId },
        PROPERTIES.MODEL_NAME
      );
      
      properties.firmwareRevision = await this.readProperty(
        address,
        { type: OBJECT_TYPES.DEVICE, instance: deviceId },
        PROPERTIES.FIRMWARE_REVISION
      );
      
      properties.location = await this.readProperty(
        address,
        { type: OBJECT_TYPES.DEVICE, instance: deviceId },
        PROPERTIES.LOCATION
      );
      
      // Update device info
      const deviceKey = `${address}:${deviceId}`;
      if (this.devices.has(deviceKey)) {
        this.devices.get(deviceKey).properties = properties;
      }
    } catch (error) {
      this.logger.warn(`Failed to read device properties for ${deviceId}:`, error.message);
    }
    
    return properties;
  }
  
  // Scan individual point
  async scanPoint(address, deviceId, object) {
    try {
      const pointInfo = {
        deviceAddress: address,
        deviceId: deviceId,
        objectType: object.type,
        objectInstance: object.instance,
        objectTypeName: this.getObjectTypeName(object.type)
      };
      
      // Read point properties
      pointInfo.name = await this.readProperty(address, object, PROPERTIES.OBJECT_NAME);
      pointInfo.description = await this.readProperty(address, object, PROPERTIES.DESCRIPTION);
      pointInfo.presentValue = await this.readProperty(address, object, PROPERTIES.PRESENT_VALUE);
      pointInfo.units = await this.readProperty(address, object, PROPERTIES.UNITS);
      
      // Check if writable (has priority array)
      const priorityArray = await this.readProperty(address, object, PROPERTIES.PRIORITY_ARRAY);
      pointInfo.isWritable = priorityArray !== null;
      
      // For analog points, get min/max
      if (object.type <= 2) { // Analog types
        pointInfo.minValue = await this.readProperty(address, object, PROPERTIES.MIN_PRESENT_VALUE);
        pointInfo.maxValue = await this.readProperty(address, object, PROPERTIES.MAX_PRESENT_VALUE);
      }
      
      const pointKey = `${address}:${deviceId}:${object.type}:${object.instance}`;
      this.points.set(pointKey, pointInfo);
      
      // Add to device's point list
      const deviceKey = `${address}:${deviceId}`;
      if (this.devices.has(deviceKey)) {
        this.devices.get(deviceKey).points.push(pointInfo);
      }
      
      this.logger.debug(`Discovered point: ${pointInfo.name} (${pointInfo.objectTypeName})`);
      this.emit('pointDiscovered', pointInfo);
      
    } catch (error) {
      this.logger.warn(`Failed to scan point ${object.type}:${object.instance}:`, error.message);
    }
  }
  
  // Read a BACnet property
  async readProperty(address, objectId, propertyId) {
    return new Promise((resolve) => {
      const requestId = this.client.readProperty(
        address,
        objectId,
        propertyId,
        (err, value) => {
          if (err) {
            resolve(null);
          } else {
            resolve(value.values && value.values[0] ? value.values[0].value : null);
          }
        }
      );
      
      // Timeout handler
      setTimeout(() => {
        resolve(null);
      }, this.options.apduTimeout);
    });
  }
  
  // Write to a BACnet point
  async writePoint(address, objectId, value, priority = 16) {
    return new Promise((resolve, reject) => {
      this.client.writeProperty(
        address,
        objectId,
        PROPERTIES.PRESENT_VALUE,
        [{ type: this.getValueType(objectId.type, value), value: value }],
        { priority: priority },
        (err) => {
          if (err) {
            this.logger.error(`Failed to write to point ${objectId.type}:${objectId.instance}:`, err);
            reject(err);
          } else {
            this.logger.info(`Successfully wrote ${value} to ${objectId.type}:${objectId.instance}`);
            resolve(true);
          }
        }
      );
    });
  }
  
  // Subscribe to point changes (COV - Change of Value)
  subscribeCOV(address, objectId, callback) {
    const subscribeId = this.client.subscribeCOV(
      address,
      objectId,
      7, // Confirmed notifications
      false, // No issue confirmed notifications
      300, // Lifetime in seconds
      (err, value) => {
        if (err) {
          this.logger.error('COV subscription error:', err);
        } else {
          callback(value);
        }
      }
    );
    
    return subscribeId;
  }
  
  // Get object type name
  getObjectTypeName(type) {
    const typeNames = {
      0: 'Analog Input',
      1: 'Analog Output',
      2: 'Analog Value',
      3: 'Binary Input',
      4: 'Binary Output',
      5: 'Binary Value',
      13: 'Multi-State Input',
      14: 'Multi-State Output',
      19: 'Multi-State Value',
      8: 'Device'
    };
    return typeNames[type] || `Unknown (${type})`;
  }
  
  // Get appropriate value type for writing
  getValueType(objectType, value) {
    if (objectType >= 3 && objectType <= 5) {
      // Binary types
      return bacnet.enum.ApplicationTags.ENUMERATED;
    } else if (objectType >= 13 && objectType <= 19) {
      // Multi-state types
      return bacnet.enum.ApplicationTags.UNSIGNED_INTEGER;
    } else {
      // Analog types
      return bacnet.enum.ApplicationTags.REAL;
    }
  }
  
  // Scan for MSTP devices (requires serial port configuration)
  async scanMSTP(options = {}) {
    // This would require additional serial port configuration
    // and bacnet-mstp library for RS-485 communication
    this.logger.warn('MSTP scanning not yet implemented');
    return [];
  }
  
  // Close the scanner
  close() {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }
}

module.exports = BACnetScanner;