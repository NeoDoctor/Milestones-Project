const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();

// Serve static files from current directory
app.use(express.static(__dirname));

// Get local IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '0.0.0.0';
}

// Generate a self-signed certificate on the fly
const selfsigned = require('selfsigned');
const attrs = [{ name: 'commonName', value: 'localhost' }];
const pems = selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256'
});

const options = {
    key: pems.private,
    cert: pems.cert
};

const PORT = 3000;
const localIP = getLocalIP();

const server = https.createServer(options, app);

// Function to display server addresses
function displayServerAddresses() {
    console.clear();
    console.log('\x1b[36m%s\x1b[0m', '='.repeat(50));
    console.log('\x1b[32m%s\x1b[0m', '🚀 Secure server is running!');
    console.log('\x1b[36m%s\x1b[0m', '='.repeat(50));
    console.log('\n📍 Access Points:');
    console.log('   Local:', '\x1b[33mhttps://localhost:' + PORT + '\x1b[0m');
    console.log('   Network:', '\x1b[33mhttps://' + localIP + ':' + PORT + '\x1b[0m');
    console.log('\n📱 Android Device Setup:');
    console.log('   1. Connect to the same WiFi network as this computer');
    console.log('   2. Open:', '\x1b[33mhttps://' + localIP + ':' + PORT + '\x1b[0m');
    console.log('   3. Accept the security warning (normal for local development)');
    console.log('\n\x1b[35m%s\x1b[0m', '✋ Press Ctrl+C to stop the server');
    console.log('\x1b[36m%s\x1b[0m', '='.repeat(50));
}

// Start the server
server.listen(PORT, '0.0.0.0', () => {
    displayServerAddresses();
});

// Handle server shutdown
process.on('SIGINT', () => {
    console.log('\n\x1b[31m%s\x1b[0m', '🛑 Shutting down server...');
    server.close(() => {
        console.log('\x1b[32m%s\x1b[0m', '✅ Server stopped successfully');
        process.exit(0);
    });
});