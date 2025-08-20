// Virtual BACnet implementation for testing
// Simulates BACnet devices and points without actual hardware

class VirtualBACnet {
  constructor() {
    this.devices = new Map();
    this.points = new Map();
    this.initializeVirtualDevices();
  }
  
  initializeVirtualDevices() {
    // Simulate an HVAC controller
    this.addDevice({
      deviceId: 100001,
      address: '192.168.1.100',
      vendorId: 5,
      vendorName: 'Johnson Controls',
      modelName: 'NAE5510',
      deviceName: 'Building_Controller',
      deviceType: 'HVAC Controller',
      location: 'Mechanical Room'
    });
    
    // Simulate a lighting controller
    this.addDevice({
      deviceId: 100002,
      address: '192.168.1.101',
      vendorId: 8,
      vendorName: 'Lutron',
      modelName: 'Quantum',
      deviceName: 'Lighting_Controller',
      deviceType: 'Lighting Controller',
      location: 'Electrical Room'
    });
    
    // Add HVAC points
    this.addPoint(100001, {
      objectType: 2, // Analog Value
      objectInstance: 1,
      objectName: 'Zone_1_Temp_Setpoint',
      description: 'Zone 1 Temperature Setpoint',
      presentValue: 72,
      units: 'degreesFahrenheit',
      isWritable: true,
      pointType: 'Temperature',
      pointCategory: 'HVAC',
      minValue: 65,
      maxValue: 85
    });
    
    this.addPoint(100001, {
      objectType: 0, // Analog Input
      objectInstance: 1,
      objectName: 'Zone_1_Temp',
      description: 'Zone 1 Current Temperature',
      presentValue: 70.5,
      units: 'degreesFahrenheit',
      isWritable: false,
      pointType: 'Temperature',
      pointCategory: 'HVAC'
    });
    
    this.addPoint(100001, {
      objectType: 2, // Analog Value
      objectInstance: 2,
      objectName: 'Zone_2_Temp_Setpoint',
      description: 'Zone 2 Temperature Setpoint',
      presentValue: 74,
      units: 'degreesFahrenheit',
      isWritable: true,
      pointType: 'Temperature',
      pointCategory: 'HVAC',
      minValue: 65,
      maxValue: 85
    });
    
    this.addPoint(100001, {
      objectType: 0, // Analog Input
      objectInstance: 2,
      objectName: 'Zone_2_Temp',
      description: 'Zone 2 Current Temperature',
      presentValue: 73.2,
      units: 'degreesFahrenheit',
      isWritable: false,
      pointType: 'Temperature',
      pointCategory: 'HVAC'
    });
    
    this.addPoint(100001, {
      objectType: 1, // Analog Output
      objectInstance: 1,
      objectName: 'AHU_1_Fan_Speed',
      description: 'Air Handler Unit 1 Fan Speed',
      presentValue: 75,
      units: 'percent',
      isWritable: true,
      pointType: 'Fan Speed',
      pointCategory: 'HVAC',
      minValue: 0,
      maxValue: 100
    });
    
    this.addPoint(100001, {
      objectType: 1, // Analog Output
      objectInstance: 2,
      objectName: 'VAV_1_Damper',
      description: 'VAV Box 1 Damper Position',
      presentValue: 50,
      units: 'percent',
      isWritable: true,
      pointType: 'Damper',
      pointCategory: 'HVAC',
      minValue: 0,
      maxValue: 100
    });
    
    // Add lighting points
    this.addPoint(100002, {
      objectType: 1, // Analog Output
      objectInstance: 10,
      objectName: 'Lobby_Dimmer',
      description: 'Lobby Lighting Dimmer Control',
      presentValue: 75,
      units: 'percent',
      isWritable: true,
      pointType: 'Dimmer',
      pointCategory: 'Lighting',
      minValue: 0,
      maxValue: 100
    });
    
    this.addPoint(100002, {
      objectType: 4, // Binary Output
      objectInstance: 1,
      objectName: 'Office_Lights',
      description: 'Office Area Lighting Switch',
      presentValue: 1,
      units: 'noUnits',
      isWritable: true,
      pointType: 'Switch',
      pointCategory: 'Lighting'
    });
    
    this.addPoint(100002, {
      objectType: 4, // Binary Output
      objectInstance: 2,
      objectName: 'Conference_Room_Lights',
      description: 'Conference Room Lighting',
      presentValue: 0,
      units: 'noUnits',
      isWritable: true,
      pointType: 'Switch',
      pointCategory: 'Lighting'
    });
    
    this.addPoint(100002, {
      objectType: 1, // Analog Output
      objectInstance: 11,
      objectName: 'Hallway_Dimmer',
      description: 'Hallway Lighting Dimmer',
      presentValue: 30,
      units: 'percent',
      isWritable: true,
      pointType: 'Dimmer',
      pointCategory: 'Lighting',
      minValue: 0,
      maxValue: 100
    });
    
    // Add energy monitoring points
    this.addPoint(100001, {
      objectType: 0, // Analog Input
      objectInstance: 100,
      objectName: 'Building_Power',
      description: 'Total Building Power Consumption',
      presentValue: 125.5,
      units: 'kilowatts',
      isWritable: false,
      pointType: 'Power',
      pointCategory: 'Energy'
    });
    
    this.addPoint(100001, {
      objectType: 0, // Analog Input
      objectInstance: 101,
      objectName: 'HVAC_Power',
      description: 'HVAC System Power Consumption',
      presentValue: 45.2,
      units: 'kilowatts',
      isWritable: false,
      pointType: 'Power',
      pointCategory: 'Energy'
    });
  }
  
  addDevice(device) {
    const deviceKey = `${device.address}:${device.deviceId}`;
    this.devices.set(deviceKey, {
      ...device,
      isOnline: true,
      lastSeen: new Date().toISOString(),
      points: []
    });
  }
  
  addPoint(deviceId, point) {
    const device = Array.from(this.devices.values()).find(d => d.deviceId === deviceId);
    if (!device) return;
    
    const pointKey = `${device.address}:${deviceId}:${point.objectType}:${point.objectInstance}`;
    const fullPoint = {
      ...point,
      deviceAddress: device.address,
      deviceId: deviceId
    };
    
    this.points.set(pointKey, fullPoint);
    device.points.push(fullPoint);
  }
  
  // Simulate network discovery
  async discoverDevices() {
    console.log('Starting virtual BACnet discovery...');
    
    // Simulate discovery delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const devices = Array.from(this.devices.values());
    const points = Array.from(this.points.values());
    
    console.log(`Discovered ${devices.length} devices with ${points.length} points`);
    
    return { devices, points };
  }
  
  // Simulate reading a point
  async readPoint(deviceAddress, objectType, objectInstance) {
    const pointKey = `${deviceAddress}:*:${objectType}:${objectInstance}`;
    const point = Array.from(this.points.entries()).find(([key]) => 
      key.match(new RegExp(pointKey.replace('*', '\\d+')))
    );
    
    if (point) {
      // Simulate some variation in analog values
      const pointData = point[1];
      if (objectType <= 2) { // Analog types
        const variation = (Math.random() - 0.5) * 2; // ±1 variation
        pointData.presentValue = Math.round((parseFloat(pointData.presentValue) + variation) * 10) / 10;
      }
      return pointData.presentValue;
    }
    return null;
  }
  
  // Simulate writing to a point
  async writePoint(deviceAddress, objectType, objectInstance, value, priority = 10) {
    const pointKey = `${deviceAddress}:*:${objectType}:${objectInstance}`;
    const point = Array.from(this.points.entries()).find(([key]) => 
      key.match(new RegExp(pointKey.replace('*', '\\d+')))
    );
    
    if (point) {
      const pointData = point[1];
      
      if (!pointData.isWritable) {
        throw new Error('Point is not writable');
      }
      
      // Validate value
      if (pointData.minValue !== undefined && value < pointData.minValue) {
        throw new Error(`Value below minimum (${pointData.minValue})`);
      }
      if (pointData.maxValue !== undefined && value > pointData.maxValue) {
        throw new Error(`Value above maximum (${pointData.maxValue})`);
      }
      
      // Update the value
      pointData.presentValue = value;
      console.log(`Virtual BACnet: Set ${pointData.objectName} to ${value} at priority ${priority}`);
      
      // Simulate temperature response for HVAC points
      if (pointData.pointCategory === 'HVAC' && pointData.pointType === 'Temperature') {
        this.simulateTemperatureResponse(deviceAddress, objectType, objectInstance, value);
      }
      
      return true;
    }
    
    throw new Error('Point not found');
  }
  
  // Simulate temperature changes
  simulateTemperatureResponse(deviceAddress, setpointType, setpointInstance, targetTemp) {
    // Find the corresponding temperature sensor
    const sensorInstance = setpointInstance; // Same instance number
    const sensorKey = `${deviceAddress}:*:0:${sensorInstance}`; // Type 0 is Analog Input
    
    const sensor = Array.from(this.points.entries()).find(([key]) => 
      key.match(new RegExp(sensorKey.replace('*', '\\d+')))
    );
    
    if (sensor) {
      const sensorData = sensor[1];
      const currentTemp = parseFloat(sensorData.presentValue);
      
      // Gradually move temperature towards setpoint
      const interval = setInterval(() => {
        const diff = targetTemp - parseFloat(sensorData.presentValue);
        if (Math.abs(diff) < 0.1) {
          clearInterval(interval);
          return;
        }
        
        // Move 10% towards target each second
        const change = diff * 0.1;
        sensorData.presentValue = Math.round((parseFloat(sensorData.presentValue) + change) * 10) / 10;
        console.log(`Virtual BACnet: ${sensorData.objectName} → ${sensorData.presentValue}°F`);
      }, 1000);
      
      // Stop after 30 seconds
      setTimeout(() => clearInterval(interval), 30000);
    }
  }
  
  // Get all devices
  getDevices() {
    return Array.from(this.devices.values());
  }
  
  // Get all points
  getPoints() {
    return Array.from(this.points.values());
  }
  
  // Get points for a specific device
  getDevicePoints(deviceId) {
    const device = Array.from(this.devices.values()).find(d => d.deviceId === deviceId);
    return device ? device.points : [];
  }
}

module.exports = VirtualBACnet;