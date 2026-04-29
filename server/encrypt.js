import { encrypt } from './services/encryptionService.js';

const token = process.argv[2];

if (!token) {
    console.error('Usage: node encrypt.js <ACCESS_TOKEN>');
    process.exit(1);
}

const encrypted = encrypt(token);
console.log(encrypted);