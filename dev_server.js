const express = require('express');
const path = require('path');
const http = require('http');

/**
 * Robust Dev Server for SanalOyuncular (Alternative to UI5 Serve)
 * Serves the 'public' folder (built files) and proxies /api to 3000
 */
const app = express();
const PORT = 8080;
const API_TARGET_PORT = 3001;

// Simple Proxy for /api
app.use('/api', (req, res) => {
    const connector = http.request(
        {
            host: 'localhost',
            port: API_TARGET_PORT,
            path: '/api' + req.url,
            method: req.method,
            headers: req.headers,
        },
        (resp) => {
            res.writeHead(resp.statusCode, resp.headers);
            resp.pipe(res);
        }
    );
    req.pipe(connector);
    connector.on('error', (err) => {
        console.error('API Proxy Error:', err.message);
        res.status(502).send('API Server unreachable on port ' + API_TARGET_PORT);
    });
});

// Serve built files from public
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Fallback to index.html for UI5 routing
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SanalOyuncular UI started at http://localhost:${PORT}`);
    console.log(`📡 API Proxy -> http://localhost:${API_TARGET_PORT}/api\n`);
    console.log(`📂 Serving from: ${publicPath}`);
});
