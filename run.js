import concurrently from 'concurrently';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting WA Automation SaaS (Client & Server)...');

const { result } = concurrently(
    [
        { 
            command: 'npm run dev:be', 
            name: 'SERVER', 
            prefixColor: 'blue' 
        },
        { 
            command: 'npm run dev:fe', 
            name: 'CLIENT', 
            prefixColor: 'green' 
        }
    ],
    {
        prefix: 'name',
        killOthersOn: ['failure', 'success'],
        restartTries: 0,
    }
);

result.catch((err) => {
    // Errors are handled by concurrently prefixing
});
