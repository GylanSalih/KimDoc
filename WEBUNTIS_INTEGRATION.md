# WebUntis Integration

This project now uses the official [WebUntis library](https://github.com/SchoolUtils/WebUntis) instead of the custom proxy-based implementation.

## Features

- ✅ **Official WebUntis API**: Uses the well-maintained `webuntis` npm package
- ✅ **Multiple Authentication Methods**: Supports username/password, QR code, and secret-based authentication
- ✅ **TypeScript Support**: Full type safety with official type definitions
- ✅ **Simplified Configuration**: Easy setup through config.json
- ✅ **Better Error Handling**: More robust error handling and logging

## Configuration

Add the following fields to your `config.json`:

```json
{
  "untis_username": "your_username",
  "untis_password": "your_password",
  "untis_school": "your_school_name",
  "untis_server": "ajax.webuntis.com"
}
```

## Usage

The WebUntis service is automatically initialized and can be used in your components:

```typescript
import { webUntisService } from '../services/webuntisOfficial';

// Login
await webUntisService.login();

// Get today's timetable
const todayTimetable = await webUntisService.getTimetableForToday();

// Get week timetable
const weekTimetable = await webUntisService.getTimetableForWeek(monday);

// Get absences
const absences = await webUntisService.getAbsences(startDate, endDate);

// Logout
await webUntisService.logout();
```

## Migration from Proxy-based Implementation

The new implementation maintains compatibility with the existing Dashboard component. The following functions are exported for backward compatibility:

- `auth()` - Returns a mock auth object for compatibility
- `getAllWebUntisData()` - Main data collection function
- `getTimeTable()` - Get timetable for a specific week
- `getPeriodContent()` - Get detailed period information
- `getAbsences()` - Get absence data

## Benefits

1. **No Proxy Server Required**: Direct API communication eliminates the need for a proxy server
2. **Better Performance**: Direct communication is faster than proxy-based requests
3. **Official Support**: Uses the official library with active maintenance
4. **Type Safety**: Full TypeScript support with proper type definitions
5. **Easier Debugging**: Better error messages and logging

## Dependencies

- `webuntis`: Official WebUntis API client
- `otplib`: For QR code and secret-based authentication (optional)

## Testing

You can test the integration by running:

```bash
node test-webuntis.js
```

This will test the basic functionality of the WebUntis service.

## Troubleshooting

### Common Issues

1. **Login Failed**: Check your credentials and school/server configuration
2. **Network Errors**: Ensure your school's WebUntis server is accessible
3. **Type Errors**: Make sure you're using the correct types from the service

### Debug Mode

Enable debug logging by checking the browser console for detailed WebUntis API logs.

## Future Enhancements

- [ ] Add support for QR code authentication
- [ ] Add support for secret-based authentication
- [ ] Implement caching for better performance
- [ ] Add more detailed error handling
