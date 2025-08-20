export interface BACnetCommand {
  objectType: string;
  objectInstance: number;
  property: string;
  value: any;
  priority?: number;
}

export interface ChannelConfig {
  channel: number;
  enabled: boolean;
  ctRatio: string;
  phase: string;
  name: string;
  loadType: string;
  highCurrentAlarm?: number;
  lowVoltageAlarm?: number;
}

export interface VoltageConfig {
  reference: number;
  nominalVoltage: number;
  ptRatio: string;
  phase: string;
}

export function generateVerisE34Commands(
  channels: ChannelConfig[],
  voltageRefs: VoltageConfig[]
): BACnetCommand[] {
  const commands: BACnetCommand[] = [];
  
  // Configure CT channels
  channels.forEach(channel => {
    const baseInstance = 1000 + (channel.channel * 10);
    
    // CT Ratio (100:5, 200:5, etc.)
    const ratioValue = parseInt(channel.ctRatio.split(':')[0]);
    commands.push({
      objectType: 'analog-value',
      objectInstance: baseInstance + 1,
      property: 'present-value',
      value: ratioValue
    });
    
    // Phase Assignment (1=A, 2=B, 3=C, 4=AB, 5=BC, 6=CA, 7=ABC)
    const phaseMap: { [key: string]: number } = {
      'A': 1, 'B': 2, 'C': 3, 'AB': 4, 'BC': 5, 'CA': 6, 'ABC': 7
    };
    commands.push({
      objectType: 'multi-state-value',
      objectInstance: baseInstance + 2,
      property: 'present-value',
      value: phaseMap[channel.phase] || 1
    });
    
    // Enable/Disable Channel
    commands.push({
      objectType: 'binary-value',
      objectInstance: baseInstance + 3,
      property: 'present-value',
      value: channel.enabled ? 1 : 0
    });
    
    // Channel Name
    if (channel.name) {
      commands.push({
        objectType: 'character-string-value',
        objectInstance: baseInstance + 4,
        property: 'present-value',
        value: channel.name
      });
    }
    
    // High Current Alarm
    if (channel.highCurrentAlarm) {
      commands.push({
        objectType: 'analog-value',
        objectInstance: baseInstance + 5,
        property: 'present-value',
        value: channel.highCurrentAlarm
      });
    }
    
    // Low Voltage Alarm
    if (channel.lowVoltageAlarm) {
      commands.push({
        objectType: 'analog-value',
        objectInstance: baseInstance + 6,
        property: 'present-value',
        value: channel.lowVoltageAlarm
      });
    }
  });
  
  // Configure voltage references
  voltageRefs.forEach(voltageRef => {
    const baseInstance = 2000 + (voltageRef.reference * 10);
    
    // Nominal Voltage
    commands.push({
      objectType: 'analog-value',
      objectInstance: baseInstance + 1,
      property: 'present-value',
      value: voltageRef.nominalVoltage
    });
    
    // PT Ratio
    const ptRatioValue = voltageRef.ptRatio === '1:1' ? 1 : 
                         parseInt(voltageRef.ptRatio.split(':')[0]);
    commands.push({
      objectType: 'analog-value',
      objectInstance: baseInstance + 2,
      property: 'present-value',
      value: ptRatioValue
    });
  });
  
  // Save configuration command
  commands.push({
    objectType: 'binary-value',
    objectInstance: 9999,
    property: 'present-value',
    value: 1
  });
  
  return commands;
}

export function generateDiscoveryCommands(): BACnetCommand[] {
  const commands: BACnetCommand[] = [];
  
  // Read all 42 channels to see which are active
  for (let channel = 1; channel <= 42; channel++) {
    const baseInstance = 1000 + (channel * 10);
    
    // Read CT ratio
    commands.push({
      objectType: 'analog-value',
      objectInstance: baseInstance + 1,
      property: 'present-value',
      value: 'READ'
    });
    
    // Read phase assignment
    commands.push({
      objectType: 'multi-state-value',
      objectInstance: baseInstance + 2,
      property: 'present-value',
      value: 'READ'
    });
    
    // Read enabled status
    commands.push({
      objectType: 'binary-value',
      objectInstance: baseInstance + 3,
      property: 'present-value',
      value: 'READ'
    });
  }
  
  return commands;
}