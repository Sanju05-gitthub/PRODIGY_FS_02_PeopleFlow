import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const { PORT = 5000, MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, CLIENT_ORIGIN = 'http://localhost:5173' } = process.env;
if (!MONGODB_URI || !JWT_SECRET || JWT_SECRET.length < 32 || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error('Missing/invalid .env settings. See .env.example (JWT secret >=32 characters, password >=12).');
  process.exit(1);
}
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());
const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' };
const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  department: { type: String, required: true, trim: true },
  position: { type: String, required: true, trim: true },
  salary: { type: Number, required: true, min: 0 },
  joiningDate: { type: Date, required: true }
}, { timestamps: true });
const Employee = mongoose.model('Employee', employeeSchema);
const adminSchema = new mongoose.Schema({ email: { type: String, unique: true, required: true }, passwordHash: { type: String, required: true } });
const Admin = mongoose.model('Admin', adminSchema);
const employeeInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(150).transform(s => s.toLowerCase()),
  department: z.enum(['Engineering', 'Design', 'Marketing', 'Human Resources', 'Finance', 'Operations']),
  position: z.string().trim().min(2).max(80),
  salary: z.number().finite().min(0).max(100000000),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s, 'Invalid date')
}).strict();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
function auth(req, res, next) {
  try {
    const token = req.cookies.employee_admin;
    if (!token) return res.status(401).json({ message: 'Please log in.' });
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: 'employee-management' });
    if (payload.role !== 'admin') throw new Error('Invalid role');
    req.adminId = payload.sub;
    next();
  } catch { res.status(401).json({ message: 'Session expired. Please log in.' }); }
}
function requireOrigin(req, res, next) {
  if (['POST','PUT','PATCH','DELETE'].includes(req.method) && req.get('origin') !== CLIENT_ORIGIN) {
    return res.status(403).json({ message: 'Request origin not allowed.' });
  }
  next();
}
app.use('/api', requireOrigin);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.post('/api/auth/login', loginLimiter, async (req, res, next) => {
  try {
    const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email and password.' });
    const admin = await Admin.findOne({ email: parsed.data.email.toLowerCase() });
    const valid = admin && await bcrypt.compare(parsed.data.password, admin.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password.' });
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { subject: String(admin._id), expiresIn: '2h', algorithm: 'HS256', issuer: 'employee-management' });
    res.cookie('employee_admin', token, { ...cookieOptions, maxAge: 2 * 60 * 60 * 1000 });
    res.json({ message: 'Login successful', admin: { email: admin.email } });
  } catch (err) { next(err); }
});
app.get('/api/auth/me', auth, async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.adminId).select('email');
    if (!admin) return res.status(401).json({ message: 'Unauthorized' });
    res.json({ admin });
  } catch (err) { next(err); }
});
app.post('/api/auth/logout', (_req, res) => { res.clearCookie('employee_admin', cookieOptions); res.json({ message: 'Logged out' }); });
app.get('/api/employees', auth, async (_req, res, next) => {
  try { res.json(await Employee.find().sort({ createdAt: -1 }).lean()); } catch (err) { next(err); }
});
app.post('/api/employees', auth, async (req, res, next) => {
  try {
    const parsed = employeeInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
    res.status(201).json(await Employee.create(parsed.data));
  } catch (err) { next(err); }
});
app.put('/api/employees/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid employee ID' });
    const parsed = employeeInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
    const result = await Employee.findByIdAndUpdate(req.params.id, parsed.data, { new: true, runValidators: true });
    if (!result) return res.status(404).json({ message: 'Employee not found' });
    res.json(result);
  } catch (err) { next(err); }
});
app.delete('/api/employees/:id', auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid employee ID' });
    const result = await Employee.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Employee not found' });
    res.json({ message: 'Employee deleted' });
  } catch (err) { next(err); }
});
app.use((err, _req, res, _next) => {
  if (err.code === 11000) return res.status(409).json({ message: 'An employee with this email already exists.' });
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error.' });
});
async function start() {
  await mongoose.connect(MONGODB_URI);
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await Admin.findOne({ email });
  if (!existing) {
    await Admin.create({ email, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12) });
    console.log('Administrator account created.');
  }
  app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
}
start().catch(err => { console.error('Startup failed:', err.message); process.exit(1); });
