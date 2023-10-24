import dotenv from 'dotenv';
dotenv.config({
    path: './.env',
});

// app constants
export const MONGO_DB_URL = process.env.MONGO_DB_URL;
export const PORT = process.env.PORT;

// secret keys
export const SECRET_SALT = 12;
export const SESSION_SECRET_KEY = process.env.SESSION_SECRET_KEY;
export const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
