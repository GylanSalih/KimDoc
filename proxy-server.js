const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

console.log('🚀 WebUntis Proxy Server starting...');

// WebUntis School Search
app.post('/api/webuntis/search-school', async (req, res) => {
  try {
    const { searchTerm } = req.body;
    console.log(`🔍 Searching for school: ${searchTerm}`);
    
    const response = await fetch('https://mobile.webuntis.com/ms/schoolquery2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebUntisProxy/1.0'
      },
      body: JSON.stringify({
        id: 'schoolquery',
        method: 'searchSchool',
        params: [{
          search: searchTerm,
          schoolname: '',
          country: 'DE',
          student: true
        }],
        jsonrpc: '2.0'
      })
    });

    const data = await response.json();
    console.log(`📋 Found ${data.result?.schools?.length || 0} schools for "${searchTerm}"`);
    
    // Debug: Show all school details
    if (data.result?.schools) {
      data.result.schools.forEach((school, index) => {
        console.log(`🏫 School ${index + 1}:`);
        console.log(`   Display Name: ${school.displayName}`);
        console.log(`   Login Name: ${school.loginName}`);
        console.log(`   Server: ${school.server}`);
        console.log(`   Address: ${school.address}`);
        console.log(`   SchoolId: ${school.schoolId || 'N/A'}`);
        console.log(`   SchoolNumber: ${school.schoolNumber || 'N/A'}`);
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('❌ School search error:', error);
    res.status(500).json({ error: 'School search failed' });
  }
});

// WebUntis Authentication
app.post('/api/webuntis/authenticate', async (req, res) => {
  try {
    const { username, password, server, schoolname } = req.body;
    console.log(`🔐 Authenticating ${username} at ${schoolname} on ${server}`);
    
    // First, let's search for ALL Heinrich-Hertz schools in Germany to find the correct loginName
    console.log(`🔍 Searching for ALL Heinrich-Hertz schools to find correct loginName...`);
    
    const searchUrl = 'https://mobile.webuntis.com/ms/schoolquery2';
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebUntisProxy/1.0'
      },
      body: JSON.stringify({
        id: 'schoolquery',
        method: 'searchSchool',
        params: [{
          search: 'Heinrich-Hertz',
          schoolname: '',
          country: 'DE',
          student: true
        }],
        jsonrpc: '2.0'
      })
    });

    const searchData = await searchResponse.json();
    console.log(`📋 Found ${searchData.result?.schools?.length || 0} Heinrich-Hertz schools in Germany`);
    
    // Show all Heinrich-Hertz schools to find the exact one
    const heinrichHertzSchools = [];
    if (searchData.result?.schools) {
      searchData.result.schools.forEach((school, index) => {
        console.log(`🏫 Heinrich-Hertz School ${index + 1}:`);
        console.log(`   Display Name: ${school.displayName}`);
        console.log(`   Login Name: ${school.loginName}`);
        console.log(`   Server: ${school.server}`);
        console.log(`   Address: ${school.address}`);
        console.log(`   SchoolId: ${school.schoolId || 'N/A'}`);
        
        // Collect all possible login names for Düsseldorf Heinrich-Hertz schools
        if (school.address && school.address.includes('Düsseldorf')) {
          heinrichHertzSchools.push(school.loginName);
        }
      });
    }
    
    // Try all found Heinrich-Hertz school login names from Düsseldorf
    const schoolNameVariations = [
      schoolname, // Original from search
      ...heinrichHertzSchools, // All Heinrich-Hertz schools from Düsseldorf
      'heinrich-hertz-schule-duesseldorf',
      'stadtheinrichhertzschule', 
      'heinrich-hertz-schule',
      'heinrichhertzschule',
      'hhs-duesseldorf',
      'Städt. Heinrich-Hertz-Schule Düsseldorf',
      'stadtduesseldorf-heinrichhertzschule',
      'StaedtHeinrichHertzSchule'
    ];
    
    const authUrl = `https://${server}/WebUntis/jsonrpc.do`;
    
    let lastError = null;
    
    for (const schoolVariation of schoolNameVariations) {
      try {
        console.log(`🔐 Trying schoolname variation: ${schoolVariation}`);
        
        const response = await fetch(authUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'WebUntisProxy/1.0'
          },
          body: JSON.stringify({
            id: 'auth',
            method: 'authenticate',
            params: {
              user: username,
              password: password,
              client: 'WebUntisProxy',
              schoolname: schoolVariation
            },
            jsonrpc: '2.0'
          })
        });

        const data = await response.json();
        
        // Debug: Log full response for troubleshooting
        console.log(`📋 Full WebUntis response for ${schoolVariation}:`, JSON.stringify(data, null, 2));
        
        if (data.result && data.result.sessionId) {
          console.log(`✅ Authentication successful for ${username} with schoolname: ${schoolVariation}`);
          return res.json({
            success: true,
            sessionId: data.result.sessionId,
            server: server,
            schoolname: schoolVariation
          });
        } else {
          console.log(`❌ Authentication failed for ${schoolVariation}: ${data.error?.message || 'Unknown error'}`);
          console.log(`❌ Error code: ${data.error?.code}, Details:`, data.error);
          
          // Check if it's a user credentials issue vs schoolname issue
          if (data.error?.code === -8504 || data.error?.message?.includes('invalid credentials')) {
            console.log(`⚠️  This might be a username/password issue, not schoolname!`);
          } else if (data.error?.code === -8500) {
            console.log(`⚠️  This is definitely a schoolname issue (Error -8500)`);
          }
          
          lastError = data.error?.message || 'Authentication failed';
        }
      } catch (error) {
        console.log(`❌ Error with schoolname ${schoolVariation}:`, error.message);
        lastError = error.message;
        continue;
      }
    }
    
    // If all variations failed
    console.log(`❌ All authentication attempts failed. Last error: ${lastError}`);
    res.status(401).json({
      success: false,
      error: `Authentication failed for all schoolname variations. Last error: ${lastError}`,
      tried_variations: schoolNameVariations
    });
  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Authentication request failed' 
    });
  }
});

// WebUntis API Proxy
app.post('/api/webuntis/request', async (req, res) => {
  try {
    const { server, sessionId, method, params = {} } = req.body;
    
    if (!server || !sessionId || !method) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log(`📡 WebUntis API call: ${method} on ${server}`);
    
    const apiUrl = `https://${server}/WebUntis/jsonrpc.do?school=${req.body.schoolname}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebUntisProxy/1.0',
        'Cookie': `JSESSIONID=${sessionId}`
      },
      body: JSON.stringify({
        id: Date.now().toString(),
        method: method,
        params: params,
        jsonrpc: '2.0'
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.log(`⚠️ API error for ${method}: ${data.error.message}`);
    } else {
      console.log(`✅ API success for ${method}`);
    }
    
    res.json(data);
  } catch (error) {
    console.error('❌ API request error:', error);
    res.status(500).json({ error: 'API request failed' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'WebUntis Proxy Server is running' });
});

app.listen(PORT, () => {
  console.log(`✨ WebUntis Proxy Server running on http://localhost:${PORT}`);
  console.log(`🔗 Frontend can now connect to WebUntis through this proxy`);
  console.log(`📚 Ready to fetch real WebUntis data for Heinrich-Hertz-Schule!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down WebUntis Proxy Server...');
  process.exit(0);
});
