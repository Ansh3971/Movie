const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "No search term provided" });

    const baseTarget = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`;

    const freeRoutes = [
        baseTarget, 
        `https://yts.rs/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`,
        `https://yts.do/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(baseTarget)}`,           
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(baseTarget)}`       
    ];

    // THE FIX: We disguise the Node.js server to look exactly like Google Chrome
    const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://google.com/'
    };

    for (let route of freeRoutes) {
        try {
            console.log(`Trying route: ${route.substring(0, 50)}...`);
            
            const response = await axios.get(route, { 
                headers: browserHeaders, // Inject the fake browser headers here
                timeout: 8000 
            });
            
            if (response.data && response.data.data) {
                console.log("Success! Cloudflare bypassed.");
                return res.status(200).json(response.data);
            }
        } catch (error) {
            // Log the actual error code (e.g., 403 Forbidden) so we know exactly why it failed
            console.log(`Route failed: HTTP ${error.response ? error.response.status : error.message}`);
        }
    }

    return res.status(500).json({ error: "All servers blocked. Cloudflare WAF is actively blocking Render IPs." });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
