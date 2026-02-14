const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute('SELECT reportMarkdown FROM mixReports ORDER BY id DESC LIMIT 1');
  const raw = rows[0].reportMarkdown;
  
  console.log('Raw starts with:', raw.substring(0, 50));
  
  // Simulate the parsing logic
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  console.log('Cleaned starts with:', cleaned.substring(0, 50));
  
  try {
    const parsed = JSON.parse(cleaned);
    console.log('Parse succeeded!');
    console.log('Has reportMarkdown:', !!parsed.reportMarkdown);
    console.log('reportMarkdown starts with:', parsed.reportMarkdown?.substring(0, 80));
    console.log('Has frequencyAnalysis:', !!parsed.frequencyAnalysis);
    console.log('freq lowEnd rating:', parsed.frequencyAnalysis?.lowEnd?.rating);
    console.log('Has dawSuggestions:', Array.isArray(parsed.dawSuggestions), 'count:', parsed.dawSuggestions?.length);
  } catch(e) {
    console.log('Parse failed:', e.message);
  }
  await conn.end();
}
main().catch(console.error);
