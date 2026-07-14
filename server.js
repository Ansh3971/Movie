const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Timeout wrapper to prevent hanging requests
async function fetchWithTimeout(url, timeout = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: controller.signal
    });
    clearTimeout(id);
    return response;
}

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "No search term provided" });

    console.log(`\n--- Searching for: ${query} ---`);

    // The Master Route: APIBay (The Pirate Bay API - No Cloudflare Datacenter Blocks)
    try {
        console.log("Attempt 1: APIBay (The Pirate Bay network)...");
        
        // Fetch from TPB
        const tpbRes = await fetchWithTimeout(`https://apibay.org/q.php?q=${encodeURIComponent(query)}`);
        const tpbData = await tpbRes.json();

        // TPB returns an array with id "0" if it finds no results
        if (Array.isArray(tpbData) && tpbData.length > 0 && tpbData[0].id !== "0") {
            console.log("✅ Success! Data fetched from APIBay.");

            // We must format TPB's data to perfectly match what your index.html expects from YTS
            const formattedMovies = tpbData.slice(0, 20).map(torrent => {
                
                // Extract a year from the torrent title if it exists (e.g., "Baahubali 2015")
                const yearMatch = torrent.name.match(/\b(19|20)\d{2}\b/);
                const year = yearMatch ? yearMatch[0] : "P2P";

                return {
                    title: torrent.name.replace(/\./g, ' '), // Clean up the dots TPB uses in titles
                    year: year,
                    rating: `Seeds: ${torrent.seeders}`, // Repurpose the rating UI to show seeder health
                    medium_cover_image: `https://via.placeholder.com/200x300/141419/00f2fe?text=STREAMX+|+P2P`, // Generic cover since TPB doesn't have posters
                    torrents: [
                        {
                            hash: torrent.info_hash,
                            quality: "Unknown"
                        }
                    ]
                };
            });

            // Send the disguised data back to the frontend
            return res.status(200).json({ data: { movies: formattedMovies } });
        } else {
            console.log("⚠️ APIBay found 0 results for this query.");
        }
    } catch (e) {
        console.log("❌ APIBay failed:", e.message);
    }

    // Fallback: If TPB is down, try direct YTS just in case Cloudflare lets it slip through
    try {
        console.log("Attempt 2: Direct YTS fallback...");
        const ytsRes = await fetchWithTimeout(`https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`);
        const ytsData = await ytsRes.json();
        if (ytsData.data && ytsData.data.movies) {
            console.log("✅ Success via YTS fallback!");
            return res.status(200).json(ytsData);
        }
    } catch (e) {
         console.log("❌ YTS fallback blocked.");
    }

    console.log("🛑 All networks failed.");
    return res.status(500).json({ error: "No results found or network is temporarily unreachable." });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
