import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Each test worker gets its own files and cannot connect to real user data.
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_ANON_KEY = 'isolated-test-public-key';
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.GEMINI_API_KEY;
process.env.APP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'interaula-tests-'));
