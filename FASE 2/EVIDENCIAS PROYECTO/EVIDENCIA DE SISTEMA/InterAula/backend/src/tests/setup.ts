import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Each test worker gets its own files and cannot connect to real user data.
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_ANON_KEY = 'isolated-test-public-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.SUPABASE_SECRET_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.ML_SERVICE_URL = '';
process.env.EMAIL_ENABLED='false';
process.env.RESEND_API_KEY='';
process.env.EMAIL_FROM='';
process.env.APP_PUBLIC_URL='';
process.env.APP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'interaula-tests-'));

// Unit HTTP fixtures do not call a live database. Moderation tests override this gate.
const {mock}=await import('node:test');
const {moderationService}=await import('../services/moderation.service.js');
mock.method(moderationService,'summary',async()=>({enabled:false,account:false,tutoring:false,community:false}));
