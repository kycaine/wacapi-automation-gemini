import concurrently from 'concurrently';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production';

console.log(`🚀 Starting WA Automation SaaS (${isDev ? 'Development' : 'Production'})...`);

const { result } = concurrently(
    [
        { 
            command: isDev ? 'node --watch server/server.js' : 'node server/server.js', 
            name: 'SERVER', 
            prefixColor: 'blue' 
        },
        { 
            command: 'node client/index.js', 
            name: 'CLIENT', 
            prefixColor: 'green' 
        }
    ],
    {
        prefix: 'name',
        killOthersOn: ['failure', 'success'],
        restartTries: isDev ? 3 : 0,
    }
);

result.catch((err) => {
    // Errors are handled by concurrently prefixing
});
