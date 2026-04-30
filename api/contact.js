import { kv } from '@vercel/kv';

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW = 24 * 60 * 60; // 24 hours in seconds

// In-memory fallback cache for local dev or if Vercel KV is not linked
const memoryCache = new Map();

// Profanity list
const FORBIDDEN_WORDS = ['sex', 'porn', 'fuck', 'shit', 'casino', 'bet', 'free money', 'winner', 'يا خول', 'شرموط', 'كسمك', 'سكس', 'نيك', 'قحبة'];

// Helper for robust IP extraction (Prioritize x-real-ip as Vercel sets it securely)
function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp) return realIp;
  
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown-ip';
}

// Memory fallback implementation
function getRateLimitMemory(ip) {
  const now = Date.now();
  let record = memoryCache.get(ip);
  if (!record) {
    record = { count: 0, resetTime: now + (RATE_LIMIT_WINDOW * 1000) };
    memoryCache.set(ip, record);
  }
  // Reset if expired
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + (RATE_LIMIT_WINDOW * 1000);
  }
  return record;
}

export default async function handler(req, res) {
  // 1. Method Validation
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Basic Bot Protection (User-Agent & Honeypot)
  const userAgent = req.headers['user-agent'] || '';
  if (!userAgent || userAgent.toLowerCase().includes('bot') || userAgent.toLowerCase().includes('crawler')) {
    return res.status(403).json({ error: 'Bot traffic rejected' });
  }

  // Ensure body is parsed
  const body = req.body || {};
  
  if (body._honeypot) {
    return res.status(403).json({ error: 'Spam detected' });
  }

  // 3. Backend Data Validation & Payload Size Limits
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  // Required fields check
  if (!firstName || !lastName || !email || !message) {
    console.error('Missing fields:', { firstName: !!firstName, lastName: !!lastName, email: !!email, message: !!message, rawBodyKeys: Object.keys(body) });
    return res.status(400).json({ error: 'Missing required fields', details: { firstName: !!firstName, lastName: !!lastName, email: !!email, message: !!message } });
  }

  // Size limits (Unrestricted Payload Prevention)
  if (firstName.length > 50 || lastName.length > 50) {
    return res.status(413).json({ error: 'Name payload too large' });
  }
  if (email.length > 100) {
    return res.status(413).json({ error: 'Email payload too large' });
  }
  if (message.length > 2000) {
    return res.status(413).json({ error: 'Message payload too large' });
  }

  // Email Domain Restriction (@gmail.com only)
  if (!email.toLowerCase().endsWith('@gmail.com')) {
    return res.status(400).json({ error: 'Only @gmail.com addresses are allowed' });
  }

  // Content Filter (Profanity check)
  const lowercaseMsg = message.toLowerCase();
  const foundWord = FORBIDDEN_WORDS.find(word => lowercaseMsg.includes(word));
  if (foundWord) {
    return res.status(400).json({ error: 'Message contains prohibited content' });
  }

  // 4. Robust IP Extraction & Rate Limiting
  const ip = getClientIp(req);
  const redisKey = `rate_limit:${ip}`;

  try {
    let currentCount = 0;
    
    if (process.env.KV_REST_API_URL) {
      currentCount = (await kv.get(redisKey)) || 0;
      if (currentCount >= RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }
      const newCount = await kv.incr(redisKey);
      if (newCount === 1) {
        await kv.expire(redisKey, RATE_LIMIT_WINDOW);
      }
    } else {
      const record = getRateLimitMemory(ip);
      if (record.count >= RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }
      record.count += 1;
    }

    // 5. Forward the request to Google Script
    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwu6tvQM1Iey1piZ3xFGV2-niLnXsWX9AeRcWqzoQIL0JhL_fDEcOmqGXFbKKCJ8bY/exec';
    
    // Explicitly reconstruct payload (Sanitization: ignores unexpected keys in req.body)
    const formDataParams = new URLSearchParams();
    formDataParams.append('firstName', firstName);
    formDataParams.append('lastName', lastName);
    formDataParams.append('email', email);
    formDataParams.append('message', message);
    if (body.company) formDataParams.append('company', String(body.company).substring(0, 100));
    if (body.phone) formDataParams.append('phone', String(body.phone).substring(0, 30));

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: formDataParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      console.error('Google Script Forwarding Error:', response.status, response.statusText);
      return res.status(502).json({ error: 'Failed to forward to external form' });
    }

    return res.status(200).json({ success: true, message: 'Message sent successfully' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
