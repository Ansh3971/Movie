const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Helper function: Strictly limits how long a request can take to prevent hanging
async function fetchWithTimeout(url, options = {}, timeout = 6000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
}

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "No search term provided" });

    const target = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`;
    
    // Disguise our server as a standard Windows PC running Chrome
    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    };

    // Attempt 1: AllOrigins JSON Wrapper (Highly effective against DNS blocks)
    try {
        console.log("Attempt 1: AllOrigins...");
        const response = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`, options, 8000);
        const json = await response.json();
        
        if (json.contents) {
            try {
                // If Cloudflare returns an HTML block page, JSON.parse will fail gracefully and jump to Attempt 2
                const ytsData = JSON.parse(json.contents);
                if (ytsData.data && ytsData.data.movies) {
                    console.log("✅ Success via AllOrigins!");
                    return res.status(200).json(ytsData);
                }
            } catch (e) {
                console.log("❌ AllOrigins returned HTML (Cloudflare block).");
            }
        }
    } catch (e) { console.log("❌ AllOrigins failed:", e.message); }

    // Attempt 2: CorsProxy
    try {
        console.log("Attempt 2: CorsProxy...");
        const response = await fetchWithTimeout(`https://corsproxy.io/?url=${encodeURIComponent(target)}`, options, 8000);
        const ytsData = await response.json();
        if (ytsData.data && ytsData.data.movies) {
            console.log("✅ Success via CorsProxy!");
            return res.status(200).json(ytsData);
        }
    } catch (e) { console.log("❌ CorsProxy failed."); }

    // Attempt 3: Direct Backup Mirrors (Bypasses Render's ENOTFOUND block on the main domain)
    // We iterate through 5 different YTS extensions in case one is seized or down.
    const mirrors = ['yts.lt', 'yts.ag', 'yts.am', 'yts.rs', 'yts.vc'];
    for (let domain of mirrors) {
        try {
            console.log(`Attempt 3: Mirror ${domain}...`);
            const mirrorUrl = `https://${domain}/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`;
            const response = await fetchWithTimeout(mirrorUrl, options, 6000);
            const ytsData = await response.json();
            
            if (ytsData.data && ytsData.data.movies) {
                console.log(`✅ Success via ${domain}!`);
                return res.status(200).json(ytsData);
            }
        } catch (e) {
            console.log(`❌ ${domain} failed.`);
        }
    }

    console.log("🛑 All routes exhausted.");
    return res.status(500).json({ error: "All backend routing attempts were blocked. Please try searching again in a few minutes." });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
