const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cookieParser = require('cookie-parser');

const app = express();
const port = 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// WebUntis Proxy Routes
app.post('/api/webuntis/auth', async (req, res) => {
  console.log('WebUntis authentication request received');
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Try different WebUntis servers for Heinrich-Hertz-Schule Düsseldorf
  const serverConfigs = [
    { server: 'neuss.webuntis.com', school: 'heinrich-hertz-schule' },
    { server: 'neuss.webuntis.com', school: 'heinrichhertzschule' },
    { server: 'ajax.webuntis.com', school: 'heinrich-hertz-schule' },
    { server: 'ajax.webuntis.com', school: 'heinrichhertzschule' },
    { server: 'herakles.webuntis.com', school: 'heinrich-hertz-schule' },
    { server: 'herakles.webuntis.com', school: 'heinrichhertzschule' }
  ];

  for (const config of serverConfigs) {
    try {
      console.log(`Trying ${config.server} with school ${config.school}`);
      
      const authUrl = `https://${config.server}/WebUntis/j_spring_security_check`;
      const formData = new URLSearchParams({
        school: config.school,
        j_username: username,
        j_password: password,
        token: ''
      });

      const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: formData,
        redirect: 'manual'
      });

      console.log(`Auth response status: ${authResponse.status}`);
      
      // Check for successful authentication
      if (authResponse.status === 302 || authResponse.status === 200) {
        const cookies = authResponse.headers.get('set-cookie');
        console.log('Authentication cookies:', cookies);
        
        if (cookies) {
          // Extract JSESSIONID
          const jsessionMatch = cookies.match(/JSESSIONID=([^;]+)/);
          const schoolnameMatch = cookies.match(/schoolname=([^;]+)/);
          
          if (jsessionMatch) {
            // Try to get a token
            const tokenUrl = `https://${config.server}/WebUntis/api/token/new`;
            const tokenResponse = await fetch(tokenUrl, {
              headers: {
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });

            if (tokenResponse.ok) {
              const token = await tokenResponse.text();
              console.log(`Success! Got token from ${config.server}`);
              
              return res.json({
                success: true,
                server: config.server,
                school: config.school,
                sessionId: jsessionMatch[1],
                schoolname: schoolnameMatch ? schoolnameMatch[1] : config.school,
                token: token.replace(/"/g, ''), // Remove quotes
                baseUrl: `https://${config.server}/WebUntis`
              });
            }
          }
        }
      }
    } catch (error) {
      console.log(`Error with ${config.server}/${config.school}:`, error.message);
      continue;
    }
  }

  res.status(401).json({ 
    error: 'WebUntis authentication failed for all servers. Check your credentials.',
    servers_tried: serverConfigs.map(c => `${c.server}/${c.school}`)
  });
});

// WebUntis API Proxy
app.get('/api/webuntis/*', async (req, res) => {
  const { server, sessionId, schoolname, token } = req.query;
  const apiPath = req.path.replace('/api/webuntis', '');
  
  if (!server || !sessionId) {
    return res.status(400).json({ error: 'Missing authentication parameters' });
  }

  const targetUrl = `https://${server}/WebUntis${apiPath}${req.url.includes('?') ? '&' : '?'}${new URLSearchParams(req.query).toString()}`;
  const cookies = `JSESSIONID=${sessionId}; schoolname=${schoolname}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Cookie': cookies,
        'Authorization': token ? `Bearer ${token}` : undefined,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('WebUntis API proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch from WebUntis API' });
  }
});

app.listen(port, () => {
  console.log(`WebUntis Proxy Server running at http://localhost:${port}`);
  console.log('Ready to handle WebUntis authentication and API requests');
});
