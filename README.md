# Meterum - Energy Monitoring System

Enterprise-grade energy monitoring system using Veris E34 meters and Raspberry Pi nodes with cloud-based management.

## System Overview

Meterum provides comprehensive energy monitoring with:
- **Zero-touch deployment** via custom Linux OS
- **100% remote configuration** of energy meters
- **Real-time monitoring** through web dashboard
- **Scalable architecture** supporting 1000+ nodes

## Architecture

```
Cloud Infrastructure (Vercel + PostgreSQL)
├── Next.js Backend API
├── React Dashboard
└── PostgreSQL Database

Field Deployment
├── Raspberry Pi Nodes (Custom Linux OS)
└── Veris E34 Energy Meters (BACnet/IP)
```

## Features

- ✅ Auto-registration using CPU serial numbers
- ✅ BACnet/IP communication with Veris E34 meters
- ✅ 42 CT channel monitoring per meter
- ✅ 15-minute data collection intervals
- ✅ Mass deployment tools (3 min/node vs 60 min manual)
- ✅ Remote meter configuration
- ✅ Real-time energy visualization
- ✅ Multi-site customer hierarchy

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Vercel account
- Raspberry Pi 3B+ or 4B
- Veris E34 meters

### Installation

1. **Clone repository**
```bash
git clone https://github.com/yourusername/meterum.git
cd meterum
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. **Deploy backend to Vercel**
```bash
vercel deploy --prod
```

5. **Initialize database**
```bash
npm run db:init
```

## Project Structure

```
meterum/
├── backend/          # Next.js API backend
├── frontend/         # React dashboard
├── raspberry-pi/     # Node client for Pi
├── database/         # PostgreSQL schemas
├── deployment/       # Mass deployment tools
├── custom-os/        # OS build configurations
└── docs/            # Documentation
```

## Documentation

- [Deployment Guide](docs/deployment-guide.md)
- [API Reference](docs/api-reference.md)
- [Quick Start Guide](docs/quickstart-guide.md)
- [Troubleshooting](docs/troubleshooting.md)

## Performance

- **Deployment**: 3 minutes per node (95% faster than manual)
- **Data Collection**: Every 15 minutes
- **API Response**: <200ms average
- **Scale**: Supports 1000+ nodes

## License

Proprietary - All rights reserved

## Support

For support, please contact the development team.