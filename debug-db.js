import { query } from './src/database/index.js';

async function debug() {
    const idToSearch = '211009238765391';
    console.log(`Searching for: [${idToSearch}]`);

    const allClients = await query('SELECT whatsapp_phone_number_id, is_active FROM clients');
    console.log('All clients in DB:');
    allClients.rows.forEach(row => {
        console.log(`- ID: [${row.whatsapp_phone_number_id}], Active: ${row.is_active}, Match: ${row.whatsapp_phone_number_id === idToSearch}`);
    });

    process.exit(0);
}

debug().catch(err => {
    console.error(err);
    process.exit(1);
});
