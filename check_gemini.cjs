const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config({ path: '/home/ubuntu/ai-album-critic/.env' });

(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query('SELECT gemini_analysis_json FROM audio_features WHERE track_id = 30001 LIMIT 1');
  if (rows.length > 0) {
    const raw = rows[0].gemini_analysis_json;
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    console.log('Top-level keys:', Object.keys(data));
    if (data.sections) console.log('sections[0]:', JSON.stringify(data.sections[0]).substring(0, 300));
    if (data.overallEnergy) console.log('overallEnergy:', data.overallEnergy);
    if (data.energy) console.log('energy:', JSON.stringify(data.energy).substring(0, 200));
    if (data.dynamicRange) console.log('dynamicRange:', data.dynamicRange);
    if (data.mood) console.log('mood:', JSON.stringify(data.mood).substring(0, 300));
    if (data.arrangement) console.log('arrangement:', JSON.stringify(data.arrangement).substring(0, 300));
    // Check for energy-related fields at any level
    for (const key of Object.keys(data)) {
      const val = JSON.stringify(data[key]);
      if (key.toLowerCase().includes('energy') || key.toLowerCase().includes('dynamic') || key.toLowerCase().includes('overall')) {
        console.log(key + ':', val.substring(0, 200));
      }
    }
    // Check sections for energy field
    if (data.sections && data.sections.length > 0) {
      console.log('Section keys:', Object.keys(data.sections[0]));
    }
  }
  await conn.end();
})().catch(e => console.error(e));
