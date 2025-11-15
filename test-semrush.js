// test-semrush.js - Einfach speichern und ausführen!
// Speichere als: /workspaces/dasboard/test-semrush.js
// Führe aus: node test-semrush.js

const axios = require('axios');

const apiKey = process.env.SEMRUSH_API_KEY;
const projectId = '12920575';
const trackingId = '1209408';

console.log('🔍 SEMRUSH API TEST\n');
console.log('API Key:', apiKey ? apiKey.substring(0, 8) + '...' : '❌ NOT SET');
console.log('Project ID:', projectId);
console.log('Tracking ID:', trackingId);
console.log('\n' + '='.repeat(50) + '\n');

if (!apiKey) {
  console.error('❌ ERROR: SEMRUSH_API_KEY not set in .env');
  process.exit(1);
}

async function test() {
  console.log('🧪 TEST 1: Mit Tracking ID\n');
  
  try {
    const response = await axios.get(
      'https://api.semrush.com/reports/v1/projects/12920575/tracking/',
      {
        params: {
          key: apiKey,
          type: 'tracking_position_organic',
          action: 'report',
          tracking_id: trackingId,
          display_limit: '50'
        },
        timeout: 10000
      }
    );

    console.log('✅ SUCCESS!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2).substring(0, 300));
    
  } catch (error) {
    if (error.response) {
      console.log('❌ ERROR Status:', error.response.status);
      console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('❌ ERROR: No response from server');
      console.log('Request:', error.request);
    } else {
      console.log('❌ ERROR:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

test();
