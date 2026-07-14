const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// The 100% Free Search API Endpoint
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "No search term provided" });

    const baseTarget = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`;

    // The Free Routing Engine: Direct Mirrors + Public API Proxies
    const freeRoutes = [
        baseTarget, // 1. Try direct connection first
        `https://yts.rs/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`, // 2. Official Mirror
        `https://yts.do/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`, // 3. Official Mirror
        `https://api.allorigins.win/raw?url=${encodeURIComponent(baseTarget)}`,           // 4. Free Public Proxy 1
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(baseTarget)}`       // 5. Free Public Proxy 2
    ];

    // Loop through the free routes until one successfully bypasses Cloudflare
    for (let route of freeRoutes) {
        try {
            console.log(`Trying route: ${route.substring(0, 40)}...`);
            
            const response = await axios.get(route, { 
                timeout: 8000 // Max 8 seconds per attempt
            });
            
            // Verify we actually got the JSON movie data back (not a Cloudflare block page)
            if (response.data && response.data.data) {
                console.log("Success! Data fetched.");
                return res.status(200).json(response.data);
            }
        } catch (error) {
            console.log("Route blocked or failed. Switching to next...");
        }
    }

    // If everything fails
    return res.status(500).json({ error: "All free servers and public proxies are currently blocked." });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
