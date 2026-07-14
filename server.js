const express = require('express');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Your Private Proxies safely hidden on the server
const rawProxies = [
    "31.59.20.176:6754:proportalx:originalchannel",
    "31.56.127.193:7684:proportalx:originalchannel",
    "45.38.107.97:6014:proportalx:originalchannel",
    "198.105.121.200:6462:proportalx:originalchannel",
    "64.137.96.74:6641:proportalx:originalchannel",
    "198.23.243.226:6361:proportalx:originalchannel",
    "38.154.185.97:6370:proportalx:originalchannel",
    "84.247.60.125:6095:proportalx:originalchannel",
    "142.111.67.146:5611:proportalx:originalchannel",
    "191.96.254.138:6185:proportalx:originalchannel"
];

// Format proxies for Node.js
const proxies = rawProxies.map(p => {
    const [ip, port, user, pass] = p.split(':');
    return `http://${user}:${pass}@${ip}:${port}`;
});

// THE FIX: Explicitly send the index.html file from the main root folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// The Search API Endpoint
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "No search term provided" });

    const targetUrl = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`;

    // Loop through proxies until one works
    for (let proxyUrl of proxies) {
        try {
            const agent = new HttpsProxyAgent(proxyUrl);
            const response = await axios.get(targetUrl, {
                httpsAgent: agent,
                timeout: 8000 // 8 second timeout per proxy
            });
            
            return res.status(200).json(response.data); // Success! Send data to frontend
        } catch (error) {
            console.log("Proxy failed, trying next...");
        }
    }

    return res.status(500).json({ error: "All proxies failed to connect." });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
